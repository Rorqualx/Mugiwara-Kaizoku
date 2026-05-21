/**
 * Progressive Web App (PWA) Hook
 *
 * Manages PWA features including install prompts, update detection,
 * and app manifest status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed';}>;
}

interface UsePWAReturn {
  /** Whether the app can be installed */
  canInstall: boolean;
  /** Whether the app is installed (standalone mode) */
  isInstalled: boolean;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether the app is online */
  isOnline: boolean;
  /** Install the PWA */
  install: () => Promise<void>;
  /** Update the PWA */
  update: () => void;
  /** Skip waiting and activate new service worker */
  skipWaiting: () => void;
}

/**
 * Hook for managing Progressive Web App features
 */
export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  // Track if user explicitly requested an update - prevents auto-reload during inactivity
  // Using ref to avoid stale closure in controllerchange event handler
  const userRequestedUpdateRef = useRef(false);

  // Check if app is installed (standalone mode)
  useEffect(() => {
    const checkInstalled = (): void => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check for iOS standalone mode
      const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
      const isInWebApp = navigatorWithStandalone.standalone === true;
      setIsInstalled(isStandalone || isInWebApp);
    };

    checkInstalled();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = (): void => checkInstalled();

    // Modern browsers always have addEventListener
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event): void => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const updateOnlineStatus = (): void => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Handle service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleControllerChange = (): void => {
        // Only reload if user explicitly requested an update
        // This prevents unexpected reloads during inactivity when browser
        // automatically activates a waiting service worker
        if (userRequestedUpdateRef.current) {
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // Check for updates
      void navigator.serviceWorker.ready.then((registration) => {
        // Check if there's a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new workers
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  // Install PWA
  const install = useCallback(async () => {
    if (!deferredPrompt) {
      throw new Error('Install prompt not available');
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // Update PWA
  const update = useCallback(() => {
    if (waitingWorker) {
      // Mark that user explicitly requested an update (enables reload on controllerchange)
      userRequestedUpdateRef.current = true;
      // Tell waiting service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  // Skip waiting (for manual update)
  const skipWaiting = useCallback(() => {
    if (waitingWorker) {
      // Mark that user explicitly requested an update (enables reload on controllerchange)
      userRequestedUpdateRef.current = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return {
    canInstall,
    isInstalled,
    updateAvailable,
    isOnline,
    install,
    update,
    skipWaiting
  };
}