/**
 * ComicVine: Find URLs reliably via search
 *
 * Strategy:
 * 1. Search for the title
 * 2. Click on the correct result
 * 3. Extract the URL and data
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

interface SearchResult {
  title: string;
  url: string;
  type: string; // 'volume' or 'issue'
  id: string;
}

async function findComicVineUrl(searchQuery: string): Promise<SearchResult | null> {
  console.log('='.repeat(60));
  console.log(`Searching ComicVine for: "${searchQuery}"`);
  console.log('='.repeat(60));

  // Clear browser profile for fresh session
  if (fs.existsSync(BROWSER_DATA_DIR)) {
    fs.rmSync(BROWSER_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  let result: SearchResult | null = null;

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Step 1: Visit homepage
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Step 2: Go to search page with volume filter
    console.log('\n--- Step 2: Search with volume filter ---');
    const searchUrl = `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(searchQuery)}&i=volume`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    const searchTitle = await page.title();
    console.log('Search page title:', searchTitle);

    // Step 3: Extract search results
    console.log('\n--- Step 3: Extract search results ---');

    const searchResults = await page.evaluate(() => {
      const results: Array<{title: string, href: string, subtitle: string}> = [];

      // Find search result items
      document.querySelectorAll('.search-results a, .search-result a, [class*="result"] a').forEach(link => {
        const href = link.getAttribute('href') || '';
        const title = link.textContent?.trim() || '';

        // Only include volume links (4050-) with Fire Force
        if (href.includes('/4050-') && title.length > 0) {
          const parent = link.closest('li, .result, [class*="item"]');
          const subtitle = parent?.querySelector('.result-subtitle, small, .meta')?.textContent?.trim() || '';
          results.push({ title, href, subtitle });
        }
      });

      return results.slice(0, 10);
    });

    console.log('\nSearch results found:');
    searchResults.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title}`);
      console.log(`     URL: ${r.href}`);
      if (r.subtitle) console.log(`     Info: ${r.subtitle}`);
    });

    // Step 4: Click on the first matching result
    if (searchResults.length > 0) {
      console.log('\n--- Step 4: Click first result ---');

      const firstResult = searchResults[0];
      const volumeLink = await page.$(`a[href="${firstResult.href}"]`);

      if (volumeLink) {
        await volumeLink.click();
        await page.waitForLoadState('domcontentloaded');
        await randomDelay(3000, 4000);

        const pageTitle = await page.title();
        const pageUrl = page.url();

        console.log('Navigated to:', pageTitle);
        console.log('URL:', pageUrl);

        // Verify we got the right page
        const isCorrect = pageTitle.toLowerCase().includes(searchQuery.toLowerCase().split(' ')[0]);
        console.log('Correct page?', isCorrect ? 'YES!' : 'NO - may need manual verification');

        // Extract the volume ID
        const idMatch = pageUrl.match(/\/4050-(\d+)/);
        const volumeId = idMatch ? idMatch[1] : '';

        result = {
          title: pageTitle,
          url: pageUrl,
          type: 'volume',
          id: volumeId
        };

        // Take screenshot
        await page.screenshot({ path: '/tmp/comicvine-search-result.png', fullPage: true });
        console.log('Screenshot: /tmp/comicvine-search-result.png');

        // Step 5: Extract issue URLs from the volume page
        console.log('\n--- Step 5: Extract issue URLs ---');

        const issueUrls = await page.evaluate(() => {
          const issues: Array<{title: string, url: string, id: string}> = [];

          document.querySelectorAll('a[href*="/4000-"]').forEach(link => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';
            const idMatch = href.match(/\/4000-(\d+)/);

            if (idMatch && text && !issues.find(i => i.id === idMatch[1])) {
              issues.push({
                title: text.substring(0, 60),
                url: href.startsWith('http') ? href : `https://comicvine.gamespot.com${href}`,
                id: idMatch[1]
              });
            }
          });

          return issues.slice(0, 15);
        });

        console.log(`\nFound ${issueUrls.length} issue URLs:`);
        issueUrls.forEach(issue => {
          console.log(`  [${issue.id}] ${issue.title}`);
          console.log(`    ${issue.url}`);
        });
      }
    } else {
      console.log('No search results found');
    }

    // Keep browser open briefly
    console.log('\n--- Browser open for 8 seconds ---');
    await randomDelay(8000, 8000);

  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }

  return result;
}

async function main(): Promise<void> {
  // Test with Fire Force
  const result = await findComicVineUrl('Fire Force');

  console.log('\n=== FINAL RESULT ===');
  if (result) {
    console.log('Title:', result.title);
    console.log('URL:', result.url);
    console.log('Type:', result.type);
    console.log('ID:', result.id);
  } else {
    console.log('No result found');
  }
}

main().catch(console.error);
