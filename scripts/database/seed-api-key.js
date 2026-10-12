#!/usr/bin/env node
/**
 * Seed API Key Script
 * 
 * Creates a test API key for development
 * 
 * Usage: node scripts/seed-api-key.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const seedCredentials = require('../lib/seed-credentials.cjs');

const prisma = new PrismaClient();

// CLI script — stdout output is intentional, not a logging concern
const print = console['log'].bind(console); // @quality-check-skip

async function main() {
  // Creates an ADMIN user and a full-permission key: development only.
  // Refuses NODE_ENV=production unless ALLOW_SEED_IN_PRODUCTION=true.
  seedCredentials.assertSeedAllowed('seed-api-key.js');

  console.log('🔑 Creating test API key for development...\n');

  try {
    // Find or create a test user
    let testUser = await prisma.user.findFirst({
      where: { email: 'api-test@kaizoku.local' },
    });

    if (!testUser) {
      console.log('Creating test user...');
      // From SEED_API_TEST_PASSWORD, or generated and printed once here.
      const testPassword = seedCredentials.resolveSecret('SEED_API_TEST_PASSWORD');
      testUser = await prisma.user.create({
        data: {
          email: 'api-test@kaizoku.local',
          userName: 'api-test',
          name: 'API Test User',
          hashedPassword: await bcrypt.hash(testPassword.value, 12),
          role: 'ADMIN',
        },
      });
      print(
        '   Test user password:',
        seedCredentials.describeSecret('SEED_API_TEST_PASSWORD', testPassword),
      );
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }

    // Check if test API key already exists
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        userId: testUser.id,
        name: 'Development Test Key',
      },
    });

    if (existingKey) {
      console.log('\n⚠️  Test API key already exists');
      console.log('ID:', existingKey.id);
      console.log('Name:', existingKey.name);
      console.log('\nTo create a new key, delete the existing one first.');
      return;
    }

    // Generate new API key
    const rawKey = 'test-api-key-' + crypto.randomBytes(16).toString('hex');
    const hashedKey = await bcrypt.hash(rawKey, 10);

    // Create API key with full permissions
    const apiKey = await prisma.apiKey.create({
      data: {
        key: hashedKey,
        name: 'Development Test Key',
        userId: testUser.id,
        permissions: {
          create: [
            {
              resource: 'manga',
              actions: ['read', 'write', 'delete'],
            },
            {
              resource: 'library',
              actions: ['read', 'write', 'delete'],
            },
            {
              resource: 'download',
              actions: ['read', 'write', 'delete'],
            },
            {
              resource: 'metadata',
              actions: ['read', 'write'],
            },
            {
              resource: 'user',
              actions: ['read', 'write'],
            },
            {
              resource: 'webhook',
              actions: ['read', 'write', 'delete'],
            },
          ],
        },
        metadata: {
          environment: 'development',
          purpose: 'testing',
          createdBy: 'seed-script',
        },
      },
      include: {
        permissions: true,
      },
    });

    console.log('\n✅ API key created successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nAPI Key:', rawKey);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('\nKey Details:');
    console.log('- ID:', apiKey.id);
    console.log('- Name:', apiKey.name);
    console.log('- User:', testUser.email);
    console.log('- Permissions:', apiKey.permissions.length, 'resources');
    console.log('\nUsage example:');
    console.log(`curl -H "X-API-Key: ${rawKey}" http://localhost:3000/api/v1/health`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Error creating API key:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});