/**
 * Safari-specific Browser APIs
 *
 * Type definitions for Safari-specific APIs and legacy MediaQuery methods.
 */

interface SafariNavigator extends Navigator {
  /** iOS standalone mode detection */
  standalone?: boolean;
}

declare global {
  interface Navigator extends SafariNavigator {}
}

export {};
