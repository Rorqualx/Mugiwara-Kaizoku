/**
 * Metadata Validation Service
 *
 * Comprehensive validation service for unified metadata. Provides both
 * runtime validation and sanitization of metadata from various sources.
 */
import { MangaFormat } from '@prisma/client';
import { MangaPublicationStatus } from '@prisma/client';
import { z } from 'zod';

import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';


// Import validation utilities
import {
  mergeProcessedFields
} from './validation/field-processors';
import {
  validateVolumeCount,
  validateChapterVolumeConsistency,
  validateDateConsistency,
  validateReleaseYearConsistency,
  validateTitle,
  validateAdultContentWarnings,
  validateScoreRange,
  calculateCompleteness,
  calculateConfidence
} from './validation/validation-rules';


import type {
  UnifiedMangaMetadata,
  PartialUnifiedMetadata,
  MetadataValidationError,
  MetadataValidationWarning,
  ValidationData
} from './validation/types';

type MetadataValidationResult = AsyncResult<ValidationData, Error>;

/**
 * Zod schemas for runtime validation
 */
// Person info schema
const PersonInfoSchema = z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    image: z.string().url().optional().or(z.string())
});
// Staff info schema
const StaffInfoSchema = PersonInfoSchema.extend({
    position: z.string().min(1)
});
// Character info schema
const CharacterInfoSchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().min(1),
    role: z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND']).optional(),
    image: z.string().optional(),
    description: z.string().optional()
});
// Tag info schema
const TagInfoSchema = z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    rank: z.number().optional(),
    isMediaSpoiler: z.boolean().optional(),
    isGeneralSpoiler: z.boolean().optional(),
    description: z.string().optional()
});
// Ranking info schema
const RankingInfoSchema = z.object({
    type: z.enum(['POPULAR', 'RATED', 'TRENDING', 'FAVORITED']),
    rank: z.number().positive(),
    context: z.enum(['ALL_TIME', 'YEARLY', 'SEASONAL', 'MONTHLY', 'WEEKLY']),
    year: z.number().optional(),
    season: z.enum(['WINTER', 'SPRING', 'SUMMER', 'FALL']).optional()
});
// External link schema
const ExternalLinkSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    url: z.string().url(),
    site: z.string().min(1),
    type: z.enum(['INFO', 'STREAMING', 'SOCIAL', 'OTHER']).optional(),
    language: z.string().optional()
});
// Cover images schema
const CoverImagesSchema = z.object({
    original: z.string(),
    large: z.string().optional(),
    medium: z.string().optional(),
    small: z.string().optional(),
    thumbnail: z.string().optional(),
    color: z.string().optional()
});
// Volume info schema
const VolumeInfoSchema = z.object({
    number: z.number(),
    title: z.string().optional(),
    chapters: z.array(z.lazy(() => ChapterInfoSchema)).optional(),
    coverImage: z.string().optional(),
    releaseDate: z.union([z.date(), z.string()]).optional(),
    isbn: z.string().optional(),
    pageCount: z.number().optional()
});
// Chapter info schema
const ChapterInfoSchema = z.object({
    number: z.number(),
    title: z.string().optional(),
    volume: z.number().optional(),
    releaseDate: z.union([z.date(), z.string()]).optional(),
    coverImage: z.string().optional(),
    description: z.string().optional(),
    pageCount: z.number().optional(),
    language: z.string().optional(),
    scanlationGroup: z.string().optional(),
    externalUrl: z.string().optional()
});
// External IDs schema
const ExternalIdsSchema = z.object({
    anilist: z.number().optional(),
    mal: z.number().optional(),
    mangaupdates: z.string().optional(),
    comicvine: z.string().optional(),
    kitsu: z.string().optional(),
    novelupdates: z.string().optional(),
    goodreads: z.string().optional(),
    isbn: z.string().optional(),
    amazonId: z.string().optional()
});
// Metadata quality schema
const MetadataQualitySchema = z.object({
    completeness: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    lastUpdated: z.date(),
    lastValidated: z.date().optional(),
    sources: z.array(z.string()).min(1),
    version: z.number()
});
// Provider metadata schema
const ProviderMetadataSchema = z.object({
    provider: z.string().min(1),
    providerId: z.union([z.string(), z.number()]),
    confidence: z.number().min(0).max(1),
    lastFetched: z.date(),
    rawData: z.record(z.unknown()).optional(),
    extractedData: z.record(z.unknown())
});
// Partial unified metadata schema (all fields optional)
export const PartialUnifiedMetadataSchema = z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    alternativeTitles: z.array(z.string()).optional(),
    covers: CoverImagesSchema.optional(),
    bannerImage: z.string().optional(),
    description: z.string().optional(),
    summary: z.string().optional(),
    status: z.nativeEnum(MangaPublicationStatus).optional(),
    format: z.string().optional(),
    volumes: z.number().nullable().optional(),
    chapters: z.number().nullable().optional(),
    volumeDetails: z.array(VolumeInfoSchema).optional(),
    chapterDetails: z.array(ChapterInfoSchema).optional(),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
    releaseYear: z.number().nullable().optional(),
    authors: z.array(PersonInfoSchema).optional(),
    artists: z.array(PersonInfoSchema).optional(),
    staff: z.array(StaffInfoSchema).optional(),
    characters: z.array(CharacterInfoSchema).optional(),
    genres: z.array(z.string()).optional(),
    tags: z.array(TagInfoSchema).optional(),
    themes: z.array(z.string()).optional(),
    demographics: z.array(z.string()).optional(),
    averageScore: z.number().min(0).max(100).nullable().optional(),
    popularity: z.number().nullable().optional(),
    rankings: z.array(RankingInfoSchema).optional(),
    favorites: z.number().optional(),
    publisher: z.string().nullable().optional(),
    serialization: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    originalLanguage: z.string().nullable().optional(),
    isAdult: z.boolean().optional(),
    contentWarnings: z.array(z.string()).optional(),
    ageRating: z.string().optional(),
    externalIds: ExternalIdsSchema.optional(),
    externalLinks: z.array(ExternalLinkSchema).optional(),
    primarySource: z.string().optional(),
    providerMetadata: z.array(ProviderMetadataSchema).optional(),
    metadataQuality: MetadataQualitySchema.optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    lastSyncedAt: z.date().optional()
});
// Complete unified metadata schema (required fields)
export const UnifiedMetadataSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    alternativeTitles: z.array(z.string()),
    covers: CoverImagesSchema,
    bannerImage: z.string().optional(),
    description: z.string(),
    summary: z.string().optional(),
    status: z.nativeEnum(MangaPublicationStatus),
    format: z.nativeEnum(MangaFormat),
    volumes: z.number().nullable(),
    chapters: z.number().nullable(),
    volumeDetails: z.array(VolumeInfoSchema).optional(),
    chapterDetails: z.array(ChapterInfoSchema).optional(),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
    releaseYear: z.number().nullable(),
    authors: z.array(PersonInfoSchema),
    artists: z.array(PersonInfoSchema),
    staff: z.array(StaffInfoSchema),
    characters: z.array(CharacterInfoSchema),
    genres: z.array(z.string()),
    tags: z.array(TagInfoSchema),
    themes: z.array(z.string()),
    demographics: z.array(z.string()),
    averageScore: z.number().min(0).max(100).nullable(),
    popularity: z.number().nullable(),
    rankings: z.array(RankingInfoSchema),
    favorites: z.number().optional(),
    publisher: z.string().nullable(),
    serialization: z.string().nullable(),
    countryOfOrigin: z.string().nullable(),
    originalLanguage: z.string().nullable(),
    isAdult: z.boolean(),
    contentWarnings: z.array(z.string()),
    ageRating: z.string().optional(),
    externalIds: ExternalIdsSchema,
    externalLinks: z.array(ExternalLinkSchema),
    primarySource: z.string(),
    providerMetadata: z.array(ProviderMetadataSchema),
    metadataQuality: MetadataQualitySchema,
    createdAt: z.date(),
    updatedAt: z.date(),
    lastSyncedAt: z.date().optional()
});

