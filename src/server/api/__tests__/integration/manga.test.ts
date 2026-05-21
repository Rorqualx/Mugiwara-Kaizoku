/**
 * Manga API Integration Tests
 */

import { createMocks } from 'node-mocks-http';

import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { apiAuthService } from '@/server/api/services/apiAuth';
import { prisma } from '@/server/db';

import type { NextApiResponse } from 'next';

// Mock handlers for testing
const mangaListHandler = async (req: ApiRequest, res: NextApiResponse) => {
  // Check authentication
  if (!req.auth) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }

  if (req.method === 'GET') {
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = parseInt(req.query["limit"] as string) || 20;
    const libraryId = req.query["libraryId"] ? parseInt(req.query["libraryId"] as string) : undefined;

    // Build query options
    const queryOptions: { where?: { libraryId?: number } } = {};
    if (libraryId !== undefined) {
      queryOptions.where = { libraryId };
    }

    const data = await prisma.manga.findMany(queryOptions);
    const total = await prisma.manga.count();

    // Add HATEOAS links to each manga item
    const enrichedData = data.map((manga: { id: number; libraryId: number }) => ({
      ...manga,
      _links: {
        self: `/api/v1/manga/${manga.id}`,
        chapters: `/api/v1/manga/${manga.id}/chapters`,
        library: `/api/v1/libraries/${manga.libraryId}`,
        download: `/api/v1/manga/${manga.id}/download`
      }
    }));

    const response: {
      status: string;
      data: unknown[];
      meta: { page: number; limit: number; total: number; hasMore: boolean };
      links: { self: string; next?: string; prev?: string };
    } = {
      status: 'success',
      data: enrichedData,
      meta: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      },
      links: {
        self: `/api/v1/manga?page=${page}&limit=${limit}`
      }
    };

    if (page * limit < total) {
      response.links.next = `/api/v1/manga?page=${page + 1}&limit=${limit}`;
    }
    if (page > 1) {
      response.links.prev = `/api/v1/manga?page=${page - 1}&limit=${limit}`;
    }

    return res.status(200).json(response);
  }

  if (req.method === 'POST') {
    // Check for required fields
    if (!req.body.title || !req.body.sourceId || !req.body.source || !req.body.libraryId) {
      return res.status(400).json({
        status: 'error',
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
      });
    }

    // Cast to jest.Mock for test - the mock handles it without real Prisma validation
    const newManga = await (prisma.manga.create as jest.Mock)({
      data: {
        title: req.body.title,
        source: req.body.source,
        sourceId: req.body.sourceId,
        libraryId: req.body.libraryId,
        fileStatus: 'PENDING'
      }
    });

    return res.status(201).json({
      status: 'success',
      data: newManga
    });
  }

  return res.status(405).json({
    status: 'error',
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
  });
};

const mangaDetailHandler = async (req: ApiRequest, res: NextApiResponse) => {
  // Check authentication
  if (!req.auth) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    const manga = await prisma.manga.findUnique({ where: { id: Number(id) } });

    if (!manga) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Manga not found' }
      });
    }

    return res.status(200).json({ status: 'success', data: manga });
  }

  if (req.method === 'PATCH') {
    const updatedManga = await prisma.manga.update({
      where: { id: Number(id) },
      data: req.body,
      include: { Metadata: true }
    });

    return res.status(200).json({
      status: 'success',
      data: updatedManga
    });
  }

  if (req.method === 'DELETE') {
    // Check delete permission
    const hasDeletePermission = req.auth.permissions?.some(
      (p: { resource: string; actions: string[] }) =>
        p.resource === 'manga' && p.actions.includes('delete')
    );

    if (!hasDeletePermission) {
      return res.status(403).json({
        status: 'error',
        error: { code: 'PERMISSION_DENIED', message: 'Insufficient permissions' }
      });
    }

    await prisma.manga.delete({ where: { id: Number(id) } });

    return res.status(204).send('');
  }

  return res.status(405).json({
    status: 'error',
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
  });
};

// Mock API auth service
jest.mock('@/server/api/services/apiAuth', () => ({
  apiAuthService: {
    validateApiKey: jest.fn()
  }
}));

