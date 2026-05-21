/**
 * Utility functions for Suwayomi server management
 *
 * This module provides helper functions for checking system requirements
 * and managing Suwayomi server dependencies.
 *
 * @module suwayomi/utils
 */
import { exec } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

import { logger } from '@/utils/logger';
const execAsync = promisify(exec);
/**
 * Parse Java version string to extract major version number
 *
 * @param {string} versionString - Raw Java version string
 * @returns {number} Major version number
 */
function parseJavaVersion(versionString: string): number {
    const parts = versionString.split('.');
    if (parts.length > 0) {
        let majorVersion = parseInt(parts[0] ?? '0', 10);
        // Handle old Java version format (1.8.0_25 = Java 8)
        if (majorVersion === 1 && parts.length > 1) {
            majorVersion = parseInt(parts[1] ?? '0', 10);
        }
        return majorVersion;
    }
    return 0;
}
/**
 * Check Java version from a specific path
 *
 * @param {string} javaPath - Path to Java executable
 * @returns {Promise<number>} Major version number, or 0 if check fails
 */
async function checkJavaAtPath(javaPath: string): Promise<number> {
    try {
        const { stdout, stderr } = await execAsync(`${javaPath} -version`);
        const output = stderr || stdout;
        if (output.includes('version')) {
            const versionMatch = output.match(/version "([^"]+)"/);
            const versionString = versionMatch?.[1] ? versionMatch[1] : 'UNKNOWN';
            if (versionString !== 'unknown') {
                const majorVersion = parseJavaVersion(versionString);
                logger.debug(`Java ${versionString} found at ${javaPath} (major version: ${majorVersion})`);
                return majorVersion;
            }
        }
    }
    catch (_error: unknown) {
        // Silently fail if Java is not found at this path
        logger.debug(`Java not found at ${javaPath}`);
    }
    return 0;
}
/**
 * Check if Java is installed and available on the system
 *
 * Executes 'java -version' command to verify Java installation.
 * Java typically outputs version information to stderr rather than stdout,
 * so both outputs are checked. Also verifies that Java version is 21 or higher.
 *
 * This function checks multiple locations:
 * 1. Java in PATH
 * 2. Homebrew Java installations (macOS)
 * 3. Common system locations
 *
 * @returns {Promise<boolean>} True if Java 21+ is installed and accessible, false otherwise
 * @throws {Error} Logs error if command execution fails
 *
 * @example
 * const isJavaInstalled = await checkJavaInstalled();
 * if (!isJavaInstalled) {
 *   logger.info('Please install Java 21 or higher to use Suwayomi');
 * }
 */
// Cache for Java check results
let cachedJavaStatus: boolean | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache
export async function checkJavaInstalled(): Promise<boolean> {
    const now = Date.now();
    // Return cached result if still valid
    if (cachedJavaStatus !== null && (now - lastCheckTime) < CACHE_DURATION) {
        return cachedJavaStatus;
    }
    // Silent check - no logging unless there's an issue
    // First check macOS Homebrew locations for Java 21
    const brewPaths = [
        '/usr/local/opt/openjdk@21/bin/java',
        '/opt/homebrew/opt/openjdk@21/bin/java'
    ];
    // Check brew paths sequentially (early return if found)
    for (const javaPath of brewPaths) {
        if (fs.existsSync(javaPath)) {
            // eslint-disable-next-line no-await-in-loop
            const majorVersion = await checkJavaAtPath(javaPath);
            if (majorVersion >= 21) {
                logger.debug(`Using Java 21 from Homebrew at ${javaPath}`);
                cachedJavaStatus = true;
                lastCheckTime = now;
                return true;
            }
        }
    }
    // Then check Java in PATH
    try {
        const { stdout, stderr } = await execAsync('java -version');
        // Java outputs version info to stderr
        const output = stderr || stdout;
        if (output.includes('version')) {
            const versionMatch = output.match(/version "([^"]+)"/);
            const versionString = versionMatch?.[1] ? versionMatch[1] : 'UNKNOWN';
            // Check if version is sufficient (Java 21+)
            if (versionString !== 'unknown') {
                const majorVersion = parseJavaVersion(versionString);
                if (majorVersion < 21) {
                    logger.debug(`Java version ${versionString} is installed, but Suwayomi requires Java 21 or higher.`);
                    // Continue checking other locations
                }
                else {
                    logger.debug(`Java ${versionString} is installed (major version: ${majorVersion})`);
                    cachedJavaStatus = true;
                    lastCheckTime = now;
                    return true;
                }
            }
        }
    }
    catch (_error: unknown) {
        logger.debug('Java not found in PATH, checking alternative locations...');
    }
    // Check other common Java locations
    const commonPaths = [
        '/usr/bin/java',
        '/usr/local/bin/java',
        '/opt/java/bin/java',
        '/usr/lib/jvm/default/bin/java',
        '/usr/lib/jvm/java-21-openjdk/bin/java',
        '/usr/lib/jvm/java-21-openjdk-amd64/bin/java'
    ];
    // Check common paths sequentially (early return if found)
    for (const javaPath of commonPaths) {
        if (fs.existsSync(javaPath)) {
            // eslint-disable-next-line no-await-in-loop
            const majorVersion = await checkJavaAtPath(javaPath);
            if (majorVersion >= 21) {
                cachedJavaStatus = true;
                lastCheckTime = now;
                return true;
            }
        }
    }
    logger.debug('Java 21 or higher is not installed or not found in common locations');
    cachedJavaStatus = false;
    lastCheckTime = now;
    return false;
}
