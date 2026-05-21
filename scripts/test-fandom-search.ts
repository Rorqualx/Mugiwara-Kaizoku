#!/usr/bin/env npx tsx

/**
 * Test script to debug Fandom API search and data extraction
 */

import { FandomService } from '../src/server/services/fandom/FandomService';
import { logger } from '../src/utils/logger';

const log = logger.child('FandomSearchTest');

async function testFandomSearch() {
  try {
    log.info('Starting Fandom search test for "Fire Force"');
    
    // Initialize Fandom service for the Fire Force wiki
    const fandomService = new FandomService('fireforce', {
      name: 'Fire Force',
      subdomain: 'fireforce',
      categories: {
        characters: 'Characters',
        chapters: 'Chapters',
        volumes: 'Volumes',
        arcs: 'Story Arcs'
      }
    });
    
    // Test 1: Search for manga (try without type filter first)
    log.info('Test 1: Searching for "Fire Force" (no type filter)');
    const searchResults = await fandomService.search('Fire Force', {
      type: 'all',
      limit: 10,
      includeDetails: true
    });
    
    log.info(`Found ${searchResults.length} results`);
    searchResults.forEach((result, index) => {
      log.info(`Result ${index + 1}:`, {
        id: result.id,
        title: result.title,
        type: result.type,
        url: result.url,
        score: result.score,
        thumbnail: result.thumbnail,
        abstract: result.abstract?.substring(0, 100) + '...',
        metadata: result.metadata
      });
    });
    
    // Test 2: Get detailed manga info
    if (searchResults.length > 0) {
      const mainMangaResult = searchResults.find(r => 
        r.title.toLowerCase().includes('manga') || 
        r.type === 'manga'
      ) || searchResults[0];
      
      log.info('\nTest 2: Getting detailed manga info for:', mainMangaResult.title);
      const mangaInfo = await fandomService.getMangaInfo(mainMangaResult.title);
      
      if (mangaInfo) {
        log.info('Manga details:', {
          title: mangaInfo.title,
          author: mangaInfo.author,
          publisher: mangaInfo.publisher,
          magazine: mangaInfo.magazine,
          published: mangaInfo.published,
          volumes: mangaInfo.volumes,
          chapters: mangaInfo.chapters,
          demographic: mangaInfo.demographic,
          status: mangaInfo.status,
          coverImage: mangaInfo.coverImage,
          synopsis: mangaInfo.synopsis?.substring(0, 200) + '...',
          genres: mangaInfo.genres,
          characterCount: mangaInfo.characters?.length
        });
      } else {
        log.warn('No detailed manga info found');
      }
    }
    
    // Clean up
    fandomService.destroy();
    log.info('Test completed successfully');
    
  } catch (error) {
    log.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFandomSearch().catch(console.error);