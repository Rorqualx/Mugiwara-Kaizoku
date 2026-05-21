/**
 * Manga File Reader API
 *
 * GET /api/reader/file/[mangaId]/[chapterId] - Serve manga chapter files
 *
 * Features:
 * - Authentication required
 * - Range request support for large files
 * - Proper content type detection
 * - Secure file serving with validation
 */
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { type NextApiRequest, type NextApiResponse } from 'next';
import { type Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/server/db';
import { createFileRoute, parseRangeHeader, setRangeHeaders } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// Types
interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
}

interface ParsedIds {
  mangaId: number;
  chapterId: number;
}

interface ChapterData {
  id: number;
  filePath: string | null;
  mangaId: number;
  Manga: {
    id: number;
    title: string;
    libraryId: number | null;
    Library: {
      path: string;
    } | null;
  };
}

// Validation schema
const paramsSchema = z.object({
  params: z.array(z.string()).length(2)
});

// Content type mapping
const contentTypeMap: Record<string, string> = {
  '.cbz': 'application/zip',
  '.zip': 'application/zip',
  '.cbr': 'application/x-rar-compressed',
  '.rar': 'application/x-rar-compressed',
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.7z': 'application/x-7z-compressed'
};

/**
 * Get content type for a file based on extension
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return contentTypeMap[ext] ?? 'application/octet-stream';
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  requestId: string
): ErrorResponse {
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
 * Parse and validate manga and chapter IDs from request params
 */
function parseAndValidateIds(
  params: string[],
  res: NextApiResponse,
  requestId: string
): ParsedIds | null {
  const [mangaIdStr, chapterIdStr] = params;

  // noUncheckedIndexedAccess: Check array access for undefined
  if (!mangaIdStr || !chapterIdStr) {
    res.status(400).json(
      createErrorResponse('INVALID_PARAMETERS', 'Missing manga or chapter ID', requestId)
    );
    return null;
  }

  const mangaId = parseInt(mangaIdStr, 10);
  const chapterId = parseInt(chapterIdStr, 10);

  if (isNaN(mangaId) || isNaN(chapterId)) {
    res.status(400).json(
      createErrorResponse('INVALID_PARAMETERS', 'Invalid manga or chapter ID', requestId)
    );
    return null;
  }

  return { mangaId, chapterId };
}

/**
 * Verify chapter exists and belongs to the specified manga
 */
async function verifyChapterAccess(
  chapterId: number,
  mangaId: number,
  res: NextApiResponse,
  requestId: string
): Promise<ChapterData | null> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      Manga: {
        select: {
          id: true,
          title: true,
          libraryId: true,
          Library: { select: { path: true } }
        }
      }
    }
  });

  if (!chapter) {
    res.status(404).json(
      createErrorResponse('NOT_FOUND', 'Chapter not found', requestId)
    );
    return null;
  }

  // Verify the chapter belongs to the requested manga
  if (chapter.mangaId !== mangaId) {
    res.status(400).json(
      createErrorResponse('INVALID_RELATIONSHIP', 'Chapter does not belong to this manga', requestId)
    );
    return null;
  }

  return chapter;
}

interface ValidateFilePathArgs {
  filePath: string | null;
  libraryPath: string | null;
  userId: string;
  chapterId: number;
  res: NextApiResponse;
  requestId: string;
}

/**
 * Validate file path for security and existence
 * Prevents path traversal attacks (OWASP A03:2021)
 */
