/**
 * Java Manager Module
 *
 * Handles Java availability detection and version validation
 * for the Suwayomi service. Provides caching to avoid frequent checks.
 *
 * @module suwayomi-service/java-manager
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import { logger } from '@/utils/logger';

import {
  isDocker,
  JAVA_CHECK_INTERVAL,
  type JavaCheckResult,
  type JavaStatus,
} from './types';

// =============================================================================
// Module-level Utilities
// =============================================================================

const execAsync = promisify(exec);

/**
 * Minimum Java version required for Suwayomi
 */
const MINIMUM_JAVA_VERSION_NUMBER = 21;

// =============================================================================
// State Interface for Java Manager
// =============================================================================

/**
 * State required for Java availability tracking
 */
export interface JavaManagerState {
  /** Cached Java availability status */
  javaAvailable: boolean | null;
  /** Cached Java version string */
  javaVersion: string | null;
  /** Timestamp of last Java check */
  lastJavaCheckTime: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse Java version string from version output
 *
 * @param versionOutput - Raw output from java -version command
 * @returns Extracted version string or null if not found
 */
export function parseJavaVersion(versionOutput: string): string | null {
  const versionMatch = versionOutput.match(/version "([^"]+)"/);
  return versionMatch?.[1] ?? null;
}

/**
 * Extract major version number from version string
 * Handles both modern (21.0.1) and legacy (1.8.0) formats
 *
 * @param versionString - Java version string (e.g., '21.0.1' or '1.8.0_25')
 * @returns Major version number (e.g., 21 or 8)
 */
export function extractMajorVersion(versionString: string): number {
  const parts = versionString.split('.');
  if (parts.length === 0) {
    return 0;
  }

  let majorVersion = parseInt(parts[0] ?? '0', 10);

  // Handle old Java version format (1.8.0_25 = Java 8)
  if (majorVersion === 1 && parts.length > 1) {
    majorVersion = parseInt(parts[1] ?? '0', 10);
  }

  return majorVersion;
}

/**
 * Validate Java version meets minimum requirements
 *
 * @param versionString - Java version string to validate
 * @returns True if version meets minimum requirements
 */
export function validateJavaVersion(versionString: string): boolean {
  if (versionString === 'unknown' || versionString === 'UNKNOWN') {
    return true; // Can't validate, assume OK
  }

  const majorVersion = extractMajorVersion(versionString);
  return majorVersion >= MINIMUM_JAVA_VERSION_NUMBER;
}

/**
 * Process Java version output and determine availability
 *
 * @param output - Output from java -version command
 * @returns Java check result with availability and version
 */
export function processJavaVersionOutput(output: string): JavaCheckResult {
  if (!output.includes('version')) {
    return { available: false, version: null };
  }

  const versionString = parseJavaVersion(output) ?? 'UNKNOWN';
  const isValid = validateJavaVersion(versionString);

  if (!isValid) {
    logger.warn(
      `Java version ${versionString} is installed, but Suwayomi requires Java ${MINIMUM_JAVA_VERSION_NUMBER} or higher.`
    );
  } else {
    logger.info(`Java is installed: ${versionString}`);
  }

  return { available: isValid, version: versionString };
}

/**
 * Check if cached Java status is still valid
 *
 * @param state - Current Java manager state
 * @returns True if cache is valid and can be used
 */
export function isCacheValid(state: JavaManagerState): boolean {
  if (state.javaAvailable === null) {
    return false;
  }

  const now = Date.now();
  return now - state.lastJavaCheckTime < JAVA_CHECK_INTERVAL;
}

/**
 * Get cached Java status if available
 *
 * @param state - Current Java manager state
 * @returns Cached result or null if cache is invalid
 */
