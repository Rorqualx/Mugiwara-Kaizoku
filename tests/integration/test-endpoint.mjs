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
    
    if (result.result?.data?.json) {
      const data = result.result.data.json;
      console.log('\n=== Extracted Metadata ===');
      console.log('Status:', data.status);
      if (data.status === 'success' && data.data) {
        console.log('Cover Image:', data.data.coverImageUrl);
        console.log('Title:', data.data.title);
        console.log('Chapter Number:', data.data.chapterNumber);
        console.log('Description:', data.data.description?.substring(0, 100) + '...');
      } else if (data.status === 'error') {
        console.log('Error:', data.error);
      }
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

testChapterMetadataEndpoint();