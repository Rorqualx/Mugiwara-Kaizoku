/**
 * Annotation Router - Zod Schemas
 *
 * These schemas are the source of truth for validation.
 * Client types should use z.infer<> from these schemas.
 */

import { z } from 'zod';

import { BIO_LABELS, getAllBIOTags } from '@/server/ml/features/bio-types';

// ============================================================================
// Entity & Label Type Schemas
// ============================================================================

/**
 * EntityType schema - validates against known entity types from BIO_LABELS
 */
export const entityTypeSchema = z.enum(
  Object.values(BIO_LABELS) as [string, ...string[]]
);

/**
 * BIO tag schema - 'O' or 'B-ENTITY' or 'I-ENTITY'
 */
export const bioTagSchema = z.enum(getAllBIOTags() as [string, ...string[]]);

// ============================================================================
// Source & Status Schemas
// ============================================================================

export const sourceTypeSchema = z.enum(['FANDOM', 'WIKIPEDIA', 'ANILIST', 'COMICVINE']);
export const statusSchema = z.enum(['BOOTSTRAP', 'AGENT_REVIEWED', 'IN_PROGRESS', 'REVIEWED', 'GOLD', 'REJECTED']);

export const getPagesInputSchema = z.object({
  limit: z.number().min(1).max(5000).default(20),
  offset: z.number().min(0).default(0),
  cursor: z.string().optional(),
  search: z.string().optional(),
  sourceType: sourceTypeSchema.optional(),
  status: statusSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'mangaTitle']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Maximum HTML snapshot size: 10MB */
const MAX_HTML_SNAPSHOT_SIZE = 10 * 1024 * 1024;

export const createPageInputSchema = z
  .object({
    url: z.string().url(),
    mangaTitle: z.string().optional(),
    sourceType: sourceTypeSchema,
    htmlSnapshot: z.string().max(MAX_HTML_SNAPSHOT_SIZE, {
      message: `HTML snapshot exceeds ${MAX_HTML_SNAPSHOT_SIZE / 1024 / 1024}MB limit`,
    }),
    tokens: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        tagName: z.string(),
        xpath: z.string().optional(),
        domDepth: z.number().optional(),
      })
    ),
    labels: z.array(bioTagSchema),
    notes: z.string().optional(),
  })
  .refine((data) => data.tokens.length === data.labels.length, {
    message: 'tokens and labels arrays must have equal length',
    path: ['labels'],
  });

export const addFromUrlInputSchema = z.object({
  url: z.string().url(),
  mangaTitle: z.string().optional(),
  notes: z.string().optional(),
});

export const urlAnnotationSchema = z.object({
  /** Entity type for the URL annotation */
  label: entityTypeSchema,
  url: z.string().url(),
  text: z.string(),
});

/**
 * Recovery strategy used to resolve a selection back to DOM elements
 */
export const recoveryStrategySchema = z.enum([
  'xpath',
  'context',
  'global',
  'text-search',
  'manual',
]);

/**
 * TextSelection schema - source of truth for user annotations
 * Stores character-level precision selections before tokenization
 *
 * Matches client TextSelection interface in src/pages/annotation/editor/types.ts
 */
export const textSelectionSchema = z.object({
  /** Unique ID for this selection */
  id: z.string(),
  /** The selected text content */
  text: z.string(),
  /** Entity type label - validated against BIO_LABELS */
  label: entityTypeSchema,

  // === Primary anchor (XPath + char offsets) ===
  /** XPath to the DOM element containing this text */
  xpath: z.string(),
  /** Character offset within the element's text content */
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().nonnegative(),

  // === TextQuoteSelector for fuzzy reconstruction ===
  /** 32 chars before selection (for fuzzy matching if xpath fails) */
  prefix: z.string().optional(),
  /** 32 chars after selection (for fuzzy matching if xpath fails) */
  suffix: z.string().optional(),

  // === Global position fallback ===
  /** Character position in entire document text (fallback anchor) */
  globalCharStart: z.number().int().nonnegative().optional(),
  globalCharEnd: z.number().int().nonnegative().optional(),

  // === Content fingerprinting (for reliable resolution verification) ===
  /** SHA-256 hash of selected text for verification */
  textHash: z.string().optional(),
  /** SHA-256 hash of prefix + text + suffix for context verification */
  contextHash: z.string().optional(),

  // === Stable selector (more reliable than XPath for DOM mutations) ===
  /** CSS selector path to element (survives some DOM changes better than XPath) */
  cssPath: z.string().optional(),

  // === Recovery tracking ===
  /** Which resolution strategy was used (undefined = not yet resolved) */
  recoveryStrategy: recoveryStrategySchema.optional(),
  /** Last time this selection was successfully resolved */
  lastResolvedAt: z.number().optional(),

  // === Image fields ===
  /** For images: the image source URL */
  imageSrc: z.string().optional(),
  /** For images: alt text */
  imageAlt: z.string().optional(),
  /** Is this an image selection */
  isImage: z.boolean().optional(),

  /** Timestamp when created */
  createdAt: z.number(),
});

/** Inferred TextSelection type from schema */
export type TextSelectionSchema = z.infer<typeof textSelectionSchema>;

export const updateLabelsInputSchema = z.object({
  id: z.string(),
  /** BIO-tagged labels - validated against known entity types */
  labels: z.array(bioTagSchema),
  /** Source of truth for annotations */
  selections: z.array(textSelectionSchema).optional(),
  /** Entity counts - keys validated against known entity types */
  entityCounts: z
    .record(entityTypeSchema, z.number().int().nonnegative())
    .optional(),
  urlAnnotations: z.array(urlAnnotationSchema).optional(),
  /** Optimistic locking - current version for conflict detection */
  version: z.number().int().nonnegative().optional(),
});

export const updateStatusInputSchema = z.object({
  id: z.string(),
  status: statusSchema,
  version: z.number().optional(), // Optimistic locking - current version for conflict detection
});

export const updateMangaTitleInputSchema = z.object({
  id: z.string(),
  mangaTitle: z.string().min(1).max(200),
});

// Discovery schemas
export const discoverFromLibraryInputSchema = z.object({
  sourceTypes: z.array(sourceTypeSchema).optional(),
  limit: z.number().min(1).max(500).default(100),
  excludeAnnotated: z.boolean().default(true),
});

export const addBulkFromDiscoveryInputSchema = z.object({
  urls: z.array(z.object({
    url: z.string().url(),
    mangaTitle: z.string().optional(),
  })).min(1).max(50),
});

export const addBulkFromTextInputSchema = z.object({
  urlText: z.string().min(1),
  defaultMangaTitle: z.string().optional(),
});

// Reprocess schema
export const reprocessInputSchema = z.object({
  id: z.string(),
  refetch: z.boolean().default(false), // Optionally refetch HTML using FlareSolverr
});

// Export schema - for training data export with context
export const exportInputSchema = z.object({
  status: z.array(statusSchema).optional(), // Filter by status (default: REVIEWED, GOLD)
  sourceType: z.array(sourceTypeSchema).optional(), // Filter by source
  includeContext: z.boolean().default(true), // Include sentence context
  contextSentences: z.number().min(0).max(3).default(1), // Sentences before/after
  format: z.enum(['jsonl', 'json', 'csv']).default('jsonl'),
  // Pagination to avoid memory exhaustion on large datasets
  limit: z.number().min(1).max(1000).default(100), // Pages per request (not tokens)
  cursor: z.string().optional(), // Page ID cursor for pagination
});
