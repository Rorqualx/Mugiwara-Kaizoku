/**
 * Native App Bridge
 *
 * Bridge for communication with native app wrappers:
 * - WebView communication
 * - Native API access
 * - Platform-specific features
 * - Capacitor/Cordova compatibility
 */
// import { logger } from '@/utils/logger';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError
} from '../async-result';

import type {
  AsyncResult} from '../async-result';

export type NativePlatform = 'ios' | 'android' | 'web';
export interface NativeCapabilities {
    platform: NativePlatform;
    isNative: boolean;
    hasCamera: boolean;
    hasGallery: boolean;
    hasFileSystem: boolean;
    hasNetwork: boolean;
    hasPush: boolean;
    hasBiometric: boolean;
    hasHaptic: boolean;
    hasStatusBar: boolean;
    hasSplashScreen: boolean;
}
export interface NativeFileResult {
    path: string;
    data: string;
    mimeType: string;
    size: number;
}
export interface NativeShareOptions {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
}
// Global native bridge reference
const nativeBridge = window.nativeBridge;
const capacitor = window.Capacitor;
const cordova = window.cordova;
/**
 * Check if running in native app
 */
export function isNativeApp(): boolean {
    return !!(nativeBridge ?? capacitor ?? cordova);
}
/**
 * Get native platform
 */
export function getNativePlatform(): NativePlatform {
    if (!isNativeApp())
        return 'web';
    if (capacitor) {
        return capacitor.getPlatform();
    }
    if (cordova) {
        return cordova.platformId === 'ios' ? 'ios' : 'android';
    }
    if (nativeBridge?.platform !== undefined) {
        const platform = nativeBridge.platform;
        if (platform === 'ios' || platform === 'android' || platform === 'web') {
            return platform;
        }
    }
    return 'web';
}
/**
 * Get native capabilities
 */
export function getNativeCapabilities(): NativeCapabilities {
    const platform = getNativePlatform();
    const isNative = isNativeApp();
    if (!isNative) {
        return {
            platform: 'web',
            isNative: false,
            hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
            hasGallery: false,
            hasFileSystem: !!window.showOpenFilePicker,
            hasNetwork: !!navigator.onLine,
            hasPush: 'PushManager' in window,
            hasBiometric: false,
            hasHaptic: 'vibrate' in navigator,
            hasStatusBar: false,
            hasSplashScreen: false
        };
    }
    // Check native capabilities
    const capabilities: NativeCapabilities = {
        platform,
        isNative: true,
        hasCamera: checkNativePlugin('camera'),
        hasGallery: checkNativePlugin('gallery'),
        hasFileSystem: checkNativePlugin('filesystem'),
        hasNetwork: checkNativePlugin('network'),
        hasPush: checkNativePlugin('push'),
        hasBiometric: checkNativePlugin('biometric'),
        hasHaptic: checkNativePlugin('haptic'),
        hasStatusBar: checkNativePlugin('statusbar'),
        hasSplashScreen: checkNativePlugin('splashscreen')
    };
    return capabilities;
}
/**
 * Check if native plugin is available
 */
function checkNativePlugin(plugin: string): boolean {
    if (capacitor) {
        return capacitor.isPluginAvailable(plugin);
    }
    if (cordova?.plugins) {
        return !!cordova.plugins[plugin];
    }
    if (nativeBridge) {
        return nativeBridge.hasPlugin(plugin);
    }
    return false;
}
/**
 * Call native method
 */
export async function callNativeMethod<T>(method: string, args?: unknown): Promise<AsyncResult<T, Error>> {
    try {
        if (!isNativeApp()) {
            return createErrorResult(new Error('Not running in native app'));
        }
        let result: T;
        if (capacitor) {
            const parts = method.split('.');
            const plugin = parts[0];
            const methodName = parts[1];
            if (plugin === undefined || methodName === undefined) {
                return createErrorResult(new Error('Invalid method format'));
            }
            const pluginObj = capacitor.Plugins[plugin];
            if (pluginObj === undefined) {
                return createErrorResult(new Error(`Plugin not found: ${plugin}`));
            }
            const pluginMethod = pluginObj[methodName];
            if (pluginMethod === undefined) {
                return createErrorResult(new Error(`Method not found: ${methodName}`));
            }
            result = await pluginMethod(args) as T;
        }
        else if (cordova) {
            result = await new Promise<T>((resolve, reject) => {
                const parts = method.split('.');
                const service = parts[0] ?? '';
                const action = parts[1] ?? '';
                cordova.exec(
                    (res: unknown) => resolve(res as T),
                    (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
                    service,
                    action,
                    [args]
                );
            });
        }
        else if (nativeBridge) {
            result = await nativeBridge.call(method, args);
        }
        else {
            return createErrorResult(new Error('No native bridge available'));
        }
        return createSuccessResult(result);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error(`Native method failed: ${method}`));
    }
}
/**
 * Take photo from camera
 */
