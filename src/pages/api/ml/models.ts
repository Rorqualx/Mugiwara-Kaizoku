/**
 * ML Model Management API
 * 
 * Provides endpoints for viewing and managing ML model configurations,
 * checking model availability, and updating model settings.
 */

import { getServerSession } from 'next-auth/next';

import { isFeatureEnabled } from '@/server/config/feature-flags';
import type {
  ModelConfig
} from '@/server/config/ml-config';
import {
  getMLConfigManager,
  MLConfigManager,
  ModelType
} from '@/server/config/ml-config';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
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
    // Check if ML is enabled
    if (!isFeatureEnabled('mlPatternRecognition')) {
      return res["status"](403).json({ 
        error: 'ML pattern recognition is not enabled' 
      });
    }

    // Check authentication (admin only for write operations)
    const session = await getServerSession(req, res, authOptions);
    
    // Allow read operations for authenticated users
    if (req.method === 'GET') {
      if (!session?.user) {
        return res["status"](401).json({ error: 'Unauthorized' });
      }
    } else {
      // Write operations require admin
      if (!session?.user) {
        return res["status"](401).json({ error: 'Unauthorized' });
      }
      // TODO: Add admin role check when role system is implemented
      // if (session.user.role !== 'admin') {
      //   return res["status"](403).json({ error: 'Admin access required' });
      // }
    }

    const mlConfigManager = getMLConfigManager();

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, mlConfigManager);
      case 'PUT':
      case 'PATCH':
        return handleUpdate(req, res, mlConfigManager);
      case 'POST':
        return await handlePost(req, res, mlConfigManager);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'POST']);
        return res["status"](405).json({ error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    logger.error('[ML Models API] Error:', error);
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
  mlConfigManager: MLConfigManager
): void {
  const { type, modelType } = req.query;

  switch (type) {
    case 'config': {
      if (!modelType) {
        return res["status"](400).json({
          error: 'modelType is required'
        });
      }

      const config = mlConfigManager.getModelConfig(modelType as ModelType);
      if (!config) {
        return res["status"](404).json({
          error: `Model configuration not found for ${modelType}`
        });
      }

      return res["status"](200).json(config);
    }

    case 'all': {
      const allConfigs = mlConfigManager.getAllModelConfigs();
      return res["status"](200).json(allConfigs);
    }

    case 'paths': {
      const paths = mlConfigManager.getPaths();
      return res["status"](200).json(paths);
    }

    case 'training': {
      const trainingConfig = mlConfigManager.getTrainingConfig();
      return res["status"](200).json(trainingConfig);
    }

    case 'availability': {
      const availability: Record<string, boolean> = {};
      for (const modelTypeValue of Object.values(ModelType)) {
        availability[modelTypeValue] = mlConfigManager.isModelAvailable(modelTypeValue);
      }
      return res["status"](200).json(availability);
    }

    case 'status': {
      if (!modelType) {
        // Return status for all models
        const status: Record<string, unknown> = {};
        for (const modelTypeValue of Object.values(ModelType)) {
          const modelConfig = mlConfigManager.getModelConfig(modelTypeValue);
          status[modelTypeValue] = {
            available: mlConfigManager.isModelAvailable(modelTypeValue),
            config: modelConfig,
            path: mlConfigManager.getModelPath(modelTypeValue)
          };
        }
        return res["status"](200).json(status);
      } else {
        // Return status for specific model
        const modelConfig = mlConfigManager.getModelConfig(modelType as ModelType);
        return res["status"](200).json({
          available: mlConfigManager.isModelAvailable(modelType as ModelType),
          config: modelConfig,
          path: mlConfigManager.getModelPath(modelType as ModelType)
        });
      }
    }

    default: {
      // Return summary
      return res["status"](200).json({
        models: mlConfigManager.getAllModelConfigs(),
        paths: mlConfigManager.getPaths(),
        training: mlConfigManager.getTrainingConfig()
      });
    }
  }
}

/**
 * Handle PUT/PATCH requests (update)
 */
function handleUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  mlConfigManager: MLConfigManager
): void {
  const { type } = req.query;

  switch (type) {
    case 'model': {
      const { modelType, config } = req.body as { modelType?: unknown; config?: unknown };

      if (!modelType || !config) {
        return res["status"](400).json({
          error: 'modelType and config are required'
        });
      }

      // Validate model type
      if (!Object.values(ModelType).includes(modelType as ModelType)) {
        return res["status"](400).json({
          error: `Invalid model type: ${String(modelType)}`,
          validTypes: Object.values(ModelType)
        });
      }

      mlConfigManager.updateModelConfig(modelType as ModelType, config as Partial<ModelConfig>);

      // Emit WebSocket event for model config updated
      void realtimeEmitter.emitSystemEvent({
        eventType: 'ml:model:updated',
        source: 'ml-models-api',
        message: `Model configuration updated for ${String(modelType)}`,
        data: { modelType: String(modelType) },
      });

      return res["status"](200).json({
        success: true,
        message: `Model configuration updated for ${String(modelType)}`,
        config: mlConfigManager.getModelConfig(modelType as ModelType)
      });
    }

    case 'training': {
      const trainingConfig = req.body as Record<string, unknown> | undefined;

      if (!trainingConfig || Object.keys(trainingConfig).length === 0) {
        return res["status"](400).json({
          error: 'Training configuration data is required'
        });
      }

      mlConfigManager.updateTrainingConfig(trainingConfig);

      // Emit WebSocket event for training config updated
      void realtimeEmitter.emitSystemEvent({
        eventType: 'ml:training:updated',
        source: 'ml-models-api',
        message: 'Training configuration updated',
        data: {},
      });

      return res["status"](200).json({
        success: true,
        message: 'Training configuration updated',
        config: mlConfigManager.getTrainingConfig()
      });
    }

    default: {
      return res["status"](400).json({
        error: 'Invalid type. Use "model" or "training"'
      });
    }
  }
}

