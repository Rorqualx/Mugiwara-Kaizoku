#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../src/utils/logger';

async function testWikipediaRawHtml() {
    logger.info('Testing Wikipedia raw HTML for Fire Force volumes...');
    
    // Get the parsed HTML content
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const url = `${apiUrl}?action=parse&page=List+of+Fire+Force+chapters&prop=text&format=json&origin=*`;
    
    const response = await axios.get(url);
    const html = response.data.parse?.text?.['*'];
    
    if (!html) {
        logger.error('Failed to get HTML');
        return;
    }
    
    const $ = cheerio.load(html);
    
    // Find all wikitable tables
    const tables = $('table.wikitable');
    logger.info(`Found ${tables.length} wikitable(s)`);
    
    tables.each((tableIndex, table) => {
        const $table = $(table);
        
        // Get headers
        const headers: string[] = [];
        $table.find('tr').first().find('th').each((_, th) => {
            headers.push($(th).text().trim());
        });
        
        logger.info(`\nTable ${tableIndex + 1} headers:`, headers);
        
        // Analyze first few rows to understand structure
        const rows = $table.find('tr').slice(1, 5); // Get first 4 data rows
        
        rows.each((rowIndex, row) => {
            const $row = $(row);
            const cells = $row.find('td');
            
            logger.info(`\nRow ${rowIndex + 1} (${cells.length} cells):`);
            
            cells.each((cellIndex, cell) => {
                const $cell = $(cell);
                const text = $cell.text().trim();
                const rowspan = $cell.attr('rowspan');
                const colspan = $cell.attr('colspan');
                
                // Get first 100 chars of text
                const preview = text.substring(0, 100) + (text.length > 100 ? '...' : '');
                
                logger.info(`  Cell ${cellIndex + 1}:`);
                if (rowspan) logger.info(`    rowspan: ${rowspan}`);
                if (colspan) logger.info(`    colspan: ${colspan}`);
                logger.info(`    text: "${preview}"`);
                
                // Check for nested lists or special formatting
                const lists = $cell.find('ul, ol');
                if (lists.length > 0) {
                    logger.info(`    contains ${lists.length} list(s)`);
                }
                
                // Check for links
                const links = $cell.find('a');
                if (links.length > 0) {
                    logger.info(`    contains ${links.length} link(s)`);
                }
            });
        });
    });
    
    // Try to extract one complete volume's data
    logger.info('\n========================================');
    logger.info('Attempting to extract Volume 1 data...');
    
    const $firstTable = $(tables[0]);
    const allRows = $firstTable.find('tr').slice(1); // Skip header
    
    let currentVolume: any = null;
    const volumes: any[] = [];
    
    allRows.each((_, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 5) {
            // This is a volume row (has all columns)
            if (currentVolume) {
                volumes.push(currentVolume);
            }
            
            currentVolume = {
                number: cells.eq(0).text().trim(),
                originalReleaseDate: cells.eq(1).text().trim(),
                originalISBN: cells.eq(2).text().trim(),
                englishReleaseDate: cells.eq(3).text().trim(),
                englishISBN: cells.eq(4).text().trim(),
                chapters: []
            };
        } else if (cells.length === 1 && currentVolume) {
            // This is a chapter list row (single column spanning all)
            const chapterText = cells.eq(0).text();
            
            // Try to extract chapters
            const chapterPattern = /(\d+)\.\s*"([^"]+)"/g;
            let match;
            while ((match = chapterPattern.exec(chapterText)) !== null) {
                currentVolume.chapters.push({
                    number: match[1],
                    title: match[2]
                });
            }
        }
    });
    
    // Add last volume
    if (currentVolume) {
        volumes.push(currentVolume);
    }
    
    logger.info(`\nExtracted ${volumes.length} volumes`);
    
    // Show first 3 volumes
    volumes.slice(0, 3).forEach(vol => {
        logger.info(`\nVolume ${vol.number}:`);
        logger.info(`  Original: ${vol.originalReleaseDate} - ISBN: ${vol.originalISBN}`);
        logger.info(`  English: ${vol.englishReleaseDate} - ISBN: ${vol.englishISBN}`);
        logger.info(`  Chapters: ${vol.chapters.length}`);
        if (vol.chapters[0]) {
            logger.info(`    First: Ch.${vol.chapters[0].number} - "${vol.chapters[0].title}"`);
        }
    });
}

// Run the test
testWikipediaRawHtml().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});