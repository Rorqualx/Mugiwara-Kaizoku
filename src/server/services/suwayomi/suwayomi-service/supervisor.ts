/**
 * Suwayomi Server Supervisor
 *
 * Watches the JVM child-process lifecycle and respawns it on unexpected
 * exits. Backoff cap (5 consecutive failures) prevents thrash if the JVM
 * is genuinely broken; counter resets to zero after the server has been
 * healthy for a configurable interval.
 *
 * Wiring:
 * - `notifyServerStarted()` after a successful start (resets stop intent,
 *   schedules the healthy-reset timer).
 * - `notifyIntentionalStop()` from `stopServer()` and shutdown handlers,
 *   so the next close event is treated as expected.
 * - `notifyManualStart()` when the user clicks Start in the UI — clears
 *   the failure budget so the supervisor doesn't carry stale crash state
 *   into a fresh user-driven attempt.
 * - `handleProcessClose(exitCode)` from the lifecycle-manager's `onClose`
 *   plumbing — the entry point for crash detection.
 * - `notifyShutdown()` from process-level SIGINT/SIGTERM/exit handlers,
 *   so we don't try to restart while Node is going down.
 *
 * @module suwayomi-service/supervisor
 */

import { logger } from '@/utils/logger';

const log = logger.child('SuwayomiSupervisor');

/**
 * Backoff schedule between restart attempts. Index N is consulted on the
 * Nth attempt (zero-based). Values past the last index reuse the last
 * value (5min ceiling).
 */
const RESTART_BACKOFF_MS: readonly number[] = [
    1_000,
    5_000,
    15_000,
    60_000,
    300_000,
];

/**
 * Hard cap on consecutive restart attempts. After this many in a row
 * (without the healthy-reset timer firing), the supervisor disables itself
 * and the user has to click Start to re-arm.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * How long the server must run uninterrupted before we clear the failure
 * counter. 5 minutes is conservative — long enough to filter out
 * crash-on-startup loops, short enough that a transient blip doesn't
 * permanently penalize the JVM.
 */
const HEALTHY_RESET_MS = 5 * 60 * 1000;

export interface SupervisorEvent {
    type:
        | 'restart-scheduled'
        | 'restart-attempted'
        | 'crash-looping'
        | 'failure-counter-reset';
    message: string;
    data: Record<string, unknown>;
}

export interface SupervisorDeps {
    /**
     * Restart entry point. Implementations should call the supervised
     * variant of startServer that does NOT reset supervisor state.
     */
    startServer: () => Promise<boolean>;
    /** Returns whether the integration is currently enabled in config. */
    isEnabled: () => Promise<boolean>;
    /** Surface supervisor events (logging, websocket emit, etc.). */
    emitEvent: (event: SupervisorEvent) => void;
}

export interface SupervisorStatus {
    active: boolean;
    unhealthyCount: number;
    restartScheduled: boolean;
    crashLooping: boolean;
}

export class SuwayomiSupervisor {
    private active = false;
    private intentionalStop = false;
    private unhealthyCount = 0;
    private restartTimer: NodeJS.Timeout | null = null;
    private healthyResetTimer: NodeJS.Timeout | null = null;
    private crashLooping = false;

    constructor(private readonly deps: SupervisorDeps) {}

    /** Lifecycle event: server reached healthy state after a start. */
    notifyServerStarted(): void {
        this.active = true;
        this.intentionalStop = false;
        this.crashLooping = false;
        this.scheduleHealthyReset();
    }

    /** Lifecycle event: user/shutdown asked the server to stop. */
    notifyIntentionalStop(): void {
        this.intentionalStop = true;
        this.active = false;
        this.unhealthyCount = 0;
        this.crashLooping = false;
        this.cancelPendingRestart();
        this.cancelHealthyReset();
    }

    /**
     * Lifecycle event: user clicked Start in the UI. Clears failure budget
     * and pending restart so a manual attempt always gets a clean slate.
     */
    notifyManualStart(): void {
        this.cancelPendingRestart();
        this.unhealthyCount = 0;
        this.intentionalStop = false;
        this.crashLooping = false;
    }

    /**
     * Process event: the JVM child process closed. Decides whether to
     * schedule a restart based on intent and failure budget.
     */
    handleProcessClose(exitCode: number | null): void {
        this.cancelHealthyReset();
        if (this.intentionalStop) {
            log.info('JVM stopped intentionally; not restarting');
            this.intentionalStop = false;
            this.unhealthyCount = 0;
            return;
        }
        if (!this.active) {
            log.info('JVM closed but supervisor not active');
            return;
        }
        void this.requestRestart(`process exited (code ${exitCode ?? 'null'})`);
    }

