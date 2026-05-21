/**
 * ComicVine Issue Page Scraper with Stealth
 *
 * Navigates to an issue page (not volume page) to extract concepts/themes
 * Issue pages have more detailed metadata including concepts, objects, locations
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Add stealth plugin
chromium.use(StealthPlugin());

const COMICVINE_URLS = {
  homepage: 'https://comicvine.gamespot.com/',
  fireForceVolume: 'https://comicvine.gamespot.com/fire-force/4050-95669/',
  fireForceIssue1: 'https://comicvine.gamespot.com/fire-force-1-the-fire-soldiers/4000-725206/',
  search: 'https://comicvine.gamespot.com/search/?q=fire+force',
};

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ComicVine Issue Page Scraper - Concepts Extraction');
  console.log('='.repeat(60));

  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    });

    // Step 1: Visit homepage first
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto(COMICVINE_URLS.homepage, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Simulate human behavior
    await page.evaluate(() => window.scrollTo(0, 300));
    await randomDelay(500, 1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await randomDelay(500, 1000);

    // Step 2: Go to Fire Force volume page
    console.log('\n--- Step 2: Navigate to Fire Force volume ---');
    await page.goto(COMICVINE_URLS.fireForceVolume, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    const volumeTitle = await page.title();
    console.log('Volume page title:', volumeTitle);

    // Step 3: Find and click on Issue #1 to get concepts
    console.log('\n--- Step 3: Click on Issue #1 ---');

    // Look for issue links - they have pattern like "/fire-force-1-..." or just "#1"
    const issueLink = await page.$('a[href*="/fire-force-1-"][href*="/4000-"]');

    if (issueLink) {
      console.log('Found issue #1 link, clicking...');
      await issueLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      console.log('No issue link found, navigating directly...');
      await page.goto(COMICVINE_URLS.fireForceIssue1, { waitUntil: 'domcontentloaded' });
    }

    await randomDelay(3000, 5000);

    const issueTitle = await page.title();
    const issueUrl = page.url();
    console.log('Issue page title:', issueTitle);
    console.log('Issue URL:', issueUrl);

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-issue.png', fullPage: true });
    console.log('Screenshot saved to /tmp/comicvine-issue.png');

    // Step 4: Extract all sidebar sections and their content
    console.log('\n--- Step 4: Extract page structure ---');

    const pageStructure = await page.evaluate(() => {
      const structure: Record<string, unknown> = {};

      // Get all h2, h3, h4 headers
      const headers: string[] = [];
      document.querySelectorAll('h2, h3, h4').forEach(h => {
        headers.push(`${h.tagName}: ${h.textContent?.trim()}`);
      });
      structure.headers = headers;

      // Look for sidebar sections - ComicVine uses various patterns
      const sidebarSections: Array<{header: string, items: string[]}> = [];

      // Pattern 1: Look for aside or sidebar content
      document.querySelectorAll('aside, [class*="sidebar"], [class*="aside"]').forEach(aside => {
        aside.querySelectorAll('h3, h4, .header, dt').forEach(header => {
          const headerText = header.textContent?.trim() || '';
          const items: string[] = [];

          // Get sibling or next element
          let sibling = header.nextElementSibling;
          if (sibling) {
            sibling.querySelectorAll('a').forEach(link => {
              items.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
            });
          }

          if (items.length > 0) {
            sidebarSections.push({ header: headerText, items });
          }
        });
      });
      structure.sidebarSections = sidebarSections;

      // Pattern 2: Look for wiki-details sections (dl/dt/dd pattern)
      const wikiDetails: Array<{label: string, values: string[]}> = [];
      document.querySelectorAll('dl').forEach(dl => {
        dl.querySelectorAll('dt').forEach(dt => {
          const label = dt.textContent?.trim() || '';
          const dd = dt.nextElementSibling;
          if (dd?.tagName === 'DD') {
            const values: string[] = [];
            dd.querySelectorAll('a').forEach(link => {
              values.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
            });
            if (values.length === 0) {
              values.push(dd.textContent?.trim() || '');
            }
            wikiDetails.push({ label, values });
          }
        });
      });
      structure.wikiDetails = wikiDetails;

      // Pattern 3: Look for concept/theme links specifically
      const conceptLinks: string[] = [];
      document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
        conceptLinks.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
      });
      structure.conceptLinks = conceptLinks;

      // Pattern 4: Look for object links
      const objectLinks: string[] = [];
      document.querySelectorAll('a[href*="/object/"], a[href*="/4055-"]').forEach(link => {
        objectLinks.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
      });
      structure.objectLinks = objectLinks;

      // Pattern 5: Look for location links
      const locationLinks: string[] = [];
      document.querySelectorAll('a[href*="/location/"], a[href*="/4020-"]').forEach(link => {
        locationLinks.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
      });
      structure.locationLinks = locationLinks;

      // Pattern 6: Look for character links
      const characterLinks: string[] = [];
      document.querySelectorAll('a[href*="/4005-"]').forEach(link => {
        characterLinks.push(`${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
      });
      structure.characterLinks = characterLinks.slice(0, 10); // First 10 only

      // Pattern 7: Look for any expandable sections
      const expandableSections: string[] = [];
      document.querySelectorAll('[class*="expand"], [class*="toggle"], [class*="collapse"]').forEach(el => {
        expandableSections.push(el.className);
      });
      structure.expandableSections = expandableSections;

      // Pattern 8: Get all link categories on the page
      const allLinks = new Map<string, number>();
      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href') || '';
        // Extract the category from URL like /4015-, /4055-, /4005-, etc.
        const match = href.match(/\/(\d{4})-\d+/);
        if (match) {
          const key = match[1];
          allLinks.set(key, (allLinks.get(key) || 0) + 1);
        }
      });
      structure.linkCategories = Object.fromEntries(allLinks);

      return structure;
    });

    console.log('\n=== PAGE STRUCTURE ===');
    console.log(JSON.stringify(pageStructure, null, 2));

    // Step 5: Try to expand any collapsible sections
    console.log('\n--- Step 5: Try to expand sections ---');

    // ComicVine has sections like "Concepts", "Characters" that might need expanding
    const expandButtons = await page.$$('button, [role="button"], .expand, .toggle');
    for (const btn of expandButtons.slice(0, 5)) {
      try {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes('show') || text?.toLowerCase().includes('more')) {
          console.log('Clicking expand button:', text?.trim());
          await btn.click();
          await randomDelay(500, 1000);
        }
      } catch {
        // Ignore click errors
      }
    }

    // Re-extract concepts after expanding
    const conceptsAfterExpand = await page.evaluate(() => {
      const concepts: string[] = [];
      document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !concepts.includes(text)) {
          concepts.push(text);
        }
      });
      return concepts;
    });

    console.log('\n=== EXTRACTED CONCEPTS ===');
    console.log(conceptsAfterExpand);

    // Step 6: Get the full HTML of the sidebar for analysis
    const sidebarHtml = await page.evaluate(() => {
      const sidebar = document.querySelector('aside, [class*="sidebar"], .wiki-details, .issue-details');
      return sidebar?.innerHTML?.substring(0, 5000) || 'No sidebar found';
    });

    console.log('\n=== SIDEBAR HTML (first 2000 chars) ===');
    console.log(sidebarHtml.substring(0, 2000));

    // Keep browser open briefly
    console.log('\n--- Browser will stay open for 15 seconds ---');
    await randomDelay(15000, 15000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
