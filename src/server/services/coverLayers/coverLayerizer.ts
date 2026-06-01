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
import { logger } from '@/utils/logger';

/** Bump to force every cover to re-layerize on the next pass. */
export const COVER_LAYER_PIPELINE_VERSION = 1;

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

function scriptPath(): string {
  const dir = process.env['COVER_LAYER_SCRIPT_DIR'] ?? path.join(process.cwd(), 'ml/cover-layers');
  return path.join(dir, 'layerize.py');
}

/** Locates the cached cover file for a manga, if any. */
async function findCoverFile(mangaId: number): Promise<string | null> {
  const coverDir = path.join(cacheBaseDir(), 'covers');
  const checks = await Promise.all(
    COVER_EXTENSIONS.map(async (ext): Promise<string | null> => {
      const candidate = path.join(coverDir, `manga-${mangaId}${ext}`);
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

async function modelsPresent(): Promise<boolean> {
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
 * the caller (used right after a cover is set/imported). Errors are swallowed
 * (already logged) so they never break the import flow.
 *
 * @param mangaId - The manga to layerize.
 */
export function triggerLayerize(mangaId: number): void {
  void layerizeCover(mangaId).catch((err: unknown) => {
    logger.warn('triggerLayerize failed', { mangaId, error: err instanceof Error ? err.message : String(err) });
  });
}
