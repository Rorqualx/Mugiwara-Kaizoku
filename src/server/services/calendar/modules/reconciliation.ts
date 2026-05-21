import { EventStatus } from '@prisma/client';
import { addDays } from 'date-fns';

import { prisma } from '@/server/db';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';


import type { ReconciliationResult, EventEmitter } from './types';

export class CalendarEventReconciliation {
  constructor(private eventEmitter: EventEmitter) {}

  /**
   * Reconcile events with actual releases
   */
  async reconcileEvents(): Promise<AsyncResult<ReconciliationResult, Error>> {
    try {
      // Find scheduled events that should have been released
      const overdueEvents = await prisma.calendarEvent.findMany({
        where: {
          status: EventStatus.SCHEDULED,
          scheduledDate: {
            lt: new Date()
          }
        }
      });

      // Process all overdue events in parallel
      const results = await Promise.allSettled(
        overdueEvents.map(async (event) => {
          // Check if a chapter was actually released around this time
          const chapter = await prisma.chapter.findFirst({
            where: {
              mangaId: event.mangaId,
              releaseDate: {
                gte: addDays(event.scheduledDate, -1),
                lte: addDays(event.scheduledDate, 1)
              }
            }
          });

          if (chapter) {
            // Mark as released
            await this.confirmRelease(
              event.id,
              chapter.releaseDate ?? new Date(),
              chapter.id
            );
            return { type: 'reconciled' as const };
          } else {
            // Mark as delayed
            const updatedEvent = await prisma.calendarEvent.update({
              where: { id: event.id },
              data: { status: EventStatus.DELAYED },
              include: {
                manga: {
                  select: {
                    title: true,
                    mangaTitle: true
                  }
                }
              }
            });

            // Emit calendar event updated notification
            this.eventEmitter.emit('calendar:event:updated', {
              eventId: updatedEvent.id,
              mangaId: updatedEvent.mangaId
            });

            return { type: 'delayed' as const };
          }
        })
      );

      // Count results
      let reconciled = 0;
      let delayed = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'reconciled') {
            reconciled++;
          } else {
            delayed++;
          }
        }
      }

      return createSuccessResult({
        reconciled,
        delayed
      });
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Confirm a release (mark scheduled event as released)
   */
  async confirmRelease(
    eventId: number,
    actualDate: Date,
    chapterId?: number
  ): Promise<AsyncResult<void, Error>> {
    try {
      const updateData: Record<string, unknown> = {
        status: EventStatus.RELEASED,
        actualDate,
        confidence: 1.0
      };

      if (chapterId !== undefined) {
        updateData['chapterId'] = chapterId;
      }

      const updated = await prisma.calendarEvent.update({
        where: { id: eventId },
        data: updateData,
        include: {
          manga: {
            select: {
              title: true,
              mangaTitle: true
            }
          }
        }
      });

      // Emit calendar event updated notification
      this.eventEmitter.emit('calendar:event:updated', {
        eventId: updated.id,
        mangaId: updated.mangaId
      });

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}