/**
 * Metadata validation service
 */
export class MetadataValidationService {
    private readonly logger = logger;

    /**
     * Validate partial metadata
     */
    validatePartial(metadata: unknown): MetadataValidationResult {
        const errors: MetadataValidationError[] = [];
        const warnings: MetadataValidationWarning[] = [];
        try {
            // Parse with Zod
            const parsed = PartialUnifiedMetadataSchema.parse(metadata);
            const typedParsed = parsed as unknown as PartialUnifiedMetadata;

            // Additional business logic validation
            this.validateBusinessRules(typedParsed, errors, warnings);
            // Calculate completeness
            const completeness = calculateCompleteness(typedParsed);
            // Calculate confidence
            const parsedWithQuality = typedParsed as { metadataQuality?: { confidence?: number } };
            const confidence = parsedWithQuality.metadataQuality?.confidence ??
                calculateConfidence(typedParsed, errors, warnings);

            const hasCriticalErrors = errors.filter(e => e.severity === 'critical').length > 0;

            if (hasCriticalErrors) {
                return createErrorResult(
                    createContextualError(
                        'Validation failed with critical errors',
                        'VALIDATION_CRITICAL_ERROR',
                        { errors, warnings, completeness, confidence }
                    )
                );
            }

            return createSuccessResult({
                errors,
                warnings,
                completeness,
                confidence
            });
        }
        catch (error: unknown) {
            if (error instanceof z.ZodError) {
                // Convert Zod errors to our format
                const metadataRecord = metadata as Record<string, unknown>;
                for (const issue of error.issues) {
                    const firstPathElement = issue.path[0];
                    errors.push({
                        field: issue.path.join('.'),
                        message: issue.message,
                        severity: 'error',
                        value: firstPathElement !== undefined ? metadataRecord[firstPathElement] : undefined
                    });
                }
                return createErrorResult(
                    createContextualError(
                        'Schema validation failed',
                        'SCHEMA_VALIDATION_ERROR',
                        { errors, warnings }
                    )
                );
            }
            else {
                return createErrorResult(
                    createContextualError(
                        error instanceof Error ? error.message : 'Unknown validation error',
                        'VALIDATION_ERROR'
                    )
                );
            }
        }
    }

