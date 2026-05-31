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

import { useEffect, useState } from 'react';

import { useReducedMotion } from '@mantine/hooks';

import { useLibraryViewStore } from '@/store/index';

/**
 * Returns whether animated covers should currently play.
 *
 * Always returns `false` on the server and the first client render, only
 * enabling motion after mount. Both the preference (Zustand `persist`, hydrated
 * from localStorage) and `prefers-reduced-motion` resolve client-side, so
 * gating on a mounted flag keeps the server HTML and initial client render
 * identical (static) and avoids a React hydration mismatch.
 *
 * @returns `true` once mounted AND the user has animated covers enabled AND the
 *   OS is not requesting reduced motion; otherwise `false`.
 */
export function useAnimatedCovers(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const animatedCovers = useLibraryViewStore((s) => s.animatedCovers);
  const prefersReducedMotion = useReducedMotion();

  return mounted && animatedCovers && !prefersReducedMotion;
}
