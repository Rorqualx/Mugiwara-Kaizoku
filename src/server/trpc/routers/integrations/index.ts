/**
 * Integration Routers Index
 *
 * Combines all integration-specific tRPC routers into a single integrations router.
 * Uses cached status for fast page loads with manual refresh capability.
 */


import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getIntegrationConfigService } from '@/server/services/integration/configService';
import {
  createDefaultStatus,
  getIntegrationStatusCache,
  type CachedIntegrationStatus
} from '@/server/services/integration/statusCache';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { IntegrationType } from '@/types/integration';
import { logger } from '@/utils/logger';

import { appriseRouter, testAppriseConnection } from './apprise';
import { kavitaRouter, testKavitaConnection } from './kavita';
import { komgaRouter, testKomgaConnection } from './komga';
import { telegramRouter, testTelegramConnection } from './telegram';

/**
 * Status response interface for individual integrations
 */
interface IntegrationStatus {
  enabled: boolean;
  configured: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'not-configured' | 'unknown';
  connectionError?: string | null;
  lastChecked?: Date | null;
}

/**
 * Convert cached status to API response format
 */
function cachedToApiStatus(cached: CachedIntegrationStatus | null, fallback: { enabled: boolean; configured: boolean }): IntegrationStatus {
  if (cached) {
    return {
      enabled: cached.enabled,
      configured: cached.configured,
      connectionStatus: cached.connectionStatus,
      connectionError: cached.connectionError ?? null,
      lastChecked: cached.lastChecked
    };
  }

  // Return unknown status if not cached
  return {
    enabled: fallback.enabled,
    configured: fallback.configured,
    connectionStatus: fallback.configured ? 'unknown' : 'not-configured',
    connectionError: null,
    lastChecked: null
  };
}

/**
 * Process settled result and update cache
 */
function processAndCacheResult(
  result: PromiseSettledResult<CachedIntegrationStatus>,
  type: IntegrationType,
  fallbackEnabled: boolean,
  cache: ReturnType<typeof getIntegrationStatusCache>
): IntegrationStatus {
  if (result.status === 'fulfilled') {
    cache.set(type, result.value);
    return {
      enabled: result.value.enabled,
      configured: result.value.configured,
      connectionStatus: result.value.connectionStatus,
      connectionError: result.value.connectionError ?? null,
      lastChecked: result.value.lastChecked
    };
  }

  const errorStatus: CachedIntegrationStatus = {
    enabled: fallbackEnabled,
    configured: true,
    connectionStatus: 'error',
    connectionError: String(result.reason),
    lastChecked: new Date()
  };
  cache.set(type, errorStatus);
  return {
    enabled: errorStatus.enabled,
    configured: errorStatus.configured,
    connectionStatus: errorStatus.connectionStatus,
    connectionError: errorStatus.connectionError ?? null,
    lastChecked: errorStatus.lastChecked
  };
}

/**
 * Combined integrations router
 * Provides endpoints for all external service integrations
 */
