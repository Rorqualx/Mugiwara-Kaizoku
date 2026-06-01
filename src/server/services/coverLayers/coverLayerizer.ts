/**
 * Cover layerizer service
 *
 * Runs the Python cover-layerizer sidecar (ml/cover-layers/layerize.py) for a
 * manga's cached cover and records the result in `CoverLayerSet`. The on-disk
 * manifest.json (served by /api/cover-layers/[id]) is the artifact the UI reads;
 * the DB row tracks status + the source-cover hash so we skip fresh covers and
 * re-run when a cover changes or the pipeline version bumps.
 *
 * Generation is CPU-bound and offline — never call this on a request path; it is
 * driven by the backfill script and a fire-and-forget trigger after cover set.
 */

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';
import { configService } from '@/server/services/config/configService';
import { logger } from '@/utils/logger';

/** Bump to re-layerize. v2: tuned drift. v3: text + depth bands. v4: near-item sprites. */
export const COVER_LAYER_PIPELINE_VERSION = 4;

/** Config key for the global Living Covers master switch (default off). */
export const LIVING_COVERS_ENABLED_KEY = 'covers.living.enabled';

const MODEL_DOWNLOAD_TIMEOUT_MS = 600_000;

const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;
const SIDECAR_TIMEOUT_MS = 180_000;
const REQUIRED_MODELS = ['isnetis.onnx', 'lama_fp32.onnx'] as const;

/** Outcome of a single layerize attempt. */
export interface LayerizeResult {
  mangaId: number;
  status: 'layered' | 'flat' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
}

/** Manga ids currently being processed, to avoid duplicate concurrent work. */
const inFlight = new Set<number>();

function cacheBaseDir(): string {
  return process.env['MANGA_FILES_DIR'] ?? path.join(process.cwd(), 'data/cache');
}

function modelsDir(): string {
  return process.env['COVER_LAYER_MODELS_DIR'] ?? path.join(cacheBaseDir(), 'cover-layer-models');
}

function scriptDir(): string {
  return process.env['COVER_LAYER_SCRIPT_DIR'] ?? path.join(process.cwd(), 'ml/cover-layers');
}

function scriptPath(): string {
  return path.join(scriptDir(), 'layerize.py');
}

/** Cache for covers the layerizer downloaded itself (kept apart from the local-cover cache). */
function coverSrcDir(): string {
  return path.join(cacheBaseDir(), 'cover-layers-src');
}

/** Finds a `manga-<id>.<ext>` file in `dir`, trying each supported extension. */
async function findInDir(dir: string, mangaId: number): Promise<string | null> {
  const checks = await Promise.all(
    COVER_EXTENSIONS.map(async (ext): Promise<string | null> => {
      const candidate = path.join(dir, `manga-${mangaId}${ext}`);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        return null;
      }
    }),
  );
  return checks.find((c) => c !== null) ?? null;
}

