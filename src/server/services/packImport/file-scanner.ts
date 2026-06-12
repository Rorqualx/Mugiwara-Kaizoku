/**
 * Pack Import File Scanner
 *
 * Scans directories for manga archive files and parses volume/chapter numbers
 * from filenames. Extracted from packImportService.ts to keep under 500 lines.
 */

import fs from 'fs/promises';
import path from 'path';

import { parseChapterToken, parseVolumeToken } from '@/server/parsers/chapter-number-extractor';
import { logger } from '@/utils/logger';

import { peekArchiveContents, classifyArchiveContents } from './archive-peek';
import { extractWebtoonOuterArchive } from './webtoon-outer-extract';

import type { Construct } from './construct-type';

const VALID_EXTS = new Set(['.cbz', '.cbr', '.zip', '.rar', '.7z', '.cb7', '.pdf', '.epub']);
const RECURSIVE_PEEK_EXTS = new Set(['.cbz', '.cbr', '.zip', '.rar', '.7z', '.cb7']);

export interface ScannedFile {
  fileName: string;
  filePath: string;
  size: number;
  volumeNumber: number | null;
  chapterNumber: number | null;
  isValidChapter: boolean;
}

/**
 * Strip parenthesized/bracketed metadata from a filename.
 * Removes patterns like (2024), (Digital), [Group], [dig] that confuse number extraction.
 */
