/**
 * Search Core Router - Single Provider Search
 *
 * Re-exports the modularized search core router.
 *
 * Structure:
 * - core/index.ts - Main router implementation
 * - core/debug-loggers.ts - Provider-specific debug logging
 * - core/types.ts - Type definitions
 *
 * Refactored: 2025-11-26 - Decomposed to reduce complexity
 */

export { searchCoreRouter } from './core/index';
