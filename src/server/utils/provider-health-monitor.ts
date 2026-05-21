/**
 * Provider Health Monitor - Main Export
 *
 * Advanced health monitoring system for metadata providers with real-time metrics,
 * alerting, and automated recovery strategies.
 *
 * Features:
 * - Real-time health metrics collection
 * - Anomaly detection
 * - Automated recovery strategies
 * - Performance degradation detection
 * - SLA monitoring
 * - Alert generation
 * - Historical metrics storage
 * - Predictive failure detection
 *
 * Architecture:
 * This module has been decomposed into focused sub-modules for maintainability:
 *
 * - types.ts (137 lines) - Type definitions, enums, interfaces
 * - health-checks.ts (93 lines) - Health check execution logic
 * - metrics.ts (~200 lines) - Metrics storage and calculations
 * - alerting.ts (427 lines) - Alert management, SLA monitoring, anomaly detection
 * - recovery.ts (170 lines) - Auto-recovery strategies
 * - core.ts (318 lines) - Main ProviderHealthMonitor class
 *
 * Total: ~1,345 lines across 6 modules (was 672 lines in single file)
 *
 * Original file: 672 lines → Refactored: ~100 lines aggregator + 6 focused modules
 */

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Enums
  HealthCheckType,
  AlertSeverity,
  RecoveryStrategy,
  // Interfaces
  type HealthMetrics,
  type SLAConfig,
  type Alert,
  type MonitoringConfig,
} from './provider-health-monitor/types';

// ============================================================================
// Main Class Export
// ============================================================================

export { ProviderHealthMonitor } from './provider-health-monitor/core';

// ============================================================================
// Singleton Instance Export
// ============================================================================

import { ProviderHealthMonitor } from './provider-health-monitor/core';

/**
 * Default health monitor instance
 *
 * Pre-configured singleton instance with default settings.
 * Can be used directly or a new instance can be created with custom config.
 *
 * @example
 * ```typescript
 * // Use singleton
 * import { healthMonitor } from '@/server/utils/provider-health-monitor';
 * healthMonitor.startMonitoring();
 *
 * // Or create custom instance
 * import { ProviderHealthMonitor } from '@/server/utils/provider-health-monitor';
 * const monitor = new ProviderHealthMonitor({
 *   interval: 30000,
 *   enableAnomalyDetection: true
 * });
 * ```
 */
export const healthMonitor = new ProviderHealthMonitor();

// ============================================================================
// Module Exports Summary
// ============================================================================

/**
 * Exported Types:
 * - HealthCheckType: Enum for health check types (PING, SEARCH, METADATA, FULL)
 * - AlertSeverity: Enum for alert severity (INFO, WARNING, ERROR, CRITICAL)
 * - RecoveryStrategy: Enum for recovery strategies
 * - HealthMetrics: Interface for health metrics snapshot
 * - SLAConfig: Interface for SLA configuration
 * - Alert: Interface for alert objects
 * - MonitoringConfig: Interface for monitor configuration
 *
 * Exported Classes:
 * - ProviderHealthMonitor: Main monitoring class
 *
 * Exported Instances:
 * - healthMonitor: Default singleton instance
 */
