/**
 * NextAuth v4 API Route
 *
 * Thin handler over the canonical config in `@/lib/auth/auth-options`.
 * All providers, callbacks, brute-force lockout, and token-invalidation logic
 * live there so there is a single source of truth shared with server-side
 * session reads.
 *
 * @module pages/api/auth/[...nextauth]
 */
import NextAuth from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';

// Re-export so existing `import { authOptions } from '@/pages/api/auth/[...nextauth]'`
// call sites keep resolving (e.g. legacy imports). Prefer importing from
// `@/lib/auth/auth-options` in new code.
export { authOptions };

export default NextAuth(authOptions);
