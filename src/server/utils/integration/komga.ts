/**
 * Komga Integration Module
 * 
 * Provides integration with Komga manga server, handling library scanning
 * and metadata synchronization. This module implements the core functionality
 * needed to interact with Komga's REST API.
 * 
 * Authentication Methods:
 * - Basic Authentication with username/password
 * - API Key authentication via X-API-Key header (since v1.20.0)
 * 
 * @module integrations/komga
 */

import type { KomgaConfig } from '@/types/config.types';
import { sanitizer } from '@/utils/client/frontendHelpers';

import { getKomgaConfig } from './integration-settings';

/**
 * Represents a Komga library
 */
export interface KomgaLibrary {
  id: string;
  name: string;
  root: string;
  type?: string;
  unavailableDate?: string;
  scanFrequency?: string;
  scanOnStartup?: boolean;
  scanCbx?: boolean;
  scanPdf?: boolean;
  scanEpub?: boolean;
  scanForceModifiedTime?: boolean;
  scanDeep?: boolean;
}

/**
 * Represents a collection of series from Komga
 */
export interface KomgaSeriesPage {
  content: KomgaSeries[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Represents a manga series in Komga
 */
export interface KomgaSeries {
  id: string;
  libraryId: string;
  name: string;
  url?: string;
  created: string;
  lastModified: string;
  fileLastModified: string;
  booksCount: number;
  booksReadCount: number;
  booksUnreadCount: number;
  booksInProgressCount: number;
  metadata: {
    status: string;
    statusLock: boolean;
    title: string;
    titleLock: boolean;
    titleSort: string;
    titleSortLock: boolean;
    summary: string;
    summaryLock: boolean;
    publisher: string;
    publisherLock: boolean;
    readingDirection: string;
    readingDirectionLock: boolean;
    ageRating?: number;
    ageRatingLock: boolean;
    language: string;
    languageLock: boolean;
    genres: string[];
    genresLock: boolean;
    tags: string[];
    tagsLock: boolean;
  };
}

/**
 * Komga server information
 */
export interface KomgaServerInfo {
  version: string;
  buildDate: string;
  buildCommit: string;
}

/**
 * Komga API client class
 * 
 * Handles all interactions with the Komga server API supporting both
 * Basic Authentication and API Key authentication methods.
 */
export class KomgaClient {
  private host: string;
  private authMethod: 'basic' | 'apikey';
  private credentials: {
    username?: string;
    password?: string;
    apiKey?: string;
  };

  constructor(config: KomgaConfig) {
    this.host = (config.host ?? '').replace(/\/$/, ''); // Remove trailing slash
    this.authMethod = config.authMethod ?? 'basic';
    this.credentials = {
      ...(config.username ? { username: config.username } : {}),
      ...(config.password ? { password: config.password } : {}),
      ...(config.apiKey ? { apiKey: config.apiKey } : {})
    };
  }

  /**
   * Gets authentication headers based on configured method
   * 
   * @returns Headers object with appropriate auth
   * @throws Error if credentials are missing
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.authMethod === 'apikey' && this.credentials.apiKey) {
      return {
        'X-API-Key': this.credentials.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    } else if (this.credentials.username && this.credentials.password) {
      const auth = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`
      ).toString('base64');
      return {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
    throw new Error('No valid authentication credentials provided');
  }

  /**
   * Tests connection to Komga server
   * 
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/v1/users/me`, {
        headers: this.getAuthHeaders()
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
  async getServerInfo(): Promise<KomgaServerInfo> {
    const response = await fetch(`${this.host}/api/v1/server/info`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch server info: ${response.statusText}`);
    }

    return response.json() as Promise<KomgaServerInfo>;
  }

  /**
   * Gets all libraries from Komga
   * 
   * @returns Array of Komga libraries
   */
  async getLibraries(): Promise<KomgaLibrary[]> {
    const response = await fetch(`${this.host}/api/v1/libraries`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch libraries: ${response.statusText}`);
    }

    return response.json() as Promise<KomgaLibrary[]>;
  }

  /**
   * Triggers a library scan
   * 
   * @param libraryId - ID of the library to scan
   * @param deep - Perform deep scan
   */
  async scanLibrary(libraryId: string, deep: boolean = false): Promise<void> {
    const url = deep ?
    `${this.host}/api/v1/libraries/${libraryId}/scan/deep` :
    `${this.host}/api/v1/libraries/${libraryId}/scan`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to scan library: ${response.statusText}`);
    }
  }

  /**
   * Gets all series (unpaged)
   * 
   * @returns All series in the server
   */
  async getAllSeries(): Promise<KomgaSeries[]> {
    const response = await fetch(`${this.host}/api/v1/series?unpaged=true`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch series: ${response.statusText}`);
    }

    const data = await response.json() as KomgaSeriesPage;
    return data.content;
  }

  /**
   * Gets series for a specific library
   * 
   * @param libraryId - ID of the library
   * @returns Array of series in the library
   */
  async getSeriesForLibrary(libraryId: string): Promise<KomgaSeries[]> {
    const response = await fetch(
      `${this.host}/api/v1/series?library_id=${libraryId}&unpaged=true`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch series: ${response.statusText}`);
    }

    const data = await response.json() as KomgaSeriesPage;
    return data.content;
  }

  /**
   * Refreshes metadata for a specific series
   * 
   * @param seriesId - ID of the series
   */
  async refreshSeriesMetadata(seriesId: string): Promise<void> {
    const response = await fetch(
      `${this.host}/api/v1/series/${seriesId}/metadata/refresh`,
      {
        method: 'POST',
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to refresh metadata: ${response.statusText}`);
    }
  }

  /**
   * Updates series metadata
   * 
   * @param seriesId - ID of the series
   * @param metadata - Metadata to update
   */
  async updateSeriesMetadata(seriesId: string, metadata: Partial<KomgaSeries['metadata']>): Promise<void> {
    const response = await fetch(
      `${this.host}/api/v1/series/${seriesId}/metadata`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(metadata)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update metadata: ${response.statusText}`);
    }
  }
}

/**
 * Scans all configured Komga libraries (no-op when the integration is disabled or unconfigured)
 */
export const scanAllLibraries = async (): Promise<void> => {
  const config = await getKomgaConfig();

  if (config && config.enabled && config.host && (
  (config.authMethod === 'basic' && config.username && config.password) ??
  (config.authMethod === 'apikey' && config.apiKey)))
  {
    const client = new KomgaClient(config);

    const libraries = await client.getLibraries();

    await Promise.all(
      libraries.map(async (library) => {
        await client.scanLibrary(library["id"]);
      })
    );
  }
};

/**
 * Refreshes Komga metadata for the series matching a manga title (no-op when disabled or no match)
 */
export const refreshMetadataByTitle = async (mangaName: string): Promise<void> => {
  const config = await getKomgaConfig();

  if (config && config.enabled && config.host && (
  (config.authMethod === 'basic' && config.username && config.password) ??
  (config.authMethod === 'apikey' && config.apiKey)))
  {
    const client = new KomgaClient(config);

    const series = await client.getAllSeries();
    const matchingSeries = series.find((s) => s["name"] === sanitizer(mangaName));

    if (matchingSeries) {
      await client.refreshSeriesMetadata(matchingSeries["id"]);
    }
  }
};