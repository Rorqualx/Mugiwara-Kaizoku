/**
 * Search Context Exports
 * 
 * This file provides exports for search-related contexts.
 * The MainSearchContext and ModalSearchContext are now consolidated
 * into UnifiedSearchContext for better code reuse and maintainability.
 */

// Export the unified search context and its components
export {
  UnifiedSearchProvider,
  useUnifiedSearch
} from './UnifiedSearchContext';

export { default as UnifiedSearchContext } from './UnifiedSearchContext';
// Backward compatibility exports
// These re-export from UnifiedSearchContext to maintain existing imports
export {
  MainSearchProvider,
  ModalSearchProvider,
  useMainSearch,
  useModalSearch
} from './UnifiedSearchContext';
// Legacy exports for gradual migration
// These will be deprecated in the future
export type { MainSearchProvider as MainSearchContextProvider } from './UnifiedSearchContext';
export type { ModalSearchProvider as ModalSearchContextProvider } from './UnifiedSearchContext';
