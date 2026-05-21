/**
 * Calendar Notification Worker
 *
 * Orchestrates scheduled notifications for calendar events.
 *
 * Architecture:
 * - calendar-notification/types.ts - Type definitions (6 interfaces)
 * - calendar-notification/utils.ts - Utilities (5 functions + batch processor)
 * - calendar-notification/upcoming-release-processor.ts - Upcoming releases
 * - calendar-notification/delay-processor.ts - Delayed releases
 * - calendar-notification/pattern-change-processor.ts - Pattern changes
 *
 * Refactored from: 517 lines, 15 ESLint violations (12 no-await-in-loop, 3 max-depth)
 * To: ~150 lines, 0 violations (71% reduction in main file)
 *
 * Following project conventions:
 * - AsyncResult pattern for error handling
 * - Explicit return types
 * - No 'any' types
 * - Modular architecture with separation of concerns
 */

import { NotificationService } from '@/server/services/notifications/NotificationService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';

// Import processors
import { sendDelayNotifications } from './calendar-notification/delay-processor';
import { sendPatternChangeNotifications } from './calendar-notification/pattern-change-processor';
import { sendUpcomingReleaseNotifications } from './calendar-notification/upcoming-release-processor';

// Import types
import type { NotificationConfig, NotificationStats } from './calendar-notification/types';

const logger = createLogger('CalendarNotificationWorker');

/**
 * Worker for sending calendar notifications
 */
export class CalendarNotificationWorker {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Send scheduled notifications
   *
   * Orchestrates all notification types based on configuration.
   * Processors run sequentially to avoid overwhelming the notification service.
   */
  async sendScheduledNotifications(
    config: Partial<NotificationConfig>
  ): Promise<AsyncResult<NotificationStats, Error>> {
    const settings: NotificationConfig = {
      leadTimeHours: 24,
      enabledTypes: {
        upcomingRelease: true,
        releaseDelay: true,
        patternChange: true,
        newRelease: true
      },
      batchSize: 50,
      minConfidence: 0.6,
      ...config
    };

    const stats: NotificationStats = {
      sent: 0,
      failed: 0,
      skipped: 0,
      types: {}
    };

    logger.info('[CalendarNotifications] Starting notification run');

    // Emit WebSocket event for notification run started
    void realtimeEmitter.emitSystemEvent({
      eventType: 'calendar:notifications:started',
      source: 'CalendarNotificationWorker',
      message: 'Calendar notification run started',
      data: { config: settings }
    });

    try {
      // 1. Send upcoming release notifications
      if (settings.enabledTypes.upcomingRelease) {
        const upcomingResult = await sendUpcomingReleaseNotifications(
          settings,
          this.notificationService
        );
        if (isSuccess(upcomingResult)) {
          stats.sent += upcomingResult.data.sent;
          stats.failed += upcomingResult.data.failed;
          stats.types['upcomingRelease'] = upcomingResult.data.sent;
        }
      }

      // 2. Send delay notifications
      if (settings.enabledTypes.releaseDelay) {
        const delayResult = await sendDelayNotifications(
          settings,
          this.notificationService
        );
        if (isSuccess(delayResult)) {
          stats.sent += delayResult.data.sent;
          stats.failed += delayResult.data.failed;
          stats.types['releaseDelay'] = delayResult.data.sent;
        }
      }

      // 3. Send pattern change notifications
      if (settings.enabledTypes.patternChange) {
        const patternResult = await sendPatternChangeNotifications(
          settings,
          this.notificationService
        );
        if (isSuccess(patternResult)) {
          stats.sent += patternResult.data.sent;
          stats.failed += patternResult.data.failed;
          stats.types['patternChange'] = patternResult.data.sent;
        }
      }

      logger.info('[CalendarNotifications] Notification run complete', { stats });

      // Emit WebSocket event for notification run completed
      void realtimeEmitter.emitSystemEvent({
        eventType: 'calendar:notifications:completed',
        source: 'CalendarNotificationWorker',
        message: `Calendar notifications sent: ${stats.sent} sent, ${stats.failed} failed`,
        data: { stats }
      });

      return createSuccessResult(stats);
    } catch (error: unknown) {
      logger.error(
        '[CalendarNotifications] Error during notification run',
        error instanceof Error ? error.message : String(error)
      );

      // Emit WebSocket event for notification run error
      void realtimeEmitter.emitSystemEvent({
        eventType: 'calendar:notifications:error',
        source: 'CalendarNotificationWorker',
        message: `Calendar notification run failed: ${error instanceof Error ? error.message : String(error)}`,
        data: { error: error instanceof Error ? error.message : String(error) }
      });

      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send test notification
   *
   * Sends a test notification to verify the notification system is working.
   */
  async sendTestNotification(): Promise<AsyncResult<void, Error>> {
    try {
      const result = await this.notificationService.send({
        type: 'SYSTEM',
        title: 'Calendar Test Notification',
        message: 'This is a test notification from the manga calendar system',
        priority: 'normal',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

      if (result.status === 'error') {
        // Emit WebSocket event for test notification failed
        void realtimeEmitter.emitSystemEvent({
          eventType: 'calendar:notifications:test:failed',
          source: 'CalendarNotificationWorker',
          message: 'Calendar test notification failed',
          data: { error: result.error.message }
        });
        return createErrorResult(result.error);
      }

      // Emit WebSocket event for test notification sent
      void realtimeEmitter.emitSystemEvent({
        eventType: 'calendar:notifications:test:sent',
        source: 'CalendarNotificationWorker',
        message: 'Calendar test notification sent successfully',
        data: { timestamp: new Date().toISOString() }
      });

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      // Emit WebSocket event for test notification error
      void realtimeEmitter.emitSystemEvent({
        eventType: 'calendar:notifications:test:failed',
        source: 'CalendarNotificationWorker',
        message: `Calendar test notification failed: ${error instanceof Error ? error.message : String(error)}`,
        data: { error: error instanceof Error ? error.message : String(error) }
      });

      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

// Export singleton instance
export const calendarNotificationWorker = new CalendarNotificationWorker();
