/**
 * ComicVine Selectors
 *
 * ComicVine uses a wiki-style layout with card-based info panels.
 * Common patterns:
 * - .wiki-details for metadata cards
 * - data-field attributes for structured data
 * - .pod for sidebar sections
 *
 * @module shared/source-knowledge/selectors/comicvine-selectors
 */

import type { SourceSelectors } from './types';

export const COMICVINE_SELECTORS: SourceSelectors = {
  // Core metadata
  title: [
    'h1.wiki-title',
    'h1[data-field="name"]',
    '.profile-header h1',
    '.wiki-title',
    'h1.title',
  ],
  altTitles: [
    '.wiki-details [data-field="aliases"]',
    '.pod-body [data-label="Aliases"]',
    '.alias-list span',
    '[data-field="real_name"]',
  ],
  author: [
    '.wiki-details [data-field="creators"] a',
    '.pod [data-label="Created By"] a',
    '.creators-list a',
    '[data-field="writers"] a',
  ],
  artist: [
    '.wiki-details [data-field="artists"] a',
    '.pod [data-label="Artists"] a',
    '[data-field="pencilers"] a',
    '[data-field="inkers"] a',
  ],
  status: [
    '.wiki-details [data-field="status"]',
    '.pod [data-label="Status"]',
    '[data-field="deck"]',
  ],
  genres: [
    '.wiki-details [data-field="genres"] a',
    '.pod [data-label="Genres"] a',
    '.genre-tags a',
    '.tags a',
  ],
  summary: [
    '.wiki-description',
    '.wiki-details .description',
    '[data-field="description"]',
    '.deck',
    '.object-description p',
  ],

  // Publication info
  volumeCount: [
    '.wiki-details [data-field="count_of_volumes"]',
    '.pod [data-label="Volumes"]',
    '[data-field="volume_count"]',
  ],
  chapterCount: [
    '.wiki-details [data-field="count_of_issues"]',
    '.pod [data-label="Issues"]',
    '[data-field="issue_count"]',
  ],
  publisher: [
    '.wiki-details [data-field="publisher"] a',
    '.pod [data-label="Publisher"] a',
    '[data-field="publisher_name"]',
    '.publisher-link',
  ],
  magazine: [
    '.wiki-details [data-field="imprint"]',
    '.pod [data-label="Imprint"]',
  ],
  demographic: [
    '.wiki-details [data-field="demographic"]',
    '.pod [data-label="Audience"]',
  ],
  releaseDate: [
    '.wiki-details [data-field="start_year"]',
    '.wiki-details [data-field="cover_date"]',
    '.pod [data-label="Start Year"]',
    '[data-field="date_added"]',
  ],

  // Extended fields
  themes: [
    '.wiki-details [data-field="concepts"] a',
    '.concepts-list a',
  ],
  tags: [
    '.object-tags a',
    '.tag-list a',
    '.wiki-tags a',
  ],
  format: [
    '.wiki-details [data-field="format"]',
    '.pod [data-label="Format"]',
  ],
  characters: [
    '.wiki-details [data-field="characters"] a',
    '.characters-list a',
    '.character-credits a',
    '[data-field="character_credits"] a',
  ],
  coverImage: [
    '.primary-image img',
    '.imgboxart img',
    '.wiki-image img',
    '[data-field="image"] img',
    '.object-image img',
  ],

  // Structural selectors
  infoboxContainer: [
    '.wiki-details',
    '.pod.object-details',
    '.sidebar',
    '.object-pod',
  ],
  chapterTable: [
    '.issues-table',
    'table.wiki-table',
    '#issues-list table',
  ],
  volumeTable: [
    '.volumes-table',
    'table[data-field="volumes"]',
    '#volumes-list table',
  ],
};
