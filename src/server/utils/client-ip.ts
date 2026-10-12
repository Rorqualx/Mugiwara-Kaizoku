/**
 * Client IP resolution — the single place that decides which address a
 * request "comes from" for rate limiting and brute-force lockout.
 *
 * `X-Forwarded-For` / `X-Real-IP` are written by the caller unless a reverse
 * proxy overwrites them, so they are honoured ONLY when `TRUST_PROXY=true`.
 * Otherwise the socket address is used and a client cannot pick its own bucket.
 *
 * @module server/utils/client-ip
 */

/** The minimal request shape needed to resolve a client address. */
export interface ClientIpSource {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | undefined } | null | undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function socketAddress(req: ClientIpSource): string | undefined {
  return nonEmpty(req.socket?.remoteAddress ?? undefined);
}

/**
 * Resolve the client IP for a request, or `undefined` when it cannot be
 * determined. Callers must NOT substitute a shared placeholder (for example
 * the literal "unknown") as a lockout key — that would put every such client
 * in one bucket.
 */
export function resolveClientIp(req: ClientIpSource): string | undefined {
  if (process.env['TRUST_PROXY'] !== 'true') {
    return socketAddress(req);
  }
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromForwarded = nonEmpty(firstForwarded?.split(',')[0]);
  if (fromForwarded !== undefined) {
    return fromForwarded;
  }
  const real = req.headers['x-real-ip'];
  const fromReal = nonEmpty(Array.isArray(real) ? real[0] : real);
  if (fromReal !== undefined) {
    return fromReal;
  }
  return socketAddress(req);
}
