#!/usr/bin/env node

import axios from 'axios';
import { load } from 'cheerio';

const testChapterUrl = 'https://fire-force.fandom.com/wiki/Chapter_0';

async function analyzePageStructure(url) {
  try {
    console.log(`Fetching page structure from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = load(response.data);
    
    console.log('\n=== Page Title ===');
    console.log('h1#firstHeading:', $('h1#firstHeading').text());
    console.log('h1.page-header__title:', $('h1.page-header__title').text());
    console.log('.pi-title:', $('.pi-title').text());
    
    console.log('\n=== All Images on Page (first 10) ===');
    $('img').slice(0, 10).each((i, elem) => {
      const src = $(elem).attr('data-src') || $(elem).attr('src') || 'No src';
      const alt = $(elem).attr('alt') || 'No alt';
      const classes = $(elem).attr('class') || 'No classes';
      console.log(`\nImage ${i + 1}:`);
      console.log('  Alt:', alt);
      console.log('  Classes:', classes);
      console.log('  Src:', src.substring(0, 100) + (src.length > 100 ? '...' : ''));
    });
    
    console.log('\n=== Infobox Structure ===');
    console.log('Has .portable-infobox:', $('.portable-infobox').length > 0);
    console.log('Has .infobox:', $('.infobox').length > 0);
    console.log('Has aside.portable-infobox:', $('aside.portable-infobox').length > 0);
    console.log('Has .pi-item:', $('.pi-item').length);
    
    // Check for the specific image the user mentioned
    console.log('\n=== Checking for specific Fire Force image ===');
    const specificImage = $('img[src*="Shinra_Kusakabe_Joins_the_Force"]');
    console.log('Found specific image:', specificImage.length > 0);
    if (specificImage.length > 0) {
      console.log('Image src:', specificImage.attr('src'));
      console.log('Image data-src:', specificImage.attr('data-src'));
      console.log('Parent element:', specificImage.parent().get(0)?.name);
      console.log('Parent classes:', specificImage.parent().attr('class'));
    }
    
    // Look for any gallery or image containers
    console.log('\n=== Gallery/Image Containers ===');
    console.log('Has .gallery:', $('.gallery').length > 0);
    console.log('Has .image:', $('.image').length);
    console.log('Has .thumb:', $('.thumb').length);
    console.log('Has .pi-image-thumbnail:', $('.pi-image-thumbnail').length);
    
  } catch (error) {
    console.error('Error analyzing page:', error.message);
  }
}

// Test the function
analyzePageStructure(testChapterUrl);