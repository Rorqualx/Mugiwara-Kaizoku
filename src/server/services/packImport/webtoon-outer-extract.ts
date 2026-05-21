/**
 * iter-IJ2 / iter-IJ3: extract outer-of-inner webtoon archives.
 *
 * When library-scanner detects the chapter-archives shape (one outer
 * archive containing N inner per-chapter archives — Lookism class),
 * this module performs the actual extraction so the per-chapter rows
 * can be linked to real on-disk files.
 *
 * Outer format support:
 *
 *   - iter-IJ2: `.cbz` / `.zip` via JSZip (pure JS, no binary needed).
 *   - iter-IJ3: `.rar` / `.cbr` / `.7z` / `.cb7` via `unar`
 *     (libarchive-based; already required for iter-16 multi-part RAR
 *     extraction). When `unar` is missing the call returns ok:false
 *     with a clear error and the scanner falls back to the single-
 *     chapter interpretation.
 *
 * Design choices:
 *
 *   - Output dir is a SIBLING of the outer archive, named after the
 *     archive without its extension + `-extracted` suffix:
 *       /lib/manga/Volumes/Lookism-pack.cbz
 *       /lib/manga/Volumes/Lookism-pack-extracted/Lookism 001.cbz
 *
 *   - Outer archive is PRESERVED. The user (or a later iter) can
 *     delete it after verifying the extraction.
 *
 *   - Idempotent: if the target dir already exists with inner
 *     archives, return its current contents without re-extracting.
 *
 *   - Best-effort: a mid-extraction failure leaves the partial
 *     extraction dir on disk for inspection but returns ok:false so
 *     callers can fall back to the single-chapter interpretation.
 *
 *   - For unar-extracted dirs we flatten one wrapper-dir level
 *     (unar's `-D` flag handles this) but additionally scan one level
 *     deep in case unar left a "Pack/inner.cbz" nesting.
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

import { logger } from '@/utils/logger';

import { peekArchiveContents, classifyArchiveContents } from './archive-peek';

const execFileAsync = promisify(execFile);

const EXTRACT_SUFFIX = '-extracted';
const ZIP_OUTER_EXTS = new Set(['.cbz', '.zip']);
const UNAR_OUTER_EXTS = new Set(['.rar', '.cbr', '.7z', '.cb7']);
const SUPPORTED_OUTER_EXTS = new Set([...ZIP_OUTER_EXTS, ...UNAR_OUTER_EXTS]);
const INNER_ARCHIVE_EXTS = new Set(['.cbz', '.cbr', '.zip', '.rar', '.7z', '.cb7']);

export interface ExtractResult {
  ok: boolean;
  outputDir: string;
  innerFiles: string[];
  /** Set when ok=false; preserves partial-extract dir on disk. */
  error?: string;
  /** True when the target dir already existed and we reused it. */
  reused: boolean;
}

/**
 * Compute the sibling extraction dir for an outer archive path.
 * `/lib/manga/Volumes/Lookism-pack.cbz` →
 * `/lib/manga/Volumes/Lookism-pack-extracted/`
 */
export function deriveExtractDir(outerPath: string): string {
  const parsed = path.parse(outerPath);
  return path.join(parsed.dir, `${parsed.name}${EXTRACT_SUFFIX}`);
}

function filterInnerArchives(entries: { name: string; isFile: () => boolean }[], dir: string): string[] {
  return entries
    .filter(e => e.isFile() && INNER_ARCHIVE_EXTS.has(path.extname(e.name).toLowerCase()))
    .map(e => path.join(dir, e.name));
}

async function listInnerArchives(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const flat = filterInnerArchives(entries, dir);
    if (flat.length > 0) return flat;
    // unar may leave a single wrapper dir even with -D (when the
    // archive itself was a "Pack/inner.cbz" nesting). Scan one level
    // into single subdirs as a fallback so we still find inner files.
    const subdirs = entries.filter(e => e.isDirectory());
    for (const sub of subdirs) {
      const subPath = path.join(dir, sub.name);
      // eslint-disable-next-line no-await-in-loop -- bounded by entry count
      const subEntries = await fs.readdir(subPath, { withFileTypes: true });
      flat.push(...filterInnerArchives(subEntries, subPath));
    }
    return flat;
  } catch {
    return [];
  }
}

/** Whether `unar` is available on PATH. Cached after the first probe. */
let unarAvailable: boolean | null = null;
async function isUnarAvailable(): Promise<boolean> {
  if (unarAvailable !== null) return unarAvailable;
  try {
    await execFileAsync('unar', ['-v']);
    unarAvailable = true;
  } catch {
    unarAvailable = false;
  }
  return unarAvailable;
}

