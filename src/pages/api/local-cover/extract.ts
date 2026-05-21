/**
 * Local Cover Extraction Trigger
 *
 * POST /api/local-cover/extract — Triggers cover extraction for a manga
 * that doesn't have a provider cover. Extracts the first page from the
 * first chapter archive and saves it as the manga cover.
 *
 * Body: { mangaId: number }
 */

import { prisma } from '@/server/db';
import { extractAndSetLocalCover } from '@/server/services/library/scanner/local-cover-extractor';
import { logger } from '@/utils/logger';

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const mangaId = typeof body['mangaId'] === 'number' ? body['mangaId'] : parseInt(String(body['mangaId']), 10);
  if (isNaN(mangaId) || mangaId <= 0) {
    res.status(400).json({ error: 'Invalid mangaId' });
    return;
  }

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, title: true, libraryPath: true },
  });

  if (!manga?.libraryPath) {
    res.status(404).json({ error: 'Manga not found or no library path' });
    return;
  }

  const coverUrl = await extractAndSetLocalCover(manga.id, manga.libraryPath);
  if (coverUrl) {
    logger.info('Cover extracted successfully', { mangaId, coverUrl });
    res.json({ success: true, coverUrl });
  } else {
    res.json({ success: false, error: 'Could not extract cover from archives' });
  }
}
