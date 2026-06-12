-- RemoveLegacySettings
--
-- Drops the legacy Settings table after all settings were migrated to the
-- Config-based system. Historically lived as an untimestamped directory
-- ("remove_legacy_settings") that sorted last lexicographically; renamed
-- 2026-06-12 to this timestamp to keep the identical last-in-chain position
-- while making the folder sortable. SQL made idempotent at the same time so
-- DBs that already applied it under the old name can safely re-run it.

-- Drop the Settings table
DROP TABLE IF EXISTS "Settings";

-- Remove any references to the Settings table in _prisma_migrations
-- (matches nothing on current histories; kept for parity with the original)
DELETE FROM _prisma_migrations WHERE migration_name LIKE '%create_settings%';
