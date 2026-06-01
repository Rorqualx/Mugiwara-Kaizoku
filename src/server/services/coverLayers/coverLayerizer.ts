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

/** Bump to re-layerize. v2: tuned drift. v3: text + depth bands. v4: near-item sprites.
 *  v5: grounded-sam falls back to depth bands (not a flat plate) when no objects. */
export const COVER_LAYER_PIPELINE_VERSION = 5;

/** Config key for the global Living Covers master switch (default off). */
export const LIVING_COVERS_ENABLED_KEY = 'covers.living.enabled';

/** Config key for the segmenter / quality tier (default `standard`). */
export const LIVING_COVERS_SEGMENTER_KEY = 'covers.living.segmenter';

/**
 * Segmenter tiers. `standard` = depth bands; `sam` = MobileSAM object masks
 * (Option A); `grounded-sam` = open-vocabulary labeled objects (Option C). C
 * needs PyTorch + the GroundingDINO weights; it uses a GPU when present (Metal
 * on Apple Silicon, CUDA elsewhere) and falls back to CPU (slower). When torch
 * or the weights are absent it degrades to `sam`.
 */
export type CoverSegmenter = 'standard' | 'sam' | 'grounded-sam';

const MODEL_DOWNLOAD_TIMEOUT_MS = 600_000;
const PROBE_TIMEOUT_MS = 30_000;
const GROUNDED_PROBE_TTL_MS = 60_000;

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

/** Reads the configured segmenter tier (default `standard`). */
export async function coverSegmenter(): Promise<CoverSegmenter> {
  const value = await configService.get<unknown>(LIVING_COVERS_SEGMENTER_KEY, 'standard');
  if (value === 'sam') {
    return 'sam';
  }
  if (value === 'grounded-sam') {
    return 'grounded-sam';
  }
  return 'standard';
}

interface GroundedProbe {
  torch: boolean;
  cuda: boolean;
  dino: boolean;
}

let groundedProbeCache: { value: boolean; at: number } | null = null;

/** Builds the command to run the sidecar's `--probe` capability check. */
function probeCommand(): { cmd: string; args: string[] } {
  const runner = process.env['COVER_LAYER_PYTHON'] ?? 'uv';
  const scriptArgs = ['--probe', '--models-dir', modelsDir()];
  if (runner === 'uv') {
    // Same dep set as the grounded run, so once provisioned the cache is warm
    // and the probe imports torch instantly (well under PROBE_TIMEOUT_MS).
    return {
      cmd: 'uv',
      args: ['run', '--python', '3.11', ...uvWithArgs(true), 'python', scriptPath(), ...scriptArgs],
    };
  }
  return { cmd: runner, args: [scriptPath(), ...scriptArgs] };
}

/**
 * True once grounded-sam has been provisioned — i.e. the GroundingDINO weights
 * are present. `provision-grounded-sam.sh` fetches them (and warms the torch uv
 * cache), so their presence is our cheap "don't spawn a doomed 2 GB install"
 * gate on the uv/dev path.
 */
async function groundedProvisioned(): Promise<boolean> {
  try {
    await fs.access(path.join(modelsDir(), 'grounding-dino-tiny', 'config.json'));
    return true;
  } catch {
    return false;
  }
}

/** Parses the sidecar `--probe` JSON; true only when torch + the DINO weights are present. */
function parseProbeOutput(stdout: string): boolean {
  try {
    const match = /\{[^{}]*\}/.exec(stdout);
    if (match === null) {
      return false;
    }
    const probe = JSON.parse(match[0]) as Partial<GroundedProbe>;
    return probe.torch === true && probe.dino === true;
  } catch {
    return false;
  }
}

/** Spawns the sidecar `--probe` and resolves whether grounded-sam can actually run. */
function runProbe(): Promise<boolean> {
  const { cmd, args } = probeCommand();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: process.cwd() });
    let stdout = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), PROBE_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(parseProbeOutput(stdout));
    });
  });
}

/**
 * Whether the `grounded-sam` tier can run here (torch + GroundingDINO weights
 * present). Cached briefly — the answer only changes when the host is
 * reconfigured. Returns false fast on the standard CPU container.
 */
