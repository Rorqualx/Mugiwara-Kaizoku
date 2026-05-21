#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugVolume34() {
  console.log('Debugging Volume 34 HTML parsing...\n');
  
  const url = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';
  
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  // Find the Chapter Titles section
  const chapterTitlesSection = $('h2:contains("Chapter Titles")').first();
  console.log('Found Chapter Titles section:', chapterTitlesSection.length > 0);
  
  if (chapterTitlesSection.length > 0) {
    const chapterList = chapterTitlesSection.nextAll('ul, ol').first();
    console.log('Found chapter list:', chapterList.length > 0);
    
    if (chapterList.length > 0) {
      const listItems = chapterList.find('li');
      console.log(`\nTotal list items: ${listItems.length}\n`);
      
      listItems.each((index, element) => {
        const text = $(element).text().trim();
        console.log(`Item ${index + 1}: "${text}"`);
        
        // Test different patterns
        const patterns = {
          chapterRoman: /^Chapter\s+([IVXLCDM]+)[:\s]+(.+)/i,
          finalChapter: /^Final Chapter[:\s]+(.+)/i,
          epilogue: /^Epilogue\s+(\d+)[:\s]+(.+)/i,
        };
        
        for (const [name, pattern] of Object.entries(patterns)) {
          const match = text.match(pattern);
          if (match) {
            console.log(`  ✓ Matches ${name}: ${JSON.stringify(match.slice(1))}`);
          }
        }
        console.log('');
      });
    }
  }
  
  // Also check for any text content
  const wikiContent = $('.wiki-item-display').first();
  const allText = wikiContent.text();
  
  // Look for patterns in the raw text
  console.log('\n=== Looking for chapter patterns in raw text ===\n');
  
  const romanPattern = /Chapter\s+([IVXLCDM]+)[:\s]+([^\n]+)/gi;
  let matches = [...allText.matchAll(romanPattern)];
  console.log(`Found ${matches.length} Roman numeral chapters in text`);
  matches.forEach(m => console.log(`  Chapter ${m[1]}: ${m[2]}`));
  
  const finalPattern = /Final Chapter[:\s]+([^\n]+)/gi;
  matches = [...allText.matchAll(finalPattern)];
  console.log(`\nFound ${matches.length} Final Chapter mentions`);
  matches.forEach(m => console.log(`  Final Chapter: ${m[1]}`));
  
  const epiloguePattern = /Epilogue\s+(\d+)[:\s]+([^\n]+)/gi;
  matches = [...allText.matchAll(epiloguePattern)];
  console.log(`\nFound ${matches.length} Epilogue mentions`);
  matches.forEach(m => console.log(`  Epilogue ${m[1]}: ${m[2]}`));
}

debugVolume34();