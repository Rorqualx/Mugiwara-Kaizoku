/**
 * Test script to verify Fire Force volume cover extraction is fixed
 */

import { WikiContentScraper } from '../src/server/services/fandom/dynamic/WikiContentScraper';
import { logger } from '../src/utils/logger';

async function testFireForceFix() {
  console.log('🔥 Testing Fire Force Volume Cover Fix\n');
  console.log('=' .repeat(60));
  
  const scraper = new WikiContentScraper();
  
  try {
    // Test Fire Force main page
    const fireForceUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    
    console.log('\n📚 Scraping Fire Force manga...');
    console.log(`URL: ${fireForceUrl}\n`);
    
    const result = await scraper.scrapeMangaWiki(fireForceUrl, {
      followLinks: false, // The enrichment should happen automatically for missing covers
      extractSummaries: false,
      cacheResults: true
    });
    
    if (result.success) {
      console.log('✅ Scraping successful!\n');
      
      // Summary
      console.log('📊 RESULTS SUMMARY:');
      console.log('=' .repeat(60));
      console.log(`Total Volumes: ${result.totalVolumes}`);
      console.log(`Total Chapters: ${result.totalChapters}`);
      console.log(`Volumes Page: ${result.volumesPageUrl || 'Not found'}`);
      
      // Volume cover analysis
      console.log('\n🎨 VOLUME COVER ANALYSIS:');
      console.log('-' .repeat(60));
      
      let volumesWithCovers = 0;
      let volumesWithoutCovers = 0;
      const missingCovers: number[] = [];
      
      result.volumes.forEach((volume) => {
        if (volume.coverImage) {
          volumesWithCovers++;
          console.log(`✅ Volume ${volume.number}: ${volume.title}`);
          console.log(`   Cover: ${volume.coverImage.substring(0, 80)}...`);
        } else {
          volumesWithoutCovers++;
          missingCovers.push(volume.number);
          console.log(`❌ Volume ${volume.number}: ${volume.title} - NO COVER`);
        }
      });
      
      // Final statistics
      console.log('\n' + '=' .repeat(60));
      console.log('📈 FINAL STATISTICS:');
      console.log('=' .repeat(60));
      console.log(`✅ Volumes with covers: ${volumesWithCovers}/${result.totalVolumes}`);
      console.log(`❌ Volumes without covers: ${volumesWithoutCovers}/${result.totalVolumes}`);
      
      if (volumesWithoutCovers > 0) {
        console.log(`\n⚠️ Missing covers for volumes: ${missingCovers.join(', ')}`);
      }
      
      // Success check
      const successRate = (volumesWithCovers / result.totalVolumes) * 100;
      console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);
      
      if (successRate >= 90) {
        console.log('🎉 FIX SUCCESSFUL! Most volume covers extracted!');
      } else if (successRate >= 50) {
        console.log('⚠️ PARTIAL SUCCESS: Some volume covers still missing');
      } else {
        console.log('❌ FIX INCOMPLETE: Many volume covers still missing');
      }
      
      // Sample chapter info
      if (result.chapters.length > 0) {
        console.log('\n📖 Sample Chapters (first 5):');
        result.chapters.slice(0, 5).forEach(chapter => {
          console.log(`  Chapter ${chapter.number}: ${chapter.title}`);
        });
      }
      
    } else {
      console.log('❌ Scraping failed!');
      if (result.errors && result.errors.length > 0) {
        console.log('Errors:', result.errors);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
testFireForceFix().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});