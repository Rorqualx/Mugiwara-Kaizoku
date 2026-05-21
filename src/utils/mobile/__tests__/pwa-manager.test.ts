import { createSuccessResult} from '@/utils/async-result';

import {
  getPWACapabilities,
  showInstallPrompt,
  canInstallPWA,
  updateApp,
  initializePWA
} from '../pwa-manager';

// Mock browser globals if not defined (for Bun test environment)
if (typeof window === 'undefined') {
  (global as typeof global & { window: Window & typeof globalThis }).window = {} as Window & typeof globalThis;
}
if (typeof document === 'undefined') {
  (global as typeof global & { document: Document }).document = {} as Document;
}

// Factory to create mock deferred prompt
const createMockDeferredPrompt = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  return {
    prompt: jest.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
    preventDefault: jest.fn(),
  };
};

// Create mock service worker registration
const createMockServiceWorkerRegistration = () => ({
  update: jest.fn().mockResolvedValue(undefined),
  installing: null,
  waiting: { postMessage: jest.fn() },
  active: { state: 'activated' },
  addEventListener: jest.fn()
});

let mockServiceWorkerRegistration = createMockServiceWorkerRegistration();

// Helper to create and dispatch beforeinstallprompt event
const dispatchInstallPromptEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const mockPrompt = createMockDeferredPrompt(outcome);
  // Create a custom event that we can modify
  const event = new CustomEvent('beforeinstallprompt', { cancelable: true });
  // Define properties on the event (not using Object.assign which fails on Event)
  Object.defineProperty(event, 'prompt', { value: mockPrompt.prompt, writable: true, configurable: true });
  Object.defineProperty(event, 'userChoice', { value: mockPrompt.userChoice, writable: true, configurable: true });
  window.dispatchEvent(event);
  return mockPrompt;
};

describe('pwa-manager', () => {
  let originalNavigator: typeof window.navigator | undefined;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock registration
    mockServiceWorkerRegistration = createMockServiceWorkerRegistration();

    // Store originals (if they exist)
    originalNavigator = window.navigator;
    originalMatchMedia = window.matchMedia;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
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
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (test)',
        standalone: false,
        serviceWorker: {
          register: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
          getRegistration: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
          controller: null,
          addEventListener: jest.fn()
        }
      },
      writable: true,
      configurable: true
    });

    // Initialize PWA to set up event listeners
    initializePWA();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia
      });
    }
    if (originalNavigator) {
      Object.defineProperty(window, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
    }
    // Trigger appinstalled to clear the deferred prompt
    window.dispatchEvent(new Event('appinstalled'));
  });

  describe('canInstallPWA', () => {
    it('should return false when no deferred prompt', () => {
      const result = canInstallPWA();
      expect(result).toBe(false);
    });

    it('should return true when deferred prompt exists', () => {
      // Dispatch beforeinstallprompt event to set internal deferredPrompt
      dispatchInstallPromptEvent();

      const result = canInstallPWA();
      expect(result).toBe(true);
    });
  });

  describe('getPWACapabilities', () => {
    it('should return correct capabilities when not standalone', () => {
      const result = getPWACapabilities();
      expect(result.isStandalone).toBe(false);
      expect(result.canInstall).toBe(false);
    });

    it('should detect standalone display mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: jest.fn().mockImplementation(query => ({
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

      const result = getPWACapabilities();
      expect(result.isStandalone).toBe(true);
      expect(result.isInstalled).toBe(true);
    });

    it('should detect iOS standalone', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (test)', standalone: true },
        writable: true,
        configurable: true
      });

      const result = getPWACapabilities();
      expect(result.isStandalone).toBe(true);
      expect(result.isInstalled).toBe(true);
    });
  });

  describe('showInstallPrompt', () => {
    it('should return error when no deferred prompt', async () => {
      const result = await showInstallPrompt();
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('No install prompt available');
      }
    });

    it('should show prompt and return accepted', async () => {
      // Dispatch beforeinstallprompt event to set internal deferredPrompt
      const mockPrompt = dispatchInstallPromptEvent('accepted');

      const result = await showInstallPrompt();

      expect(mockPrompt.prompt).toHaveBeenCalled();
      expect(result).toEqual(createSuccessResult('accepted'));
      // After showing, prompt should be cleared so canInstallPWA returns false
      expect(canInstallPWA()).toBe(false);
    });

    it('should return dismissed when user dismisses', async () => {
      // Dispatch beforeinstallprompt event with 'dismissed' outcome
      dispatchInstallPromptEvent('dismissed');

      const result = await showInstallPrompt();

      expect(result).toEqual(createSuccessResult('dismissed'));
    });

    it('should handle prompt errors', async () => {
      // Create custom event with error-throwing prompt
      const errorPrompt = jest.fn().mockRejectedValue(new Error('Prompt failed'));
      const event = new CustomEvent('beforeinstallprompt', { cancelable: true });
      Object.defineProperty(event, 'prompt', { value: errorPrompt, writable: true, configurable: true });
      Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' as const }), writable: true, configurable: true });
      window.dispatchEvent(event);

      const result = await showInstallPrompt();

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Prompt failed');
      }
    });
  });

  // Service worker registration is handled internally by initializePWA

  describe('updateApp', () => {
    it('should send skip waiting message successfully', async () => {
      const result = await updateApp();

      expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled();
      expect(mockServiceWorkerRegistration.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(result).toEqual(createSuccessResult(undefined));
    });

    it('should handle no registration', async () => {
      (navigator.serviceWorker.getRegistration as jest.Mock).mockResolvedValue(undefined);

      const result = await updateApp();

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('No update available');
      }
    });

    it('should handle no waiting worker', async () => {
      (navigator.serviceWorker.getRegistration as jest.Mock).mockResolvedValue({
        ...mockServiceWorkerRegistration,
        waiting: null
      });

      const result = await updateApp();

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('No update available');
      }
    });
  });

  describe('beforeinstallprompt event', () => {
    it('should capture deferred prompt from event', () => {
      // Use helper which dispatches the event correctly
      dispatchInstallPromptEvent();

      // Verify canInstallPWA returns true (prompt was captured)
      expect(canInstallPWA()).toBe(true);
    });
  });
});