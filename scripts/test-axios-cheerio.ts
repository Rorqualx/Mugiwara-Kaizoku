/**
 * Test axios+cheerio scraping for ComicVine
 *
 * See exactly what data we get back before/when Cloudflare blocks
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Testing axios+cheerio on ComicVine');
  console.log('='.repeat(60));

  const volumeUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  console.log('\nURL:', volumeUrl);

  try {
    console.log('\n--- Making axios request ---');
    const response = await axios.get(volumeUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => true, // Accept all status codes
    });

    console.log('\n=== RESPONSE INFO ===');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));

    // Check content type
    const contentType = response.headers['content-type'];
    console.log('\nContent-Type:', contentType);

    // Get the HTML
    const html = response.data;
    console.log('\nHTML Length:', typeof html === 'string' ? html.length : 'not a string');

    if (typeof html === 'string') {
      // Load with cheerio
      const $ = cheerio.load(html);

      console.log('\n=== PAGE DATA ===');
      console.log('Title:', $('title').text());

      // Check if it's a Cloudflare challenge page
      const isCloudflare = html.includes('Cloudflare') ||
                           html.includes('cf-browser-verification') ||
                           html.includes('challenge-platform');
      console.log('Is Cloudflare Challenge:', isCloudflare);

      if (isCloudflare) {
        console.log('\n--- Cloudflare Challenge Detected ---');
        // Show what Cloudflare returns
        console.log('Challenge form:', $('form').attr('action') ?? 'none');
        console.log('Ray ID:', $('[data-ray]').attr('data-ray') ?? 'none');
      } else {
        // Try to extract actual data
        console.log('\n--- Page Content ---');

        // Volume title
        const volumeTitle = $('h1.wiki-title, h1').first().text().trim();
        console.log('Volume Title:', volumeTitle);

        // Description
        const description = $('.wiki-item-display p').first().text().trim().substring(0, 200);
        console.log('Description:', description + '...');

        // Try to find themes
        console.log('\n--- Looking for Themes ---');

        // Method 1: From table
        $('th').each((_, el) => {
          const text = $(el).text().trim().toLowerCase();
          if (text === 'themes') {
            const td = $(el).next('td');
            const themes = td.find('.wiki-item-display a').map((_, a) => $(a).text().trim()).get();
            console.log('Themes from table:', themes);
          }
        });

        // Method 2: From sidebar
        $('.wiki-details-object').each((_, section) => {
          const header = $(section).find('h3').text().trim().toLowerCase();
          if (header === 'concepts' || header === 'themes') {
            const items = $(section).find('.wiki-item-display a').map((_, a) => $(a).text().trim()).get();
            console.log(`${header} from sidebar:`, items);
          }
        });

        // Characters
        const characters = $('.wiki-details-object').filter((_, el) => {
          return $(el).find('h3').text().trim().toLowerCase() === 'characters';
        }).find('.wiki-item-display a').map((_, a) => $(a).text().trim()).get().slice(0, 10);
        console.log('\nCharacters:', characters);

        // Publisher
        $('dt').each((_, el) => {
          if ($(el).text().trim().toLowerCase() === 'publisher') {
            console.log('Publisher:', $(el).next('dd').text().trim());
          }
        });
      }

      // Show first 500 chars of HTML for debugging
      console.log('\n=== FIRST 500 CHARS OF HTML ===');
      console.log(html.substring(0, 500));
    }

  } catch (error: unknown) {
    console.log('\n=== ERROR ===');
    if (axios.isAxiosError(error)) {
      console.log('Axios Error:', error.message);
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Headers:', error.response?.headers);

      // Show response body even on error
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          console.log('\nResponse body (first 500 chars):');
          console.log(data.substring(0, 500));
        }
      }
    } else {
      console.log('Error:', error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
