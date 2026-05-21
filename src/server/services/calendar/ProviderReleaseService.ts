import { z } from 'zod';

/**
 * Provider Release Service
 *
 * Handles integration with metadata providers to check for new releases
 * and update release schedules based on actual provider data.
 */

// Import providers
import { UnifiedAniListAdapter as AniListAdapter, type AniListConfig } from '@/server/adapters/unified-anilist-adapter';
import { UnifiedComicVineAdapter as ComicVineAdapter } from '@/server/adapters/unified-comicvine-adapter';
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { getConfig, getConfigBoolean } from '@/server/utils/configReader';
import type { ID } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess} from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ProviderReleaseService');

// Zod schemas for validation
const AniListConfigSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string(),
  clientSecret: z.string(),
  accessToken: z.string().optional()
}).passthrough();

const ProviderMetadataItemSchema = z.object({
  providerId: z.string().optional(),
  provider: z.string().optional(),
  externalId: z.string().optional(),
  id: z.string().optional()
}).passthrough();

const ProviderMetadataArraySchema = z.array(ProviderMetadataItemSchema);

interface NewRelease {
  chapterId: string;
  chapterNumber: string;
  title: string;
  releaseDate: Date;
  provider: string;
  url?: string;
}
interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  accessToken?: string;
  username?: string;
  password?: string;
  [key: string]: unknown;
}
export class ProviderReleaseService {
  private anilistAdapter: AniListAdapter | null = null;
  private comicvineAdapter: ComicVineAdapter | null = null;
  // FandomAdapter not available
  // private fandomAdapter: FandomAdapter | null = null;
  /**
   * Initialize providers based on settings from Config table
   */
  async initialize(): Promise<AsyncResult<void, Error>> {
    try {
      // Read provider configurations from Config table
      const [
        anilistEnabled,
        anilistClientId,
        anilistClientSecret,
        anilistAccessToken,
        comicvineEnabled,
        comicvineApiKey
      ] = await Promise.all([
        getConfigBoolean('anilist.enabled', true),
        getConfig('anilist.clientId'),
        getConfig('anilist.clientSecret'),
        getConfig('anilist.accessToken'),
        getConfigBoolean('comicvine.enabled', false),
        getConfig('comicvine.apiKey')
      ]);

      // Initialize AniList
      if (anilistEnabled && anilistClientId && anilistClientSecret) {
        const anilistConfig: Record<string, unknown> = {
          enabled: true,
          clientId: anilistClientId,
          clientSecret: anilistClientSecret
        };
        if (anilistAccessToken) {
          anilistConfig['accessToken'] = anilistAccessToken;
        }

        const result = AniListConfigSchema.safeParse(anilistConfig);
        if (!result.success) {
          logger.error('[ProviderRelease] Invalid AniList config:', result.error);
        } else {
          // Type assertion to adapter's expected config type (validated by Zod)
          // Using double assertion since Zod validation ensures structure matches
          this.anilistAdapter = new AniListAdapter(result.data as unknown as AniListConfig);
          logger.info('[ProviderRelease] AniList adapter initialized from Config table', {});
        }
      }

      // Initialize ComicVine
      if (comicvineEnabled && comicvineApiKey) {
        this.comicvineAdapter = new ComicVineAdapter({
          enabled: true,
          apiKey: comicvineApiKey
        });
        logger.info('[ProviderRelease] ComicVine adapter initialized from Config table', {});
      }

      // Initialize Fandom - commented out as FandomAdapter not available
      /*
      const fandomEnabled = await getConfigBoolean('fandom.enabled', false);
      if (fandomEnabled) {
        const wikiDomain = await getConfig('fandom.wikiDomain') || 'manga.fandom.com';
        this.fandomAdapter = new FandomAdapter({
          enabled: true,
          wikiDomain
        });
        logger.info('[ProviderRelease] Fandom adapter initialized from Config table', {});
      }
      */

      return createSuccessResult(undefined);
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] Failed to initialize providers from Config table', {
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Check if provider is enabled
   */
  private isProviderEnabled(config: unknown): boolean {
    if (!config || typeof config !== 'object')
    return false;
    const providerConfig = config as ProviderConfig;
    return providerConfig.enabled === true;
  }
  /**
   * Check for new releases for a specific manga
   */
  async checkForNewReleases(mangaId: ID): Promise<AsyncResult<NewRelease[], Error>> {
    try {
      const numericId = toNumberId(mangaId);
      // Get manga with provider metadata
      const manga = await prisma.manga.findUnique({
        where: {
          id: numericId
        },
        include: {
          Chapter: {
            orderBy: {
              index: 'desc'
            },
            take: 1
          }
        }
      });
      if (!manga) {
        return createErrorResult(new Error('Manga not found'));
      }
      // Parse provider metadata
      const result = ProviderMetadataArraySchema.safeParse(manga.providerMetadata);
      if (!result.success) {
        logger.warn('[ProviderRelease] Invalid provider metadata format:', result.error);
        return createSuccessResult([]);
      }

      const providerMetadata = result.data;

      // Check each provider in parallel
      const releasePromises = providerMetadata.map(async (metadata) => {
        const providerId = metadata.providerId ?? metadata.provider;
        const externalId = metadata.externalId ?? metadata.id;
        if (!providerId || !externalId) {
          return [];
        }
        const releases = await this.checkProviderForReleases(providerId, externalId, manga.Chapter[0]?.index ?? 0);
        return isSuccess(releases) ? releases.data : [];
      });

      const releaseResults = await Promise.all(releasePromises);
      const newReleases = releaseResults.flat();

      let createdCount = 0;
      let updatedCount = 0;

      // Process new releases in database
      await Promise.all(newReleases.map(async (release) => {
        // Check if chapter already exists
        const existingChapter = await prisma.chapter.findFirst({
          where: {
            mangaId: numericId,
            index: parseFloat(release.chapterNumber)
          }
        });

        if (!existingChapter) {
          // Create new chapter
          const newChapter = await prisma.chapter.create({
            data: {
              mangaId: numericId,
              title: release.title,
              index: parseFloat(release.chapterNumber),
              fileName: '',
              hash: '',
              size: 0,
              pageCount: 0,
              releaseDate: release.releaseDate,
              updatedAt: new Date()
            }
          });
          createdCount++;

          // Emit WebSocket event for new chapter
          void realtimeEmitter.emitChapterUpdate({
            chapterId: newChapter.id,
            mangaId: numericId,
            action: 'created',
            data: {
              chapterNumber: release.chapterNumber,
              title: release.title,
              provider: release.provider,
              source: 'provider-release-service'
            }
          });

          logger.info(`[ProviderRelease] New chapter ${release.chapterNumber} found for manga ${manga.title}`, {
            chapterNumber: release.chapterNumber,
            mangaTitle: manga.title
          });
        } else if (!existingChapter.releaseDate) {
          // Update release date if not set
          await prisma.chapter.update({
            where: {
              id: existingChapter.id
            },
            data: {
              releaseDate: release.releaseDate
            }
          });
          updatedCount++;
        }
      }));

      // Emit summary event if any releases were processed
      if (newReleases.length > 0) {
        void realtimeEmitter.emitMangaUpdate({
          mangaId: numericId,
          action: 'updated',
          data: {
            newReleasesDetected: true,
            releasesCount: newReleases.length,
            chaptersCreated: createdCount,
            chaptersUpdated: updatedCount,
            source: 'provider-release-service'
          }
        });
      }

      return createSuccessResult(newReleases);
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] Failed to check for new releases', {
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Check specific provider for releases
   */
  private async checkProviderForReleases(providerId: string, externalId: string, _lastChapterIndex: number): Promise<AsyncResult<NewRelease[], Error>> {
    try {
      switch (providerId.toLowerCase()) {
        case 'anilist':
          return await this.checkAniListReleases(externalId, _lastChapterIndex);
        case 'comicvine':
          return await this.checkComicVineReleases(externalId, _lastChapterIndex);
        case 'fandom':
          return await this.checkFandomReleases(externalId, _lastChapterIndex);
        default:
          return createSuccessResult([]);
      }
    }
    catch (error: unknown) {const _errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`[ProviderRelease] Failed to check ${providerId} for releases`, {
        providerId,
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check AniList for new releases
   */
  private async checkAniListReleases(mangaId: string, _lastChapterIndex: number): Promise<AsyncResult<NewRelease[], Error>> {
    if (!this.anilistAdapter) {
      return createSuccessResult([]);
    }
    try {
      // AniList doesn't provide chapter-level data, but we can get release schedule info
      try {
        const mangaResult = await this.anilistAdapter.getById(mangaId);
        if (!isSuccess(mangaResult)) {
          throw new ValidationError('Failed to get manga from AniList');
        }
        const _mangaData = mangaResult.data;
        // AniList provides nextAiringEpisode for anime, but not chapter releases for manga
        // We could potentially use the updatedAt field to detect changes
      }
      catch (error: unknown) {
        logger.error('[ProviderRelease] Failed to get AniList manga', {
          error: error instanceof Error ? error.message : String(error)
        });
        return createSuccessResult([]);
      }
      // AniList provides nextAiringEpisode for anime, but not chapter releases for manga
      // We could potentially use the updatedAt field to detect changes
      return createSuccessResult([]);
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] AniList check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Check ComicVine for new releases
   */
  private checkComicVineReleases(_volumeId: string, _lastChapterIndex: number): Promise<AsyncResult<NewRelease[], Error>> {
    if (!this.comicvineAdapter) {
      return Promise.resolve(createSuccessResult([]));
    }
    try {
      // ComicVine works with issues/volumes, not chapters
      // We would need to map issues to chapters
      return Promise.resolve(createSuccessResult([]));
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] ComicVine check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return Promise.resolve(createErrorResult(error instanceof Error ? error : new Error(String(error))));
    }
  }
  /**
   * Check Fandom for new releases
   */
  private checkFandomReleases(_mangaId: string, _lastChapterIndex: number): Promise<AsyncResult<NewRelease[], Error>> {
    // FandomAdapter not available
    // if (!this.fandomAdapter) {
    // return Promise.resolve(createSuccessResult([]));
    // }
    // Fandom wikis don't typically have real-time release data
    // They're more for general information
    return Promise.resolve(createSuccessResult([]));
  }
  /**
   * Update release dates from provider data
   */
  async updateReleaseDatesFromProvider(mangaId: ID): Promise<AsyncResult<void, Error>> {
    try {
      const numericId = toNumberId(mangaId);
      // Get manga with provider metadata
      const manga = await prisma.manga.findUnique({
        where: {
          id: numericId
        },
        include: {
          Chapter: {
            where: {
              releaseDate: null
            },
            orderBy: {
              index: 'asc'
            }
          }
        }
      });
      if (!manga) {
        return createErrorResult(new Error('Manga not found'));
      }
      // Parse provider metadata
      const metadataResult = ProviderMetadataArraySchema.safeParse(manga.providerMetadata);
      if (!metadataResult.success) {
        logger.warn('[ProviderRelease] Invalid provider metadata format:', metadataResult.error);
        return createSuccessResult(undefined);
      }

      return createSuccessResult(undefined);
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] Failed to update release dates', {
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Fetch AniList schedule info for a manga
   */
  private async fetchAniListScheduleInfo(externalId: string): Promise<Record<string, unknown> | null> {
    if (!this.anilistAdapter) {
      return null;
    }

    try {
      const anilistResult = await this.anilistAdapter.getById(externalId);
      if (!isSuccess(anilistResult)) {
        throw new ValidationError('Failed to get manga from AniList');
      }
      const anilistData = anilistResult.data;
      return {
        status: anilistData['status'],
        updatedAt: anilistData['updatedAt']
        // Add any other relevant schedule info from AniList
      };
    } catch (error: unknown) {
      logger.error('[ProviderRelease] Failed to get AniList manga for schedule info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get provider release schedule info
   */
  async getProviderScheduleInfo(mangaId: ID): Promise<AsyncResult<unknown, Error>> {
    try {
      const numericId = toNumberId(mangaId);
      // Get manga with provider metadata
      const manga = await prisma.manga.findUnique({
        where: {
          id: numericId
        }
      });
      if (!manga) {
        return createErrorResult(new Error('Manga not found'));
      }
      // Parse provider metadata
      const metadataResult = ProviderMetadataArraySchema.safeParse(manga.providerMetadata);
      if (!metadataResult.success) {
        logger.warn('[ProviderRelease] Invalid provider metadata format:', metadataResult.error);
        return createSuccessResult({});
      }

      const providerMetadata = metadataResult.data;
      const scheduleInfo: Record<string, unknown> = {};

      // Check AniList for schedule info
      const anilistMetadata = providerMetadata.find((m) => (m.providerId ?? m.provider) === 'anilist');
      const externalId = anilistMetadata?.externalId ?? anilistMetadata?.id;

      if (externalId && this.anilistAdapter) {
        const anilistInfo = await this.fetchAniListScheduleInfo(externalId);
        if (anilistInfo) {
          scheduleInfo['anilist'] = anilistInfo;
        }
      }

      return createSuccessResult(scheduleInfo);
    }
    catch (error: unknown) {
      logger.error('[ProviderRelease] Failed to get provider schedule info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.anilistAdapter) {
      // No dispose method on adapter
      this.anilistAdapter = null;
    }
    if (this.comicvineAdapter) {
      // No dispose method on adapter
      this.comicvineAdapter = null;
    }
    // if (this.fandomAdapter) {
    //   this.fandomAdapter.dispose();
    //   this.fandomAdapter = null;
    // }
  }
}
// Export singleton instance
export const providerReleaseService = new ProviderReleaseService();