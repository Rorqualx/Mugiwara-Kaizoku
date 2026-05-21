#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testGalleryScraping() {
  console.log('Testing Fire Force gallery image scraping...\n');

  // URLs you mentioned that aren't being picked up
  const missingImages = [
    'https://fire-force.fandom.com/wiki/File:Fire_Brigade_of_Flames_Cover_(Issue_52).png',
    'https://fire-force.fandom.com/wiki/File:WSM_Issue_24.png',
    'https://fire-force.fandom.com/wiki/File:2020.jpg',
    'https://fire-force.fandom.com/wiki/File:WSM_Issue_No.13_(02,_2022).png',
    'https://fire-force.fandom.com/wiki/File:Issue_29,_2017.jpg',
    'https://fire-force.fandom.com/wiki/File:Issue_24,_2018.jpg',
    'https://fire-force.fandom.com/wiki/File:Issue_31,_2019.jpg',
    'https://fire-force.fandom.com/wiki/File:Issue_31,_2020.jpg',
    'https://fire-force.fandom.com/wiki/File:Issue_13,_2020.jpg'
  ];

  // Main Fire Force manga page
  const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';

  try {
    console.log('Fetching main page:', mainPageUrl);
    const response = await axios.get(mainPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('\n=== SEARCHING FOR GALLERY SECTIONS ===');
    
    // Check for gallery sections
    const galleries = $('.gallery, .wikia-gallery');
    console.log(`Found ${galleries.length} gallery sections`);
    
    // Check for tabber sections (Fire Force uses tabs)
    const tabbers = $('.wds-tabber, .tabber, .tabberlive');
    console.log(`Found ${tabbers.length} tabber sections`);
    
    // Check for tab contents
    const tabContents = $('.wds-tab__content, .tabbertab');
    console.log(`Found ${tabContents.length} tab content sections`);

    console.log('\n=== CHECKING FOR SPECIFIC IMAGES ===');
    
    // Search for the specific image file names in various ways
    for (const imageUrl of missingImages) {
      const fileName = imageUrl.split('/').pop()?.replace(/File:/, '');
      console.log(`\nSearching for: ${fileName}`);
      
      // Check if image exists in any img tags
      const imgTags = $(`img[alt*="${fileName}"], img[data-image-name*="${fileName}"]`);
      if (imgTags.length > 0) {
        console.log(`  ✓ Found in img tag`);
        imgTags.each((i, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          console.log(`    src: ${src}`);
        });
      }
      
      // Check if linked in any anchor tags
      const links = $(`a[href*="${fileName}"]`);
      if (links.length > 0) {
        console.log(`  ✓ Found in anchor tag`);
        links.each((i, el) => {
          console.log(`    href: ${$(el).attr('href')}`);
          console.log(`    text: ${$(el).text().trim()}`);
        });
      }
      
      // Check if mentioned anywhere in the HTML
      const htmlContent = response.data;
      if (htmlContent.includes(fileName!)) {
        console.log(`  ✓ Found in HTML content`);
        
        // Find context
        const index = htmlContent.indexOf(fileName!);
        const context = htmlContent.substring(Math.max(0, index - 100), Math.min(htmlContent.length, index + 100));
        console.log(`    Context: ...${context.replace(/\n/g, ' ')}...`);
      } else {
        console.log(`  ✗ Not found in HTML`);
      }
    }

    console.log('\n=== ANALYZING GALLERY STRUCTURE ===');
    
    // Look for all images in gallery containers
    $('.gallery, .wikia-gallery').each((i, gallery) => {
      const $gallery = $(gallery);
      console.log(`\nGallery ${i + 1}:`);
      
      // Find all images in this gallery
      const images = $gallery.find('img');
      console.log(`  Contains ${images.length} images`);
      
      images.each((j, img) => {
        const $img = $(img);
        const alt = $img.attr('alt');
        const src = $img.attr('src') || $img.attr('data-src');
        if (j < 3) { // Show first 3 for brevity
          console.log(`    Image ${j + 1}: alt="${alt}", src="${src?.substring(0, 50)}..."`);
        }
      });
    });

    console.log('\n=== CHECKING TAB-SPECIFIC CONTENT ===');
    
    // Check each tab for images
    $('.wds-tab__content, .tabbertab').each((i, tab) => {
      const $tab = $(tab);
      const tabTitle = $tab.attr('title') || $tab.prev('.wds-tabs__tab').text() || `Tab ${i + 1}`;
      const images = $tab.find('img');
      
      if (images.length > 0) {
        console.log(`\n${tabTitle}: ${images.length} images`);
        images.slice(0, 3).each((j, img) => {
          const $img = $(img);
          const alt = $img.attr('alt');
          console.log(`  - ${alt || 'No alt text'}`);
        });
      }
    });

    console.log('\n=== CHECKING FOR MAGAZINE COVERS SECTION ===');
    
    // Look for sections that might contain magazine covers
    const headings = $('h2, h3').filter((i, el) => {
      const text = $(el).text();
      return text.includes('Magazine') || text.includes('Cover') || text.includes('Issue');
    });
    
    console.log(`Found ${headings.length} relevant section headings`);
    headings.each((i, heading) => {
      console.log(`  - ${$(heading).text()}`);
    });

  } catch (error) {
    console.error('Error fetching page:', error);
  }
}

testGalleryScraping();