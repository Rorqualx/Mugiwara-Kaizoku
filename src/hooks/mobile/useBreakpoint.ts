import { useState, useEffect } from 'react';

import type {
  Breakpoint} from '@/utils/mobile/breakpoints';
import {
  getCurrentBreakpoint,
  isBreakpointDown,
  isBreakpointUp,
  isBreakpointBetween } from '@/utils/mobile/breakpoints';

/**
 * Hook to get the current breakpoint and related utilities
 *
 * IMPORTANT: To avoid hydration mismatches, we always start with 'lg' (desktop)
 * on both server and client, then update to the actual breakpoint after mount.
 */
export function useBreakpoint(): {
  current: Breakpoint;
  isDown: (breakpoint: Breakpoint) => boolean;
  isUp: (breakpoint: Breakpoint) => boolean;
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  // Always start with 'lg' to match server render and prevent hydration mismatch
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('lg');

  useEffect(() => {
    const handleResize = (): void => {
      const newBreakpoint = getCurrentBreakpoint();
      setCurrentBreakpoint(newBreakpoint);
    };

    // Debounce resize events
    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return {
    current: currentBreakpoint,
    isDown: (breakpoint: Breakpoint) => isBreakpointDown(breakpoint),
    isUp: (breakpoint: Breakpoint) => isBreakpointUp(breakpoint),
    isBetween: (min: Breakpoint, max: Breakpoint) => isBreakpointBetween(min, max),

    // Convenience properties
    isMobile: currentBreakpoint === 'xs' || currentBreakpoint === 'sm',
    isTablet: currentBreakpoint === 'md',
    isDesktop: currentBreakpoint === 'lg' || currentBreakpoint === 'xl'
  };
}