/**
 * Annotation Router - Tokenization Procedures
 *
 * On-demand tokenization for deferred tokenization architecture.
 * Pages are stored with HTML only at ingestion, tokenized on first view or export.
 */

import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { cleanHtmlForTokenization, shouldCleanForTokenization } from '@/server/ml/training/bootstrap-labeler/html-cleaner';
import { settingsProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import { getBootstrapLabels, calculateEntityCountsFromLabels, getSuggestionGenerator } from './helpers';

// ============================================================================
// Schemas
// ============================================================================

const tokenizePageInputSchema = z.object({
  pageId: z.string(),
  force: z.boolean().optional().default(false),
});

const tokenizeBatchInputSchema = z.object({
  pageIds: z.array(z.string()).max(50),
  force: z.boolean().optional().default(false),
});

// ============================================================================
// Helper Types
// ============================================================================

interface TokenizationResult {
  pageId: string;
  tokenCount: number;
  labelCount: number;
  confidence: number;
  wasAlreadyTokenized: boolean;
}

interface PageForTokenization {
  id: string;
  url: string;
  htmlSnapshot: string | null;
  tokens: unknown;
  labels: unknown;
  version: number;
}

// ============================================================================
// Core Tokenization Logic - Split into smaller functions
// ============================================================================

/** Fetch page data needed for tokenization */
async function fetchPageForTokenization(pageId: string): Promise<PageForTokenization> {
  const page = await prisma.annotatedPage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      url: true,
      htmlSnapshot: true,
      tokens: true,
      labels: true,
      version: true,
    },
  });

  if (!page) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Page not found: ${pageId}`,
    });
  }

  return page;
}

/** Check if page is already tokenized */
function isPageTokenized(page: PageForTokenization): boolean {
  const tokens = page.tokens as unknown[];
  return Array.isArray(tokens) && tokens.length > 0;
}

/** Run bootstrap labeler on HTML */
async function runTokenization(
  htmlSnapshot: string,
  url: string,
  pageId: string
): Promise<{ tokens: unknown[]; labels: string[]; confidence: number }> {
  logger.info('Tokenizing page on-demand', { pageId, url, htmlLength: htmlSnapshot.length });

  try {
    // Clean HTML to match client-side cleaned HTML structure
    // This ensures XPaths captured from user selections match token XPaths
    // Applies all normalizations: whitespace, Unicode, entities, empty elements,
    // nested formatting, URLs, comments, and volatile attributes
    let processedHtml = htmlSnapshot;
    if (shouldCleanForTokenization(url)) {
      const cleanResult = cleanHtmlForTokenization(htmlSnapshot, url);
      processedHtml = cleanResult.html;
      logger.debug('Cleaned HTML for tokenization', {
        pageId,
        sourceType: cleanResult.sourceType,
        removedCount: cleanResult.removedCount,
        normalizedCount: cleanResult.normalizedCount,
        originalSize: htmlSnapshot.length,
        cleanedSize: cleanResult.html.length,
      });
    }

    const bootstrapLabels = await getBootstrapLabels();
    const result = bootstrapLabels(processedHtml, url);

    logger.info('Tokenization complete', {
      pageId,
      tokenCount: result.tokens.length,
      labelCount: result.labels.length,
      confidence: result.confidence,
    });

    return {
      tokens: result.tokens,
      labels: result.labels,
      confidence: result.confidence,
    };
  } catch (bootstrapError) {
    logger.error('Tokenization failed', {
      pageId,
      error: bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError),
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Tokenization failed: ${bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError)}`,
    });
  }
}

/** Save tokenization result to database */
async function cacheTokenizationResult(
  pageId: string,
  version: number,
  tokens: unknown[],
  labels: string[],
  confidence: number
): Promise<void> {
  const serializedTokens = JSON.parse(JSON.stringify(tokens)) as Prisma.InputJsonValue;
  const entityCounts = calculateEntityCountsFromLabels(labels);

  await prisma.annotatedPage.update({
    where: { id: pageId, version },
    data: {
      tokens: serializedTokens,
      labels,
      entityCounts,
      confidence,
      version: { increment: 1 },
    },
  });

  logger.info('Cached tokenization result', { pageId, tokenCount: tokens.length });
}

