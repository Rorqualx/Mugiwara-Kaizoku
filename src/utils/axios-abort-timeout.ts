/**
 * Axios abort deadline
 *
 * Under Bun (the production runtime) axios's `timeout` only covers the wait for
 * response headers. If the server sends headers and then stalls mid-body, the
 * request promise never settles — Node rejects it, Bun does not. A hung
 * request holds its queue job, enrichment phase or HTTP handler open forever.
 *
 * `installAxiosAbortTimeout` adds a request interceptor that pairs every
 * `timeout` with an `AbortSignal` deadline, which both runtimes honour for the
 * whole request including the body.
 */

import axios, { AxiosError } from 'axios';

import { logger } from '@/utils/logger';

import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * `timeout` is an idle/response limit, the abort signal is a total deadline.
 * Give slow-but-progressing responses headroom so the signal only ends
 * requests that axios's own timeout should already have ended.
 */
const DEADLINE_FACTOR = 2;
const MIN_DEADLINE_HEADROOM_MS = 15_000;

/** Signals created here, mapped to the `timeout` they were derived from. */
const ownedSignals = new WeakMap<AbortSignal, number>();
const installed = new WeakSet<AxiosInstance>();

/** Total deadline for a request configured with `timeoutMs`. */
export function abortDeadlineMs(timeoutMs: number): number {
  return Math.max(timeoutMs * DEADLINE_FACTOR, timeoutMs + MIN_DEADLINE_HEADROOM_MS);
}

/**
 * `AbortSignal.timeout` where the runtime has it (Bun, Node); otherwise an
 * equivalent built from a controller (older DOM-like environments such as the
 * jsdom test runner).
 */
function createDeadlineSignal(deadlineMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(deadlineMs);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, deadlineMs) as unknown as { unref?: () => void };
  // Don't keep the process alive just for a deadline timer.
  timer.unref?.();
  return controller.signal;
}

/**
 * Attach an abort deadline to a request config when it has a positive
 * `timeout`, no caller-supplied signal, and is not a streamed download (a long
 * transfer is legitimate there and the caller owns its lifetime).
 */
export function applyAbortDeadline<T extends InternalAxiosRequestConfig>(config: T): T {
  const timeoutMs = config.timeout ?? 0;
  if (config.signal || timeoutMs <= 0 || config.responseType === 'stream') {
    return config;
  }
  const signal = createDeadlineSignal(abortDeadlineMs(timeoutMs));
  ownedSignals.set(signal, timeoutMs);
  return Object.assign(config, { signal });
}

/**
 * Turn a cancellation caused by our own deadline into the timeout error
 * callers already handle (`ECONNABORTED`); anything else passes through.
 */
export function normalizeDeadlineError(error: unknown): unknown {
  if (!axios.isCancel(error)) return error;

  const config = (error as { config?: InternalAxiosRequestConfig }).config;
  const signal: unknown = config?.signal;
  const timeoutMs = typeof signal === 'object' && signal !== null
    ? ownedSignals.get(signal as AbortSignal)
    : undefined;
  if (timeoutMs === undefined) return error;

  logger.warn('Outbound request aborted at deadline (response stalled)', {
    url: config?.url,
    baseURL: config?.baseURL,
    timeoutMs,
    deadlineMs: abortDeadlineMs(timeoutMs),
  });
  return new AxiosError(
    `timeout of ${timeoutMs}ms exceeded (response stalled)`,
    AxiosError.ECONNABORTED,
    config
  );
}

/**
 * Install the abort-deadline interceptors on an axios instance. Idempotent,
 * returns the same instance so it can wrap `axios.create(...)` inline.
 */
export function installAxiosAbortTimeout<T extends AxiosInstance>(instance: T): T {
  if (installed.has(instance)) return instance;
  installed.add(instance);

  instance.interceptors.request.use((config) => applyAbortDeadline(config));
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(normalizeDeadlineError(error) as Error)
  );
  return instance;
}

/**
 * Protect code that calls the default `axios` export directly. Call once at
 * process start; instances from `axios.create` do not inherit interceptors and
 * must be wrapped with {@link installAxiosAbortTimeout} themselves.
 */
export function installDefaultAxiosAbortTimeout(): void {
  installAxiosAbortTimeout(axios);
}
