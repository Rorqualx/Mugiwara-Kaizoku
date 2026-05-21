/**
 * Configuration Hook - tRPC Implementation
 *
 * This module now uses the tRPC-based implementation for real data persistence.
 * All configuration data is saved to the database and persists across sessions.
 *
 * Migration Date: January 2025
 * Previous mock implementation backed up as useConfig.backup.20250102.ts
 *
 * This implementation follows the AsyncResult pattern and architectural guidelines:
 * - Uses proper tRPC client import from utils/trpc-client/index
 * - Implements comprehensive error handling
 * - Maintains backward compatibility with existing API
 * - Provides real database persistence
 *
 * @see /docs/useConfig-migration-plan.md for migration details
 * @see /docs/mock-useConfig-usage-analysis.md for affected files
 */

// Export everything from the tRPC implementation
export * from './useConfigTRPC';
