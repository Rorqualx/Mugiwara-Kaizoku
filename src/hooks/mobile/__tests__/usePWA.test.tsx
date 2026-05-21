import { renderHook, act } from '@testing-library/react';

import { usePWA } from '../usePWA';

// Define types for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Mock window events
const mockDeferredPrompt = {
  prompt: jest.fn(),
  userChoice: Promise.resolve({ outcome: 'accepted' as const })
};

describe('usePWA', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalNavigator: Navigator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeferredPrompt.prompt.mockClear();

    // Mock matchMedia
    originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
    });

    // Mock navigator
    originalNavigator = window.navigator;
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (test)',
        standalone: false,
        onLine: true
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia
    });
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  it('should detect standalone mode correctly', () => {
    const { result } = renderHook(() => usePWA());

    // Should detect standalone mode from matchMedia mock
    expect(result.current.isInstalled).toBe(true);
  });

  it('should detect iOS standalone mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
    });

    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (test)', standalone: true, onLine: true },
      writable: true,
      configurable: true
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(true);
  });

  it('should not be installed when not in standalone mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))
    });

    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (test)', standalone: false, onLine: true },
      writable: true,
      configurable: true
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(false);
  });

  it('should handle beforeinstallprompt event', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.canInstall).toBe(false);

    act(() => {
      const baseEvent = new Event('beforeinstallprompt', { cancelable: true });
      const event = Object.assign(baseEvent, {
        preventDefault: jest.fn(),
        ...mockDeferredPrompt
      }) as BeforeInstallPromptEvent;
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('should prompt for installation', async () => {
    const { result } = renderHook(() => usePWA());

    // Set up deferred prompt
    act(() => {
      const baseEvent = new Event('beforeinstallprompt', { cancelable: true });
      const event = Object.assign(baseEvent, {
        preventDefault: jest.fn(),
        ...mockDeferredPrompt
      }) as BeforeInstallPromptEvent;
      window.dispatchEvent(event);
    });

    // Prompt for installation
    await act(async () => {
      await result.current.install();
    });

    expect(mockDeferredPrompt.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => usePWA());

    unmount();

    // Hook registers beforeinstallprompt, online, offline listeners
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('should throw error when installing without prompt', async () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.canInstall).toBe(false);

    // Install should throw when no deferred prompt is available
    let errorThrown = false;
    try {
      await act(async () => {
        await result.current.install();
      });
    } catch (error) {
      errorThrown = true;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Install prompt not available');
    }

    expect(errorThrown).toBe(true);
    expect(mockDeferredPrompt.prompt).not.toHaveBeenCalled();
  });

  it('should track online status', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isOnline).toBe(true);
  });
});
