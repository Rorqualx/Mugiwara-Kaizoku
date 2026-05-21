/**
 * Data Validators
 * 
 * This file contains specific validators for domain entities
 * to ensure type safety when working with data from external sources.
 */

import { MangaPublicationStatus as MangaStatus, ChapterStatus } from '@prisma/client';

import type { LibraryEntity } from '@/types/search.types';



import * as schema from '../schema-validation';
import * as guards from '../type-guards';

import type { Manga, Chapter} from '@prisma/client';

/**
 * Validate manga metadata
 */
export function validateMangaMetadata(data: unknown): schema.ValidationResult {
  const mangaMetadataSchema: schema.ValidationSchema = {
    title: schema.string({ required: true }),
    alternativeTitles: schema.array(schema.string(), { required: false }),
    description: schema.string({ required: false }),
    coverUrl: schema.string({ required: false }),
    coverThumbnail: schema.string({ required: false }),
    status: schema.enumValidator(MangaStatus, { required: false }),
    chapters: schema.number({ integer: true, min: 0, required: false }),
    volumes: schema.number({ integer: true, min: 0, required: false }),
    authors: schema.array(schema.string(), { required: false }),
    artists: schema.array(schema.string(), { required: false }),
    genres: schema.array(schema.string(), { required: false }),
    tags: schema.array(schema.string(), { required: false }),
    releaseYear: schema.number({ integer: true, min: 1900, required: false }),
    publisher: schema.string({ required: false }),
    language: schema.string({ required: false }),
    links: schema.array(
      schema.object({
        url: schema.string({ required: true }),
        site: schema.string({ required: true }),
        label: schema.string({ required: false })
      }),
      { required: false }
    ),
    rating: schema.number({ min: 0, max: 10, required: false }),
    isNsfw: schema.boolean({ required: false }),
    startDate: schema.date({ required: false }),
    endDate: schema.date({ required: false }),
    lastUpdated: schema.date({ required: false })
  };

  return schema.validateSchema(data, mangaMetadataSchema);
}

/**
 * Validate manga entity
 */
export function validateMangaEntity(data: unknown): schema.ValidationResult {
  const mangaSchema: schema.ValidationSchema = {
    id: schema.union([
      schema.string(),
      schema.number({ integer: true })
    ], { required: true }),
    title: schema.string({ required: true }),
    source: schema.string({ required: false }),
    status: schema.enumValidator(MangaStatus, { required: true }),
    libraryId: schema.number({ integer: true, required: true }),
    libraryPath: schema.string({ required: false }),
    lastChecked: schema.date({ required: false }),
    lastSyncAt: schema.date({ required: false }),
    lastErrorAt: schema.date({ required: false }),
    metadata: schema.object(
      {},
      { required: true, allowUnknown: true }
    ),
    providerMetadata: schema.array(
      schema.object({
        providerId: schema.string({ required: true }),
        externalId: schema.string({ required: false }),
        url: schema.string({ required: false }),
        metadata: schema.object({}, { required: true, allowUnknown: true }),
        lastFetched: schema.date({ required: false })
      }),
      { required: false }
    ),
    monitoringConfig: schema.object({
      isMonitored: schema.boolean({ required: true }),
      interval: schema.union([
        schema.string({ required: true }),
        schema.enumValidator({
          daily: 'daily',
          weekly: 'weekly',
          monthly: 'monthly',
          custom: 'custom'
        })
      ], { required: false }),
      customIntervalDays: schema.number({ integer: true, min: 1, required: false }),
      notifyOnNew: schema.boolean({ required: false }),
      autoDownload: schema.boolean({ required: false }),
      qualityPreference: schema.string({ required: false })
    }, { required: false }),
    createdAt: schema.date({ required: false }),
    updatedAt: schema.date({ required: false })
  };

  return schema.validateSchema(data, mangaSchema);
}

/**
 * Validate chapter entity
 */
