/**
 * Webhook API Integration Tests
 *
 * NOTE: API middleware mocking is handled globally in setup.ts
 * Only mock domain-specific modules here (prisma, webhookService, etc.)
 */

// Mock @auth/prisma-adapter to avoid ESM parsing errors
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn()
}));

// Mock NextAuth
jest.mock('next-auth', () => jest.fn());

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  compare: jest.fn()
}));

// Mock dependencies
jest.mock('@/server/db', () => ({
  prisma: {
    webhook: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    apiKey: {
      findUnique: jest.fn()
    },
    apiMetric: {
      create: jest.fn()
    },
    webhookDelivery: {
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn((operations) => Promise.all(operations))
  }
}));

jest.mock('@/server/api/services/apiAuth', () => ({
  apiAuthService: {
    validateApiKey: jest.fn()
  }
}));

jest.mock('@/server/api/services/webhookService', () => ({
  webhookService: {
    trigger: jest.fn(),
    testWebhook: jest.fn()
  },
  // Export WebhookEventType enum for schema validation
  WebhookEventType: {
    MANGA_CREATED: 'manga.created',
    MANGA_UPDATED: 'manga.updated',
    MANGA_DELETED: 'manga.deleted',
    CHAPTER_CREATED: 'chapter.created',
    CHAPTER_DOWNLOADED: 'chapter.downloaded',
    CHAPTER_FAILED: 'chapter.failed',
    CHAPTER_DELETED: 'chapter.deleted',
    LIBRARY_CREATED: 'library.created',
    LIBRARY_SCAN_STARTED: 'library.scan.started',
    LIBRARY_SCAN_COMPLETED: 'library.scan.completed',
    LIBRARY_DELETED: 'library.deleted',
    DOWNLOAD_STARTED: 'download.started',
    DOWNLOAD_PROGRESS: 'download.progress',
    DOWNLOAD_COMPLETED: 'download.completed',
    DOWNLOAD_FAILED: 'download.failed'
  }
}));

// Mock RealtimeEventEmitter to prevent WebSocket initialization
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: {
    emitSystemEvent: jest.fn(),
    emitJobUpdate: jest.fn(),
    emitDownloadProgress: jest.fn(),
    emitNotification: jest.fn(),
    emitLibraryScan: jest.fn(),
    emitMangaUpdate: jest.fn(),
    emitChapterUpdate: jest.fn(),
    emit: jest.fn()
  },
  RealtimeEventEmitter: jest.fn()
}));

// Import after mocks
import { createMocks } from 'node-mocks-http';



import webhookDetailHandler from '@/pages/api/v1/webhooks/[id]';
import webhookTestHandler from '@/pages/api/v1/webhooks/[id]/test';
import webhookListHandler from '@/pages/api/v1/webhooks/index';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { apiAuthService } from '@/server/api/services/apiAuth';
import { webhookService } from '@/server/api/services/webhookService';
import { prisma } from '@/server/db';

import type { NextApiResponse } from 'next';

