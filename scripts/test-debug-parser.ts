#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testDebugParser() {
  console.log('Debug testing DynamicWikiParser flow...\n');

  const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== SIMULATING extractFromTables METHOD ===\n');
    
    // Expand collapsed sections
    $('.mw-collapsible').removeClass('mw-collapsed');
    $('.mw-collapsible-content').css('display', '');
    
    // Look for volume tables exactly as the parser does
    const volumeTables = $('table').filter((_, table) => {
      const $table = $(table);
      const text = $table.text();
      const hasVolumeLink = $table.find('th a[href*="/wiki/Volume_"]').length > 0;
      const hasVolumeText = text.includes('Volume') && (text.includes('ISBN') || text.includes('Release'));
      return hasVolumeLink || hasVolumeText;
    });
    
    console.log(`Volume tables found: ${volumeTables.length}\n`);
    
    const volumes: any[] = [];
    const chapters: any[] = [];
    const processedChapters = new Set<string>();
    const processedVolumeData = new Map<number, any>();
    
    volumeTables.each((tableIndex: number, table: any) => {
      const $table = $(table);
      
      // Find volume header with link
      const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
      
      if (volumeHeader.length) {
        const volumeText = volumeHeader.text().trim();
        const volumeMatch = volumeText.match(/Volume\s*(\d+)/i);
        
        if (volumeMatch) {
          const volumeNumber = parseInt(volumeMatch[1]);
          
          console.log(`Processing table ${tableIndex + 1}: Volume ${volumeNumber}`);
          
          // Get or create volume data
          let volumeData = processedVolumeData.get(volumeNumber);
          if (!volumeData) {
            volumeData = {
              number: volumeNumber,
              title: volumeText,
              url: volumeHeader.attr('href'),
              chapters: []
            };
            processedVolumeData.set(volumeNumber, volumeData);
            volumes.push(volumeData);
            console.log(`  Created new volume data for Volume ${volumeNumber}`);
          } else {
            console.log(`  Volume ${volumeNumber} already exists, merging data`);
          }
          
          // Find chapters in table
          const findChaptersInContext = ($context: cheerio.Cheerio<any>) => {
            $context.find('a').each((_: number, link: any) => {
              const $link = $(link);
              const href = $link.attr('href') || '';
              
              if (href.includes('/wiki/Chapter_')) {
                const chapterText = $link.text().trim() || href.replace('/wiki/', '').replace(/_/g, ' ');
                const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
                
                if (chapterMatch) {
                  const chapterNumber = chapterMatch[1];
                  
                  if (!processedChapters.has(chapterNumber)) {
                    processedChapters.add(chapterNumber);
                    
                    const chapterData = {
                      number: chapterNumber,
                      title: chapterText,
                      url: href,
                      volume: volumeNumber
                    };
                    
                    volumeData.chapters.push(chapterData);
                    chapters.push(chapterData);
                    
                    // Check if this is a missing chapter
                    if (['294', '283', '282', '133', '111', '90', '37', '0'].includes(chapterNumber)) {
                      console.log(`    ✓ Found missing chapter ${chapterNumber}: "${chapterText}"`);
                    }
                  }
                }
              }
            });
          };
          
          // Search in table
          const beforeCount = chapters.length;
          findChaptersInContext($table);
          const afterCount = chapters.length;
          console.log(`  Found ${afterCount - beforeCount} chapters in table`);
          
          // Search in next siblings
          let $next = $table.next();
          let maxLookAhead = 5;
          
          while ($next.length && maxLookAhead > 0) {
            // Stop if we hit another volume table
            if ($next.is('table') && $next.find('a[href*="/wiki/Volume_"]').length > 0) {
              break;
            }
            
            const beforeSiblingCount = chapters.length;
            findChaptersInContext($next);
            const afterSiblingCount = chapters.length;
            
            if (afterSiblingCount > beforeSiblingCount) {
              console.log(`  Found ${afterSiblingCount - beforeSiblingCount} chapters in sibling element`);
            }
            
            $next = $next.next();
            maxLookAhead--;
          }
        }
      } else {
        console.log(`Table ${tableIndex + 1}: No volume header found`);
      }
    });
    
    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total volumes: ${volumes.length}`);
    console.log(`Total chapters: ${chapters.length}`);
    
    const missingChapters = ['294', '283', '282', '133', '111', '90', '37', '0'];
    const foundMissing = missingChapters.filter(num => 
      chapters.some(ch => ch.number === num)
    );
    
    console.log(`\nMissing chapters found: ${foundMissing.length}/${missingChapters.length}`);
    if (foundMissing.length > 0) {
      console.log(`Found: ${foundMissing.join(', ')}`);
    }
    
    const stillMissing = missingChapters.filter(num => 
      !chapters.some(ch => ch.number === num)
    );
    if (stillMissing.length > 0) {
      console.log(`Still missing: ${stillMissing.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDebugParser();