/**
 * HTTP Client Factory
 *
 * This module has been refactored into modular components for better maintainability.
 * All exports are re-exported from the http-client directory for backward compatibility.
 *
 * New Structure:
 * - http-client/types.ts - Type definitions and interfaces
 * - http-client/auth.ts - Authentication manager
 * - http-client/utils.ts - Response utilities
 * - http-client/axios-client.ts - Axios implementation
 * - http-client/index.ts - Main aggregator
 *
 * @see ./http-client/index.ts for the modular implementation
 */

// Re-export everything from the new modular structure
export * from './http-client';
