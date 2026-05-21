/**
 * System Status Types
 * 
 * This file defines types for the system status API responses.
 * These types align with the actual response structure from the system router.
 */

/**
 * Integration status data for various metadata providers
 */
export interface IntegrationStatusData {
  /** Metadata provider configurations */
  metadata?: {
    /** AniList integration status */
    anilist: {
      enabled: boolean;
      useForMetadata: boolean;
      status: 'active' | 'error' | 'inactive';
    };
    /** ComicVine integration status */
    comicvine: {
      enabled: boolean;
      status: 'active' | 'error' | 'inactive';
      apiConfigured: boolean;
    };
  };
  /** Source provider configurations */
  sources?: {
    /** Suwayomi source provider status */
    suwayomi: {
      enabled: boolean;
      status: 'active' | 'error' | 'inactive';
      sourceCount: number;
      availableSources: string[];
    };
  };
}

/**
 * Database connection information
 */
export interface DatabaseInfo {
  name: string;
  host: string;
  port: string;
  user: string;
  isConnected: boolean;
}

/**
 * System resource information
 */
export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: unknown[]; // CPU info from os.cpus()
  totalMemory: number;
  freeMemory: number;
  uptime: number;
  loadAvg: number[];
  hostname: string;
  networkInterfaces: unknown; // Network interface info from os.networkInterfaces()
}

/**
 * Docker container information
 */
export interface DockerInfo {
  isDocker: boolean;
  containerInfo: {
    port: string;
    timezone: string;
  } | null;
}

/**
 * Application information
 */
export interface ApplicationInfo {
  version: string;
  nodeEnv: string;
  port: string;
  nodeVersion: string;
  startTime: string;
}

/**
 * Complete system status response
 */
export interface SystemStatusResponse {
  database: DatabaseInfo;
  system: SystemInfo;
  docker: DockerInfo;
  application: ApplicationInfo;
  integrations?: IntegrationStatusData;
}

/**
 * Simplified system status for domain usage
 */
export interface SystemStatus {
  database: {
    isConnected: boolean;
    name: string;
  };
  application: {
    version: string;
    environment: string;
    uptime: number;
  };
  system: {
    platform: string;
    memoryUsage: {
      total: number;
      free: number;
      percentUsed: number;
    };
    cpuUsage?: number;
  };
  integrationStatus: Record<string, boolean>;
  lastUpdated: Date | string;
  status: 'healthy' | 'degraded' | 'error';
  warnings?: string[];
  errors?: string[];
}