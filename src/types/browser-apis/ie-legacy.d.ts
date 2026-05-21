/**
 * Internet Explorer Legacy APIs
 *
 * Type definitions for IE-specific legacy APIs.
 */

interface IENavigator extends Navigator {
  /** IE-specific maximum touch points */
  msMaxTouchPoints?: number;
}

declare global {
  interface Navigator extends IENavigator {}
}

export {};
