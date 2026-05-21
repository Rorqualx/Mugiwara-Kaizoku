
import { ReleaseType } from '@prisma/client';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ID, ReleaseSchedule } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';


import { getCalendarCache } from './CalendarCacheService';

import type { Prisma } from '@prisma/client';

// Local type definition
interface UpdateReleaseScheduleDto {
  releaseType?: ReleaseType;
  dayOfWeek?: number;
  dayOfMonth?: number;
  frequency?: string;
  confidence?: number;
  source?: string;
  metadata?: unknown;
  isConfirmed?: boolean;
  timezone?: string;
  releaseTime?: string;
}

export class ReleaseScheduleService {
  private cache = getCalendarCache();
  /**
   * Get release schedule for a manga
   * Following AsyncResult pattern as per architectural guidelines
   */
  async getSchedule(mangaId: ID): Promise<AsyncResult<ReleaseSchedule | null, Error>> {
    try {
      const numericId = toNumberId(mangaId);
      // Check cache first
      const cached = this.cache.getSchedule(String(numericId));
      if (cached) {
        return createSuccessResult(cached);
      }
      const schedule = await prisma.releaseSchedule.findFirst({
        where: {
          mangaId: numericId
        },
        orderBy: {
          confidence: 'desc'
        }
      });
      if (!schedule) {
        return createSuccessResult(null);
      }
      // Map Prisma result to domain type
      const domainSchedule = schedule;
      // Cache the result
      this.cache.setSchedule(String(numericId), domainSchedule);
      return createSuccessResult(domainSchedule);
    }
    catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Update or create release schedule
   */
  async updateSchedule(mangaId: ID, schedule: UpdateReleaseScheduleDto): Promise<AsyncResult<ReleaseSchedule, Error>> {
    try {
      const numericId = toNumberId(mangaId);
      const source = schedule["source"] ?? 'manual';

      const updateData = this.buildUpdateData(schedule);
      const createData = this.buildCreateData(numericId, source, schedule);

      const updated = await prisma.releaseSchedule.upsert({
        where: {
          mangaId_source: {
            mangaId: numericId,
            source
          }
        },
        update: updateData as unknown as Prisma.ReleaseScheduleUpdateInput,
        create: createData as unknown as Prisma.ReleaseScheduleCreateInput
      });
      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.clearForManga(numericId);

      // Emit WebSocket event for schedule update
      void realtimeEmitter.emitSystemEvent({
        eventType: 'release:schedule:updated',
        source: 'ReleaseScheduleService',
        message: `Release schedule updated for manga ${numericId}`,
        data: {
          mangaId: numericId,
          releaseType: updated.releaseType,
          confidence: updated.confidence,
          isConfirmed: updated.isConfirmed,
          scheduleSource: source
        }
      });

      // Prisma ReleaseSchedule matches domain ReleaseSchedule type
      return createSuccessResult(updated);
    }
    catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Build update data object with proper null handling
   */
  private buildUpdateData(schedule: UpdateReleaseScheduleDto): Record<string, unknown> {
    const updateData: Record<string, unknown> = {
      lastUpdated: new Date()
    };
    if (schedule.releaseType !== undefined) updateData['releaseType'] = schedule.releaseType;
    if (schedule.dayOfWeek !== undefined) updateData['dayOfWeek'] = schedule.dayOfWeek;
    if (schedule.dayOfMonth !== undefined) updateData['dayOfMonth'] = schedule.dayOfMonth;
    if (schedule.frequency !== undefined) updateData['frequency'] = schedule.frequency;
    if (schedule.confidence !== undefined) updateData['confidence'] = schedule.confidence;
    if (schedule["metadata"] !== undefined) updateData['metadata'] = schedule["metadata"] as Record<string, unknown>;
    if (schedule.isConfirmed !== undefined) updateData['isConfirmed'] = schedule.isConfirmed;
    if (schedule.timezone !== undefined) updateData['timezone'] = schedule.timezone;
    if (schedule.releaseTime !== undefined) updateData['releaseTime'] = schedule.releaseTime;
    return updateData;
  }

  /**
   * Build create data object with proper null handling
   */
  private buildCreateData(mangaId: number, source: string, schedule: UpdateReleaseScheduleDto): Record<string, unknown> {
    const createData: Record<string, unknown> = {
      mangaId,
      source,
      releaseType: schedule.releaseType ?? ReleaseType.IRREGULAR,
      isConfirmed: schedule.isConfirmed ?? false,
      confidence: schedule.confidence ?? 0,
      timezone: schedule.timezone ?? 'UTC'
    };
    if (schedule.dayOfWeek !== undefined) createData['dayOfWeek'] = schedule.dayOfWeek;
    if (schedule.dayOfMonth !== undefined) createData['dayOfMonth'] = schedule.dayOfMonth;
    if (schedule.frequency !== undefined) createData['frequency'] = schedule.frequency;
    if (schedule.releaseTime !== undefined) createData['releaseTime'] = schedule.releaseTime;
    if (schedule["metadata"] !== undefined) createData['metadata'] = schedule["metadata"] as Record<string, unknown>;
    return createData;
  }

  /**
   * Remove manual override for a manga
   */
   
  async removeManualOverride(mangaId: ID): Promise<AsyncResult<void, Error>> {
    try {
      const numericId = toNumberId(mangaId);
      // Delete schedule + events atomically — partial deletion would leave the
      // manga in an inconsistent override state.
      await prisma.$transaction([
        prisma.releaseSchedule.deleteMany({
          where: { mangaId: numericId, source: 'manual_override' },
        }),
        prisma.calendarEvent.deleteMany({
          where: { mangaId: numericId, source: 'manual_override' },
        }),
      ]);
      // Invalidate cache for this manga only (more efficient than clearAll)
      this.cache.clearForManga(numericId);

      // Emit WebSocket event for manual override removal
      void realtimeEmitter.emitSystemEvent({
        eventType: 'release:schedule:override:removed',
        source: 'ReleaseScheduleService',
        message: `Manual override removed for manga ${numericId}`,
        data: { mangaId: numericId }
      });

      return createSuccessResult(undefined);
    }
    catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}