    /**
     * Process-level shutdown signal. Disables the supervisor so Node-exit
     * SIGTERMs don't trigger restart attempts during shutdown.
     */
    notifyShutdown(): void {
        if (!this.active) return;
        log.info('Node process shutting down; disabling supervisor');
        this.active = false;
        this.cancelPendingRestart();
        this.cancelHealthyReset();
    }

    getStatus(): SupervisorStatus {
        return {
            active: this.active,
            unhealthyCount: this.unhealthyCount,
            restartScheduled: this.restartTimer !== null,
            crashLooping: this.crashLooping,
        };
    }

    private async requestRestart(reason: string): Promise<void> {
        if (this.restartTimer) return; // already scheduled
        this.unhealthyCount += 1;

        if (!(await this.deps.isEnabled())) {
            log.info('Skipping restart; integration disabled', { reason });
            this.active = false;
            return;
        }

        if (this.unhealthyCount > MAX_CONSECUTIVE_FAILURES) {
            this.crashLooping = true;
            this.active = false;
            log.error('Max consecutive failures reached; auto-restart disabled', {
                failures: this.unhealthyCount - 1,
                reason,
            });
            this.deps.emitEvent({
                type: 'crash-looping',
                message: `Suwayomi crashed ${this.unhealthyCount - 1} times in a row. Auto-restart disabled — use the Start button to retry.`,
                data: { failures: this.unhealthyCount - 1, reason },
            });
            return;
        }

        const idx = Math.min(this.unhealthyCount - 1, RESTART_BACKOFF_MS.length - 1);
        const delayMs = RESTART_BACKOFF_MS[idx] ?? 60_000;

        log.warn('Scheduling restart', {
            reason,
            delayMs,
            attempt: this.unhealthyCount,
            max: MAX_CONSECUTIVE_FAILURES,
        });
        this.deps.emitEvent({
            type: 'restart-scheduled',
            message: `Suwayomi will restart in ${Math.round(delayMs / 1000)}s (attempt ${this.unhealthyCount}/${MAX_CONSECUTIVE_FAILURES})`,
            data: { delayMs, attempt: this.unhealthyCount, reason },
        });

        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            void this.attemptRestart();
        }, delayMs);
    }

    private async attemptRestart(): Promise<void> {
        log.info('Attempting supervised restart', { attempt: this.unhealthyCount });
        this.deps.emitEvent({
            type: 'restart-attempted',
            message: `Restarting Suwayomi (attempt ${this.unhealthyCount})`,
            data: { attempt: this.unhealthyCount },
        });

        const success = await this.deps.startServer();
        if (success) {
            log.info('Supervised restart succeeded', {
                attempt: this.unhealthyCount,
                pendingHealthyReset: HEALTHY_RESET_MS,
            });
            // notifyServerStarted is also called by the service after a
            // successful start; this is just defensive in case the wiring
            // ever drifts.
            this.scheduleHealthyReset();
            return;
        }

        // startServer returned false. If a process was spawned but failed
        // its readiness check, the close handler will trigger this path
        // again. If no process spawned (Java missing, JAR download failed),
        // we need to schedule the next attempt directly.
        void this.requestRestart('startServer returned false during supervised restart');
    }

    /**
     * Body of the healthy-reset timer. Extracted so the setTimeout callback
     * stays at depth 1.
     */
    private onHealthyResetTick(): void {
        this.healthyResetTimer = null;
        if (this.unhealthyCount === 0) return;
        const previousCount = this.unhealthyCount;
        this.unhealthyCount = 0;
        log.info('Server healthy for reset window; clearing failure counter', { previousCount });
        this.deps.emitEvent({
            type: 'failure-counter-reset',
            message: 'Suwayomi has been healthy long enough; failure counter reset',
            data: { previousCount },
        });
    }

    private scheduleHealthyReset(): void {
        this.cancelHealthyReset();
        this.healthyResetTimer = setTimeout(() => this.onHealthyResetTick(), HEALTHY_RESET_MS);
    }

    private cancelHealthyReset(): void {
        if (this.healthyResetTimer) {
            clearTimeout(this.healthyResetTimer);
            this.healthyResetTimer = null;
        }
    }

    private cancelPendingRestart(): void {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
    }
}

export const SUPERVISOR_CONSTANTS = {
    RESTART_BACKOFF_MS,
    MAX_CONSECUTIVE_FAILURES,
    HEALTHY_RESET_MS,
} as const;