export function validateChapterEntity(data: unknown): schema.ValidationResult {
  const chapterSchema: schema.ValidationSchema = {
    id: schema.union([
      schema.string(),
      schema.number({ integer: true })
    ], { required: true }),
    title: schema.string({ required: true }),
    mangaId: schema.number({ integer: true, required: true }),
    index: schema.number({ required: true }),
    volume: schema.number({ required: false }),
    language: schema.string({ required: false }),
    downloadStatus: schema.enumValidator(ChapterStatus, { required: true }),
    file: schema.object({
      fileName: schema.string({ required: true }),
      path: schema.string({ required: false }),
      size: schema.number({ min: 0, required: true }),
      pageCount: schema.number({ integer: true, min: 0, required: false }),
      resolution: schema.object({
        width: schema.number({ integer: true, min: 0, required: false }),
        height: schema.number({ integer: true, min: 0, required: false }),
        label: schema.string({ required: false })
      }, { required: false }),
      format: schema.string({ required: false })
    }, { required: false }),
    releaseDate: schema.date({ required: false }),
    isSpecial: schema.boolean({ required: false }),
    readAt: schema.date({ required: false }),
    isSyncRequired: schema.boolean({ required: false }),
    createdAt: schema.date({ required: false }),
    updatedAt: schema.date({ required: false })
  };

  return schema.validateSchema(data, chapterSchema);
}

/**
 * Validate library entity
 */
export function validateLibraryEntity(data: unknown): schema.ValidationResult {
  const librarySchema: schema.ValidationSchema = {
    id: schema.union([
      schema.string(),
      schema.number({ integer: true })
    ], { required: true }),
    name: schema.string({ required: true }),
    path: schema.string({ required: true }),
    description: schema.string({ required: false }),
    settings: schema.object({
      autoScan: schema.boolean({ required: false }),
      scanInterval: schema.union([
        schema.string({ required: true }),
        schema.enumValidator({
          hourly: 'hourly',
          daily: 'daily',
          weekly: 'weekly',
          monthly: 'monthly',
          custom: 'custom'
        })
      ], { required: false }),
      customIntervalHours: schema.number({ integer: true, min: 1, required: false }),
      defaultLanguage: schema.string({ required: false }),
      downloadPath: schema.string({ required: false }),
      organizeBy: schema.union([
        schema.string({ required: true }),
        schema.enumValidator({
          title: 'title',
          id: 'id',
          custom: 'custom'
        })
      ], { required: false }),
      organizePattern: schema.string({ required: false }),
      importPolicy: schema.union([
        schema.string({ required: true }),
        schema.enumValidator({
          automatic: 'automatic',
          manual: 'manual'
        })
      ], { required: false }),
      backupEnabled: schema.boolean({ required: false }),
      backupPath: schema.string({ required: false })
    }, { required: false }),
    isDefault: schema.boolean({ required: false }),
    isActive: schema.boolean({ required: false }),
    lastScanAt: schema.date({ required: false }),
    createdAt: schema.date({ required: false }),
    updatedAt: schema.date({ required: false })
  };

  return schema.validateSchema(data, librarySchema);
}

/**
 * Validate API response
 */
export function validateApiResponse(
  data: unknown,
  dataValidator?: (value: unknown) => schema.ValidationResult
): schema.ValidationResult {
  const responseSchema: schema.ValidationSchema = {
    success: schema.boolean({ required: true }),
    data: dataValidator
      ? ((value, _path: string): schema.ValidationError[] => {
          const dataObj = data as Record<string, unknown>;
          if (!guards.isPresent(value) && guards.isBoolean(data) && !dataObj['success']) {
            // Data is not required for error responses
            return [];
          }

          // Convert ValidationResult to ValidationError[]
          const result = dataValidator(value);
          return result.errors;
        })
      : schema.custom(() => true, { required: false }),
    error: schema.object({
      code: schema.string({ required: true }),
      message: schema.string({ required: true }),
      details: schema.custom(() => true, { required: false })
    }, { required: false }),
    meta: schema.object({}, { required: false, allowUnknown: true })
  };

  return schema.validateSchema(data, responseSchema);
}

/**
 * Type guard for manga entity
 */
export function isMangaEntity(data: unknown): data is Manga {
  const result = validateMangaEntity(data);
  return result.valid;
}

/**
 * Type guard for chapter entity
 */
export function isChapterEntity(data: unknown): data is Chapter {
  const result = validateChapterEntity(data);
  return result.valid;
}

/**
 * Type guard for library entity
 */
export function isLibraryEntity(data: unknown): data is LibraryEntity {
  const result = validateLibraryEntity(data);
  return result.valid;
}