/** The manga's best provider cover URL (highest-res first), or null if none/local. */
async function metadataCoverUrl(mangaId: number): Promise<string | null> {
  const row = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { Metadata: { select: { coverExtraLarge: true, coverLarge: true, cover: true, coverMedium: true } } },
  });
  const md = row?.Metadata;
  if (md === null || md === undefined) {
    return null;
  }
  // `cover` is non-nullable (defaults to the placeholder), so it terminates the
  // chain; only accept it when it's an actual remote URL.
  const raw = md.coverExtraLarge ?? md.coverLarge ?? md.cover;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function coverExt(url: string, contentType: string | null): string {
  if (contentType?.includes('png') === true) return '.png';
  if (contentType?.includes('webp') === true) return '.webp';
  if (contentType?.includes('gif') === true) return '.gif';
  if (contentType?.includes('jpeg') === true) return '.jpg';
  const m = /\.(jpe?g|png|webp|gif)(?:\?|$)/i.exec(url);
  return m?.[1] !== undefined ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

/** Downloads a remote cover into the source cache; returns its path or null. */
async function downloadCover(mangaId: number, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mugiwara-Kaizoku/1.0 (+cover-layerizer)' } });
    if (!res.ok) {
      logger.warn('Cover download failed', { mangaId, status: res.status });
      return null;
    }
    const dir = coverSrcDir();
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, `manga-${mangaId}${coverExt(url, res.headers.get('content-type'))}`);
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  } catch (err: unknown) {
    logger.warn('Cover download threw', { mangaId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Resolves the cover image to layerize: a previously-downloaded source, the
 * local-cover extraction cache, or a fresh download of the provider cover URL.
 */
async function findCoverFile(mangaId: number): Promise<string | null> {
  const cached = await findInDir(coverSrcDir(), mangaId);
  if (cached !== null) {
    return cached;
  }
  const local = await findInDir(path.join(cacheBaseDir(), 'covers'), mangaId);
  if (local !== null) {
    return local;
  }
  const url = await metadataCoverUrl(mangaId);
  return url !== null ? downloadCover(mangaId, url) : null;
}

/** True when the required ONNX models are present in the models dir. */
export async function modelsPresent(): Promise<boolean> {
  const dir = modelsDir();
  const checks = await Promise.all(
    REQUIRED_MODELS.map(async (m) => {
      try {
        await fs.access(path.join(dir, m));
        return true;
      } catch {
        return false;
      }
    }),
  );
  return checks.every(Boolean);
}

/** Reads the global Living Covers master switch (string or boolean config row). */
export async function isLivingCoversEnabled(): Promise<boolean> {
  const value = await configService.get<unknown>(LIVING_COVERS_ENABLED_KEY, false);
  return value === true || value === 'true';
}

/** Builds the command to run the model downloader sidecar (uv in dev, python in image). */
function modelDownloadCommand(): { cmd: string; args: string[] } {
  const runner = process.env['COVER_LAYER_PYTHON'] ?? 'uv';
  const script = path.join(scriptDir(), 'download_models.py');
  const scriptArgs = ['--models-dir', modelsDir()];
  if (runner === 'uv') {
    return { cmd: 'uv', args: ['run', '--python', '3.11', 'python', script, ...scriptArgs] };
  }
  return { cmd: runner, args: [script, ...scriptArgs] };
}

let modelDownloadInFlight = false;

/** Whether a model download is currently running. */
export function isDownloadingModels(): boolean {
  return modelDownloadInFlight;
}

/**
 * Downloads the ONNX models into the models dir (idempotent — skips present
 * files). No-ops while a download is already in flight.
 */
export function downloadCoverModels(): Promise<{ ok: boolean; error?: string }> {
  if (modelDownloadInFlight) {
    return Promise.resolve({ ok: false, error: 'already downloading' });
  }
  modelDownloadInFlight = true;
  const { cmd, args } = modelDownloadCommand();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: process.cwd() });
    let stderr = '';
    const finish = (result: { ok: boolean; error?: string }): void => {
      clearTimeout(timer);
      modelDownloadInFlight = false;
      resolve(result);
    };
    const timer = setTimeout(() => child.kill('SIGKILL'), MODEL_DOWNLOAD_TIMEOUT_MS);
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => finish({ ok: false, error: err.message }));
    child.on('close', (code) =>
      finish(code === 0 ? { ok: true } : { ok: false, error: stderr.slice(-500) || `downloader exited ${code}` }),
    );
  });
}

/** Builds the command + args to run the sidecar (uv by default for dev). */
function sidecarCommand(coverPath: string, mangaId: number, outDir: string): { cmd: string; args: string[] } {
  const runner = process.env['COVER_LAYER_PYTHON'] ?? 'uv';
  const device = process.env['COVER_LAYER_DEVICE'] ?? 'cpu';
  const scriptArgs = ['--cover', coverPath, '--id', String(mangaId), '--out', outDir, '--models-dir', modelsDir(), '--device', device];
  if (runner === 'uv') {
    return {
      cmd: 'uv',
      args: ['run', '--python', '3.11', '--with', 'onnxruntime', '--with', 'numpy', '--with', 'pillow', 'python', scriptPath(), ...scriptArgs],
    };
  }
  // Otherwise treat COVER_LAYER_PYTHON as a python interpreter with deps installed.
  return { cmd: runner, args: [scriptPath(), ...scriptArgs] };
}

function runSidecar(coverPath: string, mangaId: number, outDir: string): Promise<{ code: number; stderr: string }> {
  const { cmd, args } = sidecarCommand(coverPath, mangaId, outDir);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: process.cwd() });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, SIDECAR_TIMEOUT_MS);
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stderr: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

interface ManifestShape {
  mode?: unknown;
  fgCoverage?: unknown;
}

