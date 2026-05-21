/**
 * ComicVine Image Rules
 *
 * Rules for detecting cover images on ComicVine pages.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/image-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  hasClassPattern,
  IMAGE_CLASSES,
  isInNonContentSection,
  isLabelableComicVinePage,
  isLargeImage,
} from './helpers';

import type { SourceRule, SourceRuleContext } from '../types';


// ============================================================================
// Image Rules
// ============================================================================

export const IMAGE_RULES: SourceRule[] = [
  {
    id: 'comicvine-main-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.9,
    priority: 95,
    description: 'ComicVine main/box art image',
    classPatterns: IMAGE_CLASSES,
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isImage &&
      hasClassPattern(token, IMAGE_CLASSES) &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },

  {
    id: 'comicvine-first-large-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.85,
    priority: 90,
    description: 'First large image on ComicVine page',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isImage &&
      isLargeImage(token) &&
      index < 100 &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },

  {
    id: 'comicvine-large-cover-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.9,
    priority: 93,
    description: 'Large cover image on ComicVine (scale_large only — main sidebar cover)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isImage &&
      token.imageSrc !== null &&
      token.imageSrc.includes('scale_large') &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },

  {
    id: 'comicvine-any-early-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.75,
    priority: 80,
    description: 'First substantial image on ComicVine page (fallback)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      token.isImage &&
      token.imageSrc !== null &&
      token.imageSrc.includes('comicvine') &&
      index < 150 &&
      !ctx.matchedEntities.has('COVER_IMAGE'),
  },
];
