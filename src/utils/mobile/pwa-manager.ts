/**
 * PWA Manager
 *
 * Progressive Web App management:
 * - Install prompts
 * - Update notifications
 * - App capabilities
 * - Platform detection
 */
import { logger } from '@/utils/logger';

import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';

/**
 * PWA-specific navigator properties (not extending Navigator to avoid conflicts)
 */
interface PWANavigator {
  standalone?: boolean;
  setAppBadge?: (count?: number) => Promise<void>;
  setExperimentalAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  clearExperimentalAppBadge?: () => Promise<void>;
}
export interface PWACapabilities {
    canInstall: boolean;
    isInstalled: boolean;
    isStandalone: boolean;
    platform: 'ios' | 'android' | 'desktop' | 'unknown';
    hasNotificationSupport: boolean;
    hasOfflineSupport: boolean;
    hasPushSupport: boolean;
    hasShareSupport: boolean;
    hasFileAccessSupport: boolean;
}
export interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
    }>;
}
// Global install prompt event
let deferredPrompt: InstallPromptEvent | null = null;
/**
 * Initialize PWA manager
 */
export function initializePWA(): void {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        deferredPrompt = e as InstallPromptEvent;
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('pwa-install-available'));
    });
    // Listen for app installed
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        window.dispatchEvent(new CustomEvent('pwa-installed'));
    });
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then((registration) => {
            logger.info('Service Worker registered:', registration);
            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            window.dispatchEvent(new CustomEvent('pwa-update-available'));
                        }
                    });
                }
            });
        }, (error) => {
            logger.error('Service Worker registration failed:', error);
        });
    }
}
/**
 * Get PWA capabilities
 */
export function getPWACapabilities(): PWACapabilities {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as PWANavigator).standalone === true;
    return {
        canInstall: deferredPrompt !== null,
        isInstalled: isStandalone,
        isStandalone,
        platform: detectPlatform(),
        hasNotificationSupport: 'Notification' in window,
        hasOfflineSupport: 'serviceWorker' in navigator,
        hasPushSupport: 'PushManager' in window,
        hasShareSupport: 'share' in navigator,
        hasFileAccessSupport: 'showOpenFilePicker' in window
    };
}
/**
 * Detect platform
 */
function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
        return 'ios';
    }
    if (/android/.test(userAgent)) {
        return 'android';
    }
    if (/windows|mac|linux/.test(userAgent) && !/mobile/.test(userAgent)) {
        return 'desktop';
    }
    return 'unknown';
}
/**
 * Show install prompt
 */
export async function showInstallPrompt(): Promise<AsyncResult<'accepted' | 'dismissed', Error>> {
    try {
        if (!deferredPrompt) {
            return createErrorResult(new Error('No install prompt available'));
        }
        // Show the prompt
        await deferredPrompt.prompt();
        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice;
        // Clear the prompt
        deferredPrompt = null;
        return createSuccessResult(outcome);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to show install prompt'));
    }
}
/**
 * Check if app can be installed
 */
export function canInstallPWA(): boolean {
    return deferredPrompt !== null;
}
/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<AsyncResult<NotificationPermission, Error>> {
    try {
        if (!('Notification' in window)) {
            return createErrorResult(new Error('Notifications not supported'));
        }
        const permission = await Notification.requestPermission();
        return createSuccessResult(permission);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to request notification permission'));
    }
}
/**
 * Show notification
 */
export async function showNotification(title: string, options?: NotificationOptions): Promise<AsyncResult<void, Error>> {
    try {
        if (!('Notification' in window)) {
            return createErrorResult(new Error('Notifications not supported'));
        }
        if (Notification.permission !== 'granted') {
            return createErrorResult(new Error('Notification permission not granted'));
        }
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            await registration.showNotification(title, options);
        }
        else {
            new Notification(title, options);
        }
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to show notification'));
    }
}
/**
 * Share data using Web Share API
 */
export async function shareData(data: ShareData): Promise<AsyncResult<void, Error>> {
    try {
        if (!('share' in navigator)) {
            return createErrorResult(new Error('Web Share API not supported'));
        }
        await navigator.share(data);
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            return createErrorResult(new Error('Share cancelled'));
        }
        return createErrorResult(error instanceof Error ? error : new Error('Failed to share'));
    }
}
/**
 * Get app badge support
 */
export function hasBadgeSupport(): boolean {
    const nav = navigator as unknown as PWANavigator;
    return nav.setAppBadge !== undefined || nav.setExperimentalAppBadge !== undefined;
}
/**
 * Set app badge
 */
export async function setAppBadge(count?: number): Promise<AsyncResult<void, Error>> {
    try {
        const nav = navigator as unknown as PWANavigator;
        if (nav.setAppBadge !== undefined) {
            await nav.setAppBadge(count);
        }
        else if (nav.setExperimentalAppBadge !== undefined) {
            await nav.setExperimentalAppBadge(count);
        }
        else {
            return createErrorResult(new Error('App badge not supported'));
        }
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to set app badge'));
    }
}
/**
 * Clear app badge
 */
export async function clearAppBadge(): Promise<AsyncResult<void, Error>> {
    try {
        const nav = navigator as unknown as PWANavigator;
        if (nav.clearAppBadge !== undefined) {
            await nav.clearAppBadge();
        }
        else if (nav.clearExperimentalAppBadge !== undefined) {
            await nav.clearExperimentalAppBadge();
        }
        else {
            return createErrorResult(new Error('App badge not supported'));
        }
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to clear app badge'));
    }
}
/**
 * Handle app update
 */
export async function updateApp(): Promise<AsyncResult<void, Error>> {
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.waiting) {
            return createErrorResult(new Error('No update available'));
        }
        // Tell waiting service worker to take control
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Reload when new service worker takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to update app'));
    }
}
/**
 * Add PWA event listener
 */
export function onPWAEvent(event: 'install-available' | 'installed' | 'update-available', callback: () => void): () => void {
    const eventName = `pwa-${event}`;
    window.addEventListener(eventName, callback);
    return () => {
        window.removeEventListener(eventName, callback);
    };
}
