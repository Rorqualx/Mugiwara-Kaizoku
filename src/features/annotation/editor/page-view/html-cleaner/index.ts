/**
 * HTML Cleaner Module
 *
 * Cleans HTML snapshots for annotation display by removing
 * unwanted UI elements (cookie banners, navigation, ads)
 * while preserving content structure.
 */

export { cleanHtmlForAnnotation } from './cleaner';
export { detectProvider, getProviderByName, FANDOM_PROFILE, WIKIPEDIA_PROFILE, GENERIC_PROFILE } from './providers';
export { validateXPathStability } from './xpath-validation';
export {
  createWhitespaceOffsetMap,
  translateOffsetsAfterNormalization,
  validateTextAtOffset,
  findTextInNormalized,
} from './offset-mapper';
export type { OffsetMapResult } from './offset-mapper';
export type {
  CleanupOptions,
  CleanupResult,
  ProviderProfile,
  ElementDecision,
  ElementAction,
  ElementCategory,
  ElementSignal,
  NormalizationOptions,
  XPathValidationResult,
  ExistingSelection,
  CleanupOptionsWithValidation,
} from './types';
