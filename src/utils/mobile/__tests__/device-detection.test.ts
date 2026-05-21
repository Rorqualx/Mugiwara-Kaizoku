import { isSuccess} from '@/utils/async-result';

import {
  detectDevice,
  getDeviceInfo,
  invalidateDeviceCache,
  isMobileDevice,
  isTabletDevice,
  isDesktopDevice,
  getViewportSize
} from '../device-detection';

// Mock browser globals if not defined (for Bun test environment)
if (typeof window === 'undefined') {
  (global as typeof global & { window: Window & typeof globalThis }).window = {
    navigator: { userAgent: 'Mozilla/5.0 (test)' },
    screen: {},
    devicePixelRatio: 1,
    innerWidth: 1024,
    innerHeight: 768
  } as Window & typeof globalThis;
}
if (typeof navigator === 'undefined') {
  (global as typeof global & { navigator: Navigator }).navigator = { userAgent: 'Mozilla/5.0 (test)' } as Navigator;
}

describe('Device Detection Utilities', () => {
  beforeEach(() => {
    // Reset window and navigator mocks
    jest.clearAllMocks();
    invalidateDeviceCache();
  });

  describe('detectDevice', () => {
    it('should detect mobile device from user agent', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 375, configurable: true });
      Object.defineProperty(window.screen, 'height', { value: 812, configurable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });

      const result = await detectDevice();
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.isMobile).toBe(true);
        expect(result.data.isTablet).toBe(false);
        expect(result.data.isDesktop).toBe(false);
        expect(result.data.screenWidth).toBe(375);
        expect(result.data.devicePixelRatio).toBe(3);
      }
    });

    it('should detect tablet device from user agent and size', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 768, configurable: true });
      Object.defineProperty(window.screen, 'height', { value: 1024, configurable: true });

      const result = await detectDevice();
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.isMobile).toBe(false);
        expect(result.data.isTablet).toBe(true);
        expect(result.data.isDesktop).toBe(false);
      }
    });

    it('should detect desktop device', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true });
      Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });

      const result = await detectDevice();
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.isMobile).toBe(false);
        expect(result.data.isTablet).toBe(false);
        expect(result.data.isDesktop).toBe(true);
      }
    });

    it('should detect touch capability', async () => {
      // Mock touch support
      Object.defineProperty(window, 'ontouchstart', {
        value: () => {},
        configurable: true
      });

      const result = await detectDevice();
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.isTouchDevice).toBe(true);
      }
    });
  });

  describe('getDeviceInfo with caching', () => {
    it('should cache device info after first call', async () => {
      // First call
      const result1 = await getDeviceInfo();
      expect(isSuccess(result1)).toBe(true);

      // Second call should use cache - verify by checking that results are identical references
      // (caching means the same object is returned)
      const result2 = await getDeviceInfo();
      expect(isSuccess(result2)).toBe(true);

      // Results should be identical (same cached object)
      if (isSuccess(result1) && isSuccess(result2)) {
        expect(result1.data).toEqual(result2.data);
        // The cached data should be the exact same object reference
        expect(result1.data).toBe(result2.data);
      }
    });

    it('should invalidate cache and re-detect', async () => {
      // First detection
      const result1 = await getDeviceInfo();
      expect(isSuccess(result1)).toBe(true);

      // Change screen size
      Object.defineProperty(window.screen, 'width', { value: 375, configurable: true });

      // Invalidate cache
      invalidateDeviceCache();

      // Next call should re-detect
      const result2 = await getDeviceInfo();
      expect(isSuccess(result2)).toBe(true);
      if (isSuccess(result1) && isSuccess(result2)) {
        // After invalidation, should be a different object
        expect(result1.data).not.toBe(result2.data);
        expect(result2.data.screenWidth).toBe(375);
      }
    });
  });

  describe('Helper functions', () => {
    it('isMobileDevice should return correct value', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 375, configurable: true });
      
      const isMobile = await isMobileDevice();
      expect(isMobile).toBe(true);
    });

    it('isTabletDevice should return correct value', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 768, configurable: true });
      
      const isTablet = await isTabletDevice();
      expect(isTablet).toBe(true);
    });

    it('isDesktopDevice should return correct value', async () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true
      });
      Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true });
      
      const isDesktop = await isDesktopDevice();
      expect(isDesktop).toBe(true);
    });
  });

  describe('getViewportSize', () => {
    it('should return current viewport dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      
      const size = getViewportSize();
      expect(size.width).toBe(1024);
      expect(size.height).toBe(768);
    });

    it('should handle missing window object', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      const size = getViewportSize();
      expect(size.width).toBe(0);
      expect(size.height).toBe(0);
      
      global.window = originalWindow;
    });
  });
});