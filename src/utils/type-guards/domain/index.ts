/**
 * Domain Type Guards
 *
 * Type guards for core business domain types
 */

// Unified domain guards (preferred for new code)
export * from './unified-domain-guards';

// Individual domain guards (for specific use cases)
// Note: These are re-exported by unified-domain-guards, so we don't export them directly here
// to avoid duplicate export errors