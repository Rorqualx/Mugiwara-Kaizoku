#!/usr/bin/env tsx

/**
 * Test specific Fire Force wiki volume extraction
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFireForceVolumes() {
    console.log('Testing Fire Force List of Volumes page extraction');
    console.log('='.repeat(80));
    
    const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
    
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        const volumes: any[] = [];
        const chapters: any[] = [];
        
        // Fire Force uses nested tables with volume info
        // Look for the main content tables
        const volumeTables = $('table').filter((_, table) => {
            const $table = $(table);
            const text = $table.text();
            return text.includes('Volume') && (text.includes('Chapter') || text.includes('ISBN'));
        });
        
        console.log(`Found ${volumeTables.length} volume tables`);
        
        // Process each volume table
        volumeTables.each((index, table) => {
            const $table = $(table);
            
            // Find volume header
            const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
            if (volumeHeader.length) {
                const volumeText = volumeHeader.text().trim();
                const volumeMatch = volumeText.match(/Volume\s*(\d+)/i);
                
                if (volumeMatch) {
                    const volumeNumber = parseInt(volumeMatch[1]);
                    
                    const volumeData: any = {
                        number: volumeNumber,
                        title: volumeText,
                        url: volumeHeader.attr('href'),
                        chapters: []
                    };
                    
                    // Extract ISBN
                    const isbnMatch = $table.text().match(/ISBN[:\s]*([\d-]+)/);
                    if (isbnMatch) {
                        volumeData.isbn = isbnMatch[1];
                    }
                    
                    // Extract release dates
                    const releaseDateMatch = $table.text().match(/(\w+\s+\d{1,2},?\s+\d{4})/);
                    if (releaseDateMatch) {
                        volumeData.releaseDate = releaseDateMatch[1];
                    }
                    
                    // Extract cover image
                    const coverImage = $table.find('img').first();
                    if (coverImage.length) {
                        let imgUrl = coverImage.attr('src') || coverImage.attr('data-src');
                        if (imgUrl && imgUrl.startsWith('//')) {
                            imgUrl = 'https:' + imgUrl;
                        }
                        volumeData.coverImage = imgUrl;
                    }
                    
                    // Find chapters in this volume
                    // Look for chapter links within the table and its siblings
                    const $current = $table;
                    let foundChapters = false;
                    
                    // First try within the table
                    $table.find('a').each((_, link) => {
                        const $link = $(link);
                        const href = $link.attr('href') || '';
                        
                        if (href.includes('/wiki/Chapter_')) {
                            const chapterText = $link.text().trim() || href.replace('/wiki/', '').replace(/_/g, ' ');
                            const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
                            
                            if (chapterMatch) {
                                const chapterData = {
                                    number: chapterMatch[1],
                                    title: chapterText,
                                    url: href,
                                    volume: volumeNumber
                                };
                                
                                volumeData.chapters.push(chapterData);
                                chapters.push(chapterData);
                                foundChapters = true;
                            }
                        }
                    });
                    
                    // If no chapters found in table, look in following elements
                    if (!foundChapters) {
                        // Check next siblings for chapter lists
                        let $next = $table.next();
                        let maxLookAhead = 5;
                        
                        while ($next.length && maxLookAhead > 0) {
                            // Stop if we hit another volume table
                            if ($next.is('table') && $next.text().includes('Volume')) {
                                break;
                            }
                            
                            $next.find('a').each((_, link) => {
                                const $link = $(link);
                                const href = $link.attr('href') || '';
                                
                                if (href.includes('/wiki/Chapter_')) {
                                    const chapterText = $link.text().trim() || href.replace('/wiki/', '').replace(/_/g, ' ');
                                    const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
                                    
                                    if (chapterMatch) {
                                        const chapterData = {
                                            number: chapterMatch[1],
                                            title: chapterText,
                                            url: href,
                                            volume: volumeNumber
                                        };
                                        
                                        volumeData.chapters.push(chapterData);
                                        chapters.push(chapterData);
                                    }
                                }
                            });
                            
                            $next = $next.next();
                            maxLookAhead--;
                        }
                    }
                    
                    volumes.push(volumeData);
                    
                    console.log(`Volume ${volumeNumber}: ${volumeData.chapters.length} chapters`);
                }
            }
        });
        
        // Alternative approach: Look for volume links directly
        if (volumes.length === 0) {
            console.log('\\nTrying alternative extraction method...');
            
            // Find all volume links
            const volumeLinks = $('a[href*="/wiki/Volume_"]');
            console.log(`Found ${volumeLinks.length} volume links`);
            
            const volumeSet = new Set<number>();
            
            volumeLinks.each((_, link) => {
                const $link = $(link);
                const href = $link.attr('href');
                const match = href?.match(/Volume_(\d+)/);
                
                if (match) {
                    const volumeNumber = parseInt(match[1]);
                    if (!volumeSet.has(volumeNumber)) {
                        volumeSet.add(volumeNumber);
                        
                        const volumeData = {
                            number: volumeNumber,
                            title: `Volume ${volumeNumber}`,
                            url: href,
                            chapters: []
                        };
                        
                        volumes.push(volumeData);
                    }
                }
            });
            
            // Find all chapter links
            const chapterLinks = $('a[href*="/wiki/Chapter_"]');
            console.log(`Found ${chapterLinks.length} chapter links`);
            
            chapterLinks.each((_, link) => {
                const $link = $(link);
                const href = $link.attr('href');
                const text = $link.text().trim();
                const match = href?.match(/Chapter_(\d+(?:\.\d+)?)/);
                
                if (match) {
                    const chapterNumber = match[1];
                    
                    // Try to determine volume from context
                    let volumeNumber = 1;
                    const $parent = $link.closest('table, div, section');
                    const parentText = $parent.text();
                    const volumeMatch = parentText.match(/Volume\s*(\d+)/i);
                    if (volumeMatch) {
                        volumeNumber = parseInt(volumeMatch[1]);
                    }
                    
                    const chapterData = {
                        number: chapterNumber,
                        title: text || `Chapter ${chapterNumber}`,
                        url: href,
                        volume: volumeNumber
                    };
                    
                    chapters.push(chapterData);
                    
                    // Add to corresponding volume
                    const volume = volumes.find(v => v.number === volumeNumber);
                    if (volume) {
                        volume.chapters.push(chapterData);
                    }
                }
            });
        }
        
        // Sort volumes and chapters
        volumes.sort((a, b) => a.number - b.number);
        chapters.sort((a, b) => {
            const aNum = parseFloat(a.number);
            const bNum = parseFloat(b.number);
            return aNum - bNum;
        });
        
        console.log('\\n' + '='.repeat(80));
        console.log('EXTRACTION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Volumes: ${volumes.length}`);
        console.log(`Total Chapters: ${chapters.length}`);
        
        if (volumes.length > 0) {
            console.log('\\nFirst 3 Volumes:');
            volumes.slice(0, 3).forEach(vol => {
                console.log(`  Volume ${vol.number}: ${vol.chapters.length} chapters`);
                if (vol.isbn) console.log(`    ISBN: ${vol.isbn}`);
                if (vol.releaseDate) console.log(`    Release: ${vol.releaseDate}`);
            });
        }
        
        if (chapters.length > 0) {
            console.log('\\nFirst 5 Chapters:');
            chapters.slice(0, 5).forEach(ch => {
                console.log(`  Chapter ${ch.number}: ${ch.title} (Volume ${ch.volume})`);
            });
            
            console.log('\\nLast 5 Chapters:');
            chapters.slice(-5).forEach(ch => {
                console.log(`  Chapter ${ch.number}: ${ch.title} (Volume ${ch.volume})`);
            });
        }
        
        // Test: Check if we can identify the tabber structure
        const tabbers = $('.tabber, .wds-tabber');
        console.log(`\\nTabbed interfaces found: ${tabbers.length}`);
        
        // Check for specific Fire Force patterns
        const hasNestedTables = $('table table').length > 0;
        const hasVolumeHeaders = $('th:contains("Volume")').length > 0;
        const hasChapterCells = $('td:contains("Chapter")').length > 0;
        
        console.log('\\nPage Structure:');
        console.log(`  Nested tables: ${hasNestedTables}`);
        console.log(`  Volume headers: ${hasVolumeHeaders}`);
        console.log(`  Chapter cells: ${hasChapterCells}`);
        
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
    }
}

// Run the test
testFireForceVolumes().then(() => {
    console.log('\\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});