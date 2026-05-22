/**
 * Chapter Validation for Page Reader API
 *
 * Handles chapter fetching and ownership validation.
 * Uses 3-tier caching: hot cache → unified cache → database
 */

import fs from 'fs/promises';
import path from 'path';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ValidatedPageParams } from './parameter-validation';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Cached chapter data from database
 */
interface CachedChapterData {
  id: number;
  filePath: string | null;
  pageCount: number | null;
  pages: number | null;
  mangaId: number;
  /** Page range within a volume file (from active ChapterFile) */
  pageStart: number | null;
  /** Page range end within a volume file (from active ChapterFile) */
  pageEnd: number | null;
  /** Source type of the active file */
  sourceType: string | null;
  /** Configured filesystem root for the chapter's library (trusted for traversal guard) */
  libraryPath: string | null;
  Manga: {
    id: number;
    title: string;
    libraryId: number | null;
  } | null;
}

/**
 * Validated chapter data
 */
export interface ValidatedChapter {
  chapter: {
    id: number;
    filePath: string;
    pageCount: number | null;
    pages: number | null;
    mangaId: number;
  };
  archivePath: string;
  totalPages: number;
  /** 1-indexed start page within archive (for volume files) */
  pageStart?: number;
  /** 1-indexed end page within archive (for volume files) */
  pageEnd?: number;
}

// Cache TTL in seconds
const CHAPTER_CACHE_TTL = 300; // 5 minutes

/**
 * Fetch chapter from database, including active ChapterFile data
 */
async function fetchChapterFromDb(chapterId: number): Promise<CachedChapterData | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      filePath: true,
      pageCount: true,
      pages: true,
      mangaId: true,
      Manga: {
        select: {
          id: true,
          title: true,
          libraryId: true,
          Library: { select: { path: true } },
        },
      },
      chapterFiles: {
        where: { isActive: true },
        select: { filePath: true, pageStart: true, pageEnd: true, pageCount: true, sourceType: true },
        take: 1,
      },
    },
  });

  if (!chapter) return null;

  const activeFile = chapter.chapterFiles[0];

  return {
    id: chapter.id,
    filePath: activeFile?.filePath ?? chapter.filePath,
    pageCount: activeFile?.pageCount ?? chapter.pageCount,
    pages: chapter.pages,
    mangaId: chapter.mangaId,
    pageStart: activeFile?.pageStart ?? null,
    pageEnd: activeFile?.pageEnd ?? null,
    sourceType: activeFile?.sourceType ?? null,
    libraryPath: chapter.Manga.Library.path,
    Manga: {
      id: chapter.Manga.id,
      title: chapter.Manga.title,
      libraryId: chapter.Manga.libraryId,
    },
  };
}

/**
 * Store chapter in caches
 */
function storeInCaches(cacheKey: string, chapter: CachedChapterData): void {
  void cacheProvider.set(cacheKey, chapter, { namespace: 'chapters', ttl: CHAPTER_CACHE_TTL });
  void hotCacheProvider.setHot('chapter', cacheKey, chapter, { ttl: CHAPTER_CACHE_TTL });
}

/**
 * Get chapter data with 3-tier caching.
 * Flow: hot cache (2-5ms) → unified cache (15-30ms) → database (30-50ms)
 */
