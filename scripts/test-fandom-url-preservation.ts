#!/usr/bin/env npx tsx
/**
 * Simple test to verify URL fields are preserved through the data flow
 */

import { FandomProvider } from '../src/server/services/search/providers/FandomProvider';
import { fandomProvider } from '../src/server/services/search/providers/FandomProviderInstance';
import { providerRegistry } from '../src/server/services/search/providers/ProviderRegistry';

async function testUrlPreservation() {
    console.log('='.repeat(80));
    console.log('URL PRESERVATION TEST');
    console.log('='.repeat(80));
    
    try {
        // Test 1: Direct FandomProvider
        console.log('\n1. Testing FandomProvider directly...');
        const provider = new FandomProvider();
        const directResults = await provider.search('Naruto', { limit: 1 });
        
        if (directResults.length > 0) {
            const result = directResults[0];
            console.log('   Title:', result.title);
            console.log('   Has wikiUrl:', !!result.wikiUrl);
            console.log('   wikiUrl:', result.wikiUrl);
            console.log('   Has url:', !!result.url);
            console.log('   url:', result.url);
            console.log('   Has providerUrl:', !!result.providerUrl);
            console.log('   providerUrl:', result.providerUrl);
        }
        
        await provider.cleanup();
        
        // Test 2: FandomProviderInstance
        console.log('\n2. Testing FandomProviderInstance...');
        const instanceResults = await fandomProvider.search('Naruto', { limit: 1 });
        
        if (instanceResults.length > 0) {
            const result = instanceResults[0] as any;
            console.log('   Title:', result.title);
            console.log('   Has wikiUrl:', 'wikiUrl' in result);
            console.log('   wikiUrl:', result.wikiUrl);
            console.log('   Has url:', 'url' in result);
            console.log('   url:', result.url);
            console.log('   All keys:', Object.keys(result));
        }
        
        // Test 3: ProviderRegistry
        console.log('\n3. Testing ProviderRegistry...');
        const registryResults = await providerRegistry.searchWithProvider('fandom', 'Naruto', { limit: 1 });
        
        if (registryResults.length > 0) {
            const result = registryResults[0] as any;
            console.log('   Title:', result.title);
            console.log('   Has wikiUrl:', 'wikiUrl' in result);
            console.log('   wikiUrl:', result.wikiUrl);
            console.log('   Has url:', 'url' in result);
            console.log('   url:', result.url);
            console.log('   All keys:', Object.keys(result));
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('TEST COMPLETE');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('Test failed:', error);
    }
    
    process.exit(0);
}

testUrlPreservation();