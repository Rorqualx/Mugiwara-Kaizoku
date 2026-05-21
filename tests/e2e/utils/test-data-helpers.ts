/**
 * Test Data Helpers for Annotation E2E Tests
 *
 * Provides functions for creating, managing, and cleaning up test annotation pages
 * directly in the database using Prisma.
 */

import { type Page } from '@playwright/test';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

import { TEST_PAGE_HTML, type TestPageType } from '../fixtures/annotation-test-content';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Test page data returned after creation
 */
export interface TestPageData {
  id: string;
  name: string;
  type: TestPageType;
}

/**
 * Creates a test annotation page directly in the database.
 *
 * @param _page - Playwright page instance (unused, kept for API compatibility)
 * @param name - Name for the test page
 * @param htmlContent - HTML content for the page
 * @returns The created page ID
 */
export async function createTestAnnotationPage(
  _page: Page,
  name: string,
  htmlContent: string
): Promise<string> {
  const pageId = nanoid();
  const urlSlug = name.toLowerCase().replace(/\s+/g, '-');
  const url = 'https://test.example.com/' + urlSlug + '-' + pageId;

  await prisma.annotatedPage.create({
    data: {
      id: pageId,
      url,
      mangaTitle: name,
      sourceType: 'FANDOM',
      htmlSnapshot: htmlContent,
      tokens: [],
      labels: [],
      entityCounts: {},
      notes: 'E2E Test page: ' + name,
      status: 'BOOTSTRAP',
    },
  });

  return pageId;
}

/**
 * Deletes a test annotation page from the database.
 *
 * @param _page - Playwright page instance (unused)
 * @param pageId - ID of the page to delete
 */
export async function deleteTestAnnotationPage(_page: Page, pageId: string): Promise<void> {
  try {
    await prisma.annotatedPage.delete({
      where: { id: pageId },
    });
  } catch {
    // Page might not exist, ignore
  }
}

/**
 * Seeds all test pages for the E2E test suite.
 *
 * @param page - Playwright page instance
 * @returns Map of test type to page ID
 */
export async function seedTestPages(page: Page): Promise<Map<TestPageType, string>> {
  const pageIds = new Map<TestPageType, string>();

  for (const [type, html] of Object.entries(TEST_PAGE_HTML)) {
    const name = 'E2E Test - ' + type;
    const id = await createTestAnnotationPage(page, name, html);
    pageIds.set(type as TestPageType, id);
  }

  return pageIds;
}

/**
 * Seeds a single test page by type.
 *
 * @param page - Playwright page instance
 * @param type - Type of test page to create
 * @returns The created page data
 */
export async function seedTestPage(page: Page, type: TestPageType): Promise<TestPageData> {
  const html = TEST_PAGE_HTML[type];
  const name = 'E2E Test - ' + type + ' - ' + Date.now();
  const id = await createTestAnnotationPage(page, name, html);

  return { id, name, type };
}

/**
 * Cleans up all test pages after the test suite.
 *
 * @param _page - Playwright page instance (unused)
 * @param pageIds - Array of page IDs to delete
 */
export async function cleanupTestPages(_page: Page, pageIds: string[]): Promise<void> {
  for (const id of pageIds) {
    try {
      await prisma.annotatedPage.delete({
        where: { id },
      });
    } catch {
      // Ignore errors during cleanup - page may already be deleted
      console.warn('Failed to delete test page ' + id);
    }
  }
}

/**
 * Cleans up test pages by name pattern.
 * Useful for cleaning up orphaned test pages.
 *
 * @param _page - Playwright page instance (unused)
 * @param pattern - Name pattern to match (e.g., "E2E Test")
 */
export async function cleanupTestPagesByPattern(_page: Page, pattern: string): Promise<void> {
  const pages = await prisma.annotatedPage.findMany({
    where: {
      mangaTitle: {
        contains: pattern,
      },
    },
    select: { id: true },
  });

  for (const p of pages) {
    try {
      await prisma.annotatedPage.delete({
        where: { id: p.id },
      });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Gets the ID of an existing test page by name pattern.
 *
 * @param _page - Playwright page instance (unused)
 * @param namePattern - Pattern to match in page name
 * @returns The page ID if found, null otherwise
 */
export async function findTestPageByName(_page: Page, namePattern: string): Promise<string | null> {
  const page = await prisma.annotatedPage.findFirst({
    where: {
      mangaTitle: {
        contains: namePattern,
      },
    },
    select: { id: true },
  });

  return page?.id ?? null;
}