describe('Webhook API Endpoints', () => {
  const mockApiKey = 'test-api-key';
  const mockAuth = {
    apiKey: mockApiKey,
    userId: 'user-123',
    permissions: [
    { resource: 'webhook', actions: ['read', 'write', 'delete'] }]

  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset auth mock to return valid AsyncResult with success status
    // This is critical for Bun test runner - mock must be reset in beforeEach
    // The apiAuthMiddleware expects data with userId and apiKey fields
    (apiAuthService.validateApiKey as jest.Mock).mockResolvedValue({
      status: 'success',
      data: {
        userId: mockAuth.userId,
        apiKey: mockAuth.apiKey,
        permissions: mockAuth.permissions
      }
    });
  });

  describe('GET /api/v1/webhooks', () => {
    it('should list webhooks for the authenticated user', async () => {
      const mockWebhooks = [
      {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['manga.created', 'chapter.downloaded'],
        enabled: true,
        secret: 'hashed-secret',
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }];


      (prisma.webhook.findMany as jest.Mock).mockResolvedValue(mockWebhooks);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          'x-api-key': mockApiKey
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookListHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.arrayContaining([
        expect.objectContaining({
          id: 'webhook-1',
          url: 'https://example.com/webhook',
          events: ['manga.created', 'chapter.downloaded'],
          enabled: true,
          failureCount: 0,
          _links: {
            self: '/api/v1/webhooks/webhook-1',
            test: '/api/v1/webhooks/webhook-1/test',
            deliveries: '/api/v1/webhooks/webhook-1/deliveries'
          }
        })]
        )
      });

      // Should not include secret in response (security)
      expect(json.data[0]).not.toHaveProperty('secret');

      // Should filter by userId
      expect(prisma.webhook.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { deliveries: true }
          }
        }
      });
    });
  });

  describe('POST /api/v1/webhooks', () => {
    it('should create a new webhook', async () => {
      const newWebhookData = {
        url: 'https://myapp.com/webhook',
        events: ['manga.created', 'manga.updated', 'chapter.downloaded'],
        secret: 'my-webhook-secret-key'
      };

      const createdWebhook = {
        id: 'webhook-2',
        ...newWebhookData,
        secret: 'bcrypt-hashed-secret',
        enabled: true,
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.webhook.create as jest.Mock).mockResolvedValue(createdWebhook);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: newWebhookData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookListHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          id: 'webhook-2',
          url: 'https://myapp.com/webhook',
          events: ['manga.created', 'manga.updated', 'chapter.downloaded'],
          enabled: true,
          secret: 'my-webhook-secret-key' // Should return plain secret on creation
        })
      });

      expect(prisma.webhook.create).toHaveBeenCalledWith({
        data: {
          url: 'https://myapp.com/webhook',
          events: ['manga.created', 'manga.updated', 'chapter.downloaded'],
          secret: 'my-webhook-secret-key', // Plain secret (hashing TODO for production)
          userId: 'user-123',
          enabled: true,
          failureCount: 0
        }
      });
    });

    it('should generate a secret if not provided', async () => {
      const newWebhookData = {
        url: 'https://myapp.com/webhook',
        events: ['manga.created']
        // No secret provided
      };

      (prisma.webhook.create as jest.Mock).mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'webhook-3',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: newWebhookData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookListHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const json = JSON.parse(res._getData());

      // Should have a generated secret
      expect(json.data.secret).toBeDefined();
      expect(json.data.secret.length).toBeGreaterThanOrEqual(32);
    });

    it('should validate webhook URL', async () => {
      const invalidWebhookData = {
        url: 'not-a-valid-url',
        events: ['manga.created']
      };

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: invalidWebhookData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookListHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR', // Zod validation errors are wrapped as INTERNAL_ERROR
          message: expect.stringContaining('Invalid url')
        })
      });
    });

    it('should validate event names', async () => {
      const invalidWebhookData = {
        url: 'https://example.com/webhook',
        events: ['invalid.event', 'manga.created']
      };

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: invalidWebhookData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookListHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR', // Zod validation errors are wrapped as INTERNAL_ERROR
          message: expect.stringContaining('Invalid enum value')
        })
      });
    });
  });

  describe('POST /api/v1/webhooks/[id]/test', () => {
    it('should trigger a test webhook event', async () => {
      const mockWebhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['manga.created'],
        enabled: true,
        secret: 'hashed-secret',
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.webhook.findFirst as jest.Mock).mockResolvedValue(mockWebhook);
      (prisma.webhook.findUnique as jest.Mock).mockResolvedValue(mockWebhook);
      (webhookService.testWebhook as jest.Mock).mockResolvedValue({ status: 'success', data: true });

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: 'webhook-1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookTestHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: {
          message: 'Webhook test successful',
          tested: true
        }
      });

      expect(webhookService.testWebhook).toHaveBeenCalledWith('webhook-1');
    });

    it('should return 404 for non-existent webhook', async () => {
      (prisma.webhook.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.webhook.findUnique as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: 'non-existent'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookTestHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining('Webhook not found')
        })
      });
    });

    it('should not test disabled webhooks', async () => {
      const disabledWebhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['manga.created'],
        enabled: false,
        secret: 'hashed-secret',
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.webhook.findFirst as jest.Mock).mockResolvedValue(disabledWebhook);
      (prisma.webhook.findUnique as jest.Mock).mockResolvedValue(disabledWebhook);
      // Mock testWebhook to return error for disabled webhook
      (webhookService.testWebhook as jest.Mock).mockResolvedValue({
        status: 'error',
        error: new Error('Webhook is disabled')
      });

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: 'webhook-1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookTestHandler(req, res);

      expect(res._getStatusCode()).toBe(502); // WEBHOOK_TEST_FAILED returns 502
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'WEBHOOK_TEST_FAILED',
          message: 'Webhook is disabled'
        })
      });

      expect(webhookService.testWebhook).toHaveBeenCalledWith('webhook-1');
    });
  });

  describe('PATCH /api/v1/webhooks/[id]', () => {
    it('should update webhook', async () => {
      const updateData = {
        url: 'https://newurl.com/webhook',
        enabled: false
      };

      const existingWebhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['manga.created'],
        enabled: true,
        secret: 'hashed-secret',
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedWebhook = {
        ...existingWebhook,
        ...updateData,
        updatedAt: new Date()
      };

      (prisma.webhook.findFirst as jest.Mock).mockResolvedValue(existingWebhook);
      (prisma.webhook.update as jest.Mock).mockResolvedValue(updatedWebhook);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'PATCH',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        query: {
          id: 'webhook-1'
        },
        body: updateData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          id: 'webhook-1',
          url: 'https://newurl.com/webhook',
          enabled: false
        })
      });

      expect(prisma.webhook.update).toHaveBeenCalledWith({
        where: { id: 'webhook-1' },
        data: expect.objectContaining({
          url: 'https://newurl.com/webhook',
          enabled: false,
          updatedAt: expect.any(Date)
        })
      });
    });
  });

  describe('DELETE /api/v1/webhooks/[id]', () => {
    it('should delete webhook', async () => {
      const existingWebhook = {
        id: 'webhook-1',
        url: 'https://example.com/webhook',
        events: ['manga.created'],
        enabled: true,
        secret: 'hashed-secret',
        failureCount: 0,
        lastDeliveryAt: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.webhook.findFirst as jest.Mock).mockResolvedValue(existingWebhook);
      (prisma.webhookDelivery.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.webhook.delete as jest.Mock).mockResolvedValue({ id: 'webhook-1' });

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'DELETE',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: 'webhook-1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await webhookDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(204);
      expect(res._getData()).toBe('');

      expect(prisma.webhookDelivery.deleteMany).toHaveBeenCalledWith({
        where: { webhookId: 'webhook-1' }
      });
      expect(prisma.webhook.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-1' }
      });
    });
  });
});