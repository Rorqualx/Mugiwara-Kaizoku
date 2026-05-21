/**
 * ComicVine Metadata Rules
 *
 * Rules for detecting publisher, status, genre, format, release date, and volume info.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/metadata-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findSpanEnd,
  findValueEnd,
  getLabelText,
  isComicVineIssuePage,
  isComicVineVolumePage,
  isDetailSection,
  isInEditorialMetadataContext,
  isInIssueGridSection,
  isInNonContentSection,
  isLabelableComicVinePage,
  isLabelElement,
  isMetadataSpanBoundary,
  isValueElement,
  LABEL_PATTERNS,
  matchesLabelPattern,
  MONTH_NAMES,
} from './helpers';

import type { SourceRule, SourceRuleContext } from '../types';


// ============================================================================
// Constants
// ============================================================================

/** ComicVine resource type labels that should NOT be labeled as FORMAT */
const COMICVINE_RESOURCE_TYPES = /^(volume|issue|series|character|person|team)$/i;

// ============================================================================
// Metadata Rules
// ============================================================================

export const METADATA_RULES: SourceRule[] = [
  // ---------------------------------------------------------------------------
  // Volume-level metadata (series pages only)
  // ---------------------------------------------------------------------------

  // Publisher
  {
    id: 'comicvine-publisher',
    entityType: 'PUBLISHER',
    confidence: 0.9,
    priority: 85,
    description: 'Publisher on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isComicVineVolumePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      matchesLabelPattern(token, LABEL_PATTERNS.publisher) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('PUBLISHER'),
    getSpanEnd: findValueEnd,
  },

  // Status
  {
    id: 'comicvine-status',
    entityType: 'STATUS',
    confidence: 0.85,
    priority: 80,
    description: 'Status on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isComicVineVolumePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      matchesLabelPattern(token, LABEL_PATTERNS.status) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('STATUS'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 3, (t) => isLabelElement(t)),
  },

  // Volume Count
  {
    id: 'comicvine-volumes',
    entityType: 'VOLUME_COUNT',
    confidence: 0.85,
    priority: 80,
    description: 'Volume/Issue count on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isComicVineVolumePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      token.isNumeric &&
      matchesLabelPattern(token, LABEL_PATTERNS.volumes) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('VOLUME_COUNT'),
  },

  // Chapter/Issue Count
  {
    id: 'comicvine-issues',
    entityType: 'CHAPTER_COUNT',
    confidence: 0.85,
    priority: 80,
    description: 'Issue count on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isComicVineVolumePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      token.isNumeric &&
      matchesLabelPattern(token, LABEL_PATTERNS.chapters) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('CHAPTER_COUNT'),
  },

  // Genre
  {
    id: 'comicvine-genre',
    entityType: 'GENRE',
    confidence: 0.8,
    priority: 75,
    description: 'Genres on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      matchesLabelPattern(token, LABEL_PATTERNS.genre) &&
      token.distanceFromLabel <= 5,
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 15, (t) => isLabelElement(t) || t.isHeader),
  },

  // Themes
  {
    id: 'comicvine-themes',
    entityType: 'THEMES',
    confidence: 0.8,
    priority: 75,
    description: 'Themes on ComicVine (Volume details table)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token) || token.isInTable) &&
      matchesLabelPattern(token, LABEL_PATTERNS.themes) &&
      token.distanceFromLabel >= 1 &&
      token.distanceFromLabel <= 5,
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 15, (t) =>
        isLabelElement(t) || t.isHeader || isMetadataSpanBoundary(t) ||
        /^(Volume|Name|Publisher|Year|Aliases|Format)$/i.test(t.text)
      ),
  },

  // Format
  {
    id: 'comicvine-format',
    entityType: 'FORMAT',
    confidence: 0.85,
    priority: 75,
    description: 'Format/Type on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      (isDetailSection(token) || isValueElement(token)) &&
      // Exclude ComicVine resource type labels (VOLUME, Issue, Series breadcrumbs)
      !COMICVINE_RESOURCE_TYPES.test(token.text.trim()) &&
      matchesLabelPattern(token, LABEL_PATTERNS.format) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('FORMAT'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 3, (t) => isLabelElement(t)),
  },

  // Release Date — only from sidebar/detail table, not from issue grid
  {
    id: 'comicvine-release-date',
    entityType: 'RELEASE_DATE',
    confidence: 0.8,
    priority: 75,
    description: 'Start year/release date on ComicVine (sidebar/detail table only)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      !isInEditorialMetadataContext(token, index, ctx) &&
      // Must be in detail section or table — excludes issue grid dates
      (isDetailSection(token) || isValueElement(token) || token.isInTable) &&
      // Exclude issue grid dates (grid dates are NOT in tables, so isInTable bypasses this check)
      (token.isInTable || !isInIssueGridSection(token, index, ctx)) &&
      (token.matchesDatePattern || token.isNumeric || MONTH_NAMES.has(token.text.toLowerCase())) &&
      matchesLabelPattern(token, LABEL_PATTERNS.releaseDate) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('RELEASE_DATE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 5, (t) =>
        isLabelElement(t) || (t.text.length > 0 && !t.matchesDatePattern && !t.isNumeric &&
          !MONTH_NAMES.has(t.text.toLowerCase()) && !/^[/\-,]$/.test(t.text))
      ),
  },

  // Alt Title/Aliases — value after the "Aliases" label (not the label itself)
  {
    id: 'comicvine-aliases',
    entityType: 'ALT_TITLE',
    confidence: 0.8,
    priority: 70,
    description: 'Aliases/alternate names on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isLabelableComicVinePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.altTitle)) return false;
      // Must be the value AFTER the label, not the label itself
      if (token.distanceFromLabel < 1 || token.distanceFromLabel > 3) return false;
      if (token.text.trim().length <= 2) return false;
      // Exclude section headers that follow the "Aliases" label when field is empty
      // (e.g., "Most issue credits" appears right after empty Aliases field)
      if (/^(most|credits?|issue|appearances?)$/i.test(token.text)) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 8, (t) =>
        isLabelElement(t) || t.text.endsWith(':') || t.isHeader ||
        t.isImage || /^(most|credits?)$/i.test(t.text)
      ),
  },

  // ---------------------------------------------------------------------------
  // Issue-level metadata (issue pages only)
  // ---------------------------------------------------------------------------

  // Volume Number from Issue details
  {
    id: 'comicvine-issue-number',
    entityType: 'VOLUME_NUMBER',
    confidence: 0.9,
    priority: 85,
    description: 'Issue/Volume number on ComicVine (from Issue details)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineIssuePage(ctx.url) && !isComicVineVolumePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (isInEditorialMetadataContext(token, index, ctx)) return false;
      if (!token.isNumeric && !/^(vol\.?\s*)?\d+$/i.test(token.text)) return false;
      const labelText = getLabelText(token);

      if (isComicVineIssuePage(ctx.url)) {
        // Issue pages: only match "Issue Number" label in the details table
        // Avoids false positives from breadcrumbs ("Volume") and "Name: Volume 1"
        const issueLabels = ['issue number', 'issue #', 'issue no'];
        if (!issueLabels.some(l => labelText.includes(l))) return false;
        if (!token.isInTable) return false;
      } else {
        // Volume pages: broader matching includes vol/vol. labels
        const volumeLabels = ['issue number', 'issue #', 'issue no', 'vol', 'vol.'];
        if (!volumeLabels.some(l => labelText.includes(l))) return false;
      }

      return token.distanceFromLabel <= 3;
    },
  },

  // Volume name from "Name" field in Issue details table (e.g., "Volume 1")
  {
    id: 'comicvine-issue-belongs-to-volume',
    entityType: 'CHAPTER_BELONGS_TO_VOLUME',
    confidence: 0.9,
    priority: 84,
    description: 'Volume name from Name field in Issue details table on ComicVine',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      if (!isComicVineIssuePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (!token.isInTable) return false;
      if (ctx.matchedEntities.has('CHAPTER_BELONGS_TO_VOLUME')) return false;
      // Match "Volume" text in the Name row of the issue details table
      const labelText = getLabelText(token);
      if (!labelText.includes('name')) return false;
      return token.text === 'Volume';
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let end = index;
      for (let i = index + 1; i < Math.min(index + 3, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (isLabelElement(t) || t.text.endsWith(':') || t.isHeader) break;
        // Stop at description text (e.g., "Name of this issue.")
        if (t.text === 'Name' || t.text === 'of') break;
        end = i;
      }
      return end;
    },
  },
];
