import { DownloadManager } from '@/server/services/download/downloadManager';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { processDownloadMonitoring } from './workers/downloadMonitorWorker';

/**
 * Download Monitor Scheduler
 *
 * Periodically checks download clients for completed downloads and imports
 * files into the manga library.
 *
 * Uses adaptive polling: 15 seconds when downloads are active, 60 seconds when idle.
 */
export class DownloadMonitorScheduler {
  private intervalId?: NodeJS.Timeout | undefined;
  private isRunning = false;
  private checkInterval: number;
  /** Track whether active downloads exist to adjust poll frequency */
  private hasActiveDownloads = false;
  /** Idle interval (no active downloads) */
  private readonly idleInterval: number;
  /** Active interval (downloads in progress — faster for real-time UI updates) */
  private readonly activeInterval: number;

  constructor(checkIntervalSeconds: number = 60) {
    this.idleInterval = checkIntervalSeconds * 1000;
    this.activeInterval = 15 * 1000; // 15 seconds when downloads are active
    this.checkInterval = this.idleInterval;
  }

  /**
   * Start the download monitor scheduler
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      logger.info('[DownloadMonitorScheduler] Already running');
      return;
    }

    logger.info(`[DownloadMonitorScheduler] Starting scheduler (idle: ${this.idleInterval / 1000}s, active: ${this.activeInterval / 1000}s)`);

    // Resume progress loops for any active Prowlarr jobs that survived a restart
    const downloadManager = new DownloadManager();
    void downloadManager.resumeActiveProgressLoops();

    // Run immediately on start
    await this.checkDownloads();

    // Use adaptive interval: poll faster when downloads are active
    this.scheduleNextCheck();
  }

  /**
   * Schedule the next check with adaptive interval.
   * 15s when active downloads exist, 60s when idle.
   */
  private scheduleNextCheck(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }

    const interval = this.hasActiveDownloads ? this.activeInterval : this.idleInterval;
    this.intervalId = setTimeout(() => {
      this.checkDownloads()
        .catch((error) => {
          logger.error('[DownloadMonitorScheduler] Error in check:', error);
        })
        .finally(() => {
          this.scheduleNextCheck();
        });
    }, interval);
  }

  /**
   * Stop the download monitor scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined as NodeJS.Timeout | undefined;
      logger.info('[DownloadMonitorScheduler] Stopped');
    }
  }

  /**
   * Check downloads and import completed files
   */
  private async checkDownloads(): Promise<void> {
    if (this.isRunning) {
      logger.info('[DownloadMonitorScheduler] Already checking downloads, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('[DownloadMonitorScheduler] Checking for completed downloads');

      const result = await processDownloadMonitoring();

      if (isError(result)) {
        logger.error('[DownloadMonitorScheduler] Download monitoring failed:', result.error);
        return;
      }

      if (!isSuccess(result)) {
        logger.warn('[DownloadMonitorScheduler] Download monitoring returned no result');
        return;
      }

      const stats = result.data;
      const wasActive = this.hasActiveDownloads;
      this.hasActiveDownloads = stats.checked > 0;
      if (wasActive !== this.hasActiveDownloads) {
        logger.info(`[DownloadMonitorScheduler] Switching to ${this.hasActiveDownloads ? 'active' : 'idle'} polling (${this.hasActiveDownloads ? this.activeInterval / 1000 : this.idleInterval / 1000}s)`);
      }
      logger.info(`[DownloadMonitorScheduler] Check complete - checked: ${stats.checked}, imported: ${stats.imported}, errors: ${stats.errors}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[DownloadMonitorScheduler] Error checking downloads:', errorMessage);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger a download monitoring check
   */
  async trigger(): Promise<void> {
    logger.info('[DownloadMonitorScheduler] Manually triggering download check');

    const result = await processDownloadMonitoring();

    if (isError(result)) {
      throw result.error;
    }

    return;
  }

  /**
   * Update the check interval
   *
   * @param seconds - New interval in seconds
   */
  setInterval(seconds: number): void {
    this.checkInterval = seconds * 1000;

    // Restart if currently running
    if (this.intervalId) {
      this.stop();
      this.start().catch((error) => {
        logger.error('[DownloadMonitorScheduler] Error restarting with new interval:', error);
      });
    }
  }
}

// Export a singleton instance with 2-minute interval
export const downloadMonitorScheduler = new DownloadMonitorScheduler(120);
