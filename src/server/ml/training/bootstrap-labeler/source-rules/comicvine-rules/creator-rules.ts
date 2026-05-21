/**
 * ComicVine Creator Rules
 *
 * Rules for detecting authors and artists from the Creators section.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/creator-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findCreatorNameSpanEnd,
  findValueEnd,
  isDetailSection,
  isExcludedCreatorRole,
  isInIssueCreditsSection,
  isInNonContentSection,
  isLabelableComicVinePage,
  isPrimaryWriterRole,
  isPrimaryArtistRole,
  isValueElement,
  LABEL_PATTERNS,
  matchesLabelPattern,
} from './helpers';

import type { SourceRule, SourceRuleContext } from '../types';


// ============================================================================
// Creator Rules
// ============================================================================

export const CREATOR_RULES: SourceRule[] = [
  // Traditional detail section rules (for infobox-style layouts)
  {
    id: 'comicvine-writer',
    entityType: 'AUTHOR',
    confidence: 0.9,
    priority: 85,
    description: 'Writer credit on ComicVine (detail section)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      !token.isHeader &&
      // Exclude "Most issue credits" section — those are aggregate stats, not series credits
      !isInIssueCreditsSection(index, ctx) &&
      (isDetailSection(token) || isValueElement(token)) &&
      matchesLabelPattern(token, LABEL_PATTERNS.author) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('AUTHOR'),
    getSpanEnd: findValueEnd,
  },

  {
    id: 'comicvine-artist',
    entityType: 'ARTIST',
    confidence: 0.9,
    priority: 85,
    description: 'Artist credit on ComicVine (detail section)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean =>
      isLabelableComicVinePage(ctx.url) &&
      !isInNonContentSection(token) &&
      !token.isHeader &&
      // Exclude "Most issue credits" section
      !isInIssueCreditsSection(index, ctx) &&
      (isDetailSection(token) || isValueElement(token)) &&
      matchesLabelPattern(token, LABEL_PATTERNS.artist) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('ARTIST'),
    getSpanEnd: findValueEnd,
  },

  // Creators section rules (for the grid-style Creators listing)
  {
    id: 'comicvine-creator-writer',
    entityType: 'AUTHOR',
    confidence: 0.9,
    priority: 86,
    description: 'Writer from Creators section on ComicVine',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isLabelableComicVinePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (!token.isLink) return false;
      if (token.isHeader || token.isImage) return false;
      // Exclude "Most issue credits" section — aggregate stats, not series credits
      if (isInIssueCreditsSection(index, ctx)) return false;
      const sectionHeaders = ['User reviews', 'Teams', 'Locations', 'Concepts', 'Objects', 'Story Arcs', 'Characters', 'Issues', 'Volumes'];
      if (sectionHeaders.includes(token.text)) return false;
      // Look for "Creators" section marker nearby (within 200 tokens)
      const recentTokens = ctx.tokens.slice(Math.max(0, index - 200), index);
      const hasCreatorsSection = recentTokens.some(t =>
        (t.isHeader && t.text === 'Creators') ||
        (t.text === 'Creators' && !t.isInList && !t.isInTable)
      );
      if (!hasCreatorsSection) return false;
      const followingTokens = ctx.tokens.slice(index + 1, index + 10);
      const roleText = followingTokens.map(t => t.text.toLowerCase()).join(' ');
      return isPrimaryWriterRole(roleText) && !isExcludedCreatorRole(roleText);
    },
    getSpanEnd: findCreatorNameSpanEnd,
  },

  {
    id: 'comicvine-creator-artist',
    entityType: 'ARTIST',
    confidence: 0.9,
    priority: 86,
    description: 'Artist from Creators section on ComicVine',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isLabelableComicVinePage(ctx.url)) return false;
      if (isInNonContentSection(token)) return false;
      if (!token.isLink) return false;
      if (token.isHeader || token.isImage) return false;
      // Exclude "Most issue credits" section
      if (isInIssueCreditsSection(index, ctx)) return false;
      const sectionHeaders = ['User reviews', 'Teams', 'Locations', 'Concepts', 'Objects', 'Story Arcs', 'Characters', 'Issues', 'Volumes'];
      if (sectionHeaders.includes(token.text)) return false;
      // Look for "Creators" section marker nearby (within 200 tokens)
      const recentTokens = ctx.tokens.slice(Math.max(0, index - 200), index);
      const hasCreatorsSection = recentTokens.some(t =>
        (t.isHeader && t.text === 'Creators') ||
        (t.text === 'Creators' && !t.isInList && !t.isInTable)
      );
      if (!hasCreatorsSection) return false;
      const followingTokens = ctx.tokens.slice(index + 1, index + 10);
      const roleText = followingTokens.map(t => t.text.toLowerCase()).join(' ');
      return isPrimaryArtistRole(roleText) && !isExcludedCreatorRole(roleText);
    },
    getSpanEnd: findCreatorNameSpanEnd,
  },
];
