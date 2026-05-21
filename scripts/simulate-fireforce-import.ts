/**
 * Simulate the Fire Force import process through FANDOM
 * This will trace exactly what happens with volume art during the import
 */

import { FandomEnhancedService } from '../src/server/services/fandom/dynamic/FandomEnhancedService';
import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import { WikiContentScraper } from '../src/server/services/fandom/dynamic/WikiContentScraper';
import { logger } from '../src/utils/logger';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

async function simulateFireForceImport() {
  console.log('🔥 SIMULATING FIRE FORCE IMPORT THROUGH FANDOM\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Initialize the FANDOM service
    console.log('\n📚 Step 1: Initializing FANDOM service...');
    const fandomService = new FandomEnhancedService();
    
    // Step 2: Search for Fire Force
    console.log('\n🔍 Step 2: Searching for "Fire Force"...');
    const searchQuery = 'Fire Force';
    const searchUrl = `https://fire-force.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json() as any;
    
    if (searchData.query?.search?.length > 0) {
      console.log(`✅ Found ${searchData.query.search.length} results`);
      console.log(`   First result: ${searchData.query.search[0].title}`);
    }
    
    // Step 3: Get the main Fire Force page
    console.log('\n📖 Step 3: Fetching main Fire Force page...');
    const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    
    const pageResponse = await fetch(mainPageUrl);
    const pageHtml = await pageResponse.text();
    const $ = cheerio.load(pageHtml);
    
    console.log(`✅ Page loaded (${pageHtml.length} bytes)`);
    
    // Step 4: Look for volume information
    console.log('\n📦 Step 4: Searching for volume information...');
    
    // Check for volume tables
    const volumeTables = $('table').filter((_, table) => {
      const text = $(table).text();
      return text.includes('Volume') && (text.includes('ISBN') || text.includes('Release'));
    });
    
    console.log(`   Found ${volumeTables.length} volume tables`);
    
    // Check for volume links
    const volumeLinks = $('a[href*="/wiki/Volume_"]');
    console.log(`   Found ${volumeLinks.length} volume links`);
    
    // Step 5: Extract volume data
    console.log('\n🎨 Step 5: Extracting volume cover images...');
    const volumes: any[] = [];
    let volumesWithCovers = 0;
    let volumesWithoutCovers = 0;
    
    // Method 1: From volume tables
    volumeTables.each((index, table) => {
      const $table = $(table);
      const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
      
      if (volumeHeader.length) {
        const volumeText = volumeHeader.text().trim();
        const volumeMatch = volumeText.match(/Volume\s*(\d+)/i);
        
        if (volumeMatch) {
          const volumeNumber = parseInt(volumeMatch[1]);
          
          // Look for cover image in the table
          const coverImage = $table.find('img').first();
          let coverUrl = null;
          
          if (coverImage.length) {
            coverUrl = coverImage.attr('src') || coverImage.attr('data-src');
            if (coverUrl && coverUrl.startsWith('//')) {
              coverUrl = 'https:' + coverUrl;
            }
          }
          
          volumes.push({
            number: volumeNumber,
            title: volumeText,
            coverUrl: coverUrl,
            source: 'table'
          });
          
          if (coverUrl) {
            volumesWithCovers++;
            console.log(`   ✅ Volume ${volumeNumber}: Found cover in table`);
          } else {
            volumesWithoutCovers++;
            console.log(`   ❌ Volume ${volumeNumber}: No cover in table`);
          }
        }
      }
    });
    
    // Method 2: Check galleries
    console.log('\n🖼️ Step 6: Checking galleries for volume covers...');
    const galleries = $('.gallery, .wikia-gallery');
    console.log(`   Found ${galleries.length} galleries`);
    
    galleries.each((_, gallery) => {
      const $gallery = $(gallery);
      const items = $gallery.find('.gallerybox, .wikia-gallery-item');
      
      items.each((_, item) => {
        const $item = $(item);
        const caption = $item.find('.gallerytext, .lightbox-caption').text();
        const volumeMatch = caption.match(/Volume\s*(\d+)/i);
        
        if (volumeMatch) {
          const volumeNumber = parseInt(volumeMatch[1]);
          const existingVolume = volumes.find(v => v.number === volumeNumber);
          
          if (!existingVolume || !existingVolume.coverUrl) {
            const img = $item.find('img').first();
            let coverUrl = img.attr('src') || img.attr('data-src');
            
            if (coverUrl && coverUrl.startsWith('//')) {
              coverUrl = 'https:' + coverUrl;
            }
            
            if (coverUrl) {
              console.log(`   ✅ Volume ${volumeNumber}: Found cover in gallery`);
              if (existingVolume) {
                existingVolume.coverUrl = coverUrl;
                existingVolume.source = 'gallery';
              }
            }
          }
        }
      });
    });
    
    // Step 7: Check if we need to fetch individual volume pages
    console.log('\n🔗 Step 7: Checking individual volume pages...');
    const volumesNeedingCovers = volumes.filter(v => !v.coverUrl);
    
    if (volumesNeedingCovers.length > 0) {
      console.log(`   Need to fetch ${volumesNeedingCovers.length} individual volume pages`);
      
      // Get first few volume page links as examples
      const volumePageLinks = $('a[href*="/wiki/Volume_"]').slice(0, 3);
      
      for (let i = 0; i < volumePageLinks.length && i < 3; i++) {
        const link = volumePageLinks.eq(i);
        const href = link.attr('href');
        if (href) {
          const fullUrl = `https://fire-force.fandom.com${href}`;
          console.log(`\n   Fetching: ${fullUrl}`);
          
          try {
            const volResponse = await fetch(fullUrl);
            const volHtml = await volResponse.text();
            const $vol = cheerio.load(volHtml);
            
            // Look for cover image on volume page
            const infoboxImg = $vol('.infobox img, .portable-infobox img').first();
            const coverImg = infoboxImg.length ? infoboxImg : $vol('img[alt*="Volume"], img[alt*="Cover"]').first();
            
            if (coverImg.length) {
              let coverUrl = coverImg.attr('src') || coverImg.attr('data-src');
              if (coverUrl && coverUrl.startsWith('//')) {
                coverUrl = 'https:' + coverUrl;
              }
              console.log(`   ✅ Found cover image: ${coverUrl?.substring(0, 50)}...`);
            } else {
              console.log(`   ❌ No cover image found on volume page`);
            }
          } catch (error) {
            console.log(`   ⚠️ Error fetching volume page: ${error}`);
          }
        }
      }
    }
    
    // Step 8: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 IMPORT SIMULATION SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`\n✅ Total volumes found: ${volumes.length}`);
    console.log(`📚 Volumes with covers: ${volumesWithCovers}`);
    console.log(`❌ Volumes without covers: ${volumesWithoutCovers}`);
    
    console.log('\n🔍 DIAGNOSIS:');
    if (volumesWithoutCovers > 0) {
      console.log('The issue is that volume cover images are not directly embedded in the main page.');
      console.log('They are likely:');
      console.log('1. On individual volume pages (need to follow links)');
      console.log('2. Using lazy-loaded images (need to check data-src)');
      console.log('3. In a different structure than expected');
      console.log('\nSOLUTION: The parser needs to follow volume page links to get all covers.');
    } else {
      console.log('All volumes have covers - the extraction is working correctly!');
    }
    
    // Show what chapters look like for comparison
    console.log('\n📖 Chapter extraction (for comparison):');
    const chapterLinks = $('a[href*="/wiki/Chapter_"]').slice(0, 5);
    console.log(`   Found ${$('a[href*="/wiki/Chapter_"]').length} chapter links`);
    console.log('   Chapters are directly linked on the main page, which is why they work!');
    
  } catch (error) {
    console.error('\n❌ Error during simulation:', error);
  }
}

// Run the simulation
simulateFireForceImport().then(() => {
  console.log('\n✅ Simulation complete!');
  process.exit(0);
}).catch(error => {
  console.error('Simulation failed:', error);
  process.exit(1);
});