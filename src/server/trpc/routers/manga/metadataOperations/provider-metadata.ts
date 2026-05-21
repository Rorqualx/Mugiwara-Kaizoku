/**
 * Provider Metadata Operations
 *
 * Fetch metadata from specific providers:
 * - getProviderMetadata: Get cached or fetch fresh metadata
 *
 * Extracted from: metadataOperations.ts (lines 246-369)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import type { Prisma, PrismaClient } from '@prisma/client';

interface ProviderMetadataResult {
  success: boolean;
  metadata: Record<string, unknown>;
}

interface MangaWithProvider {
  id: number;
  title: string;
  providerMetadata: unknown;
}

interface ProviderData {
  providerEntry: Record<string, unknown>;
  providerId: string;
  metadata: Record<string, unknown> | undefined;
}

/**
 * Fetch manga from database
 */
async function fetchManga(prisma: PrismaClient, mangaId: number): Promise<MangaWithProvider> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: {
      id: true,
      title: true,
      providerMetadata: true
    }
  });

  if (!manga) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Manga not found'
    });
  }

  return manga;
}

/**
 * Extract and validate provider data from manga
 */
function extractProviderData(
  manga: MangaWithProvider,
  provider: string
): ProviderData {
  const providerMetadata = manga.providerMetadata as Record<string, unknown> | null;
  const providerData = providerMetadata?.[provider] as Record<string, unknown> | undefined;

  if (!providerData) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `No metadata found for provider: ${provider}`
    });
  }

  const providerEntry = providerData;
  const providerId = providerEntry['providerId'] as string | undefined;
  const metadata = providerEntry['Metadata'] as Record<string, unknown> | undefined;

  if (!providerId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Provider binding exists but no providerId found for: ${provider}`
    });
  }

  return { providerEntry, providerId, metadata };
}

/**
 * Return cached metadata if available
 */
function handleCachedMetadata(
  metadata: Record<string, unknown> | undefined,
  provider: string,
  providerId: string
): ProviderMetadataResult | null {
  if (!metadata) {
    return null;
  }

  logger.info(`Returning cached metadata for provider ${provider}`);
  return {
    success: true,
    metadata: {
      ...metadata,
      source: provider,
      providerId
    }
  };
}

/**
 * Fetch metadata from provider
 */
async function fetchFreshMetadata(
  provider: string,
  providerId: string,
  mangaTitle: string
): Promise<Record<string, unknown>> {
  logger.info(`No cached metadata, fetching from provider ${provider}`);
  const { unifiedProviderRegistry } = await import('@/server/services/search/UnifiedProviderRegistry');

  // Search for the manga using the stored provider ID
  const results = await unifiedProviderRegistry.searchWithProvider(
    provider,
    mangaTitle,
    { limit: 5 }
  );

  // Find the result matching our provider ID
  const matchingResult = results.find((result: unknown) => {
    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      return resultObj['id'] === providerId;
    }
    return false;
  });

  if (!matchingResult) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Could not find manga with ID ${providerId} on ${provider}`
    });
  }

  return matchingResult as unknown as Record<string, unknown>;
}

interface UpdateMetadataParams {
  mangaId: number;
  provider: string;
  providerEntry: Record<string, unknown>;
  metadata: Record<string, unknown>;
  existingProviderMetadata: Record<string, unknown> | null;
}

/**
 * Update manga metadata in database
 */
async function updateMangaMetadata(
  prisma: PrismaClient,
  params: UpdateMetadataParams
): Promise<void> {
  const { mangaId, provider, providerEntry, metadata, existingProviderMetadata } = params;

  const updatedProviderMetadata = {
    ...(existingProviderMetadata ?? {}),
    [provider]: {
      ...providerEntry,
      metadata,
      fetchedAt: new Date().toISOString()
    }
  };

  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: updatedProviderMetadata as Prisma.InputJsonValue }
  });

  logger.info(`Successfully fetched and cached metadata from ${provider}`);
}

export const metadataProviderProcedures = router({
  getProviderMetadata: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      provider: z.string()
    }))
    .mutation(async ({ input, ctx }): Promise<ProviderMetadataResult> => {
      const { mangaId, provider } = input;

      logger.info(`Fetching provider metadata for manga ID ${mangaId}, provider: ${provider}`);

      try {
        const manga = await fetchManga(ctx.prisma, mangaId);
        const { providerEntry, providerId, metadata } = extractProviderData(manga, provider);

        // Return cached metadata if available
        const cachedResult = handleCachedMetadata(metadata, provider, providerId);
        if (cachedResult) {
          return cachedResult;
        }

        // Fetch fresh metadata from provider
        const freshMetadata = await fetchFreshMetadata(provider, providerId, manga.title);

        // Store the fetched metadata for future use
        const providerMetadata = manga.providerMetadata as Record<string, unknown> | null;
        await updateMangaMetadata(ctx.prisma, {
          mangaId,
          provider,
          providerEntry,
          metadata: freshMetadata,
          existingProviderMetadata: providerMetadata
        });

        return {
          success: true,
          metadata: {
            ...freshMetadata,
            source: provider,
            providerId
          }
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error(`Error fetching provider metadata for manga ID ${mangaId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch provider metadata: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    })
});
