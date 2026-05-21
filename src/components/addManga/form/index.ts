/**
 * Form Module Exports
 *
 * Re-exports all form-related utilities, types, and handlers
 * for the AddMangaForm component.
 *
 * Architecture:
 * - form-types.ts - Type definitions for form data structures
 * - use-loading-timeout.ts - Custom hook for loading state timeout
 * - manga-selection-handler.ts - Handle manga selection logic
 * - add-manga-handler.ts - Handle add manga mutation
 * - confirmation-data-builder.ts - Build confirmation data
 *
 * Original: form.tsx (1228 lines) → Refactored: 6 modules (~1800 lines total)
 */

// Types
export type {
  VolumeDetail,
  ParsedVolumeData,
  PublisherObject,
  MetadataObject,
  RawDataObject,
  ProviderSpecificObject,
  MangaWithDynamicMetadata,
  ConfirmationDataObject,
  FormType,
  FormValuesExtended,
  AddMangaFormProps,
  SearchResult,
} from './form-types';

export { AddMangaStep } from './form-types';

// Hooks
export { useLoadingTimeout } from './use-loading-timeout';

// Handlers
export {
  extractCoverUrl,
  extractBasicMetadata,
  extractParsedVolumeData,
  extractComicVineData,
  buildFormUpdate,
  buildSelectedManga,
  processMangaSelection,
  type MangaSelectionResult,
} from './manga-selection-handler';

export {
  handleIdOnlyAdd,
  extractVolumeCounts,
  buildMutationInput,
  handleAddError,
  addMangaToLibrary,
  addMangaWithErrorHandling,
  type AddMangaCallbacks,
  type MutationContext,
  type MutationInput,
} from './add-manga-handler';

export { buildConfirmationData } from './confirmation-data-builder';
