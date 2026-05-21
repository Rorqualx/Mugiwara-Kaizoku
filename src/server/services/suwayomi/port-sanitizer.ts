/**
 * Suwayomi port sanitizer.
 *
 * When the dev server (or production process) restarts, the JVM child
 * process for Suwayomi gets re-parented to launchd / init (PID 1) because
 * Node didn't kill it on shutdown. The orphan keeps holding the configured
 * port (default 4567), and the next boot's `startServer()` spawn aborts
 * because Suwayomi's own AppMutex detects the existing instance — sending
 * the supervisor into a futile restart loop until the failure-budget cap.
 *
 * `sanitizeSuwayomiPort()` runs BEFORE the spawn:
 *   1. List PIDs holding the port via `lsof -ti :<port>`.
 *   2. For each PID, fingerprint the command line; only kill if it's a
 *      Java process whose args mention `Suwayomi-Server.jar`. We never
 *      kill unrelated processes that happen to be on the same port.
 *   3. SIGTERM, wait up to 2s for graceful exit, then SIGKILL.
 *
 * macOS + Linux are supported (the only platforms the dev/prod environment
 * targets). Windows would need `netstat -ano` + `taskkill /F /PID` and a
 * different fingerprint check; not implemented because no platform target.
 */

import { execSync, spawnSync } from 'child_process';

import { logger } from '@/utils/logger';

const log = logger.child('SuwayomiPortSanitizer');

/** Process startup tag that uniquely identifies our managed Suwayomi JVM. */
const SUWAYOMI_PROCESS_FINGERPRINT = 'Suwayomi-Server.jar';

/** Time to wait for SIGTERM to take effect before escalating to SIGKILL. */
const GRACEFUL_SHUTDOWN_MS = 2_000;

/**
 * If port {@link port} is held by a Suwayomi JVM, kill it. Returns the
 * number of orphans killed (0 when port was already free or held by a
 * non-Suwayomi process). Never throws — failures are logged and treated
 * as "don't sanitize, let the spawn fail naturally" so a misbehaving
 * `lsof`/`ps` doesn't block boot.
 */
export async function sanitizeSuwayomiPort(port: number): Promise<number> {
  const pids = listPidsOnPort(port);
  if (pids.length === 0) return 0;

  let killed = 0;
  // Sequential kills are intentional — tally each outcome accurately.
  // Multiple JVMs on one port is rare-but-real (e.g. interleaved restarts).
  for (const pid of pids) {
    if (!isSuwayomiJvm(pid)) {
      log.warn('Port held by non-Suwayomi process; not killing', { port, pid });
      continue;
    }
    log.info('Killing orphan Suwayomi JVM holding configured port', { port, pid });
    // eslint-disable-next-line no-await-in-loop
    if (await killProcessGracefully(pid)) killed += 1;
  }
  return killed;
}

function listPidsOnPort(port: number): number[] {
  try {
    const out = execSync(`lsof -ti :${port}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 3_000,
    }).trim();
    if (!out) return [];
    return out.split('\n')
      .map(line => Number.parseInt(line, 10))
      .filter(Number.isFinite);
  } catch {
    // lsof exits non-zero when nothing is listening — that's the no-orphan path.
    return [];
  }
}

function isSuwayomiJvm(pid: number): boolean {
  try {
    const out = execSync(`ps -p ${pid} -o command=`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 2_000,
    });
    return out.includes(SUWAYOMI_PROCESS_FINGERPRINT);
  } catch {
    return false;
  }
}

async function killProcessGracefully(pid: number): Promise<boolean> {
  try {
    spawnSync('kill', [String(pid)], { stdio: 'ignore', timeout: 2_000 });
  } catch (err: unknown) {
    log.warn('SIGTERM failed', { pid, error: err instanceof Error ? err.message : String(err) });
  }
  await sleep(GRACEFUL_SHUTDOWN_MS);
  if (!processIsAlive(pid)) return true;

  log.warn('Orphan still alive after SIGTERM; escalating to SIGKILL', { pid });
  try {
    spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore', timeout: 2_000 });
  } catch (err: unknown) {
    log.error('SIGKILL failed', { pid, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
  await sleep(500);
  return !processIsAlive(pid);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
