/**
 * Wikipedia Selectors
 *
 * Wikipedia uses traditional infobox tables with th/td structure.
 * Common patterns:
 * - .infobox th:contains("Label") + td
 * - .infobox for container
 * - th for labels, td for values
 */

import type { SourceSelectors } from './types';

export const WIKIPEDIA_SELECTORS: SourceSelectors = {
  // Core metadata
  title: ['h1#firstHeading', 'h1.firstHeading', '.mw-page-title-main'],
  altTitles: [
    '.infobox th:contains("Japanese") + td',
    '.infobox th:contains("Romaji") + td',
    '.infobox th:contains("Native name") + td',
    '.infobox th:contains("Original name") + td',
    '.infobox th:contains("Kanji") + td',
    '.infobox-above', // Some infoboxes show alt title here
    '.nickname',
  ],
  author: [
    '.infobox th:contains("Written by") + td',
    '.infobox th:contains("Author") + td',
    '.infobox th:contains("Created by") + td',
    '.infobox th:contains("Story by") + td',
    '.infobox td[data-label="Author"]',
    '.infobox td[data-label="Written by"]',
  ],
  artist: [
    '.infobox th:contains("Illustrated by") + td',
    '.infobox th:contains("Artist") + td',
    '.infobox th:contains("Art by") + td',
    '.infobox td[data-label="Artist"]',
    '.infobox td[data-label="Illustrated by"]',
  ],
  status: [
    '.infobox th:contains("Status") + td',
    '.infobox th:contains("Publication status") + td',
    '.infobox td[data-label="Status"]',
  ],
  genres: [
    '.infobox th:contains("Genre") + td',
    '.infobox th:contains("Genres") + td',
    '.infobox th:contains("Genre") + td a',
    '.infobox td[data-label="Genre"]',
    '.infobox td[data-label="Genre"] a',
  ],
  summary: [
    '#Synopsis + .mw-parser-output p',
    '#Plot + .mw-parser-output p',
    '.mw-parser-output > p:first-of-type',
    '.shortdescription',
  ],

  // Publication info
  volumeCount: [
    '.infobox th:contains("Volumes") + td',
    '.infobox th:contains("Volume") + td',
    '.infobox th:contains("Tankōbon") + td',
    '.infobox td[data-label="Volumes"]',
  ],
  chapterCount: [
    '.infobox th:contains("Chapters") + td',
    '.infobox th:contains("Chapter") + td',
    '.infobox th:contains("Episodes") + td',
    '.infobox td[data-label="Chapters"]',
  ],
  publisher: [
    '.infobox th:contains("Publisher") + td',
    '.infobox th:contains("Published by") + td',
    '.infobox th:contains("English publisher") + td',
    '.infobox td[data-label="Publisher"]',
  ],
  magazine: [
    '.infobox th:contains("Magazine") + td',
    '.infobox th:contains("Serialized in") + td',
    '.infobox th:contains("Serialization") + td',
    '.infobox th:contains("Original run") + td',
    '.infobox td[data-label="Magazine"]',
  ],
  demographic: [
    '.infobox th:contains("Demographic") + td',
    '.infobox th:contains("Target") + td',
    '.infobox td[data-label="Demographic"]',
  ],
  releaseDate: [
    '.infobox th:contains("Original run") + td',
    '.infobox th:contains("Published") + td',
    '.infobox th:contains("Release date") + td',
    '.infobox th:contains("First published") + td',
    '.infobox td[data-label="Original run"]',
  ],

  // Extended fields
  themes: [
    '.infobox th:contains("Themes") + td',
    '.infobox th:contains("Theme") + td',
    '.infobox td[data-label="Themes"]',
  ],
  tags: ['.catlinks a', '.mw-normal-catlinks a'],
  format: [
    '.infobox th:contains("Format") + td',
    '.infobox th:contains("Type") + td',
    '.infobox td[data-label="Format"]',
  ],
  characters: [
    '.infobox th:contains("Characters") + td a',
    '#Characters + ul a',
    '#Main_characters + ul a',
  ],
  coverImage: [
    '.infobox-image img',
    '.infobox img:first-of-type',
    '.thumbimage',
  ],

  // Structural selectors
  infoboxContainer: [
    '.infobox',
    '.infobox-manga',
    '.infobox.vcard',
    '.infobox.vevent',
  ],
  chapterTable: [
    '.wikitable caption:contains("Chapter") ~ tbody',
    'h2:contains("Chapters") + table.wikitable',
    '#Chapters ~ table.wikitable',
    '#Chapter_list ~ table.wikitable',
  ],
  volumeTable: [
    '.wikitable caption:contains("Volume") ~ tbody',
    'h2:contains("Volumes") + table.wikitable',
    '#Volumes ~ table.wikitable',
    '#Volume_list ~ table.wikitable',
  ],
};