async function readManifest(outDir: string): Promise<{ mode: string; fgCoverage: number | null; raw: unknown } | null> {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    const m = raw as ManifestShape;
    const mode = typeof m.mode === 'string' ? m.mode : 'flat';
    const fgCoverage = typeof m.fgCoverage === 'number' ? m.fgCoverage : null;
    return { mode, fgCoverage, raw };
  } catch {
    return null;
  }
}

/**
 * Layerizes a single manga cover (idempotent; skips fresh + in-flight covers).
 *
 * @param mangaId - The manga whose cover to layerize.
 * @param force - Re-run even if the stored hash + version are current.
 * @returns The attempt outcome.
 */
export async function layerizeCover(mangaId: number, force = false): Promise<LayerizeResult> {
  if (inFlight.has(mangaId)) {
    return { mangaId, status: 'skipped', reason: 'in-flight' };
  }
  inFlight.add(mangaId);
  try {
    const coverPath = await findCoverFile(mangaId);
    if (coverPath === null) {
      return { mangaId, status: 'skipped', reason: 'no-cover' };
    }

    const sourceHash = `sha256:${createHash('sha256').update(await fs.readFile(coverPath)).digest('hex')}`;
    const existing = await prisma.coverLayerSet.findUnique({ where: { mangaId } });
    if (
      !force &&
      existing?.status === 'ready' &&
      existing.sourceHash === sourceHash &&
      existing.version === COVER_LAYER_PIPELINE_VERSION
    ) {
      return { mangaId, status: 'skipped', reason: 'fresh' };
    }

    if (!(await modelsPresent())) {
      const error = `Cover-layer models missing in ${modelsDir()} (run ml/cover-layers/download_models.py)`;
      logger.warn(error, { mangaId });
      await upsert(mangaId, sourceHash, { status: 'failed', error });
      return { mangaId, status: 'failed', error };
    }

    await upsert(mangaId, sourceHash, { status: 'pending', error: null });

    const outDir = path.join(cacheBaseDir(), 'cover-layers', String(mangaId));
    await fs.mkdir(outDir, { recursive: true });
    const { code, stderr } = await runSidecar(coverPath, mangaId, outDir);

    if (code !== 0) {
      const error = stderr.slice(-500) || `sidecar exited ${code}`;
      logger.error('Cover layerize failed', { mangaId, code, error });
      await upsert(mangaId, sourceHash, { status: 'failed', error });
      return { mangaId, status: 'failed', error };
    }

    const manifest = await readManifest(outDir);
    if (manifest === null) {
      const error = 'sidecar produced no manifest';
      await upsert(mangaId, sourceHash, { status: 'failed', error });
      return { mangaId, status: 'failed', error };
    }

    await upsert(mangaId, sourceHash, {
      status: 'ready',
      mode: manifest.mode,
      fgCoverage: manifest.fgCoverage,
      manifestJson: manifest.raw as object,
      error: null,
    });
    logger.info('Cover layerized', { mangaId, mode: manifest.mode, fgCoverage: manifest.fgCoverage });
    return { mangaId, status: manifest.mode === 'layered' ? 'layered' : 'flat' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Cover layerize threw', { mangaId, error });
    return { mangaId, status: 'failed', error };
  } finally {
    inFlight.delete(mangaId);
  }
}

interface UpsertData {
  status: string;
  mode?: string;
  fgCoverage?: number | null;
  manifestJson?: object;
  error?: string | null;
}

async function upsert(mangaId: number, sourceHash: string, data: UpsertData): Promise<void> {
  await prisma.coverLayerSet.upsert({
    where: { mangaId },
    create: { mangaId, sourceHash, version: COVER_LAYER_PIPELINE_VERSION, ...data },
    update: { sourceHash, version: COVER_LAYER_PIPELINE_VERSION, ...data },
  });
}

/**
 * Fire-and-forget trigger: layerize a cover in the background without blocking
 * the caller (used right after a cover is set/imported). No-ops when the global
 * Living Covers setting is off. Errors are swallowed (already logged) so they
 * never break the import flow.
 *
 * @param mangaId - The manga to layerize.
 */
export function triggerLayerize(mangaId: number): void {
  void (async (): Promise<void> => {
    if (!(await isLivingCoversEnabled())) {
      return;
    }
    await layerizeCover(mangaId);
  })().catch((err: unknown) => {
    logger.warn('triggerLayerize failed', { mangaId, error: err instanceof Error ? err.message : String(err) });
  });
}
