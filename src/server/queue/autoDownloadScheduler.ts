import { prisma } from '@/server/db';
import { runUnifiedReleaseSearch } from '@/server/services/library/releaseDispatcher/dispatch';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { processAutoDownload } from './workers/autoDownloadWorker';

/**
 * Auto-Download Scheduler
 *
 * Periodically checks manga with enabled auto-download rules and processes
 * them for new chapter releases.
 *
 * Default interval: 24 hours (86400 seconds)
 */
export class AutoDownloadScheduler {
    private intervalId: NodeJS.Timeout | undefined;
    private isRunning = false;
    private checkInterval: number;

    constructor(checkIntervalSeconds: number = 86400) {
        this.checkInterval = checkIntervalSeconds * 1000; // Convert to milliseconds
    }

    /**
     * Start the auto-download scheduler
     */
    async start(): Promise<void> {
        if (this.intervalId) {
            logger.info('[AutoDownloadScheduler] Already running');
            return;
        }

        logger.info(`[AutoDownloadScheduler] Starting scheduler (interval: ${this.checkInterval / 1000}s)`);

        // Run immediately on start
        await this.checkRules();

        // Then run at regular intervals
        this.intervalId = setInterval(() => {
            this.checkRules().catch((error) => {
                logger.error('[AutoDownloadScheduler] Error in interval:', error);
            });
        }, this.checkInterval);
    }

    /**
     * Stop the auto-download scheduler
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            logger.info('[AutoDownloadScheduler] Stopped');
        }
    }
    /**
     * Check if a rule should be skipped based on its check interval
     */
    private shouldSkipRule(rule: { lastChecked: Date | null; checkInterval: number; mangaId: number }, now: Date): boolean {
        if (!rule.lastChecked) {
            return false;
        }
        const timeSinceCheck = now.getTime() - rule.lastChecked.getTime();
        const intervalMs = rule.checkInterval * 1000;
        if (timeSinceCheck < intervalMs) {
            logger.debug(`[AutoDownloadScheduler] Skipping manga ${rule.mangaId}: checked too recently`);
            return true;
        }
        return false;
    }

    /**
     * Process a single auto-download rule with delay
     * Extracted to reduce nesting depth and isolate sequential await operations
     */
    private async processSingleRule(rule: {
        mangaId: number;
        manga: { id: number; title: string };
    }): Promise<void> {
        logger.info(`[AutoDownloadScheduler] Processing manga: ${rule.manga.title}`);

        // Cron now goes through the same unified pipeline as the
        // post-enrichment auto-trigger and the manual Quick-Download button:
        // fans out across Prowlarr + MangaDex + Suwayomi + GetComics, packs
        // first, native chapter-level fill-in for whatever Prowlarr doesn't
        // cover. Errors degrade to a logged warning — the schedule keeps
        // running for the rest of the rules.
        try {
            await runUnifiedReleaseSearch(rule.mangaId);
        } catch (err: unknown) {
            logger.error(`[AutoDownloadScheduler] Error processing manga ${rule.mangaId}:`, err);
        }

        // Update last checked time
        await prisma.autoDownloadRule.update({
            where: { mangaId: rule.mangaId },
            data: { lastChecked: new Date() }
        });

        // Add delay between manga to avoid overloading
        await this.delay(2000); // 2 seconds
    }

    private async checkRules(): Promise<void> {
        if (this.isRunning) {
            logger.info('[AutoDownloadScheduler] Already checking rules, skipping');
            return;
        }
        this.isRunning = true;
        try {
            logger.info('[AutoDownloadScheduler] Checking auto-download rules');

            const now = new Date();

            // Query enabled rules that need checking
            const rulesToCheck = await prisma.autoDownloadRule.findMany({
                where: {
                    enabled: true,
                    OR: [
                        { lastChecked: null },
                        {
                            lastChecked: {
                                lt: new Date(now.getTime() - 3600 * 1000) // Default 1 hour
                            }
                        }
                    ]
                },
                include: {
                    manga: {
                        select: { id: true, title: true }
                    }
                }
            });

            logger.info(`[AutoDownloadScheduler] Found ${rulesToCheck.length} manga to check`);

            // Process each manga sequentially (intentional for rate limiting)
            for (const rule of rulesToCheck) {
                if (this.shouldSkipRule(rule, now)) {
                    continue;
                }
                try {
                    // Process rule with awaits (intentional sequential processing for API rate limits)
                    // eslint-disable-next-line no-await-in-loop
                    await this.processSingleRule(rule);
                }
                catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error(`[AutoDownloadScheduler] Unexpected error processing manga ${rule.mangaId}:`, errorMessage);
                }
            }

            logger.info('[AutoDownloadScheduler] Finished checking rules');
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[AutoDownloadScheduler] Error checking rules:', errorMessage);
        }
        finally {
            this.isRunning = false;
        }
    }
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => { setTimeout(resolve, ms); });
    }

    /**
     * Update the check interval
     *
     * @param seconds - New interval in seconds
     */
    setInterval(seconds: number): void {
        this.checkInterval = seconds * 1000;
        logger.info(`[AutoDownloadScheduler] Interval updated to ${seconds}s`);

        // Restart if currently running
        if (this.intervalId) {
            this.stop();
            this.start().catch((error) => {
                logger.error('[AutoDownloadScheduler] Error restarting with new interval:', error);
            });
        }
    }

    /**
     * Manually trigger a specific manga
     */
    async triggerManga(mangaId: number): Promise<void> {
        logger.info(`[AutoDownloadScheduler] Manually triggering manga ${mangaId}`);
        const result = await processAutoDownload(mangaId);
        if (isError(result)) {
            throw result.error;
        }
    }
}

// Export scheduler instance (will be initialized with config in server/index.ts)
// Default: 24 hours (will be overridden by config)
export const autoDownloadScheduler = new AutoDownloadScheduler(86400);
