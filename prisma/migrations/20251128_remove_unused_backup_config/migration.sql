-- Remove Unused BackupConfig Model
-- This model was never used in the application. All backup configuration
-- is stored in the Config table via generalConfigService.getBackupSettings()

-- ============================================================================
-- Drop Unused Table and Enum
-- ============================================================================

-- Drop the backup_config table if it exists
DROP TABLE IF EXISTS "backup_config" CASCADE;

-- Note: BackupSchedule enum is kept as it's still used in:
-- 1. Legacy migration code (backupMigration.ts)
-- 2. Default values in components during transition
-- The enum will be removed in a future migration once all migrations are complete
