#!/usr/bin/env node

/**
 * Test script for enhanced Fandom parser with chapter cover fetching
 */

import axios from 'axios';
// cheerio import removed - not used directly in this test
import { parseVolumeTablesEnhanced } from './src/api/metadataProviders/utils/fandomTableParser.js';

const testUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';

async function testEnhancedParsing() {
  console.log('Testing enhanced Fandom parser with chapter cover fetching...\n');
  
  try {
    // Fetch the page
    console.log(`Fetching: ${testUrl}`);
    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    console.log('Page fetched successfully\n');
    
    // Parse without enhanced features first
    console.log('Parsing without enhanced features...');
    const basicVolumes = await parseVolumeTablesEnhanced(html, {
      followChapterLinks: false
    });
    
    console.log(`Found ${basicVolumes.length} volumes`);
    if (basicVolumes.length > 0) {
      const firstVolume = basicVolumes[0];
      console.log(`\nVolume 1 has ${firstVolume.chapters.length} chapters`);
      if (firstVolume.chapters.length > 0) {
        const firstChapter = firstVolume.chapters[0];
        console.log(`Chapter 1: ${firstChapter.title}`);
        console.log(`  URL: ${firstChapter.url || 'none'}`);
        console.log(`  Cover: ${firstChapter.coverImageUrl || 'none'}`);
      }
    }
    
    // Parse with enhanced features
    console.log('\n\nParsing WITH enhanced features (fetching chapter covers)...');
    const enhancedVolumes = await parseVolumeTablesEnhanced(html, {
      followChapterLinks: true,
      maxChaptersToFetch: 5, // Just fetch first 5 chapters as a test
      delayBetweenFetches: 500,
      wikiBaseUrl: 'https://fire-force.fandom.com'
    });
    
    console.log(`Found ${enhancedVolumes.length} volumes`);
    if (enhancedVolumes.length > 0) {
      const firstVolume = enhancedVolumes[0];
      console.log(`\nVolume 1 has ${firstVolume.chapters.length} chapters`);
      
      // Show details of first 3 chapters
      const chaptersToShow = Math.min(3, firstVolume.chapters.length);
      for (let i = 0; i < chaptersToShow; i++) {
        const chapter = firstVolume.chapters[i];
        console.log(`\nChapter ${chapter.chapterNumber}:`);
        console.log(`  Title: ${chapter.title}`);
        console.log(`  URL: ${chapter.url || 'none'}`);
        console.log(`  Cover: ${chapter.coverImageUrl || 'none'}`);
        console.log(`  Description: ${chapter.description ? chapter.description.substring(0, 100) + '...' : 'none'}`);
        console.log(`  Page Count: ${chapter.pageCount || 'unknown'}`);
      }
    }
    
    // Count how many chapters have covers
    let chaptersWithCovers = 0;
    let totalChapters = 0;
    for (const volume of enhancedVolumes) {
      for (const chapter of volume.chapters) {
        totalChapters++;
        if (chapter.coverImageUrl) {
          chaptersWithCovers++;
        }
      }
    }
    
    console.log(`\n\nSummary:`);
    console.log(`Total chapters: ${totalChapters}`);
    console.log(`Chapters with covers: ${chaptersWithCovers}`);
    console.log(`Coverage: ${((chaptersWithCovers / totalChapters) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEnhancedParsing();