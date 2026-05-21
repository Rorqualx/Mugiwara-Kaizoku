#!/usr/bin/env node

/**
 * Test script to verify what data ComicVine API actually returns
 * Compares with what's shown on the website
 */

const fetch = require('node-fetch');

async function testComicVineAPI() {
  console.log('Testing ComicVine API Data Return...\n');
  console.log('='.repeat(80));
  
  try {
    // Test 1: Fetch volume details for Fire Force (ID: 95557 from your URL)
    console.log('\n📚 VOLUME TEST: Fire Force (ID: 95557)');
    console.log('Website URL: https://comicvine.gamespot.com/fire-force/4050-95557/');
    console.log('-'.repeat(80));
    
    const volumeResponse = await fetch('http://localhost:3001/api/trpc/metadata.fetchComicvineVolumeDetails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          id: '95557',  // Fire Force volume ID from your URL
          type: 'volume'
        }
      })
    });
    
    const volumeData = await volumeResponse.json();
    
    if (volumeData.result?.data?.status === 'success') {
      const volume = volumeData.result.data.data;
      
      console.log('\n✅ API RETURNED DATA:');
      console.log('━'.repeat(40));
      
      // Basic Info
      console.log('\n📋 BASIC INFO:');
      console.log(`  Name: ${volume.name || 'NOT RETURNED'}`);
      console.log(`  ID: ${volume.id || 'NOT RETURNED'}`);
      console.log(`  Start Year: ${volume.startYear || 'NOT RETURNED'}`);
      console.log(`  Publisher: ${volume.publisher?.name || 'NOT RETURNED'}`);
      console.log(`  Issue Count: ${volume.issueCount || 'NOT RETURNED'}`);
      
      // Description
      console.log('\n📝 DESCRIPTION:');
      if (volume.description) {
        // Strip HTML and show first 200 chars
        const cleanDesc = volume.description.replace(/<[^>]*>/g, '').trim();
        console.log(`  ${cleanDesc.substring(0, 200)}${cleanDesc.length > 200 ? '...' : ''}`);
      } else {
        console.log('  NOT RETURNED');
      }
      
      // Cover Images
      console.log('\n🖼️  COVER IMAGES:');
      if (volume.coverImages) {
        console.log(`  Small: ${volume.coverImages.small ? '✓' : '✗'}`);
        console.log(`  Medium: ${volume.coverImages.medium ? '✓' : '✗'}`);
        console.log(`  Large: ${volume.coverImages.large ? '✓' : '✗'}`);
        console.log(`  Original: ${volume.coverImages.original ? '✓' : '✗'}`);
      } else {
        console.log('  NOT RETURNED');
      }
      
      // Issues List
      console.log('\n📖 ISSUES:');
      if (volume.issues && volume.issues.length > 0) {
        console.log(`  Total Issues in Response: ${volume.issues.length}`);
        console.log(`  First 5 Issues:`);
        volume.issues.slice(0, 5).forEach(issue => {
          console.log(`    - Issue #${issue.issue_number || issue.issueNumber || 'N/A'}: ${issue.name || 'No Name'}`);
        });
        if (volume.issues.length > 5) {
          console.log(`    ... and ${volume.issues.length - 5} more`);
        }
      } else {
        console.log('  NOT RETURNED or EMPTY');
      }
      
      // Characters
      console.log('\n👥 CHARACTERS:');
      if (volume.characters && volume.characters.length > 0) {
        console.log(`  Total Characters: ${volume.characters.length}`);
        console.log(`  First 5: ${volume.characters.slice(0, 5).map(c => c.name || c).join(', ')}`);
      } else {
        console.log('  NOT RETURNED or EMPTY');
      }
      
      // Creators
      console.log('\n✍️  CREATORS:');
      if (volume.creators && volume.creators.length > 0) {
        console.log(`  Total Creators: ${volume.creators.length}`);
        volume.creators.slice(0, 3).forEach(creator => {
          console.log(`    - ${creator.name || 'Unknown'} (${creator.role || 'No Role'})`);
        });
      } else {
        console.log('  NOT RETURNED or EMPTY');
      }
      
      // Dates
      console.log('\n📅 DATES:');
      console.log(`  Date Added: ${volume.dateAdded || 'NOT RETURNED'}`);
      console.log(`  Date Updated: ${volume.dateLastUpdated || 'NOT RETURNED'}`);
      
      // First and Last Issue
      console.log('\n🔖 FIRST/LAST ISSUES:');
      if (volume.firstIssue) {
        console.log(`  First: Issue #${volume.firstIssue.issueNumber || 'N/A'} - ${volume.firstIssue.name || 'No Name'}`);
      } else {
        console.log('  First: NOT RETURNED');
      }
      if (volume.lastIssue) {
        console.log(`  Last: Issue #${volume.lastIssue.issueNumber || 'N/A'} - ${volume.lastIssue.name || 'No Name'}`);
      } else {
        console.log('  Last: NOT RETURNED');
      }
      
      // What's on website but might be missing
      console.log('\n❓ WEBSITE DATA CHECK:');
      console.log('  Website shows:');
      console.log('    - Themes: Action, Adventure, Animated, Drama, Manga, Supernatural, Translated');
      console.log('    - Aliases: (if any)');
      console.log('    - All 34 issues with dates');
      console.log('\n  Checking if API returns these...');
      console.log(`    - Themes/Genres: ${volume.genres ? 'YES' : 'NO'}`);
      console.log(`    - Aliases: ${volume.aliases ? 'YES' : 'NO'}`);
      console.log(`    - Issue Dates: Let's check...`);
      
      // Check if issues have dates
      if (volume.issues && volume.issues.length > 0) {
        const firstIssueWithDate = volume.issues.find(i => i.cover_date || i.store_date);
        if (firstIssueWithDate) {
          console.log(`      ✓ Issues have dates (example: ${firstIssueWithDate.cover_date || firstIssueWithDate.store_date})`);
        } else {
          console.log(`      ✗ Issues don't include dates in this response`);
        }
      }
      
    } else {
      console.log('❌ Failed to fetch volume details:', volumeData.result?.data?.error || 'Unknown error');
    }
    
    // Test 2: Fetch individual issue details
    console.log('\n' + '='.repeat(80));
    console.log('\n📄 ISSUE TEST: Fire Force #1 (ID: 557264)');
    console.log('Website URL: https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/');
    console.log('-'.repeat(80));
    
    const issueResponse = await fetch('http://localhost:3001/api/trpc/metadata.fetchComicvineVolumeDetails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          id: '557264',  // Fire Force Issue #1 ID from your URL
          type: 'issue'
        }
      })
    });
    
    const issueData = await issueResponse.json();
    
    if (issueData.result?.data?.status === 'success') {
      const issue = issueData.result.data.data;
      
      console.log('\n✅ API RETURNED DATA FOR ISSUE:');
      console.log('━'.repeat(40));
      
      console.log('\n📋 ISSUE INFO:');
      console.log(`  Name: ${issue.name || 'NOT RETURNED'}`);
      console.log(`  ID: ${issue.id || 'NOT RETURNED'}`);
      console.log(`  Cover Date: ${issue.coverDate || 'NOT RETURNED'}`);
      console.log(`  Store Date: ${issue.storeDate || 'NOT RETURNED'}`);
      console.log(`  Volume: ${issue.volume?.name || 'NOT RETURNED'}`);
      
      console.log('\n📝 DESCRIPTION:');
      if (issue.description) {
        const cleanDesc = issue.description.replace(/<[^>]*>/g, '').trim();
        console.log(`  ${cleanDesc.substring(0, 200)}${cleanDesc.length > 200 ? '...' : ''}`);
      } else {
        console.log('  NOT RETURNED');
      }
      
      console.log('\n👥 CHARACTER CREDITS:');
      if (issue.characterCredits && issue.characterCredits.length > 0) {
        console.log(`  Total: ${issue.characterCredits.length}`);
        console.log(`  Characters: ${issue.characterCredits.slice(0, 5).map(c => c.name || c).join(', ')}`);
      } else {
        console.log('  NOT RETURNED');
      }
      
      console.log('\n✍️  PERSON CREDITS:');
      if (issue.personCredits && issue.personCredits.length > 0) {
        issue.personCredits.forEach(person => {
          console.log(`    - ${person.name || 'Unknown'} (${person.role || 'No Role'})`);
        });
      } else {
        console.log('  NOT RETURNED');
      }
      
    } else {
      console.log('❌ Failed to fetch issue details:', issueData.result?.data?.error || 'Unknown error');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log('━'.repeat(40));
    console.log('\n🔍 Data Comparison with Website:');
    console.log('\nWEBSITE shows but API might be missing:');
    console.log('  1. Themes/Tags (Action, Adventure, etc.)');
    console.log('  2. Aliases');
    console.log('  3. Full issue list with ALL 34 issues');
    console.log('  4. Issue release dates for each issue');
    console.log('  5. Chapter titles within issues');
    console.log('\nAPI provides that website doesn\'t prominently show:');
    console.log('  1. Character appearances');
    console.log('  2. Creator credits with roles');
    console.log('  3. Date added/updated to ComicVine');
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('  1. Check if API can return ALL issues (not limited to 10)');
    console.log('  2. Verify if themes/genres are available in API');
    console.log('  3. Check if issue dates are included when fetching full issue list');
    console.log('  4. Consider fetching individual issue details for complete data');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Server is running on http://localhost:3001');
    console.error('2. ComicVine API is configured');
    console.error('3. You have a valid ComicVine API key');
  }
}

// Run the test
testComicVineAPI();