/**
 * Suwayomi Service Lifecycle Manager Module
 *
 * Handles server lifecycle operations including starting, stopping,
 * health monitoring, and configuration management.
 *
 * @module suwayomi-service/lifecycle-manager
 */

import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import axios from 'axios';

import { logger } from '@/utils/logger';

import {
    HOMEBREW_JAVA_PATHS,
    HEALTH_CHECK_CONFIG,
    DEFAULT_JAVA_MEMORY,
    type NodeError,
    type SuwayomiAdvancedConfig,
} from './types';

import type { ChildProcess } from 'child_process';

// =============================================================================
// Promisified Utilities
// =============================================================================

const execAsync = promisify(exec);

// =============================================================================
// Helper Type Definitions
// =============================================================================

/**
 * Configuration for building JVM arguments
 */
interface JvmArgsConfig {
    minMemory: number;
    maxMemory: number;
    configPath: string;
    port: number;
    jarPath: string;
}

/**
 * Result of applying sandbox options
 */
interface SandboxResult {
    command: string;
    args: string[];
}

/**
 * Sandbox options from security service
 */
interface SandboxOptions {
    firejail?: unknown[];
    sandbox?: unknown[];
    [key: string]: unknown;
}

/**
 * Callbacks for process lifecycle events
 */
interface ProcessLifecycleCallbacks {
    onError: () => void;
    onClose: (exitCode: number | null) => void;
}

/**
 * Health check client interface
 */
interface HealthCheckClient {
    checkServerHealth: () => Promise<boolean>;
}

// =============================================================================
// Helper Functions (Extracted for Complexity Reduction)
// =============================================================================

/**
 * Build JVM arguments for Suwayomi server
 *
 * @param config - JVM configuration options
 * @returns Array of JVM arguments
 */
function buildJvmArgs(config: JvmArgsConfig): string[] {
    const { minMemory, maxMemory, configPath, port, jarPath } = config;

    return [
        `-Xms${minMemory}m`,
        `-Xmx${maxMemory}m`,
        '-Dsuwayomi.tachidesk.config.server.rootDir=' + configPath,
        '-Dsuwayomi.tachidesk.config.server.port=' + port,
        // Disable all UI components with correct prefix
        '-Dsuwayomi.tachidesk.config.server.webUIEnabled=false',
        '-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false',
        '-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false',
        // Additional headless mode settings
        '-Djava.awt.headless=true',
        '-Dfile.encoding=UTF-8',
        // WebView/Cloudflare sources (e.g. mangafire) drive Suwayomi's bundled
        // KCEF off-screen browser, which loads JOGL's libgluegen_rt.so for its GL
        // canvas. KCEF downloads that native into <rootDir>/bin/kcef, which is NOT
        // on the JVM's default java.library.path — so the canvas init throws
        // UnsatisfiedLinkError and the source silently returns zero results.
        // Add the kcef dir to the path (alongside the standard Linux JRE dirs so
        // other native loads are unaffected). Only the path LIST is fixed at JVM
        // init, so the .so resolves at loadLibrary time even if KCEF downloads it
        // after startup.
        `-Djava.library.path=${path.join(configPath, 'bin', 'kcef')}:/usr/java/packages/lib:/usr/lib64:/usr/lib`,
        '-jar',
        jarPath,
    ];
}

/**
 * Apply sandbox options to command and arguments
 *
 * @param sandboxOptions - Sandbox configuration from security service
 * @param baseCommand - Base command to run
 * @param jvmArgs - JVM arguments
 * @returns Modified command and arguments
 */
