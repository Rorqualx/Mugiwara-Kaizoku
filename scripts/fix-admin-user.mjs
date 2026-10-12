#!/usr/bin/env node

/**
 * Script to fix admin user - set password or create new admin
 *
 * The password comes from SEED_ADMIN_PASSWORD, or a random one is generated
 * and printed once. Refuses to run with NODE_ENV=production unless
 * ALLOW_SEED_IN_PRODUCTION=true.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import seedCredentials from './lib/seed-credentials.cjs';

const prisma = new PrismaClient();

async function fixAdminUser() {
  try {
    seedCredentials.assertSeedAllowed('fix-admin-user.mjs');

    console.log('🔧 Fixing admin user...\n');

    const adminPassword = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD');
    const hashedPassword = await bcrypt.hash(adminPassword.value, 12);
    const changedAccounts = [];

    // First, try to fix the existing admin@kaizoku.local user
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@kaizoku.local' }
    });

    if (existingAdmin) {
      console.log('📧 Found existing admin: admin@kaizoku.local');

      // Update the user with password
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          hashedPassword: hashedPassword,
          name: 'Admin',
          userName: existingAdmin.userName || 'admin'
        }
      });

      changedAccounts.push('admin@kaizoku.local');
      console.log('✅ Reset the password for admin@kaizoku.local');
    }

    // Also create the expected admin@kaizoku.dev user
    const expectedAdmin = await prisma.user.findUnique({
      where: { email: 'admin@kaizoku.dev' }
    });

    if (!expectedAdmin) {
      console.log('\n📧 Creating admin@kaizoku.dev user...');

      await prisma.user.create({
        data: {
          email: 'admin@kaizoku.dev',
          name: 'Admin Dev',
          userName: 'admindev',
          hashedPassword: hashedPassword,
          role: 'ADMIN'
        }
      });

      changedAccounts.push('admin@kaizoku.dev');
      console.log('✅ Created admin@kaizoku.dev');
    } else {
      console.log('✅ admin@kaizoku.dev already exists');

      // Make sure it has a password
      if (!expectedAdmin.hashedPassword) {
        await prisma.user.update({
          where: { id: expectedAdmin.id },
          data: {
            hashedPassword: hashedPassword,
            userName: expectedAdmin.userName || 'admin'
          }
        });
        changedAccounts.push('admin@kaizoku.dev');
        console.log('✅ Set a password for admin@kaizoku.dev');
      }
    }

    // List all admin users
    console.log('\n📋 Admin users in database:');
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        email: true,
        name: true,
        hashedPassword: true,
        userName: true
      }
    });

    admins.forEach(admin => {
      console.log(`  ✅ ${admin.email} (username: ${admin.userName}) - Password set: ${admin.hashedPassword ? 'Yes' : 'No'}`);
    });

    console.log('\n🎉 Admin users fixed!');
    if (changedAccounts.length > 0) {
      console.log('\n🔑 You can now login with:');
      console.log(`  Email: ${changedAccounts.join('  OR  ')}`);
      console.log(`  Password: ${seedCredentials.describeSecret('SEED_ADMIN_PASSWORD', adminPassword)}`);
    } else {
      console.log('\n🔑 No passwords were changed.');
    }

  } catch (error) {
    console.error('❌ Error fixing admin user:', error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixAdminUser();
