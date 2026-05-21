/**
 * Settings Router Utilities
 *
 * Shared schemas, constants, and types used across all settings modules.
 *
 * Extracted from: settings.ts (lines 37-103)
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Available metadata providers for fetching manga information
 */
export const metadataProviders = [
  { id: 'anilist', name: 'AniList' },
  { id: 'comicvine', name: 'ComicVine' },
  { id: 'fandom', name: 'Fandom' },
  { id: 'wikipedia', name: 'Wikipedia' },
] as const;

/**
 * Available search providers
 */
export const searchProviders = [
  { id: 'anilist', name: 'AniList' },
  { id: 'comicvine', name: 'ComicVine' },
  { id: 'fandom', name: 'Fandom' },
  { id: 'wikipedia', name: 'Wikipedia' },
  { id: 'prowlarr', name: 'Prowlarr' },
] as const;

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Folder structure schema for file organization
 */
export const folderStructureSchema = z.enum(['flat', 'byTitle', 'byTitleYear', 'byPublisher', 'custom']);

/**
 * File organization schema for validating file organization settings
 */
export const fileOrganizationSchema = z.object({
  folderStructure: folderStructureSchema,
  customFolderTemplate: z.string().optional(),
  fileNamingTemplate: z.string(),
  createMetadataFiles: z.boolean(),
  organizeOnImport: z.boolean(),
  fileMode: z.enum(['keep_in_place', 'move', 'copy']),
});

/**
 * Backup settings schema for validating backup configuration
 */
export const backupSettingsSchema = z.object({
  autoBackup: z.boolean(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly', 'never']),
  backupLocation: z.string().max(500).regex(/^\/[\w\-./]+$/, 'Must be absolute path'),
  maxBackups: z.number().int().min(1).max(100),
  includeImages: z.boolean(),
});

/**
 * Integration config schema for validating integration settings
 */
export const integrationConfigSchema = z.object({
  type: z.enum(['kavita', 'komga', 'telegram', 'apprise']),
  enabled: z.boolean(),
  config: z.record(z.unknown()),
});

/**
 * Schema for unknown values that need validation
 */
export const unknownSchema = z.unknown();

/**
 * Search provider configuration schema for validating search settings
 */
export const searchProviderSchema = z.object({
  enabled: z.boolean(),
  settings: z.record(unknownSchema).optional(),
});

/**
 * Prowlarr configuration schema for validating Prowlarr settings
 */
export const prowlarrConfigSchema = z.object({
  enabled: z.boolean(),
  baseURL: z.string().url(),
  apiKey: z.string(),
});
