/** @jest-environment node */
import { prisma } from '@/server/db';
import { healthRouter } from '@/server/trpc/routers/health';
import { logger } from '@/utils/logger';

// The router is reduced to its bare resolver functions: this test is about
// what the public `dbCheck` resolver returns, not about tRPC plumbing.
jest.mock('@/server/trpc/procedures', () => ({
  publicProcedure: { query: (resolver: unknown): unknown => resolver },
}));
jest.mock('@/server/trpc/trpc', () => ({ router: (routes: unknown): unknown => routes }));
jest.mock('@/server/db', () => ({ prisma: { $queryRaw: jest.fn() } }));
jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const dbCheck = (healthRouter as unknown as { dbCheck: () => Promise<{ status: string; message: string }> }).dbCheck;
const mockQueryRaw = prisma.$queryRaw as unknown as jest.Mock;

const DRIVER_ERROR =
  'Can\'t reach database server at `db.internal.test:5432` for user `kaizoku` on database `kaizoku`';

describe('health.dbCheck (public)', () => {
  it('reports ok when the database answers', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(dbCheck()).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns a generic failure and keeps the driver error out of the response', async () => {
    mockQueryRaw.mockRejectedValue(new Error(DRIVER_ERROR));
    const result = await dbCheck();
    expect(result.status).toBe('error');
    expect(result.message).toBe('Database connection failed');
    expect(JSON.stringify(result)).not.toContain('db.internal.test');
  });

  it('logs the driver error server-side so the failure can still be diagnosed', async () => {
    mockQueryRaw.mockRejectedValue(new Error(DRIVER_ERROR));
    await dbCheck();
    expect(JSON.stringify((logger.error as unknown as jest.Mock).mock.calls)).toContain('db.internal.test');
  });
});
