/**
 * Metadata Utilities
 *
 * Foundation utilities module for metadata operations. This module provides:
 * - Helper functions for safe type-checking and property access
 * - TypeScript interfaces for metadata models
 * - Zod schemas for input validation
 *
 * This is the base module that other metadata modules depend on.
 */

import { z } from 'zod';

import { prisma } from '@/server/db';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access properties on unknown objects
 * @param obj - The object to access
 * @param key - The property key
 * @returns The property value or undefined
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Type guard for checking if a value is a Record object
 * @param value - The value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely get string properties from unknown objects
 * @param obj - The object to access
 * @param key - The property key
 * @returns The string value or undefined
 */
export function safeGetString(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely get number properties from unknown objects
 * @param obj - The object to access
 * @param key - The property key
 * @returns The number value or undefined
 */
export function safeGetNumber(obj: unknown, key: string): number | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : undefined;
}

/**
 * Type-safe wrapper for error handling
 * @param error - The error to handle
 * @returns A properly typed Error object
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * MetadataFieldPreference model interface
 */
export interface MetadataFieldPreference {
  id: number;
  fieldName: string;
  providerId: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MetadataConflict model interface
 */
export interface MetadataConflict {
  id: number;
  mangaId: number;
  fieldName: string;
  values: Record<string, unknown>;
  resolved: boolean;
  resolution?: string;
  resolutionProvider?: string;
  createdAt: Date;
  updatedAt: Date;
  manga?: {
    id: number;
    metadataId?: number | null;
  };
}

/**
 * Provider strength record type
 */
export interface ProviderStrengths {
  [provider: string]: {
    [field: string]: number;
  };
}

/**
 * Interface for PrismaClient with potential dynamic model access
 */
export interface ExtendedPrismaClient {
  // Standard Prisma models that we know exist
  manga: typeof prisma.manga;
  metadata: typeof prisma.metadata;
  // Optional models that might not exist in all schema versions
  metadataFieldPreference?: {
    findMany: (args: unknown) => Promise<MetadataFieldPreference[]>;
    findFirst: (args: unknown) => Promise<MetadataFieldPreference | null>;
    deleteMany: (args: unknown) => Promise<{
      count: number;
    }>;
    create: (args: unknown) => Promise<MetadataFieldPreference>;
  };
  metadataConflict?: {
    findMany: (args: unknown) => Promise<MetadataConflict[]>;
    findUnique: (args: unknown) => Promise<MetadataConflict | null>;
    update: (args: unknown) => Promise<MetadataConflict>;
  };
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Field preference input schema
 */
export const FieldPreferenceSchema = z.object({
  fieldName: z.string(),
  providerId: z.string(),
  priority: z.number().default(1)
});

/**
 * Update field preferences input schema
 */
export const UpdateFieldPreferencesSchema = z.object({
  preferences: z.array(FieldPreferenceSchema)
});

/**
 * Schema for resolving metadata conflicts
 */
export const ResolveConflictSchema = z.object({
  conflictId: z.number(),
  // Use a union type to represent common metadata value types
  resolutionValue: z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.date(),
  z.array(z.string()),
  z.array(z.object({ name: z.string() })),
  z.record(z.string()),
  z.null()]
  ),
  resolutionProvider: z.string()
});

/**
 * Schema for getting conflicts for a manga
 */
export const GetConflictsSchema = z.object({
  mangaId: z.number(),
  onlyUnresolved: z.boolean().default(true)
});
