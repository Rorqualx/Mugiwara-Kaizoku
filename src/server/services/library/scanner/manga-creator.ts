/**
 * Manga Creator Module
 *
 * Handles creation of manga database entries with metadata and rule actions.
 * Extracted from scanner.ts createMangaEntry method (lines 418-502)
 */


import { MangaLibraryStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { createMangaSafe } from '@/server/services/library/manga-create-guard';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ImportActions } from '@/types/import-rules';
import { toStringId, toNumberId } from '@/utils/id-converters';
import type { ParsedMangaInfo } from '@/utils/parsers/mangaFileParser';
import { serverLogger } from '@/utils/serverLogger';


import { autoBindAniList } from './anilist-auto-bind';
import { hasTrackedEmit, hasStandardEmit } from './utils';

/**
 * Data required to create a manga entry
 */
export interface MangaCreationData {
  title: string;
  path: string;
  libraryId: number;
  parsed: ParsedMangaInfo;
  ruleActions?: ImportActions;
}

/**
 * Create a manga entry in the database
 *
 * Applies naming patterns, tags, reading direction, and emits events.
 *
 * @param data - Manga creation data
 * @returns Created manga record
 */
export async function createMangaWithMetadata(
  data: MangaCreationData
): Promise<Record<string, unknown>> {
  // Apply naming pattern if specified
  let title = data.title;
  if (data.ruleActions?.namingPattern) {
    title = data.ruleActions.namingPattern
      .replace('{title}', data.title)
      .replace('{group}', data.parsed.group ?? '')
      .replace('{language}', data.parsed.language ?? '');
  }

  const mangaData: Record<string, unknown> = {
    title,
    source: 'local',
    libraryId: data.libraryId,
    libraryPath: data.path,
    libraryStatus: data.ruleActions?.status ?? MangaLibraryStatus.ACTIVE,
    updatedAt: new Date(),
    searchProvider: data.ruleActions?.metadataProvider ?? 'anilist',
    providerMetadata: {
      originalName: data.parsed.original,
      parsedTitle: data.parsed.title,
      group: data.parsed.group,
      language: data.parsed.language,
      year: data.parsed.year,
      tags: data.parsed.tags,
      ruleActions: data.ruleActions
    }
  };

  // Apply tags if specified
  if (data.ruleActions?.tags && data.ruleActions.tags.length > 0) {
    mangaData['tags'] = data.ruleActions.tags.join(',');
  }

  // Apply reading direction if specified
  if (data.ruleActions?.readingDirection) {
    mangaData['readingDirection'] = data.ruleActions.readingDirection;
  }

  const manga = await createMangaSafe(prisma, {
    data: { ...(mangaData as Prisma.MangaCreateInput), libraryPath: data.path },
    include: {
      Metadata: true,
      Library: true
    }
  });

  // Emit manga added notification (legacy eventEmitter)
  if (hasTrackedEmit(eventEmitter)) {
    await eventEmitter.emitWithTracking({
      type: EventType.MANGA_ADDED,
      source: EventSource.LIBRARY,
      mangaId: toStringId(manga.id),
      metadata: {
        mangaTitle: manga.title,
        libraryName: manga.libraryId ? String(manga.libraryId) : 'Unknown',
        source: 'local',
        path: data.path,
        importedFrom: 'directory scan'
      }
    });
  } else if (hasStandardEmit(eventEmitter)) {
    eventEmitter.emit('manga:added', {
      mangaId: manga.id
    });
  }

  // Emit WebSocket event for real-time UI sync
  void realtimeEmitter.emitMangaUpdate({
    mangaId: manga.id,
    action: 'created',
    data: {
      title: manga.title,
      libraryId: data.libraryId,
      source: 'local',
      path: data.path
    }
  });

  // Auto-bind to AniList (fire-and-forget)
  void autoBindAniList(manga.id, manga.title);

  // Log destination folder if specified (file operations would go here)
  if (data.ruleActions?.destinationFolder) {
    serverLogger.info('Rule action: Move to folder', {
      mangaId: toNumberId(manga.id),
      from: data.path,
      to: data.ruleActions.destinationFolder
    });
  }

  return manga;
}
