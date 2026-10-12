/**
 * Fandom chapters filed under a volume a finished series does not have.
 *
 * A franchise wiki shared by several titles numbers its volumes across the
 * whole franchise (jojo.fandom.com: Steel Ball Run is volumes 81-104, JoJolion
 * 105-131). Bound to one part, its chapter list is short enough to pass the
 * cross-series count gate (138 chapters against Steel Ball Run's 95) yet every
 * chapter in it belongs to another part: they were stored as monitored
 * chapters 107-110 and 473-500 of a 95-chapter series, and their titles
 * replaced the titles of downloaded chapters with the same numbers.
 *
 * The volume number gives it away: a finished series has a known volume count,
 * and a chapter filed under volume 51 or 131 of a 24-volume series is not part
 * of it. Those chapters, and volumes numbered the same way, are refused before
 * anything downstream reads the list.
 *
 * No DB access; `withoutChaptersPastVolumeCeiling` only logs.
 */

import { logger } from '@/utils/logger';

import type { ChapterDataItem, VolumeDataItem } from '../types';

/** A finished series may carry one volume past its count (see `db-volume-cap.ts`). */
const TRAILING_VOLUMES = 1;

const FINISHED_STATUSES = new Set<string>(['FINISHED', 'COMPLETED', 'CANCELLED']);

/**
 * The highest volume number a chapter of this series can be filed under, or
 * null when the series is still running or its volume count is unknown — then
 * nothing is refused.
 */
export function finishedVolumeCeiling(status: unknown, volumes: number | null | undefined): number | null {
  if (typeof status !== 'string' || !FINISHED_STATUSES.has(status.toUpperCase())) return null;
  if (typeof volumes !== 'number' || !Number.isFinite(volumes) || volumes <= 0) return null;
  return Math.ceil(volumes) + TRAILING_VOLUMES;
}

export interface VolumeCeilingSplit {
  chapters: ChapterDataItem[];
  volumes: VolumeDataItem[];
  refusedChapters: ChapterDataItem[];
  refusedVolumes: VolumeDataItem[];
}

/**
 * Split a Fandom chapter list and volume list at `ceiling`. A chapter with no
 * usable volume number is kept: there is nothing to judge it by — unless most
 * of the list is past the ceiling. Then the list is another series' (the same
 * wiki's "Volume 1" page: 134 chapters under volumes 51-131 and Part 1's 44
 * chapters with no volume), and all of it is refused.
 */
export function splitPastVolumeCeiling(
  chapters: ChapterDataItem[],
  volumes: VolumeDataItem[],
  ceiling: number | null,
): VolumeCeilingSplit {
  if (ceiling === null) return { chapters, volumes, refusedChapters: [], refusedVolumes: [] };
  const split: VolumeCeilingSplit = { chapters: [], volumes: [], refusedChapters: [], refusedVolumes: [] };
  for (const chapter of chapters) {
    const past = chapter.volume !== undefined && chapter.volume > ceiling;
    (past ? split.refusedChapters : split.chapters).push(chapter);
  }
  for (const volume of volumes) {
    (volume.number > ceiling ? split.refusedVolumes : split.volumes).push(volume);
  }
  if (split.refusedChapters.length > split.chapters.length) {
    return { chapters: [], volumes: [], refusedChapters: chapters, refusedVolumes: volumes };
  }
  return split;
}

/**
 * A Fandom result with the chapters and volumes past the finished series'
 * volume ceiling removed, and the refusal logged. Returns the same object when
 * nothing is refused.
 */
export function withoutChaptersPastVolumeCeiling<T extends { chapterList: ChapterDataItem[]; volumeList: VolumeDataItem[] }>(
  mangaId: number,
  fandom: T,
  status: unknown,
  volumeCount: number | null | undefined,
): T {
  const ceiling = finishedVolumeCeiling(status, volumeCount);
  const split = splitPastVolumeCeiling(fandom.chapterList, fandom.volumeList, ceiling);
  if (split.refusedChapters.length === 0 && split.refusedVolumes.length === 0) return fandom;
  const volumeNumbers = [...new Set(split.refusedChapters.map(c => c.volume ?? 0))]
    .filter(v => ceiling !== null && v > ceiling)
    .sort((a, b) => a - b);
  logger.warn(
    `[enrichmentPipeline] Refused ${split.refusedChapters.length} Fandom chapter(s) and ${split.refusedVolumes.length} volume(s) ` +
    `filed past volume ${ceiling ?? 0} of finished manga ${mangaId} (chapter volumes ${volumeNumbers.join(', ')}); ` +
    `${split.chapters.length} chapter(s) kept`,
  );
  return { ...fandom, chapterList: split.chapters, volumeList: split.volumes };
}
