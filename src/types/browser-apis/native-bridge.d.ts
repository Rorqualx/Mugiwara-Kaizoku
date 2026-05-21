/**
 * Native Bridge Type Definitions
 *
 * Type definitions for native app bridges (Capacitor, Cordova, custom).
 */

interface NativeBridgeAPI {
  platform?: string;
  hasPlugin(plugin: string): boolean;
  addEventListener(event: string, handler: EventListener): void;
  removeEventListener(event: string, handler: EventListener): void;
  call<T>(method: string, args?: unknown): Promise<T>;
}

interface CapacitorAPI {
  getPlatform(): 'ios' | 'android' | 'web';
  isPluginAvailable(plugin: string): boolean;
  Plugins: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
}

interface CordovaAPI {
  platformId: string;
  plugins?: Record<string, unknown>;
  exec(
    success: (result: unknown) => void,
    error: (error: unknown) => void,
    ...args: unknown[]
  ): void;
}

interface WakeLockSentinel {
  release(): Promise<void>;
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

declare global {
  interface Window {
    nativeBridge?: NativeBridgeAPI;
    Capacitor?: CapacitorAPI;
    cordova?: CordovaAPI;
  }

  interface Navigator {
    wakeLock?: WakeLock;
  }
}

export {};
