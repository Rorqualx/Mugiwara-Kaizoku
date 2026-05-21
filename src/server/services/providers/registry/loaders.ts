/**
 * Provider Registry Loaders
 *
 * Dynamic loader functions for provider strategies.
 * Each loader attempts to import and instantiate a provider strategy,
 * returning null if the strategy cannot be loaded.
 *
 * Extracted from: registry.ts (lines 136-186)
 */

import { logger } from '@/utils/logger';

import type { ProviderStrategy } from './types';

// ============================================================================
// Provider Strategy Loaders
// ============================================================================

/**
 * Load Fandom provider strategy
 */
export async function loadFandomStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { FandomProviderStrategy } = await import('../strategies/FandomProviderStrategy');
    return new FandomProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load Fandom provider strategy:', errorMessage);
    return null;
  }
}

/**
 * Load Wikipedia provider strategy
 */
export async function loadWikipediaStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { WikipediaProviderStrategy } = await import('../strategies/WikipediaProviderStrategy');
    return new WikipediaProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load Wikipedia provider strategy:', errorMessage);
    return null;
  }
}

/**
 * Load AniList provider strategy
 */
export async function loadAniListStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { AniListProviderStrategy } = await import('../strategies/AniListProviderStrategy');
    return new AniListProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load AniList provider strategy:', errorMessage);
    return null;
  }
}

/**
 * Load ComicVine provider strategy
 */
export async function loadComicVineStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { ComicVineProviderStrategy } = await import('../strategies/ComicVineProviderStrategy');
    return new ComicVineProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load ComicVine provider strategy:', errorMessage);
    return null;
  }
}

/**
 * Load MangaDex provider strategy
 */
export async function loadMangaDexStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { MangaDexProviderStrategy } = await import('../strategies/MangaDexProviderStrategy');
    return new MangaDexProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load MangaDex provider strategy:', errorMessage);
    return null;
  }
}

/**
 * Load MangaUpdates provider strategy
 */
export async function loadMangaUpdatesStrategy(): Promise<ProviderStrategy | null> {
  try {
    const { MangaUpdatesProviderStrategy } = await import('../strategies/MangaUpdatesProviderStrategy');
    return new MangaUpdatesProviderStrategy();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to load MangaUpdates provider strategy:', errorMessage);
    return null;
  }
}
