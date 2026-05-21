import type { 
  ApplicationInfoType,
  DatabaseInfo,
  DockerInfoType,
  ExtendedSystemMetrics,
  IntegrationInfo
} from '@/types/system';

export interface ComponentProps<T> {
  data?: T | null;
  detailed?: boolean;
}

export interface ApplicationInfoProps extends ComponentProps<ApplicationInfoType> {}
export interface DatabaseStatusProps extends ComponentProps<DatabaseInfo> {}
export interface DockerInfoProps extends ComponentProps<DockerInfoType> {}
export interface SystemResourcesProps extends ComponentProps<ExtendedSystemMetrics> {}
export interface IntegrationsStatusProps extends ComponentProps<IntegrationInfo[]> {
  useProvidedData?: boolean;
}
