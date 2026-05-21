/**
 * Backup System Constants
 *
 * Centralized constants for backup file validation, size limits,
 * and data retention policies.
 *
 * @module constants/backup
 */

// ============================================================================
// File Type Constants
// ============================================================================

/**
 * Accepted file types for backup uploads (comma-separated for HTML input)
 */
export const BACKUP_FILE_ACCEPT_TYPES = '.zip,.tar.gz,.gz,.kbak,.backup';

/**
 * Valid backup file extensions (array for validation logic)
 */
export const BACKUP_FILE_EXTENSIONS = ['.zip', '.tar.gz', '.gz', '.kbak', '.backup'] as const;

// ============================================================================
// Size Limits
// ============================================================================

/**
 * Maximum backup file size in megabytes
 */
export const MAX_BACKUP_SIZE_MB = 5000;

/**
 * Maximum backup file size in bytes
 */
export const MAX_BACKUP_SIZE_BYTES = MAX_BACKUP_SIZE_MB * 1024 * 1024;

// ============================================================================
// Field Length Limits
// ============================================================================

/**
 * Maximum length for backup name field
 */
export const MAX_BACKUP_NAME_LENGTH = 255;

/**
 * Maximum length for backup notes field
 */
export const MAX_BACKUP_NOTES_LENGTH = 1000;

/**
 * Maximum length for backup path field
 */
export const MAX_BACKUP_PATH_LENGTH = 500;

// ============================================================================
// Retention Policy
// ============================================================================

/**
 * Maximum retention period in days
 */
export const MAX_RETENTION_DAYS = 365;

/**
 * Maximum number of backups to keep
 */
export const MAX_BACKUP_COUNT = 100;
