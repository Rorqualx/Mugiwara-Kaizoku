/**
 * Provider Merge Operations
 *
 * Merge and update metadata from multiple providers:
 * - updateProviderPreferences: Update provider preferences
 * - mergeMetadataFromProviders: Merge selected fields from providers
 *
 * Extracted from: providerOperations.ts (lines 426-471, 556-664)
 */

import { TRPCError } from '@trpc/server';

import { eventEmitter } from '@/server/services/eventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';
import { mapToMangaStatus } from '@/utils/status-mapper';

import { invalidateMangaCache } from '../crud-operations/get-manga-cache';

import {
  updateProviderPreferencesSchema,
  mergeMetadataFromProvidersSchema
} from './utils';

import type { Prisma, PrismaClient } from '@prisma/client';


// ============================================================================
// Constants
// ============================================================================

/** Maps input field keys → Prisma Metadata column names. */
const METADATA_FIELD_MAPPING: Record<string, string> = {
  'alternativeTitles': 'synonyms',
  'description': 'summary',
  'coverUrl': 'coverUrl',
  'bannerImage': 'bannerImage',
  'status': 'status',
  'format': 'format',
  'countryOfOrigin': 'countryOfOrigin',
  'genres': 'genres',
  'tags': 'tags',
  'themes': 'themes',
  'author': 'authors',
  'authors': 'authors',
  'artist': 'artists',
  'artists': 'artists',
  'publisher': 'publisher',
  'language': 'language',
  'startDate': 'startDate',
  'endDate': 'endDate',
  'chapters': 'chapters',
  'volumes': 'volumes',
  'score': 'averageScore',
  'popularity': 'popularity',
  'externalLinks': 'externalLinks',
  'url': 'urls',
};

/** Columns on the Prisma Metadata model that accept String[] arrays. */
const ARRAY_COLUMNS = new Set([
  'authors', 'artists', 'genres', 'tags', 'themes',
  'characters', 'synonyms', 'urls', 'languages',
]);

/** Source preference fields — stored in providerMetadata.preferences. */
const SOURCE_PREFERENCE_FIELDS = new Set([
  'volumeCover', 'volumeTitle', 'volumeSummary',
  'chapterCover', 'chapterTitle', 'chapterSummary',
]);

/** Providers that have volume/chapter scraping capability (actual volume data). */
const VOLUME_CAPABLE_PROVIDERS = new Set(['comicvine', 'fandom']);

/**
 * Fields that don't exist on the Prisma Metadata model.
 * Stored in providerMetadata.enrichedFields instead.
 */
const ENRICHED_ONLY_FIELDS = new Set([
  'demographic', 'englishPublisher', 'magazine', 'originalRun', 'gallery',
]);

// ============================================================================
// Helpers
// ============================================================================

interface FieldSelectionInput {
  field: string;
  provider: string;
  value?: unknown;
}

interface CategorizedSelections {
  metadataUpdate: Record<string, unknown>;
  mangaTitle: string | null;
  enrichedFields: Record<string, unknown>;
  sourcePreferences: Record<string, string>;
  providerSources: Record<string, string[]>;
}

/** Convert an AniList-style date object to a JS Date. */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null) {
    const rec = value as Record<string, unknown>;
    const year = typeof rec['year'] === 'number' ? rec['year'] : null;
    const month = typeof rec['month'] === 'number' ? rec['month'] : 1;
    const day = typeof rec['day'] === 'number' ? rec['day'] : 1;
    if (year === null) return null;
    return new Date(year, month - 1, day);
  }
  return null;
}

/** Ensure a value is an array for array columns. */
function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/** Transform a value to match the Prisma Metadata column type. */
function transformForColumn(column: string, value: unknown): unknown {
  if (column === 'startDate' || column === 'endDate') return toDate(value);
  if (ARRAY_COLUMNS.has(column)) return ensureArray(value);
  if (column === 'status') return mapToMangaStatus(value);
  if (column === 'chapters' || column === 'volumes' || column === 'popularity') {
    return typeof value === 'number' ? Math.round(value) : value;
  }
  if (column === 'averageScore' || column === 'rating') {
    return typeof value === 'number' ? value : null;
  }
  return value;
}

