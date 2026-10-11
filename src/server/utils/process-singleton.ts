/**
 * Process-wide singletons
 *
 * `src/server/**` is loaded twice in one process: once directly by the custom
 * server (`src/server/index.ts`) and once inside the Next.js webpack bundle
 * that serves tRPC and API routes. A module-level `new X()` therefore yields
 * two instances — two queue managers, two conversion workers, two schedulers,
 * two rate limiters — and state changed through an API request never reaches
 * the copy that does the background work.
 *
 * `processSingleton` keeps one instance per name on `globalThis`, which both
 * copies share. Use it for anything that owns timers, workers, child
 * processes, locks, rate limits or event listeners.
 */

const REGISTRY_KEY = Symbol.for('mugiwara-kaizoku.process-singletons');

interface SingletonHolder {
  [REGISTRY_KEY]?: Map<string, unknown>;
}

/**
 * Return the process-wide instance registered under `name`, creating it with
 * `create` on first use.
 *
 * Under the test runner every call creates a fresh instance, so suites that
 * reset the module registry keep getting isolated state.
 */
export function processSingleton<T>(name: string, create: () => T): T {
  if (process.env['NODE_ENV'] === 'test') return create();

  const holder = globalThis as SingletonHolder;
  let registry = holder[REGISTRY_KEY];
  if (!registry) {
    registry = new Map<string, unknown>();
    holder[REGISTRY_KEY] = registry;
  }
  if (!registry.has(name)) {
    registry.set(name, create());
  }
  return registry.get(name) as T;
}
