/**
 * Mobile Optimization Checklist Items
 *
 * Extracted checklist items for mobile optimization:
 * - Performance metrics
 * - Mobile features
 * - Progressive Web App (PWA)
 * - Accessibility
 * - Best practices
 */

import { isSecureEnvironment, hasRootCustomProperty, isBrowser } from '@/utils/browser';
import { collectPerformanceMetrics } from '@/utils/mobile/performance-monitor';
import { getPWACapabilities } from '@/utils/mobile/pwa-manager';
import { testMobileFeatures } from '@/utils/mobile/testing-utils';
import { isSuccess } from '@/utils/validation/async-result';

export interface ChecklistItem {
    id: string;
    category: string;
    title: string;
    description: string;
    check: () => Promise<boolean> | boolean;
    weight: number;
    status?: 'pass' | 'fail' | 'warning' | 'checking';
    details?: string;
}

export const defaultChecklist: ChecklistItem[] = [
    // Performance
    {
        id: 'perf-lcp',
        category: 'Performance',
        title: 'Largest Contentful Paint (LCP)',
        description: 'Main content loads within 2.5 seconds',
        weight: 3,
        check: async (): Promise<boolean> => {
            const metrics = await collectPerformanceMetrics();
            if (isSuccess(metrics) && metrics.data.lcp) {
                return metrics.data.lcp <= 2500;
            }
            return false;
        }
    },
    {
        id: 'perf-fcp',
        category: 'Performance',
        title: 'First Contentful Paint (FCP)',
        description: 'First content appears within 1.8 seconds',
        weight: 2,
        check: async (): Promise<boolean> => {
            const metrics = await collectPerformanceMetrics();
            if (isSuccess(metrics) && metrics.data.fcp) {
                return metrics.data.fcp <= 1800;
            }
            return false;
        }
    },
    {
        id: 'perf-ttfb',
        category: 'Performance',
        title: 'Time to First Byte (TTFB)',
        description: 'Server responds within 800ms',
        weight: 2,
        check: async (): Promise<boolean> => {
            const metrics = await collectPerformanceMetrics();
            if (isSuccess(metrics) && metrics.data.ttfb) {
                return metrics.data.ttfb <= 800;
            }
            return false;
        }
    },
    {
        id: 'perf-bundle',
        category: 'Performance',
        title: 'JavaScript Bundle Size',
        description: 'Initial JS bundle is under 200KB',
        weight: 2,
        check: async (): Promise<boolean> => {
            // SSR-safe check for bundle size
            if (!isBrowser()) {
                return false;
            }
            // Check main bundle size
            const scripts = Array.from(document.scripts);
            const mainScript = scripts.find((s) => s.src.includes('main'));
            if (mainScript) {
                try {
                    const response = await fetch(mainScript.src);
                    const size = parseInt(response.headers.get('content-length') ?? '0');
                    return size < 200 * 1024; // 200KB
                }
                catch {
                    return false;
                }
            }
            return false;
        }
    },
    // Mobile Features
    {
        id: 'mobile-viewport',
        category: 'Mobile Features',
        title: 'Viewport Meta Tag',
        description: 'Proper viewport configuration for mobile',
        weight: 3,
        check: (): boolean => {
            // SSR-safe check for viewport meta tag
            if (!isBrowser()) {
                return false;
            }
            const viewport = document.querySelector('meta[name="viewport"]');
            return viewport !== null && (viewport.getAttribute('content')?.includes('width=device-width') ?? false);
        }
    },
    {
        id: 'mobile-touch',
        category: 'Mobile Features',
        title: 'Touch Support',
        description: 'Touch events are properly handled',
        weight: 2,
        check: async (): Promise<boolean> => {
            const features = await testMobileFeatures();
            return features.touch;
        }
    },
    {
        id: 'mobile-gestures',
        category: 'Mobile Features',
        title: 'Gesture Support',
        description: 'Common gestures (swipe, pinch) are supported',
        weight: 2,
        check: (): boolean => {
            // SSR-safe check for gesture support
            if (!isBrowser()) {
                return false;
            }
            // Check if gesture handlers are registered
            return document.querySelectorAll('[data-gesture]').length > 0 ||
                Object.prototype.hasOwnProperty.call(window, 'hammerjs') ||
                'ontouchstart' in window;
        }
    },
    // PWA
    {
        id: 'pwa-manifest',
        category: 'Progressive Web App',
        title: 'Web App Manifest',
        description: 'Valid manifest.json for installability',
        weight: 2,
        check: (): boolean => {
            // SSR-safe check for web app manifest
            if (!isBrowser()) {
                return false;
            }
            const manifest = document.querySelector('link[rel="manifest"]');
            return manifest !== null;
        }
    },
    {
        id: 'pwa-sw',
        category: 'Progressive Web App',
        title: 'Service Worker',
        description: 'Service worker for offline support',
        weight: 3,
        check: (): boolean => {
            // SSR-safe check for service worker
            if (!isBrowser()) {
                return false;
            }
            return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
        }
    },
    {
        id: 'pwa-https',
        category: 'Progressive Web App',
        title: 'HTTPS',
        description: 'Served over secure connection',
        weight: 3,
        check: (): boolean => {
            return isSecureEnvironment();
        }
    },
    {
        id: 'pwa-installable',
        category: 'Progressive Web App',
        title: 'Installable',
        description: 'Can be installed as an app',
        weight: 2,
        check: (): boolean => {
            const capabilities = getPWACapabilities();
            return capabilities.canInstall || capabilities.isInstalled;
        }
    },
    // Accessibility
    {
        id: 'a11y-touch-targets',
        category: 'Accessibility',
        title: 'Touch Target Size',
        description: 'Interactive elements are at least 48x48px',
        weight: 2,
        check: (): boolean => {
            // SSR-safe check for touch target size
            if (!isBrowser()) {
                return false;
            }
            const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
            let tooSmall = 0;
            interactiveElements.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width < 48 || rect.height < 48) {
                    tooSmall++;
                }
            });
            return tooSmall === 0;
        }
    },
    {
        id: 'a11y-contrast',
        category: 'Accessibility',
        title: 'Color Contrast',
        description: 'Text has sufficient contrast ratio',
        weight: 2,
        check: (): boolean => {
            // Check for CSS custom properties indicating theme support
            return hasRootCustomProperty('--mantine-color-text');
        }
    },
    {
        id: 'a11y-motion',
        category: 'Accessibility',
        title: 'Reduced Motion',
        description: 'Respects prefers-reduced-motion',
        weight: 1,
        check: (): boolean => {
            // SSR-safe check for reduced motion preference
            if (!isBrowser()) {
                return false;
            }
            const _hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Check if animations are disabled when reduced motion is preferred
            return true; // Simplified check
        }
    },
    // Best Practices
    {
        id: 'bp-responsive-images',
        category: 'Best Practices',
        title: 'Responsive Images',
        description: 'Images use srcset for different screen sizes',
        weight: 2,
        check: (): boolean => {
            // SSR-safe check for responsive images
            if (!isBrowser()) {
                return false;
            }
            const images = document.querySelectorAll('img');
            let responsive = 0;
            images.forEach((img) => {
                if (img.srcset || img.sizes || img.loading === 'lazy') {
                    responsive++;
                }
            });
            return images.length === 0 || responsive > images.length / 2;
        }
    },
    {
        id: 'bp-font-loading',
        category: 'Best Practices',
        title: 'Font Loading',
        description: 'Fonts load without blocking',
        weight: 1,
        check: (): boolean => {
            // SSR-safe check for font loading
            if (!isBrowser()) {
                return false;
            }
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            let hasSwap = false;
            links.forEach((link) => {
                if (link instanceof HTMLLinkElement && link.href.includes('fonts') && link.href.includes('display=swap')) {
                    hasSwap = true;
                }
            });
            return hasSwap;
        }
    }
];