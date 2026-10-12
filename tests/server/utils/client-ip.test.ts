/** @jest-environment node */
import { resolveClientIp } from '@/server/utils/client-ip';

const SOCKET_IP = '203.0.113.7';

function request(headers: Record<string, string | string[] | undefined>, remoteAddress?: string): {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string | undefined };
} {
  return { headers, socket: { remoteAddress } };
}

describe('resolveClientIp', () => {
  const originalTrustProxy = process.env['TRUST_PROXY'];

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env['TRUST_PROXY'];
    } else {
      process.env['TRUST_PROXY'] = originalTrustProxy;
    }
  });

  it('ignores a client-supplied X-Forwarded-For when TRUST_PROXY is not set', () => {
    delete process.env['TRUST_PROXY'];
    const req = request({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' }, SOCKET_IP);
    expect(resolveClientIp(req)).toBe(SOCKET_IP);
  });

  it('ignores forwarded headers when TRUST_PROXY is anything other than "true"', () => {
    process.env['TRUST_PROXY'] = '1';
    expect(resolveClientIp(request({ 'x-forwarded-for': '198.51.100.1' }, SOCKET_IP))).toBe(SOCKET_IP);
  });

  it('uses the first X-Forwarded-For entry when TRUST_PROXY=true', () => {
    process.env['TRUST_PROXY'] = 'true';
    const req = request({ 'x-forwarded-for': ' 198.51.100.1 , 10.0.0.1' }, SOCKET_IP);
    expect(resolveClientIp(req)).toBe('198.51.100.1');
  });

  it('falls back to X-Real-IP, then the socket, when TRUST_PROXY=true', () => {
    process.env['TRUST_PROXY'] = 'true';
    expect(resolveClientIp(request({ 'x-real-ip': '198.51.100.2' }, SOCKET_IP))).toBe('198.51.100.2');
    expect(resolveClientIp(request({}, SOCKET_IP))).toBe(SOCKET_IP);
  });

  it('returns undefined — not a shared placeholder — when no address is known', () => {
    delete process.env['TRUST_PROXY'];
    expect(resolveClientIp(request({ 'x-forwarded-for': '198.51.100.1' }))).toBeUndefined();
    expect(resolveClientIp({ headers: {} })).toBeUndefined();
  });
});
