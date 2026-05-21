/**
 * Centralized mock configurations for tests
 * 
 * This file contains common mocks that are used across multiple test files
 * to ensure consistency and reduce duplication.
 */

import { jest } from '@jest/globals';
// @ts-ignore - Importing React without esModuleInterop
import * as React from 'react';

// Mock useBreakpoint hook for mobile tests
jest.mock('@/hooks/mobile/useBreakpoint', () => ({
  useBreakpoint: jest.fn(() => ({
    current: 'xs' as const,
    isDown: jest.fn(() => true),
    isUp: jest.fn(() => false),
    isBetween: jest.fn(() => false),
    isMobile: true,
    isTablet: false,
    isDesktop: false
  }))
}));

// Common component mocks
export const mockMangaDxClient = {
  getManga: jest.fn(),
  getChapters: jest.fn(),
  search: jest.fn(),
  getChapterPages: jest.fn(),
};

export const mockTrpcClient = {
  manga: {
    query: {
      useQuery: jest.fn(),
    },
    get: {
      useQuery: jest.fn(),
    },
    add: {
      useMutation: jest.fn(),
    },
    update: {
      useMutation: jest.fn(),
    },
    remove: {
      useMutation: jest.fn(),
    },
    search: {
      useQuery: jest.fn(),
    },
  },
  library: {
    query: {
      useQuery: jest.fn(),
    },
    create: {
      useMutation: jest.fn(),
    },
  },
  tasks: {
    getAll: {
      useQuery: jest.fn(),
    },
    getByStatus: {
      useQuery: jest.fn(),
    },
    retry: {
      useMutation: jest.fn(),
    },
    cancel: {
      useMutation: jest.fn(),
    },
  },
  events: {
    list: {
      useQuery: jest.fn(),
    },
    getEventTypes: {
      useQuery: jest.fn(),
    },
  },
  settings: {
    query: {
      useQuery: jest.fn(),
    },
    update: {
      useMutation: jest.fn(),
    },
  },
  chapter: {
    getByMangaId: {
      useQuery: jest.fn(),
    },
  },
};

// Mock components
export const MockMangadxSettings = () => React.createElement('div', { 'data-testid': 'mangadx-settings' }, 'MangaDX Settings');
export const MockSettingsMenu = () => React.createElement('div', { 'data-testid': 'settings-menu' }, 'Settings Menu');
export const MockMangaCard = ({ manga }: { manga?: { id?: number | string; title?: string } }) => {
  const mangaData = manga as { id?: number | string; title?: string } | undefined;
  return React.createElement('div', { 'data-testid': `manga-card-${mangaData?.id}` }, mangaData?.title);
};

// Mock data generators
export const createMockManga = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Test Manga',
  description: 'Test description',
  cover: 'test-cover.jpg',
  status: 'Ongoing',
  author: 'Test Author',
  artist: 'Test Artist',
  genres: ['Action', 'Adventure'],
  year: 2023,
  ...overrides,
});

export const createMockChapter = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Chapter 1',
  chapterNumber: 1,
  volumeNumber: 1,
  pages: 20,
  downloadStatus: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
  mangaId: 1,
  ...overrides,
});

export const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  role: 'USER',
  ...overrides,
});

// API response mocks
export const mockApiResponse = {
  success: (data: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }),
  error: (status: number, message: string) => ({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  }),
};

// Mock request/response objects for API tests
export const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  url: '/api/test',
  headers: {},
  query: {},
  body: {},
  ...overrides,
});

export const createMockResponse = () => {
  const res: unknown = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res;
};

// Mock session data
export const mockSession = {
  user: createMockUser(),
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Global mock body object for API tests
export const mockBody = {
  username: 'testuser',
  password: 'testpass',
  email: 'test@example.com',
};

// Export global references for tests
(global as { mockMangaDxClient?: unknown }).mockMangaDxClient = mockMangaDxClient;
(global as { mockBody?: unknown }).mockBody = mockBody;
(global as { mockTrpcClient?: unknown }).mockTrpcClient = mockTrpcClient;