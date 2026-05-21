/**
 * Utility functions for ProviderStrengthIndicator components
 *
 * @module components/metadata/ProviderStrengthIndicator/utils
 */

import type { IndicatorSize } from './types';

/**
 * Provider display name mapping
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anilist: 'AniList',
  comicvine: 'ComicVine',
  fandom: 'Fandom',
  wikipedia: 'Wikipedia'
};

/**
 * Field display name mapping
 */
export const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: 'Title',
  summary: 'Summary',
  genres: 'Genres',
  authors: 'Authors',
  characters: 'Characters',
  cover: 'Cover Images',
  status: 'Publication Status',
  startDate: 'Start Date',
  endDate: 'End Date',
  volumes: 'Volume Count',
  chapters: 'Chapter Count',
  synonyms: 'Alternative Titles',
  tags: 'Tags'
};

/**
 * Size to pixel mapping
 */
export const SIZE_TO_PX: Record<IndicatorSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20
};

/**
 * Get size in pixels
 */
export function getSizeInPx(size: IndicatorSize): number {
  return SIZE_TO_PX[size];
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] ?? providerId;
}

/**
 * Get field display name
 */
export function getFieldDisplayName(fieldName: string): string {
  return FIELD_DISPLAY_NAMES[fieldName] ?? fieldName;
}

/**
 * Get star color based on strength
 */
export function getStarColor(strength: number): string {
  if (strength >= 4.5) return '#388E3C'; // green
  if (strength >= 3.5) return '#1976D2'; // blue
  if (strength >= 2.5) return '#FFA000'; // amber
  if (strength >= 1.5) return '#F57C00'; // orange
  return '#D32F2F'; // red
}

/**
 * Get tooltip text based on strength
 */
export function getTooltipText(
  providerId: string,
  fieldName: string,
  strength: number,
  getStrengthDescription: (strength: number) => string
): string {
  const providerName = getProviderDisplayName(providerId);
  const fieldDisplay = getFieldDisplayName(fieldName);
  const strengthText = getStrengthDescription(strength).toLowerCase();

  return `${providerName} has ${strengthText} data quality for ${fieldDisplay} information (${strength}/5)`;
}
