/**
 * Feature Flags Management API
 * 
 * Provides endpoints for viewing and updating ML feature flags
 * and model configuration settings.
 */

import { getServerSession } from 'next-auth/next';

import type {
  FeatureFlags,
  MLConfig
} from '@/server/config/feature-flags';
import FeatureFlagManager, {
  getFeatureFlagManager
} from '@/server/config/feature-flags';
import { logger } from '@/utils/logger';

import { authOptions } from '../auth/[...nextauth]';

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    // Check authentication (admin only)
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res["status"](401).json({ error: 'Unauthorized' });
    }

    // TODO: Add admin role check when role system is implemented
    // if (session.user.role !== 'admin') {
    //   return res["status"](403).json({ error: 'Admin access required' });
    // }

    const flagManager = getFeatureFlagManager();

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, flagManager);
      case 'PUT':
      case 'PATCH':
        return await handleUpdate(req, res, flagManager);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
        return res["status"](405).json({ error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    logger.error('[Feature Flags API] Error:', error);
    return res["status"](500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle GET requests
 */
function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  flagManager: FeatureFlagManager
): void {
  const { type } = req.query;

  switch (type) {
    case 'flags': {
      const flags = flagManager.getAllFlags();
      return res["status"](200).json(flags);
    }

    case 'ml-config': {
      const mlConfig = flagManager.getMLConfig();
      return res["status"](200).json(mlConfig);
    }

    case 'ml-status': {
      const isAvailable = flagManager.isMLAvailable();
      const bestBackend = flagManager.getBestAvailableBackend();
      return res["status"](200).json({
        available: isAvailable,
        currentBackend: flagManager.getMLConfig().backend,
        bestAvailableBackend: bestBackend
      });
    }

    case 'all':
    default: {
      return res["status"](200).json({
        flags: flagManager.getAllFlags(),
        mlConfig: flagManager.getMLConfig(),
        mlAvailable: flagManager.isMLAvailable()
      });
    }
  }
}

/**
 * Handle PUT/PATCH requests
 */
async function handleUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  flagManager: FeatureFlagManager
): Promise<void> {
  const { type } = req.query;

  switch (type) {
    case 'flag': {
      // Type-safe extraction from req.body
      const body = req.body as { feature?: unknown; enabled?: unknown };
      const feature = typeof body.feature === 'string' ? body.feature : undefined;
      const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;

      if (!feature || enabled === undefined) {
        return res["status"](400).json({
          error: 'feature and enabled are required'
        });
      }

      // Validate feature name
      const validFeatures: (keyof FeatureFlags)[] = [
        'mlPatternRecognition',
        'mlActiveLearning',
        'mlPatternEvolution',
        'mlTensorFlowBackend',
        'mlFallbackMode',
        'enableCaching',
        'enableParallelProcessing',
        'enableBatchProcessing',
        'experimentalParsers',
        'experimentalImageOptimization',
        'advancedMetadataExtraction',
        'adminDashboard',
        'metricsCollection',
        'debugMode'
      ];

      if (!validFeatures.includes(feature as keyof FeatureFlags)) {
        return res["status"](400).json({
          error: `Invalid feature: ${feature}`,
          validFeatures
        });
      }

      flagManager.setFlag(feature as keyof FeatureFlags, enabled);

      // Save to database
      await flagManager.saveToDatabase().catch((error: Error) => {
        logger.warn('Failed to save feature flags to database:', error);
      });

      return res["status"](200).json({
        success: true,
        message: `Feature ${feature} set to ${enabled}`
      });
    }

    case 'ml-config': {
      const mlConfig: Partial<MLConfig> = req.body as Partial<MLConfig>;

      if (Object.keys(mlConfig).length === 0) {
        return res["status"](400).json({
          error: 'ML configuration data is required'
        });
      }

      flagManager.updateMLConfig(mlConfig);

      // Save to database
      await flagManager.saveToDatabase().catch((error: Error) => {
        logger.warn('Failed to save ML config to database:', error);
      });

      return res["status"](200).json({
        success: true,
        message: 'ML configuration updated',
        config: flagManager.getMLConfig()
      });
    }

    case 'override': {
      // Type-safe extraction from req.body
      const body = req.body as { overrideFeature?: unknown; overrideEnabled?: unknown; clear?: unknown };
      const overrideFeature = typeof body.overrideFeature === 'string' ? body.overrideFeature : undefined;
      const overrideEnabled = typeof body.overrideEnabled === 'boolean' ? body.overrideEnabled : undefined;
      const clear = typeof body.clear === 'boolean' ? body.clear : undefined;

      if (!overrideFeature) {
        return res["status"](400).json({
          error: 'overrideFeature is required'
        });
      }

      // Handle clear case first
      if (clear) {
        flagManager.clearOverride(overrideFeature as keyof FeatureFlags);
        return res["status"](200).json({
          success: true,
          message: `Override cleared for ${overrideFeature}`
        });
      }

      // Handle non-clear case with overrideEnabled validation
      if (overrideEnabled === undefined) {
        return res["status"](400).json({
          error: 'overrideEnabled is required when not clearing'
        });
      }

      flagManager.setOverride(overrideFeature as keyof FeatureFlags, overrideEnabled);
      return res["status"](200).json({
        success: true,
        message: `Override set for ${overrideFeature} to ${overrideEnabled}`
      });
    }

    default: {
      return res["status"](400).json({
        error: 'Invalid type. Use "flag", "ml-config", or "override"'
      });
    }
  }
}
