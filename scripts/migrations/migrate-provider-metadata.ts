/**
 * Migration Script: Provider Metadata
 *
 * Migrates provider binding data from the old monitoringConfig field
 * to the new providerMetadata field.
 *
 * This is a non-destructive migration - it keeps the old data for rollback safety.
 *
 * Usage: npm run migrate:provider-metadata
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProviderBindingOld {
  providerId?: string;
  id?: string;
  boundAt?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

interface ProviderBindingNew {
  providerId: string;
  boundAt: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

async function migrateProviderMetadata() {
  console.log('🔄 Starting provider metadata migration...');
  console.log('📋 This migration moves data from monitoringConfig to providerMetadata');
  console.log('');

  try {
    // Find manga with old monitoringConfig data
    const allManga = await prisma.manga.findMany({
      where: {
        monitoringConfig: { not: null }
      },
      select: {
        id: true,
        title: true,
        monitoringConfig: true,
        providerMetadata: true
      }
    });

    console.log(`📊 Found ${allManga.length} manga with monitoringConfig data`);

    if (allManga.length === 0) {
      console.log('✅ No manga to migrate - all done!');
      return { migrated: 0, skipped: 0, errors: 0 };
    }

    console.log('');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ id: number; title: string; error: string }> = [];

    for (const manga of allManga) {
      try {
        const config = manga.monitoringConfig as Record<string, unknown> | null;

        if (!config || typeof config !== 'object') {
          skipped++;
          continue;
        }

        // Check if already has providerMetadata
        const existingProviderMetadata = manga.providerMetadata as Record<string, unknown> | null;

        // Extract provider bindings
        const providerMetadata: Record<string, ProviderBindingNew> = {};

        // Check for provider data in monitoringConfig
        const providers = ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex'];
        let foundProviderData = false;

        for (const provider of providers) {
          const providerData = config[provider] as ProviderBindingOld | undefined;

          if (providerData && typeof providerData === 'object') {
            const providerId = providerData.providerId || providerData.id;

            if (providerId && typeof providerId === 'string') {
              providerMetadata[provider] = {
                providerId,
                boundAt: providerData.boundAt || new Date().toISOString(),
                ...(providerData.metadata && { metadata: providerData.metadata }),
                ...(providerData.fetchedAt && { fetchedAt: providerData.fetchedAt })
              };
              foundProviderData = true;
            }
          }
        }

        // Skip if no provider data found
        if (!foundProviderData) {
          skipped++;
          continue;
        }

        // Merge with existing providerMetadata if present
        const finalProviderMetadata = {
          ...(existingProviderMetadata || {}),
          ...providerMetadata
        };

        // Update manga
        await prisma.manga.update({
          where: { id: manga.id },
          data: {
            providerMetadata: finalProviderMetadata
            // Keep old monitoringConfig for rollback safety
          }
        });

        migrated++;

        // Progress update every 10 manga
        if (migrated % 10 === 0) {
          console.log(`  ✓ Migrated ${migrated} manga...`);
        }

        // Show first few migrations in detail
        if (migrated <= 3) {
          console.log(`  ✓ Migrated "${manga.title}" (ID: ${manga.id})`);
          console.log(`    Providers: ${Object.keys(providerMetadata).join(', ')}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Error migrating manga ${manga.id} (${manga.title}):`, errorMessage);
        errors++;
        errorDetails.push({
          id: manga.id,
          title: manga.title,
          error: errorMessage
        });
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ Migration complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`  📈 Statistics:`);
    console.log(`    • Migrated: ${migrated} manga`);
    console.log(`    • Skipped: ${skipped} manga (no provider data)`);
    console.log(`    • Errors: ${errors} manga`);
    console.log('');

    if (errors > 0) {
      console.log('❌ Errors encountered:');
      errorDetails.forEach(({ id, title, error }) => {
        console.log(`  • Manga ${id} (${title}): ${error}`);
      });
      console.log('');
    }

    if (migrated > 0) {
      console.log('✅ Provider metadata has been migrated successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('  1. Verify the migration by checking a few manga entries');
      console.log('  2. Test the provider binding functionality');
      console.log('  3. If everything works, you can optionally clean up monitoringConfig');
      console.log('  4. If issues occur, run: npm run rollback:provider-metadata');
    }

    return { migrated, skipped, errors };

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// Execute migration
migrateProviderMetadata()
  .then(({ migrated, skipped, errors }) => {
    if (errors > 0) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
