#!/usr/bin/env node

import fetch from 'node-fetch';

async function testChapterMetadataEndpoint() {
  const url = 'http://localhost:3000/api/trpc/metadata.fetchFandomChapterMetadata';
  const chapterUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';
  
  try {
    console.log('Testing fetchFandomChapterMetadata endpoint...');
    console.log('Chapter URL:', chapterUrl);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          url: chapterUrl
        }
      })
    });
    
    const result = await response.json();
    console.log('\n=== Response ===');
    console.log(JSON.stringify(result, null, 2));
    
    // tRPC returns the bare payload on success; errors come back as result.error
    if (result.error) {
      console.log('\n=== Error ===');
      console.log('Error:', result.error.json?.message ?? result.error);
    } else if (result.result?.data?.json) {
      const data = result.result.data.json;
      console.log('\n=== Extracted Metadata ===');
      console.log('Cover Image:', data.coverImageUrl);
      console.log('Title:', data.title);
      console.log('Chapter Number:', data.chapterNumber);
      console.log('Description:', data.description?.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

testChapterMetadataEndpoint();