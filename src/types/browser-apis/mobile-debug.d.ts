/**
 * Mobile Debug Type Definitions
 *
 * Type definitions for mobile development debugging tools.
 */

interface MobileDebugConfig {
  enabled: boolean;
  showDeviceInfo: boolean;
  showPerformanceMetrics: boolean;
  showNetworkInfo: boolean;
  logTouches: boolean;
  showBreakpoints: boolean;
}

interface MobileDebugCommands {
  enable: (config?: Partial<MobileDebugConfig>) => void;
  disable: () => void;
  simulateDevice: (deviceType: 'mobile' | 'tablet' | 'desktop') => void;
  showBreakpoint: () => HTMLDivElement | null;
  hideBreakpoint: () => void;
  logDevice: () => Promise<void>;
  logPerformance: () => Promise<void>;
}

declare global {
  interface Window {
    __MOBILE_DEBUG__?: MobileDebugConfig;
    mobileDebug?: MobileDebugCommands;
  }
}

export {};
