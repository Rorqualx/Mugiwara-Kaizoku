/**
 * External API Schemas
 *
 * This module exports Zod schemas for validating external API responses.
 * Use these schemas to ensure runtime type safety for untrusted external data.
 *
 * @example
 * ```typescript
 * import { AniListMediaSchema } from '@/lib/schemas';
 *
 * const response = await fetch('...');
 * const data = await response.json();
 * const validated = AniListMediaSchema.parse(data);
 * ```
 *
 * @module schemas
 */

// Common schemas
export * from './common';

// Provider-specific schemas
export * from './anilist';
export * from './wikipedia';
export * from './comicvine';
export * from './fandom';

// Training data schemas
export * from './training-labels';
