/**
 * Stress Test Different Scraping Strategies
 *
 * Tests multiple approaches to bypass Cloudflare in HEADLESS mode:
 * 1. ComicVine API with full field_list (maybe concepts ARE returned?)
 * 2. Firefox headless (different fingerprint)
 * 3. Different user agents / headers
 * 4. Cloudscraper-style approach
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, firefox, webkit } from 'playwright';

const FIRE_FORCE_VOLUME_URL = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
const FIRE_FORCE_API_ID = '95557';
const API_KEY = process.env.COMICVINE_API_KEY;

// ============================================================================
// Strategy 1: Check if API returns concepts with expanded field_list
// ============================================================================
async function testStrategy1_FullApiRequest(): Promise<void> {
  console.log('\n=== Strategy 1: Full API Request with All Fields ===');

  if (!API_KEY) {
    console.log('❌ No API key - skipping API test');
    return;
  }

  try {
    // Request ALL possible fields
    const fieldList = [
      'name', 'description', 'site_detail_url', 'image',
      'concepts', 'characters', 'locations', 'objects', 'people',
      'themes', 'genres', 'publisher', 'start_year', 'count_of_issues'
    ].join(',');

    const url = `https://comicvine.gamespot.com/api/volume/4050-${FIRE_FORCE_API_ID}/?api_key=${API_KEY}&format=json&field_list=${fieldList}`;
    console.log('Requesting with field_list:', fieldList);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mugiwara-Kaizoku/1.0 (https://github.com/)',
      }
    });

    const result = response.data?.results;
    console.log('Response keys:', Object.keys(result || {}));

    // Check for concepts/themes in response
    console.log('concepts:', result?.concepts || 'NOT IN RESPONSE');
    console.log('themes:', result?.themes || 'NOT IN RESPONSE');
    console.log('genres:', result?.genres || 'NOT IN RESPONSE');

    if (result?.concepts && Array.isArray(result.concepts)) {
      console.log('✅ CONCEPTS FOUND IN API:', result.concepts.map((c: any) => c.name));
    }
  } catch (error: any) {
    console.log('❌ API Error:', error.response?.status, error.message);
  }
}

// ============================================================================
// Strategy 2: Firefox Headless (different fingerprint than Chromium)
// ============================================================================
async function testStrategy2_FirefoxHeadless(): Promise<void> {
  console.log('\n=== Strategy 2: Firefox Headless ===');

  const browser = await firefox.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();

    // Visit homepage first
    console.log('Visiting homepage...');
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    let homeTitle = await page.title();
    console.log('Homepage title:', homeTitle);

    // Navigate to target
    console.log('Navigating to Fire Force volume...');
    await page.goto(FIRE_FORCE_VOLUME_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    if (pageTitle.includes('Cloudflare') || pageTitle.includes('Attention')) {
      console.log('❌ Firefox headless: Cloudflare challenge detected');
    } else if (pageTitle.includes('Fire Force')) {
      console.log('✅ Firefox headless: Page loaded successfully!');

      // Try to extract themes
      const themes = await page.evaluate(() => {
        const themesDiv = document.querySelector('div[data-field="themes"]');
        if (themesDiv) {
          return Array.from(themesDiv.querySelectorAll('a')).map(a => a.textContent?.trim()).filter(Boolean);
        }
        return [];
      });
      console.log('Extracted themes:', themes);
    } else {
      console.log('⚠️ Unexpected page:', pageTitle);
    }

  } catch (error: any) {
    console.log('❌ Firefox error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Strategy 3: WebKit Headless (Safari-like)
// ============================================================================
async function testStrategy3_WebKitHeadless(): Promise<void> {
  console.log('\n=== Strategy 3: WebKit (Safari) Headless ===');

  const browser = await webkit.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    const page = await context.newPage();

    console.log('Navigating to Fire Force volume...');
    await page.goto(FIRE_FORCE_VOLUME_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    if (pageTitle.includes('Cloudflare') || pageTitle.includes('Attention')) {
      console.log('❌ WebKit headless: Cloudflare challenge detected');
    } else if (pageTitle.includes('Fire Force')) {
      console.log('✅ WebKit headless: Page loaded successfully!');
    } else {
      console.log('⚠️ Unexpected page:', pageTitle);
    }

  } catch (error: any) {
    console.log('❌ WebKit error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Strategy 4: Chromium with aggressive stealth settings
// ============================================================================
async function testStrategy4_ChromiumStealth(): Promise<void> {
  console.log('\n=== Strategy 4: Chromium with Aggressive Stealth ===');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-web-security',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--start-maximized',
      '--ignore-certificate-errors',
      '--allow-running-insecure-content',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      bypassCSP: true,
    });

    // Override webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // @ts-ignore
      delete navigator.__proto__.webdriver;

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    const page = await context.newPage();

    console.log('Navigating directly...');
    await page.goto(FIRE_FORCE_VOLUME_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    if (pageTitle.includes('Cloudflare') || pageTitle.includes('Attention')) {
      console.log('❌ Chromium stealth: Cloudflare challenge detected');

      // Try waiting longer for challenge to complete
      console.log('Waiting 15s for challenge to auto-complete...');
      await page.waitForTimeout(15000);
      const newTitle = await page.title();
      console.log('After wait, title:', newTitle);
    } else if (pageTitle.includes('Fire Force')) {
      console.log('✅ Chromium stealth: Page loaded successfully!');
    }

  } catch (error: any) {
    console.log('❌ Chromium stealth error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Strategy 5: Use cached/stored cookies from previous successful visit
// ============================================================================
async function testStrategy5_WithStoredCookies(): Promise<void> {
  console.log('\n=== Strategy 5: Pre-stored Cloudflare Cookies ===');

  // This would require manual cookie extraction from a real browser session
  // For now, just test if cookies help

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Add Cloudflare clearance cookie (would need to be obtained from real session)
    // This is a placeholder - real cookies would need to be extracted
    await context.addCookies([
      {
        name: 'cf_clearance',
        value: 'placeholder_would_need_real_value',
        domain: '.comicvine.gamespot.com',
        path: '/',
      }
    ]);

    const page = await context.newPage();
    await page.goto(FIRE_FORCE_VOLUME_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    console.log('(This strategy needs real cf_clearance cookies from a manual browser session)');

  } catch (error: any) {
    console.log('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Strategy 6: Raw HTTP with Cloudflare bypass headers
// ============================================================================
async function testStrategy6_RawHttpWithHeaders(): Promise<void> {
  console.log('\n=== Strategy 6: Raw HTTP with Various Headers ===');

  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'curl/8.4.0',  // Sometimes simpler is better
    'Googlebot/2.1 (+http://www.google.com/bot.html)',  // Pretend to be a bot that CF allows
  ];

  for (const ua of userAgents) {
    console.log(`\nTrying UA: ${ua.substring(0, 50)}...`);
    try {
      const response = await axios.get(FIRE_FORCE_VOLUME_URL, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
        timeout: 15000,
        maxRedirects: 5,
      });

      console.log(`✅ Status: ${response.status}`);

      const $ = cheerio.load(response.data);
      const title = $('title').text();
      console.log(`Page title: ${title}`);

      if (!title.includes('Cloudflare') && !title.includes('Attention')) {
        console.log('✅ SUCCESS! This UA bypassed Cloudflare');

        // Extract themes
        const themes: string[] = [];
        $('div[data-field="themes"] a').each((_, el) => {
          const text = $(el).text().trim();
          if (text) themes.push(text);
        });
        console.log('Themes:', themes);
        break;
      }
    } catch (error: any) {
      console.log(`❌ Status: ${error.response?.status || 'N/A'} - ${error.message}`);
    }
  }
}

// ============================================================================
// Strategy 7: Proxy-based scraping (Residential/IPv6)
// ============================================================================
async function testStrategy7_ProxyScraping(): Promise<void> {
  console.log('\n=== Strategy 7: Proxy-Based Scraping ===');

  // Free proxy list for testing (these may not work, just for demonstration)
  // In production, use paid residential proxies like:
  // - Bright Data (formerly Luminati)
  // - Oxylabs
  // - Smartproxy
  // - IPRoyal
  const testProxies = [
    // Format: protocol://host:port or protocol://user:pass@host:port
    // IPv6 proxies (if available)
    // 'http://[2001:db8::1]:8080',
    // Residential proxy services typically provide URLs like:
    // 'http://user:pass@proxy.brightdata.com:22225',
    // 'http://user:pass@pr.oxylabs.io:7777',
  ];

  // Test with environment variable proxy
  const envProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.SCRAPING_PROXY;

  if (envProxy) {
    console.log('Using proxy from environment:', envProxy.replace(/:[^:@]+@/, ':***@'));
    testProxies.push(envProxy);
  }

  if (testProxies.length === 0) {
    console.log('No proxies configured. Set SCRAPING_PROXY env var to test.');
    console.log('Example: SCRAPING_PROXY=http://user:pass@proxy.example.com:8080');
    return;
  }

  for (const proxy of testProxies) {
    console.log(`\nTrying proxy: ${proxy.replace(/:[^:@]+@/, ':***@')}`);

    try {
      // Test with axios through proxy
      const response = await axios.get(FIRE_FORCE_VOLUME_URL, {
        proxy: parseProxy(proxy),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      console.log(`✅ Status: ${response.status}`);
      const $ = cheerio.load(response.data);
      const title = $('title').text();
      console.log(`Page title: ${title}`);

      if (!title.includes('Cloudflare') && title.includes('Fire Force')) {
        console.log('✅ SUCCESS! Proxy bypassed Cloudflare');

        const themes: string[] = [];
        $('div[data-field="themes"] a').each((_, el) => {
          const text = $(el).text().trim();
          if (text) themes.push(text);
        });
        console.log('Themes:', themes);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Parse proxy URL into axios format
function parseProxy(proxyUrl: string): { host: string; port: number; auth?: { username: string; password: string } } | false {
  try {
    const url = new URL(proxyUrl);
    const result: { host: string; port: number; auth?: { username: string; password: string } } = {
      host: url.hostname,
      port: parseInt(url.port) || 8080,
    };
    if (url.username && url.password) {
      result.auth = {
        username: url.username,
        password: url.password,
      };
    }
    return result;
  } catch {
    return false;
  }
}

// ============================================================================
// Strategy 8: Playwright with Proxy
// ============================================================================
async function testStrategy8_PlaywrightWithProxy(): Promise<void> {
  console.log('\n=== Strategy 8: Playwright with Proxy ===');

  const proxyUrl = process.env.SCRAPING_PROXY;
  if (!proxyUrl) {
    console.log('No SCRAPING_PROXY env var set. Skipping.');
    return;
  }

  console.log('Using proxy:', proxyUrl.replace(/:[^:@]+@/, ':***@'));

  const proxyConfig = parseProxy(proxyUrl);
  if (!proxyConfig) {
    console.log('Invalid proxy URL');
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: `http://${proxyConfig.host}:${proxyConfig.port}`,
      username: proxyConfig.auth?.username,
      password: proxyConfig.auth?.password,
    },
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating through proxy...');
    await page.goto(FIRE_FORCE_VOLUME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    if (pageTitle.includes('Cloudflare') || pageTitle.includes('Attention')) {
      console.log('❌ Still blocked even with proxy');
    } else if (pageTitle.includes('Fire Force')) {
      console.log('✅ SUCCESS! Proxy + Playwright bypassed Cloudflare');

      const themes = await page.evaluate(() => {
        const themesDiv = document.querySelector('div[data-field="themes"]');
        if (themesDiv) {
          return Array.from(themesDiv.querySelectorAll('a')).map(a => a.textContent?.trim()).filter(Boolean);
        }
        return [];
      });
      console.log('Themes:', themes);
    }

  } catch (error: any) {
    console.log('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// ============================================================================
// Strategy 9: FlareSolverr (external Cloudflare bypass service)
// ============================================================================
async function testStrategy9_FlareSolverr(): Promise<void> {
  console.log('\n=== Strategy 9: FlareSolverr ===');

  const flareSolverrUrl = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';

  console.log('FlareSolverr URL:', flareSolverrUrl);
  console.log('(Run: docker run -d -p 8191:8191 flaresolverr/flaresolverr)');

  try {
    const response = await axios.post(flareSolverrUrl, {
      cmd: 'request.get',
      url: FIRE_FORCE_VOLUME_URL,
      maxTimeout: 60000,
    }, {
      timeout: 70000,
    });

    if (response.data?.solution?.response) {
      const html = response.data.solution.response;
      const $ = cheerio.load(html);
      const title = $('title').text();
      console.log('Page title:', title);

      if (title.includes('Fire Force')) {
        console.log('✅ SUCCESS! FlareSolverr bypassed Cloudflare');

        const themes: string[] = [];
        $('div[data-field="themes"] a').each((_, el) => {
          const text = $(el).text().trim();
          if (text) themes.push(text);
        });
        console.log('Themes:', themes);
      }
    } else {
      console.log('❌ FlareSolverr response:', response.data?.status);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ FlareSolverr not running. Start it with:');
      console.log('   docker run -d -p 8191:8191 flaresolverr/flaresolverr');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// ============================================================================
// Main
// ============================================================================
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Scraping Strategy Stress Test');
  console.log('Target: ComicVine Fire Force volume page');
  console.log('Goal: Find a headless approach that bypasses Cloudflare');
  console.log('='.repeat(60));

  // Quick tests first
  await testStrategy1_FullApiRequest();
  await testStrategy6_RawHttpWithHeaders();

  // Headless browser tests
  await testStrategy2_FirefoxHeadless();
  // await testStrategy3_WebKitHeadless();  // Needs npx playwright install
  await testStrategy4_ChromiumStealth();

  // Proxy-based tests
  await testStrategy7_ProxyScraping();
  await testStrategy8_PlaywrightWithProxy();

  // External service tests
  await testStrategy9_FlareSolverr();

  console.log('\n' + '='.repeat(60));
  console.log('Stress test complete');
  console.log('\nRecommendations:');
  console.log('1. Best: FlareSolverr (Docker container, handles Cloudflare automatically)');
  console.log('2. Good: Residential proxy + Playwright (paid service required)');
  console.log('3. Alternative: Manual cookie extraction from real browser session');
  console.log('='.repeat(60));
}

main().catch(console.error);