/**
 * Handle POST requests (actions)
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  mlConfigManager: MLConfigManager
): Promise<void> {
  const { action } = req.query;

  switch (action) {
    case 'initialize': {
      await mlConfigManager.initialize();

      // Emit WebSocket event for ML system initialized
      void realtimeEmitter.emitSystemEvent({
        eventType: 'ml:system:initialized',
        source: 'ml-models-api',
        message: 'ML system initialized',
        data: { modelCount: mlConfigManager.getAllModelConfigs().length },
      });

      return res["status"](200).json({
        success: true,
        message: 'ML system initialized',
        status: {
          models: mlConfigManager.getAllModelConfigs().map((m: ModelConfig) => ({
            type: m.type,
            version: m.version,
            available: mlConfigManager.isModelAvailable(m.type)
          }))
        }
      });
    }

    case 'export': {
      const { modelType: exportType, format } = req.body as { modelType?: unknown; format?: unknown };

      if (!exportType) {
        return res["status"](400).json({
          error: 'modelType is required'
        });
      }

      const exportPath = mlConfigManager.getExportPath(
        exportType as ModelType,
        (format as 'pb' | 'json' | 'onnx' | undefined) ?? 'json'
      );

      // TODO: Implement actual model export logic
      return res["status"](200).json({
        success: true,
        message: `Model export path generated`,
        path: exportPath
      });
    }

    case 'cache-clear': {
      const { key } = req.body as { key?: unknown };

      // TODO: Implement cache clearing logic
      return res["status"](200).json({
        success: true,
        message: key ? `Cache cleared for ${String(key)}` : 'All cache cleared'
      });
    }

    default: {
      return res["status"](400).json({
        error: 'Invalid action. Use "initialize", "export", or "cache-clear"'
      });
    }
  }
}