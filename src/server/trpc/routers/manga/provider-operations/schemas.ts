/**
 * Provider Operations - Validation Schemas
 *
 * Zod validation schemas for provider operation inputs.
 *
 * Extracted from: providerOperations.ts (lines 93-147)
 */

import { z } from 'zod';

// ============================================================================
// Search Schemas
// ============================================================================

/**
 * Schema for provider confirmation search
 */
export const providerConfirmationSearchSchema = z.object({
  title: z.string(),
  providers: z.array(z.string())
});

// ============================================================================
// Binding Schemas
// ============================================================================

/**
 * Schema for binding manga to AniList (legacy)
 */
export const bindSchema = z.object({
  mangaId: z.number(),
  anilistId: z.string(),
  title: z.string(),
  detail: z.string()
});

/**
 * Schema for binding manga to a generic provider
 */
export const bindProviderSchema = z.object({
  mangaId: z.number(),
  provider: z.enum(['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates', 'mal', 'kitsu']),
  providerId: z.string(),
  fetchMetadata: z.boolean().optional().default(true)
});

/**
 * Schema for unbinding manga from a provider
 */
export const unbindProviderSchema = z.object({
  mangaId: z.number(),
  provider: z.enum(['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates', 'mal', 'kitsu'])
});

// ============================================================================
// Metadata Operation Schemas
// ============================================================================

/**
 * Schema for merging metadata from multiple providers
 */
export const mergeMetadataFromProvidersSchema = z.object({
  mangaId: z.number(),
  fieldSelections: z.array(z.object({
    field: z.string(),
    provider: z.string(),
    value: z.unknown()
  }))
});

/**
 * Schema for updating provider preferences
 */
export const updateProviderPreferencesSchema = z.object({
  id: z.number(),
  preferences: z.record(z.object({
    provider: z.string(),
    value: z.unknown()
  }))
});