export async function groundedSamAvailable(): Promise<boolean> {
  const now = Date.now();
  if (groundedProbeCache !== null && now - groundedProbeCache.at < GROUNDED_PROBE_TTL_MS) {
    return groundedProbeCache.value;
  }
  // On the uv/dev path, don't run the (install-triggering) probe until the
  // weights exist — otherwise an un-provisioned box spawns a doomed 2 GB pull
  // every cache window. An explicit COVER_LAYER_PYTHON is assumed pre-provisioned.
  const needsProvisionGate = process.env['COVER_LAYER_PYTHON'] === undefined;
  const value = needsProvisionGate && !(await groundedProvisioned()) ? false : await runProbe();
  groundedProbeCache = { value, at: now };
  return value;
}

/** Config key for the "smart effects" (tag-driven motion) toggle (default off). */
export const LIVING_COVERS_SMART_EFFECTS_KEY = 'covers.living.smartEffects';

/** Reads the smart-effects (WD14 mood-motion) toggle. */
export async function smartEffectsEnabled(): Promise<boolean> {
  const value = await configService.get<unknown>(LIVING_COVERS_SMART_EFFECTS_KEY, false);
  return value === true || value === 'true';
}

/** Config key for the global cover-motion speed multiplier (render-time, default 1.0). */
export const LIVING_COVERS_MOTION_SPEED_KEY = 'covers.living.motionSpeed';

const MOTION_SPEED_MIN = 0.3;
const MOTION_SPEED_MAX = 2.0;

/** Reads the global motion-speed multiplier (clamped 0.3–2.0; applied at render time). */
export async function coverMotionSpeed(): Promise<number> {
  const value = await configService.get<unknown>(LIVING_COVERS_MOTION_SPEED_KEY, 1);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(MOTION_SPEED_MAX, Math.max(MOTION_SPEED_MIN, n));
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

/** Live snapshot of an in-progress model download. */
export interface ModelDownloadProgress {
  active: boolean;
  fileIndex: number;
  fileCount: number;
  fileName: string;
  overallPct: number;
}

let modelDownloadInFlight = false;
let downloadProgress: ModelDownloadProgress = { active: false, fileIndex: 0, fileCount: 0, fileName: '', overallPct: 0 };

/** Whether a model download is currently running. */
export function isDownloadingModels(): boolean {
  return modelDownloadInFlight;
}

/** Snapshot of the current (or last) model-download progress. */
export function modelDownloadProgress(): ModelDownloadProgress {
  return { ...downloadProgress };
}

/** Parses a `PROGRESS|idx|count|name|pct` line into an overall-percentage snapshot. */
function applyProgressLine(line: string): void {
  const m = /^PROGRESS\|(\d+)\|(\d+)\|([^|]*)\|(\d+)$/.exec(line.trim());
  if (m === null) {
    return;
  }
  const idx = Number(m[1]);
  const count = Number(m[2]);
  const pct = Number(m[4]);
  const overallPct = count > 0 ? Math.round(((idx - 1 + pct / 100) / count) * 100) : 0;
  downloadProgress = { active: true, fileIndex: idx, fileCount: count, fileName: m[3] ?? '', overallPct };
}

/**
 * Downloads the ONNX models into the models dir (idempotent — skips present
 * files). No-ops while a download is already in flight. Streams per-file
 * progress into {@link modelDownloadProgress}.
 */
export function downloadCoverModels(): Promise<{ ok: boolean; error?: string }> {
  if (modelDownloadInFlight) {
    return Promise.resolve({ ok: false, error: 'already downloading' });
  }
  modelDownloadInFlight = true;
  downloadProgress = { active: true, fileIndex: 0, fileCount: 0, fileName: '', overallPct: 0 };
  const { cmd, args } = modelDownloadCommand();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: process.cwd() });
    let stderr = '';
    let stdoutBuf = '';
    const finish = (result: { ok: boolean; error?: string }): void => {
      clearTimeout(timer);
      modelDownloadInFlight = false;
      downloadProgress = { ...downloadProgress, active: false, overallPct: result.ok ? 100 : downloadProgress.overallPct };
      resolve(result);
    };
    const timer = setTimeout(() => child.kill('SIGKILL'), MODEL_DOWNLOAD_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => {
      stdoutBuf += d.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        applyProgressLine(line);
      }
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => finish({ ok: false, error: err.message }));
    child.on('close', (code) =>
      finish(code === 0 ? { ok: true } : { ok: false, error: stderr.slice(-500) || `downloader exited ${code}` }),
    );
  });
}

