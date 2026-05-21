/**
 * Download Client Selection
 *
 * Handles round-robin selection of download clients with automatic failover.
 */

import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';

import { getAllEnabledClients } from './validation';

import type { ClientResult, SendToClientOptions } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Client selection state for round-robin load balancing
 */
export interface ClientSelectionState {
    torrentClientIndex: number;
    usenetClientIndex: number;
}

/**
 * Create initial client selection state
 */
export function createClientSelectionState(): ClientSelectionState {
    return {
        torrentClientIndex: 0,
        usenetClientIndex: 0
    };
}

/**
 * Selects the appropriate download client based on protocol with round-robin load balancing
 *
 * FIX: Replaced non-null assertions with proper array access checks
 */
export async function selectDownloadClient(
    prismaClient: PrismaClient,
    protocol: string,
    state: ClientSelectionState
): Promise<string> {
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
        const enabledTorrentClients: string[] = [];
        if (configMap.get('transmission') === true) enabledTorrentClients.push('transmission');
        if (configMap.get('deluge') === true) enabledTorrentClients.push('deluge');

        if (enabledTorrentClients.length === 0) {
            throw new Error('No torrent client enabled. Enable Transmission or Deluge in Settings > Download Clients.');
        }

        const index = state.torrentClientIndex % enabledTorrentClients.length;
        const selectedClient = enabledTorrentClients[index];
        if (!selectedClient) {
            throw new Error('Failed to select torrent client');
        }
        state.torrentClientIndex++;

        logger.info(`Selected ${selectedClient} for torrent download (${(state.torrentClientIndex % enabledTorrentClients.length) + 1}/${enabledTorrentClients.length})`);
        return selectedClient;
    }

    if (protocol === 'usenet') {
        const enabledUsenetClients: string[] = [];
        if (configMap.get('nzbget') === true) enabledUsenetClients.push('nzbget');
        if (configMap.get('sabnzbd') === true) enabledUsenetClients.push('sabnzbd');

        if (enabledUsenetClients.length === 0) {
            throw new Error('No usenet client enabled. Enable NZBGet or SABnzbd in Settings > Download Clients.');
        }

        const index = state.usenetClientIndex % enabledUsenetClients.length;
        const selectedClient = enabledUsenetClients[index];
        if (!selectedClient) {
            throw new Error('Failed to select usenet client');
        }
        state.usenetClientIndex++;

        logger.info(`Selected ${selectedClient} for usenet download (${(state.usenetClientIndex % enabledUsenetClients.length) + 1}/${enabledUsenetClients.length})`);
        return selectedClient;
    }

    // Default to torrent if protocol is unknown
    logger.warn(`Unknown protocol '${protocol}', defaulting to torrent client`);

    const enabledTorrentClients: string[] = [];
    if (configMap.get('transmission') === true) enabledTorrentClients.push('transmission');
    if (configMap.get('deluge') === true) enabledTorrentClients.push('deluge');

    if (enabledTorrentClients.length === 0) {
        throw new Error(`Unsupported protocol: ${protocol}. No suitable download client found.`);
    }

    const index = state.torrentClientIndex % enabledTorrentClients.length;
    const selectedClient = enabledTorrentClients[index];
    if (!selectedClient) {
        throw new Error('Failed to select torrent client');
    }
    state.torrentClientIndex++;
    return selectedClient;
}

/**
 * Sends download to client with automatic failover to other enabled clients
 */
export async function sendToClientWithFailover(
    prismaClient: PrismaClient,
    clientService: ClientDownloadService,
    protocol: string,
    url: string,
    options?: SendToClientOptions
): Promise<AsyncResult<ClientResult, Error>> {
    const enabledClients = await getAllEnabledClients(prismaClient, protocol);

    if (enabledClients.length === 0) {
        return createErrorResult(new Error(`No ${protocol} clients enabled`));
    }

    const errors: string[] = [];

    // Sequential execution is intentional - this is a failover pattern where we try
    // each client in order until one succeeds. Parallel execution would cause duplicate downloads.
    for (const clientType of enabledClients) {
        logger.info(`Attempting download with ${clientType} (${enabledClients.indexOf(clientType) + 1}/${enabledClients.length})`);

        // eslint-disable-next-line no-await-in-loop -- Intentional sequential failover
        const result = await clientService.sendToClient(clientType, url, options);

        if (isSuccess(result)) {
            logger.info(`Successfully sent download to ${clientType}`);
            return createSuccessResult({
                downloadId: result.data.downloadId,
                clientType
            });
        }

        if (isError(result)) {
            const errorMsg = result.error.message;
            errors.push(`${clientType}: ${errorMsg}`);
            logger.warn(`Failed to send to ${clientType}: ${errorMsg}`);

            if (enabledClients.indexOf(clientType) < enabledClients.length - 1) {
                logger.info(`Trying next available ${protocol} client...`);
                continue;
            }
        }
    }

    const allErrors = errors.join('; ');
    return createErrorResult(new Error(`All ${protocol} clients failed. Errors: ${allErrors}`));
}
