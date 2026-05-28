/**
 * ts-mangadex Client Factory
 *
 * Creates MangaDexClient instances using configuration from the DB-backed configService.
 * Provides a Kaizoku-extended client with backward-compatible methods.
 */

import axios from 'axios';
import { MangaDexClient, MangaDexApiError } from 'mangadex-ts-client';

import { logger } from '@/utils/logger';




import { mangadexConfigService } from './configService';

import type { MangaDexScanlationGroup } from './types';
import type { MangaDexClientConfig } from 'mangadex-ts-client';

const log = logger.child('MangaDexClientFactory');

// ============================================================================
// Extended Client with Kaizoku-specific methods
// ============================================================================

/**
 * Extended MangaDex client that adds methods the old MangaDexClientService had
 * but ts-mangadex doesn't (getScanlationGroup, healthCheck).
 * Also re-exports helper functions as instance methods for compatibility.
 */
export class KaizokuMangaDexClient extends MangaDexClient {
  /**
   * Get scanlation group details by ID.
   * MangaDex API: GET /group/{id}
   */
  async getScanlationGroup(groupId: string): Promise<MangaDexScanlationGroup | null> {
    interface GroupResponse {
      data: {
        id: string;
        attributes: {
          name: string;
          description: string | null;
          website: string | null;
          discord: string | null;
          twitter: string | null;
          focusedLanguages: string[] | null;
          official: boolean | null;
          inactive: boolean | null;
          publishDelay: number | null;
        };
      };
    }

    try {
      const response = await axios.get<GroupResponse>(
        `https://api.mangadex.org/group/${groupId}`,
        {
          headers: {
            'User-Agent': 'MangaDex-TypeScript-Client/2.0.0',
            Accept: 'application/json',
          },
          timeout: 30000,
        }
      );

      const group = response.data.data;
      return {
        id: group.id,
        name: group.attributes.name,
        description: group.attributes.description ?? undefined,
        website: group.attributes.website ?? undefined,
        discord: group.attributes.discord ?? undefined,
        twitter: group.attributes.twitter ?? undefined,
        focusedLanguages: group.attributes.focusedLanguages ?? [],
        isOfficial: group.attributes.official ?? false,
        isInactive: group.attributes.inactive ?? false,
        uploadDelay: group.attributes.publishDelay ?? undefined,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      log.error('Failed to get scanlation group', {
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof MangaDexApiError
        ? error
        : new MangaDexApiError(
            `Failed to fetch scanlation group: ${error instanceof Error ? error.message : String(error)}`
          );
    }
  }

  /**
   * Check if the MangaDex API is accessible.
   * Wraps ping() for backward compatibility.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.ping();
      return result === 'pong';
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

function createDefaultKaizokuClient(): KaizokuMangaDexClient {
  return new KaizokuMangaDexClient({
    baseUrl: 'https://api.mangadex.org',
    timeout: 30000,
    rateLimit: {
      maxRequests: 5,
      perMilliseconds: 1000,
    },
    defaultContentRating: ['safe', 'suggestive', 'erotica'],
    userAgent: 'MangaDex-TypeScript-Client/2.0.0',
  });
}

/**
 * Create a new KaizokuMangaDexClient using config from the DB.
 */
export async function createTsMangadexClient(): Promise<KaizokuMangaDexClient> {
  try {
    const config = await mangadexConfigService.getConfig();
    const clientConfig: MangaDexClientConfig = {
      baseUrl: 'https://api.mangadex.org',
      timeout: 30000,
      rateLimit: {
        maxRequests: config.rateLimit.maxRequests,
        perMilliseconds: config.rateLimit.perMilliseconds,
      },
    };
    return new KaizokuMangaDexClient(clientConfig);
  } catch {
    return createDefaultKaizokuClient();
  }
}

/** Lazily initialized singleton client */
let _client: KaizokuMangaDexClient | null = null;

/**
 * Get the singleton client instance. Creates on first call using DB config.
 */
export async function getTsMangadexClient(): Promise<KaizokuMangaDexClient> {
  _client ??= await createTsMangadexClient();
  return _client;
}

/**
 * Synchronous access to a default client (no DB read).
 */
export const tsMangadexClient: KaizokuMangaDexClient = createDefaultKaizokuClient();

/** Alias for backward compatibility */
export const mangadexClient: KaizokuMangaDexClient = tsMangadexClient;

/**
 * Reset the singleton (useful when config changes).
 */
export function resetTsMangadexClient(): void {
  _client = null;
}
