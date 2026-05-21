/**
 * Type Guards for Chapter Orchestrator
 * Runtime type checking utilities
 */

import type { ProviderMetadataRecord, RawProviderData, SourceData } from './types';

/**
 * Check if value is a plain object record
 * Complexity: 2
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely get a property from an unknown object
 * Complexity: 2
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

/**
 * Check if object is ProviderMetadataRecord
 * Complexity: 1
 */
export function isProviderMetadataRecord(obj: unknown): obj is ProviderMetadataRecord {
  return isRecord(obj);
}

/**
 * Check if object is RawProviderData
 * Complexity: 1
 */
export function isRawProviderData(obj: unknown): obj is RawProviderData {
  return isRecord(obj);
}

/**
 * Check if object is SourceData
 * Complexity: 1
 */
export function isSourceData(obj: unknown): obj is SourceData {
  return isRecord(obj);
}
