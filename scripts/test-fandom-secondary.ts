#!/usr/bin/env npx tsx

/**
 * Test script to verify Fandom works correctly as a secondary source
 */

import { SourceManagementService } from '../src/components/addManga/services/sourceManagementService';

// Mock mutations similar to what UniversalImportWizard provides
const mockMutations = {
  parseFandomUrlMutation: {
    mutateAsync: async ({ url }: { url: string; followLinks: boolean; extractSummaries: boolean; maxDepth: number }) => {
      console.log('📝 Mock parseFandomUrlMutation called with URL:', url);

      // Simulate the actual mutation response structure
      // This mimics what parseFandomUrl returns in metadata.ts
      // The response must match the AsyncResult type with status: 'success'
      return {
        status: 'success',
        data: {
          volumes: 34,
          chapters: 305,
          volumeDetails: [
            {
              volumeNumber: 1,
              title: 'Volume 1',
              chapterCount: 9,
              chapters: [
                { chapterNumber: '0', title: 'Shinra Kusakabe Joins the Force' },
                { chapterNumber: '1', title: 'The Heart of a Fire Soldier' },
                { chapterNumber: '2', title: 'The Devil, The Knight, and The Witch' },
                { chapterNumber: '3', title: 'The Rookie Fire Soldier Games' },
                { chapterNumber: '4', title: 'The Hero and The Princess' },
                { chapterNumber: '5', title: 'The Battle Begins' },
                { chapterNumber: '6', title: 'The Princess\' Trap' },
                { chapterNumber: '7', title: 'The Investigation of Company 1 Begins' },
                { chapterNumber: '8', title: 'Infernal Insects' }
              ]
            },
            {
              volumeNumber: 2,
              title: 'Volume 2',
              chapterCount: 8,
              chapters: [
                { chapterNumber: '9', title: 'The King of Destruction Descends' },
                { chapterNumber: '10', title: 'An Infernal Among Us' },
                { chapterNumber: '11', title: 'Formation of Special Fire Force Company 8 / The Motive' },
                { chapterNumber: '12', title: 'Eve of Hostilities' },
                { chapterNumber: '13', title: 'The Trap is Set' },
                { chapterNumber: '14', title: 'For Whom the Flames Burn' },
                { chapterNumber: '15', title: 'The Blacksmith\'s Dream' },
                { chapterNumber: '16', title: 'The Flame of Madness' }
              ]
            }
            // ... more volumes would be here
          ]
        }
      };
    }
  },
  fetchFandomMutation: {
    mutateAsync: async () => {
      // This is the fallback that should not be called when parseFandomUrlMutation is available
      throw new Error('fetchFandomMutation should not be called when parseFandomUrlMutation is available');
    }
  }
};

async function testFandomAsSecondarySource() {
  console.log('='.repeat(80));
  console.log('TESTING FANDOM AS SECONDARY SOURCE');
  console.log('='.repeat(80));

  const service = new SourceManagementService(mockMutations as any);

  // Simulate a search result like what would come from Fandom when selected as secondary
  const fandomResult = {
    id: 'fire-force-manga',
    title: 'Fire Force',
    url: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
    wikiUrl: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
    coverImage: 'https://example.com/cover.jpg',
    description: 'A manga about firefighters with supernatural abilities',
    authors: ['Atsushi Ōkubo'],
    provider: 'fandom',
    // This simulates what Fandom returns - no volumeData initially
    volumes: 0,
    chapters: 0
  };

  console.log('\n📊 Input Result Object:');
  console.log('  URL:', fandomResult.url);
  console.log('  Initial volumes:', fandomResult.volumes);
  console.log('  Initial chapters:', fandomResult.chapters);

  try {
    console.log('\n🔄 Calling fetchFandomMetadata (as secondary source)...');
    const metadata = await service.fetchFandomMetadata(fandomResult);

    console.log('\n✅ Metadata Retrieved:');
    console.log('  Volumes:', metadata.volumes);
    console.log('  Chapters:', metadata.chapters);
    console.log('  Volume Data Length:', metadata.volumeData?.length || 0);

    if (metadata.volumeData && metadata.volumeData.length > 0) {
      console.log('\n📚 Sample Volume Data:');
      const firstVolume = metadata.volumeData[0];
      console.log('  Volume 1:');
      console.log('    Title:', firstVolume.title);
      console.log('    Chapter Count:', firstVolume.chapterCount || firstVolume.chapters?.length);

      if (firstVolume.chapters && firstVolume.chapters.length > 0) {
        console.log('    First Chapter:', firstVolume.chapters[0]);
      }
    }

    // Verify the fix worked
    if (metadata.volumes === 34 && metadata.chapters === 305 && metadata.volumeData.length > 0) {
      console.log('\n🎉 SUCCESS! Fandom as secondary source now returns complete volume data!');
      console.log('✅ Volumes: 34 (correct)');
      console.log('✅ Chapters: 305 (correct)');
      console.log('✅ Volume details: Present');
    } else {
      console.log('\n❌ ISSUE DETECTED:');
      if (metadata.volumes !== 34) console.log('  - Expected 34 volumes, got', metadata.volumes);
      if (metadata.chapters !== 305) console.log('  - Expected 305 chapters, got', metadata.chapters);
      if (!metadata.volumeData || metadata.volumeData.length === 0) {
        console.log('  - Volume data is missing or empty');
      }
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testFandomAsSecondarySource().catch(console.error);