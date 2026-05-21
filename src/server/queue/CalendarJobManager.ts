/**
 * Calendar Job Manager
 *
 * Manages all calendar-related background jobs with scheduling,
 * monitoring, and health checks.
 *
 * Following project conventions:
 * - AsyncResult pattern for all operations
 * - Proper error handling and logging
 * - Type-safe implementations
 */
import { CronJob } from 'cron';

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult} from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';

import { CalendarMaintenanceWorker } from './workers/calendarMaintenanceWorker';
import { CalendarNotificationWorker } from './workers/calendarNotificationWorker';
import { CalendarSyncWorker } from './workers/calendarSyncWorker';
import { ReleaseDetectionWorker } from './workers/releaseDetectionWorker';

const logger = createLogger('CalendarJobManager');
/**
 * Job configuration
 */
export interface CalendarJobConfig {
    /**
     * Enable/disable specific jobs
     */
    enabledJobs: {
        sync: boolean;
        detection: boolean;
        maintenance: boolean;
        notifications: boolean;
    };
    /**
     * Job schedules (cron format)
     */
    schedules: {
        sync: string; // Default: '0 * * * *' (hourly)
        detection: string; // Default: '*/15 * * * *' (every 15 minutes)
        maintenance: string; // Default: '0 3 * * *' (3 AM daily)
        notifications: string; // Default: '0 8,20 * * *' (8 AM and 8 PM)
    };
    /**
     * Job configuration
     */
    config: {
        syncBatchSize: number;
        detectionInterval: number; // minutes
        maintenanceDaysToKeep: number;
        notificationLeadTime: number; // hours before release
    };
}
/**
 * Job status tracking
 */
interface JobStatus {
    name: string;
    lastRun?: Date;
    nextRun?: Date;
    isRunning: boolean;
    lastStatus: 'success' | 'error' | 'running' | 'idle';
    lastError?: string;
    runCount: number;
    errorCount: number;
}
/**
 * Calendar Job Manager
 * Orchestrates all calendar background jobs
 */
