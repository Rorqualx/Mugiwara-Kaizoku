/**
 * Test Setup - Prisma Database Mocks
 *
 * Mock implementations of Prisma database clients.
 * Extracted from: src/test/setup.ts (lines 431-515)
 */

import { jest } from '@jest/globals';

// Create shared prisma mock object
const createPrismaMock = (): any => ({
  user: {
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1, name: 'Test User' })),
    update: jest.fn(() => Promise.resolve({ id: 1, name: 'Updated User' })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  manga: {
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1, title: 'Test Manga' })),
    update: jest.fn(() => Promise.resolve({ id: 1, title: 'Updated Manga' })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  chapter: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  library: {
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1, name: 'Test Library' })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 }))
  },
  config: {
    findFirst: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    upsert: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 }))
  },
  calendarEvent: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  releaseSchedule: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  apiKey: {
    findUnique: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve({ id: 1, key: 'test-key' })),
    update: jest.fn(() => Promise.resolve({ id: 1, key: 'updated-key' })),
    delete: jest.fn(() => Promise.resolve({ id: 1 }))
  },
  rateLimit: {
    findUnique: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 }))
  },
  permission: {
    findUnique: jest.fn(() => Promise.resolve(null)),
    findMany: jest.fn(() => Promise.resolve([])),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 }))
  },
  metadata: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  notification: {
    findMany: jest.fn(() => Promise.resolve([])),
    findFirst: jest.fn(() => Promise.resolve(null)),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve({ id: 1 })),
    update: jest.fn(() => Promise.resolve({ id: 1 })),
    delete: jest.fn(() => Promise.resolve({ id: 1 })),
    deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    count: jest.fn(() => Promise.resolve(0))
  },
  $disconnect: jest.fn(() => Promise.resolve()),
  $transaction: jest.fn(<T>(fn: (prisma: ReturnType<typeof createPrismaMock>) => Promise<T>) => {
    const prismaMock = createPrismaMock();
    return fn(prismaMock);
  }),
  $queryRaw: jest.fn(() => Promise.resolve([])),
  $executeRaw: jest.fn(() => Promise.resolve(1))
});

// Mock @/server/db (the canonical singleton; @/lib/prisma, @/server/db/prisma,
// and @/server/db/client shims were removed during dual-client consolidation).
jest.mock('@/server/db', () => ({
  prisma: createPrismaMock()
}));
