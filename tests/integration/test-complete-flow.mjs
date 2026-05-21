import axios from 'axios';

async function testCompleteFlow() {
  try {
    console.log('Testing complete Fire Force parsing flow...\n');
    
    // Call the parseEnhancedVolumes endpoint
    const response = await axios.post('http://localhost:3001/api/trpc/metadata.parseEnhancedVolumes', {
      json: {
        volumesPageUrl: 'https://fire-force.fandom.com/wiki/List_of_Volumes',
        extractChapterUrls: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = response.data?.result?.data?.json;
    
    if (result?.status === 'success' && result?.data) {
      const data = result.data;
      console.log(`✅ Success! Parsed ${data.totalVolumes} volumes with ${data.totalChapters} chapters\n`);
      
      // Count chapter URLs
      let urlCount = 0;
      data.volumes.forEach(vol => {
        const volUrls = vol.chapters.filter(ch => ch.url).length;
        urlCount += volUrls;
        if (vol.volumeNumber <= 3) {
          console.log(`Volume ${vol.volumeNumber}: ${vol.chapters.length} chapters, ${volUrls} with URLs`);
          if (volUrls > 0) {
            const firstWithUrl = vol.chapters.find(ch => ch.url);
            if (firstWithUrl) {
              console.log(`  Example: Ch ${firstWithUrl.chapterNumber} - ${firstWithUrl.url}`);
            }
          }
        }
      });
      
      console.log(`\n📊 Total chapter URLs extracted: ${urlCount} / ${data.totalChapters}`);
      
    } else if (result?.status === 'error') {
      console.error('❌ Error:', result.error?.message || 'Unknown error');
    } else {
      console.log('Unexpected response:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Failed to test:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCompleteFlow();