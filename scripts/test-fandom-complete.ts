#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFandomComplete() {
  console.log('Testing Fire Force Fandom Comprehensive Data Extraction...\n');

  const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== TESTING GALLERY IMAGES ===\n');
    
    // Look for gallery sections
    const galleries = $('.gallery, .wikia-gallery');
    console.log(`Found ${galleries.length} gallery sections\n`);
    
    let totalGalleryImages = 0;
    const magazineCovers: string[] = [];
    
    galleries.each((i, gallery) => {
      const $gallery = $(gallery);
      const items = $gallery.find('.gallerybox, .wikia-gallery-item');
      console.log(`Gallery ${i + 1}: ${items.length} items`);
      
      items.each((j, item) => {
        const $item = $(item);
        const $img = $item.find('img');
        const $caption = $item.find('.gallerytext, .lightbox-caption');
        const captionText = $caption.text().trim();
        
        // Check various image sources
        let imgUrl = $img.attr('src') || $img.attr('data-src');
        
        // Check if image is lazy-loaded with data URI
        if (imgUrl && imgUrl.startsWith('data:')) {
          // Look for noscript tag
          const $noscript = $item.find('noscript');
          if ($noscript.length) {
            const noscriptHtml = $noscript.html();
            const srcMatch = noscriptHtml?.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) {
              imgUrl = srcMatch[1];
              console.log(`  - Found lazy-loaded image in noscript: ${captionText || 'No caption'}`);
            }
          }
        }
        
        if (imgUrl && !imgUrl.startsWith('data:')) {
          totalGalleryImages++;
          if (captionText.includes('Issue')) {
            magazineCovers.push(captionText);
          }
        }
      });
    });
    
    console.log(`\nTotal gallery images found: ${totalGalleryImages}`);
    console.log(`Magazine covers: ${magazineCovers.length}`);
    if (magazineCovers.length > 0) {
      console.log('Magazine cover captions:', magazineCovers);
    }
    
    console.log('\n=== TESTING DATES EXTRACTION ===\n');
    
    // Look for publication dates in infobox
    const infobox = $('.portable-infobox, .infobox').first();
    if (infobox.length) {
      // Look for start date
      const startDateRow = infobox.find('.pi-item[data-source="first_kanji"], .pi-item[data-source="published"], .pi-item[data-source="start_date"]');
      const endDateRow = infobox.find('.pi-item[data-source="last_kanji"], .pi-item[data-source="end_date"]');
      
      console.log('Infobox date rows found:');
      console.log('  Start date row:', startDateRow.length > 0);
      console.log('  End date row:', endDateRow.length > 0);
      
      // Extract text from rows
      if (startDateRow.length) {
        const startText = startDateRow.find('.pi-data-value').text().trim();
        console.log(`  Start date text: "${startText}"`);
      }
      
      if (endDateRow.length) {
        const endText = endDateRow.find('.pi-data-value').text().trim();
        console.log(`  End date text: "${endText}"`);
      }
      
      // Alternative: Look for any date-like patterns in infobox
      const infoboxText = infobox.text();
      const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/g;
      const dates = infoboxText.match(datePattern);
      if (dates) {
        console.log('\nDates found in infobox text:', dates);
      }
    }
    
    console.log('\n=== TESTING CHAPTERS FROM LIST OF VOLUMES ===\n');
    
    // Test the List of Volumes page
    const volumesUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
    const volumesResponse = await axios.get(volumesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $volumes = cheerio.load(volumesResponse.data);
    
    // Expand collapsed sections
    $volumes('.mw-collapsible').removeClass('mw-collapsed');
    $volumes('.mw-collapsible-content').css('display', '');
    
    // Count chapters
    const chapterLinks = $volumes('a[href*="/wiki/Chapter_"]');
    const uniqueChapters = new Set<string>();
    
    chapterLinks.each((i, link) => {
      const href = $volumes(link).attr('href') || '';
      const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
      if (chapterMatch) {
        uniqueChapters.add(chapterMatch[1]);
      }
    });
    
    console.log(`Total unique chapters found: ${uniqueChapters.size}`);
    
    // Check for specific missing chapters
    const missingChapters = ['294', '283', '282', '133', '111', '90', '37', '0'];
    const foundMissing = missingChapters.filter(ch => uniqueChapters.has(ch));
    
    console.log(`\nMissing chapters found: ${foundMissing.length}/${missingChapters.length}`);
    if (foundMissing.length > 0) {
      console.log('Found:', foundMissing.join(', '));
    }
    
    const stillMissing = missingChapters.filter(ch => !uniqueChapters.has(ch));
    if (stillMissing.length > 0) {
      console.log('Still missing:', stillMissing.join(', '));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFandomComplete();