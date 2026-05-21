/**
 * Calendar Rate Limit Service
 *
 * Provides persistent rate limiting for calendar providers using database-backed state.
 * Falls back to in-memory rate limiting if database is unavailable.
 *
 * @module server/services/calendar/rate-limit-service
 */

import { prisma } from '@/server/db';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CalendarRateLimitService');

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  provider: string;
  bucket: string;
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
  isLimited: boolean;
}

interface InMemoryBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
  lastRefillAt: Date;
  isLimited: boolean;
  resetsAt: Date | null;
}

interface DbRateLimitState {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
  lastRefillAt: Date;
  isLimited: boolean;
  resetsAt: Date | null;
}

// ============================================================================
// In-Memory Fallback Cache
// ============================================================================

const inMemoryBuckets = new Map<string, InMemoryBucket>();

function getBucketKey(provider: string, bucket: string): string {
  return `${provider}:${bucket}`;
}

// ============================================================================
// Shared Helpers
// ============================================================================

function calculateRefilledTokens(state: DbRateLimitState, now: Date): { tokens: number; refillCount: number } {
  const timeSinceRefill = now.getTime() - state.lastRefillAt.getTime();
  const refillCount = Math.floor(timeSinceRefill / state.refillIntervalMs);
  const tokens = Math.min(state.tokens + refillCount * state.refillRate, state.maxTokens);
  return { tokens, refillCount };
}

function calculateTimeUntilRefill(lastRefillAt: Date, refillIntervalMs: number, now: Date): number {
  const timeSinceRefill = now.getTime() - lastRefillAt.getTime();
  return refillIntervalMs - (timeSinceRefill % refillIntervalMs);
}

function createAllowedResult(remaining: number): RateLimitResult {
  return { allowed: true, remaining, retryAfterMs: null, isLimited: false };
}

function createLimitedResult(retryAfterMs: number): RateLimitResult {
  return { allowed: false, remaining: 0, retryAfterMs, isLimited: true };
}

