/**
 * BasicInfoStep Types
 *
 * Type definitions for the BasicInfoStep wizard component.
 * Extracted from BasicInfoStep.tsx to support component decomposition.
 *
 * @module components/addManga/steps/wizard/basic-info-step/types
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';

/**
 * Logger interface for type-safe logging
 */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/**
 * Initial data structure passed to BasicInfoStep
 */
export interface InitialData {
  title?: string;
}

/**
 * Main props interface for BasicInfoStep component
 */
export interface BasicInfoStepProps {
  // Title and URL
  title: string;
  setTitle: (title: string) => void;
  url: string;
  setUrl: (url: string) => void;

  // Provider data
  provider: string;
  initialData: InitialData | null;
  cachedSearchResults?: unknown[];

  // Additional providers
  additionalProviders: Record<string, { results?: unknown[]; error?: unknown }>;
  setAdditionalProviders: (providers: Record<string, { results?: unknown[]; error?: unknown }>) => void;
  selectedSources: string[];
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;

  // Loading states
  isSearchingProviders: boolean;
  setIsSearchingProviders: (searching: boolean) => void;
  isValidatingUrl: boolean;

  // Handlers
  handleUrlParse: () => void;
  handleAdditionalSourceSelection: (provider: string, result: unknown, forceUpdate?: boolean) => Promise<void>;

  // Logger
  logger: Logger;

  // Quick add props (for footer button)
  onQuickAdd?: (() => Promise<void>) | undefined;
  isQuickAdding?: boolean | undefined;
  setIsQuickAdding?: ((loading: boolean) => void) | undefined;
  canQuickAdd?: boolean | undefined;
  setCanQuickAdd?: ((can: boolean) => void) | undefined;
  registerQuickAddHandler?: ((handler: () => Promise<void>) => void) | undefined;
  // Quick add completion callback
  onComplete?: ((mangaId: number) => void) | undefined;
}

/**
 * Provider display names mapping
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anilist: 'AniList',
  mangadex: 'MangaDex',
  comicvine: 'ComicVine',
  wikipedia: 'Wikipedia',
  fandom: 'Fandom'
};

/**
 * Default providers to search
 */
export const DEFAULT_PROVIDERS = ['anilist', 'mangadex', 'comicvine', 'wikipedia', 'fandom'] as const;

/**
 * Provider search data structure
 * Used as the value type in additionalProviders record
 */
export interface ProviderSearchData {
  results?: unknown[];
  error?: unknown;
}