/**
 * Extract a .rar / .cbr / .7z / .cb7 outer via `unar`. The same binary
 * the multi-part RAR detector uses (iter-16). Flags:
 *   -f               overwrite existing files
 *   -D               do not create a top-level wrapper directory
 *   -o <output-dir>  extraction destination
 *
 * Returns the list of inner archive paths post-extraction or null on
 * any failure (caller treats null as "extraction failed, fall back").
 */
async function extractViaUnar(outerPath: string, outputDir: string): Promise<string[] | null> {
  const ok = await isUnarAvailable();
  if (!ok) {
    logger.warn(`[WebtoonExtract] unar not available — cannot extract ${outerPath}`);
    return null;
  }
  try {
    await fs.mkdir(outputDir, { recursive: true });
    await execFileAsync('unar', ['-f', '-D', '-o', outputDir, outerPath]);
    return await listInnerArchives(outputDir);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[WebtoonExtract] unar failed on ${outerPath}: ${msg}`);
    return null;
  }
}

/**
 * Extract a verified outer-of-inner webtoon archive. Validates the
 * shape with `peekArchiveContents` + `classifyArchiveContents` first
 * — refuses to extract if the outer is image-pack or mixed. Returns
 * the inner file paths post-extraction.
 *
 * RAR / 7Z outers are not handled by this iter (returns ok:false).
 */
export async function extractWebtoonOuterArchive(outerPath: string): Promise<ExtractResult> {
  const outputDir = deriveExtractDir(outerPath);

  const ext = path.extname(outerPath).toLowerCase();
  if (!SUPPORTED_OUTER_EXTS.has(ext)) {
    return { ok: false, outputDir, innerFiles: [], reused: false, error: `unsupported outer format ${ext}` };
  }

  const peek = await peekArchiveContents(outerPath);
  const shape = classifyArchiveContents(peek);
  if (shape !== 'chapter-archives') {
    return { ok: false, outputDir, innerFiles: [], reused: false, error: `wrong shape: ${shape}` };
  }

  // Idempotency: if target dir already exists with inner archives, reuse.
  try {
    const existing = await listInnerArchives(outputDir);
    if (existing.length > 0) {
      logger.info(`[WebtoonExtract] Reusing existing ${outputDir} (${existing.length} inner archives)`);
      return { ok: true, outputDir, innerFiles: existing, reused: true };
    }
  } catch {
    // fall through — dir doesn't exist, proceed with extraction
  }

  try {
    if (ZIP_OUTER_EXTS.has(ext)) {
      const innerFiles = await extractViaJsZip(outerPath, outputDir);
      if (innerFiles.length === 0) {
        return { ok: false, outputDir, innerFiles: [], reused: false, error: 'no inner archives extracted' };
      }
      logger.info(`[WebtoonExtract] Extracted ${innerFiles.length} inner archives from ${outerPath} → ${outputDir}`);
      return { ok: true, outputDir, innerFiles, reused: false };
    }
    // iter-IJ3 — unar path for .rar / .cbr / .7z / .cb7
    const innerFiles = await extractViaUnar(outerPath, outputDir);
    if (innerFiles === null) {
      return { ok: false, outputDir, innerFiles: [], reused: false, error: 'unar extraction failed or unavailable' };
    }
    if (innerFiles.length === 0) {
      return { ok: false, outputDir, innerFiles: [], reused: false, error: 'no inner archives extracted' };
    }
    logger.info(`[WebtoonExtract] Extracted ${innerFiles.length} inner archives from ${outerPath} → ${outputDir} (via unar)`);
    return { ok: true, outputDir, innerFiles, reused: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[WebtoonExtract] Extraction failed for ${outerPath}: ${msg}`);
    return { ok: false, outputDir, innerFiles: [], reused: false, error: msg };
  }
}

/**
 * JSZip extraction path for .cbz / .zip outers. Reads outer fully into
 * memory, writes each inner archive entry to outputDir as a flat list.
 */
async function extractViaJsZip(outerPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const buffer = await fs.readFile(outerPath);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const innerFiles: string[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // Strip nested directory prefix — keep only the leaf name so the
    // output dir is flat regardless of how the outer was packed.
    const leaf = path.basename(name);
    if (!INNER_ARCHIVE_EXTS.has(path.extname(leaf).toLowerCase())) continue;
    const targetPath = path.join(outputDir, leaf);
    // eslint-disable-next-line no-await-in-loop -- sequential writes intentional (avoid concurrent fs write spike)
    const data = await entry.async('nodebuffer');
    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(targetPath, data);
    innerFiles.push(targetPath);
  }
  return innerFiles;
}
