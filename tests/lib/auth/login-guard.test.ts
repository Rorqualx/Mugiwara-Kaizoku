/** @jest-environment node */
import {
  CREDENTIALS_RATE_LIMIT_MAX,
  allowCredentialsSignIn,
  createCredentialsRateLimiter,
  isCredentialsSignIn,
  readStampedClientIp,
  stampClientIp,
} from '@/lib/auth/login-guard';

import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

interface FakeResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, unknown>;
  headersSent: boolean;
  setHeader(name: string, value: unknown): FakeResponse;
  getHeader(name: string): unknown;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
  send(body: unknown): FakeResponse;
}

function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    headersSent: false,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader: (name) => res.headers[name.toLowerCase()],
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function signInRequest(remoteAddress: string | undefined, headers: Record<string, string> = {}): NextApiRequest {
  return {
    method: 'POST',
    query: { nextauth: ['callback', 'credentials'] },
    headers: { host: 'kaizoku.test', ...headers },
    socket: { remoteAddress },
  } as unknown as NextApiRequest;
}

async function attempt(
  limiter: ReturnType<typeof createCredentialsRateLimiter>,
  req: NextApiRequest,
): Promise<{ allowed: boolean; res: FakeResponse }> {
  const res = fakeResponse();
  const allowed = await allowCredentialsSignIn(req, res as unknown as NextApiResponse, limiter);
  return { allowed, res };
}

describe('client IP stamp', () => {
  const originalTrustProxy = process.env['TRUST_PROXY'];

  beforeEach(() => {
    delete process.env['TRUST_PROXY'];
  });

  afterAll(() => {
    if (originalTrustProxy !== undefined) {
      process.env['TRUST_PROXY'] = originalTrustProxy;
    }
  });

  it('stamps the socket address, not the client-supplied X-Forwarded-For', () => {
    const req = signInRequest('203.0.113.7', { 'x-forwarded-for': '198.51.100.1' });
    stampClientIp(req);
    expect(readStampedClientIp(req.headers)).toBe('203.0.113.7');
  });

  it('cannot be pre-filled by a client: an unresolvable request ends up with no stamp', () => {
    const first = signInRequest('203.0.113.7');
    stampClientIp(first);
    // A client that somehow learned the header name and sent it itself.
    const forged = signInRequest(undefined, { ...(first.headers as Record<string, string>) });
    expect(readStampedClientIp(forged.headers)).toBe('203.0.113.7');
    stampClientIp(forged);
    expect(readStampedClientIp(forged.headers)).toBeUndefined();
  });

  it('reads nothing from a request that was never stamped', () => {
    expect(readStampedClientIp({ 'x-forwarded-for': '198.51.100.1' })).toBeUndefined();
    expect(readStampedClientIp(undefined)).toBeUndefined();
  });
});

describe('isCredentialsSignIn', () => {
  it('matches only the POST that tests a password', () => {
    expect(isCredentialsSignIn({ method: 'POST', query: { nextauth: ['callback', 'credentials'] } })).toBe(true);
    expect(isCredentialsSignIn({ method: 'GET', query: { nextauth: ['session'] } })).toBe(false);
    expect(isCredentialsSignIn({ method: 'POST', query: { nextauth: ['signout'] } })).toBe(false);
    expect(isCredentialsSignIn({ method: 'GET', query: { nextauth: ['callback', 'credentials'] } })).toBe(false);
  });
});

describe('credentials sign-in rate limit', () => {
  const originalTrustProxy = process.env['TRUST_PROXY'];
  const originalNextAuthUrl = process.env['NEXTAUTH_URL'];

  beforeEach(() => {
    delete process.env['TRUST_PROXY'];
    delete process.env['NEXTAUTH_URL'];
  });

  afterAll(() => {
    if (originalTrustProxy !== undefined) process.env['TRUST_PROXY'] = originalTrustProxy;
    if (originalNextAuthUrl !== undefined) process.env['NEXTAUTH_URL'] = originalNextAuthUrl;
  });

  it('lets a household behind one address make 30 attempts, then answers 429', async () => {
    const limiter = createCredentialsRateLimiter();
    expect(CREDENTIALS_RATE_LIMIT_MAX).toBe(30);

    for (let i = 0; i < CREDENTIALS_RATE_LIMIT_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- attempts must be sequential
      const { allowed } = await attempt(limiter, signInRequest('203.0.113.7'));
      expect(allowed).toBe(true);
    }

    const { allowed, res } = await attempt(limiter, signInRequest('203.0.113.7'));
    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(429);
    // next-auth's client parses `url` with `new URL()`, so it must be absolute.
    const body = res.body as { url: string };
    expect(new URL(body.url).searchParams.get('error')).toMatch(/too many sign-in attempts/i);
  });

  it('does not let one address use up another address\'s attempts', async () => {
    const limiter = createCredentialsRateLimiter();
    for (let i = 0; i <= CREDENTIALS_RATE_LIMIT_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- attempts must be sequential
      await attempt(limiter, signInRequest('203.0.113.7'));
    }
    const other = await attempt(limiter, signInRequest('203.0.113.99'));
    expect(other.allowed).toBe(true);
  });

  it('cannot be dodged by rotating X-Forwarded-For', async () => {
    const limiter = createCredentialsRateLimiter();
    let lastAllowed = true;
    for (let i = 0; i <= CREDENTIALS_RATE_LIMIT_MAX; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- attempts must be sequential
      const result = await attempt(limiter, signInRequest('203.0.113.7', { 'x-forwarded-for': `198.51.100.${i}` }));
      lastAllowed = result.allowed;
    }
    expect(lastAllowed).toBe(false);
  });

  it('never limits session reads or other auth routes', async () => {
    const limiter = createCredentialsRateLimiter();
    const sessionRead = {
      method: 'GET',
      query: { nextauth: ['session'] },
      headers: {},
      socket: { remoteAddress: '203.0.113.7' },
    } as unknown as NextApiRequest;
    for (let i = 0; i < CREDENTIALS_RATE_LIMIT_MAX * 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- attempts must be sequential
      const { allowed } = await attempt(limiter, sessionRead);
      expect(allowed).toBe(true);
    }
  });
});
