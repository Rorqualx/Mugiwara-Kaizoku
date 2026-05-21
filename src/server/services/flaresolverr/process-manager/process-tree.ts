/**
 * FlareSolverr Process Tree Utilities
 *
 * Functions for managing process trees, finding child processes,
 * and performing validated process operations.
 *
 * Key features:
 * - Kill entire process groups (including Chrome subprocesses)
 * - Find child processes of a parent
 * - Validate processes before killing
 *
 * @module flaresolverr/process-manager/process-tree
 */

import { execSync } from 'child_process';

import { logger } from '@/utils/logger';

import type { ProcessValidation } from './types';

// =============================================================================
// Process State Checking
// =============================================================================

/**
 * Check if a process is running by sending signal 0
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the command line of a process
 * @returns Command line string or null if not found
 */
export function getProcessCommand(pid: number): string | null {
  try {
    const result = execSync(`ps -p ${pid} -o command= 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    // Empty string means no command found
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Get the process group ID for a process
 */
export function getProcessGroupId(pid: number): number | null {
  try {
    const result = execSync(`ps -o pgid= -p ${pid} 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    const pgid = parseInt(result, 10);
    return isNaN(pgid) ? null : pgid;
  } catch {
    return null;
  }
}

// =============================================================================
// Process Validation
// =============================================================================

/**
 * Validate that a process is a FlareSolverr process
 *
 * Checks the command line to ensure we're not killing unrelated processes.
 * Looks for flaresolverr-go binary or spawned Chrome processes.
 *
 * @param pid Process ID to validate
 * @param expectedBinaryPath Optional expected binary path for stricter validation
 */
export function validateFlareSolverrProcess(
  pid: number,
  expectedBinaryPath?: string
): ProcessValidation {
  const command = getProcessCommand(pid);

  if (!command) {
    return { isValid: false };
  }

  const commandLower = command.toLowerCase();

  // Check for FlareSolverr-related processes
  const isFlareSolverr =
    commandLower.includes('flaresolverr-go') ||
    commandLower.includes('flaresolverr');

  // Check for Chrome/Chromium (spawned by FlareSolverr)
  const isChrome =
    commandLower.includes('chromium') ||
    commandLower.includes('chrome');

  const isValid = isFlareSolverr || isChrome;

  // Build result object
  const result: ProcessValidation = {
    isValid,
    command,
  };

  // Stricter check if binary path provided
  if (expectedBinaryPath) {
    result.matchesBinary = isFlareSolverr && command.includes(expectedBinaryPath);
  }

  return result;
}

// =============================================================================
// Child Process Discovery
// =============================================================================

/**
 * Find all child processes of a parent PID
 *
 * Uses pgrep or ps to find processes with the given parent.
 * Useful for finding Chrome processes spawned by FlareSolverr.
 *
 * @param ppid Parent process ID
 * @returns Array of child PIDs
 */
export function findChildProcesses(ppid: number): number[] {
  const children: number[] = [];

  try {
    // Try pgrep first (more efficient)
    const pgrepResult = execSync(`pgrep -P ${ppid} 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (pgrepResult) {
      const pids = pgrepResult
        .split('\n')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p) && p > 0);
      children.push(...pids);
    }
  } catch {
    // pgrep failed, try ps
    try {
      const psResult = execSync(
        `ps -o pid= --ppid ${ppid} 2>/dev/null || ps -o pid= -p $(ps -o pid= -p ${ppid} 2>/dev/null) 2>/dev/null || true`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (psResult) {
        const pids = psResult
          .split('\n')
          .map((p) => parseInt(p.trim(), 10))
          .filter((p) => !isNaN(p) && p > 0);
        children.push(...pids);
      }
    } catch {
      // Give up
    }
  }

  return [...new Set(children)]; // Dedupe
}

/**
 * Recursively find all descendant processes
 */
export function findAllDescendants(pid: number): number[] {
  const descendants: number[] = [];
  const toProcess = [pid];
  const seen = new Set<number>();

  while (toProcess.length > 0) {
    const current = toProcess.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const children = findChildProcesses(current);
    for (const child of children) {
      if (!seen.has(child)) {
        descendants.push(child);
        toProcess.push(child);
      }
    }
  }

  return descendants;
}

// =============================================================================
// Process Killing
// =============================================================================

/**
 * Send a signal to a process
 *
 * @param pid Process ID
 * @param signal Signal to send (SIGTERM or SIGKILL)
 * @returns True if signal was sent successfully
 */
export function sendSignal(pid: number, signal: 'SIGTERM' | 'SIGKILL'): boolean {
  try {
    process.kill(pid, signal);
    logger.debug('[ProcessTree] Sent signal to process', { pid, signal });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug('[ProcessTree] Failed to send signal', { pid, signal, error: errorMessage });
    return false;
  }
}

/**
 * Kill a process group by PGID
 *
 * Sends signal to the negative of PGID to target all processes in the group.
 * This ensures Chrome subprocesses are also killed.
 *
 * @param pgid Process Group ID
 * @param signal Signal to send
 * @returns True if signal was sent successfully
 */
export function killProcessGroup(pgid: number, signal: 'SIGTERM' | 'SIGKILL'): boolean {
  try {
    // Negative PID targets the process group
    process.kill(-pgid, signal);
    logger.debug('[ProcessTree] Sent signal to process group', { pgid, signal });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // ESRCH means no such process - group already dead
    if (errorMessage.includes('ESRCH')) {
      logger.debug('[ProcessTree] Process group already dead', { pgid });
      return true;
    }
    logger.debug('[ProcessTree] Failed to kill process group', { pgid, signal, error: errorMessage });
    return false;
  }
}

/**
 * Kill a process with validation
 *
 * Validates the process is a FlareSolverr process before killing.
 * Prevents accidentally killing unrelated processes.
 *
 * @param pid Process ID
 * @param signal Signal to send
 * @param validate Whether to validate before killing (default: true)
 * @returns True if process was killed or already dead
 */
export function killProcessSafe(
  pid: number,
  signal: 'SIGTERM' | 'SIGKILL',
  validate: boolean = true
): boolean {
  // Check if process exists
  if (!isProcessRunning(pid)) {
    return true; // Already dead
  }

  // Validate if requested
  if (validate) {
    const validation = validateFlareSolverrProcess(pid);
    if (!validation.isValid) {
      logger.warn('[ProcessTree] Refusing to kill non-FlareSolverr process', {
        pid,
        command: validation.command,
      });
      return false;
    }
  }

  return sendSignal(pid, signal);
}

/**
 * Kill a process and all its children
 *
 * @param pid Parent process ID
 * @param signal Signal to send
 * @param validate Whether to validate processes before killing
 */
export function killProcessTree(
  pid: number,
  signal: 'SIGTERM' | 'SIGKILL',
  validate: boolean = true
): void {
  // Find all descendants first
  const descendants = findAllDescendants(pid);

  // Kill children first (bottom-up)
  for (const child of descendants.reverse()) {
    killProcessSafe(child, signal, validate);
  }

  // Kill parent last
  killProcessSafe(pid, signal, validate);
}

// =============================================================================
// Port-Based Process Discovery
// =============================================================================

/**
 * Find process IDs listening on a specific port
 *
 * Uses lsof (macOS/Linux) or netstat (Linux) to find listeners.
 *
 * @param port Port number
 * @returns Array of PIDs listening on the port
 */
export function findProcessesOnPort(port: number): number[] {
  const pids: number[] = [];

  try {
    // Try lsof first (macOS and Linux)
    const lsofResult = execSync(`lsof -ti:${port} 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (lsofResult) {
      const foundPids = lsofResult
        .split('\n')
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p) && p > 0);
      pids.push(...foundPids);
    }
  } catch {
    // lsof failed, try netstat
    try {
      const netstatResult = execSync(
        `netstat -tlnp 2>/dev/null | grep ':${port}' | awk '{print $7}' | cut -d'/' -f1 || true`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (netstatResult) {
        const foundPids = netstatResult
          .split('\n')
          .map((p) => parseInt(p.trim(), 10))
          .filter((p) => !isNaN(p) && p > 0);
        pids.push(...foundPids);
      }
    } catch {
      // Give up
    }
  }

  return [...new Set(pids)]; // Dedupe
}

/**
 * Find and validate FlareSolverr processes on a port
 *
 * Finds processes on the port and filters to only FlareSolverr-related ones.
 *
 * @param port Port number
 * @returns Array of validated FlareSolverr PIDs
 */
export function findFlareSolverrProcessesOnPort(port: number): number[] {
  const pids = findProcessesOnPort(port);
  return pids.filter((pid) => validateFlareSolverrProcess(pid).isValid);
}
