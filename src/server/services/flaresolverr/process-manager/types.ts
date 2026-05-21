/**
 * FlareSolverr Process Manager Types
 *
 * Type definitions for the centralized process manager that handles
 * process lifecycle, lock files, and cleanup operations.
 *
 * @module flaresolverr/process-manager/types
 */

/**
 * Lock file structure for tracking process ownership
 *
 * Contains all metadata needed to identify and validate process ownership:
 * - PID and PGID for process group tracking
 * - App instance ID for ownership validation
 * - Timestamps and metadata for debugging
 */
export interface ProcessLockFile {
  /** Process ID of the FlareSolverr process */
  pid: number;
  /** Process Group ID for complete process tree cleanup */
  pgid: number;
  /** Unique identifier for this app instance */
  appInstanceId: string;
  /** Timestamp when the lock was created */
  createdAt: number;
  /** Port the process is listening on */
  port: number;
  /** Path to the binary that was launched */
  binaryPath: string;
  /** Hostname of the machine running the process */
  hostname: string;
}

/**
 * Current state of the FlareSolverr process
 */
export interface ProcessState {
  /** Process ID (null if not running) */
  pid: number | null;
  /** Process Group ID (null if not running) */
  pgid: number | null;
  /** Whether the process is currently running */
  isRunning: boolean;
  /** Whether we own this process (via lock file) */
  isOwnedByUs: boolean;
}

/**
 * Options for process shutdown
 */
export interface ShutdownOptions {
  /** Use graceful shutdown (SIGTERM then SIGKILL) vs immediate SIGKILL */
  graceful?: boolean;
  /** Maximum time to wait for graceful shutdown before force kill (ms) */
  timeoutMs?: number;
}

/**
 * Options for spawning FlareSolverr
 */
export interface SpawnOptions {
  /** Port to listen on (default: 8191) */
  port?: number;
  /** Run in headless mode (default: true) */
  headless?: boolean;
  /** Browser pool size (default: 1) */
  browserPoolSize?: number;
  /** Custom Chrome/Chromium path */
  browserPath?: string;
  /** Log level (default: info) */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Result of spawn operation
 */
export interface SpawnResult {
  /** Whether spawn was successful */
  success: boolean;
  /** Process ID if successful */
  pid: number | null;
  /** Process Group ID if successful */
  pgid: number | null;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of lock acquisition
 */
export interface LockResult {
  /** Whether lock was acquired */
  acquired: boolean;
  /** Reason for failure if not acquired */
  reason?: 'already_locked' | 'process_running' | 'io_error';
  /** Existing lock data if another instance owns it */
  existingLock?: ProcessLockFile;
}

/**
 * Result of process validation
 */
export interface ProcessValidation {
  /** Whether the process is valid FlareSolverr */
  isValid: boolean;
  /** The command line of the process */
  command?: string;
  /** Whether it matches our binary path */
  matchesBinary?: boolean;
}
