/**
 * Events System Initialization
 *
 * Initializes the events system during application startup.
 * Sets up the event logging system and seeds initial events if needed.
 *
 * @module server/services/events/initialize
 */
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { scheduleEventCleanup } from './cleanupTask';
import { eventLogger } from './eventLogger';
import { seedEvents } from './seedEvents';
/**
 * Formats error messages consistently
 *
 * @param {unknown} error - The error to format
 * @returns {string} Formatted error message
 */
function formatError(error: unknown): string {
  return error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error occurred';
}
/**
 * Initializes the events system
 *
 * This function:
 * - Seeds initial events if the database is empty
 * - Sets up the event cleanup schedule
 * - Logs a startup event
 *
 * @returns {Promise<boolean>} True if initialization was successful
 */
export async function initializeEventsSystem(): Promise<boolean> {
  try {
    logger.info('Initializing events system...');
    // Check if this is the first startup (no events exist)
    const eventCount = await prisma.systemEvent.count();
    if (eventCount === 0) {
      logger.info('No events found. Seeding initial events...');
      await seedEvents();
    }
    // Schedule event cleanup
    scheduleEventCleanup();
    // Log startup event
    await eventLogger.logStartup({
      startupTime: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env["APP_VERSION"] ?? 'unknown'
    });
    logger.info('Events system initialized successfully');
    return true;
  }
  catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to initialize events system: ${formatError(errorMessage)}`);
    return false;
  }
}