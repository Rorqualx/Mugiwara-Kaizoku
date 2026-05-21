/**
 * Mobile utilities index
 * Exports all mobile-related utilities for easy access
 */

// Device detection
export {
  detectDevice,
  getDeviceInfo,
  invalidateDeviceCache,
  isMobileDevice,
  isTabletDevice,
  isDesktopDevice,
  getViewportSize,
  type DeviceInfo
} from './device-detection';

// Breakpoint utilities
export {
  BREAKPOINTS,
  getCurrentBreakpoint,
  isBreakpointDown,
  isBreakpointUp,
  isBreakpointBetween,
  getResponsiveValue,
  type Breakpoint
} from './breakpoints';

// Touch utilities
export {
  getTouchDistance,
  getSwipeDirection,
  getTouchPosition,
  preventTouchDefault,
  isTap,
  normalizeTouch,
  getPassiveTouchOptions,
  type TouchPosition,
  type SwipeDirection
} from './touch-utils';

// Performance monitoring
export {
  collectPerformanceMetrics,
  evaluatePerformance,
  monitorPerformance,
  DEFAULT_THRESHOLDS,
  type PerformanceMetrics,
  type PerformanceThresholds
} from './performance-monitor';