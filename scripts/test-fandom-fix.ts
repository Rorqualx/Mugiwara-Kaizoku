#!/usr/bin/env npx tsx
/**
 * Test that Fandom search now returns results with URLs for enrichment
 */

import { FandomService } from '../src/server/services/fandom/FandomService';
import { logger } from '../src/utils/logger';

async function testFandomFix() {
    console.log('='.repeat(70));
    console.log('TESTING FANDOM TYPE FILTERING FIX');
    console.log('='.repeat(70));
    
    // Test with Fire Force wiki (just subdomain, not full domain)
    const service = new FandomService('fire-force');
    
    try {
        console.log('\n1. Testing search for "Fire Force" with manga type filter');
        console.log('-'.repeat(50));
        
        const results = await service.search('Fire Force', {
            type: 'manga',
            limit: 5
        });
        
        console.log(`\nFound ${results.length} results:\n`);
        
        results.forEach((result, index) => {
            console.log(`Result ${index + 1}:`);
            console.log(`  Title: ${result.title}`);
            console.log(`  Type: ${result.type}`);
            console.log(`  ID: ${result.id}`);
            console.log(`  Has URL: ${!!result.url}`);
            console.log(`  URL: ${result.url || 'MISSING'}`);
            console.log(`  Wiki: ${result.wiki}`);
            console.log(`  Score: ${result.score}`);
            console.log('');
        });
        
        // Check if we got the main wiki page
        const wikiPage = results.find(r => r.title.toLowerCase().includes('wiki'));
        
        if (wikiPage) {
            console.log('✅ SUCCESS: Found wiki page with type "manga"');
            console.log(`   Title: ${wikiPage.title}`);
            console.log(`   Type: ${wikiPage.type}`);
            console.log(`   URL: ${wikiPage.url}`);
        } else {
            console.log('⚠️  No wiki page found in results');
        }
        
        // Check if all results have URLs
        const allHaveUrls = results.every(r => !!r.url);
        
        if (allHaveUrls) {
            console.log('\n✅ SUCCESS: All results have URLs for enrichment');
        } else {
            console.log('\n❌ ERROR: Some results are missing URLs');
        }
        
        // Test with type 'all' to see all results
        console.log('\n2. Testing search with type "all" for comparison');
        console.log('-'.repeat(50));
        
        const allResults = await service.search('Fire Force', {
            type: 'all',
            limit: 10
        });
        
        console.log(`\nFound ${allResults.length} total results`);
        
        // Count by type
        const typeCounts: Record<string, number> = {};
        allResults.forEach(r => {
            typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
        });
        
        console.log('\nResults by type:');
        Object.entries(typeCounts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
    } catch (error) {
        console.error('Error during test:', error);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('TEST COMPLETE');
    console.log('='.repeat(70));
    
    process.exit(0);
}

testFandomFix().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});