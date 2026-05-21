/**
 * Playwright test for ComicVine scraping
 */

import { chromium } from 'playwright';

// Fire Force Volume (series) page - uses 4050 prefix
const FIRE_FORCE_VOLUME_URL =
  'https://comicvine.gamespot.com/fire-force/4050-95669/';

// Fire Force Issue 1 page - uses 4000 prefix
const FIRE_FORCE_ISSUE_URL =
  'https://comicvine.gamespot.com/fire-force-1-the-fire-soldiers/4000-725206/';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Playwright ComicVine Scraper Test');
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: true,
  });

  console.log('Browser launched successfully!');

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    console.log('New page created');

    // Test 1: Simple navigation
    console.log('\n--- Test 1: Simple navigation ---');
    await page.goto('https://example.com');
    console.log('Example.com title:', await page.title());

    // Test 2: ComicVine Volume navigation
    console.log('\n--- Test 2: ComicVine VOLUME page navigation ---');
    console.log('Navigating to:', FIRE_FORCE_VOLUME_URL);

    const response = await page.goto(FIRE_FORCE_VOLUME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('Response status:', response?.status());
    console.log('Final URL:', page.url());

    // Check for actual Cloudflare blocking (not just text mentions)
    const html = await page.content();
    console.log('Page content length:', html.length);

    // More specific Cloudflare check - look for the actual challenge elements
    const isRealCloudflare = html.includes('cf-browser-verification') ||
      html.includes('cf_clearance') ||
      (html.includes('Just a moment') && html.includes('challenge-platform'));

    if (isRealCloudflare) {
      console.log('Cloudflare challenge detected, waiting...');
      await page.waitForTimeout(10000);
      console.log('Waited 10s for challenge');
    } else {
      console.log('No Cloudflare challenge - page loaded directly!');
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-playwright.png', fullPage: true });
    console.log('Screenshot saved to /tmp/comicvine-playwright.png');

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Extract concepts
    console.log('\n--- Test 3: Extract concepts ---');
    const concepts = await page.evaluate(() => {
      const results: { text: string; href: string }[] = [];

      // Find all links to concepts
      document.querySelectorAll('a[href*="/concept/"]').forEach((link) => {
        const text = link.textContent?.trim();
        const href = (link as HTMLAnchorElement).href;
        if (text && text.length > 1) {
          results.push({ text, href });
        }
      });

      return results;
    });

    console.log('Found concepts:', concepts);

    // Extract from sidebar
    console.log('\n--- Test 4: Extract sidebar data ---');
    const sidebarData = await page.evaluate(() => {
      const data: Record<string, string[]> = {};

      // Look for wiki details
      const dtElements = document.querySelectorAll('.wiki-details dt, dt');
      dtElements.forEach((dt) => {
        const label = dt.textContent?.trim().toLowerCase();
        const dd = dt.nextElementSibling;
        if (label && dd && dd.tagName === 'DD') {
          const values: string[] = [];
          dd.querySelectorAll('a').forEach((link) => {
            const text = link.textContent?.trim();
            if (text) values.push(text);
          });
          if (values.length > 0) {
            data[label] = values;
          }
        }
      });

      return data;
    });

    console.log('Sidebar data:', JSON.stringify(sidebarData, null, 2));

    // Get all visible text that might be themes
    console.log('\n--- Test 5: Look for themes in page ---');
    const themeSearchResult = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n');
      const themeLines = lines.filter(
        (line) =>
          line.toLowerCase().includes('concept') ||
          line.toLowerCase().includes('theme') ||
          line.toLowerCase().includes('genre')
      );
      return themeLines.slice(0, 10);
    });

    console.log('Lines mentioning themes/concepts:', themeSearchResult);

    // Look for specific sections
    console.log('\n--- Test 6: Inspect page structure ---');
    const sections = await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll('h2, h3')).map(
        (h) => h.textContent?.trim()
      );
      return h2s.slice(0, 20);
    });
    console.log('Section headers:', sections);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
