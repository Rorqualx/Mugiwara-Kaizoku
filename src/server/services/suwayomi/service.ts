/**
 * Suwayomi Service - Main Service Class
 *
 * This service orchestrates Suwayomi Server lifecycle and operations.
 * Implementation delegated to specialized modules:
 * - types.ts: Interfaces, constants
 * - java-manager.ts: Java availability checking
 * - lifecycle-manager.ts: Server start/stop
 * - installer.ts: Server download
 * - source-manager.ts: Extension operations
 *
 * @example
 * const service = suwayomiService;
 * await service.startServer();
 */

import * as fs from 'fs';
import * as path from 'path';

import { flareSolverrConfigService } from '@/server/services/flaresolverr/configService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

import { suwayomiConfigService } from './configService';
import { getSuwayomiGraphQLClient } from './graphql/client';
import { suwayomiSecurityService } from './security.service';
import { KEIYOUSHI_REPO_URL, patchServerConfFile, type ServerConfPatch } from './server-conf-patcher';
import { downloadServerIfNeeded } from './suwayomi-service/installer';
import {
  checkJavaAvailability,
  getJavaStatus,
  createJavaManagerState,
  type JavaManagerState,
} from './suwayomi-service/java-manager';
import {
  startServer as startServerLifecycle,
  stopServer as stopServerLifecycle,
  type HealthCheckClient,
} from './suwayomi-service/lifecycle-manager';
import {
  SuwayomiSupervisor,
  type SupervisorEvent,
  type SupervisorStatus,
} from './suwayomi-service/supervisor';
import {
  DEFAULT_SUWAYOMI_PORT,
  type JavaStatus,
  type SuwayomiServiceConfig,
} from './suwayomi-service/types';


import type { ChildProcess } from 'child_process';

/** Build a HealthCheckClient that delegates to the urql-based GraphQL client. */
function createGraphQLHealthClient(getPort: () => number): HealthCheckClient {
  return {
    checkServerHealth: async (): Promise<boolean> => {
      const port = getPort();
      const client = getSuwayomiGraphQLClient({
        httpUrl: `http://localhost:${port}/api/graphql`,
        wsUrl: `ws://localhost:${port}/api/graphql`,
      });
      return client.checkServerHealth();
    },
  };
}

/**
 * Service for managing Suwayomi Server lifecycle and operations
 *
 * This service handles:
 * - Server installation and updates
 * - Process management (start/stop/status)
 * - Configuration management
 * - Java dependency verification
 * - Download management
 * - Source extension management
 */
class SuwayomiService {
  private serverProcess: ChildProcess | null = null;
  private isRunning = false;
  private serverUrl = 'http://localhost:4567';
  private serverPath: string;
  private configPath: string;
  private port = DEFAULT_SUWAYOMI_PORT;
  private javaState: JavaManagerState;
  private healthClient: HealthCheckClient;
  private supervisor: SuwayomiSupervisor;
  /**
   * Set when a start is mid-flight; concurrent callers (manual + supervised
   * restart) wait on this promise instead of double-spawning the JVM.
   */
  private startInFlight: Promise<boolean> | null = null;

