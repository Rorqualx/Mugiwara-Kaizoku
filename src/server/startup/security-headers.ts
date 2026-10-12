/**
 * Baseline security response headers for every response the custom server
 * sends (pages, API routes, static assets).
 *
 * Deliberately NOT here: a Content-Security-Policy. The reader, the image
 * proxy and Mantine's inline styles need a policy tuned in a real browser;
 * an untested enforcing policy would break them.
 *
 * @module server/startup/security-headers
 */

import type { IncomingMessage, ServerResponse } from 'http';

/** One year, in seconds. */
const HSTS_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type HeaderRequest = Pick<IncomingMessage, 'headers'> & {
  // A plain `net.Socket` has no `encrypted`; a `tls.TLSSocket` has it set.
  socket?: object | null | undefined;
};

/** The slice of an Express app this module configures. */
interface ConfigurableApp {
  disable(setting: string): unknown;
  use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): unknown;
}

/**
 * True when the browser reached us over HTTPS: either TLS terminates here, or
 * the reverse proxy in front says so. A client that fakes the header over
 * plain HTTP only earns an HSTS header its browser ignores.
 */
export function isHttpsRequest(req: HeaderRequest): boolean {
  const socket = req.socket;
  if (socket && 'encrypted' in socket && socket.encrypted === true) {
    return true;
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const first = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return first?.split(',')[0]?.trim().toLowerCase() === 'https';
}

/** Express middleware: set the baseline headers, then continue. */
export function securityHeadersMiddleware(
  req: HeaderRequest,
  res: Pick<ServerResponse, 'setHeader'>,
  next: () => void,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // SAMEORIGIN, not DENY: the annotation tools render previews in iframes.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // HSTS only over HTTPS. Browsers ignore it over plain HTTP, and sending it
  // there would be misleading while the site is still served without TLS.
  if (isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}`);
  }
  next();
}

/** Apply the server-wide hardening to the Express app. Call before routes. */
export function applySecurityDefaults(app: ConfigurableApp): void {
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
}
