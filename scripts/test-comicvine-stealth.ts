/**
 * Advanced ComicVine scraper with stealth techniques
 *
 * Strategies:
 * 1. playwright-extra with stealth plugin
 * 2. Persistent browser profile with cookies
 * 3. Human-like behavior (random delays, realistic navigation)
 * 4. Non-headless mode option for debugging
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Add stealth plugin
chromium.use(StealthPlugin());

const COMICVINE_URLS = {
  fireForceVolume: 'https://comicvine.gamespot.com/fire-force/4050-95669/',
  fireForceIssue: 'https://comicvine.gamespot.com/fire-force-1-the-fire-soldiers/4000-725206/',
  homepage: 'https://comicvine.gamespot.com/',
  search: 'https://comicvine.gamespot.com/search/?q=fire+force',
};

// Path to store browser profile
const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function testWithStealth(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ComicVine Stealth Scraper Test');
  console.log('='.repeat(60));

  // Ensure browser data directory exists
  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  console.log('Browser profile:', BROWSER_DATA_DIR);

  // Launch with stealth and persistent context
  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false, // Run visible to see what's happening
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    });

    // Strategy 1: First visit homepage to establish session
    console.log('\n--- Step 1: Visit homepage first ---');
    await page.goto(COMICVINE_URLS.homepage, { waitUntil: 'domcontentloaded' });
    console.log('Homepage title:', await page.title());
    await randomDelay(2000, 4000);

    // Simulate some human behavior - scroll around
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });
    await randomDelay(1000, 2000);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await randomDelay(500, 1000);

    // Strategy 2: Use search to navigate to Fire Force
    console.log('\n--- Step 2: Search for Fire Force ---');
    await page.goto(COMICVINE_URLS.search, { waitUntil: 'domcontentloaded' });
    console.log('Search page title:', await page.title());
    await randomDelay(2000, 3000);

    // Take screenshot of search results
    await page.screenshot({ path: '/tmp/comicvine-search.png', fullPage: true });
    console.log('Search screenshot saved to /tmp/comicvine-search.png');

    // Look for Fire Force in search results
    const searchResults = await page.evaluate(() => {
      const results: string[] = [];
      document.querySelectorAll('a').forEach(link => {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('fire force')) {
          results.push(`${link.textContent?.trim()} -> ${link.href}`);
        }
      });
      return results.slice(0, 5);
    });
    console.log('Fire Force search results:', searchResults);

    // Strategy 3: Navigate to volume page via click (more natural)
    console.log('\n--- Step 3: Navigate to Fire Force volume ---');

    // Try clicking on a search result link
    const fireForceLink = await page.$('a[href*="fire-force"][href*="4050"]');
    if (fireForceLink) {
      console.log('Found Fire Force link, clicking...');
      await fireForceLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      console.log('No link found, navigating directly...');
      await page.goto(COMICVINE_URLS.fireForceVolume, { waitUntil: 'domcontentloaded' });
    }

    await randomDelay(3000, 5000);

    // Check what page we landed on
    const finalTitle = await page.title();
    const finalUrl = page.url();
    console.log('Final page title:', finalTitle);
    console.log('Final URL:', finalUrl);

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-stealth-result.png', fullPage: true });
    console.log('Final screenshot saved to /tmp/comicvine-stealth-result.png');

    // Check if we got the right page
    const isCorrectPage = finalTitle.toLowerCase().includes('fire force');
    console.log('\nCorrect page?:', isCorrectPage ? 'YES!' : 'NO - Still getting wrong page');

    if (isCorrectPage) {
      // Extract concepts/themes
      const concepts = await page.evaluate(() => {
        const results: string[] = [];
        document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && text.length > 1) {
            results.push(text);
          }
        });
        return [...new Set(results)]; // Remove duplicates
      });
      console.log('Extracted concepts:', concepts);
    }

    // Keep browser open for manual inspection
    console.log('\n--- Browser will stay open for 30 seconds for inspection ---');
    await randomDelay(30000, 30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

async function testWithRegularPlaywright(): Promise<void> {
  // Also try regular playwright without stealth plugin for comparison
  console.log('\n\n' + '='.repeat(60));
  console.log('Testing with regular Playwright (no stealth) for comparison');
  console.log('='.repeat(60));

  const { chromium: regularChromium } = await import('playwright');

  const browser = await regularChromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Go directly to Fire Force
    await page.goto(COMICVINE_URLS.fireForceVolume, { waitUntil: 'domcontentloaded' });

    console.log('Regular Playwright - Page title:', await page.title());
    console.log('Regular Playwright - URL:', page.url());

  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    await testWithStealth();
    await testWithRegularPlaywright();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main().catch(console.error);
