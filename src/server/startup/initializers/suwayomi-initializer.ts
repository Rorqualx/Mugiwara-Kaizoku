/**
 * Suwayomi Initializer Module
 *
 * Initializes the Suwayomi manga server integration with Java validation
 * and auto-start configuration.
 *
 * Extracted from: src/server/index.ts (lines 294-341)
 */

import { suwayomiConfigService } from '@/server/services/suwayomi/configService';
import { suwayomiService } from '@/server/services/suwayomi/service';
import { checkJavaInstalled } from '@/server/services/suwayomi/utils';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/**
 * Initializes the Suwayomi manga server
 *
 * This function:
 * - Checks for Java installation (required by Suwayomi)
 * - Verifies Suwayomi settings
 * - Starts the Suwayomi server if enabled
 *
 * @throws {Error} If Suwayomi initialization fails
 */
export async function initializeSuwayomi(): Promise<void> {
  try {
    // NOTE: a previous version of this file early-returned when DOCKER=true
    // because Suwayomi ran as a sidecar container in the legacy compose
    // stack. The bundled architecture puts the JVM inside the same image
    // (see services/suwayomi/lifecycle-manager.ts — child process), so this
    // initializer is the correct entry point in Docker too. The early-return
    // was the reason the JVM never auto-started on container restart and
    // the user had to click Start manually after every reboot.

    // Check if Java is installed
    const javaAvailable = await checkJavaInstalled();
    if (!javaAvailable) {
      logger.warn('Java is not installed or not in PATH. Suwayomi features will be limited.');
      logger.info('To enable Suwayomi features, please install Java 11 or higher.');
      return;
    }

    // Get the Suwayomi configuration service
    const suwayomiSettings = await suwayomiConfigService.loadConfig();

    if (!suwayomiSettings.enabled) {
      logger.info('Suwayomi integration is disabled in settings');
      return;
    }

    // Update service configuration with the new settings
    suwayomiService.updateConfig({
      serverPath: suwayomiSettings.serverPath,
      configPath: suwayomiSettings.configPath,
      port: suwayomiSettings.port
    });

    // Managed-lifecycle: reaching this point means `enabled === true`
    // (the early return above gates that). Treat the JVM like the
    // FlareSolverr internal instance — start on boot, let the supervisor
    // restart it on crash. The legacy `autoStart` flag is now redundant
    // (kept in config for backwards compat but ignored here).
    logger.info('Starting Suwayomi server on boot (enabled=true, managed lifecycle)');
    const started = await suwayomiService.startServer();
    if (started) {
      logger.info('Suwayomi server started successfully');
    } else {
      logger.error('Failed to start Suwayomi server (supervisor will retry on crash)');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error initializing Suwayomi: ${formatError(errorMessage)}`);
  }
}
