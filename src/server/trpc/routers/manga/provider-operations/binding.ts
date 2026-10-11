/**
 * Provider Operations - Binding Procedures
 *
 * Handles binding manga to various metadata providers.
 *
 * Procedures:
 * - bindProvider: Bind manga to a generic provider (comicvine, fandom, etc.)
 * - bind: Legacy AniList binding
 *
 * Extracted from: providerOperations.ts (lines 476-554, 793-845)
 */

import { TRPCError } from '@trpc/server';


import { eventEmitter } from '@/server/services/eventEmitter';
import { clearRejection, recordBinding, recordRejection } from '@/server/services/metadata/binding-record';
import { parseProviderMetadata, readProviderId } from '@/server/services/metadata/provider-metadata-utils';
import { protectedProcedure } from '@/server/trpc/procedures';
import { assertMembership, requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { invalidateMangaCache } from '../crud-operations/get-manga-cache';
import {
  buildUnboundSentinel,
  isManuallyUnboundFromMetadata,
  supportsUnboundSentinel,
} from '../metadataOperations/enrichment-pipeline/manual-binding-sentinel';
import { pinFieldsForBind, pinFieldsForUnbind } from '../providerBindingHelpers';

import { bindSchema, bindProviderSchema, unbindProviderSchema } from './schemas';
import { safeGet, safeGetStringOptional } from './utils';

import type { Prisma } from '@prisma/client';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetches metadata from a provider for a manga title
 * @param provider - The provider name
 * @param title - The manga title to search for
 * @returns Fetched metadata object or null if not found
 */
async function fetchProviderMetadata(
  provider: string,
  title: string
): Promise<Record<string, unknown> | null> {
  try {
    const { unifiedProviderRegistry } = await import('@/server/services/search/UnifiedProviderRegistry');
    const results = await unifiedProviderRegistry.searchWithProvider(provider, title, { limit: 1 });

    if (results.length === 0) {
      return null;
    }

    const firstResult = results[0];
    if (!firstResult) {
      return null;
    }

    return {
      title: firstResult.title,
      description: firstResult.description,
      coverUrl: safeGetStringOptional(firstResult, 'coverUrl') ?? safeGetStringOptional(firstResult, 'cover_url') ?? '',
      genres: firstResult.genres,
      authors: Array.isArray(safeGet(firstResult, 'authors')) ? safeGet(firstResult, 'authors') as unknown[] : [],
      status: firstResult.status,
      chapters: firstResult.chapters,
      volumes: firstResult.volumes
    };
  } catch (error) {
    logger.warn(`Failed to fetch metadata from ${provider}:`, error);
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Drop the artifacts a ComicVine binding leaves behind in tables outside of
 * `Manga.providerMetadata`: the `{site: 'ComicVine'}` entry in
 * `Metadata.externalLinks` and any `Volume` rows with `source = 'comicvine'`
 * (their chapters are detached, not deleted, so user-owned data like read
 * progress is preserved).
 *
 * Without this, an unbind+refetch leaves the prior URL in externalLinks even
 * when the matcher correctly returns no match — the newer-wins merge in
 * phase-finalize only replaces a same-site entry when a new one is produced.
 */
async function cleanupCvBindingArtifacts(
  prisma: typeof import('@/server/db').prisma,
  mangaId: number,
): Promise<{ removedLinks: number; removedVolumes: number; detachedChapters: number }> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { metadataId: true, Metadata: { select: { externalLinks: true } } },
  });

  let removedLinks = 0;
  if (manga?.metadataId) {
    const existing = manga.Metadata?.externalLinks;
    const existingArr: Array<{ url: unknown; site: unknown }> = Array.isArray(existing)
      ? (existing as Array<{ url: unknown; site: unknown }>)
      : [];
    const filtered = existingArr.filter(
      (l) => !(typeof l.url === 'string' && l.site === 'ComicVine'),
    );
    if (filtered.length !== existingArr.length) {
      removedLinks = existingArr.length - filtered.length;
      await prisma.metadata.update({
        where: { id: manga.metadataId },
        data: { externalLinks: filtered as unknown as Prisma.InputJsonValue },
      });
    }
  }

  const cvVols = await prisma.volume.findMany({
    where: { mangaId, source: 'comicvine' },
    select: { id: true },
  });
  let detachedChapters = 0;
  if (cvVols.length > 0) {
    const ids = cvVols.map((v) => v.id);
    const detach = await prisma.chapter.updateMany({
      where: { volumeId: { in: ids } },
      data: { volumeId: null },
    });
    detachedChapters = detach.count;
    await prisma.volume.deleteMany({ where: { id: { in: ids } } });
  }

  return { removedLinks, removedVolumes: cvVols.length, detachedChapters };
}

