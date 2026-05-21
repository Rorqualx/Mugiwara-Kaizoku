/**
 * Network Information API Types
 *
 * Type definitions for the Network Information API.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

interface NetworkInformation {
  /** Effective connection type */
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  /** Downlink speed in Mbps */
  downlink?: number;
  /** Round trip time in milliseconds */
  rtt?: number;
  /** Data saver mode enabled */
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  /** Network connection information (experimental) */
  connection?: NetworkInformation;
  /** Device memory in GB (experimental) */
  deviceMemory?: number;
}

export interface LayoutShiftEntry extends PerformanceEntry {
  /** Whether the shift had recent user input */
  hadRecentInput?: boolean;
  /** Layout shift score */
  value?: number;
}

declare global {
  interface Navigator extends NavigatorWithConnection {}
}

export {};
