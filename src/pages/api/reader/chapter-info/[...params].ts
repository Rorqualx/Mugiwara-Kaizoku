/**
 * Chapter Info API
 *
 * GET /api/reader/chapter-info/[mangaId]/[chapterId] - Get chapter information for reader
 *
 * Returns simple format: { title, format, pageCount } expected by useReader hook
 * If pageCount is NULL in database, counts pages from archive and updates DB
 */
import fs from 'fs/promises';
import path from 'path';

import { type NextApiResponse } from 'next';
import { type Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { prisma } from '@/server/db';
import { listRarImages } from '@/server/services/conversion/utils/rar-extractor';
import {
  ChapterInfoResponseSchema,
  type ErrorResponse,
  type ChapterInfoResponse
} from '@/server/validation/common-schemas';
import { createFileRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ChapterData {
  id: number;
  title: string;
  fileName: string | null;
  filePath: string | null;
  pageCount: number | null;
  /** Legacy alias for pageCount */
  pages: number | null;
  mangaId: number;
  /** Page range start within archive (from active ChapterFile) */
  pageStart: number | null;
  /** Page range end within archive (from active ChapterFile) */
  pageEnd: number | null;
  /** Configured filesystem root for the chapter's library (trusted for traversal guard) */
  libraryPath: string | null;
  Manga: { id: number; title: string };
}

/** Simple response format expected by useReader hook */
type SimpleChapterInfoResponse = ChapterInfoResponse;

interface ParsedIds {
  mangaId: number;
  chapterId: number;
}

// Validation schema
const paramsSchema = z.object({ params: z.array(z.string()).length(2) });

// ============================================================================
// Helper Functions
// ============================================================================

function createErrorResponse(code: string, message: string, requestId: string): ErrorResponse {
  return { status: 'error', error: { code, message, timestamp: new Date().toISOString(), requestId } };
}

function parseAndValidateIds(params: string[], res: NextApiResponse, requestId: string): ParsedIds | null {
  const [mangaIdStr, chapterIdStr] = params;

  if (!mangaIdStr || !chapterIdStr) {
    res.status(400).json(createErrorResponse('INVALID_PARAMETERS', 'Missing manga or chapter ID', requestId));
    return null;
  }

  const mangaId = parseInt(mangaIdStr, 10);
  const chapterId = parseInt(chapterIdStr, 10);

  if (isNaN(mangaId) || isNaN(chapterId)) {
    res.status(400).json(createErrorResponse('INVALID_PARAMETERS', 'Invalid manga or chapter ID', requestId));
    return null;
  }

  return { mangaId, chapterId };
}

// Cache TTL in seconds
const CHAPTER_INFO_CACHE_TTL = 300; // 5 minutes

async function fetchChapterFromDb(chapterId: number): Promise<ChapterData | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      title: true,
      fileName: true,
      filePath: true,
      pageCount: true,
      pages: true,
      mangaId: true,
      Manga: {
        select: {
          id: true,
          title: true,
          Library: { select: { path: true } },
        },
      },
      chapterFiles: {
        where: { isActive: true },
        select: { filePath: true, pageStart: true, pageEnd: true, pageCount: true },
        take: 1,
      },
    },
  });

  if (!chapter) return null;

  const activeFile = chapter.chapterFiles[0];

  return {
    id: chapter.id,
    title: chapter.title,
    fileName: chapter.fileName,
    filePath: activeFile?.filePath ?? chapter.filePath,
    pageCount: activeFile?.pageCount ?? chapter.pageCount,
    pages: chapter.pages,
    mangaId: chapter.mangaId,
    pageStart: activeFile?.pageStart ?? null,
    pageEnd: activeFile?.pageEnd ?? null,
    libraryPath: chapter.Manga.Library.path,
    Manga: { id: chapter.Manga.id, title: chapter.Manga.title },
  };
}

async function fetchChapter(chapterId: number): Promise<ChapterData | null> {
  const cacheKey = `chapter:info:${chapterId}`;

  // 1. Check hot cache (2-5ms)
  const hotCached = await hotCacheProvider.getHot<ChapterData>('chapter', cacheKey);
  if (hotCached) {
    logger.debug('Chapter info cache HIT (hot)', { chapterId });
    return hotCached;
  }

  // 2. Check unified cache (15-30ms)
  const cached = await cacheProvider.get<ChapterData>(cacheKey, 'chapters');
  if (cached) {
    logger.debug('Chapter info cache HIT (unified)', { chapterId });
    void hotCacheProvider.setHot('chapter', cacheKey, cached, { ttl: CHAPTER_INFO_CACHE_TTL });
    return cached;
  }

  // 3. Database query (30-50ms)
  logger.debug('Chapter info cache MISS', { chapterId });
  const chapter = await fetchChapterFromDb(chapterId);

  // 4. Store in caches
  if (chapter) {
    void cacheProvider.set(cacheKey, chapter, { namespace: 'chapters', ttl: CHAPTER_INFO_CACHE_TTL });
    void hotCacheProvider.setHot('chapter', cacheKey, chapter, { ttl: CHAPTER_INFO_CACHE_TTL });
  }

  return chapter;
}

/** Extract format from file name (cbz, cbr, pdf, etc.) */
function getFormatFromFileName(fileName: string | null): string {
  if (!fileName) return 'cbz'; // Default
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'cbz';
  return ext;
}

/** Supported image extensions for page counting */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/** Check if file is a PDF */
function isPdfFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf';
}

/** Check if file is a RAR/CBR archive */
function isRarArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.cbr' || ext === '.rar';
}

/**
 * Count pages in a PDF file using pdf-lib.
 */