function stripMetadata(name: string): string {
  return name.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

/**
 * Extract volume and chapter numbers from a file name.
 *
 * Priority:
 * 1. Explicit volume marker: "vol 01", "v01", "Volume 1"
 * 2. Explicit chapter marker: "ch 01", "chapter 1", "c001"
 * 3. Dash-separated number: "Title - 042" → treated as chapter
 * 4. Bare trailing number ("Akira 01") → treated as volume
 */
// eslint-disable-next-line complexity -- ordered filename-heuristic cascade (vol/ch/range/dash/paren/bare); each branch is documented against its iter and protected by the 36-pattern corpus — splitting would obscure precedence
export function parseChapterFileName(
  name: string, ext: string, construct?: Construct,
): { volumeNumber: number | null; chapterNumber: number | null } {
  const nameWithoutExt = path.basename(name, ext);

  // iter-IG: also matches French `Tome N` and `Tomes N` alongside the
  // English `v`/`vol`/`volume` prefixes. Examples: "Manga Tome 1.cbz",
  // "Series Tome 36.cbz".
  const volMatch = nameWithoutExt.match(/(?:v(?:ol(?:ume)?\.?\s*)?|\btomes?\s+)(\d+)/i);
  // iter-IE-range: detect volume RANGES like "Vol.1-3" or "v01-v20" so
  // the dash-separated chapter heuristic below doesn't misinterpret the
  // trailing number as a chapter. When this fires, dashNumMatch is
  // suppressed and the captured leading number becomes the volume.
  const volRangeMatch = nameWithoutExt.match(/v(?:ol(?:ume)?\.?\s*)?\d+\s*[-~]\s*(?:v(?:ol(?:ume)?\.?\s*)?)?\d+/i);
  // iter-IB: chapter regex now accepts an optional `.\d+` trailer so
  // bonus / half chapters like `c042.5` or `Chapter 100.5` parse as
  // 42.5 / 100.5 (Chapter.chapterNumber is a double in the schema).
  // iter-IK: also matches webtoon/manhwa Episode markers (`EP 42`,
  // `Episode 42`, `Ep.42`, `EP42`) and Season+Episode markers
  // (`S01E042`, `s1e42`) — both emit chapter, never volume. The
  // word-boundary `\b` before `ep` keeps `Step`/`Sleep`/`Help` from
  // matching. seasonEp first so `S01E042` resolves via the
  // explicit S-E pair instead of the more permissive `Ep` form.
  // iter-IO1: chapter RANGE pattern (`c1-838`, `c1-c100`, `c001-200`)
  // is tried first — leading chapter wins, mirroring volRangeMatch.
  // Without this, `c1-838` fell through to dashNumMatch which grabbed
  // 838 (range end); `c1-c100` matched the strict `\bc(\d{3,4})\b`
  // against the 3-digit trailing `c100` instead of the 1-digit
  // leading `c1`. Both now resolve to 1.
  const chMatch = nameWithoutExt.match(/\bc(\d+(?:\.\d+)?)\s*-\s*c?\d+/i)
    ?? nameWithoutExt.match(/\bs\d{1,2}\s*e\s*(\d+(?:\.\d+)?)\b/i)
    ?? nameWithoutExt.match(/\bep(?:isode)?\.?\s*(\d+(?:\.\d+)?)/i)
    ?? nameWithoutExt.match(/ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i)
    ?? nameWithoutExt.match(/\bc(\d{3,4}(?:\.\d+)?)\b/i);

  // For bare number detection, strip metadata like (2024), (Digital), [Group]
  // so "Manga - 042 (2024) (Digital).cbz" becomes "Manga - 042"
  const cleaned = stripMetadata(nameWithoutExt);

  // Match dash-separated number: "Title - 042" or "Title -042".
  // Suppressed when chMatch (explicit chapter marker dominates) or
  // volRangeMatch (the dash is part of a volume range, not a chapter).
  const dashNumMatch = !chMatch && !volRangeMatch
    ? cleaned.match(/[-–—]\s*(\d{1,4}(?:\.\d+)?)\s*$/)
    : null;

  // Match trailing parenthesized number on the RAW name (before metadata strip).
  // "Berserk (1).pdf", "Title (Digital) (5).cbz" — common volume naming where the
  // only volume signal is a plain number in parens. Capped at 3 digits so 4-digit
  // years like "(2024)" don't get mistaken for volumes.
  const parenNumMatch = !volMatch && !chMatch && !dashNumMatch
    ? nameWithoutExt.match(/\((\d{1,3})\)\s*$/)
    : null;

  // Match bare trailing number: "Akira 01" or "Lookism 001" (only if no
  // vol/ch/dash/paren match). The captured digit-portion (before any
  // decimal) tells us the convention: 3+ digit padded number = chapter
  // (webtoon style); 1-2 digit = volume (tankobon style). Decimal trailer
  // is accepted for half-chapter releases like "Manga 100.5.cbz".
  const bareNumMatch = !volMatch && !chMatch && !dashNumMatch && !parenNumMatch
    ? cleaned.match(/(?:^|\D)(\d{1,4}(?:\.\d+)?)\s*$/)
    : null;
  // Chapter-classification uses the integer-portion length so 1-2 digit
  // bare numbers (volume convention) aren't shifted by an optional decimal.
  // iter-IL: manhua construct DROPS the 3-digit threshold — modern CN
  // manhua (Battle Through the Heavens, Tales of Demons, Apotheosis)
  // ships chapter-only with bare 1-2 digit names like `Manhua 12.cbz`.
  // Explicit vol-prefix (Soul Land Vol 12.cbz) still wins via volMatch,
  // so traditional print manhua remain correctly classified. All other
  // constructs (manga / manhwa / webtoon / unknown) preserve the
  // pre-iter-IL 3-digit threshold exactly.
  const bareIntPart = bareNumMatch?.[1]?.split('.')[0] ?? '';
  const bareIsChapter = construct === 'manhua'
    ? bareIntPart.length >= 1
    : bareIntPart.length >= 3;

  // Dash-separated and ch-prefixed numbers are chapters. parseChapterToken
  // preserves the decimal (parseInt would truncate "42.5" to 42) and
  // rejects implausible tokens centrally.
  const chapterNumber = chMatch?.[1] ? parseChapterToken(chMatch[1])
    : dashNumMatch?.[1] ? parseChapterToken(dashNumMatch[1])
    : (bareIsChapter && bareNumMatch?.[1]) ? parseChapterToken(bareNumMatch[1])
    : null;

  // Volumes remain integers — half-volumes don't exist as a release
  // convention. iter-ID dual-marker rule: when an explicit chapter
  // marker (chMatch) is present alongside a volume marker, the chapter
  // wins and the volume becomes null. The volume info is signal-only
  // (the chapter range is already specific). Without this rule,
  // "Series v02 Chapter 042.cbz" would populate both fields, confusing
  // the downstream linker into creating a synthetic volume-2 placeholder.
  const volumeNumber = (volMatch?.[1] && !chMatch) ? parseVolumeToken(volMatch[1])
    : parenNumMatch?.[1] ? parseVolumeToken(parenNumMatch[1])
    : (!bareIsChapter && bareNumMatch?.[1]) ? parseVolumeToken(bareNumMatch[1])
    : null;

  return { volumeNumber, chapterNumber };
}

/**
 * Scan a directory recursively for manga archive files.
 *
 * Optional `construct` hint is threaded into parseChapterFileName so
 * construct-aware classification (iter-IL manhua bare-digit chapters)
 * works without each caller needing to post-process. When omitted, the
 * parser uses its legacy 3-digit-bare-is-chapter threshold for all
 * files — preserves pre-iter-IL behavior exactly.
 *
 * iter-IJ detection: when construct=webtoon and the scan produces
 * exactly one archive file, peek inside via lsar. If the archive
 * contains nested chapter-archives (the Lookism class — outer pack
 * of per-chapter CBZs), emit a logger.warn so the operator sees the
 * shape on the next pack-import attempt. Actual auto-expansion of
 * the outer archive into chapter rows (extract-and-re-scan) is
 * deferred to iter-IJ2 once real Lookism data lands.
 */
export async function scanDirectoryForChapterFiles(
  directoryPath: string, construct?: Construct,
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  const scanDir = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { await scanDir(fullPath); continue; } // eslint-disable-line no-await-in-loop
      const ext = path.extname(entry.name).toLowerCase();
      if (!VALID_EXTS.has(ext)) continue;
      const stats = await fs.stat(fullPath); // eslint-disable-line no-await-in-loop
      const parsed = parseChapterFileName(entry.name, ext, construct);
      files.push({
        fileName: entry.name, filePath: fullPath, size: stats.size,
        ...parsed, isValidChapter: parsed.volumeNumber !== null || parsed.chapterNumber !== null
      });
    }
  };

  await scanDir(directoryPath);

  // Loose-image-folder fallback (2026-05-16): if the primary scan found no
  // archive files, the pack may be a directory tree of raw JPEGs — common
  // on Nyaa / Knaben mirrors of completed chapter-range releases. Bundle
  // each qualifying subfolder into a sibling CBZ and feed those back in.
  // Lazy import keeps the cbz-bundler dependency out of the hot path when
  // the primary scan succeeds (which is ~all torrents).
  if (files.length === 0) {
    const { scanLooseImageFolders } = await import('./loose-image-folder-scanner');
    const bundled = await scanLooseImageFolders(directoryPath, construct);
    files.push(...bundled);
  }

  return detectWebtoonOuterOfInner(files, construct);
}

/**
 * iter-IJ + iter-IJ2: when a webtoon-construct manga has its pack
 * delivered as a SINGLE outer archive containing nested per-chapter
 * archives, the scanner originally emitted 1 ScannedFile (the outer)
 * and pack-import then treated it as a single chapter. iter-IJ added
 * detection + warning; iter-IJ2 now also AUTO-EXTRACTS via JSZip,
 * scans the extracted sibling dir for inner archives, and replaces
 * the single outer entry with N per-chapter entries in the result
 * array. The outer archive is preserved on disk as a backup.
 */
async function detectWebtoonOuterOfInner(
  files: ScannedFile[], construct: Construct | undefined,
): Promise<ScannedFile[]> {
  if (construct !== 'webtoon') return files;
  if (files.length !== 1) return files;
  const single = files[0];
  if (!single) return files;
  const ext = path.extname(single.fileName).toLowerCase();
  if (!RECURSIVE_PEEK_EXTS.has(ext)) return files;
  const peek = await peekArchiveContents(single.filePath);
  const shape = classifyArchiveContents(peek);
  if (shape !== 'chapter-archives') return files;

  logger.info(
    `[FileScanner] iter-IJ2: webtoon pack ${single.fileName} has chapter-archives shape ` +
    `(${peek.archiveCount} inner archives) — extracting`,
  );
  const result = await extractWebtoonOuterArchive(single.filePath);
  if (!result.ok || result.innerFiles.length === 0) {
    logger.warn(
      `[FileScanner] iter-IJ2: extraction failed (${result.error ?? 'no inner files'}); ` +
      `falling back to single-chapter interpretation`,
    );
    return files;
  }

  // Replace the outer entry with one ScannedFile per inner archive,
  // parsed via the existing parser (handles webtoon-3digit, etc).
  const innerFiles: ScannedFile[] = [];
  for (const innerPath of result.innerFiles) {
    const innerName = path.basename(innerPath);
    const innerExt = path.extname(innerName).toLowerCase();
    if (!VALID_EXTS.has(innerExt)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential stat fine for bounded inner count
      const stats = await fs.stat(innerPath);
      const parsed = parseChapterFileName(innerName, innerExt, construct);
      innerFiles.push({
        fileName: innerName, filePath: innerPath, size: stats.size,
        ...parsed, isValidChapter: parsed.volumeNumber !== null || parsed.chapterNumber !== null,
      });
    } catch {
      // skip stat-failing inner file
    }
  }
  if (innerFiles.length === 0) {
    logger.warn(`[FileScanner] iter-IJ2: extracted but no valid inner files parsed; keeping outer`);
    return files;
  }
  logger.info(
    `[FileScanner] iter-IJ2: expanded outer ${single.fileName} into ` +
    `${innerFiles.length} inner files (${result.reused ? 'reused-dir' : 'fresh-extract'})`,
  );
  return innerFiles;
}

/** Group scanned files by volume number */
export function groupFilesByVolume(files: ScannedFile[]): Map<number | null, ScannedFile[]> {
  const groups = new Map<number | null, ScannedFile[]>();

  for (const file of files) {
    const key = file.volumeNumber;
    const group = groups.get(key);
    if (group) {
      group.push(file);
    } else {
      groups.set(key, [file]);
    }
  }

  return groups;
}
