/**
 * Manga Page Reader API
 *
 * GET /api/reader/page/[mangaId]/[chapterId]/[pageNumber] - Serve individual manga pages
 *
 * Features:
 * - Authentication required
 * - Ownership validation through library chain
 * - Page extraction from chapter archives
 * - Image format support (JPG, PNG, WebP)
 * - Caching for extracted pages
 * - OWASP A01:2021 - Access control enforcement
 */

import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createBinaryRoute } from '@/utils/api-route-factory';

import {
  extractPageFromArchive,
  fetchAndValidateChapter,
  findPreExtractedPage,
  isExtractionError,
  serveExtractedPage,
  servePreExtractedPage,
  validatePageParams
} from './utils';

// Validation schema
const paramsSchema = z.object({
  params: z.array(z.string()).length(3)
});

export default createBinaryRoute({
  requireAuth: true,
  cache: {
    maxAge: 86400, // Cache for 24 hours
    private: true, // Private cache per user
    staleWhileRevalidate: 604800 // Serve stale for 7 days while revalidating
  },
  validation: {
    query: paramsSchema
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      const { params } = req.query as z.infer<typeof paramsSchema>;
      const requestId = (req as typeof req & { requestId?: string }).requestId ?? '';

      // Step 1: Validate parameters
      const validatedParams = validatePageParams(params, req, res);
      if (!validatedParams) return;

      const { mangaId, chapterId, pageNumber } = validatedParams;

      // Step 2: Verify authentication (OWASP A01:2021)
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        return res['status'](401).json({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId
          }
        });
      }

      // Step 3: Fetch and validate chapter
      const chapterData = await fetchAndValidateChapter(validatedParams, req, res);
      if (!chapterData) return;

      const { archivePath, totalPages, pageStart, pageEnd } = chapterData;

      // Step 4: Check for pre-extracted (cached) page
      const cachedPage = await findPreExtractedPage(mangaId, chapterId, pageNumber);
      if (cachedPage) {
        return servePreExtractedPage(res, cachedPage, pageNumber, totalPages);
      }

      // Step 5: Extract page from archive on-demand (with page range offset for volume files)
      const extractionResult = await extractPageFromArchive(
        archivePath,
        pageNumber,
        mangaId,
        chapterId,
        pageStart,
        pageEnd
      );

      if (isExtractionError(extractionResult)) {
        const statusCode = extractionResult.code === 'EXTRACTION_FAILED' ? 500 : 404;
        return res['status'](statusCode).json({
          status: 'error',
          error: {
            code: extractionResult.code,
            message: extractionResult.message,
            timestamp: new Date().toISOString(),
            requestId
          }
        });
      }

      // Step 6: Serve extracted page
      return serveExtractedPage(res, extractionResult, pageNumber);
    }
  }
});

export const config = {
  api: {
    responseLimit: '50mb' // Support high-res manga pages
  }
};
