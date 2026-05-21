/**
 * Local Cover API
 *
 * GET /api/local-cover/[id] — Serves locally extracted cover images
 * for manga without external provider covers.
 *
 * Cover images are stored in data/cache/covers/manga-{id}.{ext}
 */

import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';
import { extractAndSetLocalCover } from '@/server/services/library/scanner/local-cover-extractor';

import type { NextApiRequest, NextApiResponse } from 'next';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function getCoverCacheDir(): string {
  const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
  return path.join(baseDir, 'covers');
}

/** Find the cover file for a manga by checking all supported extensions */
async function findCoverFile(coverDir: string, mangaId: number): Promise<{ coverPath: string; ext: string } | null> {
  const checks = SUPPORTED_EXTENSIONS.map(async (ext): Promise<{ coverPath: string; ext: string } | null> => {
    const coverPath = path.join(coverDir, `manga-${mangaId}${ext}`);
    try {
      await fs.access(coverPath);
      return { coverPath, ext: ext as string };
    } catch {
      return null;
    }
  });
  const results = await Promise.all(checks);
  return results.find((r) => r !== null) ?? null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const mangaId = parseInt(String(req.query['id']), 10);
  if (isNaN(mangaId) || mangaId <= 0) {
    res.status(400).json({ error: 'Invalid manga ID' });
    return;
  }

  let found = await findCoverFile(getCoverCacheDir(), mangaId);

  if (!found) {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { libraryPath: true },
    });
    if (manga?.libraryPath) {
      await extractAndSetLocalCover(mangaId, manga.libraryPath);
      found = await findCoverFile(getCoverCacheDir(), mangaId);
    }
  }

  if (!found) {
    res.redirect(302, '/cover-not-found.jpg');
    return;
  }

  const buffer = await fs.readFile(found.coverPath);
  const contentType = CONTENT_TYPES[found.ext] ?? 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buffer);
}
