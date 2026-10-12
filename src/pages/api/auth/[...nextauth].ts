/**
 * NextAuth v4 API Route
 *
 * Thin handler over the canonical config in `@/lib/auth/auth-options`.
 * All providers, callbacks, brute-force lockout, and token-invalidation logic
 * live there so there is a single source of truth shared with server-side
 * session reads.
 *
 * Before NextAuth runs, this route:
 * - stamps the resolved client IP on the request (NextAuth gives `authorize`
 *   headers only, no socket), so the lockout is keyed on the real address and
 *   not on a client-supplied `X-Forwarded-For`;
 * - applies the per-IP rate limit to the credentials sign-in.
 *
 * @module pages/api/auth/[...nextauth]
 */
import NextAuth from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { allowCredentialsSignIn, stampClientIp } from '@/lib/auth/login-guard';

import type { NextApiRequest, NextApiResponse } from 'next';

// Re-export so existing `import { authOptions } from '@/pages/api/auth/[...nextauth]'`
// call sites keep resolving (e.g. legacy imports). Prefer importing from
// `@/lib/auth/auth-options` in new code.
export { authOptions };

const nextAuthHandler = NextAuth(authOptions) as (
  req: NextApiRequest,
  res: NextApiResponse,
) => Promise<void> | void;

export default async function authHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  stampClientIp(req);
  if (!(await allowCredentialsSignIn(req, res))) {
    return;
  }
  await nextAuthHandler(req, res);
}
