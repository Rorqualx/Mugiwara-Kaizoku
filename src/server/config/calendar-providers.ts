/**
 * Calendar Provider Configuration
 *
 * Manages provider configuration and rate limiting for calendar sync
 */

import { createLogger } from '@/utils/logger';

import { getConfig, getConfigBoolean } from '../utils/configReader';

const logger = createLogger('CalendarProviders');

// Rate limit configuration per provider
const RATE_LIMITS = {
  anilist: {
    requestsPerMinute: 90,
    requestsPerHour: 3600,
    concurrent: 10
  },
  comicvine: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    concurrent: 5
  },
  fandom: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    concurrent: 5
  }
};

// In-memory rate limit tracking
const rateLimitState = new Map<string, {
  minuteCount: number;
  hourCount: number;
  activeRequests: number;
  lastMinuteReset: number;
  lastHourReset: number;
}>();

// Provider configuration cache
let providerConfigCache: Record<string, { enabled: boolean; config: Record<string, unknown> } | null> | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get provider configuration from Config table
 */
export async function getProviderConfig(provider: string): Promise<{ enabled: boolean; config: Record<string, unknown> } | null> {
  try {
    // Check cache
    if (providerConfigCache !== null && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
      const config = providerConfigCache[provider];
      if (config !== undefined) {
        return config;
      }
    }

    // Read provider config from Config table
    const enabled = await getConfigBoolean(`${provider}.enabled`, false);

    // Build provider config object from Config table
    // Different providers have different config keys
    const config: Record<string, unknown> = {
      enabled
    };

    // Provider-specific configuration
    switch (provider.toLowerCase()) {
      case 'anilist':
        config['clientId'] = await getConfig(`${provider}.clientId`);
        config['clientSecret'] = await getConfig(`${provider}.clientSecret`);
        config['accessToken'] = await getConfig(`${provider}.accessToken`);
        break;
      case 'comicvine':
        config['apiKey'] = await getConfig(`${provider}.apiKey`);
        break;
      case 'fandom':
        config['wikiDomain'] = await getConfig(`${provider}.wikiDomain`);
        break;
      default:
        // No additional config for unknown providers
        break;
    }

    // Update cache with the config
    const cacheObj = providerConfigCache ?? {};
    cacheObj[provider] = { enabled, config };
    providerConfigCache = cacheObj;
    configCacheTime = Date.now();

    return {
      enabled,
      config
    };

  } catch (error: unknown) {
    logger.error(`[CalendarConfig] Failed to get provider config for ${provider} from Config table`, error);
    return null;
  }
}

/**
 * Check if a provider is enabled
 */
export async function isProviderEnabled(provider: string): Promise<boolean> {
  const config = await getProviderConfig(provider);
  return config?.enabled || false;
}

/**
 * Initialize rate limit state for a provider
 */
function initRateLimitState(provider: string): void {
  if (!rateLimitState.has(provider)) {
    rateLimitState.set(provider, {
      minuteCount: 0,
      hourCount: 0,
      activeRequests: 0,
      lastMinuteReset: Date.now(),
      lastHourReset: Date.now()
    });
  }
}

/**
 * Reset rate limit counters if needed
 */
function resetRateLimitCounters(provider: string): void {
  const state = rateLimitState.get(provider);
  if (!state) return;

  const now = Date.now();

  // Reset minute counter
  if (now - state.lastMinuteReset >= 60000) {
    state.minuteCount = 0;
    state.lastMinuteReset = now;
  }

  // Reset hour counter
  if (now - state.lastHourReset >= 3600000) {
    state.hourCount = 0;
    state.lastHourReset = now;
  }
}

/**
 * Helper to safely get rate limits for a provider
 */
function getRateLimits(provider: string): typeof RATE_LIMITS[keyof typeof RATE_LIMITS] | null {
  if (!(provider in RATE_LIMITS)) {
    return null;
  }
  return RATE_LIMITS[provider as keyof typeof RATE_LIMITS];
}

/**
 * Check if we can make a request to a provider
 */
export function checkRateLimit(provider: string): Promise<boolean> {
  const limits = getRateLimits(provider);
  if (!limits) return Promise.resolve(true); // No limits defined

  initRateLimitState(provider);
  resetRateLimitCounters(provider);

  const state = rateLimitState.get(provider);
  if (!state) return Promise.resolve(true);

  // Check concurrent limit
  if (state.activeRequests >= limits.concurrent) {
    return Promise.resolve(false);
  }

  // Check minute limit
  if (state.minuteCount >= limits.requestsPerMinute) {
    return Promise.resolve(false);
  }

  // Check hour limit
  if (state.hourCount >= limits.requestsPerHour) {
    return Promise.resolve(false);
  }

  return Promise.resolve(true);
}

/**
 * Increment rate limit counters
 */
export function incrementRateLimit(provider: string): void {
  initRateLimitState(provider);
  const state = rateLimitState.get(provider);
  if (!state) return;

  state.minuteCount++;
  state.hourCount++;
  state.activeRequests++;
}

/**
 * Decrement active requests counter
 */
export function decrementActiveRequests(provider: string): void {
  const state = rateLimitState.get(provider);
  if (state && state.activeRequests > 0) {
    state.activeRequests--;
  }
}

/**
 * Wait for rate limit to clear
 */
export async function waitForRateLimit(provider: string): Promise<void> {
  const limits = getRateLimits(provider);
  if (!limits) return;
  
  const state = rateLimitState.get(provider);
  if (!state) return;
  
  // Calculate wait time
  let waitTime = 0;
  
  // If we've hit the minute limit, wait until the next minute
  if (state.minuteCount >= limits.requestsPerMinute) {
    const timeSinceReset = Date.now() - state.lastMinuteReset;
    waitTime = Math.max(0, 60000 - timeSinceReset);
  }
  
  // If we've hit the hour limit, wait longer
  if (state.hourCount >= limits.requestsPerHour) {
    const timeSinceReset = Date.now() - state.lastHourReset;
    const hourWait = Math.max(0, 3600000 - timeSinceReset);
    waitTime = Math.max(waitTime, hourWait);
  }
  
  // If we're at concurrent limit, wait a bit
  if (state.activeRequests >= limits.concurrent) {
    waitTime = Math.max(waitTime, 1000); // Wait 1 second
  }
  
  if (waitTime > 0) {
    logger.info(`[CalendarConfig] Rate limited for ${provider}, waiting ${waitTime}ms`);
    await new Promise<void>(resolve => {
      setTimeout(resolve, waitTime);
    });
  }
}

/**
 * Get rate limit status for a provider
 */
export function getRateLimitStatus(provider: string): {
  minuteRemaining: number;
  hourRemaining: number;
  concurrentRemaining: number;
} | null {
  const limits = getRateLimits(provider);
  if (!limits) return null;
  
  const state = rateLimitState.get(provider);
  if (!state) {
    return {
      minuteRemaining: limits.requestsPerMinute,
      hourRemaining: limits.requestsPerHour,
      concurrentRemaining: limits.concurrent
    };
  }
  
  resetRateLimitCounters(provider);
  
  return {
    minuteRemaining: Math.max(0, limits.requestsPerMinute - state.minuteCount),
    hourRemaining: Math.max(0, limits.requestsPerHour - state.hourCount),
    concurrentRemaining: Math.max(0, limits.concurrent - state.activeRequests)
  };
}

/**
 * Clear provider configuration cache
 */
export function clearConfigCache(): void {
  providerConfigCache = null;
  configCacheTime = 0;
}

/**
 * Reset all rate limits (for testing)
 */
export function resetAllRateLimits(): void {
  rateLimitState.clear();
}
