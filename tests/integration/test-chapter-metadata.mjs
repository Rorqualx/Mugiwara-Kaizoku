#!/usr/bin/env node

import axios from 'axios';
import { load } from 'cheerio';

const testChapterUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';

async function fetchChapterMetadata(url) {
  try {
    console.log(`Fetching chapter metadata from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = load(response.data);
    
    // Extract cover image - look for the main infobox image
    let coverImageUrl;
    
    // Try multiple selectors for the cover image
    const imageSelectors = [
      '.pi-image-collection img',
      '.pi-image img', 
      '.infobox img',
      '.portable-infobox img',
      'aside.portable-infobox img',
      '.pi-item img',
      '#mw-content-text img[alt*="Chapter"]',
      '#mw-content-text img[alt*="Cover"]'
    ];
    
    for (const selector of imageSelectors) {
      const img = $(selector).first();
      if (img.length > 0) {
        const src = img.attr('data-src') || img.attr('src');
        console.log(`Found image with selector "${selector}": ${src}`);
        if (src && !src.includes('wiki.png')) {
          // Clean up the URL - remove revision parameters
          coverImageUrl = src.split('/revision/')[0];
          if (!coverImageUrl.startsWith('http')) {
            coverImageUrl = 'https:' + coverImageUrl;
          }
          break;
        }
      }
    }
    
    // Extract title from the page
    const title = $('h1.page-header__title, h1#firstHeading, .pi-title').first().text().trim();
    
    // Extract chapter number from title or infobox
    let chapterNumber = title.match(/Chapter\s+(\d+)/i)?.[1];
    if (!chapterNumber) {
      chapterNumber = $('.pi-data-value:contains("Chapter")').text().match(/\d+/)?.[0];
    }
    
    console.log('\n=== Chapter Metadata Found ===');
    console.log('Title:', title);
    console.log('Chapter Number:', chapterNumber);
    console.log('Cover Image URL:', coverImageUrl);
    
    // Also check if there are any images in the infobox
    console.log('\n=== All infobox images ===');
    $('.portable-infobox img, .infobox img, .pi-image img').each((i, elem) => {
      const src = $(elem).attr('data-src') || $(elem).attr('src');
      const alt = $(elem).attr('alt') || 'No alt text';
      console.log(`Image ${i + 1}: ${alt} - ${src}`);
    });
    
    return {
      coverImageUrl,
      title,
      chapterNumber
    };
  } catch (error) {
    console.error('Error fetching chapter metadata:', error.message);
    return null;
  }
}

// Test the function
fetchChapterMetadata(testChapterUrl);