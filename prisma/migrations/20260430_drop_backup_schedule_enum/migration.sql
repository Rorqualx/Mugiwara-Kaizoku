-- BackupSchedule enum is no longer referenced by any model or column.
-- Settings.backupSchedule was already dropped by 20251128_backup_schema_fixes
-- and 20251128_remove_unused_backup_config. Backup configuration now flows
-- through the Config table via generalConfigService.getBackupSettings()
-- with a different shape ('daily' | 'weekly' | 'monthly' | 'never').
--
-- This drops the orphaned Postgres type. IF EXISTS makes the migration
-- idempotent for environments where it was manually dropped.
--
-- On fresh installs the legacy Settings table is created by the early
-- 20241218 migration with a `backupSchedule` column that still references
-- this type (the column-drop migrations target a row that hasn't been
-- created yet in early init, but the column survives). Drop the column
-- explicitly here before dropping the type so the dependency check passes.
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "backupSchedule";
DROP TYPE IF EXISTS "BackupSchedule";
