/**
 * Type definitions for ComicVine settings components
 */

export interface ComicVineFormState {
  apiKeyInput: string;
  validationError: string | null;
  testing: boolean;
}

export interface ComicVineConfig {
  apiKey: string;
  enabled: boolean;
  rateLimit: number;
}
