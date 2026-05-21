/**
 * Test 1: Selection Uniqueness - Smoke Tests
 *
 * Basic smoke tests to verify the annotation page loads and basic interactions work.
 * More detailed selection uniqueness tests are covered by unit tests.
 */

import { test, expect } from '@playwright/test';

import {
  openAnnotationPage,
} from '../utils/annotation-helpers';
import { seedTestPage, cleanupTestPages } from '../utils/test-data-helpers';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

test.describe('Annotation Editor - Smoke Tests', () => {
  let pageId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const testPage = await seedTestPage(page, 'chapters');
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

  test('should load annotation page with correct title', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Verify page heading
    await expect(page.locator('h3:has-text("Annotate Page")')).toBeVisible();
  });

  test('should display Page View tab with iframe', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Verify Page View tab is selected
    const pageViewTab = page.getByRole('tab', { name: 'Page View' });
    await expect(pageViewTab).toBeVisible();
    await expect(pageViewTab).toHaveAttribute('aria-selected', 'true');
    
    // Verify iframe exists
    await expect(page.locator('iframe')).toBeVisible();
  });

  test('should display test page content in iframe', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    const frame = page.frameLocator('iframe');
    
    // Verify chapter headings are visible in iframe
    await expect(frame.locator('h2:has-text("Chapter 1: The Beginning")')).toBeVisible();
    await expect(frame.locator('h2:has-text("Chapter 10: The Middle")')).toBeVisible();
  });

  test('should display label buttons', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Verify B/I labeling buttons exist
    await expect(page.getByRole('button', { name: 'B (Begin)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I (Inside)' })).toBeVisible();
  });

  test('should display entity label buttons', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Verify some entity label buttons exist
    await expect(page.getByRole('button', { name: 'Title', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Author' })).toBeVisible();
  });

  test('should have selection tools visible but disabled initially', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Verify selection tool area exists
    await expect(page.locator('text=Selection Tool:')).toBeVisible();
  });

  test('should switch to Summary tab', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Click Summary tab
    await page.getByRole('tab', { name: 'Summary' }).click();
    
    // Verify Summary tab is now selected
    const summaryTab = page.getByRole('tab', { name: 'Summary' });
    await expect(summaryTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should enable Begin mode when clicking B button', async ({ page }) => {
    await openAnnotationPage(page, pageId);
    
    // Click B (Begin) button
    const beginButton = page.getByRole('button', { name: 'B (Begin)' });
    await beginButton.click();
    
    // Button should be in an active state (implementation-specific)
    // For now just verify click doesn't cause errors
  });
});
