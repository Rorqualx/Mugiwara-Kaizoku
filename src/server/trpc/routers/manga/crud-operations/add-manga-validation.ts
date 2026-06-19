/**
 * Add Manga Validation Helpers
 *
 * Helper functions for validating and preparing manga data during import.
 * Extracted from crudOperations.ts to reduce complexity.
 *
 * Helpers:
 * - validateLibrary: Verify library exists and get path
 * - checkMangaDuplicate: Check for duplicate manga titles
 * - createMangaMetadata: Create metadata record
 * - buildMangaCreateData: Build Prisma create data
 * - createAutoDownloadRule: Create monitoring rule
 * - logMangaMetadataCounts: Log metadata verification
 * - logRawProviderData: Log provider data verification
 */

import * as path from 'path';

import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';


import { resolveExistingManga } from '@/server/services/library/manga-identity-resolver';
import { createMetadata, type MetadataInput } from '@/server/services/manga/metadataBuilder';
import { logger } from '@/utils/logger';

import {
  type MangaWithRelations,
  safeGet,
  safeGetString,
  safeGetNumber
} from '../shared';

import type { PrismaClient, Manga, Library } from '@prisma/client';

/**
 * Input type for add manga validation functions
 */
export interface AddMangaInput {
  title: string;
  source: string;
  libraryId: number;
  mangaId?: string | null;
  mlCorrected?: boolean;
  selectedSourceId?: string | null;
  metadataConfidence?: number | null;
  searchProvider?: string;
  interval?: string;
  downloadConfig?: Record<string, unknown>;
  metadata?: MetadataInput;
  providerMetadata?: unknown;
  rawProviderData?: unknown;
  /** Optional local path to the manga folder (from scan results) */
  localPath?: string;
}

/**
 * Validate that the library exists and return its details
 *
 * @param prisma - Prisma client instance
 * @param libraryId - ID of the library to validate
 * @returns Library with id and path
 * @throws TRPCError if library not found
 */
export async function validateLibrary(
  prisma: PrismaClient,
  libraryId: number
): Promise<Library> {
  const library = await prisma.library.findUnique({
    where: { id: libraryId }
  });

  if (!library) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Library not found.'
    });
  }

  return library;
}

/**
 * Find an existing shared manga that represents the same incoming title, for
 * deduplication. The catalog is a single shared content layer, so a title that
 * another user already added should be LINKED into the caller's library rather
 * than re-created + re-downloaded.
 *
 * Maps the add input onto the identity keys used by {@link resolveExistingManga}
 * (Metadata source+sourceId → Manga.sourceId → case-insensitive title).
 *
 * @returns The existing shared Manga, or null when this is a genuinely new title.
 */
export async function findExistingMangaForLink(
  prisma: PrismaClient,
  input: AddMangaInput
): Promise<Manga | null> {
  const metadataSourceId =
    (input.metadata as { sourceId?: string | null } | undefined)?.sourceId ??
    input.mangaId ??
    null;

  return resolveExistingManga(prisma, {
    title: input.title,
    sourceId: input.mangaId ?? null,
    metadataSource: input.searchProvider ?? input.source,
    metadataSourceId
  });
}

/**
 * True when an error is a Prisma unique-constraint violation (P2002). Used to
 * recover from the add race where two users create the same shared title
 * concurrently — the loser links the winner's row instead of failing.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Create metadata record if metadata is provided
 *
 * @param prisma - Prisma client instance
 * @param metadata - Metadata to create
 * @param rawProviderData - Raw provider data for metadata
 * @returns Metadata ID if created, undefined otherwise
 */
export async function createMangaMetadata(
  prisma: PrismaClient,
  metadata: MetadataInput | undefined,
  rawProviderData: unknown
): Promise<number | undefined> {
  if (!metadata) {
    return undefined;
  }

  return createMetadata(prisma, metadata, rawProviderData);
}

/**
 * Build the Prisma create data object for a new manga
 *
 * @param input - Add manga input
 * @param libraryPath - Path of the library (fallback if localPath not provided)
 * @param metadataId - Optional metadata ID
 * @returns Prisma create data object
 */
export function buildMangaCreateData(
  input: AddMangaInput,
  libraryPath: string,
  metadataId: number | undefined
): Prisma.MangaCreateInput {
  const sourceId = input.mangaId ?? null;
  const mlCorrected = input.mlCorrected ?? false;
  const selectedSourceId = input.selectedSourceId ?? null;
  const metadataConfidence = input.metadataConfidence ?? null;
  const searchProvider = input.searchProvider ?? input.source;

  // Use localPath if provided (from scan results), otherwise generate manga-specific path
  // This ensures unique (libraryId, libraryPath) for each manga to satisfy the unique constraint
  const effectiveLibraryPath = input.localPath ?? path.join(libraryPath, input.title);

  // Build the create data object with conditional spreading
  const createData: Record<string, unknown> = {
    title: input.title,
    source: input.source,
    searchProvider,
    Library: {
      connect: { id: input.libraryId }
    },
    libraryPath: effectiveLibraryPath,
    monitoringConfig: JSON.stringify({
      interval: input.interval ?? 'daily',
      overrideGlobal: false,
      ...(input.downloadConfig ?? {})
    }),
    mlCorrected,
    updatedAt: new Date()
  };

  // Add optional fields using nullish coalescing
  if (sourceId !== null) {
    createData['sourceId'] = sourceId;
  }

  if (metadataId !== undefined) {
    createData['Metadata'] = {
      connect: { id: metadataId }
    };
  }

  if (selectedSourceId !== null) {
    createData['selectedSourceId'] = selectedSourceId;
  }

  if (metadataConfidence !== null) {
    createData['metadataConfidence'] = metadataConfidence;
  }

  if (input.providerMetadata !== undefined) {
    createData['providerMetadata'] = input.providerMetadata as Prisma.InputJsonValue;
  }

  if (input.rawProviderData !== undefined) {
    createData['rawProviderData'] = input.rawProviderData as Prisma.InputJsonValue;
  }

  return createData as unknown as Prisma.MangaCreateInput;
}

