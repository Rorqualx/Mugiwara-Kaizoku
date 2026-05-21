/**
 * Breakpoint utilities matching Mantine v7 breakpoints
 */

/**
 * Mantine v7 default breakpoints
 */
export const BREAKPOINTS = {
  xs: 576,
  sm: 768,
  md: 992,
  lg: 1200,
  xl: 1408
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Gets the current breakpoint based on window width
 */
export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') {
    return 'lg'; // Default for SSR
  }

  const width = window.innerWidth;

  if (width < BREAKPOINTS.xs) {
    return 'xs';
  } else if (width < BREAKPOINTS.sm) {
    return 'sm';
  } else if (width < BREAKPOINTS.md) {
    return 'md';
  } else if (width < BREAKPOINTS.lg) {
    return 'lg';
  } else {
    return 'xl';
  }
}

/**
 * Checks if the current viewport is at or below a breakpoint
 */
export function isBreakpointDown(breakpoint: Breakpoint): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const width = window.innerWidth;
  return width < BREAKPOINTS[breakpoint];
}

/**
 * Checks if the current viewport is at or above a breakpoint
 */
export function isBreakpointUp(breakpoint: Breakpoint): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const width = window.innerWidth;
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * Checks if the current viewport is between two breakpoints
 */
export function isBreakpointBetween(min: Breakpoint, max: Breakpoint): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const width = window.innerWidth;
  return width >= BREAKPOINTS[min] && width < BREAKPOINTS[max];
}

/**
 * Gets a responsive value based on the current breakpoint
 */
export function getResponsiveValue<T>(
  values: Partial<Record<Breakpoint, T>>,
  defaultValue: T
): T {
  const currentBreakpoint = getCurrentBreakpoint();
  const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  
  // Find the current breakpoint index
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
  
  // Look for value at current breakpoint or below
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (bp !== undefined && bp in values) {
      const value = values[bp];
      if (value !== undefined) {
        return value;
      }
    }
  }
  
  return defaultValue;
}