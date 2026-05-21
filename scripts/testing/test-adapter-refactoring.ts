#!/usr/bin/env tsx
/**
 * Test script for verifying adapter refactoring
 * 
 * Tests the new UnifiedBaseAdapter, AdapterFactory, and migrated adapters
 */

import { AdapterFactory, getAdapterFactory, createAdapter } from '../src/server/adapters/AdapterFactory';
import { AniListAdapter } from '../src/server/adapters/unified/AniListAdapter';
import { isSuccess, isError } from '../src/utils/async-result';
import { logger } from '../src/utils/logger';

async function testAdapterFactory() {
  console.log('\n========================================');
  console.log('Testing Adapter Factory');
  console.log('========================================\n');
  
  const factory = getAdapterFactory();
  
  // Test 1: Check registered adapter types
  console.log('1. Checking registered adapter types...');
  const types = factory.getRegisteredTypes();
  console.log(`   Registered types: ${types.join(', ')}`);
  
  // Test 2: Create AniList adapter via factory
  console.log('\n2. Creating AniList adapter via factory...');
  const anilistAdapter = factory.createAdapter('anilist', {
    config: { enabled: true }
  });
  
  if (anilistAdapter) {
    console.log(`   ✓ AniList adapter created successfully`);
    console.log(`   - Enabled: ${anilistAdapter.isEnabled()}`);
    console.log(`   - Source: ${JSON.stringify(anilistAdapter.getSourceInfo())}`);
  } else {
    console.log(`   ✗ Failed to create AniList adapter`);
  }
  
  // Test 3: Test singleton behavior
  console.log('\n3. Testing singleton behavior...');
  const adapter1 = factory.createAdapter('anilist');
  const adapter2 = factory.createAdapter('anilist');
  
  if (adapter1 === adapter2) {
    console.log(`   ✓ Singleton pattern working correctly`);
  } else {
    console.log(`   ✗ Singleton pattern not working`);
  }
  
  // Test 4: Create with force new
  console.log('\n4. Testing force new instance...');
  const adapter3 = factory.createAdapter('anilist', { forceNew: true });
  
  if (adapter3 !== adapter1) {
    console.log(`   ✓ Force new instance created`);
  } else {
    console.log(`   ✗ Force new instance failed`);
  }
  
  // Test 5: Get enabled adapters
  console.log('\n5. Getting enabled adapters...');
  const enabledAdapters = factory.getEnabledAdapters();
  console.log(`   Found ${enabledAdapters.length} enabled adapters:`);
  enabledAdapters.forEach(({ type, adapter }) => {
    console.log(`   - ${type}: ${adapter.isEnabled()}`);
  });
}

async function testUnifiedAniListAdapter() {
  console.log('\n========================================');
  console.log('Testing Unified AniList Adapter');
  console.log('========================================\n');
  
  const adapter = new AniListAdapter({
    enabled: true,
    cacheEnabled: true,
    cacheTTL: 60000, // 1 minute
    rateLimit: 90, // 90 requests per minute
    timeout: 30000
  });
  
  // Test 1: Check adapter properties
  console.log('1. Checking adapter properties...');
  console.log(`   - Name: ${adapter.adapterName}`);
  console.log(`   - Type: ${adapter.adapterType}`);
  console.log(`   - Provider: ${adapter.providerName}`);
  console.log(`   - Base Confidence: ${adapter.baseConfidence}`);
  console.log(`   - Capabilities:`, adapter.capabilities);
  
  // Test 2: Test configuration
  console.log('\n2. Testing configuration...');
  const config = adapter.getConfig();
  console.log(`   - Enabled: ${config.enabled}`);
  console.log(`   - Cache Enabled: ${config.cacheEnabled}`);
  console.log(`   - Rate Limit: ${config.rateLimit}`);
  
  // Test 3: Test search functionality
  console.log('\n3. Testing search functionality...');
  const searchResult = await adapter.search('One Piece', { limit: 5 });
  
  if (isSuccess(searchResult)) {
    console.log(`   ✓ Search successful: ${searchResult.data.length} results`);
    if (searchResult.data.length > 0) {
      const first = searchResult.data[0];
      console.log(`   First result:`);
      console.log(`   - Title: ${first.title}`);
      console.log(`   - ID: ${first.id}`);
      console.log(`   - Provider: ${first.provider}`);
    }
  } else {
    console.log(`   ✗ Search failed: ${searchResult.error.message}`);
  }
  
  // Test 4: Test caching
  console.log('\n4. Testing caching...');
  const start = Date.now();
  const cachedResult = await adapter.search('One Piece', { limit: 5 });
  const elapsed = Date.now() - start;
  
  if (isSuccess(cachedResult) && elapsed < 100) {
    console.log(`   ✓ Cache hit (${elapsed}ms)`);
  } else {
    console.log(`   ✗ Cache miss or error (${elapsed}ms)`);
  }
  
  // Test 5: Test status check
  console.log('\n5. Testing status check...');
  const statusResult = await adapter.getStatus();
  
  if (isSuccess(statusResult)) {
    console.log(`   ✓ Status: ${statusResult.data.status}`);
    console.log(`   - Message: ${statusResult.data.message}`);
  } else {
    console.log(`   ✗ Status check failed`);
  }
}

