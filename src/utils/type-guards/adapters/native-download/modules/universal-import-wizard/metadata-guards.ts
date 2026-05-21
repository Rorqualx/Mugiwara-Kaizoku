/**
 * Universal Import Wizard Metadata Guards Module
 *
 * Type guards and validation functions for Metadata, Provider, and related data structures.
 *
 * Extracted from: universal-import-wizard.ts
 */

import {
  isRecord,
  hasRequiredProperty,
  hasOptionalProperty,
  validateArray
} from "./utils";

// ============================================================================
// Type Definitions (Local to this module)
// ============================================================================

export interface Metadata {
  title: string;
  description?: string;
  synopsis?: string;
  summary?: string;
  author?: string;
  artist?: string;
  publisher?: string;
  status?: string;
  type?: string;
  genres?: string[];
  tags?: string[];
  year?: number;
  rating?: number;
  volumes?: number;
  chapters?: number;
  coverUrl?: string;
  coverImageUrl?: string;
  bannerUrl?: string;
  thumbnailUrl?: string;
  website?: string;
  externalLinks?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
  icon?: string;
  color?: string;
  enabled?: boolean;
  priority?: number;
  weight?: number;
  confidence?: number;
  strength?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderMetadata {
  provider: Provider;
  metadata: Metadata;
  confidence?: number;
  strength?: number;
  match?: Record<string, unknown>;
  score?: number;
  rank?: number;
  selected?: boolean;
  verified?: boolean;
  trusted?: boolean;
}

export interface ProviderConfidence {
  provider: Provider;
  confidence: number;
  reason?: string;
  factors?: string[];
  weight?: number;
}

export interface ProviderStrength {
  provider: Provider;
  strength: number;
  reason?: string;
  factors?: string[];
  weight?: number;
}

export interface ProviderMatch {
  provider: Provider;
  metadata: Metadata;
  confidence: number;
  strength: number;
  status?: string;
  type?: string;
  category?: string;
  score?: number;
  rank?: number;
  selected?: boolean;
  verified?: boolean;
  trusted?: boolean;
  fields?: Record<string, unknown>[];
}

export interface ProviderMatchResult {
  matches: ProviderMatch[];
  total: number;
  selected: number;
  confidence?: number;
  strength?: number;
  status?: string;
  type?: string;
  category?: string;
}

// ============================================================================
// Provider Type Guards
// ============================================================================

/**
 * Type guard for Provider object
 */
export function isProvider(value: unknown): value is Provider {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "id", "string")) return false;
  if (!hasRequiredProperty(value, "name", "string")) return false;
  if (!hasRequiredProperty(value, "type", "string")) return false;

  // Optional properties
  if (!hasOptionalProperty(value, "url", "string")) return false;
  if (!hasOptionalProperty(value, "description", "string")) return false;
  if (!hasOptionalProperty(value, "icon", "string")) return false;
  if (!hasOptionalProperty(value, "color", "string")) return false;
  if (!hasOptionalProperty(value, "enabled", "boolean")) return false;
  if (!hasOptionalProperty(value, "priority", "number")) return false;
  if (!hasOptionalProperty(value, "weight", "number")) return false;
  if (!hasOptionalProperty(value, "confidence", "number")) return false;
  if (!hasOptionalProperty(value, "strength", "number")) return false;
  if (!hasOptionalProperty(value, "metadata", "object")) return false;

  return true;
}

/**
 * Type guard for Provider array
 */
export function isProviderArray(value: unknown): value is Provider[] {
  return validateArray(value, isProvider);
}

// ============================================================================
// Provider Metadata Type Guards
// ============================================================================

/**
 * Type guard for ProviderMetadata object
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "provider", "object")) return false;
  if (!hasRequiredProperty(value, "metadata", "object")) return false;

  // Validate provider
  const provider = value["provider"];
  if (!isProvider(provider)) {
    return false;
  }

  // Validate metadata
  const metadata = value["metadata"];
  if (!isMetadata(metadata)) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "confidence", "number")) return false;
  if (!hasOptionalProperty(value, "strength", "number")) return false;
  if (!hasOptionalProperty(value, "match", "object")) return false;
  if (!hasOptionalProperty(value, "score", "number")) return false;
  if (!hasOptionalProperty(value, "rank", "number")) return false;
  if (!hasOptionalProperty(value, "selected", "boolean")) return false;
  if (!hasOptionalProperty(value, "verified", "boolean")) return false;
  if (!hasOptionalProperty(value, "trusted", "boolean")) return false;

  return true;
}

/**
 * Type guard for ProviderMetadata array
 */
export function isProviderMetadataArray(value: unknown): value is ProviderMetadata[] {
  return validateArray(value, isProviderMetadata);
}

// ============================================================================
// Provider Confidence and Strength Type Guards
// ============================================================================

/**
 * Type guard for ProviderConfidence object
 */
export function isProviderConfidence(value: unknown): value is ProviderConfidence {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "provider", "object")) return false;
  if (!hasRequiredProperty(value, "confidence", "number")) return false;

  // Validate provider
  const provider = value["provider"];
  if (!isProvider(provider)) {
    return false;
  }

  // Validate confidence value
  const confidence = value["confidence"];
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "reason", "string")) return false;
  if (!hasOptionalProperty(value, "factors", "array")) return false;
  if (!hasOptionalProperty(value, "weight", "number")) return false;

  return true;
}

/**
 * Type guard for ProviderStrength object
 */
