#!/usr/bin/env npx tsx
/**
 * Test script to verify Fandom search results include URL fields
 */

import { FandomProvider } from '../src/server/services/search/providers/FandomProvider';
import { FandomService } from '../src/server/services/fandom/FandomService';

async function testFandomUrls() {
    console.log('Testing Fandom URL preservation...\n');
    
    // Test 1: Direct FandomService search
    console.log('1. Testing FandomService directly:');
    const service = new FandomService('fireforce', {
        name: 'Fire Force',
        subdomain: 'fireforce',
        categories: {
            characters: 'Characters',
            chapters: 'Chapters',
            volumes: 'Volumes',
            arcs: 'Story Arcs'
        }
    });
    
    try {
        const serviceResults = await service.search('Fire Force', { limit: 1 });
        if (serviceResults.length > 0) {
            const result = serviceResults[0];
            console.log('  - Title:', result.title);
            console.log('  - Has URL:', !!result.url);
            console.log('  - URL:', result.url || 'MISSING');
            console.log('  - All fields:', Object.keys(result));
        } else {
            console.log('  No results from FandomService');
        }
    } catch (error) {
        console.error('  Error:', error);
    }
    
    console.log('\n2. Testing FandomProvider:');
    const provider = new FandomProvider({
        name: 'Fandom',
        identifier: 'fandom',
        supportedTypes: ['manga', 'character']
    });
    
    try {
        const providerResults = await provider.search('Fire Force', { limit: 1 });
        if (providerResults.length > 0) {
            const result = providerResults[0];
            console.log('  - Title:', result.title);
            console.log('  - Has wikiUrl:', !!result.wikiUrl);
            console.log('  - wikiUrl:', result.wikiUrl || 'MISSING');
            console.log('  - Has url:', !!result.url);
            console.log('  - url:', result.url || 'MISSING');
            console.log('  - Has providerUrl:', !!result.providerUrl);
            console.log('  - providerUrl:', result.providerUrl || 'MISSING');
            console.log('  - All fields:', Object.keys(result));
        } else {
            console.log('  No results from FandomProvider');
        }
    } catch (error) {
        console.error('  Error:', error);
    }
    
    console.log('\n3. Testing FandomProviderInstance transformation:');
    const { fandomProvider } = await import('../src/server/services/search/providers/FandomProviderInstance');
    
    try {
        const instanceResults = await fandomProvider.search('Fire Force', { limit: 1 });
        if (instanceResults.length > 0) {
            const result = instanceResults[0] as any;
            console.log('  - Title:', result.title);
            console.log('  - Has wikiUrl:', !!result.wikiUrl);
            console.log('  - wikiUrl:', result.wikiUrl || 'MISSING');
            console.log('  - Has url:', !!result.url);
            console.log('  - url:', result.url || 'MISSING');
            console.log('  - Has siteDetailUrl:', !!result.siteDetailUrl);
            console.log('  - siteDetailUrl:', result.siteDetailUrl || 'MISSING');
            console.log('  - All fields:', Object.keys(result));
        } else {
            console.log('  No results from FandomProviderInstance');
        }
    } catch (error) {
        console.error('  Error:', error);
    }
    
    // Cleanup
    await provider.cleanup();
    service.destroy();
    
    console.log('\nTest complete!');
    process.exit(0);
}

testFandomUrls().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});