/**
 * Fandom Wiki Selectors
 *
 * Fandom uses portable-infobox structure with data-source attributes.
 * Common patterns:
 * - .pi-data[data-source="field"] .pi-data-value
 * - .portable-infobox for container
 * - .pi-data-label for labels
 *
 * @module shared/source-knowledge/selectors/fandom-selectors
 */

import type { SourceSelectors } from './types';

export const FANDOM_SELECTORS: SourceSelectors = {
  // Core metadata
  title: [
    'h1.page-header__title',
    '.pi-title',
    'h1#firstHeading',
    '.page-header__title',
  ],
  altTitles: [
    '.pi-data[data-source="romaji"] .pi-data-value',
    '.pi-data[data-source="japanese"] .pi-data-value',
    '.pi-data[data-source="kanji"] .pi-data-value',
    '.pi-data[data-source="english"] .pi-data-value',
    '.pi-data[data-source="native_name"] .pi-data-value',
    '.pi-data[data-source="japanese_name"] .pi-data-value',
    '.pi-data[data-source="original_name"] .pi-data-value',
    '.pi-data[data-source="alt_name"] .pi-data-value',
    // Chapter page specific - Kana and Romaji fields
    '.pi-data[data-source="kana"] .pi-data-value',
    '.pi-data[data-source="romaji"] .pi-data-value',
    '.pi-data[data-source="romanji"] .pi-data-value',
    // Label-based selectors (when data-source isn't available)
    '.pi-data .pi-data-label:contains("Kana") + .pi-data-value',
    '.pi-data .pi-data-label:contains("Romaji") + .pi-data-value',
    '.pi-data .pi-data-label:contains("Romaji") + .pi-data-value',
  ],
  author: [
    '.pi-data[data-source="author"] .pi-data-value',
    '.pi-data[data-source="writer"] .pi-data-value',
    '.pi-data[data-source="story"] .pi-data-value',
    '.pi-data[data-source="created_by"] .pi-data-value',
    '.pi-data[data-source="creator"] .pi-data-value',
    '.pi-data[data-source="mangaka"] .pi-data-value',
  ],
  artist: [
    '.pi-data[data-source="artist"] .pi-data-value',
    '.pi-data[data-source="illustrator"] .pi-data-value',
    '.pi-data[data-source="art"] .pi-data-value',
    '.pi-data[data-source="drawn_by"] .pi-data-value',
  ],
  status: [
    '.pi-data[data-source="status"] .pi-data-value',
    '.pi-data[data-source="publication_status"] .pi-data-value',
    '.pi-data[data-source="current_status"] .pi-data-value',
  ],
  genres: [
    '.pi-data[data-source="genre"] .pi-data-value',
    '.pi-data[data-source="genres"] .pi-data-value',
    '.pi-data[data-source="genre"] .pi-data-value a',
    '.pi-data[data-source="category"] .pi-data-value',
  ],
  summary: [
    // Infobox synopsis fields
    '.pi-data[data-source="summary"] .pi-data-value',
    '.pi-data[data-source="synopsis"] .pi-data-value',
    '.pi-data[data-source="plot"] .pi-data-value',
    // Section-based synopsis (h2 header followed by content)
    'h2:has(#Synopsis) + p',
    'h2:has(#Plot) + p',
    'h2:has(#Summary) + p',
    'h2:has(#Story) + p',
    // Alternative: headline span followed by paragraphs
    '#Synopsis ~ p:first-of-type',
    '#Plot ~ p:first-of-type',
    '#Summary ~ p:first-of-type',
    // Legacy selectors
    '#Synopsis + p',
    '#Plot + p',
    // Fallback to first paragraph in content area
    '.mw-parser-output > p:first-of-type',
  ],

  // Publication info
  volumeCount: [
    '.pi-data[data-source="volumes"] .pi-data-value',
    '.pi-data[data-source="volume"] .pi-data-value',
    '.pi-data[data-source="tankoubon"] .pi-data-value',
  ],
  chapterCount: [
    '.pi-data[data-source="chapters"] .pi-data-value',
    '.pi-data[data-source="chapter"] .pi-data-value',
    '.pi-data[data-source="episodes"] .pi-data-value',
  ],
  publisher: [
    '.pi-data[data-source="publisher"] .pi-data-value',
    '.pi-data[data-source="published_by"] .pi-data-value',
    '.pi-data[data-source="english_publisher"] .pi-data-value',
    '.pi-data[data-source="jp_publisher"] .pi-data-value',
  ],
  magazine: [
    '.pi-data[data-source="magazine"] .pi-data-value',
    '.pi-data[data-source="serialized"] .pi-data-value',
    '.pi-data[data-source="serialization"] .pi-data-value',
    '.pi-data[data-source="published_in"] .pi-data-value',
  ],
  demographic: [
    '.pi-data[data-source="demographic"] .pi-data-value',
    '.pi-data[data-source="target"] .pi-data-value',
    '.pi-data[data-source="audience"] .pi-data-value',
  ],
  releaseDate: [
    '.pi-data[data-source="release_date"] .pi-data-value',
    '.pi-data[data-source="release"] .pi-data-value',
    '.pi-data[data-source="published"] .pi-data-value',
    '.pi-data[data-source="start_date"] .pi-data-value',
    '.pi-data[data-source="original_run"] .pi-data-value',
    // Volume-specific date fields
    '.pi-data[data-source="date"] .pi-data-value',
    '.pi-data[data-source="jp_release"] .pi-data-value',
    '.pi-data[data-source="en_release"] .pi-data-value',
  ],

  // Extended fields
  themes: [
    '.pi-data[data-source="themes"] .pi-data-value',
    '.pi-data[data-source="theme"] .pi-data-value',
  ],
  tags: [
    '.pi-data[data-source="tags"] .pi-data-value',
    '.pi-data[data-source="content_tags"] .pi-data-value',
    '.article-categories a',
  ],
  format: [
    '.pi-data[data-source="format"] .pi-data-value',
    '.pi-data[data-source="type"] .pi-data-value',
    '.pi-data[data-source="media_type"] .pi-data-value',
  ],
  characters: [
    '.pi-data[data-source="characters"] .pi-data-value a',
    '.pi-data[data-source="character"] .pi-data-value a',
    '.pi-data[data-source="main_characters"] .pi-data-value a',
    '.pi-data[data-source="characters"] .pi-data-value',
    '.pi-data[data-source="character"] .pi-data-value',
    '.mw-parser-output .character-list a',
    '.mw-parser-output table.article-table a[href*="/Characters"]',
  ],
  coverImage: [
    '.pi-image img',
    '.pi-image-collection img',
    '.pi-data[data-source="image"] img',
    '.portable-infobox img:first-of-type',
  ],

  // Structural selectors
  infoboxContainer: [
    '.portable-infobox',
    'aside.portable-infobox',
    '.pi-theme-wikia',
  ],
  chapterTable: [
    'table.article-table[data-source="chapters"]',
    '.chapter-list table',
    '#Chapters + table',
    '#Chapter_List + table',
    '#Episodes + table',
  ],
  volumeTable: [
    'table.article-table[data-source="volumes"]',
    '.volume-list table',
    '#Volumes + table',
    '#Volume_List + table',
    '#Tankoubon + table',
  ],
};