function applySandboxOptions(
    sandboxOptions: SandboxOptions | null,
    baseCommand: string,
    jvmArgs: string[]
): SandboxResult {
    let command = baseCommand;
    let args = jvmArgs;

    if (sandboxOptions?.firejail) {
        // Linux with firejail
        const firejail = sandboxOptions.firejail;
        if (Array.isArray(firejail) && firejail.length > 0) {
            const firejailCommand = firejail[0];
            if (typeof firejailCommand === 'string') {
                command = firejailCommand;
                const firejailArgs = firejail
                    .slice(1)
                    .filter((arg): arg is string => typeof arg === 'string');
                args = [...firejailArgs, 'java', ...jvmArgs];
            }
        }
    } else if (sandboxOptions?.sandbox) {
        // macOS with sandbox-exec
        const sandbox = sandboxOptions.sandbox;
        if (Array.isArray(sandbox) && sandbox.length > 0) {
            const sandboxCommand = sandbox[0];
            if (typeof sandboxCommand === 'string') {
                command = sandboxCommand;
                const sandboxArgs = sandbox
                    .slice(1)
                    .filter((arg): arg is string => typeof arg === 'string');
                args = [...sandboxArgs, 'java', ...jvmArgs];
            }
        }
    }

    return { command, args };
}

/**
 * Resolve Java command path, checking Homebrew locations
 *
 * @param defaultCommand - Default java command
 * @returns Resolved Java command path
 * @throws Error if Java version is incompatible
 */
async function resolveJavaCommand(defaultCommand: string): Promise<string> {
    // Check for Java 21 in Homebrew locations
    for (const javaPath of HOMEBREW_JAVA_PATHS) {
        if (fs.existsSync(javaPath)) {
            logger.info(`Using Java 21 from Homebrew: ${javaPath}`);
            return javaPath;
        }
    }

    // If still using default 'java', verify it's Java 21+
    if (defaultCommand === 'java') {
        try {
            const { stderr } = await execAsync('java -version');
            const versionMatch = stderr.match(/version "(\d+)/);
            const versionStr = versionMatch?.[1] ?? '0';
            const majorVersion = parseInt(versionStr, 10);

            if (majorVersion < 21) {
                throw new Error(
                    `Default Java version is ${majorVersion}, but Suwayomi requires Java 21+`
                );
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to verify Java version: ${errorMessage}`);
        }
    }

    return defaultCommand;
}

/**
 * Setup process output handlers for logging
 *
 * @param serverProcess - The child process to attach handlers to
 */
function setupOutputHandlers(serverProcess: ChildProcess): void {
    if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                logger.debug('Suwayomi-Server: ' + message);
            }
        });
    }

    if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                // Check if it's actually an error or just info logged to stderr
                if (message.includes('INFO') || message.includes('WARN')) {
                    logger.info('Suwayomi-Server: ' + message);
                } else {
                    logger.error('Suwayomi-Server Error: ' + message);
                }
            }
        });
    }
}

/**
 * Setup process event handlers for error and close events
 *
 * @param serverProcess - The child process
 * @param callbacks - Callbacks for lifecycle events
 */
function setupProcessEventHandlers(
    serverProcess: ChildProcess,
    callbacks: ProcessLifecycleCallbacks
): void {
    serverProcess.on('error', (err: NodeError) => {
        logger.error('Suwayomi-Server process error: ' + err);
        logger.error(`Error code: ${err.code ?? 'unknown'}`);
        logger.error(`Error syscall: ${err.syscall ?? 'unknown'}`);
        logger.error(`Error path: ${err.path ?? 'unknown'}`);
        callbacks.onError();
    });

    serverProcess.on('close', (code) => {
        logger.info('Suwayomi-Server exited with code ' + code);
        callbacks.onClose(code);
    });
}

/**
 * Register cleanup handlers for graceful shutdown
 *
 * @param serverProcess - The server process to cleanup
 */
function registerCleanupHandlers(serverProcess: ChildProcess): void {
    const cleanupHandler = (): void => {
        if (serverProcess.pid) {
            logger.info('Parent process exiting, stopping Suwayomi-Server...');
            try {
                process.kill(serverProcess.pid, 'SIGTERM');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Failed to stop Suwayomi on exit: ${errorMessage}`);
            }
        }
    };

    // Register cleanup on various exit signals
    process.once('exit', cleanupHandler);
    process.once('SIGINT', cleanupHandler);
    process.once('SIGTERM', cleanupHandler);
    process.once('SIGUSR1', cleanupHandler);
    process.once('SIGUSR2', cleanupHandler);
    process.once('uncaughtException', (error) => {
        logger.error(`Uncaught exception: ${error}`);
        cleanupHandler();
    });
}