async function countPagesInPdf(pdfPath: string): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const buffer = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch (error) {
    logger.warn('Failed to count pages in PDF', {
      pdfPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Count pages in a RAR/CBR archive using node-unrar-js.
 */
async function countPagesInRar(rarPath: string): Promise<number> {
  try {
    const result = await listRarImages(rarPath);
    if (result.status === 'success') {
      return result.data.length;
    }
    logger.warn('Failed to list RAR images', {
      rarPath,
      error: result.status === 'error' ? result.error.message : 'Unknown error'
    });
    return 0;
  } catch (error) {
    logger.warn('Failed to count pages in RAR', {
      rarPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Count pages in an archive file.
 * Supports CBZ/ZIP, CBR/RAR, and PDF formats. Returns 0 if unable to count.
 */
async function countPagesInArchive(archivePath: string): Promise<number> {
  try {
    await fs.access(archivePath);

    if (isPdfFile(archivePath)) {
      return await countPagesInPdf(archivePath);
    }

    if (isRarArchive(archivePath)) {
      return await countPagesInRar(archivePath);
    }

    const buffer = await fs.readFile(archivePath);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    const imageFiles = Object.keys(zip.files).filter(filename => {
      const ext = path.extname(filename).toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext) && !zip.files[filename]?.dir;
    });

    return imageFiles.length;
  } catch (error) {
    logger.warn('Failed to count pages in archive', {
      archivePath,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Update chapter pageCount in database (fire-and-forget)
 */
function updateChapterPageCount(chapterId: number, pageCount: number): void {
  void prisma.chapter.update({
    where: { id: chapterId },
    data: { pageCount }
  }).catch(err => logger.warn('Failed to update chapter pageCount', {
    chapterId,
    pageCount,
    error: err instanceof Error ? err.message : String(err)
  }));
}

/**
 * Invalidate chapter cache after page count update
 */
function invalidateChapterCache(chapterId: number): void {
  const cacheKey = `chapter:info:${chapterId}`;
  void cacheProvider.del(cacheKey, 'chapters');
  // Hot cache doesn't have a direct delete method - it will expire naturally (5 min TTL)
}

function buildSimpleResponse(chapter: ChapterData, pageCount: number): SimpleChapterInfoResponse {
  return {
    title: chapter.title,
    format: getFormatFromFileName(chapter.fileName),
    pageCount
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export default createFileRoute({
  requireAuth: true,
  cache: { maxAge: 60, private: true },
  validation: { query: paramsSchema },
  handlers: {
    GET: async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
      const { params } = req.query as z.infer<typeof paramsSchema>;
      const requestId = req.requestId ?? '';

      const ids = parseAndValidateIds(params, res, requestId);
      if (!ids) return;

      const session = (await getServerSession(req, res, authOptions)) as Session | null;
      if (!session?.user.id) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Authentication required', requestId));
        return;
      }

      logger.debug('Getting chapter info', { mangaId: ids.mangaId, chapterId: ids.chapterId });

      const chapter = await fetchChapter(ids.chapterId);
      if (!chapter) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Chapter not found', requestId));
        return;
      }

      if (chapter.Manga.id !== ids.mangaId) {
        res.status(400).json(createErrorResponse('INVALID_RELATIONSHIP', 'Chapter does not belong to this manga', requestId));
        return;
      }

      // Get page count - use page range if available, otherwise fall back to DB/archive count
      let pageCount: number;
      const { pageStart, pageEnd } = chapter;
      const hasPageRange = pageStart !== null && pageEnd !== null;

      if (hasPageRange) {
        // Use page range for chapter-relative page count
        pageCount = pageEnd - pageStart + 1;
      } else {
        pageCount = chapter.pageCount ?? chapter.pages ?? 0;

        if (pageCount === 0 && chapter.filePath) {
          // Build archive path with traversal guard.
          // Trusted roots: the manga's configured Library.path (architectural truth)
          // and MANGA_FILES_DIR (env fallback for environments without library rows).
          const envBaseDir = process.env['MANGA_FILES_DIR'] ?? '/data/manga';
          const allowedRoots = [chapter.libraryPath, envBaseDir]
            .filter((root): root is string => Boolean(root))
            .map((root) => path.resolve(root));

          const joinBase = chapter.libraryPath ?? envBaseDir;
          const archivePath = path.isAbsolute(chapter.filePath)
            ? path.resolve(chapter.filePath)
            : path.resolve(joinBase, chapter.filePath);

          if (!allowedRoots.some((root) => archivePath.startsWith(root))) {
            logger.warn('Path traversal blocked in chapter-info', {
              chapterId: chapter.id,
              filePath: chapter.filePath,
              allowedRoots,
            });
            return res.status(403).json({ error: 'File path escapes manga directory' });
          }

          // Count pages from archive
          pageCount = await countPagesInArchive(archivePath);

          if (pageCount > 0) {
            logger.info('Counted pages from archive', {
              chapterId: chapter.id,
              pageCount,
              archivePath
            });

            // Update DB with page count (fire-and-forget)
            updateChapterPageCount(chapter.id, pageCount);
            invalidateChapterCache(chapter.id);
          }
        }
      }

      // If page count is still 0 and file exists, return an error instead of misleading 0
      if (pageCount === 0 && chapter.filePath) {
        res.status(422).json(createErrorResponse(
          'PAGE_COUNT_UNAVAILABLE',
          'Unable to determine page count. The archive may be corrupt or in an unsupported format.',
          requestId
        ));
        return;
      }

      // Return validated response format expected by useReader hook
      const response = ChapterInfoResponseSchema.parse(buildSimpleResponse(chapter, pageCount));
      res.status(200).json(response);
    }
  }
});