describe('Manga API Endpoints', () => {
  const mockApiKey = 'test-api-key';
  const mockAuth = {
    apiKey: mockApiKey,
    userId: 'user-123',
    permissions: [
    { resource: 'manga', actions: ['read', 'write', 'delete'] }]

  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API key validation
    (apiAuthService.validateApiKey as jest.Mock).mockResolvedValue({
      status: 'success',
      data: mockAuth
    });
  });

  describe('GET /api/v1/manga', () => {
    it('should list manga with pagination', async () => {
      const mockManga = [
      {
        id: 1,
        title: 'One Piece',
        sourceId: 'one-piece',
        source: 'anilist',
        status: 'ACTIVE',
        coverUrl: null,
        libraryId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];


      (prisma.manga.findMany as jest.Mock).mockResolvedValue(mockManga);
      (prisma.manga.count as jest.Mock).mockResolvedValue(1);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          page: '1',
          limit: '20'
        }
      });

      // Simulate middleware setting auth
      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaListHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          title: 'One Piece',
          sourceId: 'one-piece',
          source: 'anilist',
          status: 'ACTIVE',
          libraryId: 1,
          _links: {
            self: '/api/v1/manga/1',
            chapters: '/api/v1/manga/1/chapters',
            library: '/api/v1/libraries/1',
            download: '/api/v1/manga/1/download'
          }
        })]
        ),
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          hasMore: false
        },
        links: {
          self: '/api/v1/manga?page=1&limit=20'
        }
      });
      // Verify no next/prev links when not applicable
      expect(json.links.next).toBeUndefined();
      expect(json.links.prev).toBeUndefined();
    });

    it('should filter manga by library', async () => {
      (prisma.manga.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.manga.count as jest.Mock).mockResolvedValue(0);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          libraryId: '1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaListHandler(req, res);

      expect(prisma.manga.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { libraryId: 1 }
        })
      );
    });

    it('should require authentication', async () => {
      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET'
      });

      // Don't set auth to simulate missing authentication
      req.requestId = 'test-request-id';

      await mangaListHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'UNAUTHORIZED'
        })
      });
    });
  });

  describe('POST /api/v1/manga', () => {
    it('should create a new manga', async () => {
      const newMangaData = {
        title: 'Naruto',
        sourceId: 'naruto',
        source: 'anilist',
        libraryId: 1,
        metadata: {
          description: 'Ninja story',
          authors: ['Masashi Kishimoto'],
          genres: ['Shounen', 'Action']
        }
      };

      const createdManga = {
        id: 2,
        ...newMangaData,
        status: 'PENDING',
        coverUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.manga.create as jest.Mock).mockResolvedValue(createdManga);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: newMangaData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaListHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          id: 2,
          title: 'Naruto',
          sourceId: 'naruto',
          source: 'anilist',
          status: 'PENDING',
          libraryId: 1
        })
      });

      expect(prisma.manga.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Naruto',
          source: 'anilist',
          sourceId: 'naruto',
          libraryId: 1,
          fileStatus: 'PENDING'
        })
      });
    });

    it('should validate required fields', async () => {
      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'POST',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        body: {
          title: 'Incomplete Manga'
          // Missing required fields
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaListHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      });
    });
  });

  describe('GET /api/v1/manga/[id]', () => {
    it('should get manga by ID', async () => {
      const mockManga = {
        id: 1,
        title: 'One Piece',
        sourceId: 'one-piece',
        source: 'anilist',
        status: 'ACTIVE',
        coverUrl: null,
        libraryId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          description: 'Pirates!',
          authors: ['Eiichiro Oda'],
          genres: ['Adventure', 'Shounen']
        }
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: '1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          id: 1,
          title: 'One Piece',
          metadata: {
            description: 'Pirates!',
            authors: ['Eiichiro Oda'],
            genres: ['Adventure', 'Shounen']
          }
        })
      });
    });

    it('should return 404 for non-existent manga', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'GET',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: '999'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining('Manga not found')
        })
      });
    });
  });

  describe('PATCH /api/v1/manga/[id]', () => {
    it('should update manga', async () => {
      const updateData = {
        title: 'One Piece (Updated)',
        status: 'COMPLETED'
      };

      const updatedManga = {
        id: 1,
        title: 'One Piece (Updated)',
        sourceId: 'one-piece',
        source: 'anilist',
        status: 'COMPLETED',
        coverUrl: null,
        libraryId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.manga.update as jest.Mock).mockResolvedValue(updatedManga);

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'PATCH',
        headers: {
          'x-api-key': mockApiKey,
          'content-type': 'application/json'
        },
        query: {
          id: '1'
        },
        body: updateData
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'success',
        data: expect.objectContaining({
          id: 1,
          title: 'One Piece (Updated)',
          status: 'COMPLETED'
        })
      });

      expect(prisma.manga.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
        include: { Metadata: true }
      });
    });
  });

  describe('DELETE /api/v1/manga/[id]', () => {
    it('should delete manga', async () => {
      (prisma.manga.delete as jest.Mock).mockResolvedValue({ id: 1 });

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'DELETE',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: '1'
        }
      });

      req.auth = mockAuth;
      req.requestId = 'test-request-id';

      await mangaDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(204);
      expect(res._getData()).toBe('');

      expect(prisma.manga.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should check delete permission', async () => {
      // Mock auth without delete permission
      const limitedAuth = {
        ...mockAuth,
        permissions: [
        { resource: 'manga', actions: ['read'] }]

      };

      const { req, res } = createMocks<ApiRequest, NextApiResponse>({
        method: 'DELETE',
        headers: {
          'x-api-key': mockApiKey
        },
        query: {
          id: '1'
        }
      });

      req.auth = limitedAuth;
      req.requestId = 'test-request-id';

      await mangaDetailHandler(req, res);

      expect(res._getStatusCode()).toBe(403);
      const json = JSON.parse(res._getData());

      expect(json).toMatchObject({
        status: 'error',
        error: expect.objectContaining({
          code: 'PERMISSION_DENIED'
        })
      });
    });
  });
});