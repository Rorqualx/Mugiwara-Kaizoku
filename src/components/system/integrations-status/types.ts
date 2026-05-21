/**
 * Types for IntegrationsStatus components
 */
import type { IntegrationStatusData } from '@/types/system-status';

export interface IntegrationsStatusProps {
  /** Whether to show detailed source information */
  detailed?: boolean;
  /** Flag to control whether to show the integrations directly or use context */
  useProvidedData?: boolean;
  /** Integration status data (only used if useProvidedData is true) */
  data?: IntegrationStatusData;
}

export type ConnectionStatus = 'active' | 'error' | 'inactive';

export interface MetadataProviderInfo {
  enabled: boolean;
  status: ConnectionStatus;
  useForMetadata?: boolean;
  apiConfigured?: boolean;
}

export interface SourceProviderInfo {
  enabled: boolean;
  status: ConnectionStatus;
  sourceCount: number;
  availableSources: string[];
}
