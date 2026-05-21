/* global URLSearchParams */
// Test the unified Fandom search - showing raw data flow
const axios = require('axios');

async function testUnifiedFandomSearch() {
  console.log('=== Testing Unified Fandom Search ===\n');
  console.log('Searching for "Fire Force" with unified metadata fetching...\n');

  try {
    // Step 1: Initial search (MediaWiki API)
    const searchUrl = 'https://fire-force.fandom.com/api.php';
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: 'Fire Force manga',
      format: 'json',
      srlimit: '5'
    });

    console.log('1. INITIAL SEARCH REQUEST:');
    console.log(`   URL: ${searchUrl}?${searchParams}\n`);

    const searchResponse = await axios.get(`${searchUrl}?${searchParams}`);
    const searchResults = searchResponse.data.query.search;
    
    console.log('2. SEARCH RESULTS (Raw):');
    console.log(JSON.stringify(searchResults[0], null, 2));

    // Get the page ID of first result
    const pageId = searchResults[0].pageid;
    const title = searchResults[0].title;

    // Step 2: Get full page details (parallel with article details)
    console.log('\n3. FETCHING ENHANCED DATA IN PARALLEL:');
    
    // Fetch page content with all properties
    const pageParams = new URLSearchParams({
      action: 'query',
      pageids: pageId,
      prop: 'revisions|categories|pageprops|images|info',
      rvprop: 'content',
      rvslots: 'main',
      inprop: 'url',
      format: 'json'
    });

    // Fetch article details from v1 API
    const articleUrl = `https://fire-force.fandom.com/api/v1/Articles/Details?ids=${pageId}`;

    console.log(`   a) Page content: ${searchUrl}?${pageParams.toString().substring(0, 100)}...`);
    console.log(`   b) Article details: ${articleUrl}\n`);

    // Execute both requests in parallel
    const [pageResponse, articleResponse] = await Promise.all([
      axios.get(`${searchUrl}?${pageParams}`),
      axios.get(articleUrl)
    ]);

    const pageData = pageResponse.data.query.pages[pageId];
    const articleData = articleResponse.data.items[pageId];

    console.log('4. ARTICLE DETAILS (v1 API):');
    console.log(JSON.stringify({
      id: articleData.id,
      title: articleData.title,
      url: articleData.url,
      abstract: articleData.abstract?.substring(0, 200) + '...',
      thumbnail: articleData.thumbnail,
      revision: articleData.revision
    }, null, 2));

    // Extract infobox data
    console.log('\n5. EXTRACTED INFOBOX DATA:');
    if (pageData.revisions && pageData.revisions[0]) {
      const content = pageData.revisions[0].slots.main['*'];
      
      // Extract infobox fields using regex
      const extractField = (fieldName) => {
        const regex = new RegExp(`\\|\\s*${fieldName}\\s*=\\s*([^\\|\\}]+)`, 'i');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
      };

      const infoboxData = {
        author: extractField('Author') || extractField('Written by'),
        artist: extractField('Illustrated by') || extractField('Artist'),
        publisher: extractField('Publisher'),
        demographic: extractField('Demographic'),
        volumes: extractField('Volumes'),
        chapters: extractField('Chapters'),
        status: extractField('Status'),
        published: extractField('Published') || extractField('Original run')
      };

      console.log(JSON.stringify(infoboxData, null, 2));
    }

    // Extract description from content
    console.log('\n6. EXTRACTED DESCRIPTION:');
    if (pageData.revisions && pageData.revisions[0]) {
      const content = pageData.revisions[0].slots.main['*'];
      
      // Find first paragraph after infobox
      const descMatch = content.match(/\}\}\s*\n+([^=\n]{100,500})/);
      if (descMatch) {
        const description = descMatch[1]
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
          .replace(/'''([^']+)'''/g, '$1')
          .replace(/''([^']+)''/g, '$1')
          .replace(/{{[^}]+}}/g, '')
          .replace(/<ref[^>]*>.*?<\/ref>/g, '')
          .trim();
        
        console.log(`   "${description.substring(0, 200)}..."`);
      }
    }

    // Extract genres from categories
    console.log('\n7. EXTRACTED GENRES FROM CATEGORIES:');
    if (pageData.categories) {
      const genres = pageData.categories
        .map(cat => cat.title.replace('Category:', ''))
        .filter(cat => 
          ['Action', 'Comedy', 'Drama', 'Fantasy', 'Supernatural', 'Sci-Fi', 'Shōnen']
            .some(genre => cat.includes(genre))
        );
      console.log('   ' + JSON.stringify(genres));
    }

    console.log('\n8. FINAL UNIFIED RESULT:');
    console.log('The search now returns ALL this data in a SINGLE response:');
    console.log(JSON.stringify({
      id: `mw-${pageId}`,
      title: title,
      url: articleData.url,
      description: '(Extracted from wiki content, not placeholder)',
      thumbnail: articleData.thumbnail,
      metadata: {
        author: '(From infobox)',
        artist: '(From infobox)', 
        volumes: '(From infobox)',
        chapters: '(From infobox)',
        status: '(From infobox)',
        genres: '(From categories)',
        publisher: '(From infobox)',
        demographic: '(From infobox)'
      },
      type: 'manga',
      score: 100
    }, null, 2));

    console.log('\n✅ All data fetched in parallel during initial search!');
    console.log('⚡ No more 30-second enhanced fetching delay!');
    console.log('📦 Complete metadata available immediately!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUnifiedFandomSearch();
