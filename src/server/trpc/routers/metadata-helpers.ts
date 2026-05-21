/**
 * Metadata Router Helper Functions
 *
 * Extracted helper functions to reduce complexity in metadata router procedures.
 * These functions handle common patterns like field value conversion, metadata parsing,
 * and provider metadata management.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Type for metadata update fields
 */
export type MetadataUpdateFields = {
  [key: string]: string | number | boolean | Date | string[] | Array<{ name: string }> | null;
};

/**
 * Provider metadata structure interface
 */
export interface ProviderMetadata {
  metadataProvenance?: Record<string, string>;
  preferences?: Record<
    string,
    {
      provider: string;
      value: unknown;
    }
  >;
  [key: string]: unknown;
}

/**
 * Array field names in metadata
 */
const ARRAY_FIELDS = ['genres', 'authors', 'tags', 'characters', 'synonyms', 'urls'] as const;
const DATE_FIELDS = ['startDate', 'endDate'] as const;

/**
 * Check if a field name is an array field
 */
function isArrayField(fieldName: string): boolean {
  return ARRAY_FIELDS.includes(fieldName as typeof ARRAY_FIELDS[number]);
}

/**
 * Check if a field name is a date field
 */
function isDateField(fieldName: string): boolean {
  return DATE_FIELDS.includes(fieldName as typeof DATE_FIELDS[number]);
}

/**
 * Convert resolution value to appropriate type for array fields
 */
function convertToArrayValue(resolutionValue: unknown): string[] {
  if (Array.isArray(resolutionValue)) {
    return resolutionValue as string[];
  }
  const valueStr = typeof resolutionValue === 'string' ? resolutionValue : String(resolutionValue);
  return [valueStr];
}

/**
 * Convert resolution value to Date object
 */
function convertToDateValue(resolutionValue: unknown): Date {
  if (resolutionValue instanceof Date) {
    return resolutionValue;
  }
  if (typeof resolutionValue === 'string') {
    const parsedDate = new Date(resolutionValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
    logger.warn(`Invalid date value: ${resolutionValue}, using current date`);
  }
  return new Date();
}

/**
 * Convert resolution value to appropriate type for primitive fields
 */
function convertToPrimitiveValue(
  resolutionValue: unknown
): string | number | boolean | null {
  if (
    typeof resolutionValue === 'string' ||
    typeof resolutionValue === 'number' ||
    typeof resolutionValue === 'boolean'
  ) {
    return resolutionValue;
  }
  if (resolutionValue === null) {
    return null;
  }
  return String(resolutionValue);
}

/**
 * Convert resolution value to appropriate type based on field name
 */
export function convertFieldValue(
  fieldName: string,
  resolutionValue: unknown
): string | number | boolean | Date | string[] | null {
  if (isArrayField(fieldName)) {
    return convertToArrayValue(resolutionValue);
  }
  if (isDateField(fieldName)) {
    return convertToDateValue(resolutionValue);
  }
  return convertToPrimitiveValue(resolutionValue);
}

/**
 * Parse provider metadata from manga record
 */
export function parseProviderMetadata(
  providerMetadata: unknown
): ProviderMetadata {
  let parsed: ProviderMetadata = {};

  try {
    if (!providerMetadata) {
      return parsed;
    }

    if (typeof providerMetadata === 'string') {
      const parsedData: unknown = JSON.parse(providerMetadata);
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        parsed = parsedData as ProviderMetadata;
      }
    } else if (typeof providerMetadata === 'object') {
      parsed = providerMetadata as ProviderMetadata;
    }
  } catch (parseError: unknown) {
    logger.error(
      `Error parsing provider metadata: ${parseError instanceof Error ? parseError.message : String(parseError)}`
    );
  }

  return parsed;
}

/**
 * Update metadata with conflict resolution
 */
export async function updateMetadataWithResolution(
  metadataId: number,
  fieldName: string,
  resolutionValue: unknown
): Promise<AsyncResult<void, Error>> {
  try {
    const metadata = await prisma.metadata.findUnique({
      where: { id: metadataId },
    });

    if (!metadata) {
      return createErrorResult(new Error('Metadata not found'));
    }

    const updateData: MetadataUpdateFields = {};
    updateData[fieldName] = convertFieldValue(fieldName, resolutionValue);

    await prisma.metadata.update({
      where: { id: metadataId },
      data: updateData,
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating metadata: ${errorMessage}`);
    return createErrorResult(new Error(`Failed to update metadata: ${errorMessage}`));
  }
}

/**
 * Update manga provider metadata with field preference
 */
export async function updateMangaProviderPreference(
  mangaId: number,
  fieldName: string,
  resolutionProvider: string,
  resolutionValue: unknown
): Promise<AsyncResult<void, Error>> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
    });

    if (!manga) {
      return createErrorResult(new Error('Manga not found'));
    }

    const providerMetadata = parseProviderMetadata(manga.providerMetadata);

    if (!providerMetadata.preferences || typeof providerMetadata.preferences !== 'object') {
      providerMetadata.preferences = {};
    }

    providerMetadata.preferences[fieldName] = {
      provider: resolutionProvider,
      value: resolutionValue,
    };

    await prisma.manga.update({
      where: { id: mangaId },
      data: {
        providerMetadata: providerMetadata as Prisma.InputJsonValue,
      },
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating manga provider preference: ${errorMessage}`);
    return createErrorResult(new Error(`Failed to update preference: ${errorMessage}`));
  }
}
