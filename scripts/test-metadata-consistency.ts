#!/usr/bin/env bun

/**
 * Test script for metadata consistency across provider combinations
 *
 * Tests the BasicInfoStepMetadataPreview component's metadata aggregation
 * and confidence scoring across different provider combinations.
 */

import { aggregateMetadataWithProvenance } from '../src/components/addManga/steps/wizard/BasicInfoStepMetadataPreview';

// Mock metadata for different providers
const mockAnilistMetadata = {
  title: 'One Piece',
  description: 'The story follows the adventures of Monkey D. Luffy, a boy whose body gained the properties of rubber after unintentionally eating a Devil Fruit.',
  status: 'ONGOING',
  format: 'MANGA',
  genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
  authors: ['Eiichiro Oda'],
  startDate: '1997-07-22',
  chapters: 1100,
  volumes: 105,
  cover: 'https://example.com/anilist-cover.jpg'
};

const mockMangaDexMetadata = {
  title: 'ONE PIECE',
  description: 'Gol D. Roger was known as the "Pirate King," the strongest and most infamous being to have sailed the Grand Line.',
  status: 'ongoing',
  format: 'manga',
  genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
  authors: ['Eiichiro Oda'],
  artists: ['Eiichiro Oda'],
  startDate: '1997-07-19',
  chapters: 1098,
  volumes: 104,
  cover: 'https://example.com/mangadex-cover.jpg'
};

const mockComicVineMetadata = {
  title: 'One Piece',
  description: 'Monkey D. Luffy sets out to become the King of the Pirates by finding the legendary treasure One Piece.',
  status: 'Ongoing',
  format: 'Manga',
  genres: ['Action', 'Adventure'],
  authors: ['Eiichiro Oda'],
  startDate: '1997',
  volumes: 105,
  cover: 'https://example.com/comicvine-cover.jpg'
};

const mockFandomMetadata = {
  title: 'One Piece (Manga)',
  description: 'One Piece is a Japanese manga series written and illustrated by Eiichiro Oda.',
  status: 'Ongoing',
  format: 'Manga',
  genres: ['Action', 'Adventure', 'Fantasy'],
  authors: ['Eiichiro Oda'],
  startDate: 'July 22, 1997',
  volumes: 105,
  cover: 'https://example.com/fandom-cover.jpg'
};

const mockWikipediaMetadata = {
  title: 'One Piece (manga)',
  description: 'One Piece is a Japanese manga series written and illustrated by Eiichiro Oda.',
  status: 'Ongoing',
  format: 'Manga',
  genres: ['Adventure', 'Fantasy'],
  authors: ['Eiichiro Oda'],
  startDate: '1997',
  volumes: 105,
  cover: 'https://example.com/wikipedia-cover.jpg'
};

// Test different provider combinations
const testCases = [
  {
    name: 'Single provider - AniList',
    selectedSources: ['anilist'],
    selectedSourcesMetadata: {
      anilist: mockAnilistMetadata
    }
  },
  {
    name: 'Two providers - AniList + MangaDex',
    selectedSources: ['anilist', 'mangadex'],
    selectedSourcesMetadata: {
      anilist: mockAnilistMetadata,
      mangadex: mockMangaDexMetadata
    }
  },
  {
    name: 'Three providers - AniList + MangaDex + ComicVine',
    selectedSources: ['anilist', 'mangadex', 'comicvine'],
    selectedSourcesMetadata: {
      anilist: mockAnilistMetadata,
      mangadex: mockMangaDexMetadata,
      comicvine: mockComicVineMetadata
    }
  },
  {
    name: 'All providers',
    selectedSources: ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'],
    selectedSourcesMetadata: {
      anilist: mockAnilistMetadata,
      mangadex: mockMangaDexMetadata,
      comicvine: mockComicVineMetadata,
      fandom: mockFandomMetadata,
      wikipedia: mockWikipediaMetadata
    }
  },
  {
    name: 'Mixed providers with missing data',
    selectedSources: ['anilist', 'fandom'],
    selectedSourcesMetadata: {
      anilist: { ...mockAnilistMetadata, description: undefined, chapters: undefined },
      fandom: { ...mockFandomMetadata, volumes: undefined }
    }
  }
];

function runTest(testCase: typeof testCases[0]) {
  console.log(`\n=== Test: ${testCase.name} ===`);
  console.log(`Selected sources: ${testCase.selectedSources.join(', ')}`);

  try {
    const result = aggregateMetadataWithProvenance(
      testCase.selectedSourcesMetadata,
      testCase.selectedSources
    );

    console.log(`\nAggregated fields: ${Object.keys(result.aggregated).length}`);
    console.log('Field provenance summary:');

    Object.entries(result.fieldProvenance).forEach(([field, provenance]) => {
      console.log(`  ${field}: ${provenance.provider} (${provenance.confidence}%)`);
      if (provenance.alternatives && provenance.alternatives.length > 0) {
        console.log(`    Alternatives: ${provenance.alternatives.map(a => `${a.provider} (${a.confidence}%)`).join(', ')}`);
      }
    });

    // Calculate overall statistics
    const totalConfidence = Object.values(result.fieldProvenance)
      .reduce((sum, p) => sum + p.confidence, 0);
    const averageConfidence = Math.round(totalConfidence / Object.keys(result.fieldProvenance).length);

    console.log(`\nOverall average confidence: ${averageConfidence}%`);

    // Check for consistency issues
    const consistencyIssues: string[] = [];

    // Check if title is consistent across providers (case-insensitive)
    const titles = Object.values(testCase.selectedSourcesMetadata)
      .filter(metadata => metadata && typeof metadata === 'object' && 'title' in metadata)
      .map(metadata => (metadata as any).title?.toString().toLowerCase().trim());

    const uniqueTitles = new Set(titles);
    if (uniqueTitles.size > 1) {
      consistencyIssues.push(`Title inconsistency: ${Array.from(uniqueTitles).join(' vs ')}`);
    }

    // Check if we have conflicting values for numeric fields
    const numericFields = ['chapters', 'volumes'];
    numericFields.forEach(field => {
      const values = Object.values(testCase.selectedSourcesMetadata)
        .filter(metadata => metadata && typeof metadata === 'object' && field in metadata)
        .map(metadata => (metadata as any)[field])
        .filter(value => value !== undefined && value !== null);

      const uniqueValues = new Set(values);
      if (uniqueValues.size > 1) {
        consistencyIssues.push(`${field} inconsistency: ${Array.from(uniqueValues).join(' vs ')}`);
      }
    });

    if (consistencyIssues.length > 0) {
      console.log('\n⚠️  Consistency issues found:');
      consistencyIssues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ No consistency issues found');
    }

    return { success: true, issues: consistencyIssues };
  } catch (error) {
    console.error(`❌ Test failed: ${error}`);
    return { success: false, error: String(error) };
  }
}

async function main() {
  console.log('🧪 Testing metadata consistency across provider combinations\n');

  const results = testCases.map(runTest);

  const passedTests = results.filter(r => r.success && (!('issues' in r) || r.issues.length === 0)).length;
  const totalTests = testCases.length;

  console.log(`\n📊 Summary: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Metadata aggregation is working correctly.');
  } else {
    console.log('❌ Some tests failed or had consistency issues.');
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}