/**
 * Test 3: Sentence Boundary - Smoke Tests
 */

import { test, expect } from '@playwright/test';
import { openAnnotationPage } from '../utils/annotation-helpers';
import { seedTestPage, cleanupTestPages } from '../utils/test-data-helpers';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

test.describe('Sentence Boundary - Smoke Tests', () => {
  let pageId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const testPage = await seedTestPage(page, 'ellipsis');
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

  test('should load ellipsis test page', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    await expect(page.locator('h3:has-text("Annotate Page")')).toBeVisible();
  });

  test('should display ellipsis content in iframe', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('text=Wait...')).toBeVisible();
  });
});
