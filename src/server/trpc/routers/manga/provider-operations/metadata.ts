/**
 * Provider Metadata Operations
 *
 * Fetch metadata from specific providers:
 * - getProviderMetadata: Get cached or fetch fresh metadata
 *
 * Consolidated from:
 * - providerOperations.ts (lines 666-785)
 * - metadataOperations/provider-metadata.ts
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

interface ProviderMetadataResult {
  success: boolean;
  metadata: Record<string, unknown>;
}

interface ProviderEntry {
  providerId?: string;
  Metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate provider data and extract provider entry
 */
function validateProviderData(
  providerMetadata: Record<string, unknown> | null,
  provider: string
): ProviderEntry {
  const providerData = providerMetadata?.[provider] as ProviderEntry | undefined;

  if (!providerData) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `No metadata found for provider: ${provider}`
    });
  }

  if (!providerData.providerId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Provider binding exists but no providerId found for: ${provider}`
    });
  }

  return providerData;
}

/**
 * Find matching result from search results by provider ID
 */
function findMatchingResult(
  results: unknown[],
  providerId: string
): Record<string, unknown> | undefined {
  const matchingResult = results.find((result: unknown) => {
    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      return resultObj['id'] === providerId;
    }
    return false;
  });

  return matchingResult as Record<string, unknown> | undefined;
}

// ============================================================================
// Router
// ============================================================================

export const providerMetadataRouter = router({
  getProviderMetadata: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      provider: z.string()
    }))
    .mutation(async ({ input, ctx }): Promise<ProviderMetadataResult> => {
      const { mangaId, provider } = input;

      logger.info(`Fetching provider metadata for manga ID ${mangaId}, provider: ${provider}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true, providerMetadata: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      try {
        const providerMetadata = manga.providerMetadata as Record<string, unknown> | null;
        const providerEntry = validateProviderData(providerMetadata, provider);
        const providerId = providerEntry.providerId as string;
        const cachedMetadata = providerEntry.Metadata;

        // Return cached metadata if available
        if (cachedMetadata) {
          logger.info(`Returning cached metadata for provider ${provider}`);
          return {
            success: true,
            metadata: { ...cachedMetadata, source: provider, providerId }
          };
        }

        // Fetch fresh metadata from provider
        logger.info(`No cached metadata, fetching from provider ${provider}`);
        const { unifiedProviderRegistry } = await import('@/server/services/search/UnifiedProviderRegistry');
        const results = await unifiedProviderRegistry.searchWithProvider(provider, manga.title, { limit: 5 });
        const matchingResult = findMatchingResult(results, providerId);

        if (!matchingResult) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Could not find manga with ID ${providerId} on ${provider}`
          });
        }

        // Cache the fetched metadata
        const updatedProviderMetadata = {
          ...(providerMetadata ?? {}),
          [provider]: { ...providerEntry, metadata: matchingResult, fetchedAt: new Date().toISOString() }
        };

        await ctx.prisma.manga.update({
          where: { id: mangaId },
          data: { providerMetadata: updatedProviderMetadata as Prisma.InputJsonValue }
        });

        logger.info(`Successfully fetched and cached metadata from ${provider}`);
        return {
          success: true,
          metadata: { ...matchingResult, source: provider, providerId }
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error(`Error fetching provider metadata for manga ID ${mangaId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch provider metadata: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    })
});
