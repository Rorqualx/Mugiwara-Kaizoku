#!/usr/bin/env npx tsx

import * as cheerio from 'cheerio';
import axios from 'axios';
import { extractBestImageUrl, getFullSizeImageUrl } from '../src/server/services/fandom/utils/imageUtils';

async function testEnhancedGalleryExtraction() {
  console.log('Testing enhanced gallery image extraction...\n');

  const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== EXTRACTING GALLERY IMAGES WITH ENHANCED METHOD ===\n');
    
    const galleryImages: any[] = [];
    
    $('.gallery, .wikia-gallery').each((i, gallery) => {
      const $gallery = $(gallery);
      const items = $gallery.find('.gallerybox, .wikia-gallery-item');
      
      console.log(`Gallery ${i + 1}: Found ${items.length} items`);
      
      items.each((j, item) => {
        const $item = $(item);
        const $img = $item.find('img');
        const $caption = $item.find('.gallerytext, .lightbox-caption');
        
        const captionText = $caption.text().trim();
        const alt = $img.attr('alt');
        
        // Use our enhanced extraction method
        const imgUrl = extractBestImageUrl($img);
        
        if (imgUrl) {
          galleryImages.push({
            url: imgUrl,
            caption: captionText,
            alt: alt,
            type: captionText.includes('Issue') ? 'magazine_cover' : 
                  captionText.includes('Volume') ? 'volume_cover' : 'gallery'
          });
          
          console.log(`  ✓ Image ${j + 1}:`);
          console.log(`    Caption: ${captionText}`);
          console.log(`    Alt: ${alt}`);
          console.log(`    Type: ${captionText.includes('Issue') ? 'magazine_cover' : captionText.includes('Volume') ? 'volume_cover' : 'gallery'}`);
          console.log(`    URL: ${imgUrl.substring(0, 100)}...`);
        } else {
          console.log(`  ✗ Image ${j + 1}: Failed to extract URL`);
          console.log(`    Caption: ${captionText}`);
          console.log(`    Alt: ${alt}`);
        }
      });
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total images extracted: ${galleryImages.length}`);
    
    const magazineCovers = galleryImages.filter(img => img.type === 'magazine_cover');
    const volumeCovers = galleryImages.filter(img => img.type === 'volume_cover');
    const otherGallery = galleryImages.filter(img => img.type === 'gallery');
    
    console.log(`Magazine covers: ${magazineCovers.length}`);
    console.log(`Volume covers: ${volumeCovers.length}`);
    console.log(`Other gallery images: ${otherGallery.length}`);
    
    // Check for the specific missing images
    const missingImageNames = [
      'Fire_Brigade_of_Flames_Cover_(Issue_52).png',
      'WSM_Issue_24.png',
      '2020.jpg',
      'WSM_Issue_No.13_(02,_2022).png',
      'Issue_29,_2017.jpg',
      'Issue_24,_2018.jpg',
      'Issue_31,_2019.jpg',
      'Issue_31,_2020.jpg',
      'Issue_13,_2020.jpg'
    ];
    
    console.log('\n=== CHECKING FOR SPECIFIC IMAGES ===');
    for (const imageName of missingImageNames) {
      const found = galleryImages.find(img => 
        img.url.includes(imageName.replace(/[()]/g, '%28')) ||
        img.alt?.includes(imageName.replace(/_/g, ' ').replace('.png', '').replace('.jpg', ''))
      );
      
      if (found) {
        console.log(`✓ ${imageName} - FOUND`);
      } else {
        console.log(`✗ ${imageName} - NOT FOUND`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testEnhancedGalleryExtraction();