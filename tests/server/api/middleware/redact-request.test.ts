/** @jest-environment node */
import { apiLoggingMiddleware } from '@/server/api/middleware/apiLogging';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { redactQuery, redactUrl } from '@/server/api/middleware/redact-request';
import { logger } from '@/utils/logger';

import type { NextApiResponse } from 'next';

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Not a real key: a marker the assertions look for in the log output.
const KEY = 'PLACEHOLDER-VALUE-FOR-REDACTION-TEST';

describe('redactUrl', () => {
  it('removes an API key passed as ?apiKey= and keeps the other parameters', () => {
    const redacted = redactUrl(`/api/v1/events/stream?events=chapter&apiKey=${KEY}&resources=manga`);
    expect(redacted).not.toContain(KEY);
    expect(redacted).toBe('/api/v1/events/stream?events=chapter&apiKey=[REDACTED]&resources=manga');
  });

  it('matches the parameter name regardless of case or spelling', () => {
    for (const name of ['apikey', 'APIKEY', 'api_key', 'api-key', 'token', 'access_token', 'api%4Bey']) {
      expect(redactUrl(`/api/v1/manga?${name}=${KEY}`)).not.toContain(KEY);
    }
  });

  it('leaves a URL without credentials exactly as it was', () => {
    expect(redactUrl('/api/v1/manga?page=2&sort=title')).toBe('/api/v1/manga?page=2&sort=title');
    expect(redactUrl('/api/v1/manga')).toBe('/api/v1/manga');
    expect(redactUrl(undefined)).toBe('');
  });
});

describe('redactQuery', () => {
  it('replaces credential values without mutating the request query', () => {
    const query = { apiKey: KEY, page: '2' };
    expect(redactQuery(query)).toEqual({ apiKey: '[REDACTED]', page: '2' });
    expect(query.apiKey).toBe(KEY);
  });
});

describe('apiLoggingMiddleware', () => {
  it('never writes a query-string API key to the request or response log', async () => {
    const req = {
      method: 'GET',
      url: `/api/v1/events/stream?apiKey=${KEY}`,
      query: { apiKey: KEY },
      headers: {},
      socket: { remoteAddress: '203.0.113.7' },
      requestId: 'req-1',
    } as unknown as ApiRequest;
    const res = {
      statusCode: 200,
      end: jest.fn(),
      getHeaders: (): Record<string, string> => ({}),
    } as unknown as NextApiResponse;

    await apiLoggingMiddleware(req, res);
    res.end();

    const written = JSON.stringify((logger.info as unknown as jest.Mock).mock.calls);
    expect(written).toContain('api_request');
    expect(written).toContain('api_response');
    expect(written).not.toContain(KEY);
  });
});
