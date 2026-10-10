/**
 * Outbound URL guard
 *
 * Shared checks for any endpoint that fetches a caller-supplied URL
 * server-side. Without them such an endpoint is an SSRF primitive: the caller
 * can make the server read loopback services (bundled Postgres/Suwayomi,
 * download-client admin APIs) or other hosts on the LAN.
 *
 * Two levels:
 * - `requireUrlHost` / `isHostInDomains` — the URL must be on a known provider
 *   domain (exact host or a dot-separated subdomain, never a substring).
 * - `requirePublicUrl` / `fetchPublicUrl` — any http(s) URL whose host resolves
 *   only to public addresses, re-checked on every redirect hop.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { TRPCError } from '@trpc/server';

export class OutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboundUrlError';
  }
}

const MAX_REDIRECT_HOPS = 5;

/** [first octet, second-octet min, second-octet max] for non-public IPv4 ranges. */
const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 255], // "this network"
  [10, 0, 255], // private
  [100, 64, 127], // CGNAT
  [127, 0, 255], // loopback
  [169, 254, 254], // link-local (incl. cloud metadata)
  [172, 16, 31], // private
  [192, 0, 0], // IETF protocol assignments
  [192, 168, 168], // private
  [198, 18, 19], // benchmarking
];

function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split('.').map((part) => Number.parseInt(part, 10));
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  // 224.0.0.0 and above: multicast and reserved
  return a >= 224 || PRIVATE_IPV4_RANGES.some(([first, min, max]) => a === first && b >= min && b <= max);
}

/**
 * True for loopback, private, link-local, CGNAT, multicast and unspecified
 * addresses (IPv4 and IPv6, including IPv4-mapped IPv6). Non-IP input is
 * treated as private so a caller can never pass it through by mistake.
 */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version !== 6) return true;

  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  // The URL parser rewrites IPv4-mapped hosts to hex groups (::ffff:7f00:1).
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex?.[1] && mappedHex[2]) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  if (lower === '::' || lower === '::1') return true;
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast
  return /^(f[cd]|fe[89ab]|ff)/.test(lower);
}

/** Hostname as used for matching: lower-case, no IPv6 brackets, no trailing dot. */
function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

/**
 * Exact-or-subdomain match. `fandom.com` matches `fandom.com` and
 * `onepiece.fandom.com`, but not `fandom.com.evil.example` or `notfandom.com`.
 */
export function isHostInDomains(hostname: string, domains: readonly string[]): boolean {
  const host = normalizeHostname(hostname);
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function parseHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OutboundUrlError('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OutboundUrlError('Only http(s) URLs are allowed');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new OutboundUrlError('URLs with embedded credentials are not allowed');
  }
  return parsed;
}

/**
 * Synchronous check on the literal host only (no DNS). Used where an async
 * check is impossible, e.g. axios' `beforeRedirect` hook.
 */
export function isLiteralPrivateHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  return isIP(host) !== 0 && isPrivateAddress(host);
}

/**
 * Parse `rawUrl` and verify it is http(s) and that every address its host
 * resolves to is public.
 *
 * @throws OutboundUrlError when the URL is malformed or points at a private host
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = parseHttpUrl(rawUrl);
  const host = normalizeHostname(parsed.hostname);

  if (isLiteralPrivateHost(host)) {
    throw new OutboundUrlError('URL points to a private or loopback host');
  }
  if (isIP(host) !== 0) return parsed;

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new OutboundUrlError('URL host could not be resolved');
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new OutboundUrlError('URL points to a private or loopback host');
  }
  return parsed;
}

/**
 * Parse `rawUrl` and verify it is an http(s) URL on one of `domains`.
 *
 * @throws OutboundUrlError when it is not
 */
export function assertUrlHost(rawUrl: string, domains: readonly string[]): URL {
  const parsed = parseHttpUrl(rawUrl);
  if (!isHostInDomains(parsed.hostname, domains)) {
    throw new OutboundUrlError('URL host is not allowed');
  }
  return parsed;
}

/**
 * `fetch` for caller-supplied URLs: validates the target, follows redirects
 * manually and re-validates every hop so a public URL cannot bounce the
 * request to an internal one.
 *
 * @param domains when given, every hop must also be on one of these domains
 * @throws OutboundUrlError when any hop fails validation
 */
export async function fetchPublicUrl(
  rawUrl: string,
  init: Omit<RequestInit, 'redirect'> = {},
  domains?: readonly string[]
): Promise<Response> {
  let current = rawUrl;
  // Each hop depends on the previous response's Location header.
  /* eslint-disable no-await-in-loop */
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const target = await assertPublicHttpUrl(current);
    if (domains && !isHostInDomains(target.hostname, domains)) {
      throw new OutboundUrlError('URL host is not allowed');
    }

    const response = await fetch(target, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    current = new URL(location, target).toString();
  }
  /* eslint-enable no-await-in-loop */
  throw new OutboundUrlError('Too many redirects');
}

/**
 * axios `beforeRedirect` hook. Axios cannot await here, so this only rejects
 * redirects to literal private hosts; pair it with `requirePublicUrl` on the
 * initial URL.
 */
export function rejectPrivateRedirect(options: Record<string, unknown>): void {
  const hostname = typeof options['hostname'] === 'string' ? options['hostname'] : '';
  if (isLiteralPrivateHost(hostname)) {
    throw new OutboundUrlError('Redirect to a private or loopback host blocked');
  }
}

function toBadRequest(error: unknown): TRPCError {
  const message = error instanceof OutboundUrlError ? error.message : 'Invalid URL';
  return new TRPCError({ code: 'BAD_REQUEST', message });
}

/** tRPC wrapper around {@link assertPublicHttpUrl}: throws BAD_REQUEST. */
export async function requirePublicUrl(rawUrl: string): Promise<URL> {
  try {
    return await assertPublicHttpUrl(rawUrl);
  } catch (error: unknown) {
    throw toBadRequest(error);
  }
}

/** tRPC wrapper around {@link assertUrlHost}: throws BAD_REQUEST. */
export function requireUrlHost(rawUrl: string, domains: readonly string[]): URL {
  try {
    return assertUrlHost(rawUrl, domains);
  } catch (error: unknown) {
    throw toBadRequest(error);
  }
}
