#!/usr/bin/env tsx

/**
 * Test what the MediaWiki API actually returns
 */

import axios from 'axios';

async function testAPIResponse() {
    console.log('='.repeat(80));
    console.log('TESTING MEDIAWIKI API RESPONSE');
    console.log('='.repeat(80));
    
    const domain = 'fire-force.fandom.com';
    const apiUrl = `https://${domain}/api.php`;
    
    // Test 1: Get Fire Force (manga) page with images
    console.log('\n1. Testing Fire Force (manga) page:');
    console.log('-'.repeat(40));
    
    const response = await axios.get(apiUrl, {
        params: {
            action: 'query',
            titles: 'Fire Force (manga)',
            prop: 'pageimages|revisions|info',
            piprop: 'thumbnail|original',
            pithumbsize: 500,
            rvprop: 'content',
            rvslots: 'main',
            inprop: 'url',
            format: 'json'
        }
    });
    
    const pages = response.data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    console.log('Page found:', !page.missing);
    console.log('Page title:', page.title);
    console.log('Page URL:', page.fullurl);
    console.log('Has thumbnail:', !!page.thumbnail);
    console.log('Has original:', !!page.original);
    
    if (page.thumbnail) {
        console.log('Thumbnail URL:', page.thumbnail.source);
    }
    if (page.original) {
        console.log('Original URL:', page.original.source);
    }
    
    // Extract from wikitext
    const wikitext = page.revisions?.[0]?.slots?.main?.['*'] || '';
    
    // Look for image in infobox
    const imageMatch = wikitext.match(/\|\s*image\s*=\s*([^\|]+)/i);
    if (imageMatch) {
        console.log('Image from wikitext:', imageMatch[1].trim());
    }
    
    // Test 2: Get the main Fire Force page
    console.log('\n2. Testing Fire Force (no suffix) page:');
    console.log('-'.repeat(40));
    
    const response2 = await axios.get(apiUrl, {
        params: {
            action: 'query',
            titles: 'Fire Force',
            prop: 'pageimages',
            piprop: 'thumbnail|original',
            pithumbsize: 500,
            format: 'json'
        }
    });
    
    const pages2 = response2.data.query?.pages || {};
    const pageId2 = Object.keys(pages2)[0];
    const page2 = pages2[pageId2];
    
    console.log('Page found:', !page2.missing);
    console.log('Has thumbnail:', !!page2.thumbnail);
    console.log('Has original:', !!page2.original);
    
    if (page2.thumbnail) {
        console.log('Thumbnail URL:', page2.thumbnail.source);
    }
    if (page2.original) {
        console.log('Original URL:', page2.original.source);
    }
    
    // Test 3: Get image info for specific file
    console.log('\n3. Testing specific image file:');
    console.log('-'.repeat(40));
    
    const response3 = await axios.get(apiUrl, {
        params: {
            action: 'query',
            titles: 'File:FBOF on WSM cover.png',
            prop: 'imageinfo',
            iiprop: 'url|size',
            format: 'json'
        }
    });
    
    const pages3 = response3.data.query?.pages || {};
    const pageId3 = Object.keys(pages3)[0];
    const page3 = pages3[pageId3];
    
    console.log('Image page found:', !page3.missing);
    if (page3.imageinfo && page3.imageinfo[0]) {
        console.log('Image URL:', page3.imageinfo[0].url);
        console.log('Image size:', `${page3.imageinfo[0].width}x${page3.imageinfo[0].height}`);
    }
}

// Run the test
testAPIResponse().then(() => {
    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});