/**
 * Annotation Router - Discovery Procedures
 *
 * URL discovery from library and bulk import functionality.
 */

import { TRPCError } from '@trpc/server';


import { prisma } from '@/server/db';
import { adminProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';

import { detectSourceType, calculateEntityCountsFromLabels, getBootstrapLabels, fetchHtmlWithFlareSolverr } from './helpers';
import {
  discoverFromLibraryInputSchema,
  addBulkFromDiscoveryInputSchema,
  addBulkFromTextInputSchema,
} from './schemas';

import type { DiscoverableUrl, DiscoveryResult, BulkImportResult } from './types';
import type { AnnotationSourceType } from '@prisma/client';

// ============================================================================
// URL Extraction Helpers
// ============================================================================

function extractUrlFromLink(link: unknown): string | null {
  if (typeof link !== 'object' || link === null) return null;
  if (!('url' in link)) return null;
  const url = (link as { url: string }).url;
  if (typeof url !== 'string' || !url.startsWith('http')) return null;
  return url;
}

function extractUrlsFromMetadata(
  metadata: { urls: string[]; externalLinks: unknown } | null
): string[] {
  if (!metadata) return [];

  const urls: string[] = [];

  if (Array.isArray(metadata.urls)) {
    urls.push(...metadata.urls);
  }

  if (metadata.externalLinks && Array.isArray(metadata.externalLinks)) {
    for (const link of metadata.externalLinks) {
      const url = extractUrlFromLink(link);
      if (url) urls.push(url);
    }
  }

  return [...new Set(urls)];
}

function filterUrlsBySourceType(
  urls: string[],
  sourceTypes: AnnotationSourceType[] | undefined
): Array<{ url: string; sourceType: AnnotationSourceType }> {
  const result: Array<{ url: string; sourceType: AnnotationSourceType }> = [];

  for (const url of urls) {
    const sourceType = detectSourceType(url);
    if (!sourceType) continue;
    if (sourceTypes?.length && !sourceTypes.includes(sourceType)) continue;
    result.push({ url, sourceType });
  }

  return result;
}

// ============================================================================
// Single URL Processing
// ============================================================================

interface ProcessUrlResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

async function processUrlForAnnotation(
  url: string,
  mangaTitle: string | undefined
): Promise<ProcessUrlResult> {
  const existing = await prisma.annotatedPage.findUnique({ where: { url } });
  if (existing) return { success: false, skipped: true };

  const sourceType = detectSourceType(url);
  if (!sourceType) return { success: false, error: 'Unsupported source type' };

  // Use FlareSolverr for JS-heavy pages (Fandom, ComicVine)
  const { html, usedFlareSolverr } = await fetchHtmlWithFlareSolverr(url, sourceType);
  logger.info('Fetched HTML for annotation', { url, sourceType, usedFlareSolverr, htmlLength: html.length });
  const bootstrapLabels = await getBootstrapLabels();
  const bootstrapResult = bootstrapLabels(html, url);

  const tokens = bootstrapResult.tokens.map((t) => ({
    id: t.id,
    text: t.text,
    tagName: t.tagName,
    xpath: t.xpath,
    domDepth: t.domDepth,
    isImage: t.isImage,
    imageSrc: t.imageSrc,
    imageAlt: t.imageAlt,
  }));

  const entityCounts = calculateEntityCountsFromLabels(bootstrapResult.labels);

  await prisma.annotatedPage.create({
    data: {
      url,
      mangaTitle: mangaTitle ?? null,
      sourceType,
      htmlSnapshot: html,
      tokens,
      labels: bootstrapResult.labels,
      entityCounts,
      confidence: bootstrapResult.confidence,
      status: 'BOOTSTRAP',
    },
  });

  logger.info('Added annotated page', { url, sourceType });
  return { success: true };
}

interface BatchProcessingResult {
  addedCount: number;
  skippedCount: number;
  failures: Array<{ url: string; error: string }>;
}

async function processBatch(
  batch: Array<{ url: string; mangaTitle?: string | undefined }>
): Promise<BatchProcessingResult> {
  const batchResult: BatchProcessingResult = { addedCount: 0, skippedCount: 0, failures: [] };
  await Promise.all(
    batch.map(async ({ url, mangaTitle }) => {
      try {
        const processResult = await processUrlForAnnotation(url, mangaTitle);
        if (processResult.success) {
          batchResult.addedCount++;
        } else if (processResult.skipped) {
          batchResult.skippedCount++;
        } else {
          batchResult.failures.push({ url, error: processResult.error ?? 'Unknown error' });
        }
      } catch (error) {
        batchResult.failures.push({ url, error: error instanceof Error ? error.message : String(error) });
      }
    })
  );
  return batchResult;
}

// ============================================================================
// Discovery Procedures
// ============================================================================

export const discoverFromLibrary = adminProcedure
  .input(discoverFromLibraryInputSchema)
  .query(async ({ input }): Promise<DiscoveryResult> => {
    const { sourceTypes, limit, excludeAnnotated } = input;

    const mangaWithMetadata = await prisma.manga.findMany({
      select: {
        id: true,
        title: true,
        Metadata: { select: { urls: true, externalLinks: true } },
      },
      take: 500,
    });

    // Step 1: Collect all candidate URLs from manga metadata (before filtering by annotation status)
    const candidateUrls: Array<{ mangaId: number; mangaTitle: string; url: string; sourceType: AnnotationSourceType }> = [];
    for (const manga of mangaWithMetadata) {
      const urls = extractUrlsFromMetadata(manga.Metadata);
      const filteredUrls = filterUrlsBySourceType(urls, sourceTypes);
      for (const { url, sourceType } of filteredUrls) {
        candidateUrls.push({ mangaId: manga.id, mangaTitle: manga.title, url, sourceType });
      }
    }

    // Step 2: Use database WHERE IN to check annotation status (efficient indexed lookup)
    // Instead of loading ALL annotated URLs into memory, only check candidate URLs
    const candidateUrlStrings = candidateUrls.map((c) => c.url);
    const annotatedUrlRecords = candidateUrlStrings.length > 0
      ? await prisma.annotatedPage.findMany({
          where: { url: { in: candidateUrlStrings } },
          select: { url: true },
        })
      : [];
    const annotatedUrls = new Set(annotatedUrlRecords.map((p) => p.url));

    // Step 3: Build result with annotation status
    const discoveredUrls: DiscoverableUrl[] = [];
    let alreadyAnnotatedCount = 0;

    for (const candidate of candidateUrls) {
      const alreadyAnnotated = annotatedUrls.has(candidate.url);
      if (alreadyAnnotated) alreadyAnnotatedCount++;
      if (alreadyAnnotated && excludeAnnotated) continue;

      discoveredUrls.push({
        mangaId: candidate.mangaId,
        mangaTitle: candidate.mangaTitle,
        url: candidate.url,
        sourceType: candidate.sourceType,
        alreadyAnnotated,
      });
      if (discoveredUrls.length >= limit) break;
    }

    return { urls: discoveredUrls, total: discoveredUrls.length, alreadyAnnotatedCount };
  });

export const addBulkFromDiscovery = adminProcedure
  .input(addBulkFromDiscoveryInputSchema)
  .mutation(async ({ input }): Promise<BulkImportResult> => {
    const result: BulkImportResult = { added: 0, skipped: 0, failed: [] };
    const batchSize = 5;

    for (let i = 0; i < input.urls.length; i += batchSize) {
      const batch = input.urls.slice(i, i + batchSize);
      // eslint-disable-next-line no-await-in-loop -- Sequential batch processing for rate limiting
      const batchResult = await processBatch(batch);
      result.added += batchResult.addedCount;
      result.skipped += batchResult.skippedCount;
      result.failed.push(...batchResult.failures);
    }

    return result;
  });

export const addBulkFromText = adminProcedure
  .input(addBulkFromTextInputSchema)
  .mutation(async ({ input }): Promise<BulkImportResult> => {
    const { urlText, defaultMangaTitle } = input;

    const lines = urlText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const validUrls: Array<{ url: string; mangaTitle?: string | undefined }> = [];

    for (const line of lines) {
      try {
        new URL(line);
        validUrls.push({ url: line, mangaTitle: defaultMangaTitle });
      } catch {
        // Skip invalid URLs
      }
    }

    if (validUrls.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid URLs found in input' });
    }

    const limitedUrls = validUrls.slice(0, 50);
    const result: BulkImportResult = { added: 0, skipped: 0, failed: [] };
    const batchSize = 5;

    for (let i = 0; i < limitedUrls.length; i += batchSize) {
      const batch = limitedUrls.slice(i, i + batchSize);
      // eslint-disable-next-line no-await-in-loop -- Sequential batch processing for rate limiting
      const batchResult = await processBatch(batch);
      result.added += batchResult.addedCount;
      result.skipped += batchResult.skippedCount;
      result.failed.push(...batchResult.failures);
    }

    return result;
  });
