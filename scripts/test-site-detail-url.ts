#!/usr/bin/env npx tsx

/**
 * Test if ComicVine API returns site_detail_url with updated field list
 */

import axios from 'axios';

async function testSiteDetailUrl() {
  console.log('Testing ComicVine API for site_detail_url field...\n');

  const baseUrl = 'http://localhost:3000/api/trpc';

  try {
    // Search for Fire Force using the app's API
    console.log('Searching for Fire Force...');
    const params = encodeURIComponent(JSON.stringify({
      0: { json: { title: 'Fire Force', providers: ['comicvine'] } }
    }));
    const searchResponse = await axios.get(`${baseUrl}/manga.searchProviderConfirmation?batch=1&input=${params}`);

    if (searchResponse.data?.[0]?.result?.data?.json?.comicvine) {
      const results = searchResponse.data[0].result.data.json.comicvine;
      console.log(`\nFound ${results.length} results from ComicVine\n`);

      if (results.length > 0) {
        const firstResult = results[0];
        console.log('First result:');
        console.log('  ID:', firstResult.id);
        console.log('  Title:', firstResult.title);
        console.log('  site_detail_url:', firstResult.site_detail_url);
        console.log('  siteDetailUrl:', firstResult.siteDetailUrl);
        console.log('  url:', firstResult.url);
        console.log('  Volumes:', firstResult.volumes);
        console.log('  Chapters:', firstResult.chapters);

        // Check metadata
        if (firstResult.metadata) {
          console.log('\nMetadata rawData fields:');
          const rawData = firstResult.metadata.rawData || {};
          console.log('  site_detail_url:', rawData.site_detail_url);
          console.log('  Has site_detail_url:', !!rawData.site_detail_url);
        }

        // List all keys to see what's available
        console.log('\nAll keys in result:', Object.keys(firstResult).join(', '));
      }
    } else {
      console.log('No ComicVine results in response');
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSiteDetailUrl();