import fs from 'fs/promises';
import path from 'path';

import { z } from 'zod';

import { prisma } from '@/server/db';
import { protectedProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function isPathWithinLibrary(filePath: string, libraryPath: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedLib = path.resolve(libraryPath);
  return resolved.startsWith(resolvedLib + path.sep) || resolved === resolvedLib;
}

async function validatePathWithinLibrary(filePath: string): Promise<boolean> {
  const libraries = await prisma.library.findMany({ select: { path: true } });
  return libraries.some(lib => isPathWithinLibrary(filePath, lib.path));
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

async function countZipPages(filePath: string): Promise<number> {
  const buffer = await fs.readFile(filePath);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  return Object.keys(zip.files).filter(name =>
    isImageFile(name) && !zip.files[name]?.dir
  ).length;
}

async function countRarPages(filePath: string): Promise<number> {
  const buffer = await fs.readFile(filePath);
  const { createExtractorFromData } = await import('node-unrar-js');
  const arrayBuffer = new Uint8Array(buffer).buffer;
  const extractor = await createExtractorFromData({ data: arrayBuffer });
  const list = extractor.getFileList();

  let count = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fileHeaders is iterable
  for (const fileHeader of list.fileHeaders ?? []) {
    if (isImageFile(fileHeader.name) && !fileHeader.flags.directory) {
      count++;
    }
  }
  return count;
}

interface PageCountResult {
  pageCount: number;
  format: string;
}

async function countPages(filePath: string): Promise<PageCountResult> {
  const ext = path.extname(filePath).toLowerCase();

  await fs.access(filePath);

  if (ext === '.cbz' || ext === '.zip') {
    return { pageCount: await countZipPages(filePath), format: ext.slice(1).toUpperCase() };
  }
  if (ext === '.cbr' || ext === '.rar') {
    return { pageCount: await countRarPages(filePath), format: ext.slice(1).toUpperCase() };
  }
  if (ext === '.pdf') {
    return { pageCount: 0, format: 'PDF' };
  }
  return { pageCount: 0, format: 'UNKNOWN' };
}

export const countFilePagesProcedure = protectedProcedure
  .input(z.object({
    filePath: z.string().min(1, 'File path is required')
  }))
  .query(async ({ input }): Promise<PageCountResult> => {
    const { filePath } = input;

    const isAllowed = await validatePathWithinLibrary(filePath);
    if (!isAllowed) {
      logger.warn('countFilePages: path outside library boundaries', { filePath });
      return { pageCount: 0, format: 'DENIED' };
    }

    try {
      return await countPages(filePath);
    } catch (error) {
      logger.warn('Failed to count pages in archive', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return { pageCount: 0, format: 'ERROR' };
    }
  });
