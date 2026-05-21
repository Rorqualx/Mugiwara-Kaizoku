/**
 * Authentication Middleware — default-deny.
 *
 * Every page requires an authenticated session. Anonymous users land on
 * `/login`. Two gating tiers remain:
 *
 * - Admin paths (/admin, /settings, /system, /api/protected): require a
 *   session whose `role === 'ADMIN'`. Authenticated non-admins hitting
 *   one of these are redirected to `/`.
 * - All other pages: require any authenticated session.
 *
 * Public exceptions (matcher excludes them so they bypass middleware
 * entirely): `/api/auth/*` (NextAuth endpoints), `/api/trpc/*` (tRPC
 * handles auth per-procedure), `/_next/*` (Next.js build/runtime
 * internals), and assets at the root like `/favicon.ico`.
 * The `/login` page itself is matched by the matcher but exempted in
 * the body so anonymous users can reach it.
 */

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import type { NextRequest } from 'next/server';

// NextAuth JWT decode reads cookies and verifies signatures. Stays on Node
// runtime so the auth libraries (which depend on Node crypto) work.
export const runtime = 'nodejs';

const ADMIN_PATH_PREFIXES = ['/admin', '/settings', '/system', '/api/protected'];

/**
 * Paths anonymous users may visit. Everything else requires a session.
 * Keep this list tight — adding routes here exposes them to the public
 * web. `/api/auth/*` and `/api/trpc/*` are excluded at the matcher
 * level, not here.
 *
 * `/setup` is public because first-time installs have zero users yet —
 * gating it would create an unreachable bootstrap page. `setup.tsx`
 * self-gates: when users already exist it redirects to /login, so the
 * exposure is only on a truly empty install.
 */
const PUBLIC_PATHS = ['/login', '/setup'];

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const pathname = req.nextUrl.pathname;

  if (startsWithAny(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  const secret = process.env['AUTH_SECRET'] ?? process.env['NEXTAUTH_SECRET'];
  const token = await getToken(secret ? { req, secret } : { req });

  if (!token) {
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.url));
  }

  if (startsWithAny(pathname, ADMIN_PATH_PREFIXES) && token.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match every request path EXCEPT:
    //   - /api/auth/*       NextAuth's own login/logout/session handlers
    //   - /api/trpc/*       tRPC handles auth per-procedure (preserve existing behavior)
    //   - /_next/*          Next.js build artifacts + runtime data
    //   - /favicon.ico      static favicon
    //   - /theme-init.js    render-blocking theme bootstrap (referenced from
    //                       _document.tsx, must load on the unauthenticated
    //                       /login page too to prevent the light-mode flash)
    '/((?!api/auth|api/trpc|_next|favicon\\.ico|theme-init\\.js).*)',
    // Keep `/api/protected/*` middleware-gated. The exclusion above would
    // also exclude it (matches the leading `/`), so we add it back here
    // explicitly — admin role-check still runs in the middleware body.
    '/api/protected/:path*',
  ],
};
