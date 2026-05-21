/**
 * Playwright test with Firefox for ComicVine scraping
 * Firefox often has better luck bypassing anti-bot measures
 */

import { firefox, chromium } from 'playwright';

const URLS_TO_TEST = [
  {
    name: 'Fire Force Volume',
    url: 'https://comicvine.gamespot.com/fire-force/4050-95669/',
  },
  {
    name: 'One Piece Volume',
    url: 'https://comicvine.gamespot.com/one-piece/4050-18789/',
  },
  {
    name: 'Attack on Titan',
    url: 'https://comicvine.gamespot.com/attack-on-titan/4050-55513/',
  },
];

async function testWithBrowser(
  browserType: 'firefox' | 'chromium',
  targetUrl: string,
  targetName: string
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${targetName} with ${browserType}`);
  console.log(`URL: ${targetUrl}`);
  console.log('='.repeat(60));

  const browser = await (browserType === 'firefox' ? firefox : chromium).launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        browserType === 'firefox'
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });

    const page = await context.newPage();

    // Navigate and wait
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('Response status:', response?.status());
    console.log('Final URL:', page.url());

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check if title matches expected
    const isCorrectPage =
      title.toLowerCase().includes('fire force') ||
      title.toLowerCase().includes('one piece') ||
      title.toLowerCase().includes('attack on titan');

    console.log('Correct page?:', isCorrectPage ? 'YES!' : 'NO - Wrong page served');

    // Take screenshot
    const screenshotName = `/tmp/comicvine-${browserType}-${targetName.replace(/\s+/g, '-')}.png`;
    await page.screenshot({ path: screenshotName, fullPage: true });
    console.log('Screenshot saved:', screenshotName);

    // If correct page, try to extract data
    if (isCorrectPage) {
      // Extract concepts/themes
      const pageData = await page.evaluate(() => {
        const data: {
          concepts: string[];
          themes: string[];
          characters: string[];
        } = {
          concepts: [],
          themes: [],
          characters: [],
        };

        // Find concept links
        document.querySelectorAll('a[href*="/concept/"]').forEach((link) => {
          const text = link.textContent?.trim();
          if (text && text.length > 1) {
            data.concepts.push(text);
          }
        });

        // Find theme links
        document.querySelectorAll('a[href*="/theme/"]').forEach((link) => {
          const text = link.textContent?.trim();
          if (text && text.length > 1) {
            data.themes.push(text);
          }
        });

        // Find character links (as a test)
        document
          .querySelectorAll('a[href*="/character/"], a[href*="/4005-"]')
          .forEach((link) => {
            const text = link.textContent?.trim();
            if (text && text.length > 1 && data.characters.length < 5) {
              data.characters.push(text);
            }
          });

        return data;
      });

      console.log('Extracted data:', JSON.stringify(pageData, null, 2));
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log('ComicVine Browser Scraping Test');
  console.log('Testing multiple URLs with Firefox and Chromium\n');

  for (const { name, url } of URLS_TO_TEST) {
    await testWithBrowser('firefox', url, name);
    await testWithBrowser('chromium', url, name);
  }

  console.log('\n\nAll tests complete!');
}

main().catch(console.error);
