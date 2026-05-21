/**
 * Archive content peek
 *
 * Read-only inspection of a CBZ / CBR / ZIP / RAR / 7Z archive's
 * inner file listing without extracting. Wraps `lsar` (libarchive's
 * lister, already used by `services/download/fileImporter/page-counter`).
 *
 * Used by iter-IJ to detect "webtoon shipped as a single archive of
 * inner archives" — Lookism class. When the construct is `webtoon`
 * and pack-import receives ONE archive at the root, we peek to see
 * if its contents are themselves chapter archives. If yes, each
 * inner archive becomes a chapter; if it's just numbered images, the
 * outer is treated as a single chapter (current default).
 */

import { spawn } from 'child_process';
import path from 'path';

const INNER_ARCHIVE_EXTS = new Set(['.cbz', '.cbr', '.zip', '.rar', '.7z', '.cb7']);
const INNER_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif']);

export interface ArchivePeekResult {
  /** Inner files (just the leaf names, no path prefix). */
  innerFiles: string[];
  /** Count of inner entries that are themselves manga archives. */
  archiveCount: number;
  /** Count of inner entries that look like raster images. */
  imageCount: number;
  /** True when lsar succeeded and produced ≥1 inner entry. */
  ok: boolean;
}

/**
 * Spawn `lsar <archive>` and parse its plain-text listing. Mirrors
 * the strategy in `page-counter.ts:countPagesViaLsar` — first line is
 * the archive descriptor ("<path>: Zip"), subsequent lines are
 * inner file paths (forward-slashed, possibly nested).
 */
export async function peekArchiveContents(archivePath: string): Promise<ArchivePeekResult> {
  const empty: ArchivePeekResult = { innerFiles: [], archiveCount: 0, imageCount: 0, ok: false };
  return new Promise((resolve) => {
    const proc = spawn('lsar', [archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('error', () => resolve(empty));
    proc.on('close', (code) => {
      if (code !== 0) { resolve(empty); return; }
      const text = Buffer.concat(chunks).toString('utf-8');
      const lines = text.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
      const innerFiles: string[] = [];
      let archiveCount = 0;
      let imageCount = 0;
      for (const line of lines) {
        // Skip directory marker entries (lsar lists "sub/" for nested
        // packs). Without this they inflate `innerFiles.length` and
        // pull `archiveCount/total` below the 80% classification floor.
        if (line.endsWith('/')) continue;
        // Inner paths may be nested ("subdir/Lookism 001.cbz"); we
        // only care about the leaf name for chapter classification.
        const leaf = path.basename(line);
        innerFiles.push(leaf);
        const ext = path.extname(leaf).toLowerCase();
        if (INNER_ARCHIVE_EXTS.has(ext)) archiveCount++;
        else if (INNER_IMAGE_EXTS.has(ext)) imageCount++;
      }
      resolve({ innerFiles, archiveCount, imageCount, ok: innerFiles.length > 0 });
    });
  });
}

/**
 * Classify what an archive peek reveals. Three shapes today:
 *   - `chapter-archives` — ≥80% of entries are inner archives
 *     (Lookism class: outer pack of per-chapter cbzs)
 *   - `image-pack`        — ≥80% are raster images
 *     (single-chapter pack with pages inside)
 *   - `mixed`             — neither dominates; out of scope for
 *     auto-expansion until a clear pattern emerges
 *
 * Returns null when the peek failed (file unreadable, lsar absent,
 * archive corrupt) — callers should preserve current single-chapter
 * default behavior in that case.
 */
export function classifyArchiveContents(
  peek: ArchivePeekResult,
): 'chapter-archives' | 'image-pack' | 'mixed' | null {
  if (!peek.ok || peek.innerFiles.length === 0) return null;
  const total = peek.innerFiles.length;
  if (peek.archiveCount / total >= 0.8) return 'chapter-archives';
  if (peek.imageCount / total >= 0.8) return 'image-pack';
  return 'mixed';
}
