/**
 * Suwayomi Server Installer Module
 *
 * Handles downloading and installing the Suwayomi-Server
 * JAR file from GitHub releases.
 *
 * @module suwayomi-service/installer
 */

import * as fs from 'fs';
import * as path from 'path';

import axios from 'axios';

import { logger } from '@/utils/logger';

import type { GitHubAsset, GitHubReleaseResponse } from './types';
import type { AxiosResponse } from 'axios';

// =============================================================================
// Types
// =============================================================================

/**
 * Interface for security service checksum verification
 */
interface SecurityService {
    verifyJarChecksum: (jarPath: string, version: string) => Promise<boolean>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find JAR asset in GitHub release assets
 *
 * Filters out source and javadoc JARs to find the main executable.
 *
 * @param assets - Array of GitHub release assets
 * @returns The JAR asset or undefined if not found
 */
function findJarAsset(assets: GitHubAsset[]): GitHubAsset | undefined {
    return assets.find(
        (asset) =>
            asset.name.endsWith('.jar') &&
            !asset.name.includes('sources') &&
            !asset.name.includes('javadoc')
    );
}

/**
 * Download JAR file from URL to local path
 *
 * Uses streaming to efficiently download large files.
 *
 * @param url - Download URL for the JAR file
 * @param targetPath - Local file path to save the JAR
 * @throws Error if download or write fails
 */
async function downloadJarFile(url: string, targetPath: string): Promise<void> {
    const response: AxiosResponse<NodeJS.ReadableStream> = await axios({
        method: 'get',
        url,
        responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(targetPath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            resolve();
        });
        writer.on('error', (err) => {
            reject(new Error(`Failed to write JAR file: ${err.message}`));
        });
    });
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Download Suwayomi-Server JAR if not already present
 *
 * Downloads the latest release from GitHub and verifies its checksum
 * using the provided security service.
 *
 * @example
 * ```typescript
 * import { downloadServerIfNeeded } from './installer';
 * import { suwayomiSecurityService } from '../security.service';
 *
 * const success = await downloadServerIfNeeded(
 *   '/path/to/server',
 *   suwayomiSecurityService
 * );
 * ```
 *
 * @param serverPath - Directory path where the JAR should be stored
 * @param securityService - Service for checksum verification
 * @returns True if download successful or already exists, false on failure
 */
export async function downloadServerIfNeeded(
    serverPath: string,
    securityService: SecurityService
): Promise<boolean> {
    const jarPath = path.join(serverPath, 'Suwayomi-Server.jar');

    // Check if already downloaded
    if (fs.existsSync(jarPath)) {
        logger.info('Suwayomi-Server already downloaded');
        return true;
    }

    logger.info('Downloading Suwayomi-Server...');

    try {
        // Get the latest release info from GitHub API
        const releaseResponse: AxiosResponse<GitHubReleaseResponse> = await axios.get(
            'https://api.github.com/repos/Suwayomi/Suwayomi-Server/releases/latest'
        );

        const jarAsset = findJarAsset(releaseResponse.data.assets);
        if (!jarAsset) {
            logger.error('Could not find JAR file in the latest release');
            return false;
        }

        // Download the JAR file
        await downloadJarFile(jarAsset.browser_download_url, jarPath);

        // Verify checksum
        const version = releaseResponse.data.tag_name;
        const isValid = await securityService.verifyJarChecksum(jarPath, version);

        if (!isValid) {
            logger.error('JAR checksum verification failed');
            fs.unlinkSync(jarPath); // Remove potentially compromised file
            return false;
        }

        logger.info('Suwayomi-Server downloaded successfully');
        return true;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error downloading Suwayomi-Server: ' + errorMessage);
        return false;
    }
}
