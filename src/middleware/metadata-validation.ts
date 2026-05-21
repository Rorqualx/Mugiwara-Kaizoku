/**
 * Metadata Validation Middleware
 *
 * This module provides middleware functions for validating metadata objects
 * before they are stored or used in the application. It ensures that metadata
 * objects conform to our expected structure and contain required fields.
 *
 * This is the main entry point that exports the middleware functions and
 * re-exports types and functions from the modular structure.
 */


import {
  fixMetadataIssues,
  fixChapterIssues
} from './metadata-normalization';
import {
  validateMetadata,
  validateChapter,
  ValidationErrorType
} from './metadata-validators';

import type {
  NormalizedMetadata,
  NormalizedChapter
} from './metadata-schemas';
import type {
  ValidationError,
  ValidationResult
} from './metadata-validators';
import type { NextApiRequest, NextApiResponse } from 'next';

// Using inline interface instead of importing from next-connect
interface NextHandler {
  (): void;
  (err: Error): void;
}

/**
 * Middleware for validating metadata in API requests
 *
 * @param req API request
 * @param res API response
 * @param next Next handler
 */
export function validateMetadataMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: NextHandler
): void {
  const metadata: unknown = req.body;

  const result = validateMetadata(metadata);

  if (!result.valid) {
    res.status(400).json({
      success: false,
      errors: result.errors
    });
    return;
  }

  next();
}

/**
 * Middleware for validating chapter data in API requests
 *
 * @param req API request
 * @param res API response
 * @param next Next handler
 */
export function validateChapterMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: NextHandler
): void {
  const chapter: unknown = req.body;

  const result = validateChapter(chapter);

  if (!result.valid) {
    res.status(400).json({
      success: false,
      errors: result.errors
    });
    return;
  }

  next();
}

// Re-export all types and functions for backward compatibility
export {
  // From schemas
  type NormalizedMetadata,
  type NormalizedChapter,

  // From validators
  ValidationErrorType,
  type ValidationError,
  type ValidationResult,
  validateMetadata,
  validateChapter,

  // From normalization
  fixMetadataIssues,
  fixChapterIssues
};