/**
 * Mobile Image Utilities
 *
 * Utilities for optimizing images on mobile devices:
 * - Image format detection
 * - Size calculations
 * - Quality adjustments
 * - Cache management
 */
// import { logger } from '@/utils/logger';
import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';
/**
 * Image format capabilities
 */
export interface ImageFormatSupport {
    webp: boolean;
    avif: boolean;
    jpeg2000: boolean;
    jpegxr: boolean;
}
/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
    /** Target width */
    width?: number;
    /** Target height */
    height?: number;
    /** Image quality (0-100) */
    quality?: number;
    /** Preferred format */
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
    /** Device pixel ratio */
    dpr?: number;
    /** Whether to use progressive encoding */
    progressive?: boolean;
}
/**
 * Image dimensions
 */
export interface ImageDimensions {
    width: number;
    height: number;
    aspectRatio: number;
}
/**
 * Check browser support for modern image formats
 */
export async function checkImageFormatSupport(): Promise<AsyncResult<ImageFormatSupport, Error>> {
    try {
        const support: ImageFormatSupport = {
            webp: false,
            avif: false,
            jpeg2000: false,
            jpegxr: false
        };
        // Check WebP support
        support.webp = await checkImageTypeSupport('data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==');
        // Check AVIF support
        support.avif = await checkImageTypeSupport('data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAPFtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAbGliYXZpZgAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAEUAAAAKAAAAB');
        // Check JPEG 2000 support
        support.jpeg2000 = await checkImageTypeSupport('data:image/jp2;base64,/0//UQAyAAAAAAABAAAAAgAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAEBAAAAAAAAAAAAQBEABAAAAUzAFEAXAAAAAADAAAAAAAgAAAHgAAABaAIAPMAAABS0DIAAAEAAAHgAAAAAFJURC9IAAEAAAAAAeAAAAAVBYXEAbW');
        // Check JPEG XR support
        support.jpegxr = await checkImageTypeSupport('data:image/vnd.ms-photo;base64,SUm8AQgAAAAJAAG8AQAQAAAASgAAAIC8BAABAAAAAQA');
        return createSuccessResult(support);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to check image format support'));
    }
}
/**
 * Check if browser supports a specific image type
 */
async function checkImageTypeSupport(dataUri: string): Promise<boolean> {
    return new Promise(resolve => {
        // eslint-disable-next-line no-undef
        const img = new Image();
        img.onload = () => resolve(img.width > 0 && img.height > 0);
        img.onerror = () => resolve(false);
        img.src = dataUri;
    });
}
/**
 * Get optimal image format based on browser support
 */
export async function getOptimalImageFormat(preferredFormat?: string): Promise<AsyncResult<string, Error>> {
    try {
        const supportResult = await checkImageFormatSupport();
        if (supportResult["status"] !== 'success') {
            return createErrorResult(new Error('Failed to check image format support'));
        }
        const support = supportResult.data;
        // If preferred format is specified and supported, use it
        if (preferredFormat) {
            if (preferredFormat === 'avif' && support.avif)
                return createSuccessResult('avif');
            if (preferredFormat === 'webp' && support.webp)
                return createSuccessResult('webp');
        }
        // Otherwise, choose the best available format
        if (support.avif)
            return createSuccessResult('avif');
        if (support.webp)
            return createSuccessResult('webp');
        // Fallback to JPEG for photos, PNG for graphics
        return createSuccessResult('jpeg');
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to determine optimal image format'));
    }
}
/**
 * Calculate responsive image dimensions
 */
export function calculateResponsiveDimensions(originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number): ImageDimensions {
    const aspectRatio = originalWidth / originalHeight;
    let width = originalWidth;
    let height = originalHeight;
    // Scale down if necessary
    if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
    }
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }
    return {
        width: Math.round(width),
        height: Math.round(height),
        aspectRatio
    };
}
/**
 * Get device-appropriate image quality
 */
export function getDeviceImageQuality(networkType?: string, saveData?: boolean): number {
    // If save data is enabled, use lower quality
    if (saveData)
        return 60;
    // Adjust quality based on network type
    switch (networkType) {
        case 'slow-2g':
        case '2g':
            return 50;
        case '3g':
            return 70;
        case '4g':
        case 'wifi':
        default:
            return 85;
    }
}
/**
 * Generate image URL with optimization parameters
 */
export function generateOptimizedImageUrl(baseUrl: string, options: ImageOptimizationOptions): string {
    const params = new URLSearchParams();
    if (options.width) {
        params.append('w', options.width.toString());
    }
    if (options.height) {
        params.append('h', options.height.toString());
    }
    if (options.quality) {
        params.append('q', options.quality.toString());
    }
    if (options.format) {
        params.append('fm', options.format);
    }
    if (options.dpr && options.dpr > 1) {
        params.append('dpr', options.dpr.toString());
    }
    if (options.progressive) {
        params.append('progressive', 'true');
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${params.toString()}`;
}
/**
 * Preload critical images
 */
export function preloadCriticalImages(urls: string[]): void {
    if (typeof document === 'undefined')
        return;
    urls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
    });
}
/**
 * Lazy load images using Intersection Observer
 */
export function setupLazyImageLoading(selector = '[data-lazy]', rootMargin = '50px'): () => void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return () => { };
    }
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                const src = img.dataset["src"];
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    }, {
        rootMargin
    });
    // Observe all lazy images
    const images = document.querySelectorAll(selector);
    images.forEach(img => imageObserver.observe(img));
    // Return cleanup function
    return () => {
        imageObserver.disconnect();
    };
}
/**
 * Calculate image cache size
 */
export async function calculateImageCacheSize(): Promise<AsyncResult<number, Error>> {
    try {
        if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
            return createSuccessResult(0);
        }
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage ?? 0;
        // This is an approximation - actual image cache size would require more specific APIs
        const imageCacheSize = Math.round(usage * 0.7); // Assume 70% is images
        return createSuccessResult(imageCacheSize);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to calculate image cache size'));
    }
}
/**
 * Clear image cache
 */
export async function clearImageCache(): Promise<AsyncResult<void, Error>> {
    try {
        if ('caches' in window) {
            // eslint-disable-next-line no-undef
            const cacheNames = await caches.keys();
            const imageCaches = cacheNames.filter(name => name.includes('image'));
            // eslint-disable-next-line no-undef
            await Promise.all(imageCaches.map(name => caches.delete(name)));
        }
        return createSuccessResult(undefined);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to clear image cache'));
    }
}
