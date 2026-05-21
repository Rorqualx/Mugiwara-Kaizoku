/**
 * Media-type-aware UI labels.
 *
 * Returns the right unit noun for the current Manga row. Manga is tracked
 * in chapters; comicbooks are tracked in issues. Use the returned `unit`
 * / `units` strings in any UI that talks about per-chapter quantities so
 * comicbook series read "Read 12 of 64 issues" rather than "chapters".
 */

import { useMemo } from 'react';

export interface MediaTypeLabels {
  unit: string;
  units: string;
  Unit: string;
  Units: string;
}

const MANGA_LABELS: MediaTypeLabels = {
  unit: 'chapter',
  units: 'chapters',
  Unit: 'Chapter',
  Units: 'Chapters',
};

const COMICBOOK_LABELS: MediaTypeLabels = {
  unit: 'issue',
  units: 'issues',
  Unit: 'Issue',
  Units: 'Issues',
};

export function useMediaTypeLabels(mediaType: string | null | undefined): MediaTypeLabels {
  return useMemo<MediaTypeLabels>(
    () => (mediaType === 'COMICBOOK' ? COMICBOOK_LABELS : MANGA_LABELS),
    [mediaType],
  );
}
