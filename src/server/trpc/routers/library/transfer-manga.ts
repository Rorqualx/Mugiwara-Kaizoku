import path from 'path';

import { z } from 'zod';

import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { ValidationError } from '@/utils/errors';

export const transferMangaProcedure = protectedProcedure
  .input(z.object({
    mangaId: z.number(),
    targetLibraryId: z.number()
  }))
  .mutation(async ({ input }) => {
    const { mangaId, targetLibraryId } = input;

    const targetLibrary = await prisma.library.findUnique({
      where: { id: targetLibraryId }
    });
    if (!targetLibrary) {
      throw new ValidationError('Target library not found');
    }

    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      include: { Library: true }
    });
    if (!manga) {
      throw new ValidationError('Manga not found');
    }

    const sanitizedTitle = manga.title.replace(/[<>:"/\\|?*]/g, '_').trim();
    let newLibraryPath = path.join(targetLibrary.path, sanitizedTitle);
    let suffix = 1;

    while (true) {
      // eslint-disable-next-line no-await-in-loop -- Sequential collision detection required
      const existing = await prisma.manga.findFirst({
        where: { libraryId: targetLibraryId, libraryPath: newLibraryPath, id: { not: mangaId } }
      });
      if (!existing) break;
      newLibraryPath = path.join(targetLibrary.path, `${sanitizedTitle} (${suffix})`);
      suffix++;
      if (suffix > 100) {
        throw new ValidationError(`Cannot generate unique path for "${manga.title}"`);
      }
    }

    const updatedManga = await prisma.manga.update({
      where: { id: mangaId },
      data: {
        libraryId: targetLibraryId,
        libraryPath: newLibraryPath
      },
      include: {
        Library: true,
        Metadata: true,
        Chapter: true
      }
    });

    await eventEmitter.emit('manga:updated', { mangaId });

    void realtimeEmitter.emitMangaUpdate({
      mangaId,
      action: 'updated',
      data: {
        transferred: true,
        fromLibraryId: manga.libraryId,
        toLibraryId: targetLibraryId,
        libraryName: targetLibrary.name
      }
    });

    return updatedManga;
  });