// ============================================================================
// Rate Limit Service - Public API
// ============================================================================

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { provider, bucket, maxTokens, refillRate, refillIntervalMs } = config;

  try {
    return await checkRateLimitDb(provider, bucket, maxTokens, refillRate, refillIntervalMs);
  } catch (error: unknown) {
    logger.warn('Database rate limit check failed, using in-memory fallback', {
      provider,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    return checkRateLimitInMemory(provider, bucket, maxTokens, refillRate, refillIntervalMs);
  }
}

export async function getRateLimitStatus(provider: string, bucket: string): Promise<RateLimitResult | null> {
  try {
    const state = await prisma.rateLimitState.findUnique({
      where: { provider_bucket: { provider, bucket } },
    });
    if (!state) return null;

    const now = new Date();
    const { tokens } = calculateRefilledTokens(state, now);
    const retryAfterMs = tokens > 0 ? null : calculateTimeUntilRefill(state.lastRefillAt, state.refillIntervalMs, now);

    return { allowed: tokens > 0, remaining: tokens, retryAfterMs, isLimited: state.isLimited };
  } catch {
    return getInMemoryStatus(provider, bucket);
  }
}

export async function resetRateLimit(provider: string, bucket: string): Promise<void> {
  try {
    await prisma.rateLimitState.update({
      where: { provider_bucket: { provider, bucket } },
      data: { isLimited: false, resetsAt: null, lastRefillAt: new Date() },
    });
    logger.info('Rate limit reset', { provider, bucket });
  } catch {
    resetInMemoryBucket(provider, bucket);
  }
}

export async function getProviderRateLimits(provider: string): Promise<
  Array<{ bucket: string; remaining: number; isLimited: boolean; resetsAt: Date | null }>
> {
  try {
    return await getDbProviderRateLimits(provider);
  } catch {
    return getInMemoryProviderRateLimits(provider);
  }
}

export async function cleanupOldRateLimitStates(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await prisma.rateLimitState.deleteMany({ where: { lastRequestAt: { lt: cutoff } } });
    logger.info('Cleaned up old rate limit states', { deleted: result.count });
    return result.count;
  } catch (error: unknown) {
    logger.error('Failed to clean up rate limit states', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

// ============================================================================
// Database Implementation
// ============================================================================

async function checkRateLimitDb(
  provider: string,
  bucket: string,
  maxTokens: number,
  refillRate: number,
  refillIntervalMs: number
): Promise<RateLimitResult> {
  const now = new Date();

  const state = await prisma.rateLimitState.upsert({
    where: { provider_bucket: { provider, bucket } },
    create: { provider, bucket, tokens: maxTokens - 1, maxTokens, refillRate, refillIntervalMs, lastRefillAt: now, lastRequestAt: now, isLimited: false },
    update: { lastRequestAt: now },
  });

  const { tokens: refilledTokens, refillCount } = calculateRefilledTokens(state, now);
  const newLastRefillAt = refillCount > 0 ? new Date(state.lastRefillAt.getTime() + refillCount * refillIntervalMs) : state.lastRefillAt;

  if (refilledTokens > 0) {
    return consumeDbToken(provider, bucket, refilledTokens - 1, newLastRefillAt, refillIntervalMs, now);
  }

  return markDbRateLimited(provider, bucket, state.lastRefillAt, refillIntervalMs, now);
}

// eslint-disable-next-line max-params -- Internal rate limiting function; all parameters required for token consumption and state update
async function consumeDbToken(
  provider: string,
  bucket: string,
  newTokens: number,
  lastRefillAt: Date,
  refillIntervalMs: number,
  now: Date
): Promise<RateLimitResult> {
  const isNowLimited = newTokens === 0;
  await prisma.rateLimitState.update({
    where: { provider_bucket: { provider, bucket } },
    data: {
      tokens: newTokens,
      lastRefillAt,
      isLimited: isNowLimited,
      resetsAt: isNowLimited ? new Date(now.getTime() + refillIntervalMs) : null,
    },
  });
  return createAllowedResult(newTokens);
}

async function markDbRateLimited(
  provider: string,
  bucket: string,
  lastRefillAt: Date,
  refillIntervalMs: number,
  now: Date
): Promise<RateLimitResult> {
  const timeUntilRefill = calculateTimeUntilRefill(lastRefillAt, refillIntervalMs, now);
  await prisma.rateLimitState.update({
    where: { provider_bucket: { provider, bucket } },
    data: { isLimited: true, resetsAt: new Date(now.getTime() + timeUntilRefill) },
  });
  return createLimitedResult(timeUntilRefill);
}

async function getDbProviderRateLimits(
  provider: string
): Promise<Array<{ bucket: string; remaining: number; isLimited: boolean; resetsAt: Date | null }>> {
  const states = await prisma.rateLimitState.findMany({
    where: { provider },
    select: { bucket: true, tokens: true, maxTokens: true, isLimited: true, resetsAt: true, lastRefillAt: true, refillRate: true, refillIntervalMs: true },
  });

  const now = new Date();
  return states.map((state: DbRateLimitState & { bucket: string }) => {
    const { tokens } = calculateRefilledTokens(state, now);
    return { bucket: state.bucket, remaining: tokens, isLimited: state.isLimited, resetsAt: state.resetsAt };
  });
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

function checkRateLimitInMemory(
  provider: string,
  bucket: string,
  maxTokens: number,
  refillRate: number,
  refillIntervalMs: number
): RateLimitResult {
  const key = getBucketKey(provider, bucket);
  const now = new Date();

  let state = inMemoryBuckets.get(key);
  if (!state) {
    state = createInMemoryBucket(maxTokens, refillRate, refillIntervalMs, now);
    inMemoryBuckets.set(key, state);
    return createAllowedResult(state.tokens);
  }

  refillInMemoryBucket(state, now);
  return consumeInMemoryToken(state, refillIntervalMs, now);
}

function createInMemoryBucket(maxTokens: number, refillRate: number, refillIntervalMs: number, now: Date): InMemoryBucket {
  return { tokens: maxTokens - 1, maxTokens, refillRate, refillIntervalMs, lastRefillAt: now, isLimited: false, resetsAt: null };
}

function refillInMemoryBucket(state: InMemoryBucket, now: Date): void {
  const timeSinceRefill = now.getTime() - state.lastRefillAt.getTime();
  const refillCount = Math.floor(timeSinceRefill / state.refillIntervalMs);
  if (refillCount > 0) {
    state.tokens = Math.min(state.tokens + refillCount * state.refillRate, state.maxTokens);
    state.lastRefillAt = new Date(state.lastRefillAt.getTime() + refillCount * state.refillIntervalMs);
    state.isLimited = false;
    state.resetsAt = null;
  }
}

function consumeInMemoryToken(state: InMemoryBucket, refillIntervalMs: number, now: Date): RateLimitResult {
  if (state.tokens > 0) {
    state.tokens--;
    state.isLimited = state.tokens === 0;
    state.resetsAt = state.tokens === 0 ? new Date(now.getTime() + refillIntervalMs) : null;
    return createAllowedResult(state.tokens);
  }

  const timeUntilRefill = calculateTimeUntilRefill(state.lastRefillAt, refillIntervalMs, now);
  state.isLimited = true;
  state.resetsAt = new Date(now.getTime() + timeUntilRefill);
  return createLimitedResult(timeUntilRefill);
}

function getInMemoryStatus(provider: string, bucket: string): RateLimitResult | null {
  const key = getBucketKey(provider, bucket);
  const state = inMemoryBuckets.get(key);
  if (!state) return null;
  return { allowed: state.tokens > 0, remaining: state.tokens, retryAfterMs: state.tokens > 0 ? null : state.refillIntervalMs, isLimited: state.isLimited };
}

function resetInMemoryBucket(provider: string, bucket: string): void {
  const key = getBucketKey(provider, bucket);
  const state = inMemoryBuckets.get(key);
  if (state) {
    state.isLimited = false;
    state.resetsAt = null;
    state.lastRefillAt = new Date();
  }
}

function getInMemoryProviderRateLimits(
  provider: string
): Array<{ bucket: string; remaining: number; isLimited: boolean; resetsAt: Date | null }> {
  const results: Array<{ bucket: string; remaining: number; isLimited: boolean; resetsAt: Date | null }> = [];
  const prefix = `${provider}:`;

  for (const [key, state] of inMemoryBuckets) {
    if (key.startsWith(prefix)) {
      results.push({ bucket: key.slice(prefix.length), remaining: state.tokens, isLimited: state.isLimited, resetsAt: state.resetsAt });
    }
  }
  return results;
}
