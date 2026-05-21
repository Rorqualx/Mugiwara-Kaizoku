/**
 * Module Resolution Test Utility
 *
 * This module provides a simple test to verify correct module resolution
 * in the TypeScript/Node.js environment. It demonstrates the use of
 * process.cwd() for path resolution instead of import.meta.url or
 * fileURLToPath.
 *
 * @module test-resolution
 */
import process from 'process';

import { logger } from '../utils/logger';
/**
 * Directory and file path resolution using process.cwd()
 * Demonstrates proper path resolution in both ESM and CommonJS contexts
 */
const dirname = process.cwd();
const filename = dirname + '/src/utils/test-resolution.ts';
logger.info('Module resolution test successful');
logger.info('dirname:', dirname);
logger.info('filename:', filename);
/**
 * Flag indicating successful module resolution
 * Used by other modules to verify the import system is working correctly
 *
 * @constant {boolean}
 */
export const testResolution = true;
