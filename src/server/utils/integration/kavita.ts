/**
 * Kavita Integration Module
 * 
 * Provides integration with Kavita manga server using API key authentication.
 * This module implements the core functionality needed to interact with Kavita's REST API.
 * 
 * Authentication Flow:
 * 1. Use API key from settings to authenticate with Plugin API
 * 2. Receive JWT token from authentication endpoint
 * 3. Use JWT token for subsequent API requests
 * 
 * @module integrations/kavita
 */

import type { KavitaConfig } from '@/types/config.types';

import { getKavitaConfig } from './integration-settings';

/**
 * Represents a Kavita library
 */
export interface KavitaLibrary {
  id: number;
  name: string;
  type: number;
  folders: string[];
  lastScanned?: string;
}

/**
 * Represents a manga series in Kavita
 */
export interface KavitaSeries {
  id: number;
  libraryId: number;
  name: string;
  localizedName?: string;
  originalName?: string;
  sortName?: string;
  summary?: string;
  created: string;
  lastModified: string;
  coverImageLocked: boolean;
  pagesRead: number;
}

/**
 * Kavita authentication response
 */
interface AuthResponse {
  token: string;
  refreshToken?: string;
  apiKey?: string;
}

/**
 * Kavita server info response
 */
interface ServerInfo {
  version: string;
  buildTime: string;
  isDocker: boolean;
  culture: string;
}

/**
 * Kavita API client class
 * 
 * Handles all interactions with the Kavita server API using API key authentication.
 */
export class KavitaClient {
  private apiKey: string;
  private host: string;
  private token?: string;
  private tokenExpiry?: Date;

  constructor(config: KavitaConfig) {
    this.host = (config.host ?? '').replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey ?? '';
  }

  /**
   * Authenticates with Kavita using API key
   * 
   * @returns JWT token for subsequent requests
   * @throws Error if authentication fails
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    try {
      const response = await fetch(
        `${this.host}/api/Plugin/authenticate?apiKey=${this.apiKey}&pluginName=MugiwaraKaizoku`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as AuthResponse;
      this.token = data.token;

      // JWT tokens typically expire in 7 days for Kavita
      this.tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return this.token;
    } catch (error: unknown) {
      throw new Error(`Kavita authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Tests connection to Kavita server
   * 
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const token = await this.authenticate();
      const response = await fetch(`${this.host}/api/Server/info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Gets server information
   * 
   * @returns Server info including version
   */
  async getServerInfo(): Promise<ServerInfo> {
    const token = await this.authenticate();
    const response = await fetch(`${this.host}/api/Server/info`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch server info: ${response.statusText}`);
    }

    return response.json() as Promise<ServerInfo>;
  }

  /**
   * Gets all libraries from Kavita
   * 
   * @returns Array of Kavita libraries
   */
  async getLibraries(): Promise<KavitaLibrary[]> {
    const token = await this.authenticate();
    const response = await fetch(`${this.host}/api/Library`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch libraries: ${response.statusText}`);
    }

    return response.json() as Promise<KavitaLibrary[]>;
  }

  /**
   * Triggers a library scan
   * 
   * @param libraryId - ID of the library to scan
   * @param force - Force full scan instead of incremental
   */
  async scanLibrary(libraryId: number, force: boolean = false): Promise<void> {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.host}/api/Library/scan?libraryId=${libraryId}&force=${force}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to scan library: ${response.statusText}`);
    }
  }

  /**
   * Gets all series from a library
   * 
   * @param libraryId - ID of the library
   * @returns Array of series in the library
   */
  async getSeriesForLibrary(libraryId: number): Promise<KavitaSeries[]> {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.host}/api/Series/all-v2?libraryId=${libraryId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch series: ${response.statusText}`);
    }

    return response.json() as Promise<KavitaSeries[]>;
  }

  /**
   * Refreshes metadata for a specific series
   * 
   * @param seriesId - ID of the series
   * @param forceUpdate - Force update even if recently updated
   */
  async refreshSeriesMetadata(seriesId: number, forceUpdate: boolean = true): Promise<void> {
    const token = await this.authenticate();
    const response = await fetch(
      `${this.host}/api/Series/refresh-metadata`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          seriesId,
          forceUpdate
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to refresh metadata: ${response.statusText}`);
    }
  }
}

/**
 * Legacy function: Scans all configured Kavita libraries
 * 
 * @deprecated Use KavitaClient.scanLibrary instead
 */
export const scanLibrary = async (): Promise<void> => {
  const config = await getKavitaConfig();

  if (config && config.enabled && config.host && config.apiKey) {
    const client = new KavitaClient(config);

    const libraries = await client.getLibraries();
    const includedLibraries = config.libraries ?? [];

    await Promise.all(
      libraries.
      filter((library) =>
      includedLibraries.length > 0 ?
      includedLibraries.includes(library["name"]) :
      true
      ).
      map(async (library) => {
        await client.scanLibrary(library["id"]);
      })
    );
  }
};

/**
 * Legacy function: Refreshes metadata for a specific manga
 * 
 * @deprecated Use KavitaClient.refreshSeriesMetadata instead
 */
export const refreshMetadata = async (mangaName: string): Promise<void> => {
  const config = await getKavitaConfig();

  if (config && config.enabled && config.host && config.apiKey) {
    const client = new KavitaClient(config);

    const libraries = await client.getLibraries();

    // Search through all libraries for the series
    for (const library of libraries) {
      // eslint-disable-next-line no-await-in-loop
      const series = await client.getSeriesForLibrary(library["id"]);
      const matchingSeries = series.find((s) => s["name"] === mangaName);

      if (matchingSeries) {
        // eslint-disable-next-line no-await-in-loop
        await client.refreshSeriesMetadata(matchingSeries["id"], true);
        break;
      }
    }
  }
};