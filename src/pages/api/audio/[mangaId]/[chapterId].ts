/**
 * Audio File Streaming API
 *
 * GET /api/audio/[mangaId]/[chapterId] - Stream audio chapter files
 *
 * Features:
 * - Authentication required
 * - HTTP Range request support for seeking
 * - Proper audio MIME type detection
 * - Secure file serving with path validation
 *
 * @module pages/api/audio/[mangaId]/[chapterId]
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
import { parseRangeHeader, setRangeHeaders } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
}

interface ChapterData {
  id: number;
  filePath: string | null;
  mangaId: number;
  Manga: {
    id: number;
    title: string;
    libraryId: number | null;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Audio format to MIME type mapping
 */
const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.alac': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
  '.webm': 'audio/webm',
};

/**
 * Supported audio file extensions
 */
const SUPPORTED_AUDIO_EXTENSIONS = Object.keys(AUDIO_MIME_TYPES);

// ============================================================================
// Validation
// ============================================================================

const paramsSchema = z.object({
  mangaId: z.string().regex(/^\d+$/),
  chapterId: z.string().regex(/^\d+$/),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get audio MIME type for a file
 */
function getAudioMimeType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_MIME_TYPES[ext] ?? null;
}

/**
 * Check if file is a supported audio format
 */
function isSupportedAudioFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
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
      requestId,
    },
  };
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
        },
      },
    },
  });

  if (!chapter) {
    res.status(404).json(
      createErrorResponse('NOT_FOUND', 'Chapter not found', requestId)
    );
    return null;
  }

  if (chapter.mangaId !== mangaId) {
    res.status(400).json(
      createErrorResponse(
        'INVALID_RELATIONSHIP',
        'Chapter does not belong to this manga',
        requestId
      )
    );
    return null;
  }

  return chapter;
}

/**
 * Validate file path for security and existence
 * Prevents path traversal attacks (OWASP A03:2021)
 */
