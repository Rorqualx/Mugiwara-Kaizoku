/**
 * Card download-tally — pure, shared by the client card and the server
 * aggregate (manga.query). Honors whole-volume archives the same way the volume
 * detail header does. Extracted from ResponsiveMangaCard so the server can
 * compute the identical tally without shipping every chapter row to the client.
 *
 * @module components/library/utils/card-tally
 */

/** Minimal chapter shape the tally needs. */
export interface CardChapter {
  downloadStatus?: string | null;
  chapterNumber?: number | null;
  volume?: number | null;
  filePath?: string | null;
}

export interface CardTally {
  downloadedChapters: number;
  totalChapters: number;
  downloadedVolumes: number;
  totalVolumes: number;
}

/**
 * Compute the card's chapter/volume download tally, honoring whole-volume
 * archives.
 *
 * A whole-volume archive (e.g. `Akira V02.cbr`) imports as a single
 * NULL-chapterNumber "volume-file" row that holds every chapter in the volume,
 * sitting alongside numbered placeholder rows that were never individually
 * linked. When such a row is COMPLETED **and file-backed**, the volume's full
 * content is on disk — so every numbered chapter in that volume counts as
 * downloaded and the volume counts as complete, even though only the container
 * row carries a file. The container row itself is excluded from the tally.
 *
 * The file-backed requirement matters: `ensureVolumeFileRows` also creates
 * filePath-less container rows for per-chapter imports, and reconciliation can
 * strand these as orphans in volumes that no longer hold any numbered chapters.
 * A file-less container is NOT real coverage. The unassigned bucket (no real
 * volume) falls back to a flat completed-count over its numbered chapters.
 */
export function computeCardTally(chapters: CardChapter[]): CardTally {
  const byVolume = new Map<number, CardChapter[]>();
  for (const ch of chapters) {
    const vol = typeof ch.volume === 'number' && ch.volume >= 0 ? ch.volume : -1;
    const bucket = byVolume.get(vol) ?? [];
    bucket.push(ch);
    byVolume.set(vol, bucket);
  }

  const isNumbered = (c: CardChapter): boolean => c.chapterNumber !== null && c.chapterNumber !== undefined;
  const isDone = (c: CardChapter): boolean => c.downloadStatus === 'COMPLETED';
  const hasFile = (c: CardChapter): boolean => c.filePath !== null && c.filePath !== undefined && c.filePath !== '';

  const tally: CardTally = { downloadedChapters: 0, totalChapters: 0, downloadedVolumes: 0, totalVolumes: 0 };

  for (const [vol, group] of byVolume) {
    const numbered = group.filter(isNumbered);

    if (vol === -1) {
      // Unassigned: flat completed-count, no whole-volume coverage.
      tally.totalChapters += numbered.length;
      tally.downloadedChapters += numbered.filter(isDone).length;
      continue;
    }

    // Only a real, file-backed archive grants whole-volume coverage.
    const hasFileArchive = group.some((c) => !isNumbered(c) && isDone(c) && hasFile(c));

    if (numbered.length > 0) {
      const volDone = hasFileArchive ? numbered.length : numbered.filter(isDone).length;
      tally.totalChapters += numbered.length;
      tally.downloadedChapters += volDone;
      tally.totalVolumes += 1;
      if (volDone === numbered.length) tally.downloadedVolumes += 1;
    } else if (hasFileArchive) {
      // A file-backed archive with no numbered placeholders = one complete unit.
      tally.totalChapters += 1;
      tally.downloadedChapters += 1;
      tally.totalVolumes += 1;
      tally.downloadedVolumes += 1;
    }
    // else: orphaned file-less container — contributes nothing.
  }

  return tally;
}
