import {
  isNativeApp,
  callNativeMethod,
  nativeShare,
  onNativeEvent,
  getNativePlatform,
  getNativeCapabilities
} from '../native-bridge';

/**
 * Native Bridge Test Suite
 *
 * Note: The native-bridge module captures window.nativeBridge, window.Capacitor,
 * and window.cordova at module load time. Since these are captured before tests run,
 * most tests verify the fallback behavior (not running in native app).
 */

describe('native-bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isNativeApp', () => {
    it('should return false when not in native app', () => {
      // Module captured window.nativeBridge etc. at load time (undefined)
      const result = isNativeApp();
      expect(result).toBe(false);
    });
  });

  describe('getNativePlatform', () => {
    it('should return web when not in native app', () => {
      const result = getNativePlatform();
      expect(result).toBe('web');
    });
  });

  describe('getNativeCapabilities', () => {
    it('should return web capabilities when not in native app', () => {
      const result = getNativeCapabilities();

      expect(result.platform).toBe('web');
      expect(result.isNative).toBe(false);
      expect(typeof result.hasCamera).toBe('boolean');
      expect(typeof result.hasNetwork).toBe('boolean');
      expect(typeof result.hasHaptic).toBe('boolean');
    });
  });

  describe('callNativeMethod', () => {
    it('should return error when not in native app', async () => {
      const result = await callNativeMethod('testMethod');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Not running in native app');
      }
    });
  });

  describe('nativeShare', () => {
    it('should return error when not in native app', async () => {
      const result = await nativeShare({ title: 'Test' });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        // nativeShare calls callNativeMethod which returns "Not running in native app"
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Not running in native app');
      }
    });
  });

  describe('onNativeEvent', () => {
    it('should return noop unregister function when not in native app', () => {
      const handler = jest.fn();
      const unregister = onNativeEvent('testEvent', handler);

      // Should return a function
      expect(typeof unregister).toBe('function');

      // Handler should not be called when event is dispatched
      // (because we're not in native app)
      const event = new CustomEvent('native-testEvent', { detail: { value: 'test' } });
      window.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();

      // Unregister should not throw
      expect(() => unregister()).not.toThrow();
    });
  });
});
