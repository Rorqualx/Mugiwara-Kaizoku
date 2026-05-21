#!/usr/bin/env npx tsx
/**
 * Test script to verify Chapter 6, 7, 8 cover extraction
 */

import { ChapterDetailService } from '../src/server/services/fandom/chapterDetailService';

async function testChapters678() {
  console.log('Testing Chapters 6, 7, 8 cover extraction...\n');
  
  const service = new ChapterDetailService();
  
  const testChapters = [
    'https://fire-force.fandom.com/wiki/Chapter_6',
    'https://fire-force.fandom.com/wiki/Chapter_7', 
    'https://fire-force.fandom.com/wiki/Chapter_8'
  ];
  
  for (const url of testChapters) {
    console.log(`\nFetching: ${url}`);
    const details = await service.fetchChapterDetails(url);
    
    if (details) {
      console.log(`Chapter ${details.chapterNumber}:`);
      console.log(`  Title: ${details.title}`);
      console.log(`  Has cover: ${details.coverImageUrl ? '✅ YES' : '❌ NO'}`);
      if (details.coverImageUrl) {
        console.log(`  Cover URL: ${details.coverImageUrl}`);
        console.log(`  Original: ${details.coverImageUrl.includes('url=') ? decodeURIComponent(details.coverImageUrl.split('url=')[1]) : 'N/A'}`);
      } else {
        console.log(`  ⚠️ No cover image found for Chapter ${details.chapterNumber}`);
      }
    } else {
      console.log(`  ❌ Failed to fetch chapter details`);
    }
  }
}

testChapters678().catch(console.error);