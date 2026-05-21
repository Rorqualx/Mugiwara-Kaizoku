/**
 * API Handlers for Auth Operations - TEMPORARY STUB FOR BUILD
 *
 * This is a temporary stub implementation to allow the build process to complete.
 * The real implementation will be restored after resolving the build issues.
 */

import { logApiInfo } from '@/utils/admin-debug';
import type { AsyncResult} from '@/utils/async-result';
import { createErrorResult, createContextualError } from '@/utils/async-result';

export interface ActionResponse<T> {
  fieldError?: Partial<Record<keyof T, string | undefined>>;
  formError?: string;
  success?: boolean;
}

/**
 * API handler for creating a user - STUB IMPLEMENTATION
 */
export function apiCreateUser(): Promise<AsyncResult<unknown, Error>> {
  logApiInfo('STUB: apiCreateUser called');
  return Promise.resolve(
    createErrorResult(
      createContextualError(
        "This is a temporary build-only implementation",
        'STUB_IMPLEMENTATION'
      )
    )
  );
}

/**
 * API handler for deleting a user - STUB IMPLEMENTATION
 */
export function apiDeleteUser(userId: string): Promise<AsyncResult<null, Error>> {
  return Promise.resolve(
    createErrorResult(
      createContextualError(
        "This is a temporary build-only implementation",
        'STUB_IMPLEMENTATION',
        { userId }
      )
    )
  );
}

/**
 * API handler for updating a user's role - STUB IMPLEMENTATION
 */
export function apiUpdateUserRole(
  userId: string,
  role: 'ADMIN' | 'USER'
): Promise<AsyncResult<null, Error>> {
  return Promise.resolve(
    createErrorResult(
      createContextualError(
        "This is a temporary build-only implementation",
        'STUB_IMPLEMENTATION',
        { userId, role }
      )
    )
  );
}

/**
 * API handler for signing out a user - STUB IMPLEMENTATION
 */
export function apiSignOut(): Promise<AsyncResult<null, Error>> {
  return Promise.resolve(
    createErrorResult(
      createContextualError(
        "This is a temporary build-only implementation",
        'STUB_IMPLEMENTATION'
      )
    )
  );
}