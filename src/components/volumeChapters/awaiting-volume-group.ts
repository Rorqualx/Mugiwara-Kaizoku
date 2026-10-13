/**
 * "Not yet in a volume" group for the volume browser.
 *
 * Chapters released past the last volume carry `Chapter.volume = -1`
 * (`@/lib/metadata/awaiting-volume`). They used to fall into the yellow
 * "Unassigned Chapters & Volumes" bucket together with genuinely misplaced
 * files: shown above Volume 1 in the virtualized list, offered "Delete all
 * unassigned files", and without a monitor or download action. They now get
 * their own group, listed after the last volume, that can be monitored and
 * downloaded like any volume. Nothing about the coming volume is invented:
 * the header only says which volume number would follow the last one.
 */

import { ChapterStatus } from '@prisma/client';

import { AWAITING_VOLUME, isAwaitingVolume } from '@/lib/metadata/awaiting-volume';

import { extractVolumeNumber } from './utils';

import type { Chapter } from '@prisma/client';

/** UI group key of the "Not yet in a volume" group: sorts after every real volume. */
export const AWAITING_VOLUME_GROUP = Number.MAX_SAFE_INTEGER;

/** True for the "Not yet in a volume" group key. */
export function isAwaitingVolumeGroup(groupKey: number): boolean {
  return groupKey === AWAITING_VOLUME_GROUP;
}

/**
 * The volume-browser group a chapter belongs to: its volume number, the
 * "Not yet in a volume" group for a chapter awaiting its volume, or -1
 * ("Unassigned") when its volume is unknown. A file whose name gives a volume
 * keeps that volume, as before.
 */
export function volumeGroupKey(chapter: Chapter): number {
  const key = extractVolumeNumber(chapter);
  if (key === -1 && isAwaitingVolume(chapter.volume)) return AWAITING_VOLUME_GROUP;
  return key;
}

/**
 * The `volumeNumber` the server's volume-scoped calls (monitoring, retry) take
 * for a group: the stored -1 tag for the "Not yet in a volume" group.
 */
export function serverVolumeNumber(groupKey: number): number {
  return isAwaitingVolumeGroup(groupKey) ? AWAITING_VOLUME : groupKey;
}

/** Header text: "Not yet in a volume (256-278) - after Volume 28". */
export function awaitingGroupTitle(chapters: readonly Chapter[], lastVolumeNumber: number | null): string {
  const numbers = chapters
    .map(c => c.chapterNumber)
    .filter((n): n is number => n !== null);
  const range = numbers.length > 0 ? ` (${Math.min(...numbers)}-${Math.max(...numbers)})` : '';
  const after = lastVolumeNumber !== null && lastVolumeNumber > 0 ? ` - after Volume ${lastVolumeNumber}` : '';
  return `Not yet in a volume${range}${after}`;
}

/** Highest real volume number among the browser's groups, or null. */
export function lastVolumeNumberOf(groupKeys: readonly number[]): number | null {
  const real = groupKeys.filter(k => k > 0 && !isAwaitingVolumeGroup(k));
  return real.length > 0 ? Math.max(...real) : null;
}

/** The browser's volume titles plus the "Not yet in a volume" group's header, when it has one. */
export function withAwaitingGroupTitle(
  volumeTitles: Record<number, string> | undefined,
  groups: ReadonlyArray<readonly [number, readonly Chapter[]]>,
): Record<number, string> | undefined {
  const awaiting = groups.find(([key]) => isAwaitingVolumeGroup(key));
  if (!awaiting) return volumeTitles;
  const title = awaitingGroupTitle(awaiting[1], lastVolumeNumberOf(groups.map(([key]) => key)));
  return { ...(volumeTitles ?? {}), [AWAITING_VOLUME_GROUP]: title };
}

/** Ids of the group's chapters that still need a download (BULK quick download scope). */
export function missingChapterIds(chapters: readonly Chapter[]): number[] {
  return chapters
    .filter(c => c.id > 0 && c.downloadStatus !== ChapterStatus.COMPLETED)
    .map(c => c.id);
}
