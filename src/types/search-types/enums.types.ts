/**
 * Search Types - Foundation Module
 *
 * Shared enums, error classes, and basic types used across all search-related modules.
 * This is the foundation layer that all other modules depend on.
 *
 * Extracted from: search.types.ts
 * Purpose: Reduce file size and improve maintainability
 */

// ============================================================================
// Prisma Imports
// ============================================================================

import {
  ProviderCapability,
  ProviderErrorType,
  ProviderType,
  SortCriteria,
  SortOrder,
  MangaProcessingStatus,
  ReleaseType,
  ReleaseScheduleType,
  DownloadMethod,
  DownloadHistoryStatus,
  MangaFormat
} from '@prisma/client';

import type {
  MangaPublicationStatus,
  NotificationEventType,
  Priority,
  MetadataProvider,
  ConfigScope,
  ContentRating,
  CalendarEvent,
  EventStatus,
  ReleaseSchedule
} from '@prisma/client';


// ============================================================================
// Re-exports from Other Modules
// ============================================================================

// Import ID type from common types
export type { ID } from '../common';

// Re-export Task-related types from task-validation module
export type { JobError } from '@/utils/job-validation';

// API Error types - imported from utils/error-handling
export type { ApiError } from '@/utils/error-handling';

// Re-export IntegrationSettings from config.types
export type { IntegrationSettings } from '../config.types';

// Re-export legacy types from provider-metadata
export type { LegacyProvider, LegacyMetadata, ProviderMigrationConfig } from '../provider-metadata';

// Re-export validation functions
export type { isValidReleaseIdentifier, isValidBlocklistReason } from '@/utils/type-guards-extended';

// ============================================================================
// Prisma Enum Re-exports
// ============================================================================

export {
  ProviderCapability,
  ProviderErrorType,
  MangaProcessingStatus,
  ReleaseType,
  ReleaseScheduleType,
  DownloadMethod,
  ProviderType,
  SortCriteria,
  SortOrder,
  DownloadHistoryStatus as DownloadStatus,
  MangaFormat
};

export type {
  MangaPublicationStatus,
  NotificationEventType,
  Priority,
  MetadataProvider,
  ConfigScope,
  ContentRating,
  CalendarEvent,
  EventStatus,
  ReleaseSchedule
};

// CalendarEventStatus is the same as EventStatus
export type { EventStatus as CalendarEventStatus } from '@prisma/client';

// ============================================================================
// Custom Enums
// ============================================================================

export enum DownloadClient {
  TRANSMISSION = 'TRANSMISSION',
  DELUGE = 'DELUGE',
  NZBGET = 'NZBGET',
  SABNZBD = 'SABNZBD'
}

export enum DownloadMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  BULK = 'BULK',
  PACK = 'PACK'
}

export enum DownloadPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// Error Classes
// ============================================================================

export class ProviderError extends Error {
  constructor(
    message: string,
    public type: ProviderErrorType,
    public provider: string,
    public details?: unknown
  ) {
    super(message);
    this["name"] = 'ProviderError';
  }
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this["name"] = 'IntegrationError';
  }
}

// ============================================================================
// Basic Interfaces
// ============================================================================

export interface ExternalLink {
  type: string;
  url: string;
  label?: string;
}
