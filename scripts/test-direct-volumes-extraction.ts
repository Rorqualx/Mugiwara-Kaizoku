#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testDirectExtraction() {
  console.log('Testing direct extraction from Fire Force List of Volumes...\n');

  const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== EXPANDING COLLAPSED SECTIONS ===\n');
    
    // Expand collapsed sections
    $('.mw-collapsible').removeClass('mw-collapsed');
    $('.mw-collapsible-content').css('display', '');
    
    console.log('Collapsed sections expanded.\n');
    
    console.log('=== LOOKING FOR VOLUME TABLES ===\n');
    
    // Look for volume tables
    const volumeTables = $('table').filter((_, table) => {
      const $table = $(table);
      const hasVolumeLink = $table.find('th a[href*="/wiki/Volume_"]').length > 0;
      const text = $table.text();
      const hasVolumeText = text.includes('Volume') && (text.includes('ISBN') || text.includes('Release'));
      
      if (hasVolumeLink || hasVolumeText) {
        const volumeMatch = text.match(/Volume\s*(\d+)/i);
        if (volumeMatch) {
          console.log(`Found volume table for Volume ${volumeMatch[1]}`);
        }
      }
      
      return hasVolumeLink || hasVolumeText;
    });
    
    console.log(`\nTotal volume tables found: ${volumeTables.length}\n`);
    
    console.log('=== EXTRACTING CHAPTERS FROM VOLUME TABLES ===\n');
    
    const allChapters: any[] = [];
    
    volumeTables.each((i, table) => {
      const $table = $(table);
      
      // Find volume header
      const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
      let volumeNumber = 0;
      
      if (volumeHeader.length) {
        const volumeText = volumeHeader.text();
        const match = volumeText.match(/Volume\s*(\d+)/i);
        if (match) {
          volumeNumber = parseInt(match[1]);
        }
      } else {
        // Try to extract from table text
        const tableText = $table.text();
        const match = tableText.match(/Volume\s*(\d+)/i);
        if (match) {
          volumeNumber = parseInt(match[1]);
        }
      }
      
      // Look for chapter links
      const chapterLinks = $table.find('a[href*="/wiki/Chapter_"]');
      
      if (chapterLinks.length > 0) {
        console.log(`Volume ${volumeNumber}: Found ${chapterLinks.length} chapter links`);
        
        chapterLinks.each((j, link) => {
          const $link = $(link);
          const href = $link.attr('href') || '';
          const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
          
          if (chapterMatch) {
            const chapterNum = chapterMatch[1];
            const chapterTitle = $link.text().trim();
            
            allChapters.push({
              number: chapterNum,
              title: chapterTitle,
              volume: volumeNumber,
              url: href
            });
            
            // Check if this is one of our missing chapters
            if (['294', '283', '282', '133', '111', '90', '37', '0'].includes(chapterNum)) {
              console.log(`  ✓ Found missing chapter ${chapterNum}: "${chapterTitle}"`);
            }
          }
        });
      }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total chapters extracted: ${allChapters.length}`);
    
    // Check for missing chapters
    const missingChapters = ['294', '283', '282', '133', '111', '90', '37', '0'];
    const foundMissing = missingChapters.filter(num => 
      allChapters.some(ch => ch.number === num)
    );
    
    console.log(`\nMissing chapters found: ${foundMissing.length}/${missingChapters.length}`);
    if (foundMissing.length > 0) {
      console.log(`Found: ${foundMissing.join(', ')}`);
    }
    
    const stillMissing = missingChapters.filter(num => 
      !allChapters.some(ch => ch.number === num)
    );
    if (stillMissing.length > 0) {
      console.log(`Still missing: ${stillMissing.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectExtraction();