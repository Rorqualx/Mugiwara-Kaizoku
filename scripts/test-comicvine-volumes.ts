#!/usr/bin/env npx tsx

import { SourceManagementService } from '../src/components/addManga/services/sourceManagementService';
import { SearchResultValidator } from '../src/server/services/search/providers/SearchResultValidator';
import { MetadataProvider } from '@prisma/client';

async function testComicVineVolumes() {
  console.log('\n=== Testing ComicVine Volume Display with Fire Force ===\n');

  // Simulate the Fire Force search result from ComicVine
  const fireForceResult = {
    id: '95557',
    title: 'Fire Force',
    description: 'Fire Force is a manga series by Atsushi Ōkubo.',
    coverImage: 'https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/7123456-01.jpg',
    provider: MetadataProvider.COMICVINE,
    volumes: 34,
    volumeId: 95557,
    comicvineId: '95557',
    publisher: 'Kodansha Comics USA',
    issuesCount: 34,
    siteDetailUrl: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
    metadata: {
      comicvineId: 95557,
      publisher: 'Kodansha Comics USA',
      startYear: '2015',
      issueCount: 34,
      siteDetailUrl: 'https://comicvine.gamespot.com/fire-force/4050-95557/'
    }
  };

  console.log('Input ComicVine Result:');
  console.log('------------------------');
  console.log(`Title: ${fireForceResult.title}`);
  console.log(`Volumes (count_of_issues): ${fireForceResult.volumes}`);
  console.log(`URL: ${fireForceResult.siteDetailUrl}`);
  console.log(`Publisher: ${fireForceResult.publisher}`);

  // Mock mutations for testing
  const mockMutations = {
    fetchComicvineVolumeDetailsMutation: {
      mutateAsync: async ({ id }: { id: string }) => {
        console.log(`\n📡 Fetching ComicVine details for volume ID: ${id}`);
        // Simulate API response with volume count but no detailed issue data
        return {
          success: true,
          data: {
            id: 95557,
            name: 'Fire Force',
            count_of_issues: 34,
            site_detail_url: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
            publisher: { name: 'Kodansha Comics USA' },
            start_year: '2015',
            description: 'Fire Force manga series',
            deck: 'Fire Force is a manga series by Atsushi Ōkubo.',
            image: {
              original_url: 'https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/7123456-01.jpg'
            }
            // Note: No 'issues' array - simulating when API doesn't provide detailed volume data
          }
        };
      }
    },
    scrapeComicVineVolumeUrlsMutation: {
      mutateAsync: async ({ seriesUrl }: { seriesUrl: string }) => {
        console.log(`\n🔍 Scraping volume URLs from: ${seriesUrl}`);
        // Simulate finding volume URLs
        const volumeUrls = Array.from({ length: 34 }, (_, i) => ({
          volumeNumber: i + 1,
          url: `https://comicvine.gamespot.com/fire-force-${i + 1}/4000-${100000 + i}/`
        }));
        return {
          success: true,
          data: { volumeUrls: volumeUrls.slice(0, 5) } // Just first 5 for testing
        };
      }
    },
    scrapeComicVineChaptersMutation: {
      mutateAsync: async ({ volumeUrls }: { volumeUrls: string[] }) => {
        console.log(`\n📖 Scraping ${volumeUrls.length} volumes for chapters...`);
        // Simulate scraped chapter data
        const volumes = volumeUrls.map((url, idx) => ({
          volumeNumber: idx + 1,
          volumeTitle: `Fire Force Volume ${idx + 1}`,
          volumeSummary: `Summary for volume ${idx + 1}`,
          chapters: Array.from({ length: 9 }, (_, j) => ({
            number: String((idx * 9) + j + 1),
            title: `Chapter ${(idx * 9) + j + 1}`
          }))
        }));
        return {
          success: true,
          data: { volumes }
        };
      }
    }
  };

  // Create service instance
  const service = new SourceManagementService(mockMutations as any);

  // Test fetching ComicVine metadata
  console.log('\n\n📚 Testing ComicVine Metadata Fetch...\n');
  const metadata = await service.fetchComicvineMetadata(fireForceResult);

  console.log('\nResult Metadata:');
  console.log('-----------------');
  console.log(`Title: ${metadata.title}`);
  console.log(`Volumes: ${metadata.volumes}`);
  console.log(`Chapters: ${metadata.chapters}`);
  console.log(`URL: ${metadata.url}`);
  console.log(`Site Detail URL: ${metadata.siteDetailUrl}`);
  console.log(`Scraping Status: ${(metadata as any).scrapingStatus}`);
  console.log(`Volume Data Length: ${metadata.volumeData?.length || 0}`);

  if (metadata.volumeData && metadata.volumeData.length > 0) {
    console.log('\n📖 Volume Data Sample:');
    console.log('----------------------');

    // Show first 3 volumes
    metadata.volumeData.slice(0, 3).forEach((vol: any) => {
      console.log(`Volume ${vol.volumeNumber}:`);
      console.log(`  Title: ${vol.title}`);
      console.log(`  Chapters: ${vol.chapterCount}`);
      console.log(`  Status: ${vol.status}`);
    });

    // Show last volume
    const lastVolume = metadata.volumeData[metadata.volumeData.length - 1];
    console.log(`...`);
    console.log(`Volume ${lastVolume.volumeNumber}:`);
    console.log(`  Title: ${lastVolume.title}`);
    console.log(`  Chapters: ${lastVolume.chapterCount}`);
    console.log(`  Status: ${lastVolume.status}`);
  }

  console.log('\n✅ Test Results:');
  console.log('-----------------');
  const tests = [
    {
      name: 'Should have 34 volumes',
      pass: metadata.volumes === 34,
      actual: metadata.volumes,
      expected: 34
    },
    {
      name: 'Should generate volume data array',
      pass: metadata.volumeData && metadata.volumeData.length === 34,
      actual: metadata.volumeData?.length || 0,
      expected: 34
    },
    {
      name: 'URL should be preserved',
      pass: metadata.siteDetailUrl === fireForceResult.siteDetailUrl,
      actual: metadata.siteDetailUrl,
      expected: fireForceResult.siteDetailUrl
    },
    {
      name: 'Volumes should have pending_scrape status',
      pass: metadata.volumeData && metadata.volumeData[0]?.status === 'pending_scrape',
      actual: metadata.volumeData?.[0]?.status,
      expected: 'pending_scrape'
    }
  ];

  tests.forEach(test => {
    if (test.pass) {
      console.log(`✅ ${test.name}`);
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
    }
  });

  const passed = tests.every(t => t.pass);
  console.log(`\nOverall: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  return passed;
}

// Run the test
testComicVineVolumes().then(success => {
  if (success) {
    console.log('\n🎉 ComicVine volume display is working correctly!');
    console.log('All 34 Fire Force volumes are generated and ready for scraping.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});