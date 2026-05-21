/**
 * Deluge Torrent Control
 *
 * Torrent control methods for pausing, resuming, and removing torrents.
 * These are the state modification operations for the Deluge client.
 * Extracted from: delugeClient.ts (lines 383-513)
 */

import { withEnhancedErrorHandling } from '@/server/services/download/utils/errorHandling';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
  isLoading,
} from '@/utils/async-result';


import type { TorrentOperationsContext } from './torrent-operations';

/**
 * Pauses a download
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @returns Promise that resolves to true if successful
 */
export async function pauseItem(
  context: TorrentOperationsContext,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  const result = await pauseItemInternal(context, id);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    return createSuccessResult(result.data);
  }

  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: pauseItem for ID ${id}`));
  }

  return createErrorResult(new Error(`Failed to pause download ID ${id}: operation not started`));
}

/**
 * Internal implementation of pauseItem
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @returns Promise that resolves to an AsyncResult with true if successful
 */
async function pauseItemInternal(
  context: TorrentOperationsContext,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    const result = await context.rpcRequest<boolean>('core.pause_torrent', [[id]]);
    if (isError(result)) {
      throw result.error;
    }

    if (!isSuccess(result)) {
      throw context.createContextualError(`Failed to pause torrent in Deluge client: ${id}`);
    }

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return true;
  }, `pauseItem for ${id}`);
}

/**
 * Resumes a download
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @returns Promise that resolves to true if successful
 */
export async function resumeItem(
  context: TorrentOperationsContext,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  const result = await resumeItemInternal(context, id);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    return createSuccessResult(result.data);
  }

  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: resumeItem for ID ${id}`));
  }

  return createErrorResult(new Error(`Failed to resume download ID ${id}: operation not started`));
}

/**
 * Internal implementation of resumeItem
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @returns Promise that resolves to an AsyncResult with true if successful
 */
async function resumeItemInternal(
  context: TorrentOperationsContext,
  id: string
): Promise<AsyncResult<boolean, Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    const result = await context.rpcRequest<boolean>('core.resume_torrent', [[id]]);
    if (isError(result)) {
      throw result.error;
    }

    if (!isSuccess(result)) {
      throw context.createContextualError(`Failed to resume torrent in Deluge client: ${id}`);
    }

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return true;
  }, `resumeItem for ${id}`);
}

/**
 * Removes a download
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @param deleteFiles - Whether to delete downloaded files
 * @returns Promise that resolves to true if successful
 */
export async function removeItem(
  context: TorrentOperationsContext,
  id: string,
  deleteFiles?: boolean
): Promise<AsyncResult<boolean, Error>> {
  const result = await removeItemInternal(context, id, deleteFiles);

  if (isError(result)) {
    return createErrorResult(result.error);
  }

  if (isSuccess(result)) {
    return createSuccessResult(result.data);
  }

  if (isLoading(result)) {
    return createErrorResult(new Error(`Operation still in progress: removeItem for ID ${id}`));
  }

  return createErrorResult(new Error(`Failed to remove download ID ${id}: operation not started`));
}

/**
 * Internal implementation of removeItem
 *
 * @param context - Operation context with client methods
 * @param id - Download ID
 * @param deleteFiles - Whether to delete downloaded files
 * @returns Promise that resolves to an AsyncResult with true if successful
 */
async function removeItemInternal(
  context: TorrentOperationsContext,
  id: string,
  deleteFiles: boolean = false
): Promise<AsyncResult<boolean, Error>> {
  return withEnhancedErrorHandling(async () => {
    const authResult = await context.ensureAuthenticated();
    if (isError(authResult)) {
      throw authResult.error;
    }

    const result = await context.rpcRequest<boolean>('core.remove_torrent', [id, deleteFiles]);
    if (isError(result)) {
      throw result.error;
    }

    if (!isSuccess(result)) {
      throw context.createContextualError(`Failed to remove torrent from Deluge client: ${id}`);
    }

    // Return the raw data, withEnhancedErrorHandling will wrap it
    return true;
  }, `removeItem for ${id}`);
}
