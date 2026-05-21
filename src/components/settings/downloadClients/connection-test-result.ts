/**
 * Shared display extractor for download-client connection-test mutations.
 *
 * `trpc.downloadClients.test*` returns `AsyncResult<{ message }, Error>` on
 * both branches, so this helper folds the four parallel UI-side branches
 * (TransmissionSettings, DelugeSettings, NZBGetSettings, SABnzbdSettings)
 * into a single 4-line call.
 */

import type { AsyncResult } from '@/utils/async-result';
import { isError, isSuccess } from '@/utils/async-result';

export interface TestConnectionDisplay {
  success: boolean;
  message: string;
}

interface TestSuccessShape {
  message?: string;
}

export function getTestConnectionDisplay(
  result: AsyncResult<TestSuccessShape, Error>,
): TestConnectionDisplay {
  if (isSuccess(result)) {
    return {
      success: true,
      message: result.data.message ?? 'Connection successful!',
    };
  }
  if (isError(result)) {
    return {
      success: false,
      message: result.error.message !== '' ? result.error.message : 'Connection failed',
    };
  }
  return { success: false, message: 'Connection failed' };
}
