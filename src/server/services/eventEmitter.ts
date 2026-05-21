/**
 * Event Emitter Service
 *
 * Central event bus for server-side event handling.
 * Used for decoupling components and handling asynchronous events.
 */
import { EventEmitter } from 'events';

import { logger } from '@/utils/logger';

import { eventService } from './events/eventService';
import { EventLevel } from './events/eventTypes';

import type { EventType, EventSource} from './events/eventTypes';
// Event types
export interface CalendarEvents {
    'calendar:sync:start': {
        mangaId?: number;
    };
    'calendar:sync:complete': {
        mangaId?: number;
        success: boolean;
        error?: Error;
    };
    'calendar:event:created': {
        eventId: number;
        mangaId: number;
    };
    'calendar:event:updated': {
        eventId: number;
        mangaId: number;
    };
    'calendar:event:deleted': {
        eventId: number;
        mangaId: number;
    };
    'calendar:schedule:updated': {
        scheduleId: number;
        mangaId: number;
    };
    'calendar:pattern:detected': {
        mangaId: number;
        pattern: string;
        confidence: number;
    };
}
export interface SystemEvents {
    'system:startup': {
        timestamp: Date;
    };
    'system:shutdown': {
        timestamp: Date;
    };
    'system:error': {
        error: Error;
        context?: string;
    };
    'system:warning': {
        message: string;
        context?: string;
    };
}
export interface TaskEvents {
    'task:created': {
        taskId: number;
        type: string;
    };
    'task:started': {
        taskId: number;
    };
    'task:completed': {
        taskId: number;
        success: boolean;
    };
    'task:failed': {
        taskId: number;
        error: Error;
    };
    'task:retry': {
        taskId: number;
        attempt: number;
    };
}
export interface DownloadEvents {
    'download:started': {
        downloadId: string;
        mangaId?: number;
        chapterId?: number;
    };
    'download:progress': {
        downloadId: string;
        progress: number;
    };
    'download:completed': {
        downloadId: string;
        success: boolean;
    };
    'download:failed': {
        downloadId: string;
        error: Error;
    };
    'download:cancelled': {
        downloadId: string;
    };
}
export interface MangaEvents {
    'manga:added': {
        mangaId: number;
    };
    'manga:updated': {
        mangaId: number;
    };
    'manga:deleted': {
        mangaId: number;
    };
    'manga:chapter:added': {
        mangaId: number;
        chapterId: number;
    };
    'manga:chapter:updated': {
        mangaId: number;
        chapterId: number;
    };
    'manga:metadata:updated': {
        mangaId: number;
    };
}
export interface UserEvents {
    'user:action': {
        userId: string;
    };
    'user:created': {
        userId: string;
    };
    'user:updated': {
        userId: string;
    };
    'user:deleted': {
        userId: string;
    };
    'user:login': {
        userId: string;
    };
    'user:logout': {
        userId: string;
    };
}
export interface LibraryEvents {
    'library:scan:started': {
        libraryId: number;
        libraryName: string;
        path: string;
    };
    'library:scan:progress': {
        libraryId: number;
        status: 'started' | 'scanning' | 'completed' | 'error';
        progress: number;
        message: string;
        current?: number;
        total?: number;
        created?: number;
        skipped?: number;
        errors?: number;
        totalFiles?: number;
        timestamp: string;
    };
    'library:scan:completed': {
        libraryId: number;
        created: number;
        skipped: number;
        errors: number;
    };
}
export interface ConfigEvents {
    'config:updated': {
        key: string;
        value: unknown;
    };
}
// Combined event map
export type EventMap = CalendarEvents & SystemEvents & TaskEvents & DownloadEvents & MangaEvents & UserEvents & LibraryEvents & ConfigEvents;
// Type-safe event emitter
export class TypedEventEmitter extends EventEmitter {
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean {
        return super.emit(event, data);
    }
    on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): this {
        return super.on(event, listener);
    }
    once<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): this {
        return super.once(event, listener);
    }
    off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): this {
        return super.off(event, listener);
    }
    removeAllListeners<K extends keyof EventMap>(event?: K): this {
        return super.removeAllListeners(event);
    }
}
// Export the TypedEventEmitter type for backward compatibility
export type { TypedEventEmitter as IEventEmitter };
// Extended TypedEventEmitter with additional method
export class ExtendedEventEmitter extends TypedEventEmitter {
    /**
     * Emit an event with automatic event service integration
     * This method creates a database event record and emits the event
     */
    async emitWithTracking(data: {
        type: EventType;
        source: EventSource;
        level?: EventLevel;
        message?: string;
        userId?: string;
        mangaId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<boolean> {
        try {
            // Determine the event level based on the event type
            let level = data.level;
            if (!level) {
                // Default levels based on event type
                if (data.type.includes('error') || data.type.includes('FAILED')) {
                    level = EventLevel.ERROR;
                }
                else if (data.type.includes('warning')) {
                    level = EventLevel.WARNING;
                }
                else {
                    level = EventLevel.INFO;
                }
            }
            // Create a default message if not provided
            const message = data.message ?? `${data.type} event from ${data["source"]}`;
            // Create the event in the database
            const eventOptions: Record<string, unknown> = {
                details: (data["metadata"] ?? {}) as Record<string, unknown>
            };
            const entityId = data.userId ?? data.mangaId;
            if (entityId) {
                eventOptions['relatedEntityId'] = entityId;
                eventOptions['relatedEntityType'] = data.userId ? 'user' : 'manga';
            }
            await eventService.createEvent(data.type, data["source"], level, message, eventOptions);
            // Also emit the traditional event for listeners
            const eventName = `${data["source"]}:${data.type}`;
            const eventData = {
                ...data["metadata"],
                ...(data.userId !== undefined ? { userId: data.userId } : {}),
                ...(data.mangaId !== undefined ? { mangaId: data.mangaId } : {})
            };
            // Call the original emit method
            // Use type assertion since emitWithTracking creates dynamic events that may not match EventMap
            return super.emit(eventName as keyof EventMap, eventData as EventMap[keyof EventMap]);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to emit event:', errorMessage);
            return false;
        }
    }
}
// Singleton instance
let eventEmitterInstance: ExtendedEventEmitter | null = null;
/**
 * Get or create the global event emitter instance
 */
export function getEventEmitter(): ExtendedEventEmitter {
    if (!eventEmitterInstance) {
        eventEmitterInstance = new ExtendedEventEmitter();
        // Increase max listeners to prevent warnings in production
        eventEmitterInstance.setMaxListeners(100);
    }
    return eventEmitterInstance;
}
// Export convenience instance
export const eventEmitter = getEventEmitter();
