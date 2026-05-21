#!/usr/bin/env ts-node

/**
 * Verify accuracy of Wikipedia data extraction
 */

import { wikipediaService } from '../src/server/services/wikipedia/WikipediaService.js';

interface VerificationData {
  series: string;
  expectedVolumes?: number;
  expectedChapters?: number;
  expectedGenres?: string[];
  notes?: string;
}

// Known accurate data from official sources
const knownData: VerificationData[] = [
  {
    series: 'Attack on Titan',
    expectedVolumes: 34, // Main series completed with 34 volumes
    expectedChapters: 141, // 139 main + 2 special chapters
    expectedGenres: ['Dark fantasy', 'Post-apocalyptic'],
    notes: 'Completed series'
  },
  {
    series: 'My Hero Academia',
    expectedVolumes: 42, // As of 2024
    expectedChapters: 430, // Approximately (ongoing)
    expectedGenres: ['Superhero', 'School', 'Adventure'],
    notes: 'Ongoing series'
  },
  {
    series: 'Demon Slayer: Kimetsu no Yaiba',
    expectedVolumes: 23,
    expectedChapters: 207, // 205 main + 2 special
    expectedGenres: ['Dark fantasy', 'Martial arts', 'Historical'],
    notes: 'Completed series'
  },
  {
    series: 'Jujutsu Kaisen',
    expectedVolumes: 28, // As of late 2024
    expectedChapters: 271, // Completed in September 2024
    expectedGenres: ['Dark fantasy', 'Supernatural', 'School'],
    notes: 'Recently completed'
  },
  {
    series: 'Hunter × Hunter',
    expectedVolumes: 38,
    expectedChapters: 410, // On hiatus
    expectedGenres: ['Adventure', 'Fantasy', 'Martial arts'],
    notes: 'On hiatus'
  },
  {
    series: 'Fullmetal Alchemist',
    expectedVolumes: 27,
    expectedChapters: 108, // Plus bonus chapter
    expectedGenres: ['Adventure', 'Dark fantasy', 'Steampunk'],
    notes: 'Completed series'
  },
  {
    series: 'The Promised Neverland',
    expectedVolumes: 20,
    expectedChapters: 181,
    expectedGenres: ['Dark fantasy', 'Science fiction', 'Thriller'],
    notes: 'Completed series'
  },
  {
    series: 'Tokyo Ghoul',
    expectedVolumes: 14, // Original series only
    expectedChapters: 143, // Original series
    expectedGenres: ['Dark fantasy', 'Supernatural', 'Thriller'],
    notes: 'First series only (not including :re)'
  },
  {
    series: 'Berserk',
    expectedVolumes: 42,
    expectedChapters: 377, // As of latest release
    expectedGenres: ['Dark fantasy', 'Sword and sorcery', 'Epic fantasy'],
    notes: 'Continuing after author\'s passing'
  },
  {
    series: 'One Piece',
    expectedVolumes: 110, // As of late 2024
    expectedChapters: 1132, // As of late 2024
    expectedGenres: ['Adventure', 'Fantasy', 'Comedy'],
    notes: 'Ongoing, longest running'
  }
];

