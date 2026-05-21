/**
 * Provider Registry Module
 *
 * Centralized registry for managing metadata providers with plugin-like architecture.
 * Provides discovery, registration, health monitoring, and lifecycle management for
 * all metadata providers in the system.
 *
 * Architecture:
 * - provider-registry/types.ts - Type definitions (6 exports: 1 enum, 5 interfaces/types)
 * - provider-registry/provider-wrapper.ts - ProviderWrapper class with health monitoring
 * - provider-registry/load-balancer.ts - LoadBalancer class with multiple strategies
 * - provider-registry/registry.ts - Main ProviderRegistry class + singleton instance
 *
 * Module Breakdown:
 * - types.ts (~112 lines) - Foundation type definitions
 * - provider-wrapper.ts (~308 lines) - Provider wrapper with circuit breaking
 * - load-balancer.ts (~88 lines) - Load balancing strategies
 * - registry.ts (~319 lines) - Main registry implementation
 *
 * Total: ~827 lines across 4 focused modules (vs 709 lines in original monolithic file)
 *
 * ESLint Fixes Applied:
 * - Line 348: no-promise-executor-return (ProviderWrapper.withTimeout)
 * - Lines 660-661: no-case-declarations (LoadBalancer.selectProvider)
 * - Line 621: no-await-in-loop (ProviderRegistry.executeWithFallback)
 *
 * Original file: src/server/utils/provider-registry.ts (709 lines)
 * Refactored: 2025-11-20
 * Backup: src/server/utils/provider-registry.ts.backup
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  ProviderCapabilities,
  ProviderHealth,
  ProviderConfig,
  MetadataProviderInterface,
  ProviderMiddleware
} from './provider-registry/types';

export { ProviderStatus } from './provider-registry/types';

// ============================================================================
// Class Exports
// ============================================================================

export { ProviderWrapper } from './provider-registry/provider-wrapper';
export { LoadBalancer } from './provider-registry/load-balancer';
export { ProviderRegistry, providerRegistry } from './provider-registry/registry';
