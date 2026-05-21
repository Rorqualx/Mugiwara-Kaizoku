/**
 * ComicVine Content Rules
 *
 * Rules for detecting summaries, chapters, and characters.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/content-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findComicVineChapterUrlSpanEnd,
  findSpanEnd,
  isComicVineVolumePage,
  isInIssueGridSection,
  isInNonContentSection,
  isLabelableComicVinePage,
  isMetadataSpanBoundary,
  MONTH_NAMES,
} from './helpers';

import type { SourceRule, SourceRuleContext } from '../types';

/** Check if a token is a month name followed by a year (for issue grid dates) */
function isMonthToken(token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean {
  if (!MONTH_NAMES.has(token.text.toLowerCase())) return false;
  // Must be followed by a year-like number
  const next = ctx.tokens[index + 1];
  return next?.matchesDatePattern === true || /^\d{4}$/.test(next?.text ?? '');
}


// ============================================================================
// Content Rules
// ============================================================================

export const CONTENT_RULES: SourceRule[] = [
  // NOTE: Characters rule removed - CHARACTERS entity type is no longer used

  // Series Summary
  {
    id: 'comicvine-series-summary',
    entityType: 'SERIES_SUMMARY',
    confidence: 0.85,
    priority: 75,
    description: 'Series summary/description text on ComicVine volume pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineVolumePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (token.isHeader || token.isInList || token.isImage) return false;
      if (index < 50 || index > 400) return false;
      if (ctx.matchedEntities.has('SERIES_SUMMARY')) return false;
      // Exclude navigation and section words that can appear near content
      const navWords = [
        'All', 'Wiki', 'Arcs', 'Characters', 'Companies', 'Concepts', 'Issues',
        'Movies', 'Teams', 'Vol.', 'View', 'Read', 'More', 'See', 'Show', 'Hide',
        'Edit', 'Media', 'Size', 'Format', 'Objects', 'Locations', 'Volumes',
        'least', 'aficionado', // Common false positives from navigation context
      ];
      if (navWords.includes(token.text)) return false;
      // Also exclude if it looks like a navigation link
      if (token.isLink && /^\/(concepts|characters|locations|teams|objects)\//.test(token.linkHref ?? '')) return false;
      return /^[A-Z][a-z]+$/.test(token.text) && token.text.length >= 4;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 150, (t) => t.isHeader || t.isInList || isMetadataSpanBoundary(t)),
  },

  // Chapter List Item — span stops at period/colon to capture just the number
  {
    id: 'comicvine-chapter-list-item',
    entityType: 'CHAPTER_NUMBER',
    confidence: 0.85,
    priority: 80,
    description: 'Chapter number on ComicVine (e.g., "Chapter 001")',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isInList &&
      token.text === 'Chapter',
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let end = index;
      for (let i = index + 1; i < Math.min(index + 5, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === '.' || t.text === ':') break;
        if (t.isHeader) break;
        if ((t.text === 'Chapter' || t.text === 'Special' || t.text === 'Extra') && t.isInList) break;
        end = i;
      }
      return end;
    },
  },

  // Chapter URL
  {
    id: 'comicvine-chapter-url',
    entityType: 'CHAPTER_URL',
    confidence: 0.9,
    priority: 84,
    description: 'Extract URL from linked chapter titles',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isLabelableComicVinePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (token.text !== 'Chapter') return false;
      const nextToken = ctx.tokens[index + 1];
      if (!nextToken) return false;
      const isNumeric = /^\d+-?$/.test(nextToken.text);
      if (!isNumeric) return false;
      for (let i = index; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if ((t.text === 'Chapter' || t.text === 'Special' || t.text === 'Extra') && i > index) break;
        if (t.isHeader) break;
        if (t.isLink && t.linkHref) return true;
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findComicVineChapterUrlSpanEnd(ctx.tokens, index, 15),
  },

  // Special Feature Item — span stops at period/colon for consistency
  {
    id: 'comicvine-special-feature-item',
    entityType: 'CHAPTER_NUMBER',
    confidence: 0.8,
    priority: 78,
    description: 'Special/Extra chapter identifiers on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isInList &&
      /^(Special|Extra)\.?$/.test(token.text),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let end = index;
      for (let i = index + 1; i < Math.min(index + 20, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === '.' || t.text === ':') break;
        if (t.isHeader) break;
        if (/^(Chapter|Special|Extra)/i.test(t.text)) break;
        // Stop at quoted text (chapter title starts)
        if (/^["\u201c\u201d']/.test(t.text)) break;
        if (['Read', 'View', 'More', 'See'].includes(t.text)) break;
        end = i;
      }
      return end;
    },
  },

  // Chapter title text after chapter number or "Extra" label
  {
    id: 'comicvine-chapter-name',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 77,
    description: 'Chapter title text after chapter number on ComicVine',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isLabelableComicVinePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (!token.isInList) return false;
      // Match quoted text (starts with ", \u201c, or ')
      if (!/^["\u201c\u201d']/.test(token.text)) return false;
      // Must follow a chapter number or "Extra"/"Extra." within recent tokens
      const lookbackStart = Math.max(0, index - 5);
      const recent = ctx.tokens.slice(lookbackStart, index);
      return recent.some(t => /^\d{1,4}$/.test(t.text) || /^Extra\.?$/.test(t.text));
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let end = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.isHeader) break;
        // Stop at chapter/special/extra boundaries (handles "Extra.", "Extra", etc.)
        if (/^(Chapter|Special|Extra)/i.test(t.text)) break;
        if (['Read', 'View', 'More', 'See'].includes(t.text)) break;
        end = i;
        // Stop after closing quote — the title is complete
        if (/["\u201d']$/.test(t.text)) break;
      }
      return end;
    },
  },

  // ---------------------------------------------------------------------------
  // Issue Grid Rules (volume pages — "N issues in this volume" section)
  // ---------------------------------------------------------------------------

  // Issue cover images in the grid
  {
    id: 'comicvine-issue-grid-cover',
    entityType: 'VOLUME_COVER',
    confidence: 0.8,
    priority: 70,
    description: 'Issue cover image in ComicVine volume issue grid',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineVolumePage(ctx.url)) return false;
      if (!token.isImage || token.imageSrc === null) return false;
      if (!isInIssueGridSection(token, index, ctx)) return false;
      // Must be followed by "Issue" within the next 2 tokens (grid pattern: [IMAGE] Issue #N)
      const next1 = ctx.tokens[index + 1];
      const next2 = ctx.tokens[index + 2];
      return next1?.text === 'Issue' || next2?.text === 'Issue';
    },
  },

  // Issue number "#N" in the grid
  {
    id: 'comicvine-issue-grid-number',
    entityType: 'VOLUME_NUMBER',
    confidence: 0.85,
    priority: 72,
    description: 'Issue number (#N) in ComicVine volume issue grid',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineVolumePage(ctx.url)) return false;
      if (!/^#\d+$/.test(token.text)) return false;
      if (!isInIssueGridSection(token, index, ctx)) return false;
      // Must be preceded by "Issue" token
      const prev = ctx.tokens[index - 1];
      return prev?.text === 'Issue';
    },
    getSpanEnd: (_token: LinearizedToken, index: number, _ctx: SourceRuleContext): number => index,
  },

  // Issue subtitle/title in the grid (e.g., "Book Fourteen: Cultivating Wheat...")
  {
    id: 'comicvine-issue-grid-title',
    entityType: 'VOLUME_TITLE',
    confidence: 0.8,
    priority: 71,
    description: 'Issue title/subtitle in ComicVine volume issue grid',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineVolumePage(ctx.url)) return false;
      if (!isInIssueGridSection(token, index, ctx)) return false;
      if (token.isImage || token.isHeader) return false;
      // Must not be a date or month name
      if (token.matchesDatePattern) return false;
      if (isMonthToken(token, index, ctx)) return false;
      // Must not be "Issue" or a "#N" number
      if (token.text === 'Issue' || /^#\d+$/.test(token.text)) return false;
      // Must follow an "Issue #N" pattern within recent tokens
      const recentTokens = ctx.tokens.slice(Math.max(0, index - 5), index);
      const hasIssueNumber = recentTokens.some(t => /^#\d+$/.test(t.text));
      if (!hasIssueNumber) return false;
      // Text should be a meaningful title (starts with uppercase, not just a number)
      return /^[A-Z]/.test(token.text) && token.text.length > 2;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 20, (t) =>
        t.isImage || t.isHeader || t.text === 'Issue' || /^#\d+$/.test(t.text) ||
        t.matchesDatePattern || MONTH_NAMES.has(t.text.toLowerCase())
      ),
  },

  // Issue release date in the grid (e.g., "May 2025" — "May" is a separate token)
  {
    id: 'comicvine-issue-grid-release-date',
    entityType: 'VOLUME_RELEASE_DATE',
    confidence: 0.8,
    priority: 71,
    description: 'Issue release date in ComicVine volume issue grid',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineVolumePage(ctx.url)) return false;
      if (!isInIssueGridSection(token, index, ctx)) return false;
      // Match either a date-pattern token (like "2025") or a month name before a year
      if (!token.matchesDatePattern && !isMonthToken(token, index, ctx)) return false;
      // Must be preceded by an "Issue #N" pattern within recent tokens (confirms we're in an issue entry)
      // Use 12-token lookback: covers longest titles (~9 words) + #N + Issue + IMAGE
      const recentTokens = ctx.tokens.slice(Math.max(0, index - 12), index);
      return recentTokens.some(t => /^#\d+$/.test(t.text));
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 3, (t) =>
        !t.matchesDatePattern && !t.isNumeric && !MONTH_NAMES.has(t.text.toLowerCase()) &&
        !/^[/\-,]$/.test(t.text)
      ),
  },
];
