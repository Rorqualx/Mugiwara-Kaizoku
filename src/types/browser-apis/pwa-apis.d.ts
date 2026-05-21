/**
 * Extended PWA API Types
 *
 * Type definitions for experimental PWA APIs not yet in standard TypeScript libs.
 */

interface ExtendedNavigator extends Navigator {
  /** iOS-specific property to detect standalone mode */
  standalone?: boolean;

  /** Badge API - Standard */
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;

  /** Badge API - Experimental */
  setExperimentalAppBadge?: (count?: number) => Promise<void>;
  clearExperimentalAppBadge?: () => Promise<void>;
}

declare global {
  interface Window {
    navigator: ExtendedNavigator;
  }
}

export {};