async function validateFilePath(
  filePath: string | null,
  userId: string,
  chapterId: number,
  res: NextApiResponse,
  requestId: string
): Promise<string | null> {
  if (!filePath) {
    res.status(404).json(
      createErrorResponse('FILE_NOT_FOUND', 'Audio file path not set', requestId)
    );
    return null;
  }

  // Verify it's a supported audio format
  if (!isSupportedAudioFormat(filePath)) {
    res.status(400).json(
      createErrorResponse(
        'UNSUPPORTED_FORMAT',
        'File is not a supported audio format',
        requestId
      )
    );
    return null;
  }

  // SECURITY: Path traversal protection (OWASP A03:2021)
  const baseDir = process.env['MANGA_FILES_DIR'] ?? '/data/manga';
  const resolvedBaseDir = path.resolve(baseDir);

  // Construct full file path
  let fullPath: string;
  if (path.isAbsolute(filePath)) {
    fullPath = filePath;
  } else {
    fullPath = path.join(resolvedBaseDir, filePath);
  }

  // Resolve and normalize the full path
  const resolvedPath = path.resolve(fullPath);
  const normalizedPath = path.normalize(resolvedPath);

  // Security validation - ensure path stays within base directory
  if (!path.isAbsolute(filePath) && !normalizedPath.startsWith(resolvedBaseDir)) {
    logger.warn('Path traversal attack detected in audio API', {
      userId,
      chapterId,
      attemptedPath: filePath,
      resolvedPath: normalizedPath,
      baseDir: resolvedBaseDir,
    });

    res.status(403).json(
      createErrorResponse(
        'SECURITY_VIOLATION',
        'Invalid file path - path traversal detected',
        requestId
      )
    );
    return null;
  }

  // Verify file exists and is actually a file
  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isFile()) {
      logger.warn('Attempted to serve directory as audio file', {
        userId,
        chapterId,
        path: normalizedPath,
      });

      res.status(403).json(
        createErrorResponse(
          'SECURITY_VIOLATION',
          'Invalid file path - not a file',
          requestId
        )
      );
      return null;
    }
  } catch (error) {
    logger.error('Audio file access error', {
      userId,
      chapterId,
      path: normalizedPath,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(404).json(
      createErrorResponse('FILE_NOT_FOUND', 'Audio file not found', requestId)
    );
    return null;
  }

  return normalizedPath;
}

/**
 * Serve audio file with range support for seeking
 */
async function serveAudioFile(
  normalizedPath: string,
  filePath: string,
  req: NextApiRequest,
  res: NextApiResponse,
  requestId: string
): Promise<void> {
  try {
    const stats = await fs.stat(normalizedPath);
    const fileSize = stats.size;
    const mimeType = getAudioMimeType(filePath) ?? 'application/octet-stream';
    const fileName = path.basename(filePath);

    // Parse range header if present (for seeking)
    const rangeHeader = req.headers.range;
    const range = parseRangeHeader(rangeHeader, fileSize);

    if (range) {
      // Serve partial content (206)
      setRangeHeaders(res, range, mimeType);

      const stream = createReadStream(normalizedPath, {
        start: range.start,
        end: range.end,
      });

      stream.pipe(res);

      stream.on('error', (error) => {
        logger.error('Audio stream error:', error);
        if (!res.headersSent) {
          res.status(500).json(
            createErrorResponse('STREAM_ERROR', 'Error streaming audio', requestId)
          );
        }
      });
    } else {
      // Serve full file (200)
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      // Always stream audio files (they're typically large)
      const stream = createReadStream(normalizedPath);
      stream.pipe(res);

      stream.on('error', (error) => {
        logger.error('Audio stream error:', error);
        if (!res.headersSent) {
          res.status(500).json(
            createErrorResponse('STREAM_ERROR', 'Error streaming audio', requestId)
          );
        }
      });
    }
  } catch (error: unknown) {
    logger.error('Error accessing audio file:', error);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json(
        createErrorResponse('FILE_NOT_FOUND', 'Audio file does not exist', requestId)
      );
      return;
    }
    res.status(500).json(
      createErrorResponse('SERVER_ERROR', 'Internal server error', requestId)
    );
  }
}

// ============================================================================
// API Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const requestId = generateRequestId();

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json(
      createErrorResponse('METHOD_NOT_ALLOWED', 'Only GET method is allowed', requestId)
    );
    return;
  }

  try {
    // Validate query parameters
    const parseResult = paramsSchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json(
        createErrorResponse(
          'INVALID_PARAMETERS',
          'Invalid manga or chapter ID',
          requestId
        )
      );
      return;
    }

    const { mangaId, chapterId } = parseResult.data;
    const mangaIdNum = parseInt(mangaId, 10);
    const chapterIdNum = parseInt(chapterId, 10);

    // Verify authentication
    const session = (await getServerSession(req, res, authOptions)) as Session | null;

    if (!session?.user.id) {
      res.status(401).json(
        createErrorResponse('UNAUTHORIZED', 'Authentication required', requestId)
      );
      return;
    }

    const userId = String(session.user.id);

    // Verify chapter access
    const chapter = await verifyChapterAccess(chapterIdNum, mangaIdNum, res, requestId);
    if (!chapter) return;

    // Validate file path
    const normalizedPath = await validateFilePath(
      chapter.filePath,
      userId,
      chapterIdNum,
      res,
      requestId
    );
    if (!normalizedPath || !chapter.filePath) return;

    // Serve the audio file
    await serveAudioFile(normalizedPath, chapter.filePath, req, res, requestId);
  } catch (error) {
    logger.error('Audio API error:', error);
    res.status(500).json(
      createErrorResponse('SERVER_ERROR', 'Internal server error', requestId)
    );
  }
}

export const config = {
  api: {
    responseLimit: false, // No limit for streaming
  },
};
