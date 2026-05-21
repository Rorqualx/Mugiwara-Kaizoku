#!/usr/bin/env npx tsx

import * as cheerio from 'cheerio';
import { logger } from '../src/utils/logger';

// Test Wikipedia API and scraping for Fire Force
async function testWikipediaFireForce() {
    logger.info('Testing Wikipedia data for Fire Force...');
    
    // First, test the Wikipedia API
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    
    // Search for Fire Force
    const searchParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: 'Fire Force manga',
        srlimit: '5'
    });
    
    logger.info('Searching Wikipedia for Fire Force...');
    const searchResponse = await fetch(`${apiUrl}?${searchParams}`);
    const searchData = await searchResponse.json();
    
    logger.info('Search results:', {
        results: searchData.query?.search?.map((r: any) => ({
            title: r.title,
            snippet: r.snippet
        }))
    });
    
    // Get the main Fire Force page content
    const pageParams = new URLSearchParams({
        action: 'parse',
        format: 'json',
        page: 'Fire Force',
        prop: 'text|links|extlinks|categories'
    });
    
    logger.info('\nFetching Fire Force main page...');
    const pageResponse = await fetch(`${apiUrl}?${pageParams}`);
    const pageData = await pageResponse.json();
    
    if (pageData.parse) {
        const $ = cheerio.load(pageData.parse.text['*']);
        
        // Extract basic info from infobox
        const infobox: any = {};
        $('.infobox tr').each((_, row) => {
            const $row = $(row);
            const label = $row.find('th').text().trim();
            const value = $row.find('td').text().trim();
            if (label && value) {
                infobox[label] = value;
            }
        });
        
        logger.info('\nInfobox data:', infobox);
        
        // Find links to volume/chapter lists
        const volumeLinks = pageData.parse.links?.filter((link: any) => 
            link['*']?.toLowerCase().includes('volume') || 
            link['*']?.toLowerCase().includes('chapter')
        );
        
        logger.info('\nVolume/Chapter related links:', volumeLinks);
    }
    
    // Now fetch the List of Fire Force chapters page
    logger.info('\n========================================');
    logger.info('Fetching List of Fire Force chapters page...');
    
    const volumePageParams = new URLSearchParams({
        action: 'parse',
        format: 'json',
        page: 'List of Fire Force chapters',
        prop: 'text'
    });
    
    const volumePageResponse = await fetch(`${apiUrl}?${volumePageParams}`);
    const volumePageData = await volumePageResponse.json();
    
    if (volumePageData.parse) {
        const $ = cheerio.load(volumePageData.parse.text['*']);
        
        // Find all tables that contain volume information
        const volumes: any[] = [];
        
        $('table.wikitable').each((tableIndex, table) => {
            const $table = $(table);
            const headers: string[] = [];
            
            // Get headers
            $table.find('tr').first().find('th').each((_, th) => {
                headers.push($(th).text().trim());
            });
            
            logger.info(`\nTable ${tableIndex + 1} headers:`, headers);
            
            // Check if this is a volume table
            const hasVolumeInfo = headers.some(h => 
                h.toLowerCase().includes('no.') || 
                h.toLowerCase().includes('title') ||
                h.toLowerCase().includes('release')
            );
            
            if (hasVolumeInfo) {
                logger.info('This appears to be a volume table, extracting data...');
                
                $table.find('tr').slice(1).each((rowIndex, row) => {
                    const $row = $(row);
                    const cells = $row.find('td');
                    
                    if (cells.length >= 3) {
                        const volumeData: any = {
                            number: cells.eq(0).text().trim(),
                            releaseDate: '',
                            isbn: '',
                            titles: [],
                            chapters: []
                        };
                        
                        // Extract release date and ISBN (usually in the second column)
                        const releaseDateText = cells.eq(1).text();
                        const isbnMatch = releaseDateText.match(/ISBN\s+([\d-]+)/);
                        const dateMatch = releaseDateText.match(/(\w+\s+\d{1,2},\s+\d{4})/);
                        
                        if (isbnMatch) volumeData.isbn = isbnMatch[1];
                        if (dateMatch) volumeData.releaseDate = dateMatch[1];
                        
                        // Extract titles (both Japanese and English)
                        const titleCell = cells.eq(2);
                        const titleText = titleCell.text();
                        
                        // Look for Japanese title in quotes
                        const japaneseMatch = titleText.match(/"([^"]+)"/);
                        if (japaneseMatch) {
                            volumeData.titles.push({
                                type: 'japanese',
                                title: japaneseMatch[1]
                            });
                        }
                        
                        // Look for English title
                        const englishMatch = titleText.match(/\(([^)]+)\)/);
                        if (englishMatch) {
                            volumeData.titles.push({
                                type: 'english',
                                title: englishMatch[1]
                            });
                        }
                        
                        // Extract chapter list
                        const chapterText = cells.eq(3).text() || cells.eq(2).text();
                        const chapterMatches = chapterText.matchAll(/(\d+)\.\s*"([^"]+)"/g);
                        
                        for (const match of chapterMatches) {
                            volumeData.chapters.push({
                                number: match[1],
                                title: match[2]
                            });
                        }
                        
                        if (volumeData.number && volumeData.number !== '') {
                            volumes.push(volumeData);
                            
                            if (rowIndex < 3) { // Show first 3 volumes as examples
                                logger.info(`\nVolume ${volumeData.number}:`, {
                                    releaseDate: volumeData.releaseDate,
                                    isbn: volumeData.isbn,
                                    titles: volumeData.titles,
                                    chapterCount: volumeData.chapters.length,
                                    firstChapter: volumeData.chapters[0]
                                });
                            }
                        }
                    }
                });
            }
        });
        
        logger.info(`\n========================================`);
        logger.info(`Total volumes extracted: ${volumes.length}`);
        
        // Extract summary/plot from the page
        const plotSection = $('#Plot, #Synopsis, #Summary').parent().nextUntil('h2').text().trim();
        if (plotSection) {
            logger.info('\nPlot/Summary found:', plotSection.substring(0, 200) + '...');
        }
        
        // Look for any additional metadata
        const publicationInfo: any = {};
        $('p').each((_, p) => {
            const text = $(p).text();
            if (text.includes('published by') || text.includes('serialized in')) {
                publicationInfo.publication = text;
            }
            if (text.includes('volumes') && text.includes('chapters')) {
                publicationInfo.counts = text;
            }
        });
        
        if (Object.keys(publicationInfo).length > 0) {
            logger.info('\nPublication info:', publicationInfo);
        }
    } else {
        logger.error('Failed to fetch volume page');
    }
    
    // Test direct web scraping of the Wikipedia page
    logger.info('\n========================================');
    logger.info('Testing direct web scraping...');
    
    const directUrl = 'https://en.wikipedia.org/wiki/List_of_Fire_Force_chapters';
    const directResponse = await fetch(directUrl);
    const html = await directResponse.text();
    const $direct = cheerio.load(html);
    
    // Count tables and volumes using direct scraping
    const tableCount = $direct('table.wikitable').length;
    const volumeCount = $direct('tr').filter((_, el) => {
        const text = $direct(el).text();
        return text.includes('ISBN') && text.includes('978');
    }).length;
    
    logger.info('Direct scraping results:', {
        tablesFound: tableCount,
        volumesWithISBN: volumeCount
    });
}

// Run the test
testWikipediaFireForce().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});