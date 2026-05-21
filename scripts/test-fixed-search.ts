#!/usr/bin/env npx tsx
import { createCallerFactory } from '../src/server/trpc/index';
import { appRouter } from '../src/server/trpc/index';
import { db } from '../src/server/db/index';

async function testFireForceSearch() {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({
    db,
    session: null,
    headers: new Headers()
  });

  console.log('🔍 Testing Fire Force search with fixed providers...\n');

  try {
    // Search for Fire Force
    const searchResults = await caller.search.searchManga({
      query: 'Fire Force',
      providers: ['anilist', 'comicvine', 'wikipedia', 'fandom']
    });

    console.log(`✅ Found ${searchResults.totalResults} total results\n`);

    // Check AniList specifically 
    const anilistResults = searchResults.resultsByProvider.anilist || [];
    if (anilistResults.length > 0) {
      const fireForce = anilistResults.find(r => 
        r.title?.toLowerCase().includes('fire force')
      );
      
      if (fireForce) {
        console.log('📚 ANILIST Fire Force:');
        console.log(`  Title: ${fireForce.title}`);
        console.log(`  Tags: ${(fireForce as any).tags?.length || 0} tags`);
        if ((fireForce as any).tags?.length > 0) {
          console.log(`  Sample tags: ${(fireForce as any).tags.slice(0, 5).join(', ')}`);
        }
        
        // Now fetch metadata for AniList to test secondary fetch
        if (fireForce.sourceId) {
          console.log('\n🔄 Fetching AniList metadata as secondary source...');
          const metadata = await caller.metadata.fetchAnilistMetadata({
            url: fireForce.sourceId
          });
          
          if (metadata.status === 'success' && metadata.data) {
            console.log('  Tags in metadata:', metadata.data.tags?.length || 0);
            if (metadata.data.tags?.length > 0) {
              console.log('  Sample tags:', metadata.data.tags.slice(0, 5).join(', '));
            }
          }
        }
      }
    }

    // Check Fandom
    const fandomResults = searchResults.resultsByProvider.fandom || [];
    if (fandomResults.length > 0) {
      const fireForce = fandomResults.find(r => 
        r.title?.toLowerCase().includes('fire force')
      );
      
      if (fireForce) {
        console.log('\n📚 FANDOM Fire Force:');
        console.log(`  Title: ${fireForce.title}`);
        console.log(`  Metadata keys:`, Object.keys((fireForce as any).metadata || {}));
        console.log(`  Has reception:`, !!(fireForce as any).metadata?.reception);
        
        if ((fireForce as any).metadata?.reception) {
          console.log(`  Reception preview: ${(fireForce as any).metadata.reception.substring(0, 100)}...`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testFireForceSearch();
