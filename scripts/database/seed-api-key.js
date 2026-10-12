#!/usr/bin/env node
/**
 * Seed API Key Script
 *
 * Creates a test API key for development
 *
 * Usage: node scripts/database/seed-api-key.js
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import seedCredentials from '../lib/seed-credentials.cjs';
import { createSeedPrisma, newUserFields } from '../lib/seed-prisma.mjs';

const TEST_USER_EMAIL = 'api-test@kaizoku.local';
const TEST_KEY_NAME = 'Development Test Key';

const TEST_KEY_PERMISSIONS = [
  { resource: 'manga', actions: ['read', 'write', 'delete'] },
  { resource: 'library', actions: ['read', 'write', 'delete'] },
  { resource: 'download', actions: ['read', 'write', 'delete'] },
  { resource: 'metadata', actions: ['read', 'write'] },
  { resource: 'user', actions: ['read', 'write'] },
  { resource: 'webhook', actions: ['read', 'write', 'delete'] },
];

// CLI script — stdout output is intentional, not a logging concern
const print = console['log'].bind(console); // @quality-check-skip

/**
 * The digest the API looks a key up by. Must stay identical to `hashApiKey`
 * in src/server/api/services/apiAuth.ts, or the seeded key never authenticates.
 * @param {string} rawKey
 * @returns {string}
 */
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function findOrCreateTestUser(prisma) {
  const existing = await prisma.user.findFirst({ where: { email: TEST_USER_EMAIL } });
  if (existing) {
    print('✅ Test user already exists');
    return existing;
  }

  print('Creating test user...');
  // From SEED_API_TEST_PASSWORD, or generated and printed once here.
  const testPassword = seedCredentials.resolveSecret('SEED_API_TEST_PASSWORD');
  const created = await prisma.user.create({
    data: {
      ...newUserFields(),
      email: TEST_USER_EMAIL,
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
  print('✅ Test user created');
  return created;
}

async function main() {
  // Creates an ADMIN user and a full-permission key: development only.
  // Refuses NODE_ENV=production unless ALLOW_SEED_IN_PRODUCTION=true.
  seedCredentials.assertSeedAllowed('seed-api-key.js');

  const { prisma, close } = createSeedPrisma();

  print('🔑 Creating test API key for development...\n');

  try {
    const testUser = await findOrCreateTestUser(prisma);

    // Check if test API key already exists
    const existingKey = await prisma.apiKey.findFirst({
      where: { userId: testUser.id, name: TEST_KEY_NAME },
    });

    if (existingKey) {
      print('\n⚠️  Test API key already exists');
      print('ID:', existingKey.id);
      print('Name:', existingKey.name);
      print('\nTo create a new key, delete the existing one first.');
      return;
    }

    // Same shape as keys issued by the app; only the digest is stored.
    const rawKey = `mk_${crypto.randomBytes(32).toString('hex')}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        key: hashApiKey(rawKey),
        name: TEST_KEY_NAME,
        userId: testUser.id,
        permissions: { create: TEST_KEY_PERMISSIONS },
      },
      include: { permissions: true },
    });

    print('\n✅ API key created successfully!\n');
    print('═══════════════════════════════════════════════════════════════');
    print('SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN');
    print('═══════════════════════════════════════════════════════════════');
    print('\nAPI Key:', rawKey);
    print('\n═══════════════════════════════════════════════════════════════');
    print('\nKey Details:');
    print('- ID:', apiKey.id);
    print('- Name:', apiKey.name);
    print('- User:', testUser.email);
    print('- Permissions:', apiKey.permissions.length, 'resources');
    print('\nUsage example:');
    print(`curl -H "X-API-Key: ${rawKey}" http://localhost:3000/api/v1/health`);
    print('\n');
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error('❌ Error creating API key:', error);
  process.exitCode = 1;
});
