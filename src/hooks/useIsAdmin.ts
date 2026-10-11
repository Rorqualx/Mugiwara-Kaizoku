/**
 * Admin role check for client components.
 *
 * Mirrors the server's `adminProcedure` gate (`role === 'ADMIN'`, exact match)
 * so a control is shown only when the call behind it would be accepted. This is
 * presentation only: the server still rejects every admin-only call from a
 * non-admin session.
 *
 * Reads the session directly instead of going through `useAuth`, which also
 * creates router and error state that a plain visibility check does not need.
 *
 * @module hooks/useIsAdmin
 */
import { useSession } from 'next-auth/react';

/** Role value the server treats as administrator. */
const ADMIN_ROLE = 'ADMIN';

/**
 * True when a session user object carries the administrator role.
 *
 * @param user - `session.user`, or anything else (returns false)
 */
export function hasAdminRole(user: unknown): boolean {
  if (typeof user !== 'object' || user === null || !('role' in user)) {
    return false;
  }
  return user.role === ADMIN_ROLE;
}

/**
 * Whether the signed-in user is an administrator.
 *
 * False while the session is loading and for signed-out visitors, so
 * admin-only controls never flash for a regular user.
 */
export function useIsAdmin(): boolean {
  const { data: session, status } = useSession();
  return status === 'authenticated' && hasAdminRole(session.user);
}
