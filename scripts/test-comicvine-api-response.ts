#!/usr/bin/env npx tsx

/**
 * Test script to check what URLs are returned from ComicVine API
 */

import axios from 'axios';

const COMICVINE_API_KEY = process.env.COMICVINE_API_KEY || 'e965e6f948e7e604e62e2cfb8e5c3e960bb90b48';
const COMICVINE_API_URL = 'https://comicvine.gamespot.com/api';

async function testComicVineAPI() {
  try {
    console.log('=== Testing ComicVine API Response ===\n');

    // Search for Fire Force
    console.log('Searching for Fire Force series...');
    const searchResponse = await axios.get(`${COMICVINE_API_URL}/search/`, {
      params: {
        api_key: COMICVINE_API_KEY,
        format: 'json',
        query: 'Fire Force',
        resources: 'volume',
        limit: 1
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const searchResults = searchResponse.data.results;
    if (searchResults.length === 0) {
      console.log('No results found');
      return;
    }

    const series = searchResults[0];
    console.log('\n=== Series Data ===');
    console.log('ID:', series.id);
    console.log('Name:', series.name);
    console.log('api_detail_url:', series.api_detail_url);
    console.log('site_detail_url:', series.site_detail_url);
    console.log('url:', series.url);

    // Get issues for the series
    console.log('\n=== Fetching Issues ===');
    const issuesResponse = await axios.get(`${COMICVINE_API_URL}/issues/`, {
      params: {
        api_key: COMICVINE_API_KEY,
        format: 'json',
        filter: `volume:${series.id}`,
        limit: 3,
        sort: 'issue_number:asc'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const issues = issuesResponse.data.results;
    console.log(`Found ${issues.length} issues\n`);

    issues.forEach((issue, index) => {
      console.log(`Issue ${index + 1}:`);
      console.log('  ID:', issue.id);
      console.log('  Issue Number:', issue.issue_number);
      console.log('  Name:', issue.name);
      console.log('  api_detail_url:', issue.api_detail_url);
      console.log('  site_detail_url:', issue.site_detail_url);
      console.log('  url:', issue.url);
      console.log('  All keys:', Object.keys(issue).join(', '));
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testComicVineAPI();