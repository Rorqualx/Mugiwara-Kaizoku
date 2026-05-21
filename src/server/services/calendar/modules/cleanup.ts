import { EventStatus } from '@prisma/client';
import { addDays } from 'date-fns';

import { prisma } from '@/server/db';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';


export class CalendarEventCleanup {
  /**
   * Clean up old events
   */
  async cleanupOldEvents(daysToKeep: number): Promise<AsyncResult<number, Error>> {
    try {
      const cutoffDate = addDays(new Date(), -daysToKeep);

      const result = await prisma.calendarEvent.deleteMany({
        where: {
          scheduledDate: {
            lt: cutoffDate
          },
          status: {
            in: [EventStatus.RELEASED, EventStatus.CANCELLED]
          }
        }
      });

      return createSuccessResult(result.count);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}