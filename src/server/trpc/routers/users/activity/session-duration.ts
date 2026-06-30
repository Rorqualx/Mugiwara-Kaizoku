/**
 * Session Duration Derivation
 *
 * "Time logged in" has no dedicated stored field. We derive it by pairing the
 * user's `USER_LOGGED_IN` / `USER_LOGGED_OUT` SystemEvents: each login is
 * closed by the next logout. Sessions with no logout (token expiry, browser
 * close) are capped at the JWT `maxAge` (24h, see src/lib/auth/auth-options.ts)
 * or the next login, whichever comes first — so an abandoned session can never
 * inflate the total beyond a single token lifetime.
 *
 * @module server/trpc/routers/users/activity/session-duration
 */
import { EventType } from '@/server/services/events/eventTypes';

/** JWT session lifetime — caps any session that never observed a logout. */
export const MAX_SESSION_SECONDS = 24 * 60 * 60;

/** Minimal SystemEvent shape this helper needs. */
export interface SessionEvent {
  type: string;
  timestamp: Date;
}

export interface SessionDurationResult {
  /** Sum of all derived session durations, in seconds. */
  totalSeconds: number;
  /** Number of login events that produced a (capped) duration. */
  sessionCount: number;
  /** Duration of the most recent session, in seconds (null if none). */
  lastSessionSeconds: number | null;
}

/**
 * Derive total time-logged-in from login/logout events.
 *
 * @param events - Login/logout SystemEvents ordered ascending by timestamp.
 * @param now - Reference "now" for capping a still-open trailing session.
 */
export function deriveSessionDuration(
  events: SessionEvent[],
  now: Date = new Date(),
): SessionDurationResult {
  let totalSeconds = 0;
  let sessionCount = 0;
  let lastSessionSeconds: number | null = null;
  let openLoginAt: Date | null = null;

  const closeSession = (endedAt: Date): void => {
    if (!openLoginAt) return;
    const rawSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - openLoginAt.getTime()) / 1000),
    );
    const seconds = Math.min(rawSeconds, MAX_SESSION_SECONDS);
    totalSeconds += seconds;
    sessionCount += 1;
    lastSessionSeconds = seconds;
    openLoginAt = null;
  };

  for (const event of events) {
    if (event.type === EventType.USER_LOGGED_IN) {
      // A new login with a still-open prior login means the prior session was
      // never explicitly closed — close it at this login (capped).
      if (openLoginAt) {
        closeSession(event.timestamp);
      }
      openLoginAt = event.timestamp;
    } else if (event.type === EventType.USER_LOGGED_OUT) {
      closeSession(event.timestamp);
    }
  }

  // Trailing open session (no logout yet) — cap at the token lifetime.
  if (openLoginAt) {
    closeSession(now);
  }

  return { totalSeconds, sessionCount, lastSessionSeconds };
}
