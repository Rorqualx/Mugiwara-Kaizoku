/**
 * Core Type Guard Infrastructure for Kapowarr
 *
 * This module provides the foundation for all Kapowarr type guard modules,
 * including shared types, utilities, and schemas for consistent type validation.
 *
 * @module KapowarrCoreTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

// Export all core types
export * from './types';

// Export all core utilities
export * from './utils';

// Export all core schemas
export * from './schemas';

// Re-export commonly used validation patterns
export { ValidationPatterns } from './types';
export { ErrorMessages } from './types';

// Re-export commonly used utility functions
export {
  validateObjectSchema,
  createTypeGuard,
  hasRequiredProperties,
  hasPropertiesOfType,
  isArrayOfType,
  createOptionalTypeGuard,
  isValidUrl,
  isValidEmail,
  isValidIsoDate,
  createCompositeTypeGuard,
} from './utils';

// Re-export commonly used schemas
export {
  createZodTypeGuard,
  getValidationErrors,
  BaseSchemas,
  NativeDownloadImageSchema,
  NativeDownloadAdapterConfigSchema,
  NativeDownloadApiMangaSchema,
  SuwayomiConfigSchema,
  SuwayomiMangaSchema,
  ApiErrorSchema,
  PaginationMetadataSchema,
  SearchParamsSchema,
  FilterParamsSchema,
  SortParamsSchema,
  ApiRequestSchema,
  RateLimitConfigSchema,
  AuthConfigSchema,
  SelectorConfigSchema,
  DownloadLinkSchema,
  WebsiteValidationResultSchema,
} from './schemas';