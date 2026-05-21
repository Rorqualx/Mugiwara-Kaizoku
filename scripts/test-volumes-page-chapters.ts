#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testVolumesPageChapters() {
  console.log('Investigating Fire Force List of Volumes page for missing chapters...\n');

  const volumesPageUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
  const missingChapters = ['294', '283', '282', '133', '111', '90', '37', '0'];
  
  try {
    const response = await axios.get(volumesPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== ANALYZING LIST OF VOLUMES PAGE ===\n');
    
    // Find all chapter links on the page
    const allChapterLinks = $('a[href*="/wiki/Chapter_"]');
    console.log(`Total chapter links found: ${allChapterLinks.length}\n`);
    
    // Extract all chapter numbers
    const allChapterNumbers: string[] = [];
    allChapterLinks.each((i, link) => {
      const href = $(link).attr('href') || '';
      const chapterNum = href.match(/Chapter_(\d+(?:\.\d+)?)/)?.[1];
      if (chapterNum) {
        allChapterNumbers.push(chapterNum);
      }
    });
    
    // Check which missing chapters are found
    console.log('=== CHECKING FOR MISSING CHAPTERS ===\n');
    missingChapters.forEach(chapterNum => {
      const found = allChapterNumbers.includes(chapterNum);
      if (found) {
        console.log(`Chapter ${chapterNum}: ✓ FOUND`);
        
        // Get more details about where it's found
        const chapterLink = $(`a[href*="/wiki/Chapter_${chapterNum}"]`).first();
        const linkText = chapterLink.text().trim();
        const parent = chapterLink.parent();
        const grandparent = parent.parent();
        
        // Check if it's in a table
        const inTable = chapterLink.closest('table');
        if (inTable.length) {
          // Find the volume this chapter belongs to
          const volumeHeader = inTable.find('th a[href*="/wiki/Volume_"]').first();
          if (volumeHeader.length) {
            const volumeText = volumeHeader.text();
            console.log(`  In: ${volumeText}`);
          }
          
          // Check if the table row is visible
          const row = chapterLink.closest('tr');
          const isHidden = row.css('display') === 'none' || row.hasClass('mw-collapsed');
          if (isHidden) {
            console.log(`  ⚠️ Row might be hidden`);
          }
        }
        
        console.log(`  Link text: "${linkText}"`);
        console.log(`  Parent tag: ${parent.prop('tagName')}`);
        
      } else {
        console.log(`Chapter ${chapterNum}: ✗ NOT FOUND`);
      }
    });
    
    console.log('\n=== ANALYZING VOLUME TABLES ===\n');
    
    // Find all volume tables
    const volumeTables = $('table').filter((i, table) => {
      const $table = $(table);
      return $table.find('th a[href*="/wiki/Volume_"]').length > 0 ||
             $table.find('th').text().includes('Volume');
    });
    
    console.log(`Found ${volumeTables.length} volume tables\n`);
    
    // Analyze each volume table
    volumeTables.each((i, table) => {
      const $table = $(table);
      const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
      
      if (volumeHeader.length) {
        const volumeText = volumeHeader.text().trim();
        const volumeNum = volumeText.match(/Volume\s*(\d+)/i)?.[1];
        
        // Count chapters in this volume
        const chapterLinks = $table.find('a[href*="/wiki/Chapter_"]');
        const chapterNumbers: string[] = [];
        
        chapterLinks.each((j, link) => {
          const href = $(link).attr('href') || '';
          const num = href.match(/Chapter_(\d+(?:\.\d+)?)/)?.[1];
          if (num) chapterNumbers.push(num);
        });
        
        // Check if any missing chapters are in this volume
        const foundMissing = missingChapters.filter(num => chapterNumbers.includes(num));
        
        if (foundMissing.length > 0) {
          console.log(`Volume ${volumeNum}: Contains missing chapters: ${foundMissing.join(', ')}`);
          console.log(`  Total chapters in volume: ${chapterNumbers.length}`);
          console.log(`  Chapter range: ${chapterNumbers[0]} - ${chapterNumbers[chapterNumbers.length - 1]}`);
          
          // Check table structure
          const rows = $table.find('tr');
          console.log(`  Table has ${rows.length} rows`);
          
          // Check if chapters are in nested tables
          const nestedTables = $table.find('table');
          if (nestedTables.length > 0) {
            console.log(`  ⚠️ Contains ${nestedTables.length} nested tables`);
          }
        }
      }
    });
    
    console.log('\n=== CHECKING PAGE STRUCTURE ===\n');
    
    // Check for tabs
    const tabs = $('.wds-tabber, .tabber, .tabberlive');
    console.log(`Tabs found: ${tabs.length}`);
    
    if (tabs.length > 0) {
      tabs.each((i, tab) => {
        const $tab = $(tab);
        const tabLabels = $tab.find('.wds-tabs__tab-label, .tabbernav a');
        console.log(`\nTab ${i + 1} labels:`);
        tabLabels.each((j, label) => {
          console.log(`  - ${$(label).text().trim()}`);
        });
        
        // Check if missing chapters are in tabs
        const tabContent = $tab.find('.wds-tab__content, .tabbertab');
        tabContent.each((j, content) => {
          const $content = $(content);
          const chapterLinks = $content.find('a[href*="/wiki/Chapter_"]');
          const numbers: string[] = [];
          
          chapterLinks.each((k, link) => {
            const num = $(link).attr('href')?.match(/Chapter_(\d+)/)?.[1];
            if (num) numbers.push(num);
          });
          
          const foundMissing = missingChapters.filter(num => numbers.includes(num));
          if (foundMissing.length > 0) {
            console.log(`  Tab content ${j + 1} contains missing chapters: ${foundMissing.join(', ')}`);
          }
        });
      });
    }
    
    // Check for collapsible sections
    const collapsibles = $('.mw-collapsible');
    console.log(`\nCollapsible sections: ${collapsibles.length}`);
    
    if (collapsibles.length > 0) {
      collapsibles.each((i, collapsible) => {
        const $collapsible = $(collapsible);
        const chapterLinks = $collapsible.find('a[href*="/wiki/Chapter_"]');
        const numbers: string[] = [];
        
        chapterLinks.each((j, link) => {
          const num = $(link).attr('href')?.match(/Chapter_(\d+)/)?.[1];
          if (num) numbers.push(num);
        });
        
        const foundMissing = missingChapters.filter(num => numbers.includes(num));
        if (foundMissing.length > 0) {
          console.log(`  Collapsible ${i + 1} contains missing chapters: ${foundMissing.join(', ')}`);
          
          // Check if it's collapsed by default
          if ($collapsible.hasClass('mw-collapsed')) {
            console.log(`    ⚠️ Collapsed by default`);
          }
        }
      });
    }
    
    console.log('\n=== RAW HTML SEARCH ===\n');
    
    // Search for the chapter URLs in raw HTML
    const html = response.data;
    missingChapters.forEach(num => {
      const pattern = `/wiki/Chapter_${num}`;
      if (html.includes(pattern)) {
        console.log(`✓ Chapter ${num} exists in HTML`);
        
        // Find context
        const index = html.indexOf(pattern);
        const before = html.substring(Math.max(0, index - 200), index);
        const after = html.substring(index, Math.min(html.length, index + 200));
        
        // Check various indicators
        if (before.includes('display:none') || before.includes('display: none')) {
          console.log(`  ⚠️ May be hidden with CSS`);
        }
        if (before.includes('mw-collapsed')) {
          console.log(`  ⚠️ In collapsed section`);
        }
        if (before.includes('tabbertab') || before.includes('wds-tab__content')) {
          console.log(`  📑 In a tab`);
        }
        
        // Extract the link text
        const linkMatch = after.match(/>([^<]+)</);
        if (linkMatch) {
          console.log(`  Link text: "${linkMatch[1]}"`);
        }
      } else {
        console.log(`✗ Chapter ${num} NOT in HTML`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testVolumesPageChapters();