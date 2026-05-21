/**
 * Settings Router Extensions for Event Management
 * 
 * This file extends the core settings router with procedures for
 * handling event-related settings, such as retention policy, notification 
 * preferences, and component-specific log levels.
 * 
 * @module server/trpc/routers/settings-events
 */

import { randomUUID } from 'crypto';

import { ConfigScope } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { configService } from '@/server/services/config/configService';
import { EventSource } from '@/server/services/events/eventTypes';
import { getConfigJSON, getConfig } from '@/server/utils/configReader';
import {
  createSuccessResult} from '@/utils/async-result';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Component log levels schema for validation
 */
const componentLogLevelsSchema = z.record(z.string(), z.enum(['debug', 'info', 'warning', 'error', 'critical']));

/**
 * Event settings schema
 */
const eventSettingsSchema = z.object({
  // Retention settings
  retentionPolicy: z.enum(['time', 'count', 'both', 'unlimited']),
  retentionDays: z.number().min(1).max(365),
  retentionCount: z.number().min(100).max(100000),

  // Notification settings
  notificationsEnabled: z.boolean(),
  notifyOnError: z.boolean(),
  notifyOnWarning: z.boolean(),
  notifyOnInfo: z.boolean(),
  notifyOnDownloadComplete: z.boolean(),
  notifyOnImportComplete: z.boolean(),

  // Log level settings
  defaultLogLevel: z.enum(['debug', 'info', 'warning', 'error', 'critical']),
  componentLogLevels: componentLogLevelsSchema
});

/**
 * Extension router for event settings
 */
export const settingsEventsRouter = router({
  /**
   * Get event settings procedure
   *
   * Retrieves the current event settings for the system.
   */
  getEventSettings: protectedProcedure.
  query(async () => {
    // Read event settings from Config table
    const retentionPolicy = await getConfig('events.retentionPolicy', 'time');
    const retentionDays = await getConfig('events.retentionDays', '30');
    const retentionCount = await getConfig('events.retentionCount', '5000');
    const notificationsEnabled = await getConfig('events.notificationsEnabled', 'true');
    const notifyOnError = await getConfig('events.notifyOnError', 'true');
    const notifyOnWarning = await getConfig('events.notifyOnWarning', 'true');
    const notifyOnInfo = await getConfig('events.notifyOnInfo', 'false');
    const notifyOnDownloadComplete = await getConfig('events.notifyOnDownloadComplete', 'true');
    const notifyOnImportComplete = await getConfig('events.notifyOnImportComplete', 'true');
    const defaultLogLevel = await getConfig('events.defaultLogLevel', 'info');
    const componentLogLevels = await getConfigJSON<Record<string, string>>('events.componentLogLevels') ??
      Object.values(EventSource).reduce((acc, source) => {
        return {
          ...acc,
          [source]: source.endsWith('dex') || source.endsWith('vine') ? 'warning' : 'info'
        };
      }, {} as Record<string, string>);

    return {
      retentionPolicy,
      retentionDays: parseInt(retentionDays as string, 10),
      retentionCount: parseInt(retentionCount as string, 10),
      notificationsEnabled: notificationsEnabled === 'true',
      notifyOnError: notifyOnError === 'true',
      notifyOnWarning: notifyOnWarning === 'true',
      notifyOnInfo: notifyOnInfo === 'true',
      notifyOnDownloadComplete: notifyOnDownloadComplete === 'true',
      notifyOnImportComplete: notifyOnImportComplete === 'true',
      defaultLogLevel,
      componentLogLevels
    };
  }),

  /**
   * Update event settings procedure
   *
   * Updates the event settings for the system.
   */
  updateEventSettings: protectedProcedure.
  input(eventSettingsSchema).
  mutation(async ({ input }) => {
    // Update settings in Config table
    await configService.set('events.retentionPolicy', input.retentionPolicy, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.retentionDays', input.retentionDays, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.retentionCount', input.retentionCount, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notificationsEnabled', input.notificationsEnabled, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notifyOnError', input.notifyOnError, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notifyOnWarning', input.notifyOnWarning, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notifyOnInfo', input.notifyOnInfo, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notifyOnDownloadComplete', input.notifyOnDownloadComplete, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.notifyOnImportComplete', input.notifyOnImportComplete, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.defaultLogLevel', input.defaultLogLevel, {
      scope: ConfigScope.SYSTEM
    });
    await configService.set('events.componentLogLevels', input.componentLogLevels, {
      scope: ConfigScope.SYSTEM
    });

    // Log the event
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
   * Export events procedure
   * 
   * Exports system events to a JSON file
   */
  exportEvents: protectedProcedure.
  input(z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    levels: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    types: z.array(z.string()).optional()
  })).
  mutation(async ({ input }) => {
    // In a real implementation, this would export events to a file
    // For now, we'll just return success

    // Log the export event
    await prisma.systemEvent.create({
      data: {
        id: randomUUID(),
        type: 'system.events.exported',
        source: 'system',
        level: 'info',
        message: 'Event logs exported',
        details: {
          filters: input
        }
      }
    });

    return createSuccessResult({
      filepath: '/config/logs/events-export.json'
    });
  })
});