/**
 * Verify JAR file exists and is accessible
 *
 * @param jarPath - Path to the JAR file
 * @returns True if JAR is accessible
 */
async function verifyJarAccess(jarPath: string): Promise<boolean> {
    try {
        await fsPromises.access(jarPath, fs.constants.R_OK);
        logger.info(`Suwayomi JAR verified at: ${jarPath}`);
        return true;
    } catch (error: unknown) {
        logger.error(`Cannot access Suwayomi JAR at ${jarPath}: ${error}`);
        return false;
    }
}

/**
 * Log server startup information
 *
 * @param command - Java command being used
 * @param args - JVM arguments
 */
function logStartupInfo(command: string, args: string[]): void {
    logger.info(`Starting Suwayomi-Server in headless mode`);
    logger.info(`Command: ${command}`);
    logger.info(
        `JVM Arguments: ${args.filter((arg) => arg.startsWith('-D') || arg.startsWith('-X')).join(' ')}`
    );
}

/**
 * Spawn the Suwayomi server process
 *
 * @param command - Java command to execute
 * @param args - Command arguments
 * @returns Spawned child process or null on failure
 */
/**
 * Sanitize the configured port BEFORE spawning. When the dev server
 * restarts, the previous JVM child often gets re-parented to launchd
 * and keeps holding the port; the new spawn then fails Suwayomi's
 * AppMutex check and the supervisor enters a 60s-backoff restart loop.
 * We detect orphaned Suwayomi-Server.jar processes on this port and
 * SIGTERM/SIGKILL them — non-Suwayomi processes are left alone.
 */
async function sanitizePortIfOrphaned(port: number): Promise<void> {
    const { sanitizeSuwayomiPort } = await import('../port-sanitizer');
    const killed = await sanitizeSuwayomiPort(port);
    if (killed > 0) logger.info(`Sanitized ${killed} orphan Suwayomi process(es) before spawn`);
}

function spawnServerProcess(command: string, args: string[]): ChildProcess | null {
    logger.info(`Spawning Suwayomi process...`);

    try {
        const spawnEnv: NodeJS.ProcessEnv = { ...process.env };
        if (command.includes('/')) {
            spawnEnv['JAVA_HOME'] = path.dirname(path.dirname(command));
        }

        const serverProcess = spawn(command, args, {
            detached: false, // Tied to parent process
            stdio: ['ignore', 'pipe', 'pipe'],
            env: spawnEnv,
        });

        if (!serverProcess.pid) {
            logger.error('Failed to spawn Suwayomi process - no PID assigned');
            return null;
        }

        logger.info(`Suwayomi process spawned with PID: ${serverProcess.pid}`);
        return serverProcess;
    } catch (spawnError: unknown) {
        const errorMessage = spawnError instanceof Error ? spawnError.message : String(spawnError);
        logger.error(`Failed to spawn Suwayomi process: ${errorMessage}`);
        logger.error(`Command attempted: ${command}`);
        logger.error(`Working directory: ${process.cwd()}`);
        return null;
    }
}

// =============================================================================
// Main Lifecycle Functions
// =============================================================================

/**
 * Start the Suwayomi server
 *
 * Performs the following steps:
 * 1. Validates Java availability
 * 2. Ensures server JAR is downloaded
 * 3. Builds JVM arguments with memory and headless settings
 * 4. Applies sandbox options if available
 * 5. Resolves Java command path
 * 6. Spawns server process
 * 7. Sets up output and event handlers
 * 8. Waits for server to be ready
 *
 * @param context - Server context with state and dependencies
 * @returns True if server started successfully
 */
