/**
 * Cover Layers API
 *
 * GET /api/cover-layers/[id]/[file] — serves the living-cover layer assets the
 * cover-layerizer sidecar produces for a manga:
 *   - manifest.json   (layer + motion description)
 *   - character.webp  (static foreground)
 *   - background.webp (drifting inpainted plate)
 *
 * Files live in data/cache/cover-layers/{id}/{file}. The filename is restricted
 * to a fixed allowlist so the dynamic segment can't be used for path traversal.
 */

import fs from 'fs/promises';
import path from 'path';

import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_FILES: Record<string, string> = {
  'manifest.json': 'application/json',
  'character.webp': 'image/webp',
  'background.webp': 'image/webp',
  'background-far.webp': 'image/webp',
  'background-near.webp': 'image/webp',
  'text.webp': 'image/webp',
  'item-0.webp': 'image/webp',
  'item-1.webp': 'image/webp',
  'item-2.webp': 'image/webp',
};

function getLayersDir(): string {
  const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
  return path.join(baseDir, 'cover-layers');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const mangaId = parseInt(String(req.query['id']), 10);
  const file = String(req.query['file']);
  const contentType = ALLOWED_FILES[file];

  if (isNaN(mangaId) || mangaId <= 0 || contentType === undefined) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  const filePath = path.join(getLayersDir(), String(mangaId), file);

  try {
    const buffer = await fs.readFile(filePath);
    res.setHeader('Content-Type', contentType);
    // Manifest is small and may change on re-layerize; images are immutable per build.
    res.setHeader('Cache-Control', file === 'manifest.json' ? 'public, max-age=300' : 'public, max-age=86400');
    res.send(buffer);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
}
