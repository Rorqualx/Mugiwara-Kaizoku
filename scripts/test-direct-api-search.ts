#!/usr/bin/env tsx

/**
 * Test direct MediaWiki API search without guessing
 */

import axios from 'axios';

async function searchFandomDirectly(query: string) {
    console.log('='.repeat(80));
    console.log('DIRECT FANDOM API SEARCH - No Guessing');
    console.log('='.repeat(80));
    
    // The proper Fire Force wiki
    const correctWiki = 'fire-force.fandom.com';
    const apiUrl = `https://${correctWiki}/api.php`;
    
    console.log(`\nSearching on ${correctWiki} for: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
        // 1. OpenSearch API
        console.log('\n1. OpenSearch API:');
        const openSearchResponse = await axios.get(apiUrl, {
            params: {
                action: 'opensearch',
                search: query,
                limit: 5,
                format: 'json',
                origin: '*'
            }
        });
        
        const [, titles, descriptions, urls] = openSearchResponse.data;
        
        for (let i = 0; i < titles.length; i++) {
            console.log(`  ${i + 1}. ${titles[i]}`);
            console.log(`     URL: ${urls[i]}`);
            if (descriptions[i]) {
                console.log(`     Desc: ${descriptions[i]}`);
            }
        }
        
        // 2. Query API with pageimages
        console.log('\n2. Query API with page images:');
        const queryResponse = await axios.get(apiUrl, {
            params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                srnamespace: 0,
                srlimit: 5,
                format: 'json',
                origin: '*'
            }
        });
        
        const searchResults = queryResponse.data.query.search;
        
        for (const result of searchResults) {
            console.log(`  - ${result.title} (PageID: ${result.pageid})`);
            
            // Get page image for this result
            const imageResponse = await axios.get(apiUrl, {
                params: {
                    action: 'query',
                    pageids: result.pageid,
                    prop: 'pageimages',
                    piprop: 'thumbnail|original',
                    pithumbsize: 500,
                    format: 'json',
                    origin: '*'
                }
            });
            
            const pages = imageResponse.data.query.pages;
            const page = pages[result.pageid];
            
            if (page.thumbnail) {
                console.log(`    Thumbnail: ${page.thumbnail.source}`);
            }
            if (page.original) {
                console.log(`    Original: ${page.original.source}`);
            }
        }
        
        // 3. Direct page fetch
        console.log('\n3. Direct page fetch for "Fire Force (manga)":');
        const directResponse = await axios.get(apiUrl, {
            params: {
                action: 'query',
                titles: 'Fire Force (manga)',
                prop: 'pageimages|extracts|info',
                piprop: 'thumbnail|original',
                pithumbsize: 500,
                exintro: true,
                explaintext: true,
                inprop: 'url',
                format: 'json',
                origin: '*'
            }
        });
        
        const directPages = directResponse.data.query.pages;
        const pageId = Object.keys(directPages)[0];
        const directPage = directPages[pageId];
        
        console.log(`  Title: ${directPage.title}`);
        console.log(`  URL: ${directPage.fullurl}`);
        console.log(`  Page Image: ${directPage.pageimage}`);
        if (directPage.thumbnail) {
            console.log(`  Thumbnail: ${directPage.thumbnail.source}`);
        }
        if (directPage.original) {
            console.log(`  Original: ${directPage.original.source}`);
        }
        console.log(`  Extract: ${directPage.extract?.substring(0, 200)}...`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the test
searchFandomDirectly('Fire Force').then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});