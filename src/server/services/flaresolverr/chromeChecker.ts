/**
 * Chrome/Chromium Dependency Checker
 *
 * Detects installed Chrome or Chromium browsers that flaresolverr-go
 * requires for Cloudflare bypass functionality.
 *
 * @module flaresolverr/chromeChecker
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

import { logger } from '@/utils/logger';

// =============================================================================
// Types
// =============================================================================

/** Chrome installation information */
export interface ChromeInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
  browser: 'chrome' | 'chromium' | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Common Chrome paths on macOS */
const MACOS_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  `${os.homedir()}/Applications/Chromium.app/Contents/MacOS/Chromium`,
];

/** Common Chrome paths on Linux */
const LINUX_CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/local/bin/google-chrome',
  '/usr/local/bin/chromium',
];

// =============================================================================
// Path Detection
// =============================================================================

/**
 * Check if a file exists and is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Chrome paths based on platform
 */
function getChromePaths(): string[] {
  const platform = os.platform();

  if (platform === 'darwin') {
    return MACOS_CHROME_PATHS;
  } else if (platform === 'linux') {
    return LINUX_CHROME_PATHS;
  }

  return [];
}

/**
 * Find Chrome/Chromium executable path
 * @returns Path to Chrome executable or null if not found
 */
export function findChromePath(): string | null {
  const paths = getChromePaths();

  for (const chromePath of paths) {
    if (isExecutable(chromePath)) {
      logger.debug('[ChromeChecker] Found Chrome at', { path: chromePath });
      return chromePath;
    }
  }

  // Try using 'which' command as fallback
  const whichResult = spawnSync(
    'which',
    ['google-chrome', 'chromium', 'chromium-browser'],
    { encoding: 'utf-8', timeout: 5000 }
  );
  if (whichResult.status === 0 && typeof whichResult.stdout === 'string') {
    const firstPath = whichResult.stdout.trim().split('\n')[0];
    if (firstPath && isExecutable(firstPath)) {
      logger.debug('[ChromeChecker] Found Chrome via which', { path: firstPath });
      return firstPath;
    }
  }

  logger.warn('[ChromeChecker] Chrome/Chromium not found');
  return null;
}

/**
 * Quick check if Chromium or Chrome is installed
 * @returns True if Chrome or Chromium is available
 */
export function isChromiumInstalled(): boolean {
  return findChromePath() !== null;
}

// =============================================================================
// Version Detection
// =============================================================================

/**
 * Get Chrome version from executable
 */
function getChromeVersion(chromePath: string): string | null {
  // Use longer timeout (15s) as Chrome can be slow on first launch
  const result = spawnSync(chromePath, ['--version'], {
    encoding: 'utf-8',
    timeout: 15000,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') {
    return null;
  }
  // Parse version from output like "Google Chrome 120.0.6099.129" or "Chromium 120.0.6099.129"
  const versionMatch = result.stdout.trim().match(/(\d+\.\d+\.\d+\.\d+)/);
  return versionMatch?.[1] ?? null;
}

/**
 * Determine browser type from path
 */
function getBrowserType(chromePath: string): 'chrome' | 'chromium' | null {
  const lowerPath = chromePath.toLowerCase();

  if (lowerPath.includes('chromium')) {
    return 'chromium';
  } else if (lowerPath.includes('chrome')) {
    return 'chrome';
  }

  return null;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Get comprehensive Chrome installation information
 * @returns Chrome status information
 */
export function getChromeInfo(): ChromeInfo {
  const chromePath = findChromePath();

  if (!chromePath) {
    return {
      installed: false,
      path: null,
      version: null,
      browser: null,
    };
  }

  const version = getChromeVersion(chromePath);
  const browser = getBrowserType(chromePath);

  logger.info('[ChromeChecker] Chrome detected', {
    path: chromePath,
    version,
    browser,
  });

  return {
    installed: true,
    path: chromePath,
    version,
    browser,
  };
}

/**
 * Verify Chrome can be launched (basic sanity check)
 * @returns True if Chrome launches successfully
 */
export function verifyChromeWorks(): boolean {
  const chromePath = findChromePath();

  if (!chromePath) {
    return false;
  }

  // Try to get version - if this works, Chrome is functional
  // Use longer timeout (30s) as Chrome can be slow on first launch
  const result = spawnSync(chromePath, ['--version'], {
    timeout: 30000,
    stdio: 'ignore',
  });
  if (result.status === 0) {
    return true;
  }
  logger.warn('[ChromeChecker] Chrome verification failed');
  return false;
}
