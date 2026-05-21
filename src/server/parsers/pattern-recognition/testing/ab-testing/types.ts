/**
 * A/B Testing Framework - Type Definitions
 *
 * Shared type definitions and utility functions used across all A/B testing modules.
 *
 * Extracted from: ABTestingFramework.ts (lines 17-64)
 */

// ============================================================================
// Core Interfaces
// ============================================================================

export interface TestCase {
  id: string;
  html: string;
  url?: string;
  expectedResults?: unknown;
  tags: string[];
}

export interface TestResult {
  testId: string;
  variant: 'ml' | 'rule';
  success: boolean;
  accuracy: number;
  confidence: number;
  executionTime: number;
  extractedData: unknown;
  errors?: string[];
}

export interface ExperimentConfig {
  name: string;
  description: string;
  trafficSplit: number; // Percentage of traffic to ML variant (0-100)
  minSampleSize: number;
  confidenceLevel: number;
  metrics: string[];
  duration?: number; // Hours
}

export interface ExperimentResults {
  experimentId: string;
  config: ExperimentConfig;
  startTime: Date;
  endTime?: Date;
  variantA: VariantResults; // Rule-based
  variantB: VariantResults; // ML-based
  winner?: 'A' | 'B' | 'tie';
  statisticalSignificance?: number;
  recommendations: string[];
}

export interface VariantResults {
  name: string;
  samples: number;
  successRate: number;
  averageAccuracy: number;
  averageConfidence: number;
  averageExecutionTime: number;
  p95ExecutionTime: number;
  errors: number;
  metrics: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert unknown error to Error type
 * @param error - Unknown error value
 * @returns Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Type guard to check if value is a record object
 * @param value - Value to check
 * @returns True if value is a record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
