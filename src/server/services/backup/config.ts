import { z } from 'zod';

import { logger } from '@/utils/logger';
/**
 * Backup Service Configuration Schema
 *
 * Defines and validates required environment variables for backup operations.
 * Provides type-safe configuration access with proper defaults.
 *
 * ARCHITECTURE NOTE - Backup Configuration Pattern:
 *
 * Backup settings are stored in the general Config table via:
 * - generalConfigService.getBackupSettings()
 * - generalConfigService.updateBackupSettings()
 *
 * The BackupConfig Prisma model was removed (Nov 2025) as it was never used.
 * All backup configuration flows through the unified Config system.
 *
 * This module handles ENVIRONMENT-BASED configuration (paths, limits, etc.),
 * while the Config table handles USER-CONFIGURABLE settings (schedule, retention, etc.).
 */
// Define the backup configuration schema
const backupConfigSchema = z.object({
    // Database configuration
    DATABASE_URL: z.string().url().optional().describe('PostgreSQL connection URL'),
    // Backup paths
    BACKUP_DIR: z.string().default(process.cwd() + '/backups').describe('Directory for storing backups'),
    BACKUP_UPLOAD_DIR: z.string().default(process.cwd() + '/backups/uploads').describe('Directory for uploaded backups'),
    // Container detection
    IS_DOCKER: z.string().transform(val => val === 'true').default('false').describe('Running in Docker container'),
    // Backup limits
    BACKUP_MAX_SIZE_MB: z.string().transform(val => parseInt(val)).default('1000').describe('Maximum backup size in MB'),
    BACKUP_RETENTION_DAYS: z.string().transform(val => parseInt(val)).default('30').describe('Days to retain backups'),
    BACKUP_MAX_COUNT: z.string().transform(val => parseInt(val)).default('10').describe('Maximum number of backups to keep'),
    // Optional features
    BACKUP_COMPRESSION_LEVEL: z.string().transform(val => parseInt(val)).default('6').describe('Compression level (1-9)'),
});
// Type for the validated configuration
export type BackupConfig = z.infer<typeof backupConfigSchema>;
/**
 * Validates and returns backup service configuration
 *
 * @returns {BackupConfig} Validated configuration object
 * @throws {Error} If required environment variables are missing or invalid
 */
export function getBackupConfig(): BackupConfig {
    try {
        // Parse and validate environment variables
        const config = backupConfigSchema.parse(process.env);
        // Additional validation for Docker environments
        if (config.IS_DOCKER) {
            // In Docker, ensure paths use mounted volumes
            if (!config.BACKUP_DIR.startsWith('/')) {
                logger.info('Warning: BACKUP_DIR should use absolute path in Docker environment');
            }
            // Suggest volume mount paths
            if (config.BACKUP_DIR.startsWith(process.cwd())) {
                logger.info(`Warning: BACKUP_DIR is using process.cwd() which may not persist in containers. ` +
                    `Consider using a volume mount like /config/backups`);
            }
        }
        // Validate DATABASE_URL if database backups are expected
        if (!config.DATABASE_URL) {
            logger.info('Warning: DATABASE_URL not set. Database backups will not be available. ' +
                'Set DATABASE_URL environment variable to enable database backups.');
        }
        // Log configuration (without sensitive data)
        logger.info('Backup service configuration loaded', {
            backupDir: config.BACKUP_DIR,
            uploadDir: config.BACKUP_UPLOAD_DIR,
            isDocker: config.IS_DOCKER,
            maxSizeMB: config.BACKUP_MAX_SIZE_MB,
            retentionDays: config.BACKUP_RETENTION_DAYS,
            maxCount: config.BACKUP_MAX_COUNT,
            compressionLevel: config.BACKUP_COMPRESSION_LEVEL
        });
        return config;
    }
    catch (error: unknown) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            logger.error('Invalid backup configuration', { issues });
            throw new Error(`Backup configuration validation failed: ${issues}`);
        }
        throw error;
    }
}
/**
 * Gets a safe backup directory path based on environment
 *
 * @param {BackupConfig} config - Backup configuration
 * @param {string} subdir - Subdirectory within backup path
 * @returns {string} Safe backup directory path
 */
export function getSafeBackupPath(config: BackupConfig, subdir: string = ''): string {
    let basePath = config.BACKUP_DIR;
    // In Docker, prefer volume mounts
    if (config.IS_DOCKER && basePath.startsWith(process.cwd())) {
        basePath = '/config/backups';
        logger.info(`Using Docker-safe backup path: ${basePath}`);
    }
    return subdir ? `${basePath}/${subdir}` : basePath;
}
/**
 * Validates backup file size
 *
 * @param {number} sizeInBytes - File size in bytes
 * @param {BackupConfig} config - Backup configuration
 * @returns {boolean} True if size is within limits
 */
export function isValidBackupSize(sizeInBytes: number, config: BackupConfig): boolean {
    const maxSizeBytes = config.BACKUP_MAX_SIZE_MB * 1024 * 1024;
    return sizeInBytes <= maxSizeBytes;
}
/**
 * Gets database connection info from DATABASE_URL
 *
 * @param {BackupConfig} config - Backup configuration
 * @returns {Object|null} Database connection details or null
 */
export function getDatabaseConfig(config: BackupConfig): { host: string; port: string; database: string; username: string; password: string } | null {
    if (!config.DATABASE_URL) {
        return null;
    }
    try {
        const dbUrl = new URL(config.DATABASE_URL);
        return {
            host: dbUrl.hostname,
            port: dbUrl.port || '5432',
            database: dbUrl.pathname.substring(1),
            username: dbUrl.username,
            password: dbUrl.password
        };
    }
    catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Invalid DATABASE_URL format', errorMessage);
        return null;
    }
}
// Export a singleton instance
let configInstance: BackupConfig | null = null;
/**
 * Gets or creates the backup configuration singleton
 *
 * @returns {BackupConfig} Backup configuration
 */
export function getBackupConfigSingleton(): BackupConfig {
    configInstance ??= getBackupConfig();
    return configInstance;
}
