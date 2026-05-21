/**
 * Wikipedia Volume Metadata Rules
 *
 * Rules for labeling volume table metadata: volume number, release dates (JP & EN),
 * and ISBNs (JP & EN) in Wikipedia manga volume tables.
 *
 * @module ml/training/bootstrap-labeler/source-rules/wikipedia-rules/wikipedia-volume-metadata-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  ISBN_START_PATTERN,
  MONTH_PATTERN,
  isFirstPatternInMetadataRow,
  isInVolumeMetadataRow,
  isUnderVolumeOrChapterHeader,
} from './wikipedia-helpers';

import type { SourceRule, SourceRuleContext } from '../types';

// ============================================================================
// Volume Metadata Rules — number, dates, ISBNs (JP then EN)
// ============================================================================

export const WIKIPEDIA_VOLUME_METADATA_RULES: SourceRule[] = [
  {
    id: 'wikipedia-volume-number',
    entityType: 'VOLUME_NUMBER',
    confidence: 0.9,
    priority: 74,
    description: 'Volume number in <th> cell of Wikipedia volume table',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isTableHeader) return false;
      const text = token.text.trim();
      // Pure number 1-99 (volume numbers)
      if (!/^[1-9]\d?$/.test(text)) return false;
      // Must be under a Volumes/Chapters section header
      if (!isUnderVolumeOrChapterHeader(ctx.tokens, index)) return false;
      // Reject header-row labels like "No." — check if next token is also a <th>
      const nextToken = ctx.tokens[index + 1];
      if (nextToken?.isTableHeader && /^[a-zA-Z]/.test(nextToken.text.trim())) return false;
      return true;
    },
    // Single token span — just the number itself
  },

  {
    id: 'wikipedia-jp-release-date',
    entityType: 'VOLUME_RELEASE_DATE',
    confidence: 0.85,
    priority: 73,
    description: 'Japanese release date in Wikipedia volume table (first date column)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!MONTH_PATTERN.test(token.text.trim())) return false;
      if (!isInVolumeMetadataRow(token, index, ctx.tokens)) return false;
      return isFirstPatternInMetadataRow(index, ctx.tokens, MONTH_PATTERN);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 8, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        if (t.tableCol !== ctx.tokens[index]?.tableCol) break;
        const text = t.text.trim();
        if (/^\d{1,2},?$/.test(text) || /^\d{4}$/.test(text) || text === ',') {
          endIndex = i;
          continue;
        }
        break;
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-jp-isbn',
    entityType: 'ISBN',
    confidence: 0.85,
    priority: 73,
    description: 'Japanese ISBN in Wikipedia volume table (first ISBN column)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!ISBN_START_PATTERN.test(token.text.trim())) return false;
      if (!isInVolumeMetadataRow(token, index, ctx.tokens)) return false;
      return isFirstPatternInMetadataRow(index, ctx.tokens, ISBN_START_PATTERN);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      const startCol = ctx.tokens[index]?.tableCol;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.tableCol !== startCol) break;
        if (/^[\d\-X]+$/.test(t.text)) {
          endIndex = i;
          continue;
        }
        break;
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-en-release-date',
    entityType: 'ENGLISH_RELEASE_DATE',
    confidence: 0.85,
    priority: 72,
    description: 'English release date in Wikipedia volume table (second date column)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!MONTH_PATTERN.test(token.text.trim())) return false;
      if (!isInVolumeMetadataRow(token, index, ctx.tokens)) return false;
      return !isFirstPatternInMetadataRow(index, ctx.tokens, MONTH_PATTERN);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 8, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t || t.isHeader) break;
        if (t.tableCol !== ctx.tokens[index]?.tableCol) break;
        const text = t.text.trim();
        if (/^\d{1,2},?$/.test(text) || /^\d{4}$/.test(text) || text === ',') {
          endIndex = i;
          continue;
        }
        break;
      }
      return endIndex;
    },
  },

  {
    id: 'wikipedia-en-isbn',
    entityType: 'ENGLISH_ISBN',
    confidence: 0.85,
    priority: 72,
    description: 'English ISBN in Wikipedia volume table (second ISBN column)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!ISBN_START_PATTERN.test(token.text.trim())) return false;
      if (!isInVolumeMetadataRow(token, index, ctx.tokens)) return false;
      return !isFirstPatternInMetadataRow(index, ctx.tokens, ISBN_START_PATTERN);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      const startCol = ctx.tokens[index]?.tableCol;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.tableCol !== startCol) break;
        if (/^[\d\-X]+$/.test(t.text)) {
          endIndex = i;
          continue;
        }
        break;
      }
      return endIndex;
    },
  },
];
