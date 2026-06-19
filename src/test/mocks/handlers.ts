/**
 * MSW (Mock Service Worker) Handlers
 * 
 * Mock API handlers for testing HTTP requests and tRPC procedures.
 * These handlers intercept network requests during tests and return mock data.
 */

import { http, HttpResponse } from 'msw';
import {
  mockManga,
  mockChapter,
  mockLibrary,
  mockSettings,
  mockApiResponse,
  mockApiError } from
'../utils/testUtils';

/**
 * REST API handlers for non-tRPC endpoints
 */
export const restHandlers = [
// Auth endpoints
http.post('/api/auth/logout', () => {
  return HttpResponse.json(mockApiResponse({ success: true }));
}),

// Prowlarr proxy endpoints
http.get('/api/proxy/prowlarr/indexer', () => {
  return HttpResponse.json([
  {
    id: 1,
    name: 'Test Indexer',
    protocol: 'torrent',
    enable: true,
    priority: 1
  }]
  );
}),

http.put('/api/proxy/prowlarr/indexer/:id', () => {
  return HttpResponse.json({ success: true });
}),

// Download client proxy endpoints
http.get('/api/proxy/deluge/torrents', () => {
  return HttpResponse.json([
  {
    hash: 'test-hash',
    name: 'Test Torrent',
    progress: 75.5,
    state: 'downloading'
  }]
  );
}),

http.get('/api/proxy/transmission/torrents', () => {
  return HttpResponse.json({
    torrents: [
    {
      id: 1,
      name: 'Test Torrent',
      percentDone: 0.755,
      status: 4 // TR_STATUS_DOWNLOAD
    }]

  });
}),

// File upload endpoints
http.post('/api/upload', () => {
  return HttpResponse.json({
    url: 'https://example.com/uploaded-file.jpg',
    filename: 'uploaded-file.jpg'
  });
}),

// Error scenarios for testing
http.get('/api/error/500', () => {
  return HttpResponse.json(
    mockApiError('Internal Server Error'),
    { status: 500 }
  );
}),

http.get('/api/error/404', () => {
  return HttpResponse.json(
    mockApiError('Not Found'),
    { status: 404 }
  );
}),

http.get('/api/error/401', () => {
  return HttpResponse.json(
    mockApiError('Unauthorized'),
    { status: 401 }
  );
})];


/**
 * tRPC handlers for mocking tRPC procedures
 * Note: These use the same HTTP structure but follow tRPC conventions
 */
export const trpcHandlers = [
// Library procedures
http.get('/api/trpc/library.query', () => {
  return HttpResponse.json({
    result: {
      data: [mockLibrary]
    }
  });
}),

http.post('/api/trpc/library.create', () => {
  return HttpResponse.json({
    result: {
      data: mockLibrary
    }
  });
}),

http.post('/api/trpc/library.update', () => {
  return HttpResponse.json({
    result: {
      data: mockLibrary
    }
  });
}),

http.post('/api/trpc/library.delete', () => {
  return HttpResponse.json({
    result: {
      data: { success: true }
    }
  });
}),

// Manga procedures
http.get('/api/trpc/manga.query', () => {
  return HttpResponse.json({
    result: {
      data: [mockManga]
    }
  });
}),

http.get('/api/trpc/manga.get', () => {
  return HttpResponse.json({
    result: {
      data: mockManga
    }
  });
}),

http.post('/api/trpc/manga.add', () => {
  return HttpResponse.json({
    result: {
      data: mockManga
    }
  });
}),

http.post('/api/trpc/manga.update', () => {
  return HttpResponse.json({
    result: {
      data: mockManga
    }
  });
}),

http.post('/api/trpc/manga.remove', () => {
  return HttpResponse.json({
    result: {
      data: { success: true }
    }
  });
}),

// Chapter procedures
http.get('/api/trpc/manga.getChapters', () => {
  return HttpResponse.json({
    result: {
      data: [mockChapter]
    }
  });
}),

// Settings procedures
http.get('/api/trpc/settings.query', () => {
  // Legacy format handler for backward compatibility
  return HttpResponse.json({
    result: {
      data: mockSettings
    }
  });
}),

http.post('/api/trpc/settings.update', () => {
  // Legacy format handler for backward compatibility
  return HttpResponse.json({
    result: {
      data: mockSettings
    }
  });
}),

// Standard settings procedures (new API format)
// settings.get/set now return the bare payload over the wire (no AsyncResult envelope).
http.get('/api/trpc/settings.get', () => {
  return HttpResponse.json({
    result: {
      data: mockSettings
    }
  });
}),

http.post('/api/trpc/settings.set', () => {
  return HttpResponse.json({
    result: {
      data: true
    }
  });
}),

// Task procedures
http.get('/api/trpc/jobs.getAll', () => {
  return HttpResponse.json({
    result: {
      data: [
      {
        id: 1,
        type: 'CHAPTER_CHECK',
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        
        lastChecked: new Date('2024-01-01'),
        scheduledAt: null,
        interval: null,
        mangaId: 1,
        chapterId: null,
        maxRetries: 3,
        priority: 0,
        queueId: null
      }]

    }
  });
}),

http.get('/api/trpc/jobs.getByStatus', () => {
  return HttpResponse.json({
    result: {
      data: [
      {
        id: 1,
        type: 'CHAPTER_CHECK',
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        
        lastChecked: new Date('2024-01-01'),
        scheduledAt: null,
        interval: null,
        mangaId: 1,
        chapterId: null,
        maxRetries: 3,
        priority: 0,
        queueId: null
      }]

    }
  });
}),

// Event procedures
http.get('/api/trpc/events.list', () => {
  return HttpResponse.json({
    result: {
      data: [
      {
        id: 'event-1',
        timestamp: new Date('2024-01-01'),
        type: 'info',
        source: 'system',
        level: 'INFO',
        message: 'Test event',
        details: {},
        relatedID: null,
        relatedEntityType: null
      }]

    }
  });
}),

// Search procedures
http.post('/api/trpc/manga.search', () => {
  return HttpResponse.json({
    result: {
      data: [
      {
        title: 'Search Result Manga',
        source: 'anilist',
        externalId: 'ext-123',
        coverUrl: 'https://example.com/cover.jpg',
        summary: 'Search result summary',
        status: 'ONGOING',
        year: 2024
      }]

    }
  });
}),

// System procedures
http.get('/api/trpc/system.getStatus', () => {
  return HttpResponse.json({
    result: {
      data: {
        version: '1.6.1',
        uptime: 3600000,
        memory: {
          used: 512000000,
          total: 1024000000
        },
        database: {
          connected: true
        },
        integrations: {
          anilist: { connected: true },
          prowlarr: { connected: false }
        }
      }
    }
  });
})];


/**
 * All handlers combined
 */
export const handlers = [...restHandlers, ...trpcHandlers];