/** Base uv deps (ONNX pipeline). Grounded-sam adds torch for GroundingDINO. */
const BASE_UV_DEPS = ['onnxruntime', 'numpy', 'pillow'] as const;
// Grounded-sam pins (validated on M4): transformers bumped its torch floor to 2.4
// in 4.46, but the last x86_64-macOS torch wheel is 2.2.2 — so cap transformers so
// GroundingDINO stays enabled; numpy<2 matches torch's build ABI. Passed to spawn()
// directly (not a shell), so the `<` is a literal version specifier, not a redirect.
const GROUNDED_UV_DEPS = ['onnxruntime', 'numpy<2', 'pillow', 'torch', 'transformers<4.46', 'huggingface_hub'] as const;

/** `--with <dep>` args for the uv runner; the grounded set self-provisions torch (cached). */
function uvWithArgs(grounded: boolean): string[] {
  return (grounded ? GROUNDED_UV_DEPS : BASE_UV_DEPS).flatMap((d) => ['--with', d]);
}

/** Builds the command + args to run the sidecar (uv by default for dev). */
function sidecarCommand(coverPath: string, mangaId: number, outDir: string, segmenter: CoverSegmenter, smartEffects: boolean): { cmd: string; args: string[] } {
  const runner = process.env['COVER_LAYER_PYTHON'] ?? 'uv';
  const device = process.env['COVER_LAYER_DEVICE'] ?? 'cpu';
  const scriptArgs = ['--cover', coverPath, '--id', String(mangaId), '--out', outDir, '--models-dir', modelsDir(), '--device', device, '--segmenter', segmenter];
  if (smartEffects) {
    scriptArgs.push('--smart-effects');
  }
  if (runner === 'uv') {
    return {
      cmd: 'uv',
      args: ['run', '--python', '3.11', ...uvWithArgs(segmenter === 'grounded-sam'), 'python', scriptPath(), ...scriptArgs],
    };
  }
  // Otherwise treat COVER_LAYER_PYTHON as a python interpreter with deps installed.
  return { cmd: runner, args: [scriptPath(), ...scriptArgs] };
}

function runSidecar(coverPath: string, mangaId: number, outDir: string, segmenter: CoverSegmenter, smartEffects: boolean): Promise<{ code: number; stderr: string }> {
  const { cmd, args } = sidecarCommand(coverPath, mangaId, outDir, segmenter, smartEffects);
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

interface ExistingLayerSet {
  status: string;
  sourceHash: string;
  version: number;
  manifestJson: unknown;
}

/** Whether a stored set is current for the given cover hash + recipe (segmenter + smart effects). */
function isFresh(existing: ExistingLayerSet | null, sourceHash: string, segmenter: CoverSegmenter, smartEffects: boolean): boolean {
  if (existing?.status !== 'ready') {
    return false;
  }
  if (existing.sourceHash !== sourceHash || existing.version !== COVER_LAYER_PIPELINE_VERSION) {
    return false;
  }
  const prev = existing.manifestJson as { segmenter?: unknown; smartEffects?: unknown; segmenterFallback?: unknown } | null;
  // A degraded run (e.g. grounded-sam off a GPU-less box) is never fresh, so it
  // re-runs and produces the real output once the host gains torch + weights.
  const fallback = prev?.segmenterFallback;
  if (fallback !== undefined && fallback !== null) {
    return false;
  }
  return (prev?.segmenter ?? 'standard') === segmenter && (prev?.smartEffects === true) === smartEffects;
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
    const segmenter = await coverSegmenter();
    const smartEffects = await smartEffectsEnabled();
    const existing = await prisma.coverLayerSet.findUnique({ where: { mangaId } });
    if (!force && isFresh(existing, sourceHash, segmenter, smartEffects)) {
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
    const { code, stderr } = await runSidecar(coverPath, mangaId, outDir, segmenter, smartEffects);

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
