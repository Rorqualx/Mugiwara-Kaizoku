#!/usr/bin/env bun

/**
 * Test script to trigger AniList search and generate debug logs
 * This will help us see if our enhanced filtering logic is working
 */

import { anilistProvider } from '@/server/services/search/providers/AniListProvider';
import { logger } from '@/utils/logger';

async function testAniListSearch() {
  console.log('🚀 Testing AniList search with adult filtering...');

  try {
    // Test search for "Fire Force" with adult filtering enabled
    const query = 'Fire Force';
    const options = {
      includeAdult: false, // Explicitly disable adult content
      limit: 20
    };

    console.log(`🔍 Searching for: "${query}" with options:`, options);

    const results = await anilistProvider.search(query, options);

    console.log(`📊 Search completed. Found ${results.length} results`);

    // Log details about each result
    results.forEach((result, index) => {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log(`Title: ${result.title}`);
      console.log(`ID: ${result.id}`);
      console.log(`Provider: ${result.provider}`);
      console.log(`Genres: ${result.genres?.join(', ') || 'None'}`);
      console.log(`Tags: ${Array.isArray(result.tags) ? result.tags.join(', ') : 'None'}`);

      // Check if this might be the problematic Hentai content
      if (result.title.toLowerCase().includes('first time') ||
          result.title.toLowerCase().includes('hentai')) {
        console.log('⚠️  WARNING: This might be the problematic Hentai content!');
      }
    });

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAniListSearch().catch(console.error);