#!/usr/bin/env npx tsx

import { ComicVineService } from '../src/server/services/comicvine/service';

async function testVolumeSearch() {
  const service = new ComicVineService(process.env.COMICVINE_API_KEY || '');
  
  console.log('Searching for Fire Force volumes...\n');
  
  // Search for Fire Force
  const searchResults = await service.searchVolumes('Fire Force');
  
  // Find all Fire Force related volumes
  const fireForceVolumes = searchResults.filter(v => v.name?.includes('Fire Force'));
  
  console.log(`Found ${fireForceVolumes.length} Fire Force related volumes:\n`);
  
  fireForceVolumes.forEach(volume => {
    console.log(`Name: ${volume.name}`);
    console.log(`  ID: ${volume.id}`);
    console.log(`  Issues: ${volume.count_of_issues}`);
    console.log(`  Year: ${volume.start_year}`);
    console.log(`  Publisher: ${volume.publisher?.name || 'N/A'}`);
    console.log('');
  });
  
  // Now get issues for the main Fire Force volume
  const mainVolume = fireForceVolumes.find(v => v.name === 'Fire Force' && v.count_of_issues === 34);
  
  if (mainVolume) {
    console.log(`\nGetting issues for main Fire Force volume (ID: ${mainVolume.id})...\n`);
    
    const issues = await service.getIssues(mainVolume.id);
    
    // Look for Volume 1
    const volume1Issues = issues.filter(i => i.issue_number === '1' || i.name?.includes('#1'));
    
    console.log(`Found ${volume1Issues.length} Volume 1 entries:`);
    volume1Issues.forEach(issue => {
      console.log(`  Name: ${issue.name}`);
      console.log(`    ID: ${issue.id}`);
      console.log(`    URL: ${issue.site_detail_url || `https://comicvine.gamespot.com/issue/4000-${issue.id}/`}`);
      console.log('');
    });
  }
}

testVolumeSearch().catch(console.error);