/**
 * Training Dataset Titles
 *
 * Curated list of 1000+ manga titles for ML training data collection.
 * Used by both the collection script and the annotation UI.
 * Excludes manhwa/webtoons - Japanese manga only.
 */

import { ADDITIONAL_TITLES } from './additional-titles';
import { CLASSIC_TITLES } from './classic-titles';
import { EXTENDED_TITLES } from './extended-titles';
import { FINAL_TITLES } from './final-titles';
import { ISEKAI_FANTASY_TITLES } from './isekai-fantasy-titles';
import { MORE_TITLES } from './more-titles';
import { NICHE_POPULAR_TITLES } from './niche-popular-titles';
import { SEINEN_TITLES } from './seinen-titles';
import { SHOJO_JOSEI_TITLES } from './shojo-josei-titles';
import { SHONEN_TITLES } from './shonen-titles';
import { SPORTS_TITLES } from './sports-titles';
import { SUPPLEMENTARY_TITLES } from './supplementary-titles';

import type { MangaTitle } from './types';

export type { MangaTitle };

/**
 * Combined list of all training titles
 */
export const TRAINING_TITLES: MangaTitle[] = [
  ...SHONEN_TITLES,
  ...SEINEN_TITLES,
  ...SHOJO_JOSEI_TITLES,
  ...CLASSIC_TITLES,
  ...SPORTS_TITLES,
  ...ISEKAI_FANTASY_TITLES,
  ...ADDITIONAL_TITLES,
  ...MORE_TITLES,
  ...EXTENDED_TITLES,
  ...NICHE_POPULAR_TITLES,
  ...FINAL_TITLES,
  ...SUPPLEMENTARY_TITLES,
];

/**
 * Get unique titles formatted for UI dropdowns (deduplicated by lowercase title)
 */
export function getTrainingTitleOptions(): { value: string; label: string }[] {
  const seen = new Set<string>();
  return TRAINING_TITLES
    .filter((manga) => {
      const lower = manga.title.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((manga) => ({
      value: manga.title,
      label: manga.title,
    }));
}

/**
 * Total count of unique training titles
 */
export const TRAINING_TITLES_COUNT = getTrainingTitleOptions().length;
