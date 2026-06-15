/**
 * Disk-verification companion to volume-archive-coverage (pure). Confirms that a
 * volume-file row's archive actually exists on disk before it's trusted to cover
 * its volume's chapters — guarding against stale/phantom archive rows (e.g. one
 * pointing at an empty scaffold folder, or a file deleted out from under us).
 * Mirrors the fs.access guard in pack-import's linkVolumeChapters.
 */
import { access } from 'node:fs/promises';

import type { CoverageRow } from './volume-archive-coverage';

/** Distinct archive (NULL-chapterNumber, COMPLETED) filePaths that exist on disk. */
async function existingArchivePaths(rows: CoverageRow[]): Promise<Set<string>> {
  const paths = [...new Set(
    rows
      .filter(r => r.chapterNumber === null && r.downloadStatus === 'COMPLETED' && r.filePath)
      .map(r => r.filePath as string),
  )];
  const present = new Set<string>();
  await Promise.all(paths.map(async (p) => {
    try { await access(p); present.add(p); } catch { /* missing — not real coverage */ }
  }));
  return present;
}

/**
 * Return a copy of `rows` with the filePath cleared on any archive row whose file
 * is not on disk, so downstream coverage logic treats that volume as
 * non-file-backed (won't mark chapters COMPLETED, won't block their download).
 */
export async function nullifyMissingArchives(rows: CoverageRow[]): Promise<CoverageRow[]> {
  const present = await existingArchivePaths(rows);
  return rows.map(r =>
    (r.chapterNumber === null && r.filePath && !present.has(r.filePath))
      ? { ...r, filePath: null }
      : r);
}
