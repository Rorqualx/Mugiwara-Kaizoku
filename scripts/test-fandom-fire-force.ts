import { FandomService } from '../src/server/services/fandom/FandomService';

async function testFireForceFandomScraping() {
  console.log('Testing Fire Force Fandom scraping...\n');

  // Initialize the Fire Force Fandom service
  const service = new FandomService('fire-force');

  try {
    // Search for Fire Force manga
    console.log('Searching for Fire Force manga...');
    const results = await service.search('Fire Force', {
      limit: 5,
      type: 'manga',
      includeDetails: true
    });

    if (results.length === 0) {
      console.log('No results found');
      return;
    }

    // Find the main Fire Force manga entry
    const fireForceResult = results.find(r =>
      r.title.toLowerCase().includes('fire force') &&
      r.type === 'manga'
    ) || results[0];

    console.log('\nFire Force Manga Details:');
    console.log('========================');
    console.log(`Title: ${fireForceResult.title}`);
    console.log(`URL: ${fireForceResult.url}`);

    if (fireForceResult.metadata) {
      console.log('\nMetadata:');
      console.log(`- Volumes: ${fireForceResult.metadata.volumes || 'N/A'}`);
      console.log(`- Chapters: ${fireForceResult.metadata.chapters || 'N/A'}`);
      console.log(`- Author: ${fireForceResult.metadata.author || 'N/A'}`);
      console.log(`- Status: ${fireForceResult.metadata.status || 'N/A'}`);
      console.log(`- Publisher: ${fireForceResult.metadata.publisher || 'N/A'}`);

      // Check if volume count is correct
      const expectedVolumes = 34;
      const actualVolumes = fireForceResult.metadata.volumes;

      console.log('\n✅ Volume Count Validation:');
      if (actualVolumes === expectedVolumes) {
        console.log(`✓ PASS: Volume count is correct (${actualVolumes} volumes)`);
      } else {
        console.log(`✗ FAIL: Volume count is incorrect. Expected ${expectedVolumes}, got ${actualVolumes}`);
      }

      // Check chapter count
      const expectedChapters = 305; // Including Chapter 0
      const actualChapters = fireForceResult.metadata.chapters;

      console.log('\n✅ Chapter Count Validation:');
      if (actualChapters === expectedChapters) {
        console.log(`✓ PASS: Chapter count is correct (${actualChapters} chapters)`);
      } else {
        console.log(`! INFO: Chapter count is ${actualChapters}, expected ${expectedChapters}`);
      }
    } else {
      console.log('\n⚠️ No metadata found');
    }

    // Now get the manga info directly
    console.log('\n\nFetching detailed manga info...');
    const mangaInfo = await service.getMangaInfo(fireForceResult.title);

    if (mangaInfo) {
      console.log('\nDetailed Manga Info:');
      console.log('===================');
      console.log(`Volumes: ${mangaInfo.volumes || 'N/A'}`);
      console.log(`Chapters: ${mangaInfo.chapters || 'N/A'}`);

      const detailedVolumes = typeof mangaInfo.volumes === 'string'
        ? parseInt(mangaInfo.volumes)
        : mangaInfo.volumes;

      if (detailedVolumes === 34) {
        console.log(`✓ PASS: Detailed volume count is correct (${detailedVolumes} volumes)`);
      } else {
        console.log(`✗ FAIL: Detailed volume count is incorrect. Expected 34, got ${detailedVolumes}`);
      }
    }

  } catch (error) {
    console.error('Error during test:', error);
  }

  process.exit(0);
}

// Run the test
testFireForceFandomScraping();