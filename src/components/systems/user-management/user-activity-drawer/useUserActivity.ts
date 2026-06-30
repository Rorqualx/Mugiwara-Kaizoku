/**
 * Data hook for the user activity drawer.
 *
 * Fetches the aggregate summary and the paginated event timeline for a single
 * user via the admin-only `users.activity.*` procedures. Queries are disabled
 * until a userId is provided so opening/closing the drawer drives fetching.
 */

import type { PaginatedEvents } from '@/server/services/events/eventService';
import type { UserActivitySummary } from '@/server/trpc/routers/users/activity';
import { trpc } from '@/utils/trpc-client/index';

/** Number of timeline events per page. */
export const ACTIVITY_PAGE_SIZE = 25;

interface UseUserActivityParams {
  userId: string | null;
  page: number;
  types?: string[];
}

export interface UseUserActivityResult {
  summary: UserActivitySummary | undefined;
  summaryLoading: boolean;
  log: PaginatedEvents | undefined;
  logLoading: boolean;
  errorMessage: string | null;
}

/**
 * @returns The user's activity summary + paginated event log with loading state.
 */
export function useUserActivity({
  userId,
  page,
  types,
}: UseUserActivityParams): UseUserActivityResult {
  const enabled = Boolean(userId);

  const summaryQuery = trpc.users.activity.getActivitySummary.useQuery(
    { userId: userId ?? '' },
    { enabled },
  );

  const logQuery = trpc.users.activity.getActivityLog.useQuery(
    {
      userId: userId ?? '',
      page,
      pageSize: ACTIVITY_PAGE_SIZE,
      ...(types && types.length > 0 ? { types } : {}),
    },
    { enabled },
  );

  return {
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
    log: logQuery.data,
    logLoading: logQuery.isLoading,
    errorMessage: summaryQuery.error?.message ?? logQuery.error?.message ?? null,
  };
}
