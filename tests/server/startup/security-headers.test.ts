/** @jest-environment node */
import {
  applySecurityDefaults,
  isHttpsRequest,
  securityHeadersMiddleware,
} from '@/server/startup/security-headers';

function run(req: Parameters<typeof securityHeadersMiddleware>[0]): { headers: Record<string, string>; next: jest.Mock } {
  const headers: Record<string, string> = {};
  const next = jest.fn();
  securityHeadersMiddleware(
    req,
    {
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = String(value);
        return this as never;
      },
    },
    next,
  );
  return { headers, next };
}

describe('securityHeadersMiddleware', () => {
  it('sets nosniff, a referrer policy and same-origin framing on every response', () => {
    const { headers, next } = run({ headers: {}, socket: {} });
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not send HSTS over plain http', () => {
    const { headers } = run({ headers: { host: 'kaizoku.test' }, socket: {} });
    expect(headers['strict-transport-security']).toBeUndefined();
  });

  it('sends HSTS when the request arrived over https at the proxy', () => {
    const { headers } = run({ headers: { 'x-forwarded-proto': 'https' }, socket: {} });
    expect(headers['strict-transport-security']).toBe('max-age=31536000');
  });

  it('sends HSTS when TLS terminates at this server', () => {
    const { headers } = run({ headers: {}, socket: { encrypted: true } });
    expect(headers['strict-transport-security']).toBe('max-age=31536000');
  });

  it('does not set an enforcing Content-Security-Policy', () => {
    const { headers } = run({ headers: { 'x-forwarded-proto': 'https' }, socket: {} });
    expect(headers['content-security-policy']).toBeUndefined();
  });
});

describe('isHttpsRequest', () => {
  it('reads the first hop of a multi-proxy X-Forwarded-Proto', () => {
    expect(isHttpsRequest({ headers: { 'x-forwarded-proto': 'https, http' } })).toBe(true);
    expect(isHttpsRequest({ headers: { 'x-forwarded-proto': 'http, https' } })).toBe(false);
    expect(isHttpsRequest({ headers: { 'x-forwarded-proto': ['HTTPS'] } })).toBe(true);
    expect(isHttpsRequest({ headers: {} })).toBe(false);
  });
});

describe('applySecurityDefaults', () => {
  it('turns off X-Powered-By and installs the header middleware on the Express app', () => {
    const app = { disable: jest.fn(), use: jest.fn() };
    applySecurityDefaults(app);
    expect(app.disable).toHaveBeenCalledWith('x-powered-by');
    expect(app.use).toHaveBeenCalledWith(securityHeadersMiddleware);
  });
});
