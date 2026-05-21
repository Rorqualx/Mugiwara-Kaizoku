import { FandomService } from '../src/server/services/fandom/FandomService';
import { logger } from '../src/utils/logger';

async function testFireForceVolumes() {
  const service = new FandomService();
  
  console.log('Testing Fire Force volume extraction...\n');
  
  try {
    // Search for Fire Force
    console.log('Searching for Fire Force...\n');
    const searchResult = await service.searchManga('Fire Force');
    
    if (!searchResult || searchResult.length === 0) {
      console.log('❌ No search results found for Fire Force');
      return;
    }
    
    const fireForce = searchResult[0];
    console.log(`Found: ${fireForce.title}`);
    console.log(`URL: ${fireForce.url}\n`);
    
    // Get manga details including volumes
    console.log('Fetching manga details...\n');
    const mangaDetails = await service.getMangaDetails(fireForce.id!);
    
    console.log('Manga Details Summary:');
    console.log(`- Title: ${mangaDetails.title}`);
    console.log(`- Volumes found: ${mangaDetails.volumes?.length || 0}`);
    console.log(`- Chapters found: ${mangaDetails.chapters?.length || 0}`);
    
    if (mangaDetails.volumes && mangaDetails.volumes.length > 0) {
      console.log('\nVolume Details:');
      mangaDetails.volumes.forEach((vol: any) => {
        console.log(`\nVolume ${vol.number}:`);
        console.log(`  Title: ${vol.title}`);
        console.log(`  Cover Image: ${vol.coverImage || 'NOT FOUND'}`);
        console.log(`  Chapters: ${vol.chapters?.length || 0}`);
      });
      
      // Count volumes with cover images
      const volumesWithCovers = mangaDetails.volumes.filter((v: any) => v.coverImage).length;
      console.log(`\n✅ Volumes with cover images: ${volumesWithCovers}/${mangaDetails.volumes.length}`);
      
      // List volumes without covers
      const volumesWithoutCovers = mangaDetails.volumes.filter((v: any) => !v.coverImage);
      if (volumesWithoutCovers.length > 0) {
        console.log('\n⚠️ Volumes missing cover images:');
        volumesWithoutCovers.forEach((v: any) => {
          console.log(`  - Volume ${v.number}: ${v.title}`);
        });
      }
    } else {
      console.log('\n❌ No volumes found!');
    }
    
    // Check volume covers in the volumeCovers array
    if ((mangaDetails as any).volumeCovers) {
      console.log(`\n📚 Volume covers array: ${(mangaDetails as any).volumeCovers.length} covers`);
      (mangaDetails as any).volumeCovers.forEach((cover: string, index: number) => {
        console.log(`  Volume ${index + 1}: ${cover ? '✓' : '✗'}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing Fire Force volumes:', error);
  }
}

// Run the test
testFireForceVolumes().then(() => {
  console.log('\nTest complete!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});