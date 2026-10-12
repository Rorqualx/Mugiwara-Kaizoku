/** @jest-environment node */
/**
 * Credentials sign-in: what the brute-force lockout is keyed on, and what an
 * unknown username costs.
 */
import { compare } from 'bcryptjs';

import { authOptions } from '@/lib/auth/auth-options';
import { stampClientIp } from '@/lib/auth/login-guard';
import { prisma } from '@/server/db';

jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  // Hand the config straight back so the test can call `authorize`.
  default: jest.fn((config: unknown) => config),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(() => Promise.resolve('dummy-bcrypt-hash')),
}));
jest.mock('@/server/db', () => ({
  prisma: {
    systemEvent: { count: jest.fn(), deleteMany: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/server/services/eventEmitter', () => ({
  eventEmitter: { emitWithTracking: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/server/services/events/eventTypes', () => ({
  EventType: {
    USER_SUSPICIOUS_ACTIVITY: 'user.suspicious',
    USER_LOGIN_FAILED: 'user.login.failed',
    USER_LOGGED_IN: 'user.login',
    USER_LOGGED_OUT: 'user.logout',
  },
  EventSource: { USER: 'user' },
}));
jest.mock('@/server/utils/security-logger', () => ({
  logSecurityEvent: jest.fn(),
  SecurityEventType: { LOGIN_BLOCKED: 'blocked', LOGIN_FAILED: 'failed', LOGIN_SUCCESS: 'success' },
}));
jest.mock('@/server/utils/log-sanitizer', () => ({ sanitizeError: jest.fn((e: unknown) => e) }));
jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/auth/secret', () => ({ resolveAuthSecret: jest.fn(() => 'test-secret') }));

type Authorize = (
  credentials: { identifier: string; password: string },
  request: { headers: Record<string, unknown> },
) => Promise<unknown>;

const authorize = (authOptions.providers[0] as unknown as { authorize: Authorize }).authorize;

const mockCount = prisma.systemEvent.count as unknown as jest.Mock;
const mockFindFirst = prisma.user.findFirst as unknown as jest.Mock;
const mockCompare = compare as unknown as jest.Mock;

/** A request as the API route hands it to NextAuth: IP resolved and stamped. */
function stampedHeaders(remoteAddress: string | undefined, extra: Record<string, string> = {}): Record<string, unknown> {
  const req = { headers: { ...extra } as Record<string, string | string[] | undefined>, socket: { remoteAddress } };
  stampClientIp(req);
  return req.headers;
}

function lockoutIpOfLastCount(): unknown {
  const where = (mockCount.mock.calls.at(-1)?.[0] as { where: { AND: Array<{ details: { path: string[]; equals: unknown } }> } }).where;
  return where.AND.find((clause) => clause.details.path[0] === 'ipAddress')?.details.equals;
}

describe('credentials authorize', () => {
  const originalTrustProxy = process.env['TRUST_PROXY'];

  beforeEach(() => {
    delete process.env['TRUST_PROXY'];
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
    mockCompare.mockResolvedValue(false);
  });

  afterAll(() => {
    if (originalTrustProxy !== undefined) process.env['TRUST_PROXY'] = originalTrustProxy;
  });

  it('keys the lockout on the socket address, so X-Forwarded-For cannot reset it', async () => {
    const headers = stampedHeaders('203.0.113.7', { 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' });
    await authorize({ identifier: 'owner', password: 'guess' }, { headers });
    expect(lockoutIpOfLastCount()).toBe('203.0.113.7');
  });

  it('refuses the sign-in once that address has 5 recent failures for the username', async () => {
    mockCount.mockResolvedValue(5);
    const result = await authorize(
      { identifier: 'owner', password: 'right-password' },
      { headers: stampedHeaders('203.0.113.7') },
    );
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('does not pool clients with no resolvable address into one lockout bucket', async () => {
    // Five failures recorded "somewhere" must not lock out a request whose
    // address is unknown: there is no shared "unknown" key to count against.
    mockCount.mockResolvedValue(5);
    await authorize({ identifier: 'owner', password: 'guess' }, { headers: { 'x-forwarded-for': '198.51.100.1' } });
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it('spends a bcrypt comparison on an unknown username, like a wrong password', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await authorize(
      { identifier: 'no-such-user', password: 'guess' },
      { headers: stampedHeaders('203.0.113.7') },
    );
    expect(result).toBeNull();
    expect(mockCompare).toHaveBeenCalledTimes(1);
    expect(mockCompare).toHaveBeenCalledWith('guess', 'dummy-bcrypt-hash');
  });

  it('spends a bcrypt comparison on an account that has no password set', async () => {
    mockFindFirst.mockResolvedValue({ id: 'u1', userName: 'sso-only', hashedPassword: null });
    await authorize({ identifier: 'sso-only', password: 'guess' }, { headers: stampedHeaders('203.0.113.7') });
    expect(mockCompare).toHaveBeenCalledWith('guess', 'dummy-bcrypt-hash');
  });

  it('still signs in a real user with the right password', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'u1',
      userName: 'owner',
      email: 'owner@example.test',
      role: 'ADMIN',
      avatar: null,
      tokenVersion: 3,
      hashedPassword: 'real-hash',
    });
    mockCompare.mockResolvedValue(true);
    const result = await authorize(
      { identifier: 'owner', password: 'right-password' },
      { headers: stampedHeaders('203.0.113.7') },
    );
    expect(mockCompare).toHaveBeenCalledWith('right-password', 'real-hash');
    expect(result).toMatchObject({ id: 'u1', name: 'owner', role: 'ADMIN', tokenVersion: 3 });
  });
});
