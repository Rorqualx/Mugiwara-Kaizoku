-- RemoveLegacySettings
--
-- This migration removes the legacy Settings table after all settings have been
-- migrated to the new configuration system. Only run this after verifying that
-- the migration was successful using the verify-config-migration.js script.
--
-- IMPORTANT: Make a database backup before running this migration!

-- Drop the Settings table
DROP TABLE "Settings";

-- Remove any references to the Settings table in _prisma_migrations
DELETE FROM _prisma_migrations WHERE migration_name LIKE '%create_settings%';