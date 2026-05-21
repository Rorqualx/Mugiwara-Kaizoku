#!/usr/bin/env npx tsx

import { comicVineScraper } from '../src/server/services/comicvine/scrapingService';
import { comicVineService } from '../src/server/services/comicvine/service';

async function testAllFireForceVolumes() {
  console.log('Testing all Fire Force volumes scraping...\n');
  
  // First get volume data from ComicVine API
  const searchResults = await comicVineService.search('Fire Force');
  const fireForceVolume = searchResults.find(v => v.name === 'Fire Force' && v.count_of_issues === 34);
  
  if (!fireForceVolume) {
    console.log('Could not find Fire Force in search results');
    return;
  }
  
  console.log(`Found Fire Force with ${fireForceVolume.count_of_issues} volumes\n`);
  
  // Get all issues (volumes) for Fire Force
  const issues = await comicVineService.getVolumeIssues(fireForceVolume.id);
  console.log(`Retrieved ${issues.length} volumes from API\n`);
  
  let totalChapters = 0;
  const volumeResults: any[] = [];
  
  // Test scraping each volume
  for (const issue of issues) {
    const volumeUrl = issue.site_detail_url || `https://comicvine.gamespot.com/issue/4000-${issue.id}/`;
    
    console.log(`Scraping Volume ${issue.issue_number}: ${issue.name}`);
    console.log(`  URL: ${volumeUrl}`);
    
    const result = await comicVineScraper.scrapeVolumeChapters(volumeUrl);
    
    if (result) {
      console.log(`  ✅ Found ${result.totalChapters} chapters`);
      totalChapters += result.totalChapters;
      volumeResults.push({
        volumeNumber: issue.issue_number,
        volumeName: issue.name,
        chapterCount: result.totalChapters,
        chapters: result.chapters.map(ch => `${ch.number}: ${ch.title}`)
      });
    } else {
      console.log(`  ❌ Failed to scrape volume`);
      volumeResults.push({
        volumeNumber: issue.issue_number,
        volumeName: issue.name,
        chapterCount: 0,
        chapters: []
      });
    }
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total volumes: ${issues.length}`);
  console.log(`Total chapters scraped: ${totalChapters}`);
  console.log(`Expected chapters: 305 (including Chapter 0)\n`);
  
  // Check for specific important chapters
  const allChapters = volumeResults.flatMap(v => v.chapters);
  const hasChapter0 = allChapters.some((ch: string) => ch.startsWith('0:'));
  const hasChapter304 = allChapters.some((ch: string) => ch.startsWith('304:'));
  
  console.log('Important chapters:');
  console.log(`  Chapter 0: ${hasChapter0 ? '✅ Found' : '❌ Missing'}`);
  console.log(`  Chapter 304 (Epilogue 2): ${hasChapter304 ? '✅ Found' : '❌ Missing'}`);
  
  if (totalChapters === 305) {
    console.log('\n✅ SUCCESS: All 305 chapters found!');
  } else {
    console.log(`\n❌ ISSUE: Found ${totalChapters} chapters instead of 305`);
    
    // Show which volumes might have issues
    console.log('\nVolumes with potential issues:');
    volumeResults.forEach(v => {
      if (v.chapterCount === 0) {
        console.log(`  Volume ${v.volumeNumber}: NO CHAPTERS FOUND`);
      }
    });
  }
}

testAllFireForceVolumes().catch(console.error);