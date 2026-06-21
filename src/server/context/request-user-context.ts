/**
 * Request-User Async Context
 *
 * A tiny {@link AsyncLocalStorage} that carries the *caller's* user id for the
 * duration of a request, so deeply-nested singleton services (search providers,
 * config services) can resolve per-user overrides via
 * `getUserConfigValue(getRequestUserId(), …)` WITHOUT threading a userId
 * parameter through every intermediate signature.
 *
 * Set once by a tRPC middleware (see `procedures.ts`) which wraps the resolver
 * in {@link runWithRequestUser}. Anything that runs outside that scope —
 * background queue workers, startup tasks — sees `undefined` and therefore
 * falls back to the global config, which is the correct behaviour for
 * system-owned work.
 *
 * IMPORTANT: server-only. Never import this into the edge middleware bundle
 * (`src/middleware.ts`); `node:async_hooks` is unavailable in the edge runtime.
 *
 * @module server/context/request-user-context
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestUserStore {
  /** The authenticated caller's user id, if any. */
  userId: string | undefined;
}

const storage = new AsyncLocalStorage<RequestUserStore>();

/**
 * Run `fn` with `userId` bound as the ambient request user. Nested awaits
 * inherit the store, so async service calls inside `fn` can read it.
 */
export function runWithRequestUser<T>(userId: string | undefined, fn: () => T): T {
  return storage.run({ userId }, fn);
}

/**
 * The ambient request user id, or `undefined` when called outside a
 * {@link runWithRequestUser} scope (background jobs, startup) or for an
 * unauthenticated request.
 */
export function getRequestUserId(): string | undefined {
  return storage.getStore()?.userId;
}