async function getCachedChapter(chapterId: number): Promise<CachedChapterData | null> {
  const cacheKey = `chapter:validation:${chapterId}`;

  // 1. Check hot cache (fastest, ~2-5ms)
  const hotCached = await hotCacheProvider.getHot<CachedChapterData>('chapter', cacheKey);
  if (hotCached) {
    logger.debug('Chapter cache HIT (hot)', { chapterId });
    return hotCached;
  }

  // 2. Check unified cache (fast, ~15-30ms)
  const cached = await cacheProvider.get<CachedChapterData>(cacheKey, 'chapters');
  if (cached) {
    logger.debug('Chapter cache HIT (unified)', { chapterId });
    void hotCacheProvider.setHot('chapter', cacheKey, cached, { ttl: CHAPTER_CACHE_TTL });
    return cached;
  }

  // 3. Database query (slowest, ~30-50ms)
  logger.debug('Chapter cache MISS', { chapterId });
  const chapter = await fetchChapterFromDb(chapterId);

  // 4. Store in caches if found
  if (chapter) {
    storeInCaches(cacheKey, chapter);
  }

  return chapter;
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  requestId: string
): {
  status: 'error';
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
} {
  return {
    status: 'error',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
}

/**
 * Fetches and validates chapter for page reading
 *
 * @returns ValidatedChapter if valid, null if invalid (response already sent)
 */
export async function fetchAndValidateChapter(
  params: ValidatedPageParams,
  req: NextApiRequest,
  res: NextApiResponse
): Promise<ValidatedChapter | null> {
  const requestId = (req as NextApiRequest & { requestId?: string }).requestId ?? '';
  const { mangaId, chapterId, pageNumber } = params;

  // Get chapter with 3-tier caching (hot → unified → db)
  const chapter = await getCachedChapter(chapterId);

  if (!chapter) {
    res.status(404).json(createErrorResponse('CHAPTER_NOT_FOUND', 'Chapter not found', requestId));
    return null;
  }

  // Verify chapter belongs to requested manga
  if (chapter.mangaId !== mangaId) {
    res.status(400).json(
      createErrorResponse('INVALID_RELATIONSHIP', 'Chapter does not belong to this manga', requestId)
    );
    return null;
  }

  // Determine effective page count (use page range if available)
  const { pageStart, pageEnd } = chapter;
  const hasPageRange = pageStart !== null && pageEnd !== null;
  const totalPages = hasPageRange
    ? (pageEnd - pageStart + 1)
    : (chapter.pageCount ?? chapter.pages ?? 0);

  if (totalPages > 0 && pageNumber > totalPages) {
    res.status(404).json(
      createErrorResponse(
        'PAGE_NOT_FOUND',
        `Page ${pageNumber} does not exist (chapter has ${totalPages} pages)`,
        requestId
      )
    );
    return null;
  }

  // Verify file path exists
  if (!chapter.filePath) {
    logger.warn('Reader page request: chapter has no filePath in DB', {
      chapterId: chapter.id,
      mangaId: chapter.mangaId,
      pageCount: chapter.pageCount,
      pages: chapter.pages,
    });
    res.status(404).json(createErrorResponse('NO_FILE_PATH', 'Chapter has no file path', requestId));
    return null;
  }

  // Build archive path with traversal guard
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
    logger.warn('Reader page request blocked by path traversal guard', {
      chapterId: chapter.id,
      attemptedPath: chapter.filePath,
      resolvedPath: archivePath,
      allowedRoots,
    });
    res.status(403).json(
      createErrorResponse('PATH_TRAVERSAL', 'File path escapes the manga directory', requestId)
    );
    return null;
  }

  // Verify archive file exists
  try {
    await fs.access(archivePath);
  } catch (err: unknown) {
    // Common failure modes:
    //   - Library on host wasn't bind-mounted into the container
    //   - Files moved/renamed externally and the DB row is stale
    //   - Permission denied: container user (UID 1000) can't read the file
    // Logging the resolved path + raw fs.access error so users can copy
    // it into a `docker exec ls -la` for diagnosis.
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.warn('Reader page request: archive file not accessible', {
      chapterId: chapter.id,
      mangaId: chapter.mangaId,
      filePath: chapter.filePath,
      resolvedPath: archivePath,
      libraryPath: chapter.libraryPath,
      error: errMessage,
    });
    res.status(404).json(
      createErrorResponse('ARCHIVE_NOT_FOUND', 'Chapter archive file not found', requestId)
    );
    return null;
  }

  return {
    chapter: {
      id: chapter.id,
      filePath: chapter.filePath,
      pageCount: chapter.pageCount,
      pages: chapter.pages,
      mangaId: chapter.mangaId
    },
    archivePath,
    totalPages,
    ...(chapter.pageStart !== null ? { pageStart: chapter.pageStart } : {}),
    ...(chapter.pageEnd !== null ? { pageEnd: chapter.pageEnd } : {}),
  };
}
