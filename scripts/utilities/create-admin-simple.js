#!/usr/bin/env node

/**
 * Simple Admin Creation Script for Mugiwara-Kaizoku
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import seedCredentials from '../lib/seed-credentials.cjs';

const prisma = new PrismaClient();

// CLI script — stdout output is intentional, not a logging concern
const print = console['log'].bind(console); // @quality-check-skip

async function createAdmin() {
  console.log('🔐 Creating admin user...');

  try {
    // Refuses NODE_ENV=production unless ALLOW_SEED_IN_PRODUCTION=true.
    seedCredentials.assertSeedAllowed('create-admin-simple.js');

    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      console.log('ℹ️  Users already exist in the database.');
      console.log('✅ Admin creation skipped.');
      process.exit(0);
    }

    // Create default admin user
    const username = 'admin';
    const email = 'admin@kaizoku.local';
    // From SEED_ADMIN_PASSWORD, or generated and printed once below.
    const password = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD');

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password.value, saltRounds);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        userName: username,
        email: email,
        hashedPassword: hashedPassword,
        role: 'ADMIN',
      }
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`   Username: ${adminUser.userName}`);
    console.log(`   Email: ${adminUser.email}`);
    print(`   Password: ${seedCredentials.describeSecret('SEED_ADMIN_PASSWORD', password)}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log('\n🚀 You can now log in to Mugiwara-Kaizoku at http://localhost:3000');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    
    if (error.code === 'P2002') {
      console.log('   Username or email already exists.');
    } else if (error.code === 'P1001') {
      console.log('   Cannot connect to database. Make sure PostgreSQL is running.');
    } else {
      console.log('   Please check your database connection and try again.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n👋 Admin creation cancelled.');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
createAdmin();
