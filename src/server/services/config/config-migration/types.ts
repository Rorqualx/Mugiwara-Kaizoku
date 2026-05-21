/**
 * Configuration Migration - Foundation Types and Utilities
 *
 * Shared type definitions, schemas, and helper functions used across
 * all configuration migration modules.
 *
 * Extracted from: configMigration.ts (lines 1-106)
 *
 * @module config-migration/types
 */

import { ConfigScope } from '@prisma/client';
import { z } from 'zod';


// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate if value is a record object
 *
 * @param value - Value to validate
 * @returns True if value is a record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert unknown error to Error type
 *
 * @param error - Unknown error value
 * @returns Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Safely parse JSON from string or return value as-is
 *
 * @param value - String to parse or non-string value
 * @returns Parsed JSON value or null on parse failure
 */
export function safeJsonParse(value: string | unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * Process provider settings with reduced nesting depth
 *
 * Migrates provider configurations from legacy format to new config system.
 * Uses dynamic imports to avoid circular dependencies.
 *
 * @param providersRaw - Raw provider settings object
 * @param basePath - Base configuration path (e.g., 'metadataProviders')
 */
export async function processProviderSettings(
  providersRaw: unknown,
  basePath: string
): Promise<void> {
  if (!isRecord(providersRaw)) return;

  const entries = Object.entries(providersRaw);
  await Promise.all(
    entries.map(async ([provider, config]) => {
      if (!isRecord(config)) return;

      const providerConfig = config as {
        enabled: boolean;
        settings: Record<string, unknown>;
      };

      // Dynamic import to avoid circular dependencies
      const { configService } = await import('../configService');

      await configService.set(
        `${basePath}.${provider}.enabled`,
        providerConfig.enabled,
        { scope: ConfigScope.INTEGRATION }
      );

      if (!isRecord(providerConfig.settings)) return;

      const settingEntries = Object.entries(providerConfig.settings);
      await Promise.all(
        settingEntries.map(([key, value]) =>
          configService.set(
            `${basePath}.${provider}.settings.${key}`,
            value,
            { scope: ConfigScope.INTEGRATION }
          )
        )
      );
    })
  );
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for validating metadata JSON fields
 * Uses catch to provide empty object fallback on parse failure
 */
export const MetadataSchema = z.record(z.unknown()).catch({});

/**
 * Schema for validating event settings JSON fields
 * Uses catch to provide empty object fallback on parse failure
 */
export const EventSettingsSchema = z.record(z.unknown()).catch({});

/**
 * Schema for validating file organization JSON fields
 * Uses catch to provide empty object fallback on parse failure
 */
export const FileOrganizationSchema = z.record(z.unknown()).catch({});

// ============================================================================
// Legacy Settings Interface
// ============================================================================

/**
 * Legacy settings format from the database
 *
 * Represents the old Settings table structure before migration to the
 * new configuration system. Used for type-safe migration operations.
 */
export interface LegacySettings {
  id: number;
  // Notification Settings
  telegramEnabled: boolean;
  telegramToken?: string | null;
  telegramChatId?: string | null;
  telegramSendSilently: boolean;
  appriseEnabled: boolean;
  appriseHost?: string | null;
  appriseUrls: string[] | unknown[];
  // Media Server Integration
  kavitaEnabled: boolean;
  kavitaHost?: string | null;
  kavitaLibraries: string[] | unknown[];
  kavitaPassword?: string | null;
  kavitaUser?: string | null;
  komgaEnabled: boolean;
  komgaHost?: string | null;
  komgaLibraries: string[] | unknown[];
  komgaPassword?: string | null;
  komgaUser?: string | null;
  // Metadata Integration
  anilistEnabled: boolean;
  anilistUseForMetadata: boolean;
  // Download Client Integration
  prowlarrApiKey?: string | null;
  prowlarrBaseURL?: string | null;
  prowlarrEnabled: boolean;
  autoSelectClient: boolean;
  delugeBaseURL?: string | null;
  delugeEnabled: boolean;
  delugePassword?: string | null;
  nzbgetBaseURL?: string | null;
  nzbgetEnabled: boolean;
  nzbgetPassword?: string | null;
  nzbgetUsername?: string | null;
  preferredTorrentClient?: string | null;
  preferredUsenetClient?: string | null;
  sabnzbdApiKey?: string | null;
  sabnzbdBaseURL?: string | null;
  sabnzbdEnabled: boolean;
  transmissionApiKey?: string | null;
  transmissionBaseURL?: string | null;
  transmissionEnabled: boolean;
  // Manga Source Integration
  mangalEnabled: boolean;
  mangalHost?: string | null;
  mangalLibraries: string[] | unknown[];
  mangalPassword?: string | null;
  mangalUser?: string | null;
  // Backup Configuration
  backupCustomCron?: string | null;
  backupEnabled: boolean;
  backupIncludeConfig: boolean;
  backupIncludeDatabase: boolean;
  backupIncludeMedia: boolean;
  backupMaxCount: number;
  backupPath?: string | null;
  backupRetentionDays: number;
  backupSchedule: string;
  // Suwayomi Integration
  suwayomiEnabled: boolean;
  suwayomiServerPath?: string | null;
  suwayomiConfigPath?: string | null;
  suwayomiPort?: number;
  suwayomiSources: string[] | unknown[];
  // Additional Settings
  metadata?: unknown;
  eventSettings?: unknown;
  fileOrganization?: unknown;
}