async function validateFilePath(
  args: ValidateFilePathArgs
): Promise<string | null> {
  const { filePath, libraryPath, userId, chapterId, res, requestId } = args;
  if (!filePath) {
    res.status(404).json(
      createErrorResponse('FILE_NOT_FOUND', 'Chapter file path not set', requestId)
    );
    return null;
  }

  // SECURITY: Path traversal protection (OWASP A03:2021)
  // Trusted roots: the manga's configured Library.path and MANGA_FILES_DIR (env fallback).
  const envBaseDir = process.env['MANGA_FILES_DIR'] ?? '/data/manga';
  const allowedRoots = [libraryPath, envBaseDir]
    .filter((root): root is string => Boolean(root))
    .map((root) => path.resolve(root));

  const joinBase = libraryPath ?? envBaseDir;

  // Construct full file path
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(joinBase, filePath);

  // Resolve and normalize the full path
  const resolvedPath = path.resolve(fullPath);
  const normalizedPath = path.normalize(resolvedPath);

  // Security validation - ensure path stays within an allowed root
  if (!allowedRoots.some((root) => normalizedPath.startsWith(root))) {
    logger.warn('Path traversal attack detected', {
      userId,
      chapterId,
      attemptedPath: filePath,
      resolvedPath: normalizedPath,
      allowedRoots,
    });

    res.status(403).json(
      createErrorResponse('SECURITY_VIOLATION', 'Invalid file path - path traversal detected', requestId)
    );
    return null;
  }

  // Verify file exists and is actually a file (not a directory)
  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isFile()) {
      logger.warn('Attempted to serve directory as file', {
        userId,
        chapterId,
        path: normalizedPath,
      });

      res.status(403).json(
        createErrorResponse('SECURITY_VIOLATION', 'Invalid file path - not a file', requestId)
      );
      return null;
    }
  } catch (error) {
    logger.error('File access error', {
      userId,
      chapterId,
      path: normalizedPath,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(404).json(
      createErrorResponse('FILE_NOT_FOUND', 'Chapter file not found', requestId)
    );
    return null;
  }

  return normalizedPath;
}

/**
 * Serve file with range support for streaming
 */
async function serveFile(
  normalizedPath: string,
  filePath: string,
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
): Promise<void> {
  try {
    const stats = await fs.stat(normalizedPath);
    const fileSize = stats.size;
    const contentType = getContentType(filePath);

    // Parse range header if present
    const rangeHeader = req.headers.range;
    const range = parseRangeHeader(rangeHeader, fileSize);

    if (range) {
      // Serve partial content
      setRangeHeaders(res, range, contentType);

      const stream = createReadStream(normalizedPath, {
        start: range.start,
        end: range.end
      });

      stream.pipe(res);

      stream.on('error', (error) => {
        logger.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json(
            createErrorResponse('STREAM_ERROR', 'Error streaming file', requestId)
          );
        }
      });
    } else {
      // Serve full file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

      // For smaller files, read and send
      if (fileSize < 10 * 1024 * 1024) {
        const fileBuffer = await fs.readFile(normalizedPath);
        res.send(fileBuffer);
      } else {
        // For larger files, stream
        const stream = createReadStream(normalizedPath);
        stream.pipe(res);

        stream.on('error', (error) => {
          logger.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json(
              createErrorResponse('STREAM_ERROR', 'Error streaming file', requestId)
            );
          }
        });
      }
    }
  } catch (error: unknown) {
    logger.error('Error accessing file:', error);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json(
        createErrorResponse('FILE_NOT_FOUND', 'File does not exist', requestId)
      );
      return;
    }
    throw error; // Let factory error handler handle it
  }
}

export default createFileRoute({
  requireAuth: true,
  cache: {
    maxAge: 3600,
    private: true
  },
  validation: {
    query: paramsSchema
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      const { params } = req.query as z.infer<typeof paramsSchema>;
      const requestId = req.requestId ?? '';

      // Parse and validate IDs
      const ids = parseAndValidateIds(params, res, requestId);
      if (!ids) return;

      // Verify user authentication
      const session = await getServerSession(req, res, authOptions) as Session | null;

      if (!session?.user.id) {
        res.status(401).json(
          createErrorResponse('UNAUTHORIZED', 'Authentication required', requestId)
        );
        return;
      }

      // Type-safe user ID access (guaranteed non-null by check above)
       
      const userId = String(session.user.id);

      // Verify chapter access
      const chapter = await verifyChapterAccess(ids.chapterId, ids.mangaId, res, requestId);
      if (!chapter) return;

      // SECURITY: Authentication required at route level (OWASP A01:2021)
      // Note: Libraries are public/shared resources (no userId field in schema)

      // Validate file path
      const normalizedPath = await validateFilePath({
        filePath: chapter.filePath,
        libraryPath: chapter.Manga.Library?.path ?? null,
        userId,
        chapterId: ids.chapterId,
        res,
        requestId,
      });
      if (!normalizedPath || !chapter.filePath) return;

      // Serve the file
      await serveFile(normalizedPath, chapter.filePath, req, res, requestId);
    }
  }
});

export const config = {
  api: {
    responseLimit: '100mb'
  }
};
