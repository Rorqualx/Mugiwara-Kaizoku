/**
 * Root Router Module - CONSOLIDATED
 * 
 * This is the SINGLE source of truth for the application's tRPC router.
 * All routers are imported from the consolidated /routers directory only.
 * 
 * Router Structure:
 * - manga: Manga management and metadata
 * - chapter: Chapter management
 * - files: File operations
 * - conversion: File format conversion (CBZ, PDF, EPUB)
 * - volumeSplit: Volume splitting and chapter extraction
 * - library: Library management and organization
 * - activity: User activity tracking
 * - settings: Application configuration
 * - tasks: Background task management
 * - system: System operations and status
 * - download/downloads: Download management
 * - sync: Data synchronization
 * - suwayomi: Suwayomi server integration
 * - nativeDownload: Native downloader integration
 * - search: Search functionality
 * - metadata: Metadata providers
 * - anilist: AniList API integration with hot caching
 * - config: Configuration management
 * - backup: Backup/restore functionality
 * - notifications: Notification system
 * - integrations: External integrations
 * - wanted: Wanted manga management
 * - users: User management
 * - pathMapping: Network path mapping management
 * - reader: Reader functionality
 * - volume: Volume management and progress tracking
 * - providerMatching: Cross-provider manga matching
 * - calendar: Release calendar
 * - releaseBlocklist: Release blocklist
 * - bulk: Bulk operations
 * - api: API utilities
 * - audioPlayer: Audio player functionality (audiobooks)
 * 
 * @module server/trpc/root
 */

import { z } from 'zod';

import { prisma } from '../db';

import { publicProcedure } from './procedures';
// Import ALL routers from the consolidated routers directory ONLY
import { activityRouter } from './routers/activity';
import { anilistRouter } from './routers/anilist';
import { annotationRouter } from './routers/annotation';
import { apiRouter } from './routers/api';
import { audioPlayerRouter } from './routers/audioPlayer';
import { backupRouter } from './routers/backup';
import { browseRouter } from './routers/browse';
import { browseDiscoverRouter } from './routers/browse-discover';
import { bulkRouter } from './routers/bulk';
import { calendarRouter } from './routers/calendar';
import { chapterRouter } from './routers/chapter';
import { comicvineRouter } from './routers/comicvine';
import { configRouter } from './routers/config';
import { conversionRouter } from './routers/conversion';
import { downloadRouter } from './routers/download';
import { downloadClientsRouter } from './routers/downloadClients';
import { downloadsRouter } from './routers/downloads';
import { eventsRouter } from './routers/events';
import { filesRouter } from './routers/files';
import { flareSolverrRouter } from './routers/flaresolverr';
import { getcomicsRouter } from './routers/getcomics';
import { healthRouter } from './routers/health';
import { historyRouter } from './routers/history';
import { homeRouter } from './routers/home';
import { integrationsRouter } from './routers/integrations';
import { jobsRouter } from './routers/jobs';
import { libraryRouter } from './routers/library';
import { mangaRouter } from './routers/manga';
import { metadataRouter } from './routers/metadata';
import { nativeDownloadRouter } from './routers/native-download';
import { notificationRouter } from './routers/notifications';
import { pathMappingRouter } from './routers/pathMapping';
import { providerMatchingRouter } from './routers/providerMatching';
import { readerRouter } from './routers/reader';
import { releaseBlocklistRouter } from './routers/releaseBlocklist';
import { scanlationGroupRouter } from './routers/scanlationGroup';
import { searchRouter } from './routers/search';
import { settingsRouter } from './routers/settings';
import { suwayomiV2Router } from './routers/suwayomi-v2';
import { syncRouter } from './routers/sync';
import { systemRouter } from './routers/system';
import { usersRouter } from './routers/users';
import { volumeRouter } from './routers/volume';
import { volumeSplitRouter } from './routers/volumeSplit';
import { wantedRouter } from './routers/wanted';
import { router } from './trpc';

import type { Prisma } from '@prisma/client';

// Define the type for chapters with included manga and metadata
type ChapterWithMangaMetadata = Prisma.ChapterGetPayload<{
  include: { Manga: { select: { Metadata: true } } };
}>;

// Helper function to format chapter data
function formatChapter(chapter: ChapterWithMangaMetadata): {
  id: number;
  title: string | null;
  fileName: string | null;
  size: number;
  mangaId: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
} {
  return {
    id: chapter.id,
    title: chapter.title,
    fileName: chapter.fileName,
    size: chapter.size,
    mangaId: chapter.mangaId,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
    metadata: chapter.Manga.Metadata ?? null
  };
}

/**
 * Main application router - SINGLE SOURCE OF TRUTH
 * 
 * This is the ONLY appRouter export in the entire application.
 * All other files should import AppRouter type from this file.
 * 
 * @example
 * ```ts
 * // Client-side usage
 * import type { AppRouter } from '@/server/trpc/root';
 * const manga = await trpc.manga.getById.useQuery('123');
 * ```
 */
export const appRouter = router({
  // Core functionality
  manga: mangaRouter,
  chapter: chapterRouter,
  files: filesRouter,
  conversion: conversionRouter,
  volumeSplit: volumeSplitRouter,
  library: libraryRouter,
  activity: activityRouter,
  settings: settingsRouter,
  jobs: jobsRouter,
  events: eventsRouter,
  system: systemRouter,
  health: healthRouter,
  history: historyRouter,
  home: homeRouter,
  
  // Download management
  download: downloadRouter,
  downloads: downloadsRouter,
  downloadClients: downloadClientsRouter,
  
  // Integrations
  sync: syncRouter,
  suwayomiV2: suwayomiV2Router,
  nativeDownload: nativeDownloadRouter,
  getcomics: getcomicsRouter,
  integrations: integrationsRouter,
  
  // Search and metadata
  search: searchRouter,
  metadata: metadataRouter,
  providerMatching: providerMatchingRouter,
  anilist: anilistRouter,
  comicvine: comicvineRouter,
  
  // Management features
  config: configRouter,
  backup: backupRouter,
  notifications: notificationRouter,
  wanted: wantedRouter,
  users: usersRouter,
  pathMapping: pathMappingRouter,
  
  // Additional features
  reader: readerRouter,
  volume: volumeRouter,
  calendar: calendarRouter,
  releaseBlocklist: releaseBlocklistRouter,
  scanlationGroup: scanlationGroupRouter,
  browse: browseRouter,
  discover: browseDiscoverRouter,
  bulk: bulkRouter,
  api: apiRouter,

  // FlareSolverr integration settings
  flaresolverr: flareSolverrRouter,

  // Audio player (audiobooks)
  audioPlayer: audioPlayerRouter,

  // ML Annotation system
  annotation: annotationRouter,

  // Root-level procedures
  healthCheck: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date()
  })),

  getLatestChapters: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 10;
      const chapters = await prisma.chapter.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { Manga: { select: { Metadata: true } } }
      });
      return chapters.map(formatChapter);
    }),
});

/**
 * Type definition for the application router
 * 
 * This is the ONLY AppRouter type export in the application.
 * All client code should import this type from here.
 * 
 * @example
 * ```ts
 * import type { AppRouter } from '@/server/trpc/root';
 * import { createTRPCNext } from '@trpc/next';
 * 
 * export const trpc = createTRPCNext<AppRouter>({...});
 * ```
 */
export type AppRouter = typeof appRouter;