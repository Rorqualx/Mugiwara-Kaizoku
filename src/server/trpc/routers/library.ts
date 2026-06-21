import fs from 'fs/promises';
import path from 'path';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ensureDirectoriesExist, resolveLibraryPath } from '@/utils/defaultPaths';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { isObject, hasProperty } from '@/utils/type-guards';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { membershipInLibraryWhere, removeMembership, requireUserId, requireLibraryOwner } from './_shared/library-access';
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
  // The on-disk path is auto-derived per-user from the name in
  // createLibraryDirectory, so callers that only collect a name (the add-time
  // library picker) can omit it.
  path: z.string().min(1).optional()
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

async function resolveAndValidateLibraryPath(inputPath: string, excludeId: number, ownerId: string): Promise<string> {
  const resolvedPath = resolveLibraryPath(inputPath);
  await fs.mkdir(resolvedPath, { recursive: true });
  const absolutePath = path.resolve(resolvedPath);
  const existing = await prisma.library.findFirst({
    where: { path: absolutePath, ownerId, NOT: { id: excludeId } }
  });
  if (existing) throw new ValidationError('Another library is already using this path');
  return absolutePath;
}

async function createLibraryDirectory(name: string, ownerId: string): Promise<string> {
  const projectRoot = process.cwd();
  const librariesDir = path.join(path.resolve(projectRoot, 'data'), 'libraries');
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9]+/g, '-');
  const resolvedPath = path.join(librariesDir, safeOwner, safeName);
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
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      logger.info(`Creating library "${input.name}"`);

      let absolutePath: string;
      try {
        absolutePath = await createLibraryDirectory(input.name, userId);
      } catch (error: unknown) {
        logger.error('Failed to create library directory', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create library directory' });
      }

      const existing = await prisma.library.findFirst({ where: { path: absolutePath, ownerId: userId } });
      if (existing) throw new ValidationError('A library with this path already exists');

      const library = await prisma.library.create({ data: { name: input.name, path: absolutePath, ownerId: userId } });

      void realtimeEmitter.emitSystemEvent({
        eventType: 'library:created', source: 'libraryRouter',
        message: `Library "${library.name}" created`,
        data: { libraryId: library.id, name: library.name, path: library.path }
      });
      return library;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    // Libraries are per-user; only the caller's own libraries are visible.
    // Counts come from LibraryMembership (per library) so linked/deduplicated
    // titles — whose Manga.libraryId points at the original owner — are counted
    // under the user's chosen library. The first library absorbs unassigned rows.
    const libraries = await prisma.library.findMany({ where: { ownerId: userId }, orderBy: { id: 'asc' } });
    return Promise.all(libraries.map(async (library, idx) => {
      const count = await prisma.manga.count({ where: membershipInLibraryWhere(userId, library.id, idx === 0) });
      return { ...library, _count: { Manga: count } };
    }));
  }),

  /**
   * Return the caller's default (first) library, creating one on demand when
   * they have none. This lets any user add titles without first manually
   * creating a library: shared titles are deduplicated into the catalog via
   * LibraryMembership (no re-download), and brand-new titles land in this
   * per-user container. Idempotent — repeated calls return the same library.
   */
  ensureDefault: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const existing = await prisma.library.findFirst({
      where: { ownerId: userId },
      orderBy: { id: 'asc' }
    });
    if (existing) return existing;

    const name = 'My Manga';
    const absolutePath = await createLibraryDirectory(name, userId);
    // Guard the race where two concurrent adds both miss the findFirst above.
    const raced = await prisma.library.findFirst({ where: { path: absolutePath, ownerId: userId } });
    if (raced) return raced;

    const library = await prisma.library.create({ data: { name, path: absolutePath, ownerId: userId } });
    void realtimeEmitter.emitSystemEvent({
      eventType: 'library:created', source: 'libraryRouter',
      message: `Library "${library.name}" created`,
      data: { libraryId: library.id, name: library.name, path: library.path }
    });
    return library;
  }),

  query: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    // List each owned library's titles via LibraryMembership(userId, libraryId)
    // rather than the Manga.libraryId relation, so linked/deduplicated titles
    // surface under the library the user chose. First library absorbs orphans.
    const libraries = await prisma.library.findMany({ where: { ownerId: userId }, orderBy: { id: 'asc' } });
    return Promise.all(libraries.map(async (library, idx) => {
      const mangaArray = await prisma.manga.findMany({
        where: membershipInLibraryWhere(userId, library.id, idx === 0),
        include: { Metadata: true, Chapter: true }
      });
      const transformed = mangaArray.map((m: unknown) => stripHeavyFields(m as MangaRow));
      return { ...library, Manga: transformed, mangaCount: mangaArray.length };
    }));
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await requireLibraryOwner(prisma, userId, input.id);

      // Remove the caller's catalog memberships attributed to this library FIRST.
      // LibraryMembership.libraryId is SetNull on library delete, which would
      // otherwise leave the user still a member (title keeps showing in their
      // library/home). Ref-counted: a shared title other users still hold is
      // kept; a linked title nobody else holds is removed entirely.
      const memberships = await prisma.libraryMembership.findMany({
        where: { userId, libraryId: input.id },
        select: { mangaId: true },
      });
      for (const { mangaId } of memberships) {
        // eslint-disable-next-line no-await-in-loop -- sequential for ref-count correctness
        const { remainingMembers } = await removeMembership(prisma, userId, mangaId);
        if (remainingMembers === 0) {
          // Last holder left a linked/shared title — drop the now-orphaned row.
          // (Titles physically owned by this library are removed by the cascade.)
          // eslint-disable-next-line no-await-in-loop -- sequential cleanup
          await prisma.manga.delete({ where: { id: mangaId } }).catch(() => { /* may already be cascade-deleted */ });
        }
      }

      // Harden against data loss: Manga.libraryId is onDelete:Cascade, so any
      // title PHYSICALLY owned by this library (Manga.libraryId === id) is about
      // to be hard-deleted for EVERYONE. Re-home titles that another user still
      // holds onto that member's library so the cascade can't take their copy.
      // (Files don't move — Manga.libraryPath is unchanged; only the owning
      // library reference is reassigned. Throws on failure so the delete aborts.)
      const ownedTitles = await prisma.manga.findMany({
        where: { libraryId: input.id },
        select: { id: true },
      });
      for (const { id: mangaId } of ownedTitles) {
        // eslint-disable-next-line no-await-in-loop -- sequential re-home for correctness
        const otherMember = await prisma.libraryMembership.findFirst({
          where: { mangaId, userId: { not: userId } },
          select: { userId: true },
        });
        if (!otherMember) continue;
        // eslint-disable-next-line no-await-in-loop -- sequential
        const targetLib = await prisma.library.findFirst({
          where: { ownerId: otherMember.userId },
          orderBy: { id: 'asc' },
          select: { id: true },
        });
        if (!targetLib || targetLib.id === input.id) continue;
        // eslint-disable-next-line no-await-in-loop -- sequential
        await prisma.manga.update({ where: { id: mangaId }, data: { libraryId: targetLib.id } });
      }

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
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const { id, ...rest } = input;
      await requireLibraryOwner(prisma, userId, id);
      const absolutePath = rest.path ? await resolveAndValidateLibraryPath(rest.path, id, userId) : undefined;

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
      const library = await prisma.library.findFirst({ where: { id: input.id, ownerId: userId } });
      if (!library) throw new ValidationError('Library not found');

      // The user's first library is the default that absorbs unassigned memberships.
      const first = await prisma.library.findFirst({ where: { ownerId: userId }, orderBy: { id: 'asc' }, select: { id: true } });
      const mangas = await prisma.manga.findMany({
        where: membershipInLibraryWhere(userId, library.id, first?.id === library.id),
        include: { Metadata: true, Chapter: true }
      });

      return {
        id: library.id, name: library.name, path: library.path,
        createdAt: library.createdAt, lastScanAt: library.lastScanAt,
        mangas: mangas.map(stripMangaPayload),
        mangaCount: mangas.length
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
