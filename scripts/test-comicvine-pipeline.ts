/**
 * Test ComicVine Pipeline
 *
 * Tests each step of the ComicVine data flow to identify where themes are lost
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const COMICVINE_API_KEY = process.env.COMICVINE_API_KEY;

// Test URLs
const FIRE_FORCE_VOLUME_URL = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
const FIRE_FORCE_API_ID = '95557';

async function testStep1_ApiReturnsUrl(): Promise<string | null> {
  console.log('\n=== STEP 1: Does ComicVine API return site_detail_url? ===');

  if (!COMICVINE_API_KEY) {
    console.log('❌ No API key found in COMICVINE_API_KEY env var');
    return null;
  }

  try {
    const url = `https://comicvine.gamespot.com/api/volume/4050-${FIRE_FORCE_API_ID}/?api_key=${COMICVINE_API_KEY}&format=json`;
    console.log('Fetching:', url.replace(COMICVINE_API_KEY, 'API_KEY_HIDDEN'));

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    });

    const result = response.data?.results;
    console.log('API Response keys:', Object.keys(result || {}));
    console.log('site_detail_url:', result?.site_detail_url || 'NOT FOUND');
    console.log('name:', result?.name);
    console.log('Has concepts?:', !!result?.concepts);

    if (result?.concepts) {
      console.log('Concepts from API:', result.concepts.map((c: any) => c.name));
    }

    return result?.site_detail_url || null;
  } catch (error: any) {
    console.log('❌ API Error:', error.message);
    console.log('Status:', error.response?.status);
    return null;
  }
}

async function testStep2_AxiosCanFetchPage(url: string): Promise<string | null> {
  console.log('\n=== STEP 2: Can axios fetch the page? ===');
  console.log('URL:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
    });

    console.log('✅ Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('HTML length:', response.data?.length || 0);

    // Check if it's a Cloudflare challenge page
    if (response.data?.includes('cloudflare') && response.data?.includes('challenge')) {
      console.log('⚠️ Cloudflare challenge page detected!');
      return null;
    }

    // Check if it looks like the real page
    if (response.data?.includes('Fire Force')) {
      console.log('✅ Page contains "Fire Force" - looks correct');
    } else {
      console.log('⚠️ Page does NOT contain "Fire Force"');
    }

    return response.data;
  } catch (error: any) {
    console.log('❌ Axios Error:', error.message);
    console.log('Status:', error.response?.status);

    if (error.response?.status === 403) {
      console.log('⚠️ HTTP 403 - Cloudflare blocking!');
    }

    return null;
  }
}

async function testStep3_CheerioExtractsThemes(html: string): Promise<string[]> {
  console.log('\n=== STEP 3: Does cheerio find themes? ===');

  const $ = cheerio.load(html);

  // Test different selectors for themes
  const selectors = [
    'div[data-field="themes"]',
    'div[data-field="themes"] a',
    '[data-field="themes"]',
    '.wiki-item-display',
    'th:contains("Themes")',
    'dt:contains("Themes")',
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    console.log(`Selector "${selector}": found ${elements.length} elements`);
  }

  // Extract themes using the known working selector
  const themes: string[] = [];
  const themesDiv = $('div[data-field="themes"]');

  if (themesDiv.length > 0) {
    console.log('✅ Found div[data-field="themes"]');
    themesDiv.find('a').each((_, link) => {
      const text = $(link).text().trim();
      if (text && text.length > 1 && !themes.includes(text)) {
        themes.push(text);
      }
    });
  } else {
    console.log('❌ div[data-field="themes"] NOT found');

    // Try to find what data-field attributes exist
    $('[data-field]').each((_, el) => {
      const field = $(el).attr('data-field');
      console.log(`Found data-field="${field}"`);
    });
  }

  console.log('Extracted themes:', themes);
  return themes;
}

async function testStep4_ScrapingServiceReturnsThemes(): Promise<void> {
  console.log('\n=== STEP 4: Does scrapingService return themes? ===');

  try {
    // Dynamic import to test the actual service
    const { comicVineScraper } = await import('../src/server/services/comicvine/scrapingService');

    console.log('Calling scrapeVolumeChapters with:', FIRE_FORCE_VOLUME_URL);
    const result = await comicVineScraper.scrapeVolumeChapters(FIRE_FORCE_VOLUME_URL);

    if (result) {
      console.log('✅ Got result from scrapingService');
      console.log('volumeTitle:', result.volumeTitle);
      console.log('themes:', result.themes);
      console.log('genres:', result.genres);
      console.log('chapters count:', result.chapters?.length);
    } else {
      console.log('❌ scrapingService returned null');
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testStep5_MetadataExtractor(): Promise<void> {
  console.log('\n=== STEP 5: Test metadata extractor directly ===');

  try {
    const response = await axios.get(FIRE_FORCE_VOLUME_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // Import and test the extractor
    const { extractVolumeMetadata } = await import('../src/server/services/comicvine/metadata-extractor');
    const metadata = extractVolumeMetadata($, FIRE_FORCE_VOLUME_URL);

    console.log('Metadata from extractor:');
    console.log('  volumeTitle:', metadata.volumeTitle);
    console.log('  themes:', metadata.themes);
    console.log('  genres:', metadata.genres);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    console.log('Status:', error.response?.status);
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ComicVine Pipeline Test');
  console.log('Testing: Fire Force (Volume ID: 95557)');
  console.log('='.repeat(60));

  // Step 1: Check API
  const siteUrl = await testStep1_ApiReturnsUrl();

  // Step 2: Test axios fetch
  const testUrl = siteUrl || FIRE_FORCE_VOLUME_URL;
  const html = await testStep2_AxiosCanFetchPage(testUrl);

  // Step 3: Test cheerio extraction
  if (html) {
    await testStep3_CheerioExtractsThemes(html);
  }

  // Step 4: Test the actual scraping service
  await testStep4_ScrapingServiceReturnsThemes();

  // Step 5: Test metadata extractor
  await testStep5_MetadataExtractor();

  console.log('\n' + '='.repeat(60));
  console.log('Test complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
