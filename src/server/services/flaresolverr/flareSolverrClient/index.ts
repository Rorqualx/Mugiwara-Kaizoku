/**
 * FlareSolverr Client
 *
 * Cloudflare bypass client with session management, automatic retry,
 * health checking, and lifecycle management.
 *
 * Now uses flaresolverr-go (Go binary) instead of Python.
 *
 * @module flaresolverr/flareSolverrClient
 */

import axios from 'axios';

import { recordHealthCheck, recordRequest } from '@/server/services/flaresolverr/metricsService';
import type {
  FlareSolverrApiResponse,
  FlareSolverrConfig,
  FlareSolverrCookie,
  FlareSolverrFetchOptions,
  FlareSolverrSession,
  FlareSolverrSolution,
} from '@/server/services/flaresolverr/types';
import { logger } from '@/utils/logger';

import {
  DEFAULT_CONFIG,
  MAX_CONSECUTIVE_FAILURES,
  RESTART_COOLDOWN_MS,
  MINIMUM_VERSION,
  HEALTH_CHECK_INTERVAL_MS,
} from './config';
import { delay, checkIsRunning, stopFlareSolverr, startFlareSolverr } from './lifecycle';
import { compareVersions } from './version-utils';

export { DEFAULT_CONFIG, MINIMUM_VERSION };

export class FlareSolverrClient {
  private config: FlareSolverrConfig;
  private sessions: Map<string, FlareSolverrSession>;
  private healthy: boolean | null = null;
  private lastHealthCheck: number = 0;
  private currentVersion: string | null = null;
  private versionOutdated: boolean = false;
  private consecutiveFailures: number = 0;
  private lastRestartAttempt: number = 0;
  private isRestarting: boolean = false;

  constructor(config?: Partial<FlareSolverrConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessions = new Map();
    logger.info('[FlareSolverr] Client initialized', {
      url: this.config.url,
      enabled: this.config.enabled,
      timeout: this.config.timeout,
    });
  }

  private checkVersionOutdated(version: string): void {
    const isOutdated = compareVersions(version, MINIMUM_VERSION) < 0;
    if (isOutdated && !this.versionOutdated) {
      logger.warn('[FlareSolverr] Version may be outdated', {
        currentVersion: version,
        minimumVersion: MINIMUM_VERSION,
      });
    }
    this.versionOutdated = isOutdated;
  }

  private processHealthyResponse(response: FlareSolverrApiResponse): void {
    const version = response.version ?? null;
    this.currentVersion = version;
    if (version) this.checkVersionOutdated(version);
    const sessionCount = response.sessions ? response.sessions.length : 0;
    logger.debug('[FlareSolverr] Health check passed', { version, sessions: sessionCount });
  }

  async isHealthy(): Promise<boolean> {
    if (!this.config.enabled) return false;

    const now = Date.now();
    if (this.healthy !== null && now - this.lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
      return this.healthy;
    }

    const startTime = Date.now();
    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url,
        { cmd: 'sessions.list' },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
      );

      const responseTimeMs = Date.now() - startTime;
      this.healthy = response.data.status === 'ok';
      this.lastHealthCheck = now;

      if (this.healthy) {
        this.processHealthyResponse(response.data);
      }

      // Record health check metrics
      const healthCheckData: Parameters<typeof recordHealthCheck>[0] = {
        healthy: this.healthy,
        responseTimeMs,
        sessionCount: response.data.sessions?.length ?? 0,
      };
      if (response.data.version) {
        healthCheckData.version = response.data.version;
      }
      if (!this.healthy && response.data.message) {
        healthCheckData.errorMessage = response.data.message;
      }
      void recordHealthCheck(healthCheckData);

