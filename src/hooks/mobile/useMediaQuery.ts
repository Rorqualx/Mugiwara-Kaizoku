import { useState, useEffect } from 'react';

/**
 * Hook to match a media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Update state
    const updateMatches = (): void => {
      setMatches(mediaQuery.matches);
    };

    // Initial check
    updateMatches();

    // Add listener for changes
    mediaQuery.addEventListener('change', updateMatches);
    return () => mediaQuery.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}

/**
 * Common media query presets
 */
export const mediaQueries = {
  // Orientation
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',

  // Device capabilities
  touch: '(hover: none) and (pointer: coarse)',
  mouse: '(hover: hover) and (pointer: fine)',

  // Reduced motion
  reducedMotion: '(prefers-reduced-motion: reduce)',

  // Color scheme
  darkMode: '(prefers-color-scheme: dark)',
  lightMode: '(prefers-color-scheme: light)',

  // High contrast
  highContrast: '(prefers-contrast: high)',

  // Print
  print: 'print',

  // Retina displays
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',

  // Custom breakpoints (matching Mantine v7)
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 991px)',
  desktop: '(min-width: 992px)',

  // Specific breakpoints
  xs: '(max-width: 575px)',
  sm: '(min-width: 576px) and (max-width: 767px)',
  md: '(min-width: 768px) and (max-width: 991px)',
  lg: '(min-width: 992px) and (max-width: 1199px)',
  xl: '(min-width: 1200px)'
} as const;

/**
 * Hook with common media query presets
 */
export function useMediaQueries(): {
  isPortrait: boolean;
  isLandscape: boolean;
  isTouchDevice: boolean;
  hasMouseDevice: boolean;
  prefersReducedMotion: boolean;
  prefersDarkMode: boolean;
  prefersLightMode: boolean;
  prefersHighContrast: boolean;
  isPrint: boolean;
  isRetina: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const isPortrait = useMediaQuery(mediaQueries.portrait);
  const isLandscape = useMediaQuery(mediaQueries.landscape);
  const isTouchDevice = useMediaQuery(mediaQueries.touch);
  const hasMouseDevice = useMediaQuery(mediaQueries.mouse);
  const prefersReducedMotion = useMediaQuery(mediaQueries.reducedMotion);
  const prefersDarkMode = useMediaQuery(mediaQueries.darkMode);
  const prefersLightMode = useMediaQuery(mediaQueries.lightMode);
  const prefersHighContrast = useMediaQuery(mediaQueries.highContrast);
  const isPrint = useMediaQuery(mediaQueries.print);
  const isRetina = useMediaQuery(mediaQueries.retina);
  const isMobile = useMediaQuery(mediaQueries.mobile);
  const isTablet = useMediaQuery(mediaQueries.tablet);
  const isDesktop = useMediaQuery(mediaQueries.desktop);

  return {
    isPortrait,
    isLandscape,
    isTouchDevice,
    hasMouseDevice,
    prefersReducedMotion,
    prefersDarkMode,
    prefersLightMode,
    prefersHighContrast,
    isPrint,
    isRetina,
    isMobile,
    isTablet,
    isDesktop
  };
}