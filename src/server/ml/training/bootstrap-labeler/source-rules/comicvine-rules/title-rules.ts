/**
 * ComicVine Title Rules
 *
 * Rules for detecting titles on ComicVine pages.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/title-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findSpanEnd,
  hasClassPattern,
  isComicVineIssuePage,
  isLabelableComicVinePage,
  TITLE_CLASSES,
} from './helpers';

import type { SourceRule, SourceRuleContext } from '../types';

/**
 * Title span stop condition for ComicVine.
 * On ComicVine, the H1 title tokens ("Vinland", "Saga") are ALL marked isHeader with headerLevel=1.
 * We must NOT stop at sibling H1 tokens — only stop at delimiters like `»` or when leaving the header area.
 */
function isTitleSpanBoundary(t: LinearizedToken): boolean {
  // Stop at breadcrumb/navigation delimiters
  if (/^[»×→←•]$/.test(t.text)) return true;
  // Stop at colon-terminated text (new label)
  if (t.text.endsWith(':')) return true;
  // Stop when leaving the header area entirely (non-header token)
  if (!t.isHeader) return true;
  return false;
}


// ============================================================================
// Title Rules
// ============================================================================

export const TITLE_RULES: SourceRule[] = [
  // ---------------------------------------------------------------------------
  // TITLE rules (volume/series pages only — skip issue pages)
  // ---------------------------------------------------------------------------

  // Highest priority: page header title (ComicVine titles live in 'sidebar' sectionType
  // because the profile-header area is detected as sidebar by the linearizer)
  {
    id: 'comicvine-page-header-title',
    entityType: 'TITLE',
    confidence: 0.95,
    priority: 98,
    description: 'ComicVine page title from profile/page header area',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isComicVineIssuePage(ctx.url) &&
      token.isHeader &&
      token.headerLevel === 1 &&
      index < 30 &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, isTitleSpanBoundary),
  },

  {
    id: 'comicvine-wiki-title',
    entityType: 'TITLE',
    confidence: 0.95,
    priority: 100,
    description: 'ComicVine wiki title (.wiki-title, .page-title)',
    classPatterns: TITLE_CLASSES,
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isComicVineIssuePage(ctx.url) &&
      hasClassPattern(token, TITLE_CLASSES) &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, isTitleSpanBoundary),
  },

  {
    id: 'comicvine-h1-title',
    entityType: 'TITLE',
    confidence: 0.9,
    priority: 95,
    description: 'ComicVine H1 page title',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isComicVineIssuePage(ctx.url) &&
      token.isHeader &&
      token.headerLevel === 1 &&
      index < 50 &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 8, isTitleSpanBoundary),
  },

  // ---------------------------------------------------------------------------
  // VOLUME_TITLE rules (issue pages only)
  // On issue pages, the H1/wiki-title is the volume title, not the series title
  // ---------------------------------------------------------------------------

  {
    id: 'comicvine-issue-volume-title-header',
    entityType: 'VOLUME_TITLE',
    confidence: 0.95,
    priority: 98,
    description: 'Volume title on ComicVine issue pages (from page header)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isComicVineIssuePage(ctx.url) &&
      token.isHeader &&
      token.headerLevel === 1 &&
      index < 30 &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('VOLUME_TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, isTitleSpanBoundary),
  },

  {
    id: 'comicvine-issue-volume-title-wiki',
    entityType: 'VOLUME_TITLE',
    confidence: 0.95,
    priority: 100,
    description: 'Volume title on ComicVine issue pages (.wiki-title, .page-title)',
    classPatterns: TITLE_CLASSES,
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isComicVineIssuePage(ctx.url) &&
      // Must be an actual header element (excludes breadcrumb links with title classes)
      token.isHeader &&
      hasClassPattern(token, TITLE_CLASSES) &&
      index < 30 &&
      token.text.trim().length > 2 &&
      !ctx.matchedEntities.has('VOLUME_TITLE'),
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, isTitleSpanBoundary),
  },
];
