/**
 * Wikipedia Infobox Metadata Rules
 *
 * Rules for labeling series-level metadata from Wikipedia infobox rows:
 * author, artist, publisher, magazine, genre, demographic, start/end date,
 * status, alt title, volume count, and chapter count.
 *
 * Uses `isInfoboxData()` to detect `.infobox-data` cells and `matchesLabelPattern()`
 * to match the label text in the preceding `.infobox-label` row.
 *
 * @module ml/training/bootstrap-labeler/source-rules/wikipedia-rules/wikipedia-infobox-metadata-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { findSpanEnd, hasAncestorClassPattern } from '../types';

import {
  LABEL_PATTERNS,
  findInfoboxDataEnd,
  isInfoboxData,
  isInfoboxLabel,
  matchesLabelPattern,
} from './wikipedia-helpers';

import type { SourceRule, SourceRuleContext } from '../types';

// ============================================================================
// Wikipedia Infobox Metadata Rules
// ============================================================================

export const WIKIPEDIA_INFOBOX_METADATA_RULES: SourceRule[] = [
  // -------------------------------------------------------------------------
  // Author
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-author',
    entityType: 'AUTHOR',
    confidence: 0.85,
    priority: 85,
    description: 'Author from Wikipedia infobox (Written by / Author / Created by)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.author)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('AUTHOR')) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Artist
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-artist',
    entityType: 'ARTIST',
    confidence: 0.85,
    priority: 85,
    description: 'Artist from Wikipedia infobox (Illustrated by / Artist)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.artist)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('ARTIST')) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Publisher (Japanese — "Published by" row, excludes "English publisher")
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-publisher',
    entityType: 'PUBLISHER',
    confidence: 0.85,
    priority: 80,
    description: 'Japanese publisher from Wikipedia infobox (Published by)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.publisher)) return false;
      // Exclude "English publisher" rows — handled by ENGLISH_PUBLISHER rule
      const label = (token.nearestLabelText ?? '').toLowerCase();
      if (label.includes('english')) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('PUBLISHER')) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // English Publisher ("English publisher" row — skips region codes like "NA")
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-english-publisher',
    entityType: 'ENGLISH_PUBLISHER',
    confidence: 0.85,
    priority: 79,
    description: 'English publisher from Wikipedia infobox (Kodansha USA, Viz Media, etc.)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.englishPublisher)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 8) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('ENGLISH_PUBLISHER')) return false;
      // Skip region codes (NA, JP, EU, etc.) and colons
      const text = token.text.trim();
      if (/^(NA|JP|EU|UK|AU|SEA):?$/i.test(text)) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Magazine
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-magazine',
    entityType: 'MAGAZINE',
    confidence: 0.85,
    priority: 80,
    description: 'Magazine from Wikipedia infobox (Magazine / Serialized in)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.magazine)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('MAGAZINE')) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Magazine-specific: stop at "(" to avoid capturing date ranges like "(April 13 – October 5, 2005)"
      return findSpanEnd(ctx.tokens, index, 6, (t) =>
        isInfoboxLabel(t) || t.text.endsWith(':') || t.isHeader || t.isTableHeader || t.text.trim() === '('
      );
    },
  },

  // -------------------------------------------------------------------------
  // Genre (multi-value — no matchedEntities check)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-genre',
    entityType: 'GENRE',
    confidence: 0.85,
    priority: 75,
    description: 'Genre(s) from Wikipedia infobox (multi-value, one span per genre)',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Use isInInfobox instead of isInfoboxData — Wikipedia continuation rows
      // in rowspan'd labels don't always repeat the infobox-data class
      if (!token.isInInfobox) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.genre)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 15) return false;
      if (token.text.trim().endsWith(':')) return false;
      // Skip separator tokens, table headers, and sub-header text
      if (/^[,·•;]$/.test(token.text.trim())) return false;
      if (token.isTableHeader) return false;
      // Skip infobox section headers (e.g., "Manga", "Anime", "Light novel")
      // These use <td class="infobox-header"> or other non-<th> elements
      if (hasAncestorClassPattern(token, ['infobox-header', 'infobox-above', 'infobox-full-data'])) return false;
      // Text-based fallback: common Wikipedia infobox category sub-headers
      const lowerText = token.text.trim().toLowerCase();
      const sectionHeaders = [
        'manga', 'anime', 'light novel', 'film', 'films', 'ova', 'ona',
        'television series', 'tv series', 'drama cd', 'live-action',
        'stage play', 'video game', 'video games', 'musical',
      ];
      if (sectionHeaders.includes(lowerText)) return false;
      // No matchedEntities check — genre is multi-value
      return true;
    },
    // Single-token span — each genre is its own span (Adventure, Epic, Historical)
  },

  // -------------------------------------------------------------------------
  // Demographic
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-demographic',
    entityType: 'DEMOGRAPHIC',
    confidence: 0.85,
    priority: 80,
    description: 'Demographic from Wikipedia infobox (Demographic / Target audience)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.demographic)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('DEMOGRAPHIC')) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Start Date (first date in "Original run" range)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-start-date',
    entityType: 'START_DATE',
    confidence: 0.85,
    priority: 83,
    description: 'Serialization start date from Wikipedia infobox (first date in "Original run")',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Use isInInfobox (not isInfoboxData) — some Wikipedia layouts don't repeat infobox-data class
      if (!token.isInInfobox) return false;
      if (!matchesLabelPattern(token, [...LABEL_PATTERNS.originalRun, ...LABEL_PATTERNS.releaseDate])) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 10) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('START_DATE')) return false;
      // Must be date-like (month name or digit)
      const text = token.text.trim();
      if (!/^(January|February|March|April|May|June|July|August|September|October|November|December|\d)/i.test(text)) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      // Stop at dash separator (–, —, -) which divides start and end dates
      findSpanEnd(ctx.tokens, index, 10, (t) => {
        const text = t.text.trim();
        return text === '–' || text === '—' || text === '-' ||
          isInfoboxLabel(t) || t.isHeader || t.isTableHeader;
      }),
  },

  // -------------------------------------------------------------------------
  // End Date (second date in "Original run" range, after dash separator)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-end-date',
    entityType: 'END_DATE',
    confidence: 0.85,
    priority: 82,
    description: 'Serialization end date from Wikipedia infobox (after "–" in "Original run")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (!matchesLabelPattern(token, [...LABEL_PATTERNS.originalRun, ...LABEL_PATTERNS.releaseDate])) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('END_DATE')) return false;
      // Must be date-like or "present"
      const text = token.text.trim();
      const isDateOrPresent = /^(January|February|March|April|May|June|July|August|September|October|November|December|\d|present)/i.test(text);
      if (!isDateOrPresent) return false;
      // Must be AFTER a dash separator — scan backward to find "–", "—", or "-"
      for (let i = index - 1; i >= Math.max(0, index - 15); i--) {
        const prev = ctx.tokens[i];
        if (!prev) continue;
        const prevText = prev.text.trim();
        if (prevText === '–' || prevText === '—' || prevText === '-') return true;
        if (isInfoboxLabel(prev) || prev.isHeader) break;
      }
      return false;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-status',
    entityType: 'STATUS',
    confidence: 0.85,
    priority: 78,
    description: 'Status from Wikipedia infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.status)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('STATUS')) return false;
      return true;
    },
    // Status is typically a single token (e.g., "Ongoing", "Completed")
  },

  // -------------------------------------------------------------------------
  // Alt Title (Japanese / Romaji / Native name)
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-alt-title',
    entityType: 'ALT_TITLE',
    confidence: 0.8,
    priority: 78,
    description: 'Alt title from Wikipedia infobox (Japanese / Romaji / Native name)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.altTitle)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('ALT_TITLE')) return false;
      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findInfoboxDataEnd(token, index, ctx),
  },

  // -------------------------------------------------------------------------
  // Volume Count
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-volume-count',
    entityType: 'VOLUME_COUNT',
    confidence: 0.85,
    priority: 80,
    description: 'Volume count from Wikipedia infobox (Volumes / No. of volumes)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.volumes)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('VOLUME_COUNT')) return false;
      // Must be numeric
      if (!/^\d+$/.test(token.text.trim())) return false;
      return true;
    },
    // Single token span — just the number
  },

  // -------------------------------------------------------------------------
  // Chapter Count
  // -------------------------------------------------------------------------
  {
    id: 'wikipedia-infobox-chapter-count',
    entityType: 'CHAPTER_COUNT',
    confidence: 0.85,
    priority: 80,
    description: 'Chapter count from Wikipedia infobox (Chapters / No. of chapters)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isInfoboxData(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.chapters)) return false;
      if (token.distanceFromLabel < 0 || token.distanceFromLabel > 5) return false;
      if (token.text.trim().endsWith(':')) return false;
      if (ctx.matchedEntities.has('CHAPTER_COUNT')) return false;
      // Must be numeric
      if (!/^\d+$/.test(token.text.trim())) return false;
      return true;
    },
    // Single token span — just the number
  },
];
