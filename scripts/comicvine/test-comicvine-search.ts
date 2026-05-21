/**
 * Simple ComicVine Search Test
 *
 * Tests ComicVine search functionality using the existing service
 */

async function testComicVineSearch() {
  console.log('ComicVine Search Test');
  console.log('==================\n');

  // Test titles
  const testTitles = [
    'One Piece',
    'Naruto',
    'Dragon Ball',
  ];

  for (const title of testTitles) {
    console.log(`Searching for: ${title}`);

    try {
      // Use the ComicVine API directly
      const params = new URLSearchParams({
        query: title,
        resources: 'volume',
        field_list: 'id,name,publisher,site_detail_url',
        limit: '5',
        format: 'json',
      });

      const response = await fetch(`https://comicvine.gamespot.com/api/search?${params}`);

      if (response.ok) {
        const data = await response.json();

        if (data.error) {
          console.log(`  ❌ API Error: ${data.error}`);
        } else if (data.results && data.results.length > 0) {
          console.log(`  ✓ Found ${data.results.length} results:`);

          for (const result of data.results.slice(0, 3)) {
            const publisher = typeof result.publisher === 'string'
              ? result.publisher
              : result.publisher?.name || 'Unknown';

            console.log(`    - ${result.name}`);
            console.log(`      ID: ${result.id}`);
            console.log(`      Publisher: ${publisher}`);
            console.log(`      URL: ${result.site_detail_url || 'N/A'}`);
          }
        } else {
          console.log(`  ❌ No results found`);
        }
      } else {
        console.log(`  ❌ HTTP Error: ${response.status}`);
      }

    } catch (error) {
      console.log(`  ❌ Request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();

    // Rate limiting - don't spam the API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\nRecommendation:');
  console.log('=============');

  console.log('\nBased on the test results, here are the recommended strategies:');
  console.log('\n1. **API Key Required**: ComicVine API requires an API key for all requests.');
  console.log('   - Sign up at: https://comicvine.gamespot.com/api/');
  console.log('   - Free tier available with rate limits');

  console.log('\n2. **Direct API Search** (Recommended):');
  console.log('   - Use /search endpoint with query parameter');
  console.log('   - Filter by resources=volume for manga volumes');
  console.log('   - Use field_list to get only needed data');
  console.log('   - Results include: id, name, publisher, site_detail_url');

  console.log('\n3. **Multi-Query Strategy** (for better accuracy):');
  console.log('   - Try original title first');
  console.log('   - If no good match, try normalized title (no special chars)');
  console.log('   - Try title without subtitle/parenthetical');
  console.log('   - Filter results by publisher if known');

  console.log('\n4. **Confidence Scoring** (for multiple results):');
  console.log('   - Exact name match: 0.7 points');
  console.log('   - Publisher match: 0.3 points');
  console.log('   - 4050 volume (not 4000 issue): 0.1 points');
  console.log('   - Accept matches with 0.7+ confidence');

  console.log('\n5. **Rate Limiting** (important):');
  console.log('   - ComicVine free tier: 200 requests/hour');
  console.log('   - Recommended delay: 2-3 seconds between requests');
  console.log('   - Use caching to avoid duplicate searches');

  console.log('\n6. **Fallback Strategy** (when API fails):');
  console.log('   - Use Google search: "site:comicvine.gamespot.com [title]"');
  console.log('   - Parse search results for ComicVine URLs');
  console.log('   - Extract volume ID from URL (4050-XXXXX format)');
}

testComicVineSearch().catch(console.error);
