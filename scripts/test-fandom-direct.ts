#!/usr/bin/env tsx

/**
 * Direct test of Fandom HTML parsing without authentication issues
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testDirectParsing() {
    console.log('Testing direct HTML parsing of Fire Force wiki pages');
    console.log('='.repeat(60));
    
    try {
        // Test main page
        console.log('\n1. FETCHING MAIN PAGE');
        const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
        
        const response = await axios.get(mainPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Check for infobox
        console.log('\n2. EXTRACTING INFOBOX DATA');
        const infobox = $('.portable-infobox, .infobox').first();
        console.log('Infobox found:', infobox.length > 0);
        
        if (infobox.length > 0) {
            const infoData: any = {};
            
            // Try different selectors
            infobox.find('.pi-data').each((_, elem) => {
                const $elem = $(elem);
                const label = $elem.find('.pi-data-label').text().trim();
                const value = $elem.find('.pi-data-value').text().trim();
                if (label && value) {
                    console.log(`  ${label}: ${value}`);
                    infoData[label] = value;
                }
            });
            
            // Also try alternative structure
            infobox.find('.pi-item').each((_, elem) => {
                const $elem = $(elem);
                const label = $elem.find('.pi-label').text().trim() || 
                             $elem.find('h3').text().trim();
                const value = $elem.find('.pi-value').text().trim() ||
                             $elem.find('.pi-data-value').text().trim();
                if (label && value && !infoData[label]) {
                    console.log(`  ${label}: ${value}`);
                    infoData[label] = value;
                }
            });
        }
        
        // Find volumes link
        console.log('\n3. FINDING VOLUMES PAGE LINK');
        const volumesLinks = $('a[href*="List_of_Volumes"], a[href*="Volumes"]');
        console.log('Volume links found:', volumesLinks.length);
        
        if (volumesLinks.length > 0) {
            volumesLinks.each((i, link) => {
                if (i < 3) { // Show first 3
                    const href = $(link).attr('href');
                    const text = $(link).text().trim();
                    console.log(`  Link ${i + 1}: "${text}" -> ${href}`);
                }
            });
        }
        
        // Test volumes page
        console.log('\n4. FETCHING VOLUMES PAGE');
        const volumesUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
        
        const volumesResponse = await axios.get(volumesUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': mainPageUrl
            }
        });
        
        const $volumes = cheerio.load(volumesResponse.data);
        
        // Check for tabber
        console.log('\n5. ANALYZING VOLUMES PAGE STRUCTURE');
        const tabbers = $volumes('.tabber, .tabberlive');
        console.log('Tabbers found:', tabbers.length);
        
        const tabs = $volumes('.tabbertab');
        console.log('Tabs found:', tabs.length);
        
        if (tabs.length > 0) {
            console.log('\nFirst 3 tabs:');
            tabs.slice(0, 3).each((i, tab) => {
                const $tab = $volumes(tab);
                const title = $tab.attr('title') || 'No title';
                const tables = $tab.find('table').length;
                const links = $tab.find('a[href*="Chapter"]').length;
                console.log(`  Tab ${i + 1}: "${title}" - ${tables} tables, ${links} chapter links`);
            });
        }
        
        // Extract sample volume data
        console.log('\n6. EXTRACTING SAMPLE VOLUME DATA');
        const firstTab = tabs.first();
        if (firstTab.length) {
            const $tab = $volumes(firstTab);
            const volumeTitle = $tab.attr('title') || 'Unknown';
            console.log('Volume:', volumeTitle);
            
            // Find chapters
            const chapterLinks = $tab.find('a[href*="Chapter"]');
            console.log('Chapters found:', chapterLinks.length);
            
            if (chapterLinks.length > 0) {
                console.log('First 5 chapters:');
                chapterLinks.slice(0, 5).each((i, link) => {
                    const $link = $volumes(link);
                    const text = $link.text().trim();
                    const href = $link.attr('href');
                    console.log(`  - ${text} -> ${href}`);
                });
            }
            
            // Look for ISBN
            const tabText = $tab.text();
            const isbnMatch = tabText.match(/ISBN[:\s]*([\d-]+)/);
            if (isbnMatch) {
                console.log('ISBN found:', isbnMatch[1]);
            }
            
            // Look for images
            const images = $tab.find('img');
            console.log('Images found:', images.length);
            if (images.length > 0) {
                const firstImg = images.first();
                const src = firstImg.attr('src') || firstImg.attr('data-src');
                console.log('First image:', src?.substring(0, 100));
            }
        }
        
        // Check for alternative structures
        console.log('\n7. CHECKING ALTERNATIVE STRUCTURES');
        const volumeHeadings = $volumes('h2:contains("Volume"), h3:contains("Volume")');
        console.log('Volume headings found:', volumeHeadings.length);
        
        const definitionLists = $volumes('dl');
        console.log('Definition lists found:', definitionLists.length);
        
        const galleries = $volumes('.gallery, .wikia-gallery');
        console.log('Galleries found:', galleries.length);
        
        // Test chapter page
        console.log('\n8. FETCHING SAMPLE CHAPTER PAGE');
        const chapterUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';
        
        const chapterResponse = await axios.get(chapterUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': volumesUrl
            }
        });
        
        const $chapter = cheerio.load(chapterResponse.data);
        
        // Find summary
        const summarySelectors = [
            '#Summary',
            'h2:contains("Summary")',
            'h3:contains("Summary")',
            '.mw-headline:contains("Summary")'
        ];
        
        let summaryFound = false;
        for (const selector of summarySelectors) {
            const summaryHeading = $chapter(selector).first();
            if (summaryHeading.length) {
                console.log('Summary heading found with selector:', selector);
                const summaryText = summaryHeading.nextUntil('h2, h3').text().trim();
                console.log('Summary length:', summaryText.length, 'characters');
                console.log('Summary preview:', summaryText.substring(0, 200) + '...');
                summaryFound = true;
                break;
            }
        }
        
        if (!summaryFound) {
            console.log('No summary section found');
        }
        
        // Find chapter info
        const chapterInfobox = $chapter('.portable-infobox, .infobox').first();
        if (chapterInfobox.length) {
            console.log('\nChapter infobox data:');
            chapterInfobox.find('.pi-data').each((_, elem) => {
                const $elem = $chapter(elem);
                const label = $elem.find('.pi-data-label').text().trim();
                const value = $elem.find('.pi-data-value').text().trim();
                if (label && value) {
                    console.log(`  ${label}: ${value}`);
                }
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Test completed');
        
    } catch (error) {
        console.error('Error:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response status:', error.response?.status);
            console.error('Response headers:', error.response?.headers);
        }
    }
}

testDirectParsing().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});