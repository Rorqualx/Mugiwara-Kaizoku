/**
 * Rollback Script: Provider Metadata
 *
 * Rolls back the provider metadata migration by copying data from
 * providerMetadata back to monitoringConfig format.
 *
 * This script is a safety mechanism if issues occur with the new format.
 *
 * Usage: npm run rollback:provider-metadata
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProviderBindingNew {
  providerId: string;
  boundAt: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

interface ProviderBindingOld {
  providerId?: string;
  id?: string;
  boundAt?: string;
  metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

async function rollbackProviderMetadata() {
  console.log('🔄 Starting provider metadata rollback...');
  console.log('📋 This rollback restores data from providerMetadata to monitoringConfig');
  console.log('⚠️  WARNING: This will overwrite existing monitoringConfig data!');
  console.log('');

  // Safety check - ask for confirmation in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🛑 Running in PRODUCTION mode!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Find manga with new providerMetadata data
    const allManga = await prisma.manga.findMany({
      where: {
        providerMetadata: { not: null }
      },
      select: {
        id: true,
        title: true,
        monitoringConfig: true,
        providerMetadata: true
      }
    });

    console.log(`📊 Found ${allManga.length} manga with providerMetadata data`);

    if (allManga.length === 0) {
      console.log('✅ No manga to rollback - all done!');
      return { rolledBack: 0, skipped: 0, errors: 0 };
    }

    console.log('');

    let rolledBack = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ id: number; title: string; error: string }> = [];

    for (const manga of allManga) {
      try {
        const providerMetadata = manga.providerMetadata as Record<string, unknown> | null;

        if (!providerMetadata || typeof providerMetadata !== 'object') {
          skipped++;
          continue;
        }

        // Get existing monitoringConfig or create new object
        const existingMonitoringConfig = manga.monitoringConfig as Record<string, unknown> | null;
        const monitoringConfig: Record<string, unknown> = {
          ...(existingMonitoringConfig || {})
        };

        // Convert provider metadata back to old format
        const providers = ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex'];
        let foundProviderData = false;

        for (const provider of providers) {
          const providerData = providerMetadata[provider] as ProviderBindingNew | undefined;

          if (providerData && typeof providerData === 'object' && providerData.providerId) {
            // Convert to old format
            monitoringConfig[provider] = {
              providerId: providerData.providerId,
              id: providerData.providerId, // Duplicate for compatibility
              boundAt: providerData.boundAt,
              ...(providerData.metadata && { metadata: providerData.metadata }),
              ...(providerData.fetchedAt && { fetchedAt: providerData.fetchedAt })
            } as ProviderBindingOld;

            foundProviderData = true;
          }
        }

        // Skip if no provider data found
        if (!foundProviderData) {
          skipped++;
          continue;
        }

        // Update manga with rolled back data
        await prisma.manga.update({
          where: { id: manga.id },
          data: {
            monitoringConfig: monitoringConfig
            // Keep providerMetadata for safety - can be manually removed later if needed
          }
        });

        rolledBack++;

        // Progress update every 10 manga
        if (rolledBack % 10 === 0) {
          console.log(`  ✓ Rolled back ${rolledBack} manga...`);
        }

        // Show first few rollbacks in detail
        if (rolledBack <= 3) {
          console.log(`  ✓ Rolled back "${manga.title}" (ID: ${manga.id})`);
          const providerList = Object.keys(monitoringConfig).filter(key =>
            providers.includes(key)
          );
          console.log(`    Providers: ${providerList.join(', ')}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Error rolling back manga ${manga.id} (${manga.title}):`, errorMessage);
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
    console.log('✅ Rollback complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`  📈 Statistics:`);
    console.log(`    • Rolled back: ${rolledBack} manga`);
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

    if (rolledBack > 0) {
      console.log('✅ Provider metadata has been rolled back successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('  1. Test the application to ensure provider bindings work');
      console.log('  2. Check a few manga entries in the database');
      console.log('  3. If everything works, the rollback was successful');
      console.log('  4. To re-migrate, run: npm run migrate:provider-metadata');
      console.log('');
      console.log('💡 Note: providerMetadata field was kept for safety.');
      console.log('   You can manually remove it later if the rollback is permanent.');
    }

    return { rolledBack, skipped, errors };

  } catch (error) {
    console.error('❌ Fatal error during rollback:', error);
    throw error;
  }
}

// Execute rollback
rollbackProviderMetadata()
  .then(({ rolledBack, skipped, errors }) => {
    if (errors > 0) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
