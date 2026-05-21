// @quality-check-skip: Test setup file - console.log used for test diagnostics
/**
 * Playwright Global Setup
 *
 * Creates a test user and saves authenticated state for E2E tests.
 * This runs once before all tests.
 */

import { chromium, type FullConfig } from '@playwright/test';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const TEST_USER = {
  username: 'e2e-test-admin',
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
};

const AUTH_FILE = 'tests/e2e/.auth/user.json';

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('\n[E2E Setup] Starting global setup...');

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? '' });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Check if test user exists
    let testUser = await prisma.user.findFirst({
      where: {
        OR: [{ userName: TEST_USER.username }, { email: TEST_USER.email }],
      },
    });

    if (!testUser) {
      console.log('[E2E Setup] Creating test user...');
      const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);

      testUser = await prisma.user.create({
        data: {
          id: nanoid(),
          userName: TEST_USER.username,
          email: TEST_USER.email,
          hashedPassword,
          role: UserRole.ADMIN,
          updatedAt: new Date(),
        },
      });
      console.log(`[E2E Setup] Test user created: ${testUser.userName}`);
    } else {
      // Update password to ensure we know it
      console.log('[E2E Setup] Updating test user password...');
      const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
      await prisma.user.update({
        where: { id: testUser.id },
        data: { hashedPassword },
      });
    }

    // Launch browser and authenticate
    console.log('[E2E Setup] Authenticating and saving state...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // Check if redirected to setup page
    if (page.url().includes('/setup')) {
      console.log('[E2E Setup] App redirected to setup - completing first-time setup...');
      // If setup page, complete it first
      await page.getByLabel('Username').fill(TEST_USER.username);
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
      await page.getByLabel('Confirm Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Create Admin Account' }).click();
      await page.waitForURL(/\/login/, { timeout: 15000 });
    }

    // Fill login form
    await page.getByLabel('Username or Email').fill(TEST_USER.username);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for successful login (URL should not contain /login)
    await page.waitForFunction(
      () => !window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup'),
      { timeout: 15000 }
    );
    console.log(`[E2E Setup] Login successful! Redirected to: ${page.url()}`);

    // Save authenticated state
    await page.context().storageState({ path: AUTH_FILE });
    console.log(`[E2E Setup] Auth state saved to ${AUTH_FILE}`);

    await browser.close();
  } catch (error) {
    console.error('[E2E Setup] Error during setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log('[E2E Setup] Global setup complete!\n');
}

export default globalSetup;
