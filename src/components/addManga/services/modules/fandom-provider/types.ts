/**
 * Type definitions for Fandom provider
 */

/**
 * Mutations interface for Fandom operations
 */
export interface FandomMutations {
  parseFandomUrlMutation?: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
  fetchFandomMutation: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
}
