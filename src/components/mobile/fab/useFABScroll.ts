/**
 * FAB Scroll Visibility Hook
 * Manages FAB visibility based on scroll position
 */

import { useEffect, useRef } from 'react';

import { useWindowScroll } from '@mantine/hooks';

export interface UseFABScrollOptions {
  /** Enable scroll-based hiding */
  enabled: boolean;
  /** Scroll threshold for hiding */
  threshold: number;
  /** Callback to set visibility */
  setIsVisible: (visible: boolean) => void;
}

export function useFABScroll({
  enabled,
  threshold,
  setIsVisible
}: UseFABScrollOptions): void {
  const [scroll] = useWindowScroll();
  const lastScrollY = useRef(scroll.y);

  useEffect(() => {
    if (!enabled) return;

    const scrollDelta = scroll.y - lastScrollY.current;

    if (Math.abs(scrollDelta) > threshold) {
      setIsVisible(scrollDelta < 0 || scroll.y < 100);
      lastScrollY.current = scroll.y;
    }
  }, [scroll.y, enabled, threshold, setIsVisible]);
}
