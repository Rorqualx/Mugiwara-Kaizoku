#!/usr/bin/env tsx

/**
 * Test the Dynamic Fandom Parser with Fire Force wiki
 * Verifies extraction of:
 * - Series info (title, author, dates, volumes)
 * - Volume list page discovery
 * - Volume and chapter details
 * - Individual chapter pages
 */

import { WikiContentScraper } from '../src/server/services/fandom/dynamic/WikiContentScraper';
import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFireForceExtraction() {
    console.log('='.repeat(80));
    console.log('TESTING DYNAMIC FANDOM PARSER - Fire Force Wiki');
    console.log('='.repeat(80));
    
    const scraper = new WikiContentScraper();
    const parser = new DynamicWikiParser();
    
    // Test URLs
    const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    const volumesPageUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
    const chapterPageUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';
    
    try {
        // Step 1: Test main page scraping
        console.log('\n1. TESTING MAIN PAGE EXTRACTION');
        console.log('-'.repeat(40));
        
        const mainPageResult = await scraper.scrapeMangaWiki(mainPageUrl, {
            followLinks: false,
            extractSummaries: false,
            maxDepth: 1
        });
        
        console.log('Main Page Results:');
        console.log('- Title:', mainPageResult.metadata?.title);
        console.log('- Author:', mainPageResult.metadata?.author);
        console.log('- Status:', mainPageResult.metadata?.status);
        console.log('- Genres:', mainPageResult.metadata?.genres);
        console.log('- Start Date:', mainPageResult.metadata?.startDate);
        console.log('- End Date:', mainPageResult.metadata?.endDate);
        console.log('- Volumes Page Found:', mainPageResult.volumesPageUrl);
        console.log('- Cover Image:', mainPageResult.metadata?.coverImage);
        
        // Step 2: Test series info extraction from infobox
        console.log('\n2. TESTING SERIES INFO EXTRACTION');
        console.log('-'.repeat(40));
        
        const response = await axios.get(mainPageUrl);
        const $ = cheerio.load(response.data);
        
        // Extract from portable infobox
        const infobox = $('.portable-infobox, .infobox').first();
        const seriesInfo: any = {};
        
        // Extract all data labels and values
        infobox.find('.pi-data').each((_, elem) => {
            const $elem = $(elem);
            const label = $elem.find('.pi-data-label').text().trim();
            const value = $elem.find('.pi-data-value').text().trim();
            if (label && value) {
                seriesInfo[label] = value;
            }
        });
        
        console.log('Series Info Extracted:');
        Object.entries(seriesInfo).forEach(([key, value]) => {
            console.log(`- ${key}:`, value);
        });
        
        // Step 3: Test volumes page discovery and scraping
        console.log('\n3. TESTING VOLUMES PAGE EXTRACTION');
        console.log('-'.repeat(40));
        
        const volumesResult = await scraper.scrapeMangaWiki(volumesPageUrl, {
            followLinks: false,
            extractSummaries: false,
            maxDepth: 1
        });
        
        console.log('Volumes Page Results:');
        console.log('- Total Volumes:', volumesResult.totalVolumes);
        console.log('- Total Chapters:', volumesResult.totalChapters);
        
        if (volumesResult.volumes.length > 0) {
            console.log('\nFirst Volume Details:');
            const firstVolume = volumesResult.volumes[0];
            console.log('- Number:', firstVolume.number);
            console.log('- Title:', firstVolume.title);
            console.log('- Cover Image:', firstVolume.coverImage);
            console.log('- ISBN:', firstVolume.isbn);
            console.log('- Release Date:', firstVolume.releaseDate);
            console.log('- Chapter Count:', firstVolume.chapters.length);
            
            if (firstVolume.chapters.length > 0) {
                console.log('\nFirst Chapter in Volume:');
                const firstChapter = firstVolume.chapters[0];
                console.log('  - Number:', firstChapter.number);
                console.log('  - Title:', firstChapter.title);
                console.log('  - URL:', firstChapter.url);
            }
        }
        
        // Step 4: Test page structure detection
        console.log('\n4. TESTING PAGE STRUCTURE DETECTION');
        console.log('-'.repeat(40));
        
        const volumesPageHtml = (await axios.get(volumesPageUrl)).data;
        const structure = await parser.analyzePageStructure(volumesPageHtml, volumesPageUrl);
        
        console.log('Page Structure Analysis:');
        console.log('- Type:', structure.type);
        console.log('- Confidence:', structure.confidence);
        console.log('- Has Volumes:', structure.metadata.hasVolumes);
        console.log('- Has Chapters:', structure.metadata.hasChapters);
        console.log('- Table Count:', structure.metadata.tableCount);
        console.log('- Has Tabs:', structure.metadata.hasTabs);
        console.log('- Has Gallery:', structure.metadata.hasGallery);
        
        // Step 5: Test individual chapter page extraction
        console.log('\n5. TESTING CHAPTER PAGE EXTRACTION');
        console.log('-'.repeat(40));
        
        const chapterResponse = await axios.get(chapterPageUrl);
        const $chapter = cheerio.load(chapterResponse.data);
        
        // Extract chapter info
        const chapterInfo: any = {};
        
        // Get summary/synopsis
        const summarySelectors = ['#Summary', '#Synopsis', 'h2:contains("Summary") + p'];
        for (const selector of summarySelectors) {
            const summary = $chapter(selector).first();
            if (summary.length) {
                chapterInfo.summary = summary.text().trim();
                break;
            }
        }
        
        // Get chapter info box
        const chapterInfobox = $chapter('.infobox, .portable-infobox').first();
        chapterInfobox.find('tr, .pi-data').each((_, elem) => {
            const $elem = $chapter(elem);
            const label = $elem.find('th, .pi-data-label').text().trim();
            const value = $elem.find('td, .pi-data-value').text().trim();
            if (label && value) {
                chapterInfo[label] = value;
            }
        });
        
        // Get chapter image
        const chapterImage = $chapter('.infobox img, .portable-infobox img').first();
        if (chapterImage.length) {
            chapterInfo.coverImage = chapterImage.attr('src') || chapterImage.attr('data-src');
        }
        
        console.log('Chapter Page Info:');
        console.log('- Title:', chapterInfo['Chapter Info'] || 'Chapter 0');
        console.log('- Japanese:', chapterInfo['Japanese']);
        console.log('- Arc:', chapterInfo['Arc']);
        console.log('- Pages:', chapterInfo['Pages']);
        console.log('- Volume:', chapterInfo['Volume']);
        console.log('- Cover Image:', chapterInfo.coverImage);
        console.log('- Summary Length:', chapterInfo.summary?.length || 0, 'characters');
        
        // Step 6: Test comprehensive extraction with link following
        console.log('\n6. TESTING COMPREHENSIVE EXTRACTION (with link following)');
        console.log('-'.repeat(40));
        
        console.log('Starting comprehensive scrape (this may take a while)...');
        const comprehensiveResult = await scraper.scrapeMangaWiki(mainPageUrl, {
            followLinks: true,
            extractSummaries: true,
            maxDepth: 2
        });
        
        console.log('Comprehensive Results:');
        console.log('- Success:', comprehensiveResult.success);
        console.log('- Total Volumes:', comprehensiveResult.totalVolumes);
        console.log('- Total Chapters:', comprehensiveResult.totalChapters);
        console.log('- Errors:', comprehensiveResult.errors?.length || 0);
        
        // Count chapters with summaries
        const chaptersWithSummaries = comprehensiveResult.chapters.filter(ch => ch.summary).length;
        console.log('- Chapters with summaries:', chaptersWithSummaries);
        
        // Step 7: Verify data completeness
        console.log('\n7. DATA COMPLETENESS CHECK');
        console.log('-'.repeat(40));
        
        const requiredFields = {
            'Title': mainPageResult.metadata?.title,
            'Author': mainPageResult.metadata?.author,
            'Genres': mainPageResult.metadata?.genres,
            'Status': mainPageResult.metadata?.status,
            'Cover Image': mainPageResult.metadata?.coverImage,
            'Volumes Page URL': mainPageResult.volumesPageUrl,
            'Total Volumes': volumesResult.totalVolumes > 0,
            'Total Chapters': volumesResult.totalChapters > 0,
            'Volume Details': volumesResult.volumes.length > 0,
            'Chapter Links': volumesResult.chapters.some(ch => ch.url)
        };
        
        let passedChecks = 0;
        let totalChecks = 0;
        
        for (const [field, value] of Object.entries(requiredFields)) {
            totalChecks++;
            const passed = !!value;
            if (passed) passedChecks++;
            console.log(`[${passed ? '✓' : '✗'}] ${field}:`, value || 'Not found');
        }
        
        console.log(`\nPassed ${passedChecks}/${totalChecks} checks`);
        
        // Step 8: Test image URL extraction
        console.log('\n8. TESTING IMAGE EXTRACTION');
        console.log('-'.repeat(40));
        
        // Check for gallery images
        const galleryImages: string[] = [];
        $('.gallery img, .wikia-gallery img').each((_, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src');
            if (src) galleryImages.push(src);
        });
        
        console.log('Gallery Images Found:', galleryImages.length);
        if (galleryImages.length > 0) {
            console.log('Sample Gallery Images:');
            galleryImages.slice(0, 3).forEach(img => {
                console.log('  -', img);
            });
        }
        
        // Final summary
        console.log('\n' + '='.repeat(80));
        console.log('TEST SUMMARY');
        console.log('='.repeat(80));
        
        const summary = {
            'Main Page Scraped': mainPageResult.success,
            'Metadata Extracted': !!mainPageResult.metadata,
            'Volumes Page Found': !!mainPageResult.volumesPageUrl,
            'Volumes Extracted': volumesResult.totalVolumes,
            'Chapters Extracted': volumesResult.totalChapters,
            'Structure Detection': structure.type !== 'UNKNOWN',
            'Confidence Score': structure.confidence
        };
        
        console.table(summary);
        
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
    }
}

// Run the test
testFireForceExtraction().then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});