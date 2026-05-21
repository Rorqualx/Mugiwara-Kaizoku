/**
 * API Settings - Types and Constants Module
 *
 * Shared constants, type definitions used across all API settings modules.
 *
 * Extracted from: api.tsx (lines 63-83)
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Available permission resources for API keys
 */
export const PERMISSION_RESOURCES = [
  { value: 'manga', label: 'Manga' },
  { value: 'library', label: 'Library' },
  { value: 'download', label: 'Downloads' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'user', label: 'Users' },
  { value: 'webhook', label: 'Webhooks' },
  { value: 'system', label: 'System' }
] as const;

/**
 * Available webhook events for notifications
 */
export const WEBHOOK_EVENTS = [
  { value: 'manga.created', label: 'Manga Created' },
  { value: 'manga.updated', label: 'Manga Updated' },
  { value: 'manga.deleted', label: 'Manga Deleted' },
  { value: 'chapter.downloaded', label: 'Chapter Downloaded' },
  { value: 'chapter.failed', label: 'Chapter Download Failed' },
  { value: 'library.updated', label: 'Library Updated' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.failed', label: 'Task Failed' }
] as const;

// ============================================================================
// Type Definitions
// ============================================================================

export interface PermissionResource {
  value: string;
  label: string;
}

export interface WebhookEvent {
  value: string;
  label: string;
}

export interface ApiKeyFormValues {
  name: string;
  permissions: string[];
  expiresIn: string;
}

export interface WebhookFormValues {
  url: string;
  events: string[];
  secret: string;
}
