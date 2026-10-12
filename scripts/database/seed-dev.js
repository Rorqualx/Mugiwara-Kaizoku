// =============================================================================
// DEVELOPMENT DATABASE SEED SCRIPT
// =============================================================================
// Seeds the development database with initial data after recreation
// This script is automatically run by the reset-dev.sh script
// =============================================================================

import bcrypt from 'bcryptjs';

import seedCredentials from '../lib/seed-credentials.cjs';
import { createSeedPrisma, newUserFields } from '../lib/seed-prisma.mjs';

const ADMIN_EMAIL = 'admin@kaizoku.dev';
const ADMIN_USERNAME = 'admin';
const ADMIN_WHERE = { OR: [{ email: ADMIN_EMAIL }, { userName: ADMIN_USERNAME }] };

// CLI seed script — stdout output is intentional, not a logging concern
const print = console['log'].bind(console); // @quality-check-skip

async function seedDevelopmentData() {
  // Development data only: refuses NODE_ENV=production without an override.
  seedCredentials.assertSeedAllowed('seed-dev.js');

  const { prisma, close } = createSeedPrisma();

  print('🌱 Seeding development database...');

  // The admin password comes from SEED_ADMIN_PASSWORD, or is generated and
  // printed once below. There is no built-in default password.
  const adminPassword = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD');
  let adminCreated = false;

  try {
    // Create default admin user
    const hashedPassword = await bcrypt.hash(adminPassword.value, 12);

    try {
      // Check if admin user already exists by email or username
      const existingUser = await prisma.user.findFirst({ where: ADMIN_WHERE });

      if (existingUser) {
        print('✅ Admin user already exists:', existingUser.email);
      } else {
        const userFields = newUserFields();
        const adminUser = await prisma.user.create({
          data: {
            ...userFields,
            id: 'admin-user-001', // Explicit ID for admin user
            userName: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            name: 'Admin User',
            hashedPassword,
            role: 'ADMIN',
            emailVerified: userFields.updatedAt,
          },
        });
        adminCreated = true;
        print('✅ Created admin user:', adminUser.email);
      }
    } catch (userError) {
      if (userError.code === 'P2002') {
        // Unique constraint error - user already exists
        print('✅ Admin user already exists (skipping creation)');
      } else {
        // Re-throw if it's a different error
        throw userError;
      }
    }

    // Note: Settings model has been removed from schema
    // Settings are now managed via Config table or environment variables
    print('ℹ️  Skipping settings creation (use Config table instead)');

    // Create queue configurations for the new high-performance queue system
    const queueConfigs = [
      {
        queue_name: 'default',
        is_active: true,
        max_concurrent_jobs: 10,
        rate_limit_per_second: 100,
        default_priority: 50,
        default_max_attempts: 3,
        default_retry_delay_seconds: 60,
      },
      {
        queue_name: 'metadata',
        is_active: true,
        max_concurrent_jobs: 5,
        rate_limit_per_second: 50,
        default_priority: 30,
        default_max_attempts: 3,
        default_retry_delay_seconds: 120,
      },
      {
        queue_name: 'chapters',
        is_active: true,
        max_concurrent_jobs: 3,
        rate_limit_per_second: 20,
        default_priority: 20,
        default_max_attempts: 5,
        default_retry_delay_seconds: 300,
      },
      {
        queue_name: 'library',
        is_active: true,
        max_concurrent_jobs: 1,
        rate_limit_per_second: 10,
        default_priority: 10,
        default_max_attempts: 2,
        default_retry_delay_seconds: 600,
      },
    ];

    for (const config of queueConfigs) {
      await prisma.queue_config.upsert({
        where: { queue_name: config.queue_name },
        update: {},
        create: config,
      });
    }

    print('✅ Created default queue configurations');

    // Create sample library for development. A library belongs to a user
    // (Library.ownerId is required), so it is owned by the admin account.
    const libraryOwner = await prisma.user.findFirst({
      where: ADMIN_WHERE,
      select: { id: true },
    });
    if (!libraryOwner) {
      throw new Error('Admin user is missing after the admin step; cannot own the development library.');
    }

    const existingLibrary = await prisma.library.findFirst({
      where: { name: 'Development Library' },
    });

    if (existingLibrary) {
      print('✅ Development library already exists');
    } else {
      // No explicit id: writing one would leave the Library id sequence
      // behind it, and the next library created in the app would collide.
      await prisma.library.create({
        data: {
          name: 'Development Library',
          path: '/tmp/manga-dev',
          ownerId: libraryOwner.id,
        },
      });
      print('✅ Created development library');
    }

    // Note: Config model has been removed from schema
    // Configuration is now managed via environment variables or queue_config
    print('ℹ️  Skipping config entries (use environment variables instead)');

    print('🎉 Development database seeding complete!');
    print('');
    if (adminCreated) {
      print('🔑 Admin Credentials:');
      print(`   Email: ${ADMIN_EMAIL}`);
      print('   Password:', seedCredentials.describeSecret('SEED_ADMIN_PASSWORD', adminPassword));
      print('');
    } else {
      print('🔑 Admin user was already present; its password was not changed.');
      print('');
    }
    print('💡 You can create additional users with: npm run create-admin');

  } catch (error) {
    // Check if it's just a unique constraint error for expected data
    if (error.code === 'P2002') {
      print('⚠️  Some seed data already exists (skipping duplicates)');
      // Don't throw for expected unique constraint errors
    } else {
      console.error('❌ Error seeding database:', error);
      throw error;
    }
  } finally {
    await close();
  }
}

// Run the seed function
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDevelopmentData()
    .catch((error) => {
      // Don't exit with error code for unique constraint errors
      if (error.code === 'P2002') {
        print('✅ Seed script completed (some data already existed)');
        process.exit(0);
      } else {
        console.error(error);
        process.exit(1);
      }
    });
}

export default seedDevelopmentData;
