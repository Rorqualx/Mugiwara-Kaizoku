/**
 * Validation Utilities Index
 * 
 * Main export point for all validation utilities.
 * Organized into guards (type checking) and validators (data validation).
 * 
 * Structure:
 * - guards/     - Type guards for runtime type checking
 * - validators/ - Complex data validation logic
 * 
 * @module utils/validation
 */

// Re-export all type guards from new location (except conflicting ones)
export * from './guards';

// Re-export validators selectively to avoid conflicts
export {
  // Config validators
  validateConfig,
  createConfigFactory,
  mergeConfigs,
  isValidConfig
} from './validators/config';

export {
  // Data validators (renamed to avoid conflicts)
  validateMangaMetadata,
  validateMangaEntity,
  validateChapterEntity,
  validateLibraryEntity,
  validateApiResponse,
  isMangaEntity as isMangaData,
  isChapterEntity as isChapterData,
  isLibraryEntity as isLibraryData
} from './validators/data';

export {
  // Task validators
  isJobType,
  isJobStatus,
  validateJobType,
  validateJobStatus,
  getAllJobTypes,
  getAllJobStatuses,
  isCompletedStatus,
  isActiveStatus,
  canRetryStatus
} from './validators/job';

// Re-export utility modules (without conflicting exports)
export { 
  isSuccess,
  isError as isAsyncError,
  isLoading,
  isIdle,
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  createIdleResult
} from './async-result';

export {
  safeParseJson,
  safeStringifyJson,
  parseAndValidateJson,
  parseJsonWithTypeGuard
} from './safe-json';

export {
  isArray,
  isNonEmptyArray,
  filterNullish,
  ensureArray,
  firstOrUndefined,
  lastOrUndefined
} from './array-utils';

export {
  isValidId,
  toStringId,
  toNumberId,
  parseId
} from '../id-converters';

export {
  assertNever,
  isNotNull,
  isNotUndefined,
  isDefined
} from './type-guards';

// Don't export everything to avoid conflicts - these have duplicates with guards
// export * from './schema-validation';
// export * from './consolidated-validators';
// export * from './metadata-typeguards';

// Import modules for namespace exports (backward compatibility)
import * as TypeGuards from '@/utils/type-guards';

import * as ArrayUtils from './array-utils';
import * as SafeJson from './safe-json';
import * as SchemaValidation from './schema-validation';
import * as DataValidators from './validators/data';

// Export namespaces for backward compatibility
export {
  TypeGuards,
  SchemaValidation,
  DataValidators,
  SafeJson,
  ArrayUtils
};

// Note: Common exports are already provided through the wildcard exports above
// No need to re-export individually as it causes duplicate export errors