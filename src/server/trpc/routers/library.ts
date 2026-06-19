import fs from 'fs/promises';
import path from 'path';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ensureDirectoriesExist, resolveLibraryPath } from '@/utils/defaultPaths';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { isObject, hasProperty, isArray } from '@/utils/type-guards';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { membershipWhere, requireUserId } from './_shared/library-access';
import { computeMissingChaptersProcedure } from './library/compute-missing-chapters';
import { countFilePagesProcedure } from './library/count-file-pages';
import { importFromPipelineProcedure } from './library/import-from-pipeline';
import { importLibraryProcedure } from './library/import-library';
import { scanLibraryProcedure } from './library/scan-library';
import { transferMangaProcedure } from './library/transfer-manga';

interface MangaRow {
  id: number;
  monitoringConfig: string | Record<string, unknown>;
  title: string;
  providerMetadata?: unknown;
  rawProviderData?: unknown;
}

const librarySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required')
});

function extractInterval(manga: MangaRow): string {
  let interval = 'daily';
  try {
    if (!manga.monitoringConfig) return interval;
    const config = typeof manga.monitoringConfig === 'string'
      ? JSON.parse(manga.monitoringConfig) as unknown
      : manga.monitoringConfig;
    if (isObject(config) && hasProperty(config, 'interval') && typeof config['interval'] === 'string') {
      interval = config['interval'];
    }
  } catch (error: unknown) {
    logger.error('Error parsing monitoringConfig:', error instanceof Error ? error.message : String(error));
  }
  return interval;
}

function stripHeavyFields(manga: MangaRow): Record<string, unknown> & { interval: string } {
  const interval = extractInterval(manga);
  const record = manga as unknown as Record<string, unknown>;
  const { providerMetadata: _p, rawProviderData: _r, monitoringConfig: _m, ...rest } = record;
  return { ...rest, interval };
}

function stripMangaPayload(manga: unknown): unknown {
  if (!manga || typeof manga !== 'object') return manga;
  const record = manga as Record<string, unknown>;
  const { providerMetadata: _p, rawProviderData: _r, monitoringConfig: _m, ...rest } = record;
  return rest;
}

async function resolveAndValidateLibraryPath(inputPath: string, excludeId: number): Promise<string> {
  const resolvedPath = resolveLibraryPath(inputPath);
  await fs.mkdir(resolvedPath, { recursive: true });
  const absolutePath = path.resolve(resolvedPath);
  const existing = await prisma.library.findFirst({
    where: { path: absolutePath, NOT: { id: excludeId } }
  });
  if (existing) throw new ValidationError('Another library is already using this path');
  return absolutePath;
}

async function createLibraryDirectory(name: string): Promise<string> {
  const projectRoot = process.cwd();
  const librariesDir = path.join(path.resolve(projectRoot, 'data'), 'libraries');
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const resolvedPath = path.join(librariesDir, safeName);
  await ensureDirectoriesExist();
  await fs.mkdir(resolvedPath, { recursive: true });
  return path.resolve(resolvedPath);
}

async function updateGlobalMonitoringInterval(
  interval: string,
  customInterval?: string,
): Promise<void> {
  const whereClause = { monitoringConfig: { path: ['overrideGlobal'], equals: false } };
  const dataPayload = {
    monitoringConfig: { interval, customInterval, overrideGlobal: false }
  };
  await prisma.manga.updateMany({ where: whereClause, data: dataPayload });
}

