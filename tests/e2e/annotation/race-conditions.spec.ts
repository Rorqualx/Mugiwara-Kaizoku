/**
 * Test 4: Race Conditions - Smoke Tests
 */

import { test, expect } from '@playwright/test';
import { openAnnotationPage } from '../utils/annotation-helpers';
import { seedTestPage, cleanupTestPages } from '../utils/test-data-helpers';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

test.describe('Race Conditions - Smoke Tests', () => {
  let pageId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const testPage = await seedTestPage(page, 'combined');
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

  test('should load combined test page', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    await expect(page.locator('h3:has-text("Annotate Page")')).toBeVisible();
  });

  test('should handle rapid clicks without errors', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Rapid clicks on B button should not cause errors
    const beginButton = page.getByRole('button', { name: 'B (Begin)' });
    await beginButton.click();
    await beginButton.click();
    await beginButton.click();
    
    // Page should still be functional
    await expect(page.locator('h3:has-text("Annotate Page")')).toBeVisible();
  });
});
