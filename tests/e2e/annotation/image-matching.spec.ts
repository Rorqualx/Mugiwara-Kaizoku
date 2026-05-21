/**
 * Test 5: Image Matching - Smoke Tests
 */

import { test, expect } from '@playwright/test';
import { openAnnotationPage } from '../utils/annotation-helpers';
import { seedTestPage, cleanupTestPages } from '../utils/test-data-helpers';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

test.describe('Image Matching - Smoke Tests', () => {
  let pageId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const testPage = await seedTestPage(page, 'images');
    pageId = testPage.id;
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    await page.goto('/');
    await cleanupTestPages(page, [pageId]);
    await context.close();
  });

  test('should load images test page', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    await expect(page.locator('h3:has-text("Annotate Page")')).toBeVisible();
  });

  test('should display image content in iframe', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    const frame = page.frameLocator('iframe');
    // Images should be present
    await expect(frame.locator('img').first()).toBeVisible();
  });
});
