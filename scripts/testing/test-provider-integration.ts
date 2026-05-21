#!/usr/bin/env tsx
/**
 * Test script for verifying provider integration after refactoring
 * 
 * Tests both legacy and new provider systems to ensure backward compatibility
 */

import { ProviderRegistry } from '../src/server/services/providers/registry';
import { MetadataProvider } from '@prisma/client';
import { unifiedProviderRegistry } from '../src/server/services/search/UnifiedProviderRegistry';
import { logger } from '../src/utils/logger';
import { isSuccess, isError } from '../src/utils/async-result';

async function testProviderRegistry() {
  console.log('\n========================================');
  console.log('Testing New Provider Registry');
  console.log('========================================\n');
  
  const registry = new ProviderRegistry();
  
  // Test 1: Check enabled providers
  console.log('1. Checking enabled providers...');
  const enabledProviders = registry.getEnabledProviders();
  console.log(`   Enabled providers: ${enabledProviders.join(', ')}`);
  
  // Test 2: Test Fandom provider search
  console.log('\n2. Testing Fandom provider search...');
  const fandomResult = await registry.searchWithProvider(
    MetadataProvider.FANDOM,
    'One Piece',
    { limit: 5 }
  );
  
  if (isSuccess(fandomResult)) {
    console.log(`   ✓ Fandom search successful: ${fandomResult.data.length} results`);
    if (fandomResult.data.length > 0) {
      console.log(`   First result: ${fandomResult.data[0].title}`);
    }
  } else {
    console.log(`   ✗ Fandom search failed: ${fandomResult.error.message}`);
  }
  
  // Test 3: Test Wikipedia provider search
  console.log('\n3. Testing Wikipedia provider search...');
  const wikipediaResult = await registry.searchWithProvider(
    MetadataProvider.WIKIPEDIA,
    'Naruto',
    { limit: 5 }
  );
  
  if (isSuccess(wikipediaResult)) {
    console.log(`   ✓ Wikipedia search successful: ${wikipediaResult.data.length} results`);
    if (wikipediaResult.data.length > 0) {
      console.log(`   First result: ${wikipediaResult.data[0].title}`);
    }
  } else {
    console.log(`   ✗ Wikipedia search failed: ${wikipediaResult.error.message}`);
  }
  
  // Test 4: Test multi-provider search
  console.log('\n4. Testing multi-provider search...');
  const multiResult = await registry.searchAll('Bleach', {
    limit: 3
  });
  
  if (isSuccess(multiResult)) {
    console.log(`   ✓ Multi-provider search successful: ${multiResult.data.length} total results`);
    
    // Group by provider
    const byProvider: Record<string, number> = {};
    multiResult.data.forEach(result => {
      const provider = result.provider.toLowerCase();
      byProvider[provider] = (byProvider[provider] || 0) + 1;
    });
    
    Object.entries(byProvider).forEach(([provider, count]) => {
      console.log(`     - ${provider}: ${count} results`);
    });
  } else {
    console.log(`   ✗ Multi-provider search failed: ${multiResult.error.message}`);
  }
  
  // Test 5: Test metadata fetching
  console.log('\n5. Testing metadata fetch...');
  if (isSuccess(fandomResult) && fandomResult.data.length > 0) {
    const firstResult = fandomResult.data[0];
    const metadataResult = await registry.getMetadataWithFallback(
      MetadataProvider.FANDOM,
      firstResult.id
    );
    
    if (isSuccess(metadataResult) && metadataResult.data) {
      console.log(`   ✓ Metadata fetch successful for: ${metadataResult.data.title}`);
      console.log(`     - Status: ${metadataResult.data.status}`);
      console.log(`     - Genres: ${metadataResult.data.genres?.join(', ') || 'N/A'}`);
    } else {
      console.log(`   ✗ Metadata fetch failed`);
    }
  }
}

async function testUnifiedSearchService() {
  console.log('\n========================================');
  console.log('Testing Unified Provider Registry');
  console.log('========================================\n');

  const service = unifiedProviderRegistry;
  
  // Test 1: Search with unified registry
  console.log('1. Testing search with unified registry...');
  const newRegistryResult = await service.searchAll('Dragon Ball', {
    limit: 5
  });
  
  if (newRegistryResult.length > 0) {
    console.log(`   ✓ Unified registry search successful: ${newRegistryResult.length} results`);
  } else {
    console.log(`   ✗ Unified registry search failed or returned no results`);
  }
  
  // Test 2: Search with specific provider
  console.log('\n2. Testing search with specific provider...');
  const specificProviderResult = await service.searchWithProvider('fandom', 'Hunter x Hunter', {
    limit: 5
  });
  
  if (specificProviderResult.length > 0) {
    console.log(`   ✓ Specific provider search successful: ${specificProviderResult.length} results`);
  } else {
    console.log(`   ✗ Specific provider search failed or returned no results`);
  }
  
  // Test 3: Get available providers
  console.log('\n3. Getting available providers...');
  const availableProviders = service.getAvailableProviders();
  console.log(`   Available providers: ${availableProviders.join(', ')}`);
}

async function testBackwardCompatibility() {
  console.log('\n========================================');
  console.log('Testing Backward Compatibility');
  console.log('========================================\n');
  
  // Test FandomServiceWrapper
  console.log('1. Testing FandomServiceWrapper...');
  try {
    const { FandomService } = await import('../src/server/services/providers/wrappers/FandomServiceWrapper');
    const fandomService = FandomService.getInstance();
    
    const searchResult = await fandomService.searchWiki({
      query: 'Attack on Titan',
      limit: 3
    });
    
    console.log(`   ✓ FandomService wrapper working: ${searchResult.items.length} results`);
  } catch (error) {
    console.log(`   ✗ FandomService wrapper error: ${error}`);
  }
  
  // Test WikipediaServiceWrapper
  console.log('\n2. Testing WikipediaServiceWrapper...');
  try {
    const { WikipediaService } = await import('../src/server/services/providers/wrappers/WikipediaServiceWrapper');
    const wikipediaService = WikipediaService.getInstance();
    
    const searchResult = await wikipediaService.search('Death Note', {
      limit: 3
    });
    
    console.log(`   ✓ WikipediaService wrapper working: ${searchResult.length} results`);
  } catch (error) {
    console.log(`   ✗ WikipediaService wrapper error: ${error}`);
  }
}

async function main() {
  try {
    console.log('Provider Integration Test Suite');
    console.log('================================\n');
    
    await testProviderRegistry();
    await testUnifiedSearchService();
    await testBackwardCompatibility();
    
    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);