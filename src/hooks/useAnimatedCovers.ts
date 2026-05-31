/**
 * useAnimatedCovers
 *
 * Single source of truth for whether "living"/animated manga covers should
 * play. Combines the persisted user preference (`animatedCovers` in the
 * library-view store) with the operating-system `prefers-reduced-motion`
 * setting. Accessibility always wins: when the user has requested reduced
 * motion at the OS level, covers stay static regardless of the app toggle.
 *
 * Consumed by the shared `<MangaCover>` component so the gating logic lives in
 * exactly one place.
 */

import { useReducedMotion } from '@mantine/hooks';

import { useLibraryViewStore } from '@/store/index';

/**
 * Returns whether animated covers should currently play.
 *
 * @returns `true` when the user has animated covers enabled AND the OS is not
 *   requesting reduced motion; otherwise `false`.
 */
export function useAnimatedCovers(): boolean {
  const animatedCovers = useLibraryViewStore((s) => s.animatedCovers);
  // Mantine's hook is SSR-safe (returns `false` until mounted), which keeps the
  // server render static and avoids a hydration mismatch.
  const prefersReducedMotion = useReducedMotion();

  return animatedCovers && !prefersReducedMotion;
}
