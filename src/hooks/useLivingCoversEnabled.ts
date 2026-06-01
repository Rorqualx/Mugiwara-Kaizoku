/**
 * useLivingCoversEnabled
 *
 * Reads the global Living Covers master switch (`covers.living.enabled`) via the
 * cached `coverLayers.status` query. React-query dedupes the request across every
 * cover on screen, so a grid of cards issues a single shared call. Returns
 * `false` until loaded / when the feature is off, so covers default to static.
 */

import { trpc } from '@/utils/trpc-client/index';

/** @returns Whether living covers are globally enabled. */
export function useLivingCoversEnabled(): boolean {
  const { data } = trpc.coverLayers.status.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return data?.enabled ?? false;
}

/**
 * @returns The global cover-motion speed multiplier (default 1). Applied at
 * render time as the drift animations' playbackRate, so changes take effect
 * without re-processing. Shares the same cached `status` query as the gate.
 */
export function useCoverMotionSpeed(): number {
  const { data } = trpc.coverLayers.status.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return data?.motionSpeed ?? 1;
}