export const libraryRouter = router({
  create: protectedProcedure
    .input(librarySchema)
    .mutation(async ({ input }) => {
      logger.info(`Creating library "${input.name}"`);

      let absolutePath: string;
      try {
        absolutePath = await createLibraryDirectory(input.name);
      } catch (error: unknown) {
        logger.error('Failed to create library directory', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create library directory' });
      }

      const existing = await prisma.library.findFirst({ where: { path: absolutePath } });
      if (existing) throw new ValidationError('A library with this path already exists');

      const library = await prisma.library.create({ data: { name: input.name, path: absolutePath } });

      void realtimeEmitter.emitSystemEvent({
        eventType: 'library:created', source: 'libraryRouter',
        message: `Library "${library.name}" created`,
        data: { libraryId: library.id, name: library.name, path: library.path }
      });
      return library;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    // Library rows are global, but each user only counts the titles in their library.
    return prisma.library.findMany({ include: { _count: { select: { Manga: { where: membershipWhere(userId) } } } } });
  }),

  query: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const memberOnly = membershipWhere(userId);
    const libraries = await prisma.library.findMany({
      include: {
        Manga: { where: memberOnly, include: { Metadata: true, Chapter: true } },
        _count: { select: { Manga: { where: memberOnly } } }
      }
    });
    return libraries.map((library) => {
      const obj = library as unknown as Record<string, unknown>;
      const mangaArray = hasProperty(obj, 'Manga') && isArray(obj['Manga']) ? obj['Manga'] : [];
      const transformed = mangaArray.map((m: unknown) => stripHeavyFields(m as MangaRow));
      const countObj = hasProperty(obj, '_count') && isObject(obj['_count']) ? obj['_count'] : {};
      const mangaCount = hasProperty(countObj, 'Manga') && typeof countObj['Manga'] === 'number' ? countObj['Manga'] : 0;
      const { _count: _c, Manga: _m, ...rest } = obj;
      return { ...rest, Manga: transformed, mangaCount };
    });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const library = await prisma.library.delete({ where: { id: input.id } });
      void realtimeEmitter.emitSystemEvent({
        eventType: 'library:deleted', source: 'libraryRouter',
        message: `Library "${library.name}" deleted`,
        data: { libraryId: input.id, name: library.name }
      });
      return library;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1, 'Name is required').optional(),
      path: z.string().min(1, 'Path is required').optional()
    }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const absolutePath = rest.path ? await resolveAndValidateLibraryPath(rest.path, id) : undefined;

      const library = await prisma.library.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(absolutePath !== undefined ? { path: absolutePath } : {})
        }
      });

      void realtimeEmitter.emitSystemEvent({
        eventType: 'library:updated', source: 'libraryRouter',
        message: `Library "${library.name}" updated`,
        data: { libraryId: id, name: library.name, path: library.path }
      });
      return library;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const memberOnly = membershipWhere(userId);
      const library = await prisma.library.findUnique({
        where: { id: input.id },
        include: {
          Manga: { where: memberOnly, include: { Metadata: true, Chapter: true } },
          _count: { select: { Manga: { where: memberOnly } } }
        }
      });
      if (!library) throw new ValidationError('Library not found');

      return {
        id: library.id, name: library.name, path: library.path,
        createdAt: library.createdAt, lastScanAt: library.lastScanAt,
        mangas: library.Manga.map(stripMangaPayload),
        mangaCount: library._count.Manga
      };
    }),

  transferManga: transferMangaProcedure,

  updateGlobalInterval: protectedProcedure
    .input(z.object({
      interval: z.enum(['never', 'hourly', 'daily', 'weekly', 'monthly', 'custom']),
      customInterval: z.string().optional()
    }))
    .mutation(async ({ input }): Promise<null> => {
      await updateGlobalMonitoringInterval(input.interval, input.customInterval);
      void realtimeEmitter.emitSystemEvent({
        eventType: 'library:global-interval:updated', source: 'libraryRouter',
        message: `Global monitoring interval updated to ${input.interval}`,
        data: { interval: input.interval, customInterval: input.customInterval }
      });
      return null;
    }),

  importLibrary: importLibraryProcedure,
  scanLibrary: scanLibraryProcedure,
  countFilePages: countFilePagesProcedure,
  importFromPipeline: importFromPipelineProcedure,
  computeMissingChapters: computeMissingChaptersProcedure
});
