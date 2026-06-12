/**
 * AsyncResult → tRPC boundary unwrappers (audit task #1).
 *
 * Services keep returning AsyncResult internally, but tRPC procedures must
 * NOT send the Result object over the wire — that bypasses tRPC's typed
 * error channel and forces every client call site to branch on
 * `result.status` instead of using the framework's error handling.
 *
 * Routers unwrap at the boundary:
 *
 *   .mutation(async ({ input }): Promise<Thing> =>
 *     unwrapResultAsync(service.doThing(input)))
 *
 * Success returns the bare data; error states throw a TRPCError (via
 * toTRPCError, which maps domain error names to proper codes).
 */
import { isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import { toTRPCError, TRPCErrors } from './errors';


/**
 * Unwrap an AsyncResult or throw the equivalent TRPCError.
 *
 * `idle`/`loading` are client-side states that should never cross the
 * server boundary — treated as internal errors so a misuse is loud.
 */
export function unwrapResultOrThrow<T>(
  result: AsyncResult<T, Error>,
  fallbackMessage = 'Operation failed',
): T {
  if (isSuccess(result)) {
    return result.data;
  }
  if (isError(result)) {
    throw toTRPCError(result.error);
  }
  throw TRPCErrors.internal(
    `${fallbackMessage}: unexpected AsyncResult state '${result.status}' at the tRPC boundary`,
  );
}

/**
 * Await + unwrap in one step — the common shape inside procedures:
 * `return unwrapResultAsync(service.method(input));`
 */
export async function unwrapResultAsync<T>(
  resultPromise: Promise<AsyncResult<T, Error>>,
  fallbackMessage = 'Operation failed',
): Promise<T> {
  return unwrapResultOrThrow(await resultPromise, fallbackMessage);
}
