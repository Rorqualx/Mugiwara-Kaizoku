/**
 * Notification Event Options
 *
 * Common event options for notification configuration
 *
 * @module components/settings/notification/event-options
 */

/**
 * Available notification event options
 */
export const EVENT_OPTIONS = [
  { value: 'manga_added', label: 'Manga Added' },
  { value: 'manga_updated', label: 'Manga Updated' },
  { value: 'chapter_downloaded', label: 'Chapter Downloaded' },
  { value: 'download_failed', label: 'Download Failed' },
  { value: 'task_failed', label: 'Task Failed' },
  { value: 'sync_completed', label: 'Sync Completed' },
  { value: 'backup_completed', label: 'Backup Completed' },
  { value: 'update_available', label: 'Update Available' },
] as const;
