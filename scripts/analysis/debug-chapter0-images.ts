#!/usr/bin/env npx tsx
/**
 * Debug script to see all images on Chapter 0 page
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugChapter0Images() {
  const url = 'https://fire-force.fandom.com/wiki/Chapter_0';
  console.log(`Fetching: ${url}\n`);
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const $ = cheerio.load(response.data);
  
  // Check infobox images
  console.log('=== INFOBOX IMAGES ===');
  const infoboxSelectors = [
    '.portable-infobox .pi-image img',
    '.portable-infobox .pi-image-thumbnail img',
    '.pi-image img',
    '.infobox img'
  ];
  
  for (const selector of infoboxSelectors) {
    const imgs = $(selector);
    if (imgs.length > 0) {
      console.log(`\nFound ${imgs.length} image(s) with selector: ${selector}`);
      imgs.each((i, elem) => {
        const img = $(elem);
        console.log(`  Image ${i + 1}:`);
        console.log(`    src: ${img.attr('src')}`);
        console.log(`    data-src: ${img.attr('data-src')}`);
        console.log(`    alt: ${img.attr('alt')}`);
        console.log(`    data-image-name: ${img.attr('data-image-name')}`);
        console.log(`    data-image-key: ${img.attr('data-image-key')}`);
      });
    }
  }
  
  // Check for Chapter_0.png specifically
  console.log('\n=== SEARCHING FOR Chapter_0.png ===');
  $('img').each((i, elem) => {
    const img = $(elem);
    const src = img.attr('src') || '';
    const dataSrc = img.attr('data-src') || '';
    const alt = img.attr('alt') || '';
    
    if (src.includes('Chapter_0') || dataSrc.includes('Chapter_0') || alt.includes('Chapter 0')) {
      console.log(`Found Chapter 0 related image:`);
      console.log(`  src: ${src}`);
      console.log(`  data-src: ${dataSrc}`);
      console.log(`  alt: ${alt}`);
      console.log(`  Parent tag: ${img.parent().prop('tagName')}`);
      console.log(`  Parent class: ${img.parent().attr('class')}`);
    }
  });
  
  // Check gallery images
  console.log('\n=== GALLERY IMAGES ===');
  const gallerySelectors = [
    '.wikia-gallery-item img',
    '.gallery .thumb img',
    '#gallery-0 img'
  ];
  
  for (const selector of gallerySelectors) {
    const imgs = $(selector);
    if (imgs.length > 0) {
      console.log(`\nFound ${imgs.length} image(s) in gallery with selector: ${selector}`);
      imgs.slice(0, 3).each((i, elem) => {
        const img = $(elem);
        console.log(`  Image ${i + 1}:`);
        console.log(`    src: ${img.attr('src')?.substring(0, 100)}`);
        console.log(`    data-src: ${img.attr('data-src')?.substring(0, 100)}`);
      });
    }
  }
}

debugChapter0Images().catch(console.error);