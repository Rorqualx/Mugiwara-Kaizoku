/**
 * Generic Fallback Selectors
 *
 * Used when source type is unknown or for sources without
 * specific selector definitions.
 *
 * @module shared/source-knowledge/selectors/generic-selectors
 */

import type { SourceSelectors } from './types';

export const GENERIC_SELECTORS: SourceSelectors = {
  title: ['h1', '.title', '[class*="title"]'],
  altTitles: [
    '[class*="alt-title"]',
    '[class*="alternative"]',
    '[class*="native"]',
  ],
  author: ['[class*="author"]', '[class*="writer"]', '[class*="creator"]'],
  artist: ['[class*="artist"]', '[class*="illustrator"]'],
  status: ['[class*="status"]'],
  genres: ['[class*="genre"]', '.tag', '.category'],
  summary: [
    '[class*="synopsis"]',
    '[class*="summary"]',
    '[class*="description"]',
  ],
  volumeCount: ['[class*="volume"]'],
  chapterCount: ['[class*="chapter"]'],
  publisher: ['[class*="publisher"]'],
  magazine: ['[class*="magazine"]', '[class*="serialization"]'],
  demographic: ['[class*="demographic"]'],
  releaseDate: ['[class*="date"]', '[class*="release"]'],
  themes: ['[class*="theme"]'],
  tags: ['[class*="tag"]', '.tag'],
  format: ['[class*="format"]', '[class*="type"]'],
  characters: ['[class*="character"]'],
  coverImage: ['[class*="cover"] img', '.main-image img', '.poster img'],
  infoboxContainer: [
    '.infobox',
    '[class*="sidebar"]',
    '[class*="info-box"]',
  ],
  chapterTable: ['table[class*="chapter"]', '.chapter-list table'],
  volumeTable: ['table[class*="volume"]', '.volume-list table'],
};
