/**
 * Provider Health Monitor - Type Definitions
 *
 * Shared enums, interfaces, and type definitions for the
 * provider health monitoring system.
 *
 * Components:
 * - Health check types and severity levels
 * - Recovery strategy enums
 * - Core metrics and configuration interfaces
 * - Alert and SLA tracking types
 *
 * Extracted from: provider-health-monitor.ts (lines 1-128)
 */

import { ProviderStatus } from '@prisma/client';

// ============================================================================
// Health Check Enums
// ============================================================================

/**
 * Types of health checks that can be performed
 */
export enum HealthCheckType {
  PING = 'ping',
  SEARCH = 'search',
  METADATA = 'metadata',
  FULL = 'full'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Auto-recovery strategies
 */
export enum RecoveryStrategy {
  NONE = 'none',
  RESTART = 'restart',
  THROTTLE = 'throttle',
  CIRCUIT_BREAK = 'circuit_break',
  FALLBACK = 'fallback',
  DISABLE = 'disable'
}

// ============================================================================
// Core Metrics Interfaces
// ============================================================================

/**
 * Health metrics snapshot for a provider
 */
export interface HealthMetrics {
  timestamp: number;
  providerId: string;
  status: ProviderStatus;
  responseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
  cpu?: number;
  memory?: number;
  networkLatency?: number;
  queueSize?: number;
}

// ============================================================================
// SLA & Configuration Interfaces
// ============================================================================

/**
 * SLA configuration for provider monitoring
 */
export interface SLAConfig {
  targetAvailability: number; // e.g., 0.999 for 99.9%
  maxResponseTime: number; // milliseconds
  maxErrorRate: number; // e.g., 0.01 for 1%
  evaluationWindow: number; // milliseconds
}

/**
 * Alert object for tracking provider issues
 */
export interface Alert {
  id: string;
  timestamp: number;
  providerId: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
}

/**
 * Monitoring system configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // milliseconds
  healthCheckType: HealthCheckType;
  enableAnomalyDetection: boolean;
  enablePredictiveAnalysis: boolean;
  enableAutoRecovery: boolean;
  sla?: SLAConfig;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    availability: number;
    consecutiveFailures: number;
  };
  recoveryStrategies: {
    DEGRADED: RecoveryStrategy;
    UNHEALTHY: RecoveryStrategy;
  };
  metricsRetention: number; // milliseconds
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Time series data point for trend analysis
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}
