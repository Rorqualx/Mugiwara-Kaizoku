#!/usr/bin/env tsx

/**
 * Test wikitext extraction from Fire Force page
 */

import axios from 'axios';

async function testWikitextExtraction() {
    console.log('='.repeat(80));
    console.log('TESTING WIKITEXT EXTRACTION');
    console.log('='.repeat(80));
    
    const domain = 'fire-force.fandom.com';
    const apiUrl = `https://${domain}/api.php`;
    
    const response = await axios.get(apiUrl, {
        params: {
            action: 'query',
            titles: 'Fire Force (manga)',
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            format: 'json'
        }
    });
    
    const pages = response.data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    const wikitext = page.revisions?.[0]?.slots?.main?.['*'] || '';
    
    console.log('Wikitext length:', wikitext.length);
    console.log('First 2000 characters:');
    console.log('-'.repeat(40));
    console.log(wikitext.substring(0, 2000));
    console.log('\n' + '-'.repeat(40));
    
    // Extract infobox content - handle nested templates
    const infoboxMatch = wikitext.match(/\{\{[^}]*Infobox[^}]*(?:\{\{[^}]*\}\}[^}]*)*\}\}/is);
    if (infoboxMatch) {
        console.log('Found Infobox:');
        console.log('-'.repeat(40));
        
        const infobox = infoboxMatch[0];
        
        // Show the raw infobox first
        console.log('Raw infobox (first 500 chars):');
        console.log(infobox.substring(0, 500));
        console.log('\n' + '-'.repeat(40));
        console.log('Extracted fields:');
        
        // Extract all key-value pairs
        const lines = infobox.split('\n');
        for (const line of lines) {
            if (line.includes('|') && line.includes('=')) {
                const match = line.match(/\|\s*([^=]+?)\s*=\s*(.+)/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2]
                        .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
                        .replace(/<[^>]+>/g, '')
                        .replace(/'{2,}/g, '')
                        .trim();
                    if (value) {
                        console.log(`${key}: ${value}`);
                    }
                }
            }
        }
    } else {
        console.log('No infobox found');
        
        // Show first 1000 characters of wikitext
        console.log('\nFirst 1000 characters of wikitext:');
        console.log('-'.repeat(40));
        console.log(wikitext.substring(0, 1000));
    }
}

// Run the test
testWikitextExtraction().then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});