    /**
     * Validate complete metadata
     */
    validateComplete(metadata: unknown): MetadataValidationResult {
        const errors: MetadataValidationError[] = [];
        const warnings: MetadataValidationWarning[] = [];
        try {
            // Parse with Zod
            const parsed = UnifiedMetadataSchema.parse(metadata);
            const typedParsed = parsed as unknown as UnifiedMangaMetadata & PartialUnifiedMetadata;

            // Additional business logic validation
            this.validateBusinessRules(typedParsed, errors, warnings);
            // Calculate completeness
            const completeness = calculateCompleteness(typedParsed);
            // Calculate confidence
            const confidence = parsed.metadataQuality.confidence;

            const hasCriticalErrors = errors.filter(e => e.severity === 'critical').length > 0;

            if (hasCriticalErrors) {
                return createErrorResult(
                    createContextualError(
                        'Validation failed with critical errors',
                        'VALIDATION_CRITICAL_ERROR',
                        { errors, warnings, completeness, confidence }
                    )
                );
            }

            return createSuccessResult({
                errors,
                warnings,
                completeness,
                confidence
            });
        }
        catch (error: unknown) {
            if (error instanceof z.ZodError) {
                // Convert Zod errors to our format
                const metadataRecord = metadata as Record<string, unknown>;
                for (const issue of error.issues) {
                    const firstPathElement = issue.path[0];
                    errors.push({
                        field: issue.path.join('.'),
                        message: issue.message,
                        severity: 'critical',
                        value: firstPathElement !== undefined ? metadataRecord[firstPathElement] : undefined
                    });
                }
                return createErrorResult(
                    createContextualError(
                        'Schema validation failed',
                        'SCHEMA_VALIDATION_ERROR',
                        { errors, warnings }
                    )
                );
            }
            else {
                return createErrorResult(
                    createContextualError(
                        error instanceof Error ? error.message : 'Unknown validation error',
                        'VALIDATION_ERROR'
                    )
                );
            }
        }
    }

    /**
     * Sanitize and fix common metadata issues
     */
    sanitize(metadata: unknown): PartialUnifiedMetadata {
        if (!metadata || typeof metadata !== 'object') {
            return {};
        }
        const input = metadata as Record<string, unknown>;

        // Process all field types and merge results
        return mergeProcessedFields(input);
    }

    /**
     * Validate business rules
     */
    private validateBusinessRules(
        metadata: PartialUnifiedMetadata,
        errors: MetadataValidationError[],
        warnings: MetadataValidationWarning[]
    ): void {
        validateVolumeCount(metadata.volumes, warnings);
        validateChapterVolumeConsistency(metadata.chapters, metadata.volumes, warnings);
        validateDateConsistency(metadata.startDate, metadata.endDate, errors);
        validateReleaseYearConsistency(metadata.releaseYear, metadata.startDate, warnings);
        validateTitle(metadata.title, errors);
        validateAdultContentWarnings(metadata.isAdult, metadata.contentWarnings, warnings);
        validateScoreRange(metadata.averageScore, errors);
    }
}
