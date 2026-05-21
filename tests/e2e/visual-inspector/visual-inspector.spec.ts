/**
 * Visual Inspector E2E Tests
 *
 * End-to-end tests for the Visual Inspector modal component.
 * Tests modal interactions, element picking, and selector validation.
 */

import { test, expect } from '@playwright/test';

import { MOCK_FETCH_RESPONSE, MOCK_VALIDATE_CSS_RESPONSE } from '../fixtures/annotation-test-content';

// Mock tRPC routes for testing
test.beforeEach(async ({ page }) => {
  // Intercept tRPC calls
  await page.route('**/api/trpc/nativeDownload.fetchWebsiteContent*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          data: MOCK_FETCH_RESPONSE
        }
      })
    });
  });

  await page.route('**/api/trpc/nativeDownload.validateSelector*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          data: MOCK_VALIDATE_CSS_RESPONSE
        }
      })
    });
  });
});

test.describe('Visual Inspector Modal', () => {
  test.skip('should open modal when triggered', async ({ page }) => {
    // Navigate to a page with visual inspector trigger
    // This test is skipped as it requires specific page setup
    await page.goto('/settings/native-download');

    // Find and click the visual inspector trigger
    const inspectorButton = page.locator('button:has-text("Visual Inspector")');
    await expect(inspectorButton).toBeVisible();
    await inspectorButton.click();

    // Modal should be visible
    const modal = page.locator('text=Visual Element Inspector');
    await expect(modal).toBeVisible();
  });

  test.skip('should display mode and field selectors', async ({ page }) => {
    // Navigate and open modal
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Check mode selector exists
    const modeSelector = page.locator('label:has-text("Mode") + select, [aria-label="Mode"]');
    await expect(modeSelector).toBeVisible();

    // Check field selector exists
    const fieldSelector = page.locator('label:has-text("Field") + select, [aria-label="Field"]');
    await expect(fieldSelector).toBeVisible();
  });

  test.skip('should toggle selector type between CSS and XPath', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Find selector type toggle
    const cssButton = page.locator('button:has-text("CSS")');
    const xpathButton = page.locator('button:has-text("XPath")');

    await expect(cssButton).toBeVisible();
    await expect(xpathButton).toBeVisible();

    // Click XPath to switch
    await xpathButton.click();

    // XPath should be selected (has active styling)
    await expect(xpathButton).toHaveAttribute('data-active', 'true');
  });

  test.skip('should display extraction type panel', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Check extraction type options
    const textOption = page.locator('button:has-text("Text Content")');
    const attributeOption = page.locator('button:has-text("Attribute")');
    const htmlOption = page.locator('button:has-text("Inner HTML")');

    await expect(textOption).toBeVisible();
    await expect(attributeOption).toBeVisible();
    await expect(htmlOption).toBeVisible();
  });

  test.skip('should show attribute input when attribute extraction selected', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Click attribute option
    await page.click('button:has-text("Attribute")');

    // Attribute input should appear
    const attributeInput = page.locator('input[placeholder*="href"]');
    await expect(attributeInput).toBeVisible();
  });

  test.skip('should display live preview panel', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Enter a selector
    await page.fill('input[placeholder*="selector"]', '.manga-title');

    // Wait for validation
    await page.waitForTimeout(600); // Debounce delay

    // Preview panel should show matches
    const matchBadge = page.locator('text=/\\d+ matches?/');
    await expect(matchBadge).toBeVisible();
  });

  test.skip('should enable pick element button only for CSS mode', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Pick button should be enabled in CSS mode
    const pickButton = page.locator('button:has-text("Pick Element")');
    await expect(pickButton).not.toBeDisabled();

    // Switch to XPath mode
    await page.click('button:has-text("XPath")');

    // Pick button should be disabled in XPath mode
    await expect(pickButton).toBeDisabled();
  });

  test.skip('should close modal on cancel', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Modal should be closed
    const modal = page.locator('text=Visual Element Inspector');
    await expect(modal).not.toBeVisible();
  });

  test.skip('should disable save button when no selectors configured', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Save button should be disabled initially
    const saveButton = page.locator('button:has-text("Save Selectors")');
    await expect(saveButton).toBeDisabled();
  });

  test.skip('should enable save button after selector is configured', async ({ page }) => {
    await page.goto('/settings/native-download');
    await page.click('button:has-text("Visual Inspector")');

    // Enter a valid selector
    await page.fill('input[placeholder*="selector"]', '.manga-title');

    // Wait for validation
    await page.waitForTimeout(600);

    // Save button should be enabled
    const saveButton = page.locator('button:has-text("Save Selectors")');
    await expect(saveButton).not.toBeDisabled();
  });
});
