/**
 * Kavita Integration Types Module
 *
 * Foundation type definitions shared across all Kavita integration modules.
 * This module has zero dependencies and must be extracted FIRST.
 *
 * @module kavita/types
 */

// ============================================================================
// Form Types
// ============================================================================

/**
 * Form values for Kavita integration settings
 */
export interface KavitaFormValues {
  enabled: boolean;
  host: string;
  apiKey: string;
  syncInterval: number;
  autoSync: boolean;
  syncDirection: 'toKavita' | 'fromKavita' | 'bidirectional';
  libraries: string[];
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Available tab values for Kavita settings navigation
 */
export type TabValue = 'connection' | 'sync' | 'libraries' | 'status';

/**
 * Connection status states for Kavita integration
 */
export type ConnectionStatus = 'not_configured' | 'connected' | 'disconnected' | 'error';

// ============================================================================
// Data Types
// ============================================================================

/**
 * Kavita library data structure
 */
export interface KavitaLibrary {
  id: string;
  name: string;
  folders?: string[];
  lastScanned?: string;
  isSelected?: boolean;
}

/**
 * Status data structure for Kavita integration
 */
export interface StatusData {
  host?: string;
  lastSync?: string;
  autoSync?: boolean;
  syncInterval?: number;
  syncDirection?: 'toKavita' | 'fromKavita' | 'bidirectional';
  connectionError?: string;
}

// ============================================================================
// Shared Props Interfaces
// ============================================================================

/**
 * Shared query data returned by useKavitaQueries hook
 */
export interface KavitaQueriesData {
  settingsData: unknown;
  statusData: unknown;
  librariesData: {
    libraries?: KavitaLibrary[];
  } | undefined;
  refetch: {
    settings: () => Promise<unknown>;
    status: () => Promise<unknown>;
    libraries: () => Promise<unknown>;
  };
}

/**
 * Shared mutation handlers returned by useKavitaMutations hook
 */
export interface KavitaMutationHandlers {
  handleSubmit: (values: KavitaFormValues) => void;
  handleTestConnection: (host: string, apiKey: string) => void;
  handleSyncAllLibraries: (libraryIds: string[]) => Promise<void>;
  handleGenerateApiKey: () => void;
}

/**
 * Props for tab components
 */
export interface KavitaTabComponentProps {
  form: {
    values: KavitaFormValues;
    getInputProps: (field: keyof KavitaFormValues, options?: { type?: 'checkbox' }) => unknown;
    setFieldValue: (field: keyof KavitaFormValues, value: unknown) => void;
    isDirty: (field?: keyof KavitaFormValues) => boolean;
    onSubmit: (handler: (values: KavitaFormValues, event?: React.FormEvent) => void) => (event?: React.FormEvent) => void;
  };
  connectionStatus: ConnectionStatus;
  queriesData: KavitaQueriesData;
  mutationHandlers: KavitaMutationHandlers;
  isTesting: boolean;
  mutations?: unknown;
}