export const integrationsRouter = router({
  apprise: appriseRouter,
  kavita: kavitaRouter,
  komga: komgaRouter,
  telegram: telegramRouter,

  /**
   * Get status for all integrations (FAST - uses cache)
   *
   * Returns cached status information for all configured integrations.
   * Does NOT perform live connection tests - use refreshAllStatus for that.
   * This endpoint is optimized for fast page loads.
   */
  getAllStatus: protectedProcedure.query(async (): Promise<Record<IntegrationType, IntegrationStatus>> => {
    try {
      logger.debug('Fetching cached status for all integrations');

      const cache = getIntegrationStatusCache();
      const configService = getGlobalConfigService();
      const integrationConfigService = getIntegrationConfigService(configService);
      const config = await integrationConfigService.loadConfig();

      // Get cached statuses or create defaults from config
      const status: Record<IntegrationType, IntegrationStatus> = {
        komga: cachedToApiStatus(
          cache.get('komga'),
          { enabled: config.komga.enabled, configured: !!(config.komga.host && (config.komga.user || config.komga.password)) }
        ),
        kavita: cachedToApiStatus(
          cache.get('kavita'),
          { enabled: config.kavita.enabled, configured: !!(config.kavita.host) }
        ),
        telegram: cachedToApiStatus(
          cache.get('telegram'),
          { enabled: config.telegram.enabled, configured: !!(config.telegram.botToken && config.telegram.chatId) }
        ),
        apprise: cachedToApiStatus(
          cache.get('apprise'),
          { enabled: config.apprise.enabled, configured: !!(config.apprise.serviceUrl && config.apprise.services.length > 0) }
        )
      };

      logger.debug('Returning cached integration statuses', {
        statuses: Object.entries(status).map(([type, s]) => ({
          type,
          enabled: s.enabled,
          configured: s.configured,
          connectionStatus: s.connectionStatus,
          lastChecked: s.lastChecked
        }))
      });

      return status;
    }
    catch (error: unknown) {
      logger.error('Failed to fetch integration statuses:', error);
      // Return default error state for all integrations
      return {
        komga: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to fetch status' },
        kavita: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to fetch status' },
        telegram: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to fetch status' },
        apprise: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to fetch status' }
      };
    }
  }),

  /**
   * Refresh status for all integrations (SLOW - performs live connection tests)
   *
   * Performs actual connection tests to all configured integrations and updates cache.
   * This should be called manually when user wants to verify connection status.
   */
  refreshAllStatus: adminProcedure.mutation(async (): Promise<Record<IntegrationType, IntegrationStatus>> => {
    try {
      logger.info('Refreshing status for all integrations (performing live connection tests)');

      const cache = getIntegrationStatusCache();
      const configService = getGlobalConfigService();
      const integrationConfigService = getIntegrationConfigService(configService);
      const config = await integrationConfigService.loadConfig();

      // Test all configured integrations in parallel with reduced timeout
      const [komgaResult, kavitaResult, telegramResult, appriseResult] = await Promise.allSettled([
        config.komga.enabled && config.komga.host
          ? testKomgaConnection()
          : Promise.resolve(createDefaultStatus(config.komga.enabled, false)),
        config.kavita.enabled && config.kavita.host
          ? testKavitaConnection()
          : Promise.resolve(createDefaultStatus(config.kavita.enabled, false)),
        config.telegram.enabled && config.telegram.botToken
          ? testTelegramConnection()
          : Promise.resolve(createDefaultStatus(config.telegram.enabled, false)),
        config.apprise.enabled && config.apprise.serviceUrl
          ? testAppriseConnection()
          : Promise.resolve(createDefaultStatus(config.apprise.enabled, false))
      ]);

      // Process results and update cache using helper
      const status: Record<IntegrationType, IntegrationStatus> = {
        komga: processAndCacheResult(komgaResult, 'komga', config.komga.enabled, cache),
        kavita: processAndCacheResult(kavitaResult, 'kavita', config.kavita.enabled, cache),
        telegram: processAndCacheResult(telegramResult, 'telegram', config.telegram.enabled, cache),
        apprise: processAndCacheResult(appriseResult, 'apprise', config.apprise.enabled, cache)
      };

      logger.info('Successfully refreshed all integration statuses');
      return status;
    }
    catch (error: unknown) {
      logger.error('Failed to refresh integration statuses:', error);
      return {
        komga: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to refresh status' },
        kavita: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to refresh status' },
        telegram: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to refresh status' },
        apprise: { enabled: false, configured: false, connectionStatus: 'error', connectionError: 'Failed to refresh status' }
      };
    }
  })
});

/**
 * Type definition for the integrations router
 */
export type IntegrationsRouter = typeof integrationsRouter;

// Export individual routers for direct use
export { appriseRouter } from './apprise';
export { kavitaRouter } from './kavita';
export { komgaRouter } from './komga';
export { telegramRouter } from './telegram';
