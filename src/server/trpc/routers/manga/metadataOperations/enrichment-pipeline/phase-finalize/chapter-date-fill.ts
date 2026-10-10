/**
 * Decide which Metadata publication dates may be filled from chapter release
 * dates when the providers shipped none.
 *
 * `endDate` is a terminal signal: the phantom prune and the stored trusted
 * ceiling both read a non-null `Metadata.endDate` as "this series finished"
 * and cannot tell a synthesised date from a provider one. So it is only
 * filled for a series whose status is itself terminal — the latest chapter of
 * an ongoing series is not its end.
 */

import type { MangaPublicationStatus } from '@prisma/client';

const TERMINAL_STATUSES: ReadonlySet<MangaPublicationStatus> = new Set<MangaPublicationStatus>(['COMPLETED', 'CANCELLED']);

export interface ChapterDateFillInput {
  status: MangaPublicationStatus | null | undefined;
  startDate: Date | null | undefined;
  endDate: Date | null | undefined;
  earliestRelease: Date | null | undefined;
  latestRelease: Date | null | undefined;
}

export interface ChapterDateFill {
  startDate?: Date;
  endDate?: Date;
}

export function isTerminalStatus(status: MangaPublicationStatus | null | undefined): boolean {
  return status !== null && status !== undefined && TERMINAL_STATUSES.has(status);
}

export function planChapterDateFill(input: ChapterDateFillInput): ChapterDateFill {
  const fill: ChapterDateFill = {};
  if (!input.startDate && input.earliestRelease) fill.startDate = input.earliestRelease;
  if (!input.endDate && input.latestRelease && isTerminalStatus(input.status)) fill.endDate = input.latestRelease;
  return fill;
}
