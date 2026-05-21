/**
 * Prisma Client Extensions for future/planned models
 * 
 * These models are referenced in the code but not yet implemented in schema.prisma
 */

import type { PrismaClient } from '@prisma/client';

/**
 * AutoDownloadRule - Planned model for automatic download monitoring
 */
export interface AutoDownloadRule {
  id: number;
  mangaId: number;
  enabled: boolean;
  checkInterval: number;
  maxSize?: number;
  preferredGroups?: string[];
  excludeGroups?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * BookmarkedChapter - Planned model for chapter bookmarks
 */
export interface BookmarkedChapter {
  id: number;
  userId: string;
  mangaId: number;
  chapterId: number;
  createdAt: Date;
  chapter: {
    id: number;
  };
}

/**
 * BookmarkedVolume - Planned model for volume bookmarks
 */
export interface BookmarkedVolume {
  id: number;
  userId: string;
  mangaId: number;
  volumeNumber: number;
  createdAt: Date;
}

/**
 * BookmarkedManga - Planned model for manga bookmarks
 */
export interface BookmarkedManga {
  id: number;
  userId: string;
  mangaId: number;
  createdAt: Date;
}

/**
 * Extended Prisma Client with planned models
 *
 * Note: AutoDownloadRule is already in schema.prisma, so it's not included here.
 * Only models that don't yet exist in the schema are defined below.
 */
export type PrismaClientExtended = PrismaClient & {
  bookmarkedChapter: {
    findMany(args: { where: { userId: string; mangaId: number } }): Promise<BookmarkedChapter[]>;
    upsert(args: {
      where: { userId_mangaId_chapterId?: { userId: string; mangaId: number; chapterId: number } };
      create: { userId: string; mangaId: number; chapterId: number };
      update: Record<string, never>;
    }): Promise<BookmarkedChapter>;
    deleteMany(args: { where: { userId: string; mangaId: number; chapterId: number } }): Promise<{ count: number }>;
  };
  bookmarkedVolume: {
    findMany(args: { where: { userId: string; mangaId: number } }): Promise<BookmarkedVolume[]>;
    upsert(args: {
      where: { userId_mangaId_volumeNumber?: { userId: string; mangaId: number; volumeNumber: number } };
      create: { userId: string; mangaId: number; volumeNumber: number };
      update: Record<string, never>;
    }): Promise<BookmarkedVolume>;
    deleteMany(args: { where: { userId: string; mangaId: number; volumeNumber: number } }): Promise<{ count: number }>;
  };
  bookmarkedManga: {
    findFirst(args: { where: { userId: string; mangaId: number } }): Promise<BookmarkedManga | null>;
    upsert(args: {
      where: { userId_mangaId?: { userId: string; mangaId: number } };
      create: { userId: string; mangaId: number };
      update: Record<string, never>;
    }): Promise<BookmarkedManga>;
    deleteMany(args: { where: { userId: string; mangaId: number } }): Promise<{ count: number }>;
  };
}
