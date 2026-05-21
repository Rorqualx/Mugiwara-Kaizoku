/**
 * Mobile hooks index
 * Exports all mobile-related hooks for easy access
 */

export { useBreakpoint } from './useBreakpoint';
export { useMediaQuery, useMediaQueries, mediaQueries } from './useMediaQuery';
export { useMobileState } from './useMobileState';
export { useSwipeGesture } from './useSwipeGesture';
export { useHapticFeedback } from './useHapticFeedback';
export { usePinchZoom } from './usePinchZoom';
export { usePWA } from './usePWA';

export type {
  UseSwipeGestureOptions,
  SwipeGestureHandlers,
  UseSwipeGestureReturn
} from './useSwipeGesture';