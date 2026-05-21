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

import { TRPCError } from '@trpc/server';


import { createMetadata, type MetadataInput } from '@/server/services/manga/metadataBuilder';
import { logger } from '@/utils/logger';

import {
  type MangaWithRelations,
  safeGet,
  safeGetString,
  safeGetNumber
} from '../shared';

import type { PrismaClient, Prisma, Library } from '@prisma/client';

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
 * Check if a manga with the same title already exists (case-insensitive)
 *
 * @param prisma - Prisma client instance
 * @param title - Title to check for duplicates
 * @throws TRPCError if duplicate found
 */
export async function checkMangaDuplicate(
  prisma: PrismaClient,
  title: string
): Promise<void> {
  // Case-insensitive search to catch variations like "Dorohedoro" vs "dorohedoro"
  const existingManga = await prisma.manga.findFirst({
    where: {
      title: {
        equals: title,
        mode: 'insensitive'
      }
    }
  });

  if (existingManga) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `A manga titled "${existingManga.title}" already exists in your library. Please check your library or use a different title.`
    });
  }
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
