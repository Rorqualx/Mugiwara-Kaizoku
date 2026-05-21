/**
 * Compatibility shim for old logging imports
 * 
 * This file provides backward compatibility for code that imports from '../utils/logger'
 * while redirecting to the new logger system.
 */

// Re-export everything from the new logger
export { logger, createLogger, getLogger, createChildLogger } from './logger';
export type { LogLevel, LogContext } from './logger';

// For backward compatibility, also export logger as default
import { logger } from './logger';
export default logger;