/** Split field selections into metadata updates, manga updates, enriched fields, and source preferences. */
function categorizeFieldSelections(
  fieldSelections: FieldSelectionInput[]
): CategorizedSelections {
  const metadataUpdate: Record<string, unknown> = {};
  const enrichedFields: Record<string, unknown> = {};
  const sourcePreferences: Record<string, string> = {};
  const providerSources: Record<string, string[]> = {};
  let mangaTitle: string | null = null;

  for (const { field, provider, value } of fieldSelections) {
    providerSources[provider] ??= [];
    providerSources[provider].push(field);

    if (SOURCE_PREFERENCE_FIELDS.has(field)) {
      sourcePreferences[field] = typeof value === 'string' ? value : provider;
      continue;
    }

    // Title goes on the Manga model, not Metadata
    if (field === 'title') {
      mangaTitle = typeof value === 'string' ? value : null;
      continue;
    }

    // Fields without a Metadata column go to enrichedFields
    if (ENRICHED_ONLY_FIELDS.has(field)) {
      enrichedFields[field] = value;
      continue;
    }

    const column = METADATA_FIELD_MAPPING[field] ?? field;
    metadataUpdate[column] = transformForColumn(column, value);

    // When cover is selected, also populate coverLarge and cover so the UI picks it up.
    // The UI reads coverLarge ?? coverMedium ?? cover ?? coverUrl.
    if (column === 'coverUrl' && typeof value === 'string') {
      metadataUpdate['coverLarge'] = value;
      metadataUpdate['cover'] = value;
    }
  }

  return { metadataUpdate, mangaTitle, enrichedFields, sourcePreferences, providerSources };
}

/** Update an existing Metadata record with merged fields. */
async function updateExistingMetadata(
  prisma: PrismaClient,
  metadataId: number,
  metadataUpdate: Record<string, unknown>
): Promise<void> {
  await prisma.metadata.update({
    where: { id: metadataId },
    data: {
      ...metadataUpdate,
      source: 'merged',
      updatedAt: new Date()
    } as unknown as Prisma.MetadataUpdateInput
  });
}

/** Create a new Metadata record and link it to the manga. */
async function createNewMetadata(
  prisma: PrismaClient,
  mangaId: number,
  metadataUpdate: Record<string, unknown>
): Promise<void> {
  const newMetadata = await prisma.metadata.create({
    data: {
      ...metadataUpdate,
      source: 'merged',
      manga: { connect: { id: mangaId } }
    } as unknown as Prisma.MetadataCreateInput
  });

  await prisma.manga.update({
    where: { id: mangaId },
    data: { metadataId: newMetadata.id }
  });
}

/**
 * Find the best volume source from providers that actually have volume scraping capability.
 * 1. Check sourcePreferences (volumeCover/volumeTitle/volumeSummary) — most authoritative
 * 2. If 'volumes' field was explicitly assigned to a volume-capable provider, use it
 * 3. Else scan providerSources keys for a volume-capable provider
 * 4. Else fall back to primarySource
 */
function findVolumeCapableSource(
  selectedFields: Record<string, string>,
  providerSources: Record<string, string[]>,
  primarySource: string,
  sourcePreferences?: Record<string, string>
): string {
  // Source preferences (volumeCover, volumeTitle, volumeSummary) are the most authoritative
  // indicator of which provider the user wants for volume data
  if (sourcePreferences) {
    for (const key of ['volumeCover', 'volumeTitle', 'volumeSummary'] as const) {
      const pref = sourcePreferences[key];
      if (pref && VOLUME_CAPABLE_PROVIDERS.has(pref.toLowerCase())) {
        return pref;
      }
    }
  }

  const volumesProvider = selectedFields['volumes'];
  if (volumesProvider && VOLUME_CAPABLE_PROVIDERS.has(volumesProvider.toLowerCase())) {
    return volumesProvider;
  }
  for (const provider of Object.keys(providerSources)) {
    if (VOLUME_CAPABLE_PROVIDERS.has(provider.toLowerCase())) {
      return provider;
    }
  }
  return primarySource;
}

/**
 * Find the best chapter source from providers that actually have chapter scraping capability.
 * 1. Check sourcePreferences (chapterCover/chapterTitle/chapterSummary) — most authoritative
 * 2. If 'chapters' field was explicitly assigned to a volume-capable provider, use it
 * 3. Else scan providerSources keys for a volume-capable provider
 * 4. Else fall back to primarySource
 */
function findChapterCapableSource(
  selectedFields: Record<string, string>,
  providerSources: Record<string, string[]>,
  primarySource: string,
  sourcePreferences?: Record<string, string>
): string {
  // Source preferences (chapterCover, chapterTitle, chapterSummary) are the most authoritative
  // indicator of which provider the user wants for chapter data
  if (sourcePreferences) {
    for (const key of ['chapterCover', 'chapterTitle', 'chapterSummary'] as const) {
      const pref = sourcePreferences[key];
      if (pref && VOLUME_CAPABLE_PROVIDERS.has(pref.toLowerCase())) {
        return pref;
      }
    }
  }

  const chaptersProvider = selectedFields['chapters'];
  if (chaptersProvider && VOLUME_CAPABLE_PROVIDERS.has(chaptersProvider.toLowerCase())) {
    return chaptersProvider;
  }
  for (const provider of Object.keys(providerSources)) {
    if (VOLUME_CAPABLE_PROVIDERS.has(provider.toLowerCase())) {
      return provider;
    }
  }
  return primarySource;
}

