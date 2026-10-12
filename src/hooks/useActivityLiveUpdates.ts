/**
 * Live updates for the activity counts.
 *
 * The activity counts (`activity.query`) are read by the header, the navbar
 * and the mobile navigation. Each used to subscribe to `jobs:active` and
 * refetch on its own, so every job event fetched the counts two or three
 * times. This hook is the one subscriber: mounted once (in AppProviders), it
 * coalesces a burst of job events into a single invalidation, which refetches
 * the query once for all of its readers.
 *
 * @module hooks/useActivityLiveUpdates
 */

import { useEffect } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

/** Job events arrive in bursts (a batch starting or finishing); refetch once per burst. */
const ACTIVITY_INVALIDATE_DEBOUNCE_MS = 500;

/** Refetches the activity counts after job events. Mount exactly once. */
export function useActivityLiveUpdates(): void {
  const { isConnected, subscribe } = useRealTime();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isConnected) return undefined;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe('jobs:active', () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        void utils.activity.query.invalidate();
      }, ACTIVITY_INVALIDATE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [isConnected, subscribe, utils]);
}
