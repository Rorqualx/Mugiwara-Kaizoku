/**
 * Download Request Validation
 *
 * Validates download requests before processing.
 * Checks for required fields, client availability, and protocol support.
 */



import { DownloadMethod } from '@prisma/client';

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { extractDownloadUrl, detectProtocol } from './utils';

import type { DownloadPayload } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Get all enabled download clients for a protocol
 *
 * @param prismaClient - Prisma client instance
 * @param protocol - Protocol type ('torrent' or 'usenet')
 * @returns Array of enabled client names
 */
export async function getAllEnabledClients(
    prismaClient: PrismaClient,
    protocol: string
): Promise<string[]> {
    const configEntries = await prismaClient.config.findMany({
        where: {
            key: {
                in: [
                    'download.transmission.enabled',
                    'download.deluge.enabled',
                    'download.nzbget.enabled',
                    'download.sabnzbd.enabled'
                ]
            }
        }
    });

    const configMap = new Map<string, boolean>();
    for (const entry of configEntries) {
        const clientName = entry.key.replace('download.', '').replace('.enabled', '');
        configMap.set(clientName, entry.value.toLowerCase() === 'true');
    }

    if (protocol === 'torrent') {
        const enabledClients: string[] = [];
        if (configMap.get('transmission') === true) enabledClients.push('transmission');
        if (configMap.get('deluge') === true) enabledClients.push('deluge');
        return enabledClients;
    }

    if (protocol === 'usenet') {
        const enabledClients: string[] = [];
        if (configMap.get('nzbget') === true) enabledClients.push('nzbget');
        if (configMap.get('sabnzbd') === true) enabledClients.push('sabnzbd');
        return enabledClients;
    }

    return [];
}

/**
 * Validates a download request before async processing
 *
 * Performs quick checks to catch obvious failures early:
 * - Prowlarr downloads: Check for downloadUrl
 * - All downloads: Verify at least one client is enabled
 *
 * @param prismaClient - Prisma client instance
 * @param payload - Download payload to validate
 * @returns AsyncResult indicating if validation passed
 */
export async function validateDownloadRequest(
    prismaClient: PrismaClient,
    payload: DownloadPayload
): Promise<AsyncResult<void, Error>> {
    try {
        if (payload.method === DownloadMethod.PROWLARR) {
            if (!payload.prowlarrResult) {
                return createErrorResult(new Error('Missing Prowlarr search result data'));
            }

            const prowlarrResult = payload.prowlarrResult as Record<string, unknown>;
            const downloadUrl = extractDownloadUrl(prowlarrResult);

            if (!downloadUrl) {
                logger.error('Missing download URL in Prowlarr result', { prowlarrResult });
                return createErrorResult(new Error('Selected release has no download URL. This indexer may be misconfigured in Prowlarr.'));
            }

            const protocol = typeof prowlarrResult['protocol'] === 'string'
                ? prowlarrResult['protocol'].toLowerCase()
                : 'torrent';

            const enabledClients = await getAllEnabledClients(prismaClient, protocol);
            if (enabledClients.length === 0) {
                return createErrorResult(new Error(
                    `No ${protocol} download clients are enabled. ` +
                    `Please enable at least one ${protocol} client in Settings -> Download Clients.`
                ));
            }

            logger.debug(`Validation passed: ${enabledClients.length} ${protocol} client(s) available`);
        } else if (payload.method === DownloadMethod.DIRECT_URL) {
            if (!payload.directUrl) {
                return createErrorResult(new Error('Missing direct download URL'));
            }

            const protocol = detectProtocol(payload.directUrl);
            const enabledClients = await getAllEnabledClients(prismaClient, protocol);

            if (enabledClients.length === 0) {
                return createErrorResult(new Error(
                    `No ${protocol} download clients are enabled. ` +
                    `Please enable at least one ${protocol} client in Settings -> Download Clients.`
                ));
            }

            logger.debug(`Validation passed: ${enabledClients.length} ${protocol} client(s) available`);
        } else if (payload.method === DownloadMethod.GETCOMICS) {
            // GetComics downloads use DDL links - no download client needed
            // Just validate that we have a GetComics URL
            if (!payload.getcomicsUrl) {
                return createErrorResult(new Error('Missing GetComics detail page URL'));
            }

            logger.debug('Validation passed: GetComics DDL download');
        }

        return createSuccessResult(undefined);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Download request validation failed';
        return createErrorResult(new Error(errorMessage));
    }
}
