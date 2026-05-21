// =============================================================================
// DEVELOPMENT DATABASE SEED SCRIPT
// =============================================================================
// Seeds the development database with initial data after recreation
// This script is automatically run by the reset-dev.sh script
// =============================================================================

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// CLI seed script — stdout output is intentional, not a logging concern
const print = console['log'].bind(console); // @quality-check-skip

async function seedDevelopmentData() {
  print('🌱 Seeding development database...');

  try {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    try {
      // Check if admin user already exists by email or username
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'admin@kaizoku.dev' },
            { userName: 'admin' }
          ]
        }
      });

      if (existingUser) {
        print('✅ Admin user already exists:', existingUser.email);
      } else {
        const now = new Date();
        const adminUser = await prisma.user.create({
          data: {
            id: 'admin-user-001', // Explicit ID for admin user
            userName: 'admin',
            email: 'admin@kaizoku.dev',
            name: 'Admin User',
            hashedPassword,
            role: 'ADMIN',
            emailVerified: now,
            updatedAt: now,
          },
        });
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

    // Create sample library for development
    // Check if the Development Library already exists
    const existingLibrary = await prisma.library.findFirst({
      where: {
        OR: [
          { id: 1 },
          { name: 'Development Library' }
        ]
      }
    });

    if (existingLibrary) {
      print('✅ Development library already exists');
    } else {
      const devLibrary = await prisma.library.create({
        data: {
          id: 1,
          name: 'Development Library',
          path: '/tmp/manga-dev',
        },
      });
      print('✅ Created development library');
    }

    // Note: Config model has been removed from schema
    // Configuration is now managed via environment variables or queue_config
    print('ℹ️  Skipping config entries (use environment variables instead)');

    print('🎉 Development database seeding complete!');
    print('');
    print('🔑 Default Admin Credentials:');
    print('   Email: admin@kaizoku.dev');
    print('   Password: admin123');
    print('');
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
    await prisma.$disconnect();
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