/** Tokenize a single page from its HTML snapshot */
async function tokenizePageInternal(pageId: string, force: boolean): Promise<TokenizationResult> {
  const page = await fetchPageForTokenization(pageId);

  // Check if already tokenized
  if (isPageTokenized(page) && !force) {
    const existingTokens = page.tokens as unknown[];
    const existingLabels = page.labels as unknown[];
    logger.info('Page already tokenized, skipping', { pageId, tokenCount: existingTokens.length });
    return {
      pageId,
      tokenCount: existingTokens.length,
      labelCount: Array.isArray(existingLabels) ? existingLabels.length : 0,
      confidence: 0,
      wasAlreadyTokenized: true,
    };
  }

  // Validate HTML snapshot exists
  if (!page.htmlSnapshot) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Page has no HTML snapshot: ${pageId}`,
    });
  }

  // Run tokenization
  const result = await runTokenization(page.htmlSnapshot, page.url, pageId);

  // Cache result
  await cacheTokenizationResult(pageId, page.version, result.tokens, result.labels, result.confidence);

  return {
    pageId,
    tokenCount: result.tokens.length,
    labelCount: result.labels.length,
    confidence: result.confidence,
    wasAlreadyTokenized: false,
  };
}

// ============================================================================
// Parallel Processing Helpers
// ============================================================================

/** Default concurrency for parallel batch processing */
const BATCH_CONCURRENCY = 5;

/** Split array into chunks for parallel processing */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Process a single page with error handling for Promise.allSettled */
async function tokenizeWithErrorCapture(
  pageId: string,
  force: boolean
): Promise<{ pageId: string; result?: TokenizationResult; error?: string }> {
  try {
    const result = await tokenizePageInternal(pageId, force);
    return { pageId, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Batch tokenization failed for page', { pageId, error: errorMessage });
    return { pageId, error: errorMessage };
  }
}

/** Process a chunk of pages in parallel */
async function processChunk(
  pageIds: string[],
  force: boolean
): Promise<Array<{ pageId: string; result?: TokenizationResult; error?: string }>> {
  const promises = pageIds.map((pageId) => tokenizeWithErrorCapture(pageId, force));
  return Promise.all(promises);
}

// ============================================================================
// Procedures
// ============================================================================

/** Tokenize a single page on-demand */
export const tokenizePage = settingsProcedure
  .input(tokenizePageInputSchema)
  .mutation(async ({ input }): Promise<TokenizationResult> => {
    return tokenizePageInternal(input.pageId, input.force);
  });

/** Tokenize multiple pages in batch (parallel processing) */
export const tokenizeBatch = settingsProcedure
  .input(tokenizeBatchInputSchema)
  .mutation(async ({ input }): Promise<{
    results: TokenizationResult[];
    errors: Array<{ pageId: string; error: string }>;
  }> => {
    const results: TokenizationResult[] = [];
    const errors: Array<{ pageId: string; error: string }> = [];

    // Process in parallel chunks to avoid overwhelming the system
    const chunks = chunkArray(input.pageIds, BATCH_CONCURRENCY);
    logger.info('Starting parallel batch tokenization', {
      total: input.pageIds.length,
      chunks: chunks.length,
      concurrency: BATCH_CONCURRENCY,
    });

    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop -- Intentional sequential batch processing for controlled concurrency; parallel would exceed BATCH_CONCURRENCY limit
      const chunkResults = await processChunk(chunk, input.force);

      for (const item of chunkResults) {
        if (item.result) {
          results.push(item.result);
        } else if (item.error) {
          errors.push({ pageId: item.pageId, error: item.error });
        }
      }
    }

    logger.info('Batch tokenization complete', {
      total: input.pageIds.length,
      success: results.length,
      failed: errors.length,
    });

    return { results, errors };
  });

/** Check tokenization status for pages */
export const getTokenizationStatus = settingsProcedure
  .input(z.object({ pageIds: z.array(z.string()).max(100) }))
  .query(async ({ input }): Promise<Array<{ pageId: string; isTokenized: boolean; tokenCount: number }>> => {
    const pages = await prisma.annotatedPage.findMany({
      where: { id: { in: input.pageIds } },
      select: { id: true, tokens: true },
    });

    return pages.map((page) => {
      const tokens = page.tokens as unknown[];
      const tokenized = Array.isArray(tokens) && tokens.length > 0;
      return {
        pageId: page.id,
        isTokenized: tokenized,
        tokenCount: tokenized ? tokens.length : 0,
      };
    });
  });

// ============================================================================
// Suggestion Procedures (Phase 4)
// ============================================================================

const getSuggestionsInputSchema = z.object({
  pageId: z.string(),
  autoApplyThreshold: z.number().min(0).max(1).optional().default(0.9),
  minDisplayThreshold: z.number().min(0).max(1).optional().default(0.4),
});

/** Preview data for a suggestion showing context and token metadata */
interface SuggestionPreview {
  /** Text from surrounding tokens before the suggestion */
  contextBefore: string;
  /** Text from surrounding tokens after the suggestion */
  contextAfter: string;
  /** Link href if the token is a link */
  linkHref: string | null;
  /** Whether the token is a link */
  isLink: boolean;
  /** HTML tag name of the token */
  tagName: string;
  /** CSS classes on the token's element */
  classes: string[];
  /** Section type (infobox, main_content, etc.) */
  sectionType: string;
}

/** Suggestion result with token info */
interface SuggestionResult {
  id: string;
  tokenIndices: number[];
  entityType: string;
  confidence: number;
  source: string;
  reasoning: string;
  text: string;
  ruleId?: string;
  /** Preview data with context and token metadata */
  preview: SuggestionPreview;
}

interface GetSuggestionsResult {
  pageId: string;
  suggestions: SuggestionResult[];
  autoAppliedCount: number;
  pendingReviewCount: number;
  totalTokens: number;
}

// Token type for preview computation (subset of LinearizedToken)
interface TokenForPreview {
  text: string;
  isLink: boolean;
  linkHref: string | null;
  tagName: string;
  classes: string[];
  sectionType: string;
}

/** Number of tokens to include in context before/after */
const CONTEXT_TOKEN_COUNT = 3;

/**
 * Compute preview data for a suggestion
 * Extracts context tokens and metadata from the first token in the suggestion
 */
function computeSuggestionPreview(
  tokens: TokenForPreview[],
  tokenIndices: number[]
): SuggestionPreview {
  // Get context before (up to CONTEXT_TOKEN_COUNT tokens)
  const firstIndex = tokenIndices[0] ?? 0;
  const contextBeforeTokens: string[] = [];
  for (let i = Math.max(0, firstIndex - CONTEXT_TOKEN_COUNT); i < firstIndex; i++) {
    const token = tokens[i];
    if (token) {
      contextBeforeTokens.push(token.text);
    }
  }

  // Get context after (up to CONTEXT_TOKEN_COUNT tokens)
  const lastIndex = tokenIndices[tokenIndices.length - 1] ?? 0;
  const contextAfterTokens: string[] = [];
  for (let i = lastIndex + 1; i <= Math.min(tokens.length - 1, lastIndex + CONTEXT_TOKEN_COUNT); i++) {
    const token = tokens[i];
    if (token) {
      contextAfterTokens.push(token.text);
    }
  }

  // Get token metadata from the first token in the suggestion
  const firstToken = tokens[firstIndex];

  // Check if any token in the suggestion is a link and get its href
  let linkHref: string | null = null;
  let isLink = false;
  for (const idx of tokenIndices) {
    const token = tokens[idx];
    if (token?.isLink && token.linkHref) {
      isLink = true;
      linkHref = token.linkHref;
      break;
    }
  }

  return {
    contextBefore: contextBeforeTokens.join(' '),
    contextAfter: contextAfterTokens.join(' '),
    linkHref,
    isLink,
    tagName: firstToken?.tagName ?? 'unknown',
    classes: firstToken?.classes ?? [],
    sectionType: firstToken?.sectionType ?? 'unknown',
  };
}

/** Get label suggestions for a tokenized page */
export const getSuggestions = settingsProcedure
  .input(getSuggestionsInputSchema)
  .query(async ({ input }): Promise<GetSuggestionsResult> => {
    const page = await prisma.annotatedPage.findUnique({
      where: { id: input.pageId },
      select: {
        id: true,
        url: true,
        htmlSnapshot: true,
        tokens: true,
        labels: true,
      },
    });

    if (!page) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Page not found: ${input.pageId}`,
      });
    }

    if (!page.htmlSnapshot) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Page has no HTML snapshot: ${input.pageId}`,
      });
    }

    // Get bootstrap result
    const bootstrapLabels = await getBootstrapLabels();
    const result = bootstrapLabels(page.htmlSnapshot, page.url);

    // Generate suggestions
    const generateSuggestions = await getSuggestionGenerator();
    const enhanced = generateSuggestions(result, {
      autoApply: input.autoApplyThreshold,
      minDisplay: input.minDisplayThreshold,
    });

    logger.info('Generated suggestions for page', {
      pageId: input.pageId,
      totalSuggestions: enhanced.suggestions.length,
      autoApplied: enhanced.autoAppliedCount,
      pendingReview: enhanced.pendingReviewCount,
    });

    // Cast tokens for preview computation
    const tokensForPreview = result.tokens as TokenForPreview[];

    const suggestions: SuggestionResult[] = enhanced.suggestions.map(s => {
      const preview = computeSuggestionPreview(tokensForPreview, s.tokenIndices);
      const base: SuggestionResult = {
        id: s.id,
        tokenIndices: s.tokenIndices,
        entityType: s.entityType,
        confidence: s.confidence,
        source: s.source,
        reasoning: s.reasoning,
        text: s.text,
        preview,
      };
      if (s.ruleId !== undefined) {
        base.ruleId = s.ruleId;
      }
      return base;
    });

    return {
      pageId: input.pageId,
      suggestions,
      autoAppliedCount: enhanced.autoAppliedCount,
      pendingReviewCount: enhanced.pendingReviewCount,
      totalTokens: result.tokens.length,
    };
  });
