/**
 * AniList Selectors
 *
 * AniList uses a React-based SPA with data attributes and semantic classes.
 * Common patterns:
 * - .content .data[data-v-*] for info sections
 * - .sidebar for metadata
 * - .description for summaries
 *
 * @module shared/source-knowledge/selectors/anilist-selectors
 */

import type { SourceSelectors } from './types';

export const ANILIST_SELECTORS: SourceSelectors = {
  // Core metadata
  title: [
    'h1.title',
    '.header .content h1',
    '.media-header h1',
    '[data-testid="media-title"]',
    '.title-wrap h1',
  ],
  altTitles: [
    '.data-set[data-type="romaji"] .value',
    '.data-set[data-type="native"] .value',
    '.data-set[data-type="english"] .value',
    '.alternative-titles .value',
    '.synonyms .value',
    '.sidebar .data-set:has(.type:contains("Romaji")) .value',
    '.sidebar .data-set:has(.type:contains("Native")) .value',
  ],
  author: [
    '.staff-grid .role-card[data-role="Story"] .name',
    '.staff-grid .role-card[data-role="Original Creator"] .name',
    '.staff-section [data-role*="Story"] .name a',
    '.data-set[data-type="staff"] .value a',
  ],
  artist: [
    '.staff-grid .role-card[data-role="Art"] .name',
    '.staff-section [data-role*="Art"] .name a',
    '.data-set[data-type="illustrator"] .value a',
  ],
  status: [
    '.data-set[data-type="status"] .value',
    '.sidebar .data:has(.type:contains("Status")) .value',
    '.sidebar .status .value',
    '[data-status]',
  ],
  genres: [
    '.genres .genre',
    '.tags .tag',
    '.sidebar .genres a',
    '.genre-list a',
    '[data-testid="genre"]',
  ],
  summary: [
    '.description-wrap .description',
    '.content .description',
    '.overview .description p',
    '[data-testid="description"]',
    '.markdown-content',
  ],

  // Publication info
  volumeCount: [
    '.data-set[data-type="volumes"] .value',
    '.sidebar .data:has(.type:contains("Volumes")) .value',
    '[data-type="volumes"]',
  ],
  chapterCount: [
    '.data-set[data-type="chapters"] .value',
    '.sidebar .data:has(.type:contains("Chapters")) .value',
    '[data-type="chapters"]',
  ],
  publisher: [
    '.data-set[data-type="publisher"] .value',
    '.studios a',
    '.external-links a[href*="publisher"]',
  ],
  magazine: [
    '.data-set[data-type="serialization"] .value',
    '.external-links a[href*="magazine"]',
  ],
  demographic: [
    '.data-set[data-type="demographic"] .value',
    '.sidebar .data:has(.type:contains("Demographic")) .value',
  ],
  releaseDate: [
    '.data-set[data-type="start_date"] .value',
    '.data-set[data-type="startDate"] .value',
    '.sidebar .data:has(.type:contains("Start Date")) .value',
    '[data-start-date]',
  ],

  // Extended fields
  themes: [
    '.tags .tag[data-type="theme"]',
    '.themes a',
  ],
  tags: [
    '.tags .tag',
    '.tag-list .tag',
    '[data-testid="tag"]',
  ],
  format: [
    '.data-set[data-type="format"] .value',
    '.sidebar .data:has(.type:contains("Format")) .value',
    '[data-format]',
  ],
  characters: [
    '.characters-grid .character-card .name a',
    '.character-list .name a',
    '[data-testid="character"] .name',
  ],
  coverImage: [
    '.cover img',
    '.header .cover-wrap img',
    '.media-header .cover img',
    '[data-testid="cover-image"]',
  ],

  // Structural selectors
  infoboxContainer: [
    '.sidebar',
    '.media-sidebar',
    '.data-section',
  ],
  chapterTable: [
    '.chapters-list',
    '.episode-list',
  ],
  volumeTable: [
    '.volumes-list',
    '.media-list',
  ],
};
