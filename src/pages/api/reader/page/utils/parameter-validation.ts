/**
 * Parameter Validation for Page Reader API
 *
 * Validates and parses URL parameters for manga page requests.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Validated page parameters
 */
export interface ValidatedPageParams {
  mangaId: number;
  chapterId: number;
  pageNumber: number;
}

/**
 * Error response structure
 */
interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
}

/**
 * Creates a standardized error response
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
 * Validates and parses page request parameters
 *
 * @returns ValidatedPageParams if valid, null if invalid (response already sent)
 */
export function validatePageParams(
  params: string[] | undefined,
  req: NextApiRequest,
  res: NextApiResponse
): ValidatedPageParams | null {
  const requestId = (req as NextApiRequest & { requestId?: string }).requestId ?? '';

  // Check array exists and has 3 elements
  if (params?.length !== 3) {
    res.status(400).json(
      createErrorResponse(
        'INVALID_PARAMETERS',
        'Missing required parameters: mangaId, chapterId, pageNumber',
        requestId
      )
    );
    return null;
  }

  const mangaIdStr = params[0];
  const chapterIdStr = params[1];
  const pageNumberStr = params[2];

  // Check for undefined values (noUncheckedIndexedAccess)
  if (!mangaIdStr || !chapterIdStr || !pageNumberStr) {
    res.status(400).json(
      createErrorResponse('INVALID_PARAMETERS', 'Missing required parameters', requestId)
    );
    return null;
  }

  // Parse integers
  const mangaId = parseInt(mangaIdStr, 10);
  const chapterId = parseInt(chapterIdStr, 10);
  const pageNumber = parseInt(pageNumberStr, 10);

  // Validate parsed values
  if (isNaN(mangaId) || isNaN(chapterId) || isNaN(pageNumber)) {
    res.status(400).json(
      createErrorResponse(
        'INVALID_PARAMETERS',
        'Invalid manga, chapter, or page number',
        requestId
      )
    );
    return null;
  }

  // Page number must be positive
  if (pageNumber < 1) {
    res.status(400).json(
      createErrorResponse('INVALID_PAGE_NUMBER', 'Page number must be 1 or greater', requestId)
    );
    return null;
  }

  return { mangaId, chapterId, pageNumber };
}
