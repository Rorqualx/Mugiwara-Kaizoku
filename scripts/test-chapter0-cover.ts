#!/usr/bin/env npx tsx
/**
 * Test script to verify Chapter 0 cover extraction
 */

import { ChapterDetailService } from '../src/server/services/fandom/chapterDetailService';

async function testChapter0Cover() {
  console.log('Testing Chapter 0 cover extraction...\n');
  
  const service = new ChapterDetailService();
  const chapterUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';
  
  console.log(`Fetching details from: ${chapterUrl}`);
  
  const result = await service.fetchChapterDetails(chapterUrl);
  
  if (result) {
    console.log('\n✅ Successfully fetched chapter details:');
    console.log('Chapter Number:', result.chapterNumber);
    console.log('Title:', result.title);
    console.log('Cover Image URL:', result.coverImageUrl);
    console.log('Description:', result.description?.substring(0, 100) + '...');
    
    if (result.coverImageUrl) {
      console.log('\n✅ Chapter 0 cover image found!');
      console.log('Cover URL:', result.coverImageUrl);
    } else {
      console.log('\n❌ No cover image found for Chapter 0');
    }
  } else {
    console.log('\n❌ Failed to fetch chapter details');
  }
  
  // Test a few more chapters for comparison
  console.log('\n\nTesting additional chapters for comparison...');
  const testChapters = [
    'https://fire-force.fandom.com/wiki/Chapter_1',
    'https://fire-force.fandom.com/wiki/Chapter_2',
    'https://fire-force.fandom.com/wiki/Chapter_10'
  ];
  
  for (const url of testChapters) {
    const details = await service.fetchChapterDetails(url);
    if (details) {
      console.log(`\nChapter ${details.chapterNumber}: ${details.coverImageUrl ? '✅ Has cover' : '❌ No cover'}`);
      if (details.coverImageUrl) {
        console.log(`  Cover: ${details.coverImageUrl.substring(0, 80)}...`);
      }
    }
  }
}

testChapter0Cover().catch(console.error);