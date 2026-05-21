/**
 * Configuration Migrations Module
 *
 * Runs ongoing config-table migrations and env-variable seeders during server
 * initialization. The legacy Settings → Config one-shot migrations were removed
 * after the Settings table was dropped (see remove_legacy_settings migration);
 * what remains here all reads from / writes to the Config table directly.
 */
import { logger } from '@/utils/logger';

import { runDelugeCategoryToLabelMigration } from './delugeCategoryToLabelMigration';
import { seedFeatureFlagsFromEnv } from './env-seeders/feature-flag-env-seeder';
import { seedNotificationsFromEnv } from './env-seeders/notification-env-seeder';
import { seedProwlarrFromEnv } from './env-seeders/prowlarr-env-seeder';
import { runExperimentalFilterResetMigration } from './experimentalFilterResetMigration';
import { migrateMangadexNamespaceSplit } from './mangadexNamespaceSplitMigration';
import { migrateMetadataProvidersEnabled } from './metadataProvidersEnabledMigration';
import { migrateThemeConfig } from './themeMigration';
import { runTransmissionCredentialsCleanupMigration } from './transmissionCredentialsCleanupMigration';

import type { ConfigService } from './configService';
import type { PrismaClient } from '@prisma/client';
/**
 * Runs all configuration migrations in the correct order
 *
 * @param configService - The configuration service instance
 * @param prisma - The Prisma client instance
 * @returns Promise that resolves when all migrations are complete
 */
export async function runAllConfigMigrations(configService: ConfigService, prisma: PrismaClient): Promise<void> {
    try {
        logger.info('Starting configuration migrations...');
        await migrateThemeConfig(configService);
        // One-shot: reset experimental JP-filter Config rows so default-off takes effect
        await runExperimentalFilterResetMigration(configService, prisma);
        // Backfill per-provider {provider}.enabled keys
        await migrateMetadataProvidersEnabled(configService);
        // Move legacy `search.providers.MANGADEX.*` rows into the `mangadex.*` namespace
        // and seed the new `mangadex.download.enabled` toggle. Runs after the previous
        // migration so `mangadex.enabled` is already set when we read it.
        await migrateMangadexNamespaceSplit(configService, prisma);
        // One-shot: delete unused Transmission credential keys
        // (download.transmission.apiKey / .username — never read at runtime)
        await runTransmissionCredentialsCleanupMigration(configService, prisma);
        // One-shot: rename download.deluge.category → download.deluge.label
        // so the UI value finally reaches the runtime builder.
        await runDelugeCategoryToLabelMigration(configService, prisma);

        // --- Environment variable seeders (idempotent, seed once) ---
        await seedProwlarrFromEnv(configService);
        await seedNotificationsFromEnv(configService);
        await seedFeatureFlagsFromEnv(configService);
        logger.info('All configuration migrations completed successfully');
    }
    catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Configuration migrations failed: ${errorMessage}`);
        throw error;
    }
}