export function isProviderStrength(value: unknown): value is ProviderStrength {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "provider", "object")) return false;
  if (!hasRequiredProperty(value, "strength", "number")) return false;

  // Validate provider
  const provider = value["provider"];
  if (!isProvider(provider)) {
    return false;
  }

  // Validate strength value
  const strength = value["strength"];
  if (typeof strength !== "number" || strength < 0 || strength > 1) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "reason", "string")) return false;
  if (!hasOptionalProperty(value, "factors", "array")) return false;
  if (!hasOptionalProperty(value, "weight", "number")) return false;

  return true;
}

// ============================================================================
// Provider Matching Type Guards
// ============================================================================

/**
 * Validate required properties for ProviderMatch
 */
function validateRequiredProperties(value: Record<string, unknown>): boolean {
  return (
    hasRequiredProperty(value, "provider", "object") &&
    hasRequiredProperty(value, "metadata", "object") &&
    hasRequiredProperty(value, "confidence", "number") &&
    hasRequiredProperty(value, "strength", "number")
  );
}

/**
 * Validate provider and metadata objects
 */
function validateCoreObjects(value: Record<string, unknown>): boolean {
  const provider = value["provider"];
  const metadata = value["metadata"];

  return isProvider(provider) && isMetadata(metadata);
}

/**
 * Validate confidence and strength values are valid numbers between 0 and 1
 */
function validateConfidenceAndStrength(value: Record<string, unknown>): boolean {
  const confidence = value["confidence"];
  const strength = value["strength"];

  return (
    typeof confidence === "number" && confidence >= 0 && confidence <= 1 &&
    typeof strength === "number" && strength >= 0 && strength <= 1
  );
}

/**
 * Validate optional properties for ProviderMatch
 */
function validateOptionalProperties(value: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(value, "status", "string") &&
    hasOptionalProperty(value, "type", "string") &&
    hasOptionalProperty(value, "category", "string") &&
    hasOptionalProperty(value, "score", "number") &&
    hasOptionalProperty(value, "rank", "number") &&
    hasOptionalProperty(value, "selected", "boolean") &&
    hasOptionalProperty(value, "verified", "boolean") &&
    hasOptionalProperty(value, "trusted", "boolean") &&
    hasOptionalProperty(value, "fields", "array")
  );
}

/**
 * Type guard for ProviderMatch object
 */
export function isProviderMatch(value: unknown): value is ProviderMatch {
  if (!isRecord(value)) {
    return false;
  }

  return (
    validateRequiredProperties(value) &&
    validateCoreObjects(value) &&
    validateConfidenceAndStrength(value) &&
    validateOptionalProperties(value)
  );
}

/**
 * Type guard for ProviderMatch array
 */
export function isProviderMatchArray(value: unknown): value is ProviderMatch[] {
  return validateArray(value, isProviderMatch);
}

/**
 * Type guard for ProviderMatchResult object
 */
export function isProviderMatchResult(value: unknown): value is ProviderMatchResult {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "matches", "array")) return false;
  if (!hasRequiredProperty(value, "total", "number")) return false;
  if (!hasRequiredProperty(value, "selected", "number")) return false;

  // Validate matches array
  const matches = value["matches"];
  if (!Array.isArray(matches) || !matches.every(isProviderMatch)) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "confidence", "number")) return false;
  if (!hasOptionalProperty(value, "strength", "number")) return false;
  if (!hasOptionalProperty(value, "status", "string")) return false;
  if (!hasOptionalProperty(value, "type", "string")) return false;
  if (!hasOptionalProperty(value, "category", "string")) return false;

  return true;
}

// ============================================================================
// Metadata Type Guards
// ============================================================================

/**
 * Validate required properties for Metadata object
 */
function validateRequiredMetadataProperties(value: Record<string, unknown>): boolean {
  return hasRequiredProperty(value, "title", "string");
}

/**
 * Validate text-based optional properties for Metadata object
 */
function validateTextMetadataProperties(value: Record<string, unknown>): boolean {
  const textProperties = [
    "description", "synopsis", "summary", "author", "artist",
    "publisher", "status", "type", "website"
  ];

  return textProperties.every(prop =>
    hasOptionalProperty(value, prop, "string")
  );
}

/**
 * Validate numeric optional properties for Metadata object
 */
function validateNumericMetadataProperties(value: Record<string, unknown>): boolean {
  const numericProperties = [
    "year", "rating", "volumes", "chapters"
  ];

  return numericProperties.every(prop =>
    hasOptionalProperty(value, prop, "number")
  );
}

/**
 * Validate array-based optional properties for Metadata object
 */
function validateArrayMetadataProperties(value: Record<string, unknown>): boolean {
  const arrayProperties = ["genres", "tags"];

  return arrayProperties.every(prop =>
    hasOptionalProperty(value, prop, "array")
  );
}

/**
 * Validate URL-based optional properties for Metadata object
 */
function validateUrlMetadataProperties(value: Record<string, unknown>): boolean {
  const urlProperties = [
    "coverUrl", "coverImageUrl", "bannerUrl", "thumbnailUrl"
  ];

  return urlProperties.every(prop =>
    hasOptionalProperty(value, prop, "string")
  );
}

/**
 * Validate object-based optional properties for Metadata object
 */
function validateObjectMetadataProperties(value: Record<string, unknown>): boolean {
  const objectProperties = ["externalLinks", "metadata"];

  return objectProperties.every(prop =>
    hasOptionalProperty(value, prop, "object")
  );
}

/**
 * Type guard for Metadata object
 */
export function isMetadata(value: unknown): value is Metadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    validateRequiredMetadataProperties(value) &&
    validateTextMetadataProperties(value) &&
    validateNumericMetadataProperties(value) &&
    validateArrayMetadataProperties(value) &&
    validateUrlMetadataProperties(value) &&
    validateObjectMetadataProperties(value)
  );
}