/**
 * Fire-and-forget: re-run the full enrichment pipeline after a manual provider
 * bind so external links, Volume rows, covers, etc. are refreshed using the
 * newly-bound providerId. The pipeline reads `providerMetadata.<provider>.manual`
 * and fetches the bound id directly for AniList, ComicVine, MangaDex,
 * MangaUpdates and Kitsu (`phase-provider-fetch/provider-pins.ts`); Fandom and
 * Wikipedia re-run their own discovery, which reads its cached binding.
 *
 * Errors are logged and swallowed — they must not fail the bind mutation.
 */
function triggerPostBindEnrichment(mangaId: number, title: string, provider: string): void {
  void (async () => {
    try {
      const { runEnrichmentPipeline } = await import(
        '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline'
      );
      logger.info(`Post-bind enrichment starting for manga ${mangaId} after ${provider} rebind`);
      await runEnrichmentPipeline(mangaId, title, undefined, { forceRefresh: true });
      logger.info(`Post-bind enrichment complete for manga ${mangaId} (${provider})`);
    } catch (err) {
      logger.warn(
        `Post-bind enrichment failed for manga ${mangaId} (${provider}, non-critical)`,
        err,
      );
    }
  })();
}

// ============================================================================
// Binding Router
// ============================================================================

export const bindingRouter = router({
  /**
   * Bind manga to a generic provider (comicvine, fandom, wikipedia, anilist, mangadex)
   *
   * @param mangaId - The manga ID to bind
   * @param provider - The provider name
   * @param providerId - The provider-specific ID
   * @param fetchMetadata - Whether to fetch metadata from the provider
   * @returns Success status, message, and fetched metadata if any
   */
  bindProvider: protectedProcedure
    .input(bindProviderSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string; metadata: Record<string, unknown> | null }> => {
      const { mangaId, provider, providerId, fetchMetadata } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);
      logger.info(`Binding manga ID ${mangaId} to ${provider} ID ${providerId}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId },
        include: { Metadata: true }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      try {
        const currentProviderMetadata = parseProviderMetadata(manga.providerMetadata);
        const providerEntry: Record<string, unknown> = {
          providerId,
          manual: true,
          boundAt: new Date().toISOString()
        };

        let fetchedMetadata: Record<string, unknown> | null = null;
        if (fetchMetadata) {
          fetchedMetadata = await fetchProviderMetadata(provider, manga.title);

          if (fetchedMetadata) {
            providerEntry['Metadata'] = fetchedMetadata;
            providerEntry['fetchedAt'] = new Date().toISOString();
          }
        }

        currentProviderMetadata[provider] = providerEntry;

        await ctx.prisma.manga.update({
          where: { id: mangaId },
          data: {
            providerMetadata: currentProviderMetadata as Prisma.InputJsonValue,
            ...pinFieldsForBind(manga, provider, providerId)
          }
        });

        logger.info(`Successfully bound manga ID ${mangaId} to ${provider} ID ${providerId}`);
        // Binding-as-record: a deliberate manual bind is durable provenance and
        // always wins — record it and clear any prior rejection of this id so a
        // user can override an auto-rejection.
        await recordBinding({ mangaId, provider, providerId, origin: 'manual' });
        await clearRejection(mangaId, provider, providerId);
        await invalidateMangaCache(mangaId);
        await eventEmitter.emit('manga:updated', { mangaId });

        if (fetchMetadata) {
          triggerPostBindEnrichment(mangaId, manga.title, provider);
        }

        return {
          success: true,
          message: `Successfully bound ${manga.title} to ${provider} ID ${providerId}`,
          metadata: fetchedMetadata
        };
      } catch (error: unknown) {
        logger.error(`Error binding manga ID ${mangaId} to ${provider}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to bind manga: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }),

  /**
   * Unbind manga from a provider
   *
   * An unbind means "do not bind this provider for this title", so the
   * provider's section is replaced by the unbound sentinel, which the
   * enrichment pipeline honours — deleting the section let the next enrichment
   * re-bind it. AniList is the anchor the other providers are verified
   * against and has no sentinel: its section and pin are removed and the id is
   * rejected, so the matcher picks again. A later manual bind overwrites the
   * sentinel.
   *
   * @param mangaId - The manga ID to unbind
   * @param provider - The provider to remove
   * @returns Success status and message
   */
  unbindProvider: protectedProcedure
    .input(unbindProviderSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
      const { mangaId, provider } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);
      logger.info(`Unbinding manga ID ${mangaId} from ${provider}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      try {
        const currentProviderMetadata = parseProviderMetadata(manga.providerMetadata);
        const unboundId = readProviderId(currentProviderMetadata, provider);
        let wasBound = provider in currentProviderMetadata;
        if (supportsUnboundSentinel(provider)) {
          // Unbinding twice is a no-op, not a second unbind.
          wasBound = wasBound && !isManuallyUnboundFromMetadata(currentProviderMetadata, provider);
          currentProviderMetadata[provider] = buildUnboundSentinel();
        } else {
          delete currentProviderMetadata[provider];
        }

        await ctx.prisma.manga.update({
          where: { id: mangaId },
          data: {
            providerMetadata: currentProviderMetadata as Prisma.InputJsonValue,
            ...pinFieldsForUnbind(provider)
          }
        });

        // Binding-as-record: an explicit unbind is a durable "don't re-pick this"
        // signal. Record it so re-enrichment won't auto-rebind the same entity
        // (reversible — a later manual bind clears it). The sentinel blocks the
        // whole provider; the rejection still matters once a later manual bind
        // has replaced the sentinel and been removed again, and for AniList.
        if (unboundId) {
          await recordRejection({ mangaId, provider, providerId: unboundId, reason: 'manual unbind' });
        }

        let cleanupSummary = '';
        if (provider === 'comicvine') {
          const cleanup = await cleanupCvBindingArtifacts(ctx.prisma, mangaId);
          cleanupSummary = `, removed ${cleanup.removedLinks} externalLink(s), ${cleanup.removedVolumes} CV volume(s), detached ${cleanup.detachedChapters} chapter(s)`;
        }

        // The row changed either way (a sentinel is written even when nothing
        // was bound), so readers must see it.
        await invalidateMangaCache(mangaId);
        await eventEmitter.emit('manga:updated', { mangaId });

        if (!wasBound && cleanupSummary === '') {
          return { success: true, message: `Manga is not bound to ${provider}` };
        }

        logger.info(`Successfully unbound manga ID ${mangaId} from ${provider}${cleanupSummary}`);

        return {
          success: true,
          message: `Successfully unbound ${manga.title} from ${provider}${cleanupSummary}`
        };
      } catch (error: unknown) {
        logger.error(`Error unbinding manga ID ${mangaId} from ${provider}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to unbind manga: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }),

  /**
   * Whether automatic matching is switched off for a provider on this manga
   * (the user removed its binding). Drives the "Resume automatic matching"
   * action in the bind dialog.
   */
  providerMatchingState: protectedProcedure
    .input(unbindProviderSchema)
    .query(async ({ input, ctx }): Promise<{ autoMatchPaused: boolean }> => {
      await assertMembership(ctx.prisma, requireUserId(ctx), input.mangaId);
      const manga = await ctx.prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { providerMetadata: true }
      });
      const providerMetadata = parseProviderMetadata(manga?.providerMetadata);
      return {
        autoMatchPaused: supportsUnboundSentinel(input.provider)
          && isManuallyUnboundFromMetadata(providerMetadata, input.provider)
      };
    }),

  /**
   * Undo a provider unbind: drop the "do not bind" marker so the next
   * enrichment may match the provider again. The entity that was unbound stays
   * rejected, so the matcher cannot simply re-pick it.
   *
   * @returns whether a marker was removed
   */
  resumeAutoMatching: protectedProcedure
    .input(unbindProviderSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
      const { mangaId, provider } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId },
        select: { providerMetadata: true }
      });
      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      const providerMetadata = parseProviderMetadata(manga.providerMetadata);
      if (!supportsUnboundSentinel(provider) || !isManuallyUnboundFromMetadata(providerMetadata, provider)) {
        return { success: true, message: `Automatic matching is already on for ${provider}` };
      }

      delete providerMetadata[provider];
      await ctx.prisma.manga.update({
        where: { id: mangaId },
        data: { providerMetadata: providerMetadata as Prisma.InputJsonValue }
      });
      await invalidateMangaCache(mangaId);
      await eventEmitter.emit('manga:updated', { mangaId });
      logger.info(`Resumed automatic ${provider} matching for manga ID ${mangaId}`);

      return {
        success: true,
        message: `Automatic ${provider} matching resumed; it runs on the next metadata refresh`
      };
    }),

  /**
   * Bind manga to AniList (legacy procedure)
   *
   * @param mangaId - The manga ID to bind
   * @param anilistId - The AniList ID
   * @param title - The manga title
   * @param detail - The summary/description
   * @returns Success status and message
   */
  bind: protectedProcedure
    .input(bindSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
      const { mangaId, anilistId, title } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), mangaId);
      logger.info(`Binding manga ID ${mangaId} to AniList ID ${anilistId}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId },
        include: { Metadata: true }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found.'
        });
      }

      try {
        // `detail` is a "Bound to AniList ID: N" placeholder from the modal, not
        // a synopsis — never write it over Metadata.summary.
        if (!manga.Metadata) {
          await ctx.prisma.metadata.create({
            data: { Manga: { connect: { id: mangaId } } }
          });
        }

        // Also write to providerMetadata so isProviderBound('anilist') detects it
        const currentProviderMetadata = parseProviderMetadata(manga.providerMetadata);
        currentProviderMetadata['anilist'] = {
          providerId: anilistId,
          manual: true,
          boundAt: new Date().toISOString()
        };

        await ctx.prisma.manga.update({
          where: { id: mangaId },
          data: {
            title,
            providerMetadata: currentProviderMetadata as Prisma.InputJsonValue,
            ...pinFieldsForBind(manga, 'anilist', anilistId)
          }
        });

        // Same durable record as bindProvider: a manual bind wins and lifts any
        // earlier rejection of this id.
        await recordBinding({ mangaId, provider: 'anilist', providerId: anilistId, origin: 'manual' });
        await clearRejection(mangaId, 'anilist', anilistId);

        logger.info(`Successfully bound manga ID ${mangaId} to AniList ID ${anilistId}`);
        await invalidateMangaCache(mangaId);
        await eventEmitter.emit('manga:updated', { mangaId });

        return {
          success: true,
          message: `Successfully bound ${title} to AniList ID ${anilistId}`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error binding manga ID ${mangaId} to AniList ID ${anilistId}: ${errorMessage}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to bind manga: ${errorMessage}`
        });
      }
    })
});
