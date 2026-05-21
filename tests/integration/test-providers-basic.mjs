#!/usr/bin/env node
/**
 * Basic test for provider search functionality
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc';

async function testProviders() {
  const providers = ['anilist', 'comicvine', 'fandom', 'wikipedia'];
  const query = 'One Piece';
  
  console.log(`Testing provider search for "${query}"...\n`);
  
  for (const provider of providers) {
    console.log(`Testing ${provider}...`);
    
    try {
      const params = encodeURIComponent(JSON.stringify({
        source: provider,
        keyword: query
      }));
      
      const response = await fetch(`${API_URL}/manga.search?input=${params}`);
      
      const data = await response.json();
      
      if (data?.error) {
        console.log(`❌ ${provider}: Error - ${data.error.message}`);
      } else if (data?.result?.data?.json?.length > 0) {
        const firstResult = data.result.data.json[0];
        console.log(`✅ ${provider}: Found "${firstResult.title || firstResult.name}"`);
      } else {
        console.log(`⚠️  ${provider}: No results found`);
      }
    } catch (error) {
      console.log(`❌ ${provider}: ${error.message}`);
    }
    
    console.log('');
  }
}

testProviders().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});