export async function takePhoto(): Promise<AsyncResult<NativeFileResult, Error>> {
    return callNativeMethod<NativeFileResult>('Camera.getPhoto', {
        quality: 90,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'camera'
    });
}
/**
 * Pick image from gallery
 */
export async function pickImage(): Promise<AsyncResult<NativeFileResult, Error>> {
    return callNativeMethod<NativeFileResult>('Camera.getPhoto', {
        quality: 90,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'photos'
    });
}
/**
 * Share via native share sheet
 */
export async function nativeShare(options: NativeShareOptions): Promise<AsyncResult<void, Error>> {
    return callNativeMethod<void>('Share.share', options);
}
/**
 * Haptic feedback
 */
export async function hapticFeedback(type: 'impact' | 'notification' | 'selection' = 'impact', style?: 'light' | 'medium' | 'heavy'): Promise<AsyncResult<void, Error>> {
    if (!isNativeApp()) {
        // Fallback to vibration API
        if ('vibrate' in navigator) {
            navigator.vibrate(type === 'selection' ? 10 : 20);
            return createSuccessResult(undefined);
        }
        return createErrorResult(new Error('Haptic feedback not supported'));
    }
    return callNativeMethod<void>('Haptics.impact', { style: style || 'medium' });
}
/**
 * Set status bar style
 */
export async function setStatusBarStyle(style: 'dark' | 'light' | 'default'): Promise<AsyncResult<void, Error>> {
    return callNativeMethod<void>('StatusBar.setStyle', { style });
}
/**
 * Hide splash screen
 */
export async function hideSplashScreen(): Promise<AsyncResult<void, Error>> {
    return callNativeMethod<void>('SplashScreen.hide', {});
}
/**
 * Check biometric availability
 */
export async function checkBiometric(): Promise<AsyncResult<boolean, Error>> {
    const result = await callNativeMethod<{
        isAvailable: boolean;
    }>('BiometricAuth.isAvailable', {});
    if (isSuccess(result)) {
        return createSuccessResult(result.data.isAvailable);
    }
    if (isError(result)) {
        return createErrorResult(result.error);
    }
    return createErrorResult(new Error('Unknown biometric check result'));
}
/**
 * Authenticate with biometric
 */
export async function authenticateBiometric(reason: string): Promise<AsyncResult<boolean, Error>> {
    const result = await callNativeMethod<{
        authenticated: boolean;
    }>('BiometricAuth.authenticate', { reason });
    if (isSuccess(result)) {
        return createSuccessResult(result.data.authenticated);
    }
    if (isError(result)) {
        return createErrorResult(result.error);
    }
    return createErrorResult(new Error('Unknown authentication result'));
}
/**
 * Get network status
 */
export async function getNetworkStatus(): Promise<AsyncResult<{
    connected: boolean;
    connectionType: string;
}, Error>> {
    if (!isNativeApp()) {
        const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
        return createSuccessResult({
            connected: navigator.onLine,
            connectionType: connection?.effectiveType ?? 'unknown'
        });
    }
    return callNativeMethod('Network.getStatus', {});
}
/**
 * Open app settings
 */
export async function openAppSettings(): Promise<AsyncResult<void, Error>> {
    return callNativeMethod<void>('App.openSettings', {});
}
/**
 * Keep screen awake
 */
export async function keepAwake(enable: boolean): Promise<AsyncResult<void, Error>> {
    if (!isNativeApp()) {
        // Try Wake Lock API
        try {
            if (enable) {
                if ('wakeLock' in navigator) {
                    await navigator.wakeLock.request('screen');
                }
            }
            else {
                // Release would need to be tracked
            }
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Wake lock failed'));
        }
    }
    return callNativeMethod<void>('KeepAwake.enable', { enable });
}
/**
 * Listen to native events
 */
export function onNativeEvent(event: string, callback: (data: unknown) => void): () => void {
    if (!isNativeApp()) {
        return () => { };
    }
    const handler = (e: Event): void => {
        if ('detail' in e) {
            callback((e as CustomEvent).detail);
        }
    };
    window.addEventListener(`native-${event}`, handler as EventListener);
    // Register with native bridge
    if (nativeBridge) {
        nativeBridge.addEventListener(event, handler);
    }
    return () => {
        window.removeEventListener(`native-${event}`, handler as EventListener);
        if (nativeBridge) {
            nativeBridge.removeEventListener(event, handler);
        }
    };
}
