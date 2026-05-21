/**
 * Scanlation Group Service
 *
 * Manages scanlation group data, preferences, and relationships with manga.
 * Integrates with MangaDex API for group information.
 *
 * @module server/services/scanlation/ScanlationGroupService
 */

import { prisma } from '@/server/db';
import { mangadexClient } from '@/server/services/mangadex';
import type { MangaDexScanlationGroup } from '@/server/services/mangadex/types';
import { logger } from '@/utils/logger';

import type { ScanlationGroup, MangaScanlationGroup } from '@prisma/client';

const log = logger.child('ScanlationGroupService');

/**
 * Group preference for a manga
 */
export type GroupPreference = 'preferred' | 'excluded' | 'neutral';

/**
 * Scanlation Group with preference info
 */
export interface GroupWithPreference {
  group: ScanlationGroup;
  preference: GroupPreference;
  chapterCount: number;
  lastActivity?: Date;
}

/**
 * Scanlation Group Service
 */
class ScanlationGroupServiceImpl {
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get or fetch a scanlation group by ID
   */
  async getGroup(groupId: string, fetchIfMissing: boolean = true): Promise<ScanlationGroup | null> {
    try {
      // Try to get from database first
      let group = await prisma.scanlationGroup.findUnique({
        where: { id: groupId }
      });

      // Check if we need to refresh
      const needsRefresh = group?.lastFetchedAt &&
        Date.now() - group.lastFetchedAt.getTime() > this.CACHE_DURATION;

      // Fetch from MangaDex if missing or stale
      if ((!group || needsRefresh) && fetchIfMissing) {
        const mdGroup = await mangadexClient.getScanlationGroup(groupId);
        if (mdGroup) {
          group = await this.upsertGroup(mdGroup);
        }
      }

      return group;
    } catch (error) {
      log.error('Failed to get scanlation group', {
        groupId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get all groups associated with a manga
   */
  async getMangaGroups(
    mangaId: number,
    language?: string
  ): Promise<GroupWithPreference[]> {
    try {
      const where: { mangaId: number; language?: string } = { mangaId };
      if (language) {
        where.language = language;
      }

      const mangaGroups = await prisma.mangaScanlationGroup.findMany({
        where,
        include: { group: true },
        orderBy: [
          { isPreferred: 'desc' },
          { chapterCount: 'desc' }
        ]
      });

      return mangaGroups.map(mg => ({
        group: mg.group,
        preference: mg.isExcluded ? 'excluded' : mg.isPreferred ? 'preferred' : 'neutral',
        chapterCount: mg.chapterCount,
        ...(mg.lastActivity ? { lastActivity: mg.lastActivity } : {})
      }));
    } catch (error) {
      log.error('Failed to get manga groups', {
        mangaId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Set preference for a group on a manga
   */
  async setGroupPreference(
    mangaId: number,
    groupId: string,
    preference: GroupPreference,
    language: string = 'en'
  ): Promise<MangaScanlationGroup | null> {
    try {
      // Ensure group exists
      await this.getGroup(groupId, true);

      const data = {
        isPreferred: preference === 'preferred',
        isExcluded: preference === 'excluded'
      };

      const mangaGroup = await prisma.mangaScanlationGroup.upsert({
        where: {
          mangaId_groupId_language: {
            mangaId,
            groupId,
            language
          }
        },
        create: {
          mangaId,
          groupId,
          language,
          ...data
        },
        update: data
      });

      log.info('Set group preference', { mangaId, groupId, preference });
      return mangaGroup;
    } catch (error) {
      log.error('Failed to set group preference', {
        mangaId,
        groupId,
        preference,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Search for groups by name
   */
  async searchGroups(query: string, limit: number = 20): Promise<ScanlationGroup[]> {
    try {
      const groups = await prisma.scanlationGroup.findMany({
        where: {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        take: limit,
        orderBy: { totalUploads: 'desc' }
      });

      return groups;
    } catch (error) {
      log.error('Failed to search groups', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get preferred groups for a manga
   */
  async getPreferredGroups(mangaId: number, language?: string): Promise<string[]> {
    try {
      const where: { mangaId: number; isPreferred: boolean; language?: string } = {
        mangaId,
        isPreferred: true
      };
      if (language) {
        where.language = language;
      }

      const preferred = await prisma.mangaScanlationGroup.findMany({
        where,
        select: { groupId: true }
      });

      return preferred.map(p => p.groupId);
    } catch (error) {
      log.error('Failed to get preferred groups', {
        mangaId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get excluded groups for a manga
   */
  async getExcludedGroups(mangaId: number, language?: string): Promise<string[]> {
    try {
      const where: { mangaId: number; isExcluded: boolean; language?: string } = {
        mangaId,
        isExcluded: true
      };
      if (language) {
        where.language = language;
      }

      const excluded = await prisma.mangaScanlationGroup.findMany({
        where,
        select: { groupId: true }
      });

      return excluded.map(e => e.groupId);
    } catch (error) {
      log.error('Failed to get excluded groups', {
        mangaId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Link a chapter to its scanlation groups
   */
  async linkChapterGroups(chapterId: number, groupIds: string[]): Promise<void> {
    try {
      // Ensure groups exist
      await Promise.all(groupIds.map(id => this.getGroup(id, true)));

      // Create chapter-group links
      await prisma.chapterScanlationGroup.createMany({
        data: groupIds.map(groupId => ({ chapterId, groupId })),
        skipDuplicates: true
      });

      log.debug('Linked chapter to groups', { chapterId, groupCount: groupIds.length });
    } catch (error) {
      log.error('Failed to link chapter groups', {
        chapterId,
        groupIds,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update manga-group relationship stats
   */
  async updateMangaGroupStats(
    mangaId: number,
    groupId: string,
    language: string = 'en'
  ): Promise<void> {
    try {
      // Count chapters from this group for this manga
      const chapterCount = await prisma.chapterScanlationGroup.count({
        where: {
          groupId,
          chapter: { mangaId }
        }
      });

      // Get latest chapter from this group
      const latestChapter = await prisma.chapterScanlationGroup.findFirst({
        where: {
          groupId,
          chapter: { mangaId }
        },
        orderBy: { chapter: { releaseDate: 'desc' } },
        include: { chapter: { select: { releaseDate: true } } }
      });

      // Update or create manga-group relationship
      await prisma.mangaScanlationGroup.upsert({
        where: {
          mangaId_groupId_language: { mangaId, groupId, language }
        },
        create: {
          mangaId,
          groupId,
          language,
          chapterCount,
          lastActivity: latestChapter?.chapter.releaseDate ?? null
        },
        update: {
          chapterCount,
          lastActivity: latestChapter?.chapter.releaseDate ?? null
        }
      });
    } catch (error) {
      log.error('Failed to update manga-group stats', {
        mangaId,
        groupId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ==================== Private Helpers ====================

  /**
   * Upsert a scanlation group from MangaDex data
   */
  private async upsertGroup(mdGroup: MangaDexScanlationGroup): Promise<ScanlationGroup> {
    return prisma.scanlationGroup.upsert({
      where: { id: mdGroup.id },
      create: {
        id: mdGroup.id,
        name: mdGroup.name,
        description: mdGroup.description ?? null,
        website: mdGroup.website ?? null,
        discord: mdGroup.discord ?? null,
        twitter: mdGroup.twitter ?? null,
        focusedLanguages: mdGroup.focusedLanguages,
        isOfficial: mdGroup.isOfficial,
        isInactive: mdGroup.isInactive,
        uploadDelay: mdGroup.uploadDelay ?? null,
        lastFetchedAt: new Date()
      },
      update: {
        name: mdGroup.name,
        description: mdGroup.description ?? null,
        website: mdGroup.website ?? null,
        discord: mdGroup.discord ?? null,
        twitter: mdGroup.twitter ?? null,
        focusedLanguages: mdGroup.focusedLanguages,
        isOfficial: mdGroup.isOfficial,
        isInactive: mdGroup.isInactive,
        uploadDelay: mdGroup.uploadDelay ?? null,
        lastFetchedAt: new Date()
      }
    });
  }
}

// Export singleton instance
export const scanlationGroupService = new ScanlationGroupServiceImpl();
