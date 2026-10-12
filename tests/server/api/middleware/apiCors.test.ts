/** @jest-environment node */
import { apiCorsMiddleware } from '@/server/api/middleware/apiCors';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';

import type { NextApiResponse } from 'next';

interface RecordedResponse {
  headers: Record<string, string>;
  statusCode: number | undefined;
  ended: boolean;
}

function run(method: string, origin: string | undefined): RecordedResponse {
  const recorded: RecordedResponse = { headers: {}, statusCode: undefined, ended: false };
  const res = {
    setHeader(name: string, value: string): void {
      recorded.headers[name.toLowerCase()] = value;
    },
    status(code: number): unknown {
      recorded.statusCode = code;
      return res;
    },
    end(): void {
      recorded.ended = true;
    },
  };
  const req = { method, headers: origin === undefined ? {} : { origin } } as unknown as ApiRequest;
  void apiCorsMiddleware(req, res as unknown as NextApiResponse);
  return recorded;
}

describe('apiCorsMiddleware', () => {
  const original = process.env['API_ALLOWED_ORIGINS'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['API_ALLOWED_ORIGINS'];
    } else {
      process.env['API_ALLOWED_ORIGINS'] = original;
    }
  });

  it('by default does not echo a foreign Origin or allow credentials', () => {
    delete process.env['API_ALLOWED_ORIGINS'];
    const { headers } = run('GET', 'https://evil.example');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('by default answers a preflight with no grant, so the browser refuses the call', () => {
    delete process.env['API_ALLOWED_ORIGINS'];
    const { headers, statusCode, ended } = run('OPTIONS', 'https://evil.example');
    expect(statusCode).toBe(204);
    expect(ended).toBe(true);
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-methods']).toBeUndefined();
  });

  it('leaves same-origin requests (no Origin header) untouched', () => {
    delete process.env['API_ALLOWED_ORIGINS'];
    expect(run('GET', undefined).headers).toEqual({});
  });

  it('grants a listed origin, with credentials, and marks the response as varying by Origin', () => {
    process.env['API_ALLOWED_ORIGINS'] = 'https://reader.example, https://other.example';
    const { headers } = run('GET', 'https://reader.example');
    expect(headers['access-control-allow-origin']).toBe('https://reader.example');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(headers['vary']).toBe('Origin');
  });

  it('refuses an origin that is not on the list', () => {
    process.env['API_ALLOWED_ORIGINS'] = 'https://reader.example';
    const { headers } = run('GET', 'https://evil.example');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never combines an explicit wildcard with credentials or a reflected origin', () => {
    process.env['API_ALLOWED_ORIGINS'] = '*';
    const { headers } = run('GET', 'https://evil.example');
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-credentials']).toBeUndefined();
  });
});
