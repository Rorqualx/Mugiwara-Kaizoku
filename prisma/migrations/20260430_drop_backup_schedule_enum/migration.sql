-- BackupSchedule enum is no longer referenced by any model or column.
-- Settings.backupSchedule was already dropped by 20251128_backup_schema_fixes
-- and 20251128_remove_unused_backup_config. Backup configuration now flows
-- through the Config table via generalConfigService.getBackupSettings()
-- with a different shape ('daily' | 'weekly' | 'monthly' | 'never').
--
-- This drops the orphaned Postgres type. IF EXISTS makes the migration
-- idempotent for environments where it was manually dropped.
DROP TYPE IF EXISTS "BackupSchedule";