      return this.healthy;
    } catch (error: unknown) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('[FlareSolverr] Health check failed', { error: errorMessage });
      this.healthy = false;
      this.lastHealthCheck = now;

      // Record failed health check metrics
      void recordHealthCheck({
        healthy: false,
        responseTimeMs,
        sessionCount: 0,
        errorMessage: errorMessage,
      });

      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    if (!this.config.enabled) return null;
    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url,
        { cmd: 'sessions.list' },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      return response.data.version ?? null;
    } catch {
      return null;
    }
  }

  isVersionOutdated(): boolean | null {
    return this.currentVersion === null ? null : this.versionOutdated;
  }

  getVersionInfo(): { currentVersion: string | null; minimumVersion: string; isOutdated: boolean | null } {
    return { currentVersion: this.currentVersion, minimumVersion: MINIMUM_VERSION, isOutdated: this.isVersionOutdated() };
  }

  private storeNewSession(name: string, sessionId: string): void {
    const session: FlareSolverrSession = {
      id: sessionId,
      domain: '',
      cookies: [],
      userAgent: '',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.sessionTTL,
    };
    this.sessions.set(name, session);
    logger.info('[FlareSolverr] Session created', { name, id: session.id });
  }

  async createSession(name: string): Promise<string | null> {
    if (!this.config.enabled) return null;

    const existing = this.sessions.get(name);
    if (existing && existing.expiresAt > Date.now()) {
      logger.debug('[FlareSolverr] Reusing existing session', { name, id: existing.id });
      return existing.id;
    }

    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url,
        { cmd: 'sessions.create', session: name },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      if (response.data.status === 'ok' && response.data.session) {
        this.storeNewSession(name, response.data.session);
        return response.data.session;
      }
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Failed to create session', { name, error: errorMessage });
      return null;
    }
  }

  async destroySession(name: string): Promise<boolean> {
    if (!this.config.enabled) return false;
    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url,
        { cmd: 'sessions.destroy', session: name },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      this.sessions.delete(name);
      if (response.data.status === 'ok') {
        logger.info('[FlareSolverr] Session destroyed', { name });
        return true;
      }
      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FlareSolverr] Failed to destroy session', { name, error: errorMessage });
      return false;
    }
  }

  async listSessions(): Promise<string[]> {
    if (!this.config.enabled) return [];
    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url,
        { cmd: 'sessions.list' },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      return response.data.sessions ?? [];
    } catch {
      return [];
    }
  }

  private isStaleSessionError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes("'nonetype' object has no attribute") ||
      lower.includes('session not found') ||
      lower.includes('browser disconnected') ||
      lower.includes('target closed')
    );
  }

  private buildRequestBody(url: string, options: FlareSolverrFetchOptions, timeout: number): Record<string, unknown> {
    const body: Record<string, unknown> = {
      cmd: options.method === 'POST' ? 'request.post' : 'request.get',
      url,
      maxTimeout: timeout,
    };
    if (options.session) body['session'] = options.session;
    const cookies = options.cookies;
    if (cookies && cookies.length > 0) body['cookies'] = cookies;
    if (options.returnOnlyCookies) body['returnOnlyCookies'] = true;
    if (options.postData) body['postData'] = options.postData;
    if (options.returnScreenshot) body['returnScreenshot'] = true;
    if (options.disableMedia ?? this.config.disableMedia) body['disableMedia'] = true;
    const waitSecs = options.waitInSeconds ?? (this.config.defaultWaitSeconds > 0 ? this.config.defaultWaitSeconds : undefined);
    if (waitSecs !== undefined) body['waitInSeconds'] = waitSecs;
    return body;
  }

  private createErrorResult(errorMessage: string): {
    html: null; cookies: FlareSolverrCookie[]; userAgent: string; status: number; error: string; isStaleSession: boolean;
  } {
    return { html: null, cookies: [], userAgent: '', status: 0, error: errorMessage, isStaleSession: this.isStaleSessionError(errorMessage) };
  }

  private updateSessionCache(url: string, sessionId: string | undefined, solution: FlareSolverrSolution): void {
    if (!sessionId || solution.cookies.length === 0) return;
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cookies = solution.cookies;
      session.userAgent = solution.userAgent;
      session.domain = new URL(url).hostname;
    }
  }

  private buildSuccessResult(solution: FlareSolverrSolution): {
    html: string; cookies: FlareSolverrCookie[]; userAgent: string; status: number; screenshot?: string;
  } {
    const base = { html: solution.response, cookies: solution.cookies, userAgent: solution.userAgent, status: solution.status };
    return typeof solution.screenshot === 'string' ? { ...base, screenshot: solution.screenshot } : base;
  }

  private async fetchInternal(url: string, options: FlareSolverrFetchOptions, timeout: number): Promise<{
    html: string | null; cookies: FlareSolverrCookie[]; userAgent: string; status: number;
    screenshot?: string; error?: string; isStaleSession?: boolean;
  }> {
    const requestBody = this.buildRequestBody(url, options, timeout);
    try {
      const response = await axios.post<FlareSolverrApiResponse>(
        this.config.url, requestBody, { headers: { 'Content-Type': 'application/json' }, timeout: timeout + 10000 }
      );
      if (response.data.status !== 'ok' || !response.data.solution) {
        const msg = response.data.message;
        const message = msg && msg.length > 0 ? msg : 'Unknown error';
        logger.warn('[FlareSolverr] Request failed', { url, status: response.data.status, message });
        return this.createErrorResult(message);
      }
      this.updateSessionCache(url, options.session, response.data.solution);
      return this.buildSuccessResult(response.data.solution);
    } catch (error: unknown) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  async fetch(url: string, options: FlareSolverrFetchOptions = {}): Promise<{
    html: string | null; cookies: FlareSolverrCookie[]; userAgent: string; status: number;
  }> {
    if (!this.config.enabled) {
      logger.warn('[FlareSolverr] Client disabled');
      return { html: null, cookies: [], userAgent: '', status: 0 };
    }
    if (!(await this.isHealthy())) {
      logger.warn('[FlareSolverr] Service unhealthy');
      return { html: null, cookies: [], userAgent: '', status: 0 };
    }

    const timeout = options.maxTimeout ?? this.config.timeout;
    logger.info('[FlareSolverr] Fetching URL', { url, session: options.session });

    const fetchStartTime = Date.now();
    let result = await this.fetchInternal(url, options, timeout);

    if (result.isStaleSession && options.session) {
      logger.info('[FlareSolverr] Stale session, recreating', { session: options.session });
      await this.destroySession(options.session);
      this.sessions.delete(options.session);
      await this.createSession(options.session);
      result = await this.fetchInternal(url, options, timeout);
    }

    const responseTimeMs = Date.now() - fetchStartTime;

    if (result.html) {
      logger.info('[FlareSolverr] Fetch successful', { url, status: result.status });
      this.recordSuccess();
      // Record successful fetch request
      void recordRequest('FETCH_REQUEST', true, responseTimeMs);
    } else {
      logger.error('[FlareSolverr] Fetch failed', { url, error: result.error ?? 'Unknown' });
      await this.recordFailure();
      // Record failed fetch request
      void recordRequest('FETCH_REQUEST', false, responseTimeMs, result.error);
    }

    return { html: result.html, cookies: result.cookies, userAgent: result.userAgent, status: result.status };
  }

  getCookiesForDomain(domain: string): FlareSolverrCookie[] {
    for (const session of this.sessions.values()) {
      if (session.domain === domain || domain.endsWith(session.domain)) return session.cookies;
    }
    return [];
  }

  getConfig(): FlareSolverrConfig { return { ...this.config }; }

  updateConfig(config: Partial<FlareSolverrConfig>): void {
    this.config = { ...this.config, ...config };
    this.healthy = null;
    this.lastHealthCheck = 0;
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [name, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(name);
        this.destroySession(name).catch(() => { /* Ignore */ });
      }
    }
  }

  recordSuccess(): void { this.consecutiveFailures = 0; }

  async recordFailure(): Promise<boolean> {
    this.consecutiveFailures++;
    if (this.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) return false;
    const timeSince = Date.now() - this.lastRestartAttempt;
    if (timeSince >= RESTART_COOLDOWN_MS) {
      logger.info('[FlareSolverr] Too many failures, restarting');
      return this.restart();
    }
    return false;
  }

  isRunning(): Promise<boolean> { return Promise.resolve(checkIsRunning()); }
  async stop(): Promise<boolean> { return stopFlareSolverr(); }

  async start(): Promise<boolean> {
    if (await this.isHealthy()) {
      logger.info('[FlareSolverr] Already running');
      return true;
    }
    const started = await startFlareSolverr(this.config.url);
    if (!started) return false;
    await delay(2000);
    this.healthy = null;
    this.lastHealthCheck = 0;
    const healthy = await this.isHealthy();
    if (healthy) this.consecutiveFailures = 0;
    return healthy;
  }

  async restart(): Promise<boolean> {
    if (this.isRestarting) return false;
    this.isRestarting = true;
    this.lastRestartAttempt = Date.now();
    try {
      this.sessions.clear();
      await this.stop();
      await delay(1000);
      const started = await this.start();
      if (started) this.consecutiveFailures = 0;
      return started;
    } finally {
      this.isRestarting = false;
    }
  }

  getLifecycleStatus(): {
    consecutiveFailures: number; isRestarting: boolean; lastRestartAttempt: number;
    timeSinceLastRestart: number; canRestart: boolean;
    version: { current: string | null; minimum: string; isOutdated: boolean | null };
  } {
    const timeSince = Date.now() - this.lastRestartAttempt;
    return {
      consecutiveFailures: this.consecutiveFailures,
      isRestarting: this.isRestarting,
      lastRestartAttempt: this.lastRestartAttempt,
      timeSinceLastRestart: timeSince,
      canRestart: !this.isRestarting && timeSince >= RESTART_COOLDOWN_MS,
      version: { current: this.currentVersion, minimum: MINIMUM_VERSION, isOutdated: this.isVersionOutdated() },
    };
  }

  async forceRestart(): Promise<boolean> {
    this.lastRestartAttempt = 0;
    return this.restart();
  }

  async initialize(options: { autoStart?: boolean; restartIfOutdated?: boolean } = {}): Promise<void> {
    logger.info('[FlareSolverr] Initializing');
    const healthy = await this.isHealthy();
    if (healthy) {
      if (this.versionOutdated && options.restartIfOutdated === true) await this.restart();
      return;
    }
    if (options.autoStart === true) await this.start();
  }

  async shutdown(): Promise<void> {
    // Destroy all sessions in parallel
    await Promise.all(
      Array.from(this.sessions.keys()).map((name) =>
        this.destroySession(name).catch(() => { /* Ignore cleanup errors */ })
      )
    );
    this.sessions.clear();
    await this.stop();
  }
}
