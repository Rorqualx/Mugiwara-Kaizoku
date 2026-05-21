import { FandomProvider } from '../src/server/services/search/providers/FandomProvider.js';

const provider = new FandomProvider();

// Search for Fire Force
provider.search('Fire Force', {
  limit: 1,
  offset: 0
}).then(result => {
  if (result.success && result.data.results.length > 0) {
    const fireForce = result.data.results[0];
    console.log('\n=== Fire Force Search Result from FandomProvider ===\n');
    console.log('Title:', fireForce.title);
    console.log('Has coverImage:', Boolean(fireForce.coverImage));
    console.log('CoverImage URL:', fireForce.coverImage || 'none');
    console.log('Has gallery:', Boolean(fireForce.gallery));
    console.log('Gallery length:', fireForce.gallery?.length || 0);

    if (fireForce.gallery && fireForce.gallery.length > 0) {
      console.log('\nFirst 3 gallery images:');
      fireForce.gallery.slice(0, 3).forEach((img: string, i: number) => {
        console.log(`  ${i+1}. ${img}`);
      });
    }

    console.log('\nMetadata:');
    console.log('Has metadata.gallery:', Boolean((fireForce.metadata as any)?.gallery));
    console.log('Metadata gallery length:', (fireForce.metadata as any)?.gallery?.length || 0);

    console.log('\n=== Summary ===');
    console.log(`✅ Cover Image: ${fireForce.coverImage ? 'YES' : 'NO'}`);
    console.log(`✅ Gallery: ${fireForce.gallery && fireForce.gallery.length > 0 ? `YES (${fireForce.gallery.length} images)` : 'NO'}`);
    
    process.exit(0);
  } else {
    console.log('No results found');
    process.exit(1);
  }
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
