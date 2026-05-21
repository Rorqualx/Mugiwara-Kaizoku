/**
 * Webhook Test API Endpoint
 *
 * POST /api/v1/webhooks/[id]/test - Test a webhook
 */

import { webhookService } from '@/server/api/services/webhookService';
import { prisma } from '@/server/db';
import { createApiRoute } from '@/utils/api-route-factory';
import { isSuccess, isError } from '@/utils/async-result';

export default createApiRoute({
  requireAuth: true,
  permissions: {
    POST: { resource: 'webhook', action: 'write' }
  },
  handlers: {
    POST: async (req, res): Promise<void> => {
      // Get webhook ID from query
      const { id } = req.query;
      if (!id || Array.isArray(id)) {
        return res["status"](400).json({
          status: 'error',
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Invalid webhook ID',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      // Verify webhook ownership
      const authUser = req.auth && typeof req.auth === 'object' && 'userId' in req.auth ? req.auth as { userId: string } : null;
      const whereClause: { id: string; userId?: string } = { id };
      if (authUser?.userId) {
        whereClause.userId = authUser.userId;
      }
      const webhook = await prisma.webhook.findFirst({
        where: whereClause
      });

      if (!webhook) {
        return res["status"](404).json({
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      // Test webhook
      const result = await webhookService.testWebhook(id);

      if (!isSuccess(result)) {
        const errorMessage = isError(result) ? result.error instanceof Error ? result.error.message : String(result.error) : 'Webhook test failed';
        return res["status"](502).json({
          status: 'error',
          error: {
            code: 'WEBHOOK_TEST_FAILED',
            message: errorMessage,
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? ''
          }
        });
      }

      return res["status"](200).json({
        status: 'success',
        data: {
          message: 'Webhook test successful',
          tested: true
        }
      });
    }
  }
});