export async function startServer(context: {
    isRunning: boolean;
    javaAvailable: boolean | null;
    serverPath: string;
    configPath: string;
    port: number;
    serverProcess: ChildProcess | null;
    downloadManager: { stop: () => void; start: () => void } | null;
    client: HealthCheckClient;
    checkJavaAvailability: () => Promise<void>;
    downloadServerIfNeeded: () => Promise<boolean>;
    updateConfig: (config: { serverPath: string; configPath: string; port: number }) => void;
    loadConfig: () => Promise<{ serverPath: string; configPath: string; port: number }>;
    getAdvancedConfig: () => SuwayomiAdvancedConfig;
    createSandboxedProcess: (
        cmd: string,
        jarPath: string,
        args: string[]
    ) => Promise<SandboxOptions | null>;
    /**
     * Optional supervisor hook fired when the spawned JVM process closes.
     * Receives the exit code so the supervisor can classify intentional vs
     * unexpected exits and schedule a restart with backoff. Independent of
     * the download-manager stop side-effect that already runs on close.
     */
    onProcessClose?: (exitCode: number | null) => void;
}): Promise<{ success: boolean; serverProcess: ChildProcess | null; isRunning: boolean }> {
    if (context.isRunning) {
        logger.info('Suwayomi-Server is already running');
        return { success: true, serverProcess: context.serverProcess, isRunning: true };
    }

    // Check Java availability first
    if (context.javaAvailable === null) {
        await context.checkJavaAvailability();
    }

    if (context.javaAvailable === false) {
        logger.error('Cannot start Suwayomi-Server: Java is not installed');
        return { success: false, serverProcess: null, isRunning: false };
    }

    // Load the latest config with default values
    const config = await context.loadConfig();
    context.updateConfig({
        serverPath: config.serverPath,
        configPath: config.configPath,
        port: config.port,
    });

    // Ensure server is downloaded
    const isDownloaded = await context.downloadServerIfNeeded();
    if (!isDownloaded) {
        return { success: false, serverProcess: null, isRunning: false };
    }

    const jarPath = path.join(context.serverPath, 'Suwayomi-Server.jar');

    // Verify JAR file exists and is readable
    const jarAccessible = await verifyJarAccess(jarPath);
    if (!jarAccessible) {
        return { success: false, serverProcess: null, isRunning: false };
    }

    try {
        await sanitizePortIfOrphaned(context.port);

        // Get advanced config for memory settings
        const advancedConfig = context.getAdvancedConfig();
        const minMemory = advancedConfig.javaMemoryMin ?? DEFAULT_JAVA_MEMORY.min;
        const maxMemory = advancedConfig.javaMemoryMax ?? DEFAULT_JAVA_MEMORY.max;

        // Build JVM arguments
        const jvmArgs = buildJvmArgs({
            minMemory,
            maxMemory,
            configPath: context.configPath,
            port: context.port,
            jarPath,
        });

        // Check for sandboxing
        const sandboxOptions = await context.createSandboxedProcess('java', jarPath, jvmArgs);

        // Apply sandbox options and resolve Java command
        const sandboxResult = applySandboxOptions(sandboxOptions, 'java', jvmArgs);
        const args = sandboxResult.args;
        let command = sandboxResult.command;

        // Resolve Java command if not sandboxed
        if (command === 'java') {
            try {
                command = await resolveJavaCommand(command);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(errorMessage);
                return { success: false, serverProcess: null, isRunning: false };
            }
        }

        // Log startup info. (Headless settings + extensionRepos + FlareSolverr
        // wiring are handled by suwayomiService.bootstrapSuwayomiConfig() before
        // we reach the lifecycle. The legacy ensureHeadlessConfig writer used a
        // naive `split('=')` HOCON parser that corrupted array values, so it's
        // intentionally bypassed here.)
        logStartupInfo(command, args);

        // Spawn server process
        const serverProcess = spawnServerProcess(command, args);
        if (!serverProcess) {
            return { success: false, serverProcess: null, isRunning: false };
        }

        // Setup output and event handlers
        setupOutputHandlers(serverProcess);
        setupProcessEventHandlers(serverProcess, {
            onError: () => { /* Caller handles state updates */ },
            onClose: (exitCode) => {
                if (context.downloadManager) {
                    context.downloadManager.stop();
                }
                if (context.onProcessClose) {
                    context.onProcessClose(exitCode);
                }
            },
        });

        // Register cleanup and log PID
        if (serverProcess.pid) {
            logger.info(`Suwayomi-Server started with PID: ${serverProcess.pid}`);
            registerCleanupHandlers(serverProcess);
        }

        // Wait for server and start download manager
        await waitForServerReady(context.client);
        if (context.downloadManager) {
            context.downloadManager.start();
        }

        return { success: true, serverProcess, isRunning: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error starting Suwayomi-Server: ' + errorMessage);
        return { success: false, serverProcess: null, isRunning: false };
    }
}

/**
 * Stop the Suwayomi-Server process
 *
 * Attempts graceful shutdown first via API, falls back to force kill if needed:
 * 1. Stops download manager if running
 * 2. Attempts graceful shutdown via API
 * 3. Force kills process after timeout if needed
 * 4. Cleans up process references
 *
 * @param context - Server context with process and state
 * @returns True if server stopped successfully
 */
export async function stopServer(context: {
    isRunning: boolean;
    serverProcess: ChildProcess | null;
    downloadManager: { stop: () => void } | null;
    serverUrl: string;
}): Promise<{ success: boolean; serverProcess: null; isRunning: boolean }> {
    if (!context.isRunning || !context.serverProcess) {
        logger.info('Suwayomi-Server is not running');
        return { success: true, serverProcess: null, isRunning: false };
    }

    // Stop the download manager if it's running
    if (context.downloadManager) {
        context.downloadManager.stop();
    }

    return new Promise((resolve) => {
        let forcedKill = false;

        // Set up process exit handler
        const onProcessExit = (): void => {
            logger.info('Suwayomi-Server process exited');
            resolve({ success: true, serverProcess: null, isRunning: false });
        };

        if (context.serverProcess) {
            context.serverProcess.once('exit', onProcessExit);
        }

        // Try to gracefully shut down via API first
        axios
            .get(context.serverUrl + '/api/v1/server/stop', { timeout: HEALTH_CHECK_CONFIG.shutdownTimeout })
            .then(() => {
                logger.info('Suwayomi-Server stopping gracefully via API');
            })
            .catch(() => {
                // If API fails, send SIGTERM to the process
                if (context.serverProcess && !forcedKill) {
                    logger.info('API stop failed, sending SIGTERM to Suwayomi process');
                    context.serverProcess.kill('SIGTERM');
                }
            });

        // Set a timeout to force kill if graceful shutdown doesn't work
        setTimeout(() => {
            if (context.serverProcess && !forcedKill) {
                forcedKill = true;
                logger.warn('Graceful shutdown timeout, forcing SIGKILL');
                context.serverProcess.kill('SIGKILL');

                // Also try to kill by PID if available
                if (context.serverProcess.pid) {
                    try {
                        process.kill(context.serverProcess.pid, 'SIGKILL');
                    } catch (error: unknown) {
                        logger.error(`Failed to kill process ${context.serverProcess.pid}: ${error}`);
                    }
                }

                resolve({ success: true, serverProcess: null, isRunning: false });
            }
        }, HEALTH_CHECK_CONFIG.shutdownTimeout);
    });
}

/**
 * Ensures the server.conf file has correct headless settings
 *
 * Creates or updates the server configuration file to ensure
 * headless mode settings are properly configured, preventing
 * any existing configuration from overriding our JVM arguments.
 *
 * @param configPath - Path to configuration directory
 * @param port - Server port number
 */
export function ensureHeadlessConfig(configPath: string, port: number): void {
    const serverConfPath = path.join(configPath, 'server.conf');

    try {
        let configContent = '';

        // Read existing config if it exists
        if (fs.existsSync(serverConfPath)) {
            configContent = fs.readFileSync(serverConfPath, 'utf-8');
            logger.info(`Updating existing server.conf for headless mode`);
        } else {
            logger.info(`Creating server.conf with headless settings`);
        }

        // Parse existing config into lines
        const lines = configContent.split('\n');
        const configMap = new Map<string, string>();

        // Parse existing settings
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
                configMap.set(key.trim(), valueParts.join('=').trim());
            }
        }

        // Ensure headless settings
        configMap.set('server.webUIEnabled', 'false');
        configMap.set('server.initialOpenInBrowserEnabled', 'false');
        configMap.set('server.port', String(port));
        configMap.set('server.bindIp', '0.0.0.0');

        // Build new config content
        const newConfigLines: string[] = [
            '# Suwayomi Server Configuration',
            '# Generated by Kaizoku for headless mode',
            '',
            '# Server settings',
            `server.port=${configMap.get('server.port')}`,
            `server.bindIp=${configMap.get('server.bindIp')}`,
            '',
            '# Headless mode settings',
            `server.webUIEnabled=${configMap.get('server.webUIEnabled')}`,
            `server.initialOpenInBrowserEnabled=${configMap.get('server.initialOpenInBrowserEnabled')}`,
            '',
        ];

        // Add any other existing settings
        for (const [key, value] of configMap) {
            if (!key.startsWith('server.')) {
                newConfigLines.push(`${key}=${value}`);
            }
        }

        // Write the updated config
        fs.writeFileSync(serverConfPath, newConfigLines.join('\n'), 'utf-8');
        logger.info(`Server configuration updated for headless mode at: ${serverConfPath}`);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to update server.conf: ${errorMessage}`);
    }
}

/**
 * Wait for server to be ready by polling health endpoint
 *
 * Polls the server health check endpoint until it responds successfully
 * or maximum retries are reached.
 *
 * @param client - Health check client
 * @param retries - Maximum number of retry attempts
 * @param delay - Delay between retries in milliseconds
 * @returns True if server becomes ready, false if timeout
 */
export async function waitForServerReady(
    client: HealthCheckClient,
    retries: number = HEALTH_CHECK_CONFIG.maxRetries,
    delay: number = HEALTH_CHECK_CONFIG.retryDelay
): Promise<boolean> {
    // Helper to wait for delay
    const sleep = (ms: number): Promise<void> =>
        new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });

    // Polling loop - await in loop is intentional for sequential health checks
    for (let i = 0; i < retries; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const isHealthy = await client.checkServerHealth();
            if (isHealthy) {
                logger.info('Suwayomi-Server is ready');
                return true;
            }
        } catch (_error: unknown) {
            // Server not ready yet, continue to wait
        }

        // eslint-disable-next-line no-await-in-loop
        await sleep(delay);
    }

    logger.error('Timed out waiting for Suwayomi-Server to be ready');
    return false;
}

/**
 * Check if server is currently running and healthy
 *
 * Verifies both process status and API health:
 * 1. Checks internal running status
 * 2. Verifies API health if running
 * 3. Updates status based on health check
 *
 * @param client - Health check client
 * @param isRunning - Current running status
 * @returns Object with health status
 */
export async function checkServerHealth(
    client: HealthCheckClient,
    isRunning: boolean
): Promise<{ isRunning: boolean; isHealthy: boolean }> {
    if (!isRunning) {
        return { isRunning: false, isHealthy: false };
    }

    try {
        const isHealthy = await client.checkServerHealth();
        return { isRunning: isHealthy, isHealthy };
    } catch (_error: unknown) {
        return { isRunning: false, isHealthy: false };
    }
}

// =============================================================================
// Re-exports for Convenience
// =============================================================================

export {
    buildJvmArgs,
    applySandboxOptions,
    resolveJavaCommand,
    setupOutputHandlers,
    setupProcessEventHandlers,
    registerCleanupHandlers,
    verifyJarAccess,
    logStartupInfo,
    spawnServerProcess,
};

export type {
    JvmArgsConfig,
    SandboxResult,
    SandboxOptions,
    ProcessLifecycleCallbacks,
    HealthCheckClient,
};