  constructor() {
    const appDataPath = path.join(process.cwd(), 'data');
    this.serverPath = path.join(appDataPath, 'suwayomi-server');
    this.configPath = path.join(appDataPath, 'suwayomi-config');
    this.healthClient = createGraphQLHealthClient(() => this.port);
    this.javaState = createJavaManagerState();
    this.supervisor = new SuwayomiSupervisor({
      startServer: () => this.startServerInternal(),
      isEnabled: async () => (await suwayomiConfigService.loadConfig()).enabled,
      emitEvent: (event) => this.emitSupervisorEvent(event),
    });

    // Ensure directories exist
    if (!fs.existsSync(this.serverPath)) {
      fs.mkdirSync(this.serverPath, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }

    // Check Java availability on startup
    void this.checkJavaAvailabilityInternal();

    // Disable the supervisor on Node-process shutdown so the lifecycle's
    // own SIGTERM cleanup doesn't get treated as a crash and trigger a
    // spurious restart attempt.
    process.once('exit', () => this.supervisor.notifyShutdown());
    process.once('SIGINT', () => this.supervisor.notifyShutdown());
    process.once('SIGTERM', () => this.supervisor.notifyShutdown());
  }

  /**
   * Forward supervisor events as websocket emits so the UI can render
   * "Restarting…" / "Crash-looping" banners without polling.
   */
  private emitSupervisorEvent(event: SupervisorEvent): void {
    void realtimeEmitter.emitSystemEvent({
      eventType: `suwayomi:supervisor:${event.type}`,
      source: 'SuwayomiSupervisor',
      message: event.message,
      data: event.data,
    });
  }

  /**
   * Get the Suwayomi API client instance
   */
  /**
   * Check Java availability (internal method)
   */
  private async checkJavaAvailabilityInternal(): Promise<{
    available: boolean;
    version: string | null;
  }> {
    const checkResult = await checkJavaAvailability(this.javaState);
    // Apply state updates
    if (checkResult.updatedState.javaAvailable !== undefined) {
      this.javaState.javaAvailable = checkResult.updatedState.javaAvailable;
    }
    if (checkResult.updatedState.javaVersion !== undefined) {
      this.javaState.javaVersion = checkResult.updatedState.javaVersion;
    }
    if (checkResult.updatedState.lastJavaCheckTime !== undefined) {
      this.javaState.lastJavaCheckTime = checkResult.updatedState.lastJavaCheckTime;
    }
    return { available: checkResult.result.available, version: checkResult.result.version };
  }

  /**
   * Get detailed Java installation status
   */
  async getJavaStatus(): Promise<JavaStatus> {
    return getJavaStatus(() => this.checkJavaAvailabilityInternal());
  }

  /**
   * Update service configuration settings
   */
  updateConfig(options: Partial<SuwayomiServiceConfig>): void {
    if (options.serverPath) {
      this.serverPath = options.serverPath;
      if (!fs.existsSync(this.serverPath)) {
        fs.mkdirSync(this.serverPath, { recursive: true });
      }
    }
    if (options.configPath) {
      this.configPath = options.configPath;
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }
    }
    if (options.port) {
      this.port = options.port;
      this.serverUrl = `http://localhost:${this.port}`;
    }
  }

  /**
   * Update advanced configuration options
   */
  updateAdvancedConfig(config: unknown): void {
    if (!config || typeof config !== 'object') {
      throw new TypeError('Advanced config must be an object');
    }
    suwayomiConfigService.updateAdvancedConfig(config as Record<string, unknown>);
    if (this.isRunning) {
      logger.info('Some advanced settings may require a server restart to take effect');
    }
  }

  /**
   * Download the latest Suwayomi-Server release
   */
  async downloadServerIfNeeded(): Promise<boolean> {
    return downloadServerIfNeeded(this.serverPath, suwayomiSecurityService);
  }

  /**
   * Patch `<configPath>/server.conf` with Kaizoku's preferred defaults:
   * the keiyoushi extension catalog and (when enabled) FlareSolverr routing.
   * Idempotent — never overwrites user-customized values.
   */
  private async bootstrapSuwayomiConfig(port: number): Promise<void> {
    const fsEnabled = await flareSolverrConfigService.isEnabled();
    const patch: ServerConfPatch = {
      ensureExtensionRepos: [KEIYOUSHI_REPO_URL],
    };
    if (fsEnabled) {
      const rawUrl = await flareSolverrConfigService.getUrl();
      // Suwayomi expects the FlareSolverr base URL without a `/v1` suffix
      // (it appends its own path). Strip any `/vN` segment.
      patch.flareSolverrEnabled = true;
      patch.flareSolverrUrl = rawUrl.replace(/\/v\d+\/?$/, '');
      patch.flareSolverrAsResponseFallback = true;
    }
    const confFilePath = path.join(this.configPath, 'server.conf');
    patchServerConfFile(confFilePath, patch, port);
  }

