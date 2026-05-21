#!/usr/bin/env ts-node

/**
 * Debug Fire Force parsing
 */

import axios from 'axios';

async function debugParsing() {
  const apiBase = 'https://en.wikipedia.org/w/api.php';
  const pageId = '59603936'; // Fire Force chapters page
  
  const contentUrl = `${apiBase}?action=parse&pageid=${pageId}&prop=text&format=json`;
  const response = await axios.get(contentUrl);
  const htmlContent = response.data.parse.text['*'];
  
  // Check for volume rows
  const volumeRowPattern = /<tr[^>]*>.*?id="vol(\d+)".*?<\/tr>/gs;
  const volumeRows = [...htmlContent.matchAll(volumeRowPattern)];
  console.log(`Found ${volumeRows.length} volume rows with id="volX" pattern\n`);
  
  // Try a different pattern - look for volume numbers in cells
  const volumePattern = /<th[^>]*>(\d+)<\/th>/g;
  const volumeNumbers = [...htmlContent.matchAll(volumePattern)];
  console.log(`Found ${volumeNumbers.length} potential volume numbers\n`);
  
  // Count all chapter patterns
  const chapterPattern = /(\d{1,3})\.\s*"([^"]+)"/g;
  const allChapters = [...htmlContent.matchAll(chapterPattern)];
  console.log(`Found ${allChapters.length} total chapters\n`);
  
  // Show first 5 and last 5 chapters
  console.log('First 5 chapters:');
  allChapters.slice(0, 5).forEach(ch => {
    console.log(`  ${ch[1]}. "${ch[2]}"`);
  });
  
  console.log('\nLast 5 chapters:');
  allChapters.slice(-5).forEach(ch => {
    console.log(`  ${ch[1]}. "${ch[2]}"`);
  });
  
  // Check table structure
  const tables = [...htmlContent.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>/g)];
  console.log(`\nFound ${tables.length} wikitable(s)`);
  
  // Get the main table and check its structure
  const mainTable = htmlContent.match(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)<\/table>/s);
  if (mainTable) {
    const tableContent = mainTable[1];
    
    // Count rows
    const rows = [...tableContent.matchAll(/<tr[^>]*>/g)];
    console.log(`Main table has ${rows.length} rows`);
    
    // Look for volume indicators
    const volIndicators = [...tableContent.matchAll(/vol(\d+)|Volume\s+(\d+)/gi)];
    console.log(`Found ${volIndicators.length} volume indicators`);
    
    // Extract unique volume numbers
    const uniqueVolumes = new Set<number>();
    volIndicators.forEach(match => {
      const volNum = parseInt(match[1] || match[2]);
      if (volNum) uniqueVolumes.add(volNum);
    });
    console.log(`Unique volumes: ${Array.from(uniqueVolumes).sort((a, b) => a - b).join(', ')}`);
  }
}

debugParsing().catch(console.error);