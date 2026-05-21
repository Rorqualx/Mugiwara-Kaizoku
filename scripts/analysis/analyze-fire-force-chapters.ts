#!/usr/bin/env ts-node

/**
 * Detailed analysis of Fire Force chapters page
 */

import axios from 'axios';
import * as fs from 'fs';

async function analyzeFireForceChapters() {
  console.log('=== Analyzing Fire Force Chapters Page ===\n');
  
  const apiBase = 'https://en.wikipedia.org/w/api.php';
  const pageTitle = 'List of Fire Force chapters';
  
  try {
    // Get the page content
    const contentUrl = `${apiBase}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
    const response = await axios.get(contentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaApp/1.0)'
      }
    });
    
    if (!response.data.parse) {
      console.log('Page not found');
      return;
    }
    
    const htmlContent = response.data.parse.text['*'];
    
    // Save HTML for inspection
    fs.writeFileSync('/tmp/fire-force-chapters.html', htmlContent);
    console.log('HTML saved to /tmp/fire-force-chapters.html\n');
    
    // The Fire Force page uses a different structure
    // Chapters are in definition lists (dl/dd tags) not tables
    
    // Look for volume sections
    const volumeSections = htmlContent.split(/<h2[^>]*>/);
    console.log(`Found ${volumeSections.length - 1} main sections\n`);
    
    // Pattern for Fire Force chapters: 00. "Title" (Japanese, Romaji)
    const chapterPattern = /(\d{2,3})\.\s*"([^"]+)"\s*(?:\([^)]+\))?/g;
    const chapters = [...htmlContent.matchAll(chapterPattern)];
    
    console.log(`Total chapters found: ${chapters.length}\n`);
    
    // Group chapters by volume
    const volumePattern = /<dt>Volume\s+(\d+)[^<]*<\/dt>(.*?)(?=<dt>Volume\s+\d+|$)/gs;
    const volumes = [...htmlContent.matchAll(volumePattern)];
    
    console.log(`Total volumes found: ${volumes.length}\n`);
    
    // Parse each volume
    const volumeData = [];
    for (const volMatch of volumes) {
      const volNum = parseInt(volMatch[1]);
      const volContent = volMatch[2];
      
      // Extract chapters in this volume
      const volChapters = [...volContent.matchAll(chapterPattern)];
      
      // Extract release dates
      const datePattern = /(\w+\s+\d+,\s+\d{4})/g;
      const dates = [...volContent.matchAll(datePattern)];
      
      // Extract ISBNs
      const isbnPattern = /(978-[\d-]+)/g;
      const isbns = [...volContent.matchAll(isbnPattern)];
      
      volumeData.push({
        volume: volNum,
        chapterCount: volChapters.length,
        chapters: volChapters.map(ch => ({
          number: ch[1],
          title: ch[2]
        })),
        releaseDate: dates[0]?.[1],
        isbn: isbns[0]?.[1]
      });
    }
    
    // Display summary
    console.log('Volume Summary:');
    console.log('================');
    volumeData.slice(0, 5).forEach(vol => {
      console.log(`\nVolume ${vol.volume}:`);
      console.log(`  Chapters: ${vol.chapterCount}`);
      console.log(`  Release: ${vol.releaseDate || 'N/A'}`);
      console.log(`  ISBN: ${vol.isbn || 'N/A'}`);
      console.log(`  Chapter list:`);
      vol.chapters.forEach(ch => {
        console.log(`    ${ch.number}. "${ch.title}"`);
      });
    });
    
    // Overall stats
    const totalChapters = volumeData.reduce((sum, vol) => sum + vol.chapterCount, 0);
    console.log('\n=== Overall Statistics ===');
    console.log(`Total Volumes: ${volumeData.length}`);
    console.log(`Total Chapters: ${totalChapters}`);
    console.log(`Average chapters per volume: ${(totalChapters / volumeData.length).toFixed(1)}`);
    
    // Check for special sections
    const hasChapterNotInVolumes = htmlContent.includes('not yet been published in');
    if (hasChapterNotInVolumes) {
      console.log('\nNote: Page includes chapters not yet published in volumes');
    }
    
    return volumeData;
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeFireForceChapters().catch(console.error);