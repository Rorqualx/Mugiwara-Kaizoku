/**
 * Seed Events
 *
 * Creates initial system events for a new installation.
 * This module populates the events database with sample events
 * to demonstrate the events system functionality.
 *
 * @module server/services/events/seedEvents
 */
import { logger } from '@/utils/logger';

import { eventService } from './eventService';
import { EventType, EventSource, EventLevel } from './eventTypes';
/**
 * Database event types - these should be added to the EventType enum
 */
enum DatabaseEventType {
    CONNECTED = 'database.connected',
    DISCONNECTED = 'database.disconnected',
    ERROR = 'database.error',
    MIGRATION = 'database.migration'
}
/**
 * Creates a set of sample events
 *
 * @returns {Promise<void>}
 */
export async function seedEvents(): Promise<void> {
    logger.info('Seeding events database with sample events...');
    try {
        // System events
        await eventService.createEvent(EventType.SYSTEM_STARTUP, EventSource.SYSTEM, EventLevel.INFO, 'Application started', {
            details: {
                version: process.env["APP_VERSION"] ?? '1.0.0',
                nodeEnv: process.env.NODE_ENV,
                platform: process.platform
            }
        });
        // Database events
        await eventService.createEvent(DatabaseEventType.CONNECTED as unknown as EventType, EventSource.DATABASE, EventLevel.INFO, 'Connected to database', {
            details: {
                provider: 'postgresql',
                connection: 'OK'
            }
        });
        // Library events
        await eventService.createEvent(EventType.LIBRARY_SCAN_STARTED, EventSource.LIBRARY, EventLevel.INFO, 'Library scan started: Manga Collection', {
            details: {
                libraryName: 'Manga Collection',
                path: '/data/manga'
            },
            relatedEntityId: '1',
            relatedEntityType: 'library'
        });
        await eventService.createEvent(EventType.LIBRARY_SCAN_COMPLETED, EventSource.LIBRARY, EventLevel.INFO, 'Library scan completed: Manga Collection', {
            details: {
                libraryName: 'Manga Collection',
                itemsFound: 156,
                newItems: 5
            },
            relatedEntityId: '1',
            relatedEntityType: 'library'
        });
        // Manga events
        await eventService.createEvent(EventType.MANGA_ADDED, EventSource.MANGA, EventLevel.INFO, 'New manga added: One Piece', {
            details: {
                mangaTitle: 'One Piece',
                source: 'AniList'
            },
            relatedEntityId: '42',
            relatedEntityType: 'manga'
        });
        await eventService.createEvent(EventType.MANGA_METADATA_UPDATED, EventSource.MANGA, EventLevel.INFO, 'Metadata updated: Naruto', {
            details: {
                mangaTitle: 'Naruto',
                provider: 'AniList'
            },
            relatedEntityId: '101',
            relatedEntityType: 'manga'
        });
        // Download events
        await eventService.createEvent(EventType.DOWNLOAD_STARTED, EventSource.DOWNLOAD, EventLevel.INFO, 'Download started: Naruto - Chapter 700', {
            details: {
                mangaTitle: 'Naruto',
                chapterTitle: 'Chapter 700',
                source: 'Fandom'
            },
            relatedEntityId: '123',
            relatedEntityType: 'chapter'
        });
        await eventService.createEvent(EventType.DOWNLOAD_COMPLETED, EventSource.DOWNLOAD, EventLevel.INFO, 'Download completed: Naruto - Chapter 700', {
            details: {
                mangaTitle: 'Naruto',
                chapterTitle: 'Chapter 700',
                fileSize: '15.2 MB',
                pages: 45
            },
            relatedEntityId: '123',
            relatedEntityType: 'chapter'
        });
        await eventService.createEvent(EventType.DOWNLOAD_ERROR, EventSource.DOWNLOAD, EventLevel.ERROR, 'Failed to download chapter: Network error', {
            details: {
                mangaTitle: 'Naruto',
                chapterTitle: 'Chapter 701',
                error: 'Network request failed: ETIMEDOUT - Connection timed out after 30000ms',
                stack: 'Error: Network request failed\n    at Downloader.download (/app/src/services/download.ts:45)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)'
            },
            relatedEntityId: '124',
            relatedEntityType: 'chapter'
        });
        // Integration events
        await eventService.createEvent(EventType.INTEGRATION_ERROR, EventSource.COMICVINE, EventLevel.ERROR, 'Failed to connect to ComicVine API', {
            details: {
                error: 'Request failed with status code 503 - Service Unavailable',
                url: 'https://comicvine.gamespot.com/api'
            }
        });
        await eventService.createEvent(EventType.INTEGRATION_CONNECTED, EventSource.ANILIST, EventLevel.INFO, 'Connected to AniList', {
            details: {
                status: 'connected'
            }
        });
        // Task events
        await eventService.createEvent(EventType.TASK_STARTED, EventSource.TASK, EventLevel.INFO, 'Scheduled task started: Library scan', {
            details: {
                jobType: 'library.scan',
                scheduled: true
            },
            relatedEntityId: '5',
            relatedEntityType: 'task'
        });
        await eventService.createEvent(EventType.TASK_COMPLETED, EventSource.TASK, EventLevel.INFO, 'Task completed successfully', {
            details: {
                jobType: 'library.scan',
                duration: '00:05:23',
                itemsProcessed: 156
            },
            relatedEntityId: '5',
            relatedEntityType: 'task'
        });
        logger.info('Successfully seeded events database with sample events');
    }
    catch (error: unknown) {
        logger.error('Error seeding events database:', error instanceof Error ? error.message : String(error));
    }
}
