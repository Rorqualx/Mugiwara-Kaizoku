#!/usr/bin/env tsx

/**
 * Test script to verify AniList volume generation in UniversalImportWizard
 * This simulates the data flow when AniList provides only volume/chapter counts
 */

import { logger } from '../src/utils/logger';

// Simulate AniList metadata structure
const simulateAniListMetadata = () => {
  return {
    provider: 'anilist',
    source: 'anilist',
    metadata: {
      volumes: 34,  // Fire Force has 34 volumes
      chapters: 305, // Fire Force has 305 chapters
      averageScore: 78,
      popularity: 58844,
      // Other metadata fields...
    }
  };
};

// Simulate the volume generation logic from UniversalImportWizard
const generatePlaceholderVolumes = (volumeCount: number, chapterCount: number) => {
  logger.info('📚 [ANILIST] Creating placeholder volumes from metadata counts:', {
    volumeCount,
    chapterCount
  });
  
  const placeholderVolumes: any[] = [];
  const chaptersPerVolume = chapterCount ? Math.ceil(chapterCount / volumeCount) : 10;
  
  for (let i = 1; i <= volumeCount; i++) {
    const volumeChapters: any[] = [];
    const startChapter = (i - 1) * chaptersPerVolume + 1;
    const endChapter = Math.min(i * chaptersPerVolume, chapterCount || startChapter + chaptersPerVolume - 1);
    
    for (let j = startChapter; j <= endChapter; j++) {
      volumeChapters.push({
        number: j,
        title: `Chapter ${j}`,
        volume: i
      });
    }
    
    placeholderVolumes.push({
      volumeNumber: i,
      title: `Volume ${i}`,
      chapterCount: volumeChapters.length,
      chapters: volumeChapters
    });
  }
  
  return placeholderVolumes;
};

// Run the test
const testVolumeGeneration = () => {
  logger.info('=== Testing AniList Volume Generation ===\n');
  
  // Simulate receiving AniList data
  const anilistData = simulateAniListMetadata();
  logger.info('1. Simulated AniList data:', anilistData);
  
  // Check if we need to generate volumes
  const volumeCount = anilistData.metadata.volumes;
  const chapterCount = anilistData.metadata.chapters;
  
  if (volumeCount && !false) { // Simulating !volumesData.volumes?.length
    logger.info('\n2. Volume generation needed - only counts available');
    
    // Generate placeholder volumes
    const generatedVolumes = generatePlaceholderVolumes(volumeCount, chapterCount);
    
    logger.info(`\n3. Generated ${generatedVolumes.length} volumes`);
    
    // Display first and last volume details
    logger.info('\nFirst volume:', {
      volumeNumber: generatedVolumes[0].volumeNumber,
      title: generatedVolumes[0].title,
      chapterCount: generatedVolumes[0].chapterCount,
      firstChapter: generatedVolumes[0].chapters[0].number,
      lastChapter: generatedVolumes[0].chapters[generatedVolumes[0].chapters.length - 1].number
    });
    
    logger.info('\nLast volume:', {
      volumeNumber: generatedVolumes[generatedVolumes.length - 1].volumeNumber,
      title: generatedVolumes[generatedVolumes.length - 1].title,
      chapterCount: generatedVolumes[generatedVolumes.length - 1].chapterCount,
      firstChapter: generatedVolumes[generatedVolumes.length - 1].chapters[0].number,
      lastChapter: generatedVolumes[generatedVolumes.length - 1].chapters[generatedVolumes[generatedVolumes.length - 1].chapters.length - 1].number
    });
    
    // Verify total chapters
    const totalChapters = generatedVolumes.reduce((sum, vol) => sum + vol.chapterCount, 0);
    logger.info(`\n4. Verification:
   - Expected chapters: ${chapterCount}
   - Generated chapters: ${totalChapters}
   - Match: ${totalChapters === chapterCount ? '✅' : '❌'}`);
    
    logger.info('\n5. This data structure can now be used in the Volume table UI');
    
    return generatedVolumes;
  }
  
  logger.info('\n✅ Volume generation test completed successfully!');
};

// Run the test
testVolumeGeneration();