async function testBackwardCompatibility() {
  console.log('\n========================================');
  console.log('Testing Backward Compatibility');
  console.log('========================================\n');
  
  // Test 1: Check that old adapters still work
  console.log('1. Testing legacy adapter imports...');
  try {
    const { UnifiedAniListAdapter } = await import('../src/server/adapters/unified-anilist-adapter');
    const legacyAdapter = new UnifiedAniListAdapter({
      enabled: true,
      apiEndpoint: 'https://graphql.anilist.co'
    } as any);
    
    console.log(`   ✓ Legacy UnifiedAniListAdapter still works`);
  } catch (error) {
    console.log(`   ✗ Legacy adapter error: ${error}`);
  }
  
  // Test 2: Check that factory can create adapters
  console.log('\n2. Testing factory adapter creation...');
  const factory = getAdapterFactory();
  
  ['anilist', 'comicvine', 'wikipedia', 'suwayomi'].forEach(type => {
    const adapter = factory.createAdapter(type);
    if (adapter) {
      console.log(`   ✓ ${type} adapter created`);
    } else {
      console.log(`   ✗ ${type} adapter failed`);
    }
  });
}

async function testAdapterHelpers() {
  console.log('\n========================================');
  console.log('Testing Adapter Helper Methods');
  console.log('========================================\n');
  
  const adapter = new AniListAdapter({ enabled: true });
  
  // Test 1: Text normalization
  console.log('1. Testing text normalization...');
  const testText = '  Hello   World  &nbsp; &lt;tag&gt;  ';
  const normalized = (adapter as any).normalizeText(testText);
  console.log(`   Input: "${testText}"`);
  console.log(`   Output: "${normalized}"`);
  
  // Test 2: URL cleaning
  console.log('\n2. Testing URL cleaning...');
  const testUrls = [
    '/relative/path',
    '//protocol-relative.com/path',
    'https://absolute.com/path?tracking=123'
  ];
  
  testUrls.forEach(url => {
    const cleaned = (adapter as any).cleanUrl(url, 'https://base.com');
    console.log(`   "${url}" -> "${cleaned}"`);
  });
  
  // Test 3: Confidence calculation
  console.log('\n3. Testing confidence calculation...');
  const confidence = (adapter as any).calculateConfidence(
    'One Piece',
    { title: 'One Piece' },
    { hasDescription: 1.1, hasImage: 1.05 }
  );
  console.log(`   Confidence score: ${confidence.toFixed(3)}`);
}

async function main() {
  try {
    console.log('Adapter Refactoring Test Suite');
    console.log('================================\n');
    
    await testAdapterFactory();
    await testUnifiedAniListAdapter();
    await testBackwardCompatibility();
    await testAdapterHelpers();
    
    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================\n');
    
    // Dispose of all adapters
    console.log('Cleaning up...');
    getAdapterFactory().disposeAll();
    console.log('Done!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);