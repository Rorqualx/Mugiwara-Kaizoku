/**
 * Simple Puppeteer test to debug launch issues
 */

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

function findChrome(): string | undefined {
  // Check puppeteer cache first
  const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(cacheDir)) {
    const versions = fs.readdirSync(cacheDir).filter(d => d.startsWith('mac-'));
    if (versions.length > 0) {
      // Sort to get latest version
      versions.sort().reverse();
      const latestVersion = versions[0];
      const chromePath = path.join(
        cacheDir,
        latestVersion,
        'chrome-mac-x64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing'
      );
      if (fs.existsSync(chromePath)) {
        console.log('Found Chrome at:', chromePath);
        return chromePath;
      }
    }
  }

  // Try system Chrome
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(systemChrome)) {
    console.log('Found system Chrome at:', systemChrome);
    return systemChrome;
  }

  return undefined;
}

async function main(): Promise<void> {
  console.log('Testing Puppeteer launch...');

  const chromePath = findChrome();
  console.log('Using Chrome at:', chromePath);

  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    console.log('Browser launched successfully!');

    const page = await browser.newPage();
    console.log('New page created');

    // Try a simple navigation
    console.log('Navigating to example.com...');
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    console.log('Navigation successful');

    const title = await page.title();
    console.log('Page title:', title);

    // Now try ComicVine
    console.log('\nNavigating to ComicVine...');
    try {
      const response = await page.goto(
        'https://comicvine.gamespot.com/fire-force-1-the-fire-soldiers/4000-725206/',
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );

      console.log('ComicVine response status:', response?.status());

      const html = await page.content();
      console.log('Page content length:', html.length);

      // Check for Cloudflare
      if (html.includes('Just a moment')) {
        console.log('Cloudflare challenge detected! Waiting...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const html2 = await page.content();
        console.log('Page content after wait:', html2.length);

        if (html2.includes('Just a moment')) {
          console.log('Still showing Cloudflare challenge');
        } else {
          console.log('Cloudflare passed!');
        }
      }

      // Take a screenshot
      await page.screenshot({ path: '/tmp/comicvine-test.png' });
      console.log('Screenshot saved to /tmp/comicvine-test.png');

      // Extract page title
      const cvTitle = await page.title();
      console.log('ComicVine page title:', cvTitle);

      // Try to find concepts
      const concepts = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/concept/"]'));
        return links.map((link) => ({
          text: link.textContent?.trim(),
          href: (link as HTMLAnchorElement).href,
        }));
      });
      console.log('Found concept links:', concepts);
    } catch (error) {
      console.error('ComicVine navigation error:', error);
    }

    await browser.close();
    console.log('\nBrowser closed successfully');
  } catch (error) {
    console.error('Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

main().catch(console.error);
