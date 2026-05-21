/**
 * Test utilities for backup router authentication tests
 * @module tests/server/trpc/routers/test-helpers/backup-test-utils
 */

import { mock } from 'bun:test';
import type { Session } from 'next-auth';
import type { Context } from '@/server/trpc/context';
import type { NextApiRequest, NextApiResponse } from 'next';

/** Mock for NextAuth session retrieval */
export const mockGetServerSession = mock();

/**
 * Creates a mock tRPC context with specified session
 */
export function createMockContext(session: Session | null): Context & {
  req: NextApiRequest;
  res: NextApiResponse;
} {
  const mockReq = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest;

  const mockRes = {
    status: mock(() => mockRes),
    json: mock(() => mockRes),
    end: mock(() => mockRes),
  } as unknown as NextApiResponse;

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock prisma client for tests
    prisma: {} as any,
    req: mockReq,
    res: mockRes,
  };
}

/**
 * Creates a session object for a user with specified role
 */
export function createSession(role: 'USER' | 'ADMIN'): Session {
  return {
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Creates a mock caller for a tRPC router with specified session
 */
export function createCaller<T>(router: T, session: Session | null): T {
  mockGetServerSession.mockResolvedValue(session);
  const ctx = createMockContext(session);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type assertion for tRPC router
  const routerWithCreateCaller = router as any;
  return routerWithCreateCaller.createCaller(ctx);
}

/** Test expectations for unauthorized access */
export const UNAUTHORIZED_MATCHER = expect.objectContaining({
  code: 'UNAUTHORIZED',
  message: expect.stringContaining('logged in'),
});

/** Test expectations for forbidden access */
export const FORBIDDEN_MATCHER = expect.objectContaining({
  code: 'FORBIDDEN',
  message: expect.stringContaining('admin'),
});
