/**
 * System types
 */

export interface SystemInfo {
  version: string;
  environment: 'development' | 'production' | 'staging';
  uptime: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  cpuUsage: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: boolean;
  storage: boolean;
  network: boolean;
  services: Record<string, boolean>;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  debugMode: boolean;
  logLevel: string;
  maxConcurrentJobs: number;
  cacheEnabled: boolean;
}

export interface ApplicationInfoType {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  nodeVersion: string;
  npmVersion?: string;
}

export interface DatabaseInfo {
  name: string;
  host: string;
  port: string;
  user: string;
  isConnected: boolean;
  connected?: boolean; // Backwards compatibility, remove later
  type?: string;
  version?: string;
  database?: string;
  poolSize?: number;
  activeConnections?: number;
  stats?: {
    mangaCount: number;
    chapterCount: number;
    libraryCount: number;
    taskCount: number;
    queueCount: number;
  };
}

export interface DockerInfoType {
  isDocker: boolean;
  containerName?: string;
  containerId?: string;
  image?: string;
  version?: string;
}

export interface ExtendedSystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model?: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network?: {
    rx: number;
    tx: number;
  };
}

export interface IntegrationInfo {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  error?: string;
}

export interface SystemStatusResponse {
  application: ApplicationInfoType;
  database: DatabaseInfo;
  docker?: DockerInfoType;
  metrics: ExtendedSystemMetrics;
  integrations?: IntegrationInfo[];
  health: SystemHealth;
}