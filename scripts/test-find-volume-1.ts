#!/usr/bin/env npx tsx

import { ComicVineService } from '../src/server/services/comicvine/service';

async function findVolume1() {
  const service = new ComicVineService(process.env.COMICVINE_API_KEY || '');
  
  console.log('Finding Fire Force Volume 1 from API...\n');
  
  // Get all issues for Fire Force
  const searchResults = await service.searchVolumes('Fire Force');
  const fireForce = searchResults.find(v => v.name === 'Fire Force' && v.count_of_issues === 34);
  
  if (!fireForce) {
    console.log('Could not find Fire Force');
    return;
  }
  
  const issues = await service.getIssues(fireForce.id);
  
  // Find Volume 1
  const volume1 = issues.find(i => i.issue_number === '1');
  
  if (volume1) {
    console.log('Found Volume 1:');
    console.log('  ID:', volume1.id);
    console.log('  Name:', volume1.name);
    console.log('  Issue Number:', volume1.issue_number);
    console.log('  Site URL:', volume1.site_detail_url);
    console.log('  Constructed URL:', `https://comicvine.gamespot.com/issue/4000-${volume1.id}/`);
  } else {
    console.log('Could not find Volume 1');
  }
}

findVolume1().catch(console.error);