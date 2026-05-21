import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugChainsawGallery() {
  console.log('🔍 Debugging Chainsaw Man Gallery Detection\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check galleries
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`Found ${galleries.length} galleries\n`);
  
  galleries.each((i, gallery) => {
    const $gallery = $(gallery);
    const items = $gallery.find('.wikia-gallery-item, .gallerybox');
    
    console.log(`Gallery ${i + 1}:`);
    console.log(`  Items: ${items.length}`);
    
    // Check first few items
    let volumeCount = 0;
    items.slice(0, 3).each((j, item) => {
      const caption = $(item).find('.lightbox-caption, .gallerytext').text();
      console.log(`  Item ${j + 1} caption: ${caption.trim()}`);
      
      if (/Volume\s+\d+/i.test(caption)) {
        volumeCount++;
      }
    });
    
    console.log(`  Items with "Volume": ${volumeCount}`);
  });
  
  // Test the gallery detection logic
  console.log('\n📋 Testing gallery detection logic:');
  
  let totalVolumeItems = 0;
  galleries.each((_, gallery) => {
    const items = $(gallery).find('.wikia-gallery-item, .gallerybox');
    items.each((_, item) => {
      const caption = $(item).find('.lightbox-caption, .gallerytext').text();
      if (/Volume\s+\d+/i.test(caption)) {
        totalVolumeItems++;
      }
    });
  });
  
  console.log(`Total gallery items with "Volume": ${totalVolumeItems}`);
  console.log(`Would detect as gallery-based: ${totalVolumeItems >= 3}`);
}

debugChainsawGallery().catch(console.error);