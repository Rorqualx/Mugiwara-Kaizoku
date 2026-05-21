/**
 * Downloads Router Utilities
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all downloads router modules.
 *
 * Extracted from: downloads.ts
 */

import { z } from 'zod';

import type { DelugeClient } from '@/server/services/download/clients/delugeClient';
import type { NzbgetClient } from '@/server/services/download/clients/nzbgetClient';
import type { SabnzbdClient } from '@/server/services/download/clients/sabnzbdClient';
import type { TransmissionClient } from '@/server/services/download/clients/transmission';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Union type for all supported download clients
 */
export type DownloadClient =
  | TransmissionClient
  | DelugeClient
  | NzbgetClient
  | SabnzbdClient;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if a value is a Record (object)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if an object has a specific method
 */
export function hasMethod(
  obj: unknown,
  methodName: string
): obj is Record<string, unknown> {
  return (
    isRecord(obj) && methodName in obj && typeof obj[methodName] === 'function'
  );
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Download client configuration schema
 */
export const downloadClientConfigSchema = z.object({
  type: z.enum(['transmission', 'deluge', 'nzbget', 'sabnzbd']),
  host: z.string(),
  port: z.number(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
  path: z.string().optional(),
});

/**
 * Download request schema
 */
export const downloadRequestSchema = z.object({
  mangaId: z.number(),
  chapterId: z.number().optional(),
  volumeId: z.number().optional(),
  url: z.string().url(),
  filename: z.string(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  method: z.enum(['DIRECT', 'TORRENT', 'NZB']).optional(),
});

/**
 * Queue filter schema
 */
export const queueFilterSchema = z.object({
  status: z
    .enum(['PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'PAUSED'])
    .optional(),
  mangaId: z.number().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

/**
 * Configuration for a download client
 */
export type DownloadClientConfig = z.infer<typeof downloadClientConfigSchema>;

/**
 * Request to add a download to the queue
 */
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

/**
 * Filter options for querying the download queue
 */
export type QueueFilter = z.infer<typeof queueFilterSchema>;
