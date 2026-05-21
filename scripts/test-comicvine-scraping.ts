#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testComicVineScraping() {
  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  
  console.log('Testing ComicVine volume URL scraping...\n');
  console.log('Fetching:', seriesUrl);
  
  const response = await axios.get(seriesUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 10000
  });
  
  const $ = cheerio.load(response.data);
  
  // Look for all links with /4000- pattern (these are issues/volumes)
  const volumeUrls: { volumeNumber: number; url: string; title: string }[] = [];
  
  $('a[href*="/4000-"]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    const issueText = $el.find('.issue-number').text().trim();
    const title = $el.text().replace(issueText, '').trim();
    
    if (href && href.includes('/4000-')) {
      const fullUrl = href.startsWith('http') ? href : `https://comicvine.gamespot.com${href}`;
      
      // Extract volume number from "Issue #34" text
      const match = issueText.match(/Issue #(\d+)/);
      const volumeNumber = match ? parseInt(match[1]) : 0;
      
      if (volumeNumber > 0) {
        volumeUrls.push({ volumeNumber, url: fullUrl, title });
      }
    }
  });
  
  // Sort by volume number
  volumeUrls.sort((a, b) => a.volumeNumber - b.volumeNumber);
  
  console.log(`\nFound ${volumeUrls.length} volumes:\n`);
  
  // Show first 5 and last 5
  if (volumeUrls.length > 0) {
    console.log('First 5 volumes:');
    volumeUrls.slice(0, 5).forEach(v => {
      console.log(`  Volume ${v.volumeNumber}: ${v.url}`);
    });
    
    if (volumeUrls.length > 10) {
      console.log('\n...\n');
    }
    
    if (volumeUrls.length > 5) {
      console.log('Last 5 volumes:');
      volumeUrls.slice(-5).forEach(v => {
        console.log(`  Volume ${v.volumeNumber}: ${v.url}`);
      });
    }
  }
  
  // Now test scraping a volume page for chapters
  if (volumeUrls.length > 0) {
    const testVolume = volumeUrls[volumeUrls.length - 1]; // Test last volume
    console.log(`\n\nTesting chapter scraping for Volume ${testVolume.volumeNumber}...`);
    console.log(`Fetching: ${testVolume.url}`);
    
    try {
      const volumeResponse = await axios.get(testVolume.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $volume = cheerio.load(volumeResponse.data);
      
      // Look for Chapter Titles section
      const chapterTitlesSection = $volume('h2:contains("Chapter Titles")').first();
      if (chapterTitlesSection.length > 0) {
        console.log('\nFound "Chapter Titles" section!');
        
        const chapterList = chapterTitlesSection.nextAll('ul, ol').first();
        const chapters = chapterList.find('li');
        
        console.log(`Found ${chapters.length} chapters:`);
        
        chapters.slice(0, 5).each((i, el) => {
          const text = $volume(el).text().trim();
          console.log(`  - ${text}`);
        });
        
        if (chapters.length > 5) {
          console.log(`  ... and ${chapters.length - 5} more`);
        }
      } else {
        console.log('\nNo "Chapter Titles" section found');
        
        // Try to find chapters in other ways
        const possibleChapters = $volume('*:contains("Chapter")').filter((_, el) => {
          const text = $volume(el).text();
          return text.match(/Chapter\s+[IVXLCDM\d]+/i);
        });
        
        console.log(`Found ${possibleChapters.length} elements containing "Chapter"`);
      }
    } catch (err) {
      console.error('Failed to fetch volume page:', err.message);
    }
  }
}

testComicVineScraping().catch(console.error);
