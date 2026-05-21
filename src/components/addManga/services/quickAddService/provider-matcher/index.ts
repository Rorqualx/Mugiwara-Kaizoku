/**
 * Provider Matcher - Barrel Export
 *
 * Re-exports all provider matching functionality.
 *
 * @module components/addManga/services/quickAddService/provider-matcher
 */

export { convertMatchToSearchResult } from './type-conversion';

export {
  getProvidersToSearch,
  createTimeout,
  extractAlternativeTitlesForMatching,
  executeCrossProviderMatching,
  processMatches
} from './matching-operations';
