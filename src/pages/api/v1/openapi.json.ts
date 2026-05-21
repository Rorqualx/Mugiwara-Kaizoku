/**
 * OpenAPI Specification Endpoint
 * 
 * GET /api/v1/openapi.json - OpenAPI 3.0 specification
 */

import { createApiRoute } from '@/utils/api-route-factory';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Kaizoku API',
    version: '1.0.0',
    description: 'Third-party API for Mugiwara-Kaizoku manga management system',
    contact: {
      name: 'Kaizoku Support',
      url: 'https://github.com/oae/kaizoku',
    },
  },
  servers: [
    {
      url: process.env["NEXT_PUBLIC_APP_URL"] ? `${process.env["NEXT_PUBLIC_APP_URL"]}/api/v1` : 'http://localhost:3000/api/v1',
      description: 'Current server',
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['error'],
          },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' },
            },
            required: ['code', 'message', 'timestamp', 'requestId'],
          },
        },
        required: ['status', 'error'],
      },
      Success: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success'],
          },
          data: { type: 'object' },
        },
        required: ['status', 'data'],
      },
      Manga: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          alternativeTitles: {
            type: 'array',
            items: { type: 'string' },
          },
          description: { type: 'string' },
          status: { type: 'string' },
          coverUrl: { type: 'string' },
          genres: {
            type: 'array',
            items: { type: 'string' },
          },
          authors: {
            type: 'array',
            items: { type: 'string' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title'],
      },
      Chapter: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          mangaId: { type: 'integer' },
          name: { type: 'string' },
          volume: { type: 'string' },
          chapter: { type: 'string' },
          pages: { type: 'integer' },
          publishedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'mangaId', 'name'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['healthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        version: { type: 'string' },
                        uptime: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/manga': {
      get: {
        summary: 'List manga',
        tags: ['Manga'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] },
          },
        ],
        responses: {
          '200': {
            description: 'List of manga',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Manga' },
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            total: { type: 'integer' },
                            totalPages: { type: 'integer' },
                            hasNext: { type: 'boolean' },
                            hasPrev: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/webhooks': {
      get: {
        summary: 'List webhooks',
        tags: ['Webhooks'],
        responses: {
          '200': {
            description: 'List of webhooks',
          },
        },
      },
      post: {
        summary: 'Create webhook',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  secret: { type: 'string' },
                },
                required: ['url', 'events'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook created',
          },
        },
      },
    },
  },
  tags: [
    { name: 'System', description: 'System operations' },
    { name: 'Manga', description: 'Manga management' },
    { name: 'Chapters', description: 'Chapter management' },
    { name: 'Webhooks', description: 'Webhook management' },
    { name: 'Metrics', description: 'System metrics' },
  ],
};

export default createApiRoute({
  requireAuth: false, // OpenAPI spec should be public
  cache: {
    maxAge: 3600, // Cache for 1 hour
    sMaxAge: 86400, // CDN cache for 1 day
    private: false,
  },
  handlers: {
    GET: (req, res): void => {
      // Return the OpenAPI specification
      res["status"](200).json(openApiSpec);
    },
  },
});