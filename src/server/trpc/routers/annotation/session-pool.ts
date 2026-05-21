/**
 * FlareSolverr Session Pool - Enables Concurrent Batch Processing
 *
 * Manages multiple concurrent browser sessions per domain to enable
 * parallel batch fetching. Sessions are pooled and reused to avoid
 * the overhead of creating new browser instances for each request.
 *
 * @module annotation/session-pool
 */

import { flareSolverr } from '@/server/services/flaresolverr';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface PooledSession {
  name: string;
  domain: string;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
}

interface SessionPoolConfig {
  maxSessionsPerDomain: number;
  idleTimeout: number;
  absoluteTimeout: number;
}

interface PoolStats {
  totalSessions: number;
  activeSessions: number;
  idleSessions: number;
  sessionsByDomain: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_POOL_CONFIG: SessionPoolConfig = {
  maxSessionsPerDomain: 3,
  idleTimeout: 5 * 60 * 1000,
  absoluteTimeout: 30 * 60 * 1000,
};

const MAX_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 500;
const CLEANUP_INTERVAL_MS = 60000;

// ============================================================================
// Helper Functions
// ============================================================================

function isSessionExpired(session: PooledSession, config: SessionPoolConfig): boolean {
  const now = Date.now();
  const idleTime = now - session.lastUsed;
  const totalTime = now - session.createdAt;
  return idleTime >= config.idleTimeout || totalTime >= config.absoluteTimeout;
}

function isSessionValid(session: PooledSession, config: SessionPoolConfig): boolean {
  return !isSessionExpired(session, config);
}

function countSessionStates(sessions: Map<string, PooledSession>): { active: number; idle: number } {
  let active = 0;
  let idle = 0;
  for (const session of sessions.values()) {
    if (session.inUse) {
      active++;
    } else {
      idle++;
    }
  }
  return { active, idle };
}

// ============================================================================
// Session Pool Class
// ============================================================================

class FlareSolverrSessionPool {
  private sessions: Map<string, PooledSession> = new Map();
  private domainSessionCounts: Map<string, number> = new Map();
  private config: SessionPoolConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SessionPoolConfig>) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.startCleanupTimer();
  }

  async acquire(domain: string): Promise<string | null> {
    const idleSession = this.findIdleSession(domain);
    if (idleSession) {
      idleSession.inUse = true;
      idleSession.lastUsed = Date.now();
      logger.debug('[SessionPool] Reusing idle session', { session: idleSession.name, domain });
      return idleSession.name;
    }

    const currentCount = this.domainSessionCounts.get(domain) ?? 0;
    if (currentCount >= this.config.maxSessionsPerDomain) {
      logger.warn('[SessionPool] Max sessions reached', { domain, max: this.config.maxSessionsPerDomain });
      return this.waitForSession(domain);
    }

    return this.createPooledSession(domain, currentCount);
  }

  release(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.inUse = false;
      session.lastUsed = Date.now();
      logger.debug('[SessionPool] Released session', { session: sessionName });
    }
  }

  private async createPooledSession(domain: string, currentCount: number): Promise<string | null> {
    const sessionName = `annotation-pool-${domain}-${currentCount}`;
    const sessionId = await flareSolverr.createSession(sessionName);

    if (!sessionId) {
      logger.error('[SessionPool] Failed to create session', { domain, sessionName });
      return null;
    }

    const session: PooledSession = {
      name: sessionName,
      domain,
      inUse: true,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };

    this.sessions.set(sessionName, session);
    this.domainSessionCounts.set(domain, currentCount + 1);
    logger.info('[SessionPool] Created session', { session: sessionName, domain, poolSize: currentCount + 1 });

    return sessionName;
  }

  private findIdleSession(domain: string): PooledSession | null {
    for (const session of this.sessions.values()) {
      const isMatch = session.domain === domain && !session.inUse && isSessionValid(session, this.config);
      if (isMatch) return session;
    }
    return null;
  }

  private async waitForSession(domain: string): Promise<string | null> {
    let waited = 0;

    while (waited < MAX_WAIT_MS) {
      // eslint-disable-next-line no-await-in-loop -- Polling loop for session availability
      await new Promise((resolve) => { setTimeout(resolve, POLL_INTERVAL_MS); });
      waited += POLL_INTERVAL_MS;

      const idleSession = this.findIdleSession(domain);
      if (idleSession) {
        idleSession.inUse = true;
        idleSession.lastUsed = Date.now();
        logger.debug('[SessionPool] Acquired after wait', { session: idleSession.name, domain, waitedMs: waited });
        return idleSession.name;
      }
    }

    logger.error('[SessionPool] Timeout waiting for session', { domain, maxWait: MAX_WAIT_MS });
    return null;
  }

  private findExpiredSessions(): string[] {
    const expired: string[] = [];
    for (const [name, session] of this.sessions) {
      if (!session.inUse && isSessionExpired(session, this.config)) {
        expired.push(name);
      }
    }
    return expired;
  }

  async cleanup(): Promise<void> {
    const toRemove = this.findExpiredSessions();
    for (const name of toRemove) {
      // eslint-disable-next-line no-await-in-loop -- Sequential session cleanup for safe teardown
      await this.destroySession(name);
    }
  }

  private async destroySession(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (!session) return;

    await flareSolverr.destroySession(name);
    this.sessions.delete(name);

    const count = this.domainSessionCounts.get(session.domain) ?? 1;
    this.domainSessionCounts.set(session.domain, Math.max(0, count - 1));
    logger.debug('[SessionPool] Destroyed session', { session: name });
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(() => { /* Ignore cleanup errors */ });
    }, CLEANUP_INTERVAL_MS);
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const sessionNames = Array.from(this.sessions.keys());
    for (const name of sessionNames) {
      // eslint-disable-next-line no-await-in-loop -- Sequential session destruction during shutdown
      await this.destroySession(name);
    }

    this.sessions.clear();
    this.domainSessionCounts.clear();
    logger.info('[SessionPool] Shutdown complete');
  }

  getStats(): PoolStats {
    const { active, idle } = countSessionStates(this.sessions);
    return {
      totalSessions: this.sessions.size,
      activeSessions: active,
      idleSessions: idle,
      sessionsByDomain: Object.fromEntries(this.domainSessionCounts),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const sessionPool = new FlareSolverrSessionPool();

export async function acquireSession(domain: string): Promise<string | null> {
  return sessionPool.acquire(domain);
}

export function releaseSession(sessionName: string): void {
  sessionPool.release(sessionName);
}

export function getSessionPoolStats(): PoolStats {
  return sessionPool.getStats();
}
