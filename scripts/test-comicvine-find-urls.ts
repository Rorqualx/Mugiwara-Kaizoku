/**
 * Find correct Fire Force URLs from ComicVine search
 *
 * Navigate through search to discover the correct issue URLs
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

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Find Fire Force URLs from ComicVine Search');
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
      '--no-sandbox',
    ],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    // Step 1: Go to homepage
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Step 2: Search for "fire force"
    console.log('\n--- Step 2: Search for "fire force" ---');

    // Use direct search URL (more reliable)
    await page.goto('https://comicvine.gamespot.com/search/?q=fire+force&i=volume', { waitUntil: 'domcontentloaded' });

    await randomDelay(3000, 4000);
    console.log('Search page:', await page.title());

    // Step 3: Extract all Fire Force related links from search results
    console.log('\n--- Step 3: Extract Fire Force links ---');

    const searchResults = await page.evaluate(() => {
      const results: Array<{text: string, href: string, type: string}> = [];

      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';

        // Only include Fire Force related links
        if (text.toLowerCase().includes('fire force') || href.toLowerCase().includes('fire-force')) {
          let type = 'unknown';
          if (href.includes('/4050-')) type = 'volume';
          else if (href.includes('/4000-')) type = 'issue';
          else if (href.includes('/4005-')) type = 'character';

          // Avoid duplicates
          if (!results.find(r => r.href === href)) {
            results.push({ text: text.substring(0, 80), href, type });
          }
        }
      });

      return results;
    });

    console.log('\nFire Force search results:');
    searchResults.forEach(r => {
      console.log(`  [${r.type}] ${r.text}`);
      console.log(`    URL: ${r.href}`);
    });

    // Step 4: Click on the Fire Force volume (4050-) link
    console.log('\n--- Step 4: Navigate to Fire Force volume ---');

    const volumeLink = await page.$('a[href*="fire-force"][href*="/4050-"]');
    if (volumeLink) {
      const volumeHref = await volumeLink.getAttribute('href');
      console.log('Found volume link:', volumeHref);
      await volumeLink.click();
      await page.waitForLoadState('domcontentloaded');
      await randomDelay(3000, 4000);
    }

    const volumeTitle = await page.title();
    const volumeUrl = page.url();
    console.log('Volume page title:', volumeTitle);
    console.log('Volume URL:', volumeUrl);

    // Step 5: Extract issue links from the volume page
    console.log('\n--- Step 5: Extract issues from volume page ---');

    const issueLinks = await page.evaluate(() => {
      const issues: Array<{text: string, href: string, id: string}> = [];

      // Look for issue links - they have /4000- pattern
      document.querySelectorAll('a[href*="/4000-"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        const idMatch = href.match(/\/4000-(\d+)/);

        if (idMatch && text) {
          if (!issues.find(i => i.id === idMatch[1])) {
            issues.push({
              text: text.substring(0, 60),
              href,
              id: idMatch[1]
            });
          }
        }
      });

      return issues.slice(0, 20); // First 20 issues
    });

    console.log('\nIssues found on volume page:');
    issueLinks.forEach(issue => {
      console.log(`  Issue ID ${issue.id}: ${issue.text}`);
      console.log(`    URL: ${issue.href}`);
    });

    // Step 6: Click on the first issue to see its details
    if (issueLinks.length > 0) {
      console.log('\n--- Step 6: Navigate to first issue ---');

      const firstIssueLink = await page.$(`a[href*="/4000-${issueLinks[0].id}"]`);
      if (firstIssueLink) {
        await firstIssueLink.click();
        await page.waitForLoadState('domcontentloaded');
        await randomDelay(3000, 4000);

        const issueTitle = await page.title();
        const issueUrl = page.url();
        console.log('Issue page title:', issueTitle);
        console.log('Issue URL:', issueUrl);

        // Take screenshot
        await page.screenshot({ path: '/tmp/comicvine-fire-force-issue.png', fullPage: true });
        console.log('Screenshot saved to /tmp/comicvine-fire-force-issue.png');

        // Extract concepts from issue page
        const concepts = await page.evaluate(() => {
          const results: string[] = [];

          // Look for concept links
          document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
            const text = link.textContent?.trim();
            if (text && !results.includes(text)) {
              results.push(text);
            }
          });

          // Also look in the sidebar sections
          document.querySelectorAll('h3').forEach(h3 => {
            if (h3.textContent?.toLowerCase().includes('concept')) {
              const parent = h3.parentElement;
              parent?.querySelectorAll('a').forEach(link => {
                const text = link.textContent?.trim();
                if (text && !results.includes(text)) {
                  results.push(text);
                }
              });
            }
          });

          return results;
        });

        console.log('\nConcepts found:', concepts);

        // Extract all sidebar data
        const sidebarData = await page.evaluate(() => {
          const data: Record<string, string[]> = {};

          document.querySelectorAll('.wiki-details-object, .wiki-item-display').forEach(section => {
            const header = section.querySelector('h3')?.textContent?.trim();
            if (header) {
              const items: string[] = [];
              section.querySelectorAll('a').forEach(link => {
                const text = link.textContent?.trim();
                if (text) items.push(text);
              });
              if (items.length > 0) {
                data[header] = items;
              }
            }
          });

          return data;
        });

        console.log('\nSidebar data:', JSON.stringify(sidebarData, null, 2));
      }
    }

    // Keep browser open briefly
    console.log('\n--- Browser will stay open for 10 seconds ---');
    await randomDelay(10000, 10000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
