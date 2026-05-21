/**
 * Cover Validation Tool
 *
 * Heuristic validation of manga cover image URLs.
 * Checks HTTP availability, content type, dimensions, and file size.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('CoverValidationTool');

/** Min/max file size for valid cover images */
const MIN_SIZE_BYTES = 10 * 1024;       // 10KB
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** Known CDN domains for manga cover images */
const KNOWN_CDNS = [
  'static.wikia.nocookie.net',
  'upload.wikimedia.org',
  'comicvine.gamespot.com',
  'uploads.mangadex.org',
  'mangadex.org',
];

/** Result for a single cover URL validation */
interface CoverValidationResult {
  url: string;
  isValid: boolean;
  reason: string;
  contentType?: string | undefined;
  sizeBytes?: number | undefined;
}

interface CoverValidateParams {
  urls: string[];
  context?: string | undefined;
}

function validateParams(params: unknown): AsyncResult<CoverValidateParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { urls, context } = params as Partial<CoverValidateParams>;
  if (!Array.isArray(urls) || urls.length === 0) {
    return createErrorResult(new Error('urls parameter must be a non-empty array'));
  }

  const validUrls = urls.filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
  if (validUrls.length === 0) {
    return createErrorResult(new Error('No valid URLs provided'));
  }

  return createSuccessResult({
    urls: validUrls.slice(0, 10), // Max 10 URLs per call
    context: typeof context === 'string' ? context : undefined,
  });
}

/** Validate a single cover URL via HTTP HEAD request */
async function validateSingleCover(url: string): Promise<CoverValidationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { url, isValid: false, reason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return { url, isValid: false, reason: `Not an image: ${contentType}`, contentType };
    }

    const contentLength = response.headers.get('content-length');
    const sizeBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (sizeBytes > 0 && sizeBytes < MIN_SIZE_BYTES) {
      return { url, isValid: false, reason: `Too small: ${sizeBytes} bytes`, contentType, sizeBytes };
    }

    if (sizeBytes > MAX_SIZE_BYTES) {
      return { url, isValid: false, reason: `Too large: ${sizeBytes} bytes`, contentType, sizeBytes };
    }

    // Check if URL is from a known CDN (bonus confidence)
    const hostname = new URL(url).hostname;
    const isKnownCdn = KNOWN_CDNS.some(cdn => hostname.includes(cdn));

    return {
      url,
      isValid: true,
      reason: isKnownCdn ? 'Valid image from known CDN' : 'Valid image',
      contentType,
      sizeBytes: sizeBytes > 0 ? sizeBytes : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { url, isValid: false, reason: `Fetch error: ${msg}` };
  }
}

async function executeCoverValidation(
  params: CoverValidateParams,
): Promise<AsyncResult<unknown, Error>> {
  log.info('Validating cover URLs', { count: params.urls.length, context: params.context });

  const results = await Promise.all(params.urls.map(validateSingleCover));
  const validCount = results.filter(r => r.isValid).length;

  log.info('Cover validation complete', {
    total: results.length,
    valid: validCount,
    invalid: results.length - validCount,
  });

  return createSuccessResult({
    results,
    summary: `${validCount}/${results.length} covers valid`,
  });
}

export const coverValidationTool: AgentTool = {
  name: 'cover_validate',
  description: 'Validate manga cover image URLs via HTTP HEAD checks. Returns validity, content type, and size for each URL.',
  parameters: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of cover image URLs to validate (max 10)',
      },
      context: {
        type: 'string',
        description: 'Context for validation (e.g., "volume 1 cover")',
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    const validationResult = validateParams(params);
    if (validationResult.status === 'error') return validationResult;
    if (validationResult.status !== 'success') {
      return createErrorResult(new Error('Unexpected validation state'));
    }
    return executeCoverValidation(validationResult.data);
  },
};
