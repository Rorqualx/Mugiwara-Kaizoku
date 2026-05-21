/**
 * Native Download Utilities Module
 *
 * Shared constants, validation schemas, and helper functions
 * used across all native download modules.
 *
 * @module server/trpc/routers/native-download/utils
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { WebsiteValidationResult } from '@/types/adapters/native-download-types';
import type { MangaSearchResult } from '@/types/search.types';
import { isObject, hasProperty } from '@/utils/type-guards';

// ============================================================================
// Placeholder Services (until Phase 5)
// ============================================================================

/**
 * Placeholder website validator service
 * Will be replaced with full implementation in Phase 5
 */
export const websiteValidator = {
  validate: (_url: string): Promise<WebsiteValidationResult> => {
    // Basic validation for now
    return Promise.resolve({
      isValid: true,
      suggestions: ['Consider adding authentication if required']
    });
  }
};

/**
 * Placeholder native download manager service
 * Will be replaced with full implementation
 */
export const nativeDownloadManager = {
  searchManga: (_params: {
    query: string;
    sourceIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<MangaSearchResult[]> => {
    // Placeholder
    return Promise.resolve([]);
  },
  queueDownload: async (_downloadId: string): Promise<void> => {
    // Placeholder
  },
  cancelDownload: async (_downloadId: string): Promise<void> => {
    // Placeholder
  }
};

/**
 * Get native download manager instance
 * Returns the placeholder manager
 */
export const getNativeDownloadManager = (): Promise<typeof nativeDownloadManager> =>
  Promise.resolve(nativeDownloadManager);

// ============================================================================
// Default Source Templates
// ============================================================================

/**
 * Default source templates available for quick installation
 * Pre-configured sources that users can quickly add
 */
export const DEFAULT_SOURCE_TEMPLATES = [
  {
    id: 'getcomics',
    name: 'GetComics',
    description:
      'Comic books from Marvel, DC, Image Comics, and more. Supports direct downloads and multiple file hosting services.',
    type: 'Comics' as const,
    baseUrl: 'https://getcomics.org',
    config: {
      searchUrl: 'https://getcomics.org/?s={query}',
      selectors: {
        searchResults: {
          container: 'article.post',
          id: {
            css: 'h1.post-title a',
            extract: 'attribute',
            attribute: 'href',
            transform: [
              {
                type: 'regex',
                params: { pattern: '/([^/]+)/?$', flags: '' }
              }
            ]
          },
          title: {
            css: 'h1.post-title a',
            extract: 'text',
            transform: [
              {
                type: 'trim',
                params: {}
              }
            ]
          },
          coverUrl: {
            css: '.post-thumbnail img',
            extract: 'attribute',
            attribute: 'src'
          },
          url: {
            css: 'h1.post-title a',
            extract: 'attribute',
            attribute: 'href'
          }
        },
        mangaDetails: {
          title: {
            css: 'h1.post-title',
            extract: 'text'
          },
          description: {
            css: '.post-content',
            extract: 'text'
          }
        },
        chapterList: {
          container: '.aio-button-center a',
          chapterId: {
            css: '',
            extract: 'attribute',
            attribute: 'href'
          },
          chapterNumber: {
            css: '',
            extract: 'text'
          },
          chapterTitle: {
            css: '',
            extract: 'text'
          },
          chapterUrl: {
            css: '',
            extract: 'attribute',
            attribute: 'href'
          }
        },
        downloadLinks: {
          imageContainer: '.aio-button-center a',
          imageUrl: {
            css: '',
            extract: 'attribute',
            attribute: 'href'
          }
        }
      },
      rateLimit: 1
    }
  }
];

// ============================================================================
// Input Validation Schemas
// ============================================================================

/**
 * Schema for adding a new native download source
 */
export const addSourceInput = z.object({
  name: z.string().min(1, 'Name is required'),
  baseUrl: z.string().url('Must be a valid URL'),
  config: z.unknown() // Will be validated separately based on structure
});

/**
 * Schema for updating a native download source
 */
export const updateSourceInput = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  config: z.unknown().optional(),
  enabled: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR']).optional()
});

/**
 * Schema for website validation input
 */
export const validateWebsiteInput = z.object({
  url: z.string().url('Must be a valid URL')
});

/**
 * Schema for manga search input
 */
export const searchMangaInput = z.object({
  query: z.string().min(1, 'Search query is required'),
  sourceIds: z.array(z.string()).optional(),
  page: z.number().min(1).default(1).optional(),
  limit: z.number().min(1).max(100).default(20).optional()
});

/**
 * Schema for downloading a chapter
 */
export const downloadChapterInput = z.object({
  sourceId: z.string(),
  mangaId: z.union([z.string(), z.number()]),
  chapterId: z.string(),
  chapterNumber: z.number().optional()
});

/**
 * Schema for getting downloads with filters
 */
export const getDownloadsInput = z.object({
  sourceId: z.string().optional(),
  mangaId: z.union([z.string(), z.number()]).optional(),
  status: z
    .enum(['QUEUED', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional()
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate source configuration structure
 *
 * Ensures the config object has required fields and proper structure
 * for use as a native download source configuration.
 *
 * @param config - The configuration object to validate
 * @returns Validated configuration as a Record
 * @throws TRPCError if validation fails
 */
export function validateSourceConfig(
  config: unknown
): Record<string, unknown> {
  // Basic validation
  if (!isObject(config)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid config structure'
    });
  }

  // Ensure required fields exist
  const searchUrl = hasProperty(config, 'searchUrl')
    ? config['searchUrl']
    : undefined;
  if (!searchUrl || typeof searchUrl !== 'string') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Config must include searchUrl'
    });
  }

  const selectors = hasProperty(config, 'selectors')
    ? config['selectors']
    : undefined;
  if (!isObject(selectors)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Config must include selectors'
    });
  }

  // Build validated config for JSON storage in Prisma
  const validatedConfig: Record<string, unknown> = {
    searchUrl,
    selectors
  };

  // Optional fields
  if (
    hasProperty(config, 'headers') &&
    config['headers'] !== undefined
  ) {
    validatedConfig['headers'] = config['headers'];
  }
  if (
    hasProperty(config, 'rateLimit') &&
    config['rateLimit'] !== undefined
  ) {
    validatedConfig['rateLimit'] = config['rateLimit'];
  }
  if (
    hasProperty(config, 'authentication') &&
    config['authentication'] !== undefined
  ) {
    validatedConfig['authentication'] = config['authentication'];
  }
  if (
    hasProperty(config, 'downloadServices') &&
    config['downloadServices'] !== undefined
  ) {
    validatedConfig['downloadServices'] = config['downloadServices'];
  }

  return validatedConfig;
}
