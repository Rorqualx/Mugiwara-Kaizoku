/**
 * API Key Management Endpoints
 *
 * GET /api/v1/auth/keys - List API keys
 * POST /api/v1/auth/keys - Create API key
 */

import { z } from 'zod';

import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { apiAuthService } from '@/server/api/services/apiAuth';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute, successResponse} from '@/utils/api-route-factory';
import { isSuccess } from '@/utils/async-result';

import type { NextApiResponse } from 'next';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Request validation schema
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.object({
    resource: z.string(),
    actions: z.array(z.string()),
    scope: z.string().optional(),
  })),
  expiresAt: z.string().datetime().optional(),
});

export default createApiRoute({
  handlers: {
    GET: async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
      // List API keys for the authenticated user
      const auth = isRecord(req.auth) ? req.auth : {};
      const userId = 'userId' in auth ? (auth['userId'] as string | undefined) ?? '' : '';
      const keysResult = await apiAuthService.listApiKeys(String(userId));

      if (!isSuccess(keysResult)) {
        const errorResult = keysResult as { error?: Error };
        throw errorResult.error ?? new Error('Failed to list API keys');
      }

      const data = keysResult.data.map((key: unknown) => {
        if (!isRecord(key)) return null;
        return {
          id: key["id"],
          name: key["name"],
          permissions: key['permissions'],
          expiresAt: key['expiresAt'] instanceof Date ? key['expiresAt'].toISOString() : undefined,
          lastUsedAt: key['lastUsedAt'] instanceof Date ? key['lastUsedAt'].toISOString() : undefined,
          createdAt: key['createdAt'] instanceof Date ? key['createdAt'].toISOString() : '',
          updatedAt: key['createdAt'] instanceof Date ? key['createdAt'].toISOString() : '', // Same as created for now
          _links: {
            self: `/api/v1/auth/keys/${key["id"]}`,
            revoke: `/api/v1/auth/keys/${key["id"]}`,
          },
        };
      }).filter(Boolean);

      res.status(200).json(successResponse(data));
    },

    POST: async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
      // Validation handled by factory
      const data = isRecord(req.body) ? req.body : {};
      const auth = isRecord(req.auth) ? req.auth : {};

      // Create API key
      const userId = 'userId' in auth ? (auth['userId'] as string | undefined) ?? '' : '';

      // Type guard for permissions
      const permissions = data['permissions'];
      const validatedPermissions = Array.isArray(permissions) ? permissions as Array<{
        resource: string;
        actions: string[];
        scope?: string;
      }> : [];

      const keyResult = await apiAuthService.generateApiKey(
        String(userId),
        String(data["name"]),
        validatedPermissions,
        data['expiresAt'] ? new Date(String(data['expiresAt'])) : undefined
      );

      if (!isSuccess(keyResult)) {
        const errorResult = keyResult as { error?: Error };
        throw errorResult.error ?? new Error('Failed to create API key');
      }

      const resultData: Record<string, unknown> = isRecord(keyResult.data) ? keyResult.data : {};

      // Emit WebSocket event for API key created
      void realtimeEmitter.emitSystemEvent({
        eventType: 'apiKey:created',
        source: 'authKeysApi',
        message: `API key created: ${String(data["name"])}`,
        data: { keyId: resultData["id"], name: resultData["name"] }
      });

      const responseData = {
        id: resultData["id"],
        name: resultData["name"],
        key: resultData['key'], // Only returned on creation
        permissions: data['permissions'],
        expiresAt: resultData['expiresAt'] instanceof Date ? resultData['expiresAt'].toISOString() : undefined,
        lastUsedAt: undefined,
        createdAt: resultData['createdAt'] instanceof Date ? resultData['createdAt'].toISOString() : '',
        updatedAt: resultData['createdAt'] instanceof Date ? resultData['createdAt'].toISOString() : '',
        _links: {
          self: `/api/v1/auth/keys/${resultData["id"]}`,
          revoke: `/api/v1/auth/keys/${resultData["id"]}`,
        },
      };

      res.status(201).json(successResponse(responseData));
    }
  },
  requireAuth: true,
  permissions: {
    GET: { resource: 'apikey', action: 'read' },
    POST: { resource: 'apikey', action: 'create' },
  },
  validation: {
    POST: createApiKeySchema,
  },
});