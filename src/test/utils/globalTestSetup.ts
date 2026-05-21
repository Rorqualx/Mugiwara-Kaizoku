/**
 * Global Test Setup Utilities
 * 
 * Provides common mocks and utilities used across all test files
 */

import { jest } from '@jest/globals';

// Global mock for Next.js router
export const createMockRouter = (overrides = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  pathname: '/',
  route: '/',
  asPath: '/',
  query: {},
  isReady: true,
  basePath: '',
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  isFallback: false,
  isLocaleDomain: false,
  isPreview: false,
  reload: jest.fn(),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  ...overrides,
});

// Global Prisma mock
export const createMockPrisma = () => ({
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  manga: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  chapter: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  library: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
});

// Global TRPC mock
export const createMockTrpc = () => ({
  manga: {
    getAll: {
      useQuery: jest.fn(),
      useMutation: jest.fn(),
    },
    getById: {
      useQuery: jest.fn(),
    },
    create: {
      useMutation: jest.fn(),
    },
    update: {
      useMutation: jest.fn(),
    },
    delete: {
      useMutation: jest.fn(),
    },
  },
  chapter: {
    getAll: {
      useQuery: jest.fn(),
    },
    sync: {
      useMutation: jest.fn(),
    },
  },
  library: {
    getAll: {
      useQuery: jest.fn(),
    },
    create: {
      useMutation: jest.fn(),
    },
  },
  useUtils: jest.fn(() => ({
    manga: {
      getAll: {
        invalidate: jest.fn(),
        setData: jest.fn(),
      },
    },
  })),
});

// Common test utilities
export const setupGlobalMocks = () => {
  // Mock Next.js router
  jest.mock('next/router', () => ({
    useRouter: () => createMockRouter(),
  }));

  // Mock Next.js navigation
  jest.mock('next/navigation', () => ({
    useRouter: () => createMockRouter(),
    useSearchParams: () => ({
      get: jest.fn(),
    }),
    usePathname: () => '/',
  }));

  // Mock Prisma
  jest.mock('@/server/db', () => ({
    prisma: createMockPrisma(),
  }));

  // Mock TRPC
  jest.mock('@/utils/trpcClient', () => ({
    trpc: createMockTrpc(),
  }));
};