export class CalendarJobManager {
    private jobs: Map<string, CronJob> = new Map();
    private jobStatus: Map<string, JobStatus> = new Map();
    private workers: {
        sync: CalendarSyncWorker;
        detection: ReleaseDetectionWorker;
        maintenance: CalendarMaintenanceWorker;
        notifications: CalendarNotificationWorker;
    };
    private config: CalendarJobConfig;
    private isInitialized = false;
    constructor(config?: Partial<CalendarJobConfig>) {
        this.config = {
            enabledJobs: {
                sync: true,
                detection: true,
                maintenance: true,
                notifications: true,
                ...config?.enabledJobs
            },
            schedules: {
                sync: '0 * * * *', // Every hour
                detection: '*/15 * * * *', // Every 15 minutes
                maintenance: '0 3 * * *', // 3 AM daily
                notifications: '0 8,20 * * *', // 8 AM and 8 PM
                ...config?.schedules
            },
            config: {
                syncBatchSize: 10,
                detectionInterval: 15,
                maintenanceDaysToKeep: 90,
                notificationLeadTime: 24,
                ...config?.config
            }
        };
        // Initialize workers
        this.workers = {
            sync: new CalendarSyncWorker(),
            detection: new ReleaseDetectionWorker(),
            maintenance: new CalendarMaintenanceWorker(),
            notifications: new CalendarNotificationWorker()
        };
    }
    /**
     * Initialize and start all jobs
     */
    async start(): Promise<AsyncResult<void, Error>> {
        try {
            if (this.isInitialized) {
                logger.warn('[CalendarJobManager] Already initialized');
                return createSuccessResult(undefined);
            }
            logger.info('[CalendarJobManager] Starting calendar job manager');
            // Initialize workers
            await this.workers.sync.initialize();
            // Setup jobs
            if (this.config.enabledJobs.sync) {
                this.setupSyncJob();
            }
            if (this.config.enabledJobs.detection) {
                this.setupDetectionJob();
            }
            if (this.config.enabledJobs.maintenance) {
                this.setupMaintenanceJob();
            }
            if (this.config.enabledJobs.notifications) {
                this.setupNotificationJob();
            }
            // Start all jobs
            this.jobs.forEach((job, name) => {
                job.start();
                logger.info(`[CalendarJobManager] Started job: ${name}`);
            });
            this.isInitialized = true;
            // Log job schedules
            this.logJobSchedules();
            // Set up health check
            this.setupHealthCheck();
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            logger.error('[CalendarJobManager] Failed to start', error);
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Stop all jobs
     */
    stop(): void {
        logger.info('[CalendarJobManager] Stopping all jobs');
        this.jobs.forEach((job, name) => {
            void job.stop();
            logger.info(`[CalendarJobManager] Stopped job: ${name}`);
        });
        this.jobs.clear();
        this.isInitialized = false;
    }
    /**
     * Setup sync job
     */
    private setupSyncJob(): void {
        const job = new CronJob(this.config.schedules.sync, async () => {
            await this.runJob('sync', async () => {
                await this.workers.sync.processCalendarSync();
            });
        }, null, false, 'UTC');
        this.jobs.set('sync', job);
        this.initializeJobStatus('sync');
    }
    /**
     * Setup detection job
     */
    private setupDetectionJob(): void {
        const job = new CronJob(this.config.schedules.detection, async () => {
            await this.runJob('detection', async () => {
                await this.workers.detection.detectNewReleases();
            });
        }, null, false, 'UTC');
        this.jobs.set('detection', job);
        this.initializeJobStatus('detection');
    }
    /**
     * Setup maintenance job
     */
    private setupMaintenanceJob(): void {
        const job = new CronJob(this.config.schedules.maintenance, async () => {
            await this.runJob('maintenance', async () => {
                await this.workers.maintenance.performMaintenance({
                    daysToKeep: this.config.config.maintenanceDaysToKeep
                });
            });
        }, null, false, 'UTC');
        this.jobs.set('maintenance', job);
        this.initializeJobStatus('maintenance');
    }
    /**
     * Setup notification job
     */
    private setupNotificationJob(): void {
        const job = new CronJob(this.config.schedules.notifications, async () => {
            await this.runJob('notifications', async () => {
                await this.workers.notifications.sendScheduledNotifications({
                    leadTimeHours: this.config.config.notificationLeadTime
                });
            });
        }, null, false, 'UTC');
        this.jobs.set('notifications', job);
        this.initializeJobStatus('notifications');
    }
    /**
     * Run a job with error handling and status tracking
     */
    private async runJob(name: string, task: () => Promise<void>): Promise<void> {
        const status = this.jobStatus.get(name);
        if (!status)
            return;
        if (status.isRunning) {
            logger.warn(`[CalendarJobManager] Job ${name} is already running, skipping`);
            return;
        }
        logger.info(`[CalendarJobManager] Starting job: ${name}`);
        status.isRunning = true;
        status.lastStatus = 'running';
        status.lastRun = new Date();
        try {
            await task();
            status.lastStatus = 'success';
            status.runCount++;
            logger.info(`[CalendarJobManager] Job ${name} completed successfully`);
        }
        catch (error: unknown) {
            status.lastStatus = 'error';
            status.errorCount++;
            status.lastError = error instanceof Error ? error.message : String(error);
            logger.error(`[CalendarJobManager] Job ${name} failed`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
        finally {
            status.isRunning = false;
            // Update next run time
            const cronJob = this.jobs.get(name);
            if (cronJob) {
                status.nextRun = cronJob.nextDate().toJSDate();
            }
        }
    }
    /**
     * Initialize job status
     */
    private initializeJobStatus(name: string): void {
        const cronJob = this.jobs.get(name);
        const nextRun = cronJob?.nextDate().toJSDate();

        const status: JobStatus = {
            name,
            isRunning: false,
            lastStatus: 'idle',
            runCount: 0,
            errorCount: 0
        };

        if (nextRun !== undefined) {
            status.nextRun = nextRun;
        }

        this.jobStatus.set(name, status);
    }
    /**
     * Log job schedules
     */
    private logJobSchedules(): void {
        logger.info('[CalendarJobManager] Job schedules:');
        this.jobs.forEach((job, name) => {
            const nextRun = job.nextDate();
            logger.info(`  ${name}: Next run at ${nextRun.toISO()}`);
        });
    }
    /**
     * Setup health check
     */
    private setupHealthCheck(): void {
        // Check job health every 5 minutes
        setInterval(() => {
            this.checkJobHealth();
        }, 5 * 60 * 1000);
    }
    /**
     * Check job health and report issues
     */
    private checkJobHealth(): void {
        const unhealthyJobs: string[] = [];
        this.jobStatus.forEach((status, name) => {
            // Check if job has too many errors
            if (status.errorCount > 5 && status.runCount > 0) {
                const errorRate = status.errorCount / status.runCount;
                if (errorRate > 0.5) {
                    unhealthyJobs.push(`${name} (error rate: ${Math.round(errorRate * 100)}%)`);
                }
            }
            // Check if job hasn't run recently
            if (status.lastRun) {
                const hoursSinceLastRun = (Date.now() - status.lastRun.getTime()) / (1000 * 60 * 60);
                // Expected run frequency based on schedule
                const expectedHours = this.getExpectedRunFrequency(name);
                if (hoursSinceLastRun > expectedHours * 2) {
                    unhealthyJobs.push(`${name} (last run: ${hoursSinceLastRun.toFixed(1)} hours ago)`);
                }
            }
        });
        if (unhealthyJobs.length > 0) {
            logger.error('[CalendarJobManager] Unhealthy jobs detected', {
                jobs: unhealthyJobs
            });
        }
    }
    /**
     * Get expected run frequency in hours
     */
    private getExpectedRunFrequency(jobName: string): number {
        switch (jobName) {
            case 'sync':
                return 1; // Hourly
            case 'detection':
                return 0.25; // Every 15 minutes
            case 'maintenance':
                return 24; // Daily
            case 'notifications':
                return 12; // Twice daily
            default:
                return 24;
        }
    }
    /**
     * Get job status
     */
    getJobStatus(): Map<string, JobStatus> {
        return new Map(this.jobStatus);
    }
    /**
     * Manually trigger a job
     */
    async triggerJob(name: string): Promise<AsyncResult<void, Error>> {
        if (!this.jobs.has(name)) {
            return createErrorResult(new Error(`Job ${name} not found`));
        }
        logger.info(`[CalendarJobManager] Manually triggering job: ${name}`);
        try {
            await this.runJob(name, async () => {
                switch (name) {
                    case 'sync':
                        await this.workers.sync.processCalendarSync();
                        break;
                    case 'detection':
                        await this.workers.detection.detectNewReleases();
                        break;
                    case 'maintenance':
                        await this.workers.maintenance.performMaintenance({
                            daysToKeep: this.config.config.maintenanceDaysToKeep
                        });
                        break;
                    case 'notifications':
                        await this.workers.notifications.sendScheduledNotifications({
                            leadTimeHours: this.config.config.notificationLeadTime
                        });
                        break;
                    default: throw new ValidationError(`Unknown job: ${name}`);
                }
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Update job schedule
     */
    updateJobSchedule(name: string, schedule: string): AsyncResult<void, Error> {
        const job = this.jobs.get(name);
        if (!job) {
            return createErrorResult(new Error(`Job ${name} not found`));
        }
        try {
            // Stop the old job
            void job.stop();
            // Get existing job callback
            const jobWithCallbacks = job as unknown as { callbacks?: Array<() => Promise<void>> };
            const existingCallback = jobWithCallbacks.callbacks?.[0];
            if (!existingCallback) {
                return createErrorResult(new Error(`Job ${name} has no callback`));
            }
            // Create new job with updated schedule
            const jobWithTimeZone = job as unknown as { cronTime?: { timeZone?: string } };
            const newJob = new CronJob(schedule, existingCallback, null, false, jobWithTimeZone.cronTime?.timeZone ?? 'UTC');
            // Replace and start
            this.jobs.set(name, newJob);
            newJob.start();
            // Update config
            const schedulesRecord = this.config.schedules as Record<string, string>;
            schedulesRecord[name] = schedule;
            logger.info(`[CalendarJobManager] Updated schedule for job ${name}: ${schedule}`);
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
// Export singleton instance
export const calendarJobManager = new CalendarJobManager();