export function getCachedStatus(state: JavaManagerState): JavaCheckResult | null {
  if (!isCacheValid(state)) {
    return null;
  }

  return {
    available: state.javaAvailable ?? false,
    version: state.javaVersion,
  };
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Check Java availability using utils check
 *
 * @returns Java check result from utils
 */
async function checkWithUtils(): Promise<JavaCheckResult | null> {
  try {
    const { checkJavaInstalled } = await import('../utils');
    const isAvailable = await checkJavaInstalled();

    if (isAvailable) {
      return { available: true, version: '21+' };
    }
  } catch {
    // Utils check failed, continue with direct check
  }

  return null;
}

/**
 * Check Java availability using direct command execution
 *
 * @returns Java check result from command
 */
async function checkWithCommand(): Promise<JavaCheckResult> {
  try {
    const { stdout, stderr } = await execAsync('java -version');

    // Java outputs version info to stderr
    if (stderr.includes('version')) {
      return processJavaVersionOutput(stderr);
    }

    // Some implementations output to stdout
    if (stdout.includes('version')) {
      return processJavaVersionOutput(stdout);
    }

    logger.warn('Java version check did not return expected output');
    return { available: false, version: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error checking Java: ${errorMessage}`);
    return { available: false, version: null };
  }
}

/**
 * Result of Java availability check including updated state
 */
export interface JavaCheckResultWithState {
  /** The check result */
  result: JavaCheckResult;
  /** Updated state values */
  updatedState: Partial<JavaManagerState>;
}

/**
 * Check if Java is available and meets version requirements
 *
 * Performs a comprehensive Java availability check:
 * 1. Returns cached result if still valid
 * 2. Assumes available in Docker environments
 * 3. Uses utility function for enhanced detection
 * 4. Falls back to direct java -version command
 *
 * Results are cached for 5 minutes to avoid frequent checks.
 *
 * @param state - Current Java manager state (read-only)
 * @returns Java availability, version information, and state updates to apply
 */
export async function checkJavaAvailability(
  state: JavaManagerState
): Promise<JavaCheckResultWithState> {
  // Skip check in Docker environment
  if (isDocker) {
    const result = { available: true, version: 'Docker' };
    return {
      result,
      updatedState: {
        javaAvailable: true,
        javaVersion: 'Docker',
      },
    };
  }

  // Check cache validity
  const cachedStatus = getCachedStatus(state);
  if (cachedStatus) {
    return {
      result: cachedStatus,
      updatedState: {},
    };
  }

  // Update check timestamp
  const newCheckTime = Date.now();

  // Try utils check first
  const utilsResult = await checkWithUtils();
  if (utilsResult) {
    return {
      result: utilsResult,
      updatedState: {
        javaAvailable: utilsResult.available,
        javaVersion: utilsResult.version,
        lastJavaCheckTime: newCheckTime,
      },
    };
  }

  // Fall back to direct command check
  const commandResult = await checkWithCommand();
  return {
    result: commandResult,
    updatedState: {
      javaAvailable: commandResult.available,
      javaVersion: commandResult.version,
      lastJavaCheckTime: newCheckTime,
    },
  };
}

/**
 * Get detailed Java installation status
 *
 * Returns comprehensive information about the Java installation including:
 * - Availability status
 * - Installed version
 * - Version requirements
 * - Installation instructions
 *
 * @param checkFn - Function to check Java availability
 * @returns Detailed Java status information
 *
 * @example
 * const status = await getJavaStatus(checkFn);
 * if (!status.available) {
 *   console.log(`Java ${status.minimumVersion}+ required. ${status.installInstructions}`);
 * }
 */
export async function getJavaStatus(
  checkFn: () => Promise<JavaCheckResult>
): Promise<JavaStatus> {
  const status = await checkFn();

  return {
    available: status.available,
    version: status.version,
    required: true,
    minimumVersion: '21',
    installInstructions:
      'Run the Java installation script or install Java 21+ manually',
  };
}

/**
 * Create initial Java manager state
 *
 * @returns Fresh state object for Java manager
 */
export function createJavaManagerState(): JavaManagerState {
  return {
    javaAvailable: null,
    javaVersion: null,
    lastJavaCheckTime: 0,
  };
}
