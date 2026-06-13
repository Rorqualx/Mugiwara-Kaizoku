/**
 * Suwayomi Health Monitor — auto-detect & self-heal a wedged server.
 *
 * The supervisor ({@link ../suwayomi-service/supervisor}) already restarts the
 * JVM when the child process *exits*. But the failure mode that actually bites
 * users in production is subtler: the process stays alive and keeps accepting
 * TCP connections, yet stops answering GraphQL queries (a hung/deadlocked JVM).
 * In that state nothing exits, so the supervisor never fires — and every
 * indexer-search and download-fallback path silently skips Suwayomi because the
 * reachability probe times out. Coverage quietly drops to whatever other
 * sources can serve (the 2026-06-13 Bleach trigger covered 6/711 chapters for
 * exactly this reason: 687 chapters were Suwayomi-bound and the server was
 * wedged).
 *
 * This monitor closes that gap. On an interval it issues a fresh, bounded
 * responsiveness probe. After {@link HealthMonitorConfig.unhealthyThreshold}
 * consecutive failures — while the server is *supposed* to be up and isn't
 * mid-(re)start — it asks the service to recover (kill the wedged JVM; the
 * supervisor's existing crash-restart path, with its backoff and 5-failure
 * circuit breaker, brings it back). Detection is decoupled from recovery via
 * injected deps so this is unit-testable without timers or a live JVM.
 *
 * @module server/services/suwayomi/health-monitor
 */

import { logger } from '@/utils/logger';

const log = logger.child('SuwayomiHealthMonitor');

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Why a tick declined to act — surfaced for logging/tests. */
export type IneligibleReason =
  | 'disabled'
  | 'not-running'
  | 'start-in-flight'
  | 'restart-scheduled'
  | 'crash-looping'
  | 'warmup-grace';

/** Result of the eligibility gate: either "go probe" or "skip, here's why". */
export type Eligibility = { run: true } | { run: false; reason: IneligibleReason };

export interface HealthMonitorDeps {
  /**
   * Uncached, bounded responsiveness probe. Resolves `true` only if the
   * server answered a real query within the probe timeout. Must never throw.
   */
  probe: () => Promise<boolean>;
  /**
   * Whether this tick should probe at all. Returns `{ run: false }` when the
   * integration is disabled, the server isn't believed up, a (re)start is in
   * flight or scheduled, the supervisor has given up (crash-looping), or the
   * server is still inside its post-start warmup window.
   */
  isEligible: () => Promise<Eligibility>;
  /**
   * Recover an unresponsive-but-alive server. Implementations kill the wedged
   * JVM so the supervisor's crash-restart path heals it. Must never throw.
   */
  recover: (reason: string) => Promise<void>;
}

export interface HealthMonitorConfig {
  /** Probe cadence in ms. */
  intervalMs: number;
  /** Consecutive probe failures before recovery is triggered. */
  unhealthyThreshold: number;
}

export interface HealthMonitorMetrics {
  probesRun: number;
  probeFailures: number;
  recoveriesTriggered: number;
  consecutiveFailures: number;
  /** ms-epoch of the last successful probe, or null if never. */
  lastHealthyAt: number | null;
  running: boolean;
}

const DEFAULTS: HealthMonitorConfig = {
  intervalMs: readPositiveIntEnv('SUWAYOMI_HEALTH_INTERVAL_MS', 30_000),
  unhealthyThreshold: readPositiveIntEnv('SUWAYOMI_HEALTH_THRESHOLD', 3),
};

export class SuwayomiHealthMonitor {
  private readonly config: HealthMonitorConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private lastHealthyAt: number | null = null;
  private probesRun = 0;
  private probeFailures = 0;
  private recoveriesTriggered = 0;
  /** Guards against overlapping ticks if a probe/recover runs long. */
  private checkInFlight = false;

  constructor(
    private readonly deps: HealthMonitorDeps,
    config: Partial<HealthMonitorConfig> = {},
  ) {
    this.config = { ...DEFAULTS, ...config };
  }

  /** Begin periodic health checks. Idempotent. */
  start(): void {
    if (this.timer !== null) return;
    this.consecutiveFailures = 0;
    log.info('Starting Suwayomi health monitor', {
      intervalMs: this.config.intervalMs,
      unhealthyThreshold: this.config.unhealthyThreshold,
    });
    const timer = setInterval(() => {
      void this.runCheckOnce();
    }, this.config.intervalMs);
    // Don't let the health timer keep the event loop (and the Node process)
    // alive on its own during shutdown.
    timer.unref();
    this.timer = timer;
  }

  /** Stop periodic health checks and reset the failure streak. Idempotent. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.consecutiveFailures = 0;
  }

  /** True while the interval is armed. */
  isRunning(): boolean {
    return this.timer !== null;
  }

  getMetrics(): HealthMonitorMetrics {
    return {
      probesRun: this.probesRun,
      probeFailures: this.probeFailures,
      recoveriesTriggered: this.recoveriesTriggered,
      consecutiveFailures: this.consecutiveFailures,
      lastHealthyAt: this.lastHealthyAt,
      running: this.timer !== null,
    };
  }

  /**
   * Run a single health check. Public so tests can drive it directly without
   * waiting on the interval. Never throws — probe/recover failures are logged
   * and swallowed so one bad tick can't kill the monitor.
   */
  async runCheckOnce(): Promise<void> {
    if (this.checkInFlight) return;
    this.checkInFlight = true;
    try {
      await this.tick();
    } catch (err: unknown) {
      log.warn('Health check tick errored (ignored)', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.checkInFlight = false;
    }
  }

  private async tick(): Promise<void> {
    const eligibility = await this.deps.isEligible();
    if (!eligibility.run) {
      // Not the server's fault it's unreachable (disabled / mid-restart /
      // warming up) — don't accumulate failures toward a recovery.
      this.consecutiveFailures = 0;
      return;
    }

    this.probesRun++;
    const healthy = await this.deps.probe();
    if (healthy) {
      this.onHealthy();
      return;
    }
    await this.onUnhealthy();
  }

  private onHealthy(): void {
    if (this.consecutiveFailures > 0) {
      log.info('Suwayomi responsive again; clearing failure streak', {
        previousStreak: this.consecutiveFailures,
      });
    }
    this.consecutiveFailures = 0;
    this.lastHealthyAt = Date.now();
  }

  private async onUnhealthy(): Promise<void> {
    this.probeFailures++;
    this.consecutiveFailures++;
    log.warn('Suwayomi health probe failed', {
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.config.unhealthyThreshold,
    });

    if (this.consecutiveFailures < this.config.unhealthyThreshold) return;

    const reason = `unresponsive: ${this.consecutiveFailures} consecutive health probes failed`;
    // Reset BEFORE awaiting recover so a long recovery can't double-fire, and
    // the next streak is measured against the freshly-restarted server.
    this.consecutiveFailures = 0;
    this.recoveriesTriggered++;
    log.error('Suwayomi unresponsive past threshold; triggering self-heal', { reason });
    await this.deps.recover(reason);
  }
}
