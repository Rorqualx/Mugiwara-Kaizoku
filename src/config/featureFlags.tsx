/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for gradual rollout of new features
 */

import React from 'react';

import { prisma as sharedPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';
export interface FeatureFlags {
  // New status system feature flag
  newStatusSystem: boolean;
  // Other feature flags can be added here
  enhancedSearch: boolean;
  advancedFiltering: boolean;
  batchOperations: boolean;
  calendarIntegration: boolean;
  aiAgentEnrichment: boolean;
}

class FeatureFlagManager {
  private static instance: FeatureFlagManager | undefined;
  private flags: FeatureFlags;
  private prisma: PrismaClient;
  private constructor() {
    // Use shared prisma instance to avoid connection pool exhaustion
    this.prisma = sharedPrisma;
    this.flags = this.loadDefaultFlags();
    void this.loadDynamicFlags();
  }

  static getInstance(): FeatureFlagManager {
    FeatureFlagManager.instance ??= new FeatureFlagManager();
    return FeatureFlagManager.instance;
  }

  /**
   * Load default feature flags from environment
   */
  private loadDefaultFlags(): FeatureFlags {
    // Defaults are all false — actual values come from the Config table
    // via loadDynamicFlags(). Env vars are seeded into the DB at startup.
    return {
      newStatusSystem: false,
      enhancedSearch: false,
      advancedFiltering: false,
      batchOperations: false,
      calendarIntegration: false,
      aiAgentEnrichment: false,
    };
  }

  /**
   * Load dynamic feature flags from database
   */
  private async loadDynamicFlags(): Promise<void> {
    try {
      const configs = await this.prisma.config.findMany({
        where: {
          key: {
            startsWith: 'feature_flag_'
          }
        }
      });
      configs.forEach((config: unknown) => {
        if (typeof config === 'object' && config !== null && 'key' in config && 'value' in config) {
          const flagName = (config as { key: string }).key.replace('feature_flag_', '');
          if (flagName in this.flags) {
            (this.flags as unknown as Record<string, boolean>)[flagName] = (config as { value: string }).value === 'true';
          }
        }
      });
    } catch (error: unknown) {
      logger.warn('Failed to load dynamic feature flags:', error);
    }
  }

  /**
   * Get all feature flags
   */
  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Check if a specific feature is enabled
   */
  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  /**
   * Enable a feature flag
   */
  async enable(feature: keyof FeatureFlags): Promise<void> {
    this.flags[feature] = true;
    try {
      await this.prisma.config.upsert({
        where: {
          key: `feature_flag_${feature}`
        },
        update: {
          value: 'true'
        },
        create: {
          key: `feature_flag_${feature}`,
          value: 'true'
        }
      });
    } catch (error: unknown) {
      logger.error(`Failed to enable feature flag ${feature}:`, { error });
    }
  }

  /**
   * Disable a feature flag
   */
  async disable(feature: keyof FeatureFlags): Promise<void> {
    this.flags[feature] = false;
    try {
      await this.prisma.config.upsert({
        where: {
          key: `feature_flag_${feature}`
        },
        update: {
          value: 'false'
        },
        create: {
          key: `feature_flag_${feature}`,
          value: 'false'
        }
      });
    } catch (error: unknown) {
      logger.error(`Failed to disable feature flag ${feature}:`, { error });
    }
  }

  /**
   * Toggle a feature flag
   */
  async toggle(feature: keyof FeatureFlags): Promise<boolean> {
    const newState = !this.flags[feature];
    if (newState) {
      await this.enable(feature);
    } else {
      await this.disable(feature);
    }

    return newState;
  }

  /**
   * Reload flags from database
   */
  async reload(): Promise<void> {
    this.flags = this.loadDefaultFlags();
    await this.loadDynamicFlags();
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();
// React hook for using feature flags with WebSocket + polling fallback
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  const [enabled, setEnabled] = React.useState(false);

  // Note: useRealTime is imported dynamically to avoid circular dependencies
  // since this is a config file that may be loaded early in the app lifecycle
  const [isConnected, setIsConnected] = React.useState(false);

  // Check WebSocket connection status
  React.useEffect(() => {
    // Dynamically check if RealTimeProvider context is available
    const checkConnection = (): void => {
      // Simple heuristic: if WebSocket is available and connected
      if (typeof window !== 'undefined' && 'WebSocket' in window) {
        // Check for global socket.io connection indicator
        const windowAny = window as unknown as Record<string, unknown>;
        const socketIo = windowAny['__socketConnected'];
        setIsConnected(typeof socketIo === 'boolean' ? socketIo : false);
      }
    };
    checkConnection();
    const checkInterval = setInterval(checkConnection, 5000);
    return () => clearInterval(checkInterval);
  }, []);

  // Initial check and updates
  React.useEffect(() => {
    // Initial check
    setEnabled(featureFlags.isEnabled(feature));
  }, [feature]);

  // Fallback polling only when WebSocket disconnected
  React.useEffect(() => {
    if (isConnected) return; // Skip polling when WebSocket is connected

    const interval = setInterval(() => { void (async () => {
      await featureFlags.reload();
      setEnabled(featureFlags.isEnabled(feature));
    })(); }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [feature, isConnected]);

  return enabled;
}

// HOC for feature-flagged components
export function withFeatureFlag<P extends Record<string, unknown>>(
feature: keyof FeatureFlags,
Component: React.ComponentType<P>,
FallbackComponent?: React.ComponentType<P>)
: React.ComponentType<P> {
  return (props: P) => {
    const enabled = useFeatureFlag(feature);
    if (enabled) {
      return <Component {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }

    return null;
  };
}

// Utility to check feature flags in server-side code
export async function checkFeatureFlag(feature: keyof FeatureFlags): Promise<boolean> {
  await featureFlags.reload();
  return featureFlags.isEnabled(feature);
}