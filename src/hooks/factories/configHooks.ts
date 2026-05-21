/**
 * Configuration Hooks
 *
 * Auto-generated configuration hooks using the factory pattern.
 * Replaces individual config hook files with a unified implementation.
 *
 * @module hooks/factories/configHooks
 */

import { z } from 'zod';

import { createConfigHook, createConfigHookFamily } from './createConfigHook';
import { configSchemas } from './types';

/**
 * Default configuration values
 */
const defaultConfigs = {
  theme: {
    mode: 'light' as const,
    primaryColor: '#0070f3',
    fontSize: 'medium' as const,
  },
  download: {
    autoDownload: false,
    downloadPath: '/downloads',
    maxConcurrent: 3,
    preferredQuality: 'high' as const,
    keepOriginalFormat: true,
  },
  notification: {
    enabled: true,
    types: {
      download: true,
      update: true,
      error: true,
      info: false,
    },
    channels: [],
  },
  library: {
    scanInterval: 3600000,
    autoOrganize: true,
    folderStructure: 'nested' as const,
    metadataProvider: 'auto' as const,
  },
  reader: {
    readingMode: 'single' as const,
    readingDirection: 'ltr' as const,
    fitMode: 'height' as const,
    backgroundColor: '#000000',
    preloadPages: 3,
  },
} as const;

/**
 * Create all configuration hooks
 */
const configHooks = createConfigHookFamily(
  {
    theme: {
      schema: configSchemas.theme,
      defaultValue: defaultConfigs.theme,
    },
    download: {
      schema: configSchemas.download,
      defaultValue: defaultConfigs.download,
    },
    notification: {
      schema: configSchemas.notification,
      defaultValue: defaultConfigs.notification,
    },
    library: {
      schema: configSchemas.library,
      defaultValue: defaultConfigs.library,
    },
    reader: {
      schema: configSchemas.reader,
      defaultValue: defaultConfigs.reader,
    },
  },
  {
    // Global options for all config hooks
    optimisticUpdates: true,
    gcTime: 5 * 60 * 1000, // 5 minutes (renamed from cacheTime in TanStack Query v5)
  }
);

// Export individual hooks
export const {
  useThemeConfig,
  useDownloadConfig,
  useNotificationConfig,
  useLibraryConfig,
  useReaderConfig,
} = configHooks;

/**
 * Special configuration hooks with custom logic
 */

// AniList configuration with OAuth handling
export const useAnilistConfig = createConfigHook({
  configKey: 'anilist',
  schema: configSchemas.notification.extend({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    userId: z.string().optional(),
    username: z.string().optional(),
    syncEnabled: z.boolean().default(false),
    syncInterval: z.number().default(3600000),
  }),
  defaultValue: {
    enabled: false,
    types: {
      download: false,
      update: false,
      error: false,
      info: false,
    },
    channels: [],
    syncEnabled: false,
    syncInterval: 3600000,
  },
  scope: 'user',
});

// Suwayomi configuration with server connection
export const useSuwayomiConfig = createConfigHook({
  configKey: 'suwayomi',
  schema: z.object({
    enabled: z.boolean().default(false),
    serverUrl: z.string().url().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    autoSync: z.boolean().default(true),
    syncOnStartup: z.boolean().default(true),
  }),
  defaultValue: {
    enabled: false,
    autoSync: true,
    syncOnStartup: true,
  },
  scope: 'global',
});

// ComicVine configuration
export const useComicvineConfig = createConfigHook({
  configKey: 'comicvine',
  schema: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    rateLimit: z.number().min(0).default(200),
    cacheExpiry: z.number().min(0).default(86400000), // 24 hours
  }),
  defaultValue: {
    enabled: false,
    rateLimit: 200,
    cacheExpiry: 86400000,
  },
  scope: 'global',
});

/**
 * Export all hooks for backwards compatibility
 */
export default {
  useThemeConfig,
  useDownloadConfig,
  useNotificationConfig,
  useLibraryConfig,
  useReaderConfig,
  useAnilistConfig,
  useSuwayomiConfig,
  useComicvineConfig,
};