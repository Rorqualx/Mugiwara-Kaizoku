/**
 * Logging Module
 * 
 * This module exports a unified logging interface and implementations for
 * different environments (browser, server) and backends (console, pino, etc.).
 * 
 * The standardized interface ensures type safety and consistent usage patterns
 * throughout the codebase, solving compatibility issues with different logger
 * implementations.
 */

// Re-export the standardized logger interface and implementations
export {
  standardLogger,
  createLoggerAdapter,
  createPinoAdapter,
  createNoopLogger
} from './standardLogger';
export type { StandardLogger } from './standardLogger';

// Re-export the base logger for backward compatibility
export { logger } from '../logging';

// Export the default standardized logger
import { standardLogger } from './standardLogger';
export default standardLogger;