/** Build the updated providerMetadata JSON with preferences, enriched fields, and merge audit. */
function buildProviderMetadataPayload(
  existingProviderMeta: unknown,
  sourcePreferences: Record<string, string>,
  enrichedFields: Record<string, unknown>,
  providerSources: Record<string, string[]>,
  fieldCount: number
): Record<string, unknown> {
  const pm = (existingProviderMeta ?? {}) as Record<string, unknown>;

  if (Object.keys(sourcePreferences).length > 0) {
    const existingPrefs = (pm['preferences'] ?? {}) as Record<string, unknown>;
    pm['preferences'] = { ...existingPrefs, ...sourcePreferences };
  }

  if (Object.keys(enrichedFields).length > 0) {
    const existing = (pm['enrichedFields'] ?? {}) as Record<string, unknown>;
    pm['enrichedFields'] = { ...existing, ...enrichedFields };
  }

  pm['_merged'] = {
    mergedAt: new Date().toISOString(),
    fieldSources: providerSources,
    fieldCount
  };

  // Update import profile so "Re-identify Metadata" uses the provider selections from this merge
  const selectedFields: Record<string, string> = {};
  for (const [provider, fields] of Object.entries(providerSources)) {
    for (const field of fields) {
      selectedFields[field] = provider;
    }
  }

  const primarySource = Object.entries(providerSources)
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? '';

  // Derive volumeSource/chapterSource from source preferences and provider capabilities.
  // Source preferences (volumeCover→comicvine, chapterTitle→fandom) are the authoritative
  // indicator of the user's intent for volume/chapter data sourcing.
  const volumeSource = findVolumeCapableSource(selectedFields, providerSources, primarySource, sourcePreferences);
  const chapterSource = findChapterCapableSource(selectedFields, providerSources, primarySource, sourcePreferences);

  const existingProfile = (pm['importProfile'] ?? {}) as Record<string, unknown>;
  pm['importProfile'] = {
    ...existingProfile,
    primarySource,
    volumeSource,
    chapterSource,
    selectedFields,
    sourcePreferences,
    updatedAt: new Date().toISOString(),
  };

  return pm;
}

/** Require a manga record or throw NOT_FOUND. */
async function requireManga(
  prisma: PrismaClient,
  mangaId: number
): Promise<{ id: number; title: string; providerMetadata: unknown; Metadata: { id: number } | null }> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Metadata: { select: { id: true } } }
  });

  if (!manga) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Manga with ID ${mangaId} not found.` });
  }

  return manga;
}

// ============================================================================
// Router
// ============================================================================

export const providerMergeRouter = router({
  /** Update provider preferences for a manga */
  updateProviderPreferences: protectedProcedure
    .input(updateProviderPreferencesSchema)
    .mutation(async ({ input, ctx }): Promise<unknown> => {
      const { id, preferences } = input;
      logger.info(`Updating provider preferences for manga ID ${id}`);

      const manga = await requireManga(ctx.prisma, id);

      const providerMetadata = (manga.providerMetadata ?? {}) as Record<string, unknown>;
      const updated = { ...providerMetadata, preferences };

      const updatedManga = await ctx.prisma.manga.update({
        where: { id },
        data: { providerMetadata: updated as unknown as Prisma.InputJsonValue },
        include: { Metadata: true }
      });

      logger.info(`Successfully updated provider preferences for manga: ${manga.title} (ID: ${id})`);
      await invalidateMangaCache(id);
      return updatedManga;
    }),

  /** Merge metadata from multiple providers based on field selections */
  mergeMetadataFromProviders: protectedProcedure
    .input(mergeMetadataFromProvidersSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string; fieldSources: Record<string, string[]> }> => {
      const { mangaId, fieldSelections } = input;
      logger.info(`Merging metadata from providers for manga ID ${mangaId}, ${fieldSelections.length} fields selected`);

      const manga = await requireManga(ctx.prisma, mangaId);

      const { metadataUpdate, mangaTitle, enrichedFields, sourcePreferences, providerSources } =
        categorizeFieldSelections(fieldSelections);

      // Update Manga title if selected
      if (mangaTitle !== null) {
        await ctx.prisma.manga.update({ where: { id: mangaId }, data: { title: mangaTitle } });
      }

      // Upsert Metadata model fields
      if (Object.keys(metadataUpdate).length > 0) {
        if (manga.Metadata) {
          await updateExistingMetadata(ctx.prisma, manga.Metadata.id, metadataUpdate);
        } else {
          await createNewMetadata(ctx.prisma, mangaId, metadataUpdate);
        }
      }

      // Persist source preferences, enriched fields, and merge audit in providerMetadata JSON
      const payload = buildProviderMetadataPayload(
        manga.providerMetadata, sourcePreferences, enrichedFields, providerSources, fieldSelections.length
      );
      await ctx.prisma.manga.update({
        where: { id: mangaId },
        data: { providerMetadata: payload as Prisma.InputJsonValue }
      });

      logger.info(`Successfully merged metadata for manga ID ${mangaId}`);
      await invalidateMangaCache(mangaId);
      await eventEmitter.emit('manga:updated', { mangaId });

      return {
        success: true,
        message: `Successfully merged ${fieldSelections.length} fields from ${Object.keys(providerSources).length} providers`,
        fieldSources: providerSources
      };
    })
});
