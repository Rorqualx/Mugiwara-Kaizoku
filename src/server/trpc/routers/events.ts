/**
 * Events Router
 *
 * tRPC router for system event management and retrieval.
 * Provides endpoints for listing, filtering, and managing events.
 *
 * @module server/trpc/routers/events
 */
import { randomUUID } from 'crypto';

import { z } from "zod";

import { prisma } from '@/server/db';
import { eventService } from '@/server/services/events/eventService';
// Import EventFilters for type-safe usage
import type { EventFilters } from '@/server/services/events/eventService';
import { EventType, EventSource, EventLevel } from '@/server/services/events/eventTypes';
import { getConfigJSON } from '@/server/utils/configReader';
import {
  createSuccessResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { logAppStartup, logAppShutdown } from '@/utils/system-event-logger';

import { adminProcedure, protectedProcedure } from '../procedures';
import { router } from "../trpc";

/**
 * Configuration interface for event settings
 */
interface EventSettingsConfig {
  retentionPolicy: 'time' | 'count' | 'both' | 'unlimited';
  retentionDays: number;
  retentionCount: number;
  notificationsEnabled: boolean;
  notifyOnError: boolean;
  notifyOnWarning: boolean;
  notifyOnInfo: boolean;
  notifyOnDownloadComplete: boolean;
  notifyOnImportComplete: boolean;
  defaultLogLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  componentLogLevels: Record<string, string>;
}

/**
 * Router for system event management and retrieval
 */
export const eventsRouter = router({
  /**
   * Retrieves events with filtering and pagination
   */
  list: protectedProcedure.
  input(z.object({
    types: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    levels: z.array(z.string()).optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    relatedEntityId: z.string().optional(),
    relatedEntityType: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50)
  })).
  query(async ({ input }) => {
    // Convert string arrays to EventType, EventSource, and EventLevel arrays
    const filters: EventFilters = {};

    if (input.types !== undefined) {
      filters.types = input.types.filter((type) => Object.values(EventType).includes(type as EventType)) as EventType[];
    }
    if (input.sources !== undefined) {
      filters.sources = input.sources.filter((source) => Object.values(EventSource).includes(source as EventSource)) as EventSource[];
    }
    if (input.levels !== undefined) {
      filters.levels = input.levels.filter((level) => Object.values(EventLevel).includes(level as EventLevel)) as EventLevel[];
    }
    if (input.search !== undefined) filters.search = input.search;
    if (input.startDate !== undefined) filters.startDate = input.startDate;
    if (input.endDate !== undefined) filters.endDate = input.endDate;
    if (input.relatedEntityId !== undefined) filters.relatedEntityId = input.relatedEntityId;
    if (input.relatedEntityType !== undefined) filters.relatedEntityType = input.relatedEntityType;

    return eventService.getEvents(filters, input.page, input.pageSize);
  }),
  /**
   * Retrieves event types for filtering
   */
  getEventTypes: protectedProcedure.
  query(() => {
    return Object.values(EventType);
  }),
  /**
   * Retrieves event sources for filtering
   */
  getEventSources: protectedProcedure.
  query(() => {
    return Object.values(EventSource);
  }),
  /**
   * Retrieves event levels for filtering
   */
  getEventLevels: protectedProcedure.
  query(() => {
    return Object.values(EventLevel);
  }),
  /**
   * Clears events based on age
   */
  clearEvents: adminProcedure.
  input(z.object({
    retentionDays: z.number().min(1).default(30)
  })).
  mutation(async ({ input }) => {
    const deletedCount = await eventService.cleanupEvents(input.retentionDays);
    return { deletedCount };
  }),
  /**
   * Export events to a file
   */
  exportEvents: protectedProcedure.
  input(z.object({
    format: z.enum(['json', 'csv']).default('json'),
    filters: z.object({
      types: z.array(z.string()).optional(),
      sources: z.array(z.string()).optional(),
      levels: z.array(z.string()).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional()
    }).optional()
  })).
  mutation(async ({ input }) => {
    // In a real implementation, this would export events to a file
    // but for now we'll just log it and return a simulated path
    logger.info(`Exporting events in ${input.format} format with filters:`, input.filters);
    // Log the export in the events system
    await prisma.systemEvent.create({
      data: {
        id: randomUUID(),
        type: 'system.events.exported',
        source: 'system',
        level: 'info',
        message: `Events exported in ${input.format} format`,
        details: {
          format: input.format,
          filters: input.filters ?? {}
        }
      }
    });
    // Return a success response with the simulated file path
    return {
      success: true,
      filePath: `/config/logs/events-export.${input.format}`
    };
  }),
  /**
   * Get event settings
   */
  getEventSettings: protectedProcedure.
  query(async () => {
    const eventSettings = await getConfigJSON<EventSettingsConfig>('events.settings', undefined);
    if (!eventSettings) {
      // Return default settings if none exist
      return {
        retentionPolicy: 'time',
        retentionDays: 30,
        retentionCount: 5000,
        notificationsEnabled: true,
        notifyOnError: true,
        notifyOnWarning: true,
        notifyOnInfo: false,
        notifyOnDownloadComplete: true,
        notifyOnImportComplete: true,
        defaultLogLevel: 'info',
        componentLogLevels: Object.values(EventSource).reduce((acc, source) => ({
          ...acc,
          [source]: source.endsWith('dex') || source.endsWith('vine') ? 'warning' : 'info'
        }), {} as Record<string, string>)
      };
    }
    return eventSettings;
  }),
  /**
   * Update event settings
   */
  updateEventSettings: protectedProcedure.
  input(z.object({
    retentionPolicy: z.enum(['time', 'count', 'both', 'unlimited']),
    retentionDays: z.number().min(1).max(365),
    retentionCount: z.number().min(100).max(100000),
    notificationsEnabled: z.boolean(),
    notifyOnError: z.boolean(),
    notifyOnWarning: z.boolean(),
    notifyOnInfo: z.boolean(),
    notifyOnDownloadComplete: z.boolean(),
    notifyOnImportComplete: z.boolean(),
    defaultLogLevel: z.enum(['debug', 'info', 'warning', 'error', 'critical']),
    componentLogLevels: z.record(z.string(), z.enum(['debug', 'info', 'warning', 'error', 'critical']))
  })).
  mutation(async ({ input }) => {
    // Update settings in Config table
    await prisma.config.upsert({
      where: { key: 'events.settings' },
      create: {
        key: 'events.settings',
        value: JSON.stringify(input),
        valueType: 'JSON'
      },
      update: {
        value: JSON.stringify(input)
      }
    });
    // Apply new retention policy if needed
    if (input.retentionPolicy !== 'unlimited') {
      if (input.retentionPolicy === 'time' || input.retentionPolicy === 'both') {
        await eventService.cleanupEvents(input.retentionDays);
      }
      if (input.retentionPolicy === 'count' || input.retentionPolicy === 'both') {
        // Implementation for count-based cleanup would go here
        // This is a placeholder - in a real implementation, you would
        // fetch the count of events and delete the oldest ones if needed
        const totalEvents = await prisma.systemEvent.count();
        if (totalEvents > input.retentionCount) {
          const eventsToDelete = totalEvents - input.retentionCount;
          // Delete oldest events
          const oldestEvents = await prisma.systemEvent.findMany({
            orderBy: { timestamp: 'asc' },
            take: eventsToDelete,
            select: { id: true }
          });
          await prisma.systemEvent.deleteMany({
            where: {
              id: {
                in: oldestEvents.map((e) => e["id"])
              }
            }
          });
        }
      }
    }
    // Log the configuration change
    await prisma.systemEvent.create({
      data: {
        id: randomUUID(),
        type: 'system.settings.updated',
        source: 'system',
        level: 'info',
        message: 'Event settings updated',
        details: {
          settings: input
        }
      }
    });
    return createSuccessResult(true);
  }),
  /**
   * Log application startup event
   */
  logStartup: protectedProcedure.
  mutation(async () => {
    await logAppStartup();
    return createSuccessResult(true);
  }),
  /**
   * Log application shutdown event
   */
  logShutdown: adminProcedure.
  mutation(async () => {
    await logAppShutdown();
    return createSuccessResult(true);
  })
});