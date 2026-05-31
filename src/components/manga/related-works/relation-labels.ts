/**
 * Relation-type → display label + color mapping for the related-works carousel.
 */

import type { MangaRelationTargetMedium, MangaRelationType } from '@prisma/client';

export interface RelationLabel {
  label: string;
  color: string;
}

const TYPE_LABELS: Record<MangaRelationType, RelationLabel> = {
  PARENT: { label: 'Parent', color: 'indigo' },
  PREQUEL: { label: 'Prequel', color: 'blue' },
  SEQUEL: { label: 'Sequel', color: 'green' },
  SIDE_STORY: { label: 'Side Story', color: 'teal' },
  SPIN_OFF: { label: 'Spin-off', color: 'cyan' },
  ALTERNATIVE: { label: 'Alternative', color: 'grape' },
  ADAPTATION: { label: 'Adaptation', color: 'orange' },
  CHARACTER: { label: 'Character', color: 'pink' },
  SUMMARY: { label: 'Summary', color: 'gray' },
  COMPILATION: { label: 'Compilation', color: 'gray' },
  CONTAINS: { label: 'Contains', color: 'gray' },
  SOURCE: { label: 'Source', color: 'yellow' },
  OTHER: { label: 'Related', color: 'gray' },
};

const MEDIUM_LABELS: Record<MangaRelationTargetMedium, RelationLabel | null> = {
  MANGA: null,
  ANIME: { label: 'Anime', color: 'red' },
  NOVEL: { label: 'Novel', color: 'lime' },
  OTHER: { label: 'Other', color: 'gray' },
};

export function labelForRelationType(t: MangaRelationType): RelationLabel {
  return TYPE_LABELS[t];
}

export function labelForMedium(m: MangaRelationTargetMedium): RelationLabel | null {
  return MEDIUM_LABELS[m];
}

/**
 * Build an external link to the relation's source. Today only AniList is
 * populated, but the shape is forward-compatible with MAL/MU/etc.
 */
export function externalLinkFor(
  source: string,
  externalId: string,
  medium: MangaRelationTargetMedium,
): string | null {
  if (source === 'anilist') {
    const path = medium === 'ANIME' ? 'anime' : 'manga';
    return `https://anilist.co/${path}/${externalId}`;
  }
  return null;
}
