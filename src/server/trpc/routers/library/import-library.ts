import fs from 'fs/promises';
import path from 'path';

import { ChapterStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import type { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const mangaImportSchema = z.object({
  folderPath: z.string(),
  provider: z.enum(['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia']).nullable(),
  providerId: z.string().nullable(),
  title: z.string(),
  coverImage: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  fileMatches: z.array(z.object({
    filePath: z.string(),
    fileName: z.string(),
    volumeNumber: z.number().nullable(),
    chapterNumber: z.number().nullable(),
  }))
});

type MangaImport = z.infer<typeof mangaImportSchema>;

function buildProviderMetadata(mangaImport: MangaImport): Prisma.InputJsonValue | undefined {
  if (!mangaImport.provider) return undefined;
  return {
    [mangaImport.provider]: {
      providerId: mangaImport.providerId ?? '',
      boundAt: new Date().toISOString(),
    },
    coverImage: mangaImport.coverImage ?? '',
    year: mangaImport.year ?? 0,
    status: mangaImport.status ?? '',
  };
}

async function createMangaWithChapters(
  tx: TransactionClient,
  libraryId: number,
  userId: string,
  mangaImport: MangaImport,
): Promise<number> {
  const mangaData: Prisma.MangaCreateInput = {
    title: mangaImport.title,
    source: mangaImport.provider ?? 'local',
    Library: { connect: { id: libraryId } },
    libraryPath: path.resolve(mangaImport.folderPath),
    summary: mangaImport.description ?? null,
    searchProvider: mangaImport.provider ?? 'anilist',
    sourceId: mangaImport.providerId ?? null,
    monitoringConfig: { interval: 'daily', overrideGlobal: false },
    updatedAt: new Date(),
  };

  const providerMeta = buildProviderMetadata(mangaImport);
  if (providerMeta) {
    mangaData.providerMetadata = providerMeta;
  }

  const manga = await tx.manga.create({ data: mangaData });

  let idx = 0;
  for (const f of mangaImport.fileMatches) {
    idx++;
    // eslint-disable-next-line no-await-in-loop -- Within Prisma transaction
    await tx.chapter.create({
      data: {
        mangaId: manga.id, fileName: f.fileName, index: idx, title: f.fileName, filePath: f.filePath,
        chapterNumber: f.chapterNumber ?? f.volumeNumber ?? idx, size: 0, pageCount: 0, isRead: false,
        downloadStatus: ChapterStatus.COMPLETED, updatedAt: new Date()
      }
    });
  }

  // Record the importing user's membership for the freshly created shared title.
  await tx.libraryMembership.create({ data: { userId, mangaId: manga.id } });

  return manga.id;
}

export const importLibraryProcedure = protectedProcedure
  .input(z.object({
    name: z.string().min(1, 'Name is required'),
    path: z.string().min(1, 'Path is required'),
    mangaImports: z.array(mangaImportSchema)
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = requireUserId(ctx);
    logger.info(`Importing library "${input.name}" with ${input.mangaImports.length} series`);

    try { await fs.access(input.path); }
    catch { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Import directory does not exist' }); }

    const absolutePath = path.resolve(input.path);
    const existing = await prisma.library.findFirst({ where: { path: absolutePath, ownerId: userId } });
    if (existing) throw new ValidationError('A library with this path already exists');

    const createdMangaIds: number[] = [];
    const result = await prisma.$transaction(async (tx) => {
      const library = await tx.library.create({ data: { name: input.name, path: absolutePath, ownerId: userId } });

      for (const mangaImport of input.mangaImports) {
        // eslint-disable-next-line no-await-in-loop -- Within Prisma transaction
        const mangaId = await createMangaWithChapters(tx, library.id, userId, mangaImport);
        createdMangaIds.push(mangaId);
      }
      return library;
    });

    // eslint-disable-next-line no-await-in-loop -- Event ordering
    for (const mangaId of createdMangaIds) await eventEmitter.emit('manga:added', { mangaId });

    void realtimeEmitter.emitSystemEvent({
      eventType: 'library:imported',
      source: 'libraryRouter',
      message: `Library "${result.name}" imported with ${input.mangaImports.length} manga`,
      data: { libraryId: result.id, name: result.name, mangaCount: input.mangaImports.length }
    });

    logger.info(`Library import completed: ${result.name}`);
    return { id: result.id, name: result.name, path: result.path, mangaCount: input.mangaImports.length };
  });
