/**
 * Type definitions for Indexers Settings Page
 *
 * Shared types for Prowlarr integration and indexer management.
 *
 * Extracted from: src/pages/settings/indexers.tsx
 */
import type { ProwlarrIndexer } from '@/types/prowlarr';
import type { AsyncResult } from '@/utils/async-result/index';

/**
 * UI representation of a Prowlarr indexer
 * Extends ProwlarrIndexer with UI-specific properties
 */
export interface UIIndexer extends ProwlarrIndexer {
  isPending?: boolean; // UI state for loading indicators
}

/**
 * Test result type
 * Note: Renamed from _TestResult to fix ESLint naming-convention violation
 */
export type TestResult = AsyncResult<unknown, Error>;

/**
 * Prowlarr error structure
 */
export interface ProwlarrError {
  message?: string;
  details?: ProwlarrErrorDetail[];
  errorMessage?: string;
}

/**
 * Prowlarr error detail
 */
export interface ProwlarrErrorDetail {
  errorMessage?: string;
  propertyName?: string;
  severity?: string;
}

/**
 * Prowlarr configuration state
 */
export interface ProwlarrConfigState {
  baseURL: string;
  apiKey: string;
  testSuccess: boolean | null;
  testMessage: string;
  isTesting: boolean;
}

/**
 * Indexers management state
 */
export interface IndexersState {
  indexers: UIIndexer[];
  isLoading: boolean;
  error: string | null;
  showIndexers: boolean;
}

/**
 * Props for Prowlarr configuration section
 */
export interface ProwlarrConfigSectionProps {
  prowlarrSettings: {
    enabled: boolean;
    baseURL?: string;
    apiKey?: string;
  };
  formState: ProwlarrConfigState;
  onToggleProwlarr: (enabled: boolean) => Promise<void>;
  onSubmit: (e: React.MouseEvent) => Promise<void>;
  onTest: () => Promise<void>;
  onBaseURLChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}

/**
 * Props for indexers table component
 */
export interface IndexersTableProps {
  indexers: UIIndexer[];
  isLoading: boolean;
  error: string | null;
  prowlarrSettings: {
    enabled: boolean;
    baseURL?: string;
    apiKey?: string;
  };
  onRefresh: () => void;
}
