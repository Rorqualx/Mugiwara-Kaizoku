/**
 * Provider Health Monitor - Health Checks Module
 *
 * Executes various types of health checks against metadata providers.
 *
 * Check Types:
 * - PING: Basic availability check
 * - SEARCH: Test search functionality
 * - METADATA: Test metadata retrieval
 * - FULL: Comprehensive check (ping + search)
 *
 * Extracted from: provider-health-monitor.ts (lines 206-258)
 */


import { ProviderStatus } from '@prisma/client';

import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logging';


import { HealthCheckType, type HealthMetrics } from './types';

import type { MetadataProviderInterface } from '../provider-registry';

/**
 * Perform health check on a provider
 *
 * @param providerId - Provider identifier
 * @param provider - Provider instance to check
 * @param type - Type of health check to perform
 * @param calculateThroughput - Function to calculate throughput
 * @param calculateAvailability - Function to calculate availability
 * @returns Health metrics snapshot
 */
export async function performHealthCheck(
  providerId: string,
  provider: MetadataProviderInterface,
  type: HealthCheckType,
  calculateThroughput: (providerId: string) => number,
  calculateAvailability: (providerId: string) => number
): Promise<HealthMetrics> {
  const startTime = Date.now();
  let success = false;
  let _errorMessage: string | undefined;

  try {
    switch (type) {
      case HealthCheckType.PING: {
        success = await provider.healthCheck();
        break;
      }

      case HealthCheckType.SEARCH: {
        const searchResult = await provider.search('test');
        success = isSuccess(searchResult);
        break;
      }

      case HealthCheckType.METADATA: {
        // Use a known test ID if available
        const metadataResult = await provider.getMetadata('test-id');
        success = isSuccess(metadataResult);
        break;
      }

      case HealthCheckType.FULL: {
        // Perform all checks
        const pingOk = await provider.healthCheck();
        const fullSearchResult = await provider.search('test');
        const searchOk = isSuccess(fullSearchResult);
        success = pingOk && searchOk;
        break;
      }

      default: {
        // Unknown health check type - default to ping
        success = await provider.healthCheck();
        break;
      }
    }
  } catch (error: unknown) {
    success = false;
    _errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Health check failed', {
      providerId,
      type,
      error: _errorMessage
    });
  }

  const responseTime = Date.now() - startTime;
  const providerHealth = provider.getMetrics();

  const metrics: HealthMetrics = {
    timestamp: Date.now(),
    providerId,
    status: success ? ProviderStatus.READY : ProviderStatus.UNHEALTHY,
    responseTime,
    errorRate: providerHealth.errorRate,
    throughput: calculateThroughput(providerId),
    availability: calculateAvailability(providerId)
  };

  return metrics;
}
