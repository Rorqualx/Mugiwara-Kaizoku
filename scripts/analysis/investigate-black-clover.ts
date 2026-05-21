import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateBlackClover() {
  console.log('🍀 Investigating Black Clover Wiki Structure\n');
  
  const response = await fetch('https://blackclover.fandom.com/wiki/List_of_Chapters_and_Volumes');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📄 Page Analysis:');
  console.log(`- Total tables: ${$('table').length}`);
  console.log(`- Lists (ul/ol): ${$('ul, ol').length}`);
  console.log(`- Gallery sections: ${$('.wikia-gallery, .gallery').length}`);
  console.log(`- H2 headers: ${$('h2').length}`);
  console.log(`- Wikia gallery items: ${$('.wikia-gallery-item').length}\n`);
  
  // Look for volume patterns
  console.log('📚 Volume Detection:');
  const volumeHeaders = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text);
  });
  console.log(`Found ${volumeHeaders.length} volume headers\n`);
  
  // Analyze gallery structure
  console.log('🖼️ Gallery Analysis:');
  const galleries = $('.wikia-gallery, .gallery');
  galleries.each((i, gallery) => {
    if (i >= 2) return; // Limit to first 2
    
    const $gallery = $(gallery);
    const items = $gallery.find('.wikia-gallery-item, .gallerybox');
    console.log(`\nGallery ${i + 1}:`);
    console.log(`  Items: ${items.length}`);
    
    // Check first item
    const firstItem = items.first();
    if (firstItem.length > 0) {
      const caption = firstItem.find('.lightbox-caption, .gallerytext').text().trim();
      console.log(`  First item caption: "${caption}"`);
      
      // Check if it contains volume info
      if (/Volume\s+\d+/i.test(caption)) {
        console.log('  ✓ Contains volume information');
      }
    }
  });
  
  // Look for lists with chapter info
  console.log('\n\n📝 List Analysis:');
  const volumeLists = $('ul, ol').filter((_, list) => {
    const text = $(list).text();
    return /Chapter\s+\d+/i.test(text) || /Volume\s+\d+/i.test(text);
  });
  
  console.log(`Found ${volumeLists.length} lists with volume/chapter info\n`);
  
  if (volumeLists.length > 0) {
    volumeLists.slice(0, 2).each((i, list) => {
      const $list = $(list);
      const items = $list.find('li');
      
      console.log(`\nList ${i + 1}:`);
      console.log(`  Items: ${items.length}`);
      
      // Check if it's under a volume header
      const prevHeader = $list.prevAll('h2, h3').first();
      if (prevHeader.length > 0) {
        console.log(`  Previous header: "${prevHeader.text().trim()}"`);
      }
      
      // Sample first few items
      console.log('  First 3 items:');
      items.slice(0, 3).each((j, item) => {
        const text = $(item).text().trim();
        console.log(`    ${j + 1}. "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
        
        // Check for chapter pattern
        const chapterMatch = text.match(/Chapter\s+(\d+)/i);
        if (chapterMatch) {
          console.log(`       → Chapter ${chapterMatch[1]} detected`);
        }
      });
    });
  }
  
  // Check table structure
  console.log('\n\n📊 Table Analysis:');
  $('table').each((i, table) => {
    if (i >= 2) return;
    
    const $table = $(table);
    const rows = $table.find('tr').length;
    const text = $table.text();
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Rows: ${rows}`);
    
    // Check headers
    const headers = $table.find('tr').first().find('th, td').map((_, el) => $(el).text().trim()).get();
    if (headers.length > 0) {
      console.log(`  Headers: ${headers.join(' | ')}`);
    }
    
    if (text.includes('Volume') || text.includes('Chapter')) {
      console.log('  ✓ Contains volume/chapter references');
    }
  });
  
  console.log('\n\n🎯 Pattern Summary:');
  console.log('Black Clover appears to use:');
  console.log('1. Gallery sections for volume covers');
  console.log('2. Lists (ul/ol) for chapter listings under each volume');
  console.log('3. Volume headers (h2/h3) followed by chapter lists');
  console.log('4. Gallery captions contain volume information');
  
  // Extract sample data
  console.log('\n📖 Sample Extraction:');
  
  // Try to extract from a specific volume section
  const volumeSection = volumeHeaders.first();
  if (volumeSection.length > 0) {
    const volumeTitle = volumeSection.text().trim();
    console.log(`\nVolume: "${volumeTitle}"`);
    
    // Look for the list after this header
    const chapterList = volumeSection.nextAll('ul, ol').first();
    if (chapterList.length > 0) {
      const chapters = chapterList.find('li');
      console.log(`Chapters found: ${chapters.length}`);
      
      chapters.slice(0, 3).each((i, chapter) => {
        const text = $(chapter).text().trim();
        console.log(`  - ${text}`);
      });
    }
  }
}

investigateBlackClover().catch(console.error);