async function verifySeriesData(verification: VerificationData): Promise<void> {
  console.log(`\n📊 Verifying: ${verification.series}`);
  console.log('─'.repeat(50));
  
  const data = await wikipediaService.findBestMatch(verification.series);
  
  if (!data) {
    console.log('  ❌ No data found');
    return;
  }
  
  console.log(`  📖 Retrieved: ${data.title}`);
  
  // Verify volumes
  if (verification.expectedVolumes) {
    const volumeAccuracy = calculateAccuracy(data.volumes || 0, verification.expectedVolumes);
    const volumeStatus = getAccuracyStatus(volumeAccuracy);
    console.log(`  📚 Volumes: ${data.volumes || 'N/A'} (Expected: ${verification.expectedVolumes}) ${volumeStatus}`);
    
    if (volumeAccuracy < 90) {
      console.log(`     ⚠️  Large discrepancy: ${Math.abs((data.volumes || 0) - verification.expectedVolumes)} volumes difference`);
    }
  }
  
  // Verify chapters
  const actualChapters = data.chapters || data.chapterList?.length || 0;
  if (verification.expectedChapters) {
    const chapterAccuracy = calculateAccuracy(actualChapters, verification.expectedChapters);
    const chapterStatus = getAccuracyStatus(chapterAccuracy);
    console.log(`  📝 Chapters: ${actualChapters} (Expected: ${verification.expectedChapters}) ${chapterStatus}`);
    
    if (chapterAccuracy < 90) {
      console.log(`     ⚠️  Large discrepancy: ${Math.abs(actualChapters - verification.expectedChapters)} chapters difference`);
    }
  }
  
  // Check chapter quality
  if (data.chapterList && data.chapterList.length > 0) {
    const sampleChapters = data.chapterList.slice(0, 5);
    const invalidTitles = sampleChapters.filter(ch => 
      !ch.title || 
      ch.title === '0' || 
      ch.title.length < 2 ||
      ch.title.includes('cite_ref') ||
      ch.title.match(/^(ja|en|jp)$/i)
    );
    
    if (invalidTitles.length > 0) {
      console.log(`  ⚠️  Chapter title quality issues: ${invalidTitles.length}/${sampleChapters.length} problematic titles`);
      console.log(`     Sample bad titles: ${invalidTitles.map(ch => `"${ch.title}"`).join(', ')}`);
    } else {
      console.log(`  ✅ Chapter titles look good`);
      console.log(`     Sample: ${sampleChapters.map(ch => `"${ch.title}"`).slice(0, 3).join(', ')}`);
    }
  }
  
  // Verify genres
  if (verification.expectedGenres && data.genres) {
    const matchingGenres = verification.expectedGenres.filter(g => 
      data.genres?.some(dg => dg.toLowerCase().includes(g.toLowerCase()))
    );
    const genreMatch = (matchingGenres.length / verification.expectedGenres.length) * 100;
    console.log(`  🏷️  Genres: ${data.genres.join(', ')}`);
    console.log(`     Match: ${genreMatch.toFixed(0)}% (${matchingGenres.length}/${verification.expectedGenres.length})`);
  }
  
  // Volume details check
  if (data.volumeList && data.volumeList.length > 0) {
    const volumesWithISBN = data.volumeList.filter(v => v.isbn).length;
    const volumesWithDates = data.volumeList.filter(v => v.originalReleaseDate).length;
    const volumesWithChapters = data.volumeList.filter(v => v.chapters && v.chapters.length > 0).length;
    
    console.log(`  📊 Volume data quality:`);
    console.log(`     ISBNs: ${volumesWithISBN}/${data.volumeList.length}`);
    console.log(`     Release dates: ${volumesWithDates}/${data.volumeList.length}`);
    console.log(`     Chapter lists: ${volumesWithChapters}/${data.volumeList.length}`);
  }
  
  if (verification.notes) {
    console.log(`  ℹ️  Note: ${verification.notes}`);
  }
}

function calculateAccuracy(actual: number, expected: number): number {
  if (expected === 0) return 100;
  const difference = Math.abs(actual - expected);
  const accuracy = Math.max(0, 100 - (difference / expected * 100));
  return accuracy;
}

function getAccuracyStatus(accuracy: number): string {
  if (accuracy >= 95) return '✅';
  if (accuracy >= 80) return '⚠️';
  return '❌';
}

async function runVerification() {
  console.log('=== Wikipedia Data Accuracy Verification ===');
  console.log('Comparing extracted data against known accurate values\n');
  
  // Clear cache for fresh test
  wikipediaService.clearCache();
  
  for (const verification of knownData) {
    await verifySeriesData(verification);
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`
Note: Discrepancies may occur due to:
- Wikipedia counting special editions/omnibus volumes
- Different chapter counting methods (main series vs including extras)
- Ongoing series having outdated Wikipedia data
- Series with multiple parts (Tokyo Ghoul, etc.)
`);
  
  console.log('=== Verification Complete ===');
}

runVerification().catch(console.error);