/**
 * Create AutoDownloadRule to enable monitoring by default
 *
 * @param prisma - Prisma client instance
 * @param mangaId - ID of the manga to create rule for
 */
export async function createAutoDownloadRule(
  prisma: PrismaClient,
  mangaId: number
): Promise<void> {
  try {
    // @ts-expect-error - AutoDownloadRule model not yet implemented in schema.prisma
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await (prisma as unknown).autoDownloadRule.create({
      data: {
        mangaId,
        enabled: true,
        checkInterval: 3600 // 1 hour (matches scheduler default)
      }
    });
    logger.info(`Created AutoDownloadRule for manga ${mangaId} with monitoring enabled`);
  } catch (error) {
    // Log but don't fail the import if AutoDownloadRule creation fails
    logger.error(`Failed to create AutoDownloadRule for manga ${mangaId}:`, error);
  }
}

/**
 * Log verification for metadata counts
 *
 * @param manga - Manga with relations
 * @param inputMetadata - Original input metadata
 */
export function logMangaMetadataCounts(
  manga: MangaWithRelations,
  inputMetadata: MetadataInput | undefined
): void {
  logger.info(`Manga metadata saved with counts:`, {
    mangaId: manga.id,
    title: manga.title,
    metadataId: manga.metadataId,
    persistedVolumes: manga.Metadata?.volumes,
    persistedChapters: manga.Metadata?.chapters,
    persistedBanner: manga.Metadata?.bannerImage,
    inputVolumes: inputMetadata?.volumes,
    inputChapters: inputMetadata?.chapters,
    inputBanner: inputMetadata?.bannerImage
  });
}

/**
 * Log rawProviderData verification
 *
 * @param rawProviderData - Raw provider data from manga record
 * @param mangaId - ID of the manga for logging
 */
export function logRawProviderData(
  rawProviderData: Prisma.JsonValue | null,
  mangaId: number
): void {
  if (rawProviderData) {
    try {
      const rawData: unknown = typeof rawProviderData === 'string'
        ? JSON.parse(rawProviderData)
        : rawProviderData;
      const volumes = safeGet(rawData, 'volumes');
      const firstVolume: unknown = Array.isArray(volumes) && volumes.length > 0 ? volumes[0] : undefined;

      logger.info('rawProviderData successfully stored:', {
        hasVolumes: !!volumes,
        volumesLength: Array.isArray(volumes) ? volumes.length : 0,
        totalVolumes: safeGetNumber(rawData, 'totalVolumes'),
        totalChapters: safeGetNumber(rawData, 'totalChapters'),
        selectedCover: safeGetString(rawData, 'selectedCover'),
        selectedBanner: safeGetString(rawData, 'selectedBanner'),
        firstVolumeTitle: safeGetString(firstVolume, 'title'),
        firstVolumeChapters: Array.isArray(safeGet(firstVolume, 'chapters'))
          ? (safeGet(firstVolume, 'chapters') as unknown[]).length
          : 0
      });
    } catch (e) {
      logger.error('Failed to parse rawProviderData:', e);
    }
  } else {
    logger.warn('No rawProviderData was stored for manga:', mangaId);
  }
}

/**
 * Log provider metadata verification
 *
 * @param providerMetadata - Provider metadata to log
 */
export function logProviderMetadata(providerMetadata: unknown): void {
  if (providerMetadata) {
    const metadata = providerMetadata as Record<string, unknown>;
    logger.info(`Received providerMetadata with ${Object.keys(metadata).length} entries`);
    Object.keys(metadata).forEach((key) => {
      const meta = metadata[key];
      logger.info(`  Provider ${key}: ${JSON.stringify(meta).substring(0, 100)}...`);
    });
  } else {
    logger.warn('No providerMetadata received in add manga request');
  }
}

/**
 * Parse selectedSourceId to understand mixed provider configuration
 *
 * @param selectedSourceId - Selected source ID string (may be JSON)
 * @returns Parsed provider configuration
 */
export function parseSelectedProviders(selectedSourceId: string | null | undefined): unknown {
  if (!selectedSourceId) {
    return {};
  }

  try {
    return JSON.parse(selectedSourceId);
  } catch {
    // If not JSON, it's a single provider
    return {
      default: selectedSourceId
    };
  }
}
