import { appRouter } from '../src/server/trpc/routers/_app.js';
import { createInnerTRPCContext } from '../src/server/trpc/trpc.js';

async function testCompleteFandomFlow() {
  console.log('Testing complete Fandom flow with gallery extraction...\n');

  // Create TRPC context
  const ctx = createInnerTRPCContext({
    session: null,
    req: {} as any,
    res: {} as any
  });

  // Create the TRPC caller
  const caller = appRouter.createCaller(ctx);

  try {
    // Test the parseFandomUrl mutation
    const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    console.log(`Calling parseFandomUrl for: ${url}\n`);

    const result = await caller.metadata.parseFandomUrl({
      url,
      forceRefresh: false,
      fetchChapterCovers: true,
      maxChaptersToFetch: 5
    });

    if (result.success && result.data) {
      console.log('✅ Successfully parsed Fandom URL!\n');

      console.log('Basic Info:');
      console.log('  Title:', result.data.title);
      console.log('  Author:', result.data.author);
      console.log('  Status:', result.data.status);
      console.log('  Volumes:', result.data.volumes);
      console.log('  Chapters:', result.data.chapters);
      console.log('  volumesListUrl:', result.data.volumesListUrl);

      console.log('\nVolume Data:');
      console.log('  volumeData length:', result.data.volumeData?.length || 0);
      if (result.data.volumeData && result.data.volumeData.length > 0) {
        console.log('  First 3 volumes:');
        result.data.volumeData.slice(0, 3).forEach((vol: any, i: number) => {
          console.log(`    Volume ${vol.volumeNumber || vol.number || i + 1}: ${vol.title}`);
          console.log(`      Chapters: ${vol.chapters?.length || 0}`);
          console.log(`      Cover: ${vol.coverUrl || vol.coverImage || 'none'}`);
        });
      }

      console.log('\nGallery Images:');
      console.log('  Total gallery images:', result.data.gallery?.length || 0);
      if (result.data.gallery && result.data.gallery.length > 0) {
        console.log('  First 5 gallery images:');
        result.data.gallery.slice(0, 5).forEach((img: string, i: number) => {
          // Extract just the filename for cleaner display
          const filename = img.split('/').pop()?.split('?')[0] || img;
          console.log(`    ${i + 1}. ${filename}`);
        });

        // Check for specific images
        const targetImages = ['Fire_Force_Volumes.png', 'Fire_Brigade_of_Flames_Cover', 'Issue_13,_2020.jpg'];
        console.log('\n  Looking for specific images:');
        targetImages.forEach(target => {
          const found = result.data.gallery.some((img: string) =>
            img.includes(target.replace(',', ''))
          );
          console.log(`    ${found ? '✓' : '✗'} ${target}`);
        });

        // Count Fire Force specific images
        const fireForceImages = result.data.gallery.filter((img: string) =>
          img.includes('Fire_Force') ||
          img.includes('Fire_Brigade') ||
          img.includes('Issue') ||
          img.includes('Volume')
        );
        console.log(`\n  Fire Force specific images: ${fireForceImages.length}/${result.data.gallery.length}`);
      }

      // Test FandomService directly for comparison
      console.log('\n\nTesting FandomService directly for comparison:');
      const { FandomService } = await import('../src/server/services/fandom/FandomService.js');
      const service = new FandomService('fire-force');
      const metadata = await service.getPageMetadata('Fire Force (manga)');

      if (metadata) {
        console.log('FandomService gallery images:', metadata.gallery?.length || 0);
        if (metadata.gallery && metadata.gallery.length > 0) {
          console.log('First 3 FandomService gallery images:');
          metadata.gallery.slice(0, 3).forEach((img, i) => {
            const filename = img.split('/').pop()?.split('?')[0] || img;
            console.log(`  ${i + 1}. ${filename}`);
          });
        }
      }

    } else {
      console.error('❌ Failed to parse Fandom URL:', result.error);
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

testCompleteFandomFlow().catch(console.error);