#!/usr/bin/env npx tsx
/**
 * Test script to verify Fire Force search results from multiple providers
 * Shows how data is being collected and merged from different sources
 */
import { createCallerFactory } from '../src/server/trpc/index.js';
import { appRouter } from '../src/server/trpc/index.js';
import { db } from '../src/server/db/index.js';

async function testFireForceProviders() {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({
    db,
    session: null,
    headers: new Headers()
  });

  console.log('🔍 Testing Fire Force search across multiple providers...\n');

  try {
    // Search for Fire Force
    const searchResults = await caller.search.searchManga({
      query: 'Fire Force',
      providers: ['anilist', 'comicvine', 'wikipedia', 'fandom']
    });

    console.log(`✅ Found ${searchResults.totalResults} total results\n`);

    // Check each provider's results
    for (const [provider, results] of Object.entries(searchResults.resultsByProvider)) {
      console.log(`📚 ${provider.toUpperCase()} - ${results.length} results:`);
      
      if (results.length > 0) {
        const fireForceResult = results.find(r => 
          r.title?.toLowerCase().includes('fire force') || 
          r.alternativeTitles?.some(t => t.toLowerCase().includes('fire force'))
        );
        
        if (fireForceResult) {
          console.log(`  Title: ${fireForceResult.title}`);
          console.log(`  Genres: ${fireForceResult.genres?.join(', ') || 'None'}`);
          console.log(`  Tags: ${(fireForceResult as any).tags?.join(', ') || 'None'}`);
          console.log(`  Authors: ${fireForceResult.authors?.join(', ') || 'None'}`);
          console.log(`  Status: ${fireForceResult.status || 'Unknown'}`);
          
          // Check for provider-specific fields
          if ((fireForceResult as any).reception) {
            console.log(`  Reception: ${(fireForceResult as any).reception.substring(0, 100)}...`);
          }
          
          // Check metadata
          if (fireForceResult.metadata) {
            console.log(`  Has metadata: Yes`);
            const meta = fireForceResult.metadata as any;
            if (meta.reception) console.log(`  Metadata Reception: Found`);
            if (meta.genres) console.log(`  Metadata Genres: ${meta.genres.join(', ')}`);
          }
          
          // Check descriptions object for Fandom
          if ((fireForceResult as any).descriptions) {
            console.log(`  Has descriptions object: Yes`);
            const desc = (fireForceResult as any).descriptions;
            if (desc.reception) console.log(`  Descriptions Reception: Found`);
          }
        }
      }
      console.log('');
    }

    // Now test fetching metadata for a specific result
    if (searchResults.results.length > 0) {
      const fireForceMain = searchResults.results.find(r => 
        r.title?.toLowerCase().includes('fire force')
      );
      
      if (fireForceMain && fireForceMain.sourceId) {
        console.log('🔄 Testing metadata fetch for Fire Force...\n');
        
        const metadata = await caller.metadata.getMetadata({
          sourceId: fireForceMain.sourceId,
          source: fireForceMain.source
        });
        
        console.log('Metadata fetched:');
        console.log(`  Title: ${metadata.title}`);
        console.log(`  Genres: ${metadata.genres?.join(', ') || 'None'}`);
        console.log(`  Tags: ${(metadata as any).tags?.join(', ') || 'None'}`);
        console.log(`  Authors: ${metadata.authors?.join(', ') || 'None'}`);
        
        // Check for reception in various places
        const checkReception = (obj: any, path: string) => {
          if (obj?.reception) {
            console.log(`  Reception found at ${path}: ${obj.reception.substring(0, 100)}...`);
          }
        };
        
        checkReception(metadata, 'root');
        checkReception((metadata as any).descriptions, 'descriptions');
        checkReception((metadata as any).metadata, 'metadata');
        checkReception((metadata as any).providerSpecific, 'providerSpecific');
        checkReception((metadata as any).externalLinks?.fandomMetadata, 'externalLinks.fandomMetadata');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testFireForceProviders();