  /**
   * Trigger Suwayomi to scrape the configured extension repos. Fire-and-forget;
   * the resulting catalog is read by `getExtensions` queries. Safe to call
   * before health is fully green — the GraphQL client retries until the
   * server answers.
   */
  async prefetchExtensionCatalog(): Promise<void> {
    try {
      const client = getSuwayomiGraphQLClient({
        httpUrl: `http://localhost:${this.port}/api/graphql`,
        wsUrl: `ws://localhost:${this.port}/api/graphql`,
      });
      const ok = await client.fetchExtensionCatalog();
      logger.info('Suwayomi extension catalog prefetched', { ok });
    } catch (err) {
      logger.warn('prefetchExtensionCatalog failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Start the Suwayomi-Server process (public entry point).
   *
   * Resets the supervisor's failure budget and any pending restart so a
   * user-driven Start always begins from a clean slate. The supervised
   * restart path uses {@link startServerInternal} instead.
   */
  async startServer(): Promise<boolean> {
    this.supervisor.notifyManualStart();
    return this.startServerInternal();
  }

  /**
   * Internal start path shared by the public entry point and the
   * supervisor. Does NOT reset supervisor state. Coalesces concurrent
   * callers via {@link startInFlight} so manual and supervised restarts
   * can't race into duplicate spawns.
   */
  private startServerInternal(): Promise<boolean> {
    if (this.isRunning) {
      logger.info('Suwayomi-Server is already running');
      return Promise.resolve(true);
    }
    if (this.startInFlight) {
      logger.info('Suwayomi-Server start already in flight; awaiting existing attempt');
      return this.startInFlight;
    }
    this.startInFlight = this.doStartServer().finally(() => {
      this.startInFlight = null;
    });
    return this.startInFlight;
  }

  /**
   * Actual start work. Wrapped by {@link startServerInternal} for locking.
   */
  private async doStartServer(): Promise<boolean> {
    if (this.isRunning) {
      logger.info('Suwayomi-Server is already running');
      return true;
    }

    // Check Java availability first
    if (this.javaState.javaAvailable === null) {
      await this.checkJavaAvailabilityInternal();
    }
    if (this.javaState.javaAvailable === false) {
      logger.error('Cannot start Suwayomi-Server: Java is not installed');
      return false;
    }

    // Load the latest config with default values
    const config = await suwayomiConfigService.loadConfig();
    this.updateConfig({
      serverPath: config.serverPath,
      configPath: config.configPath,
      port: config.port,
    });

    // Ensure server is downloaded
    const isDownloaded = await this.downloadServerIfNeeded();
    if (!isDownloaded) {
      return false;
    }

    // Bootstrap server.conf: keiyoushi repo + FlareSolverr routing.
    // Idempotent — never clobbers user-customized values.
    await this.bootstrapSuwayomiConfig(config.port);

    // Build context for lifecycle manager
    const context = {
      isRunning: this.isRunning,
      javaAvailable: this.javaState.javaAvailable,
      serverPath: this.serverPath,
      configPath: this.configPath,
      port: this.port,
      serverProcess: this.serverProcess,
      downloadManager: null,
      client: this.healthClient,
      checkJavaAvailability: async (): Promise<void> => {
        await this.checkJavaAvailabilityInternal();
      },
      downloadServerIfNeeded: async (): Promise<boolean> => {
        return this.downloadServerIfNeeded();
      },
      updateConfig: (cfg: { serverPath: string; configPath: string; port: number }): void => {
        this.updateConfig(cfg);
      },
      loadConfig: async (): Promise<{ serverPath: string; configPath: string; port: number }> => {
        return suwayomiConfigService.loadConfig();
      },
      getAdvancedConfig: (): Record<string, unknown> => {
        return suwayomiConfigService.getAdvancedConfig();
      },
      createSandboxedProcess: async (
        cmd: string,
        jarPath: string,
        args: string[]
      ): Promise<Record<string, unknown> | null> => {
        return suwayomiSecurityService.createSandboxedProcess(cmd, jarPath, args);
      },
      onProcessClose: (exitCode: number | null): void => {
        // Clear our process handle as soon as the JVM is gone, regardless
        // of intent — the supervisor decides whether to restart.
        this.serverProcess = null;
        this.isRunning = false;
        this.supervisor.handleProcessClose(exitCode);
      },
    };

    const result = await startServerLifecycle(context);

    // Update state from result
    this.serverProcess = result.serverProcess;
    this.isRunning = result.isRunning;

    if (result.success) {
      this.supervisor.notifyServerStarted();
    }

    // Reachability cache (server-reachable.ts) holds the last probe result
    // for 60s. On boot the indexer-search and download-fallback paths often
    // probe BEFORE startServer's health-check loop returns, get a `false`,
    // and then keep returning that stale value for the rest of the minute
    // even though Suwayomi is now answering. Same on a stop→start cycle.
    // Invalidate explicitly so the next consumer re-probes.
    const { invalidateSuwayomiReachabilityCache } = await import('./server-reachable');
    invalidateSuwayomiReachabilityCache();

    // Emit WebSocket event for server status change
    void realtimeEmitter.emitSystemEvent({
      eventType: result.success ? 'suwayomi:server:started' : 'suwayomi:server:start:failed',
      source: 'SuwayomiService',
      message: result.success ? 'Suwayomi Server started' : 'Suwayomi Server failed to start',
      data: { isRunning: this.isRunning, port: this.port }
    });

    return result.success;
  }

  /**
   * Stop the Suwayomi-Server process
   */
  async stopServer(): Promise<boolean> {
    // Signal the supervisor BEFORE the kill so the resulting close event
    // is treated as expected and doesn't trigger an auto-restart.
    this.supervisor.notifyIntentionalStop();

    if (!this.isRunning || !this.serverProcess) {
      logger.info('Suwayomi-Server is not running');
      return true;
    }

    const result = await stopServerLifecycle({
      isRunning: this.isRunning,
      serverProcess: this.serverProcess,
      downloadManager: null,
      serverUrl: this.serverUrl,
    });

    // Update state from result
    this.serverProcess = result.serverProcess;
    this.isRunning = result.isRunning;

    // Same reasoning as startServer — invalidate so the cache doesn't
    // hold a stale `true` after a clean shutdown.
    const { invalidateSuwayomiReachabilityCache } = await import('./server-reachable');
    invalidateSuwayomiReachabilityCache();

    // Emit WebSocket event for server stopped
    void realtimeEmitter.emitSystemEvent({
      eventType: 'suwayomi:server:stopped',
      source: 'SuwayomiService',
      message: 'Suwayomi Server stopped',
      data: { isRunning: this.isRunning }
    });

    return result.success;
  }

  /**
   * Check if server is currently running and healthy.
   *
   * Always probes the health endpoint, even when the in-memory `this.isRunning`
   * flag is false. The flag is reset when the Node process restarts (dev
   * hot-reload, restart hook), but the JVM child process is often re-parented
   * to PID 1 and is still serving on its port — skipping the probe on a false
   * flag would falsely report the server stopped, which is what users see as
   * "Server stopped" persisting across page navigation in dev mode.
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const isHealthy = await this.healthClient.checkServerHealth();
      this.isRunning = isHealthy;
      return isHealthy;
    } catch {
      this.isRunning = false;
      return false;
    }
  }

  /** Port the server was last started on (or the default if never started). */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the base URL for the Suwayomi server
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /** Snapshot of supervisor state for diagnostics / UI. */
  getSupervisorStatus(): SupervisorStatus {
    return this.supervisor.getStatus();
  }

  /**
   * Probe-and-recover entry point used by the dispatch path.
   *
   * Returns true if the server is currently healthy. If it isn't AND the
   * integration is enabled AND the supervisor isn't crash-looping, fires
   * a synchronous start attempt so callers can proceed in the same tick
   * once the JVM is ready.
   */
  async ensureServerRunningOrRestart(): Promise<boolean> {
    if (await this.isServerRunning()) return true;

    const config = await suwayomiConfigService.loadConfig();
    if (!config.enabled) return false;

    const supervisorStatus = this.supervisor.getStatus();
    if (supervisorStatus.crashLooping) {
      logger.warn(
        '[suwayomi-supervisor] ensureServerRunningOrRestart: skipping; supervisor in crash-loop state',
      );
      return false;
    }

    logger.info('[suwayomi-supervisor] ensureServerRunningOrRestart: server down, attempting start');
    return this.startServer();
  }

}

export const suwayomiService = new SuwayomiService();
