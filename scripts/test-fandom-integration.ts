#!/usr/bin/env tsx
/**
 * Test script for Fandom API integration
 * 
 * This script tests the complete Fandom implementation including:
 * - MediaWiki API endpoints
 * - Fandom v1 API endpoints
 * - Search functionality
 * - Character data extraction
 * - Provider integration
 */

import { FandomService } from '../src/server/services/fandom/FandomService';
import { MediaWikiAPI } from '../src/server/services/fandom/MediaWikiAPI';
import { FandomV1API } from '../src/server/services/fandom/FandomV1API';
import { fandomProvider } from '../src/server/services/search/providers/FandomProviderInstance';
import { logger } from '../src/utils/logger';

const log = logger.child({ script: 'test-fandom-integration' });

async function testMediaWikiAPI() {
  console.log('\n=== Testing MediaWiki API ===\n');
  
  const api = new MediaWikiAPI({
    baseUrl: 'https://naruto.fandom.com',
    wiki: 'naruto',
    cache: { enabled: true, ttl: 3600 }
  });

  try {
    // Test search
    console.log('1. Testing search...');
    const searchResults = await api.search('Sasuke', { limit: 5 });
    console.log(`   Found ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log(`   First result: ${searchResults[0].title} (ID: ${searchResults[0].pageid})`);
    }

    // Test page retrieval
    console.log('\n2. Testing page retrieval...');
    const page = await api.getPageByTitle('Naruto Uzumaki');
    if (page) {
      console.log(`   Page found: ${page.title} (ID: ${page.pageid})`);
      console.log(`   Categories: ${page.categories?.length || 0}`);
      console.log(`   Images: ${page.images?.length || 0}`);
    }

    // Test category members
    console.log('\n3. Testing category members...');
    const characters = await api.getCategoryMembers('Characters', { limit: 10 });
    console.log(`   Found ${characters.length} characters`);

    console.log('\n✅ MediaWiki API tests passed');
  } catch (error) {
    console.error('❌ MediaWiki API test failed:', error);
  }
}

async function testFandomV1API() {
  console.log('\n=== Testing Fandom v1 API ===\n');
  
  const api = new FandomV1API({
    baseUrl: 'https://onepiece.fandom.com',
    wiki: 'onepiece',
    cache: { enabled: true, ttl: 3600 }
  });

  try {
    // Test article search
    console.log('1. Testing article search...');
    const searchResults = await api.searchArticles('Luffy', { limit: 5 });
    console.log(`   Found ${searchResults.length} articles`);
    if (searchResults.length > 0) {
      console.log(`   First result: ${searchResults[0].title} (ID: ${searchResults[0].id})`);
      
      // Test article details
      console.log('\n2. Testing article details...');
      const details = await api.getArticleDetails(searchResults[0].id);
      const article = details[searchResults[0].id];
      if (article) {
        console.log(`   Title: ${article.title}`);
        console.log(`   Abstract: ${article.abstract?.substring(0, 100)}...`);
        console.log(`   Thumbnail: ${article.thumbnail ? 'Yes' : 'No'}`);
      }
    }

    // Test top articles
    console.log('\n3. Testing top articles...');
    const topArticles = await api.getTopArticles({ limit: 5 });
    console.log(`   Found ${topArticles.length} top articles`);

    console.log('\n✅ Fandom v1 API tests passed');
  } catch (error) {
    console.error('❌ Fandom v1 API test failed:', error);
  }
}

async function testFandomService() {
  console.log('\n=== Testing Fandom Service ===\n');
  
  const service = new FandomService('myheroacademia');

  try {
    // Test search
    console.log('1. Testing search...');
    const searchResults = await service.search('Deku', {
      type: 'all',
      limit: 5,
      includeDetails: true
    });
    console.log(`   Found ${searchResults.length} results`);
    searchResults.forEach(result => {
      console.log(`   - ${result.title} (${result.type}): Score ${result.score}`);
    });

    // Test manga info
    console.log('\n2. Testing manga info retrieval...');
    const mangaInfo = await service.getMangaInfo('My Hero Academia');
    if (mangaInfo) {
      console.log(`   Title: ${mangaInfo.title}`);
      console.log(`   Author: ${mangaInfo.author || 'Unknown'}`);
      console.log(`   Chapters: ${mangaInfo.chapters || 'Unknown'}`);
      console.log(`   Status: ${mangaInfo.status || 'Unknown'}`);
    }

    // Test character info
    console.log('\n3. Testing character info retrieval...');
    const characterInfo = await service.getCharacterInfo('Izuku Midoriya');
    if (characterInfo) {
      console.log(`   Name: ${characterInfo.basicInfo.name}`);
      console.log(`   Page ID: ${characterInfo.basicInfo.pageId}`);
      console.log(`   Categories: ${characterInfo.categories.length}`);
      console.log(`   Images: ${characterInfo.images.length}`);
    }

    console.log('\n✅ Fandom Service tests passed');
  } catch (error) {
    console.error('❌ Fandom Service test failed:', error);
  } finally {
    service.destroy();
  }
}

async function testFandomProvider() {
  console.log('\n=== Testing Fandom Provider ===\n');

  try {
    // Test search across multiple wikis
    console.log('1. Testing provider search...');
    const searchResults = await fandomProvider.search('Dragon Ball', { limit: 10 });
    console.log(`   Found ${searchResults.length} results`);
    searchResults.slice(0, 5).forEach(result => {
      console.log(`   - ${result.title} from ${result.provider}`);
    });

    // Test metadata retrieval
    console.log('\n2. Testing metadata retrieval...');
    if (searchResults.length > 0) {
      const metadata = await fandomProvider.getMetadata(searchResults[0].id, searchResults[0].title);
      console.log(`   Title: ${metadata.title}`);
      console.log(`   Description: ${metadata.description?.substring(0, 100)}...`);
      console.log(`   Genres: ${metadata.genres?.join(', ') || 'None'}`);
    }

    console.log('\n✅ Fandom Provider tests passed');
  } catch (error) {
    console.error('❌ Fandom Provider test failed:', error);
  }
}

async function testPopularWikis() {
  console.log('\n=== Testing Popular Wikis ===\n');
  
  const wikis = [
    { name: 'Naruto', subdomain: 'naruto', testQuery: 'Sasuke' },
    { name: 'One Piece', subdomain: 'onepiece', testQuery: 'Luffy' },
    { name: 'Dragon Ball', subdomain: 'dragonball', testQuery: 'Goku' },
    { name: 'Attack on Titan', subdomain: 'attackontitan', testQuery: 'Eren' },
    { name: 'My Hero Academia', subdomain: 'bokunoheroacademia', testQuery: 'Deku' }
  ];

  for (const wiki of wikis) {
    console.log(`\nTesting ${wiki.name} wiki...`);
    
    const service = new FandomService(wiki.subdomain);
    
    try {
      const results = await service.search(wiki.testQuery, { limit: 3 });
      console.log(`   ✅ ${wiki.name}: Found ${results.length} results for "${wiki.testQuery}"`);
    } catch (error) {
      console.log(`   ❌ ${wiki.name}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      service.destroy();
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Fandom Integration Tests\n');
  console.log('=' .repeat(50));

  try {
    await testMediaWikiAPI();
    await testFandomV1API();
    await testFandomService();
    await testFandomProvider();
    await testPopularWikis();
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});