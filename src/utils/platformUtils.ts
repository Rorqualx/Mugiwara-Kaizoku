import { getErrorMessage } from '@/utils/errors/helpers';

import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

import type { DirectoryPickerOptions, FileSystemDirectoryHandle } from '../types/file-system-access';

/**
 * Platform Utilities Module
 *
 * Provides utilities for platform detection and browser capability checking.
 * Helps with cross-platform compatibility and feature detection.
 *
 * Features:
 * - Platform and browser detection
 * - File System Access API support checking
 * - Cross-platform directory picker implementation
 *
 * @module utils/platformUtils
 */
/**
 * Platform information interface
 * Contains details about the current platform and browser
 */
export interface PlatformInfo {
  /** Operating system (Windows, MacOS, Linux, Android, iOS, etc.) */
  platform: string;
  /** Browser name (Chrome, Firefox, Safari, Edge, etc.) */
  browser: string;
  /** Whether the device is a mobile device */
  mobile: boolean;
}
/**
 * Detect platform and browser information
 * Helps with debugging and platform-specific behavior
 *
 * @returns {PlatformInfo} Object containing platform, browser, and mobile status
 */
export const detectPlatform = (): PlatformInfo => {
  if (typeof window === 'undefined') {
    return { platform: 'unknown', browser: 'unknown', mobile: false };
  }
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  // Detect platform
  let detectedPlatform = 'unknown';
  if (/Win/.test(platform))
  detectedPlatform = 'Windows';else
  if (/Mac/.test(platform))
  detectedPlatform = 'MacOS';else
  if (/Linux/.test(platform))
  detectedPlatform = 'Linux';else
  if (/Android/.test(userAgent))
  detectedPlatform = 'Android';else
  if (/iPhone|iPad|iPod/.test(userAgent))
  detectedPlatform = 'iOS';
  // Detect browser
  let browser = 'unknown';
  if (/Chrome/.test(userAgent) && !/Chromium|Edge/.test(userAgent))
  browser = 'Chrome';else
  if (/Firefox/.test(userAgent))
  browser = 'Firefox';else
  if (/Safari/.test(userAgent) && !/Chrome|Chromium|Edge/.test(userAgent))
  browser = 'Safari';else
  if (/Edge/.test(userAgent))
  browser = 'Edge';else
  if (/Opera|OPR/.test(userAgent))
  browser = 'Opera';
  // Detect if mobile
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  return { platform: detectedPlatform, browser, mobile };
};
/**
 * Comprehensive check for File System Access API support
 * Handles different browser implementations and platform variations
 *
 * @returns {boolean} Whether the File System Access API is supported
 */
export const checkFileSystemApiSupport = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined')
  return false;
  try {
    // Check for native support (Chrome, Edge, etc.)
    if (typeof window.showDirectoryPicker === 'function') {
      logger.info('Native File System Access API detected');
      return true;
    }
    // Check for webkit prefixed version (Safari)
    if (typeof window.webkitShowDirectoryPicker === 'function') {
      logger.info('Webkit File System Access API detected');
      return true;
    }
    // Check for Mozilla implementation (Firefox)
    if (typeof window.mozShowDirectoryPicker === 'function') {
      logger.info('Mozilla File System Access API detected');
      return true;
    }
    logger.info('File System Access API not detected');
    return false;
  }
  catch (e: unknown) {
    const errorMessage = getErrorMessage(e);
    logger.warn('Error checking File System API support:', errorMessage);
    return false;
  }
};
/**
 * Cross-platform directory selection
 * Handles different API implementations based on platform
 *
 * @param {DirectoryPickerOptions} options - Directory picker options
 * @returns {Promise<FileSystemDirectoryHandle>} Directory handle
 * @throws {Error} If no compatible directory picker API is found
 */
export const showDirectoryPicker = async (options: DirectoryPickerOptions = { mode: 'readwrite' }): Promise<FileSystemDirectoryHandle> => {
  const { platform, browser, mobile } = detectPlatform();
  logger.info(`Attempting to show directory picker on ${platform} using ${browser} (mobile: ${mobile})`);
  try {
    // Standard implementation (Chrome, Edge)
    if (typeof window.showDirectoryPicker === 'function') {
      logger.info('Using standard showDirectoryPicker');
      return await window.showDirectoryPicker(options);
    }
    // Webkit implementation (Safari)
    if (typeof window.webkitShowDirectoryPicker === 'function') {
      logger.info('Using webkit showDirectoryPicker');
      return await window.webkitShowDirectoryPicker(options);
    }
    // Mozilla implementation (Firefox)
    if (typeof window.mozShowDirectoryPicker === 'function') {
      logger.info('Using Mozilla showDirectoryPicker');
      return await window.mozShowDirectoryPicker(options);
    }
    throw new ValidationError('No compatible directory picker API found');
  }
  catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logger.error('Error showing directory picker:', errorMessage);
    throw new Error(errorMessage);
  }
};
/**
 * Get platform-specific path placeholder
 * Returns a placeholder string with an example path for the current platform
 *
 * @param {PlatformInfo} platformInfo - Platform information
 * @returns {string} Platform-specific path placeholder
 */
export const getPathPlaceholder = (platformInfo: PlatformInfo): string => {
  const { platform } = platformInfo;
  if (platform === 'Windows')
  return "Enter a directory path (e.g., C:\\Users\\username\\Manga)";
  if (platform === 'MacOS')
  return "Enter a directory path (e.g., /Users/username/Documents/Manga)";
  if (platform === 'Linux')
  return "Enter a directory path (e.g., /home/username/manga)";
  if (platform === 'Android')
  return "Enter a directory path (e.g., /sdcard/Download/manga)";
  return "Enter an absolute path to a directory";
};
/**
 * Get platform-specific help text
 * Returns help text with an example path for the current platform
 *
 * @param {PlatformInfo} platformInfo - Platform information
 * @returns {string} Platform-specific help text
 */
export const getPathHelpText = (platformInfo: PlatformInfo): string => {
  const { platform } = platformInfo;
  if (platform === 'Windows')
  return "Enter a Windows path (e.g., C:\\Users\\username\\Manga)";
  if (platform === 'MacOS')
  return "Enter a macOS path (e.g., /Users/username/Documents/Manga)";
  if (platform === 'Linux')
  return "Enter a Linux path (e.g., /home/username/manga)";
  if (platform === 'Android')
  return "Enter an Android path (e.g., /sdcard/Download/manga)";
  return "Enter an absolute path to a directory";
};