#!/usr/bin/env node

import axios from 'axios';

async function testEnhancedFandomExtraction() {
  const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
  
  console.log('Testing enhanced Fandom extraction for Fire Force...\n');
  
  try {
    // Call the enhanced metadata endpoint
    const response = await axios.post('http://localhost:3000/api/trpc/metadata.fetchEnhancedMangaMetadata', {
      json: {
        mangaPageUrl: url,
        includeGallery: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // The actual data is in response.data.result.data.json.data
    if (response.data.result?.data?.json?.status === 'success') {
      const metadata = response.data.result.data.json.data;
      
      console.log('=== EXTRACTED METADATA ===\n');
      console.log('Title:', metadata.title);
      console.log('Alternative Titles:', metadata.alternativeTitles);
      
      console.log('\n=== PUBLICATION INFO ===');
      if (metadata.publication) {
        console.log('Author:', metadata.publication.author);
        console.log('Illustrator:', metadata.publication.illustrator);
        console.log('Publisher:', metadata.publication.publisher);
        console.log('Demographic:', metadata.publication.demographic);
        console.log('Published:', metadata.publication.published);
        console.log('Finished:', metadata.publication.finished);
        console.log('Volumes:', metadata.publication.volumes);
        console.log('Chapters:', metadata.publication.chapters);
        console.log('Status:', metadata.publication.status);
        console.log('Genres:', metadata.publication.genres);
        console.log('Themes:', metadata.publication.themes);
      }
      
      console.log('\n=== DESCRIPTIONS ===');
      if (metadata.descriptions) {
        console.log('Synopsis:', metadata.descriptions.synopsis ? metadata.descriptions.synopsis.substring(0, 100) + '...' : 'N/A');
        console.log('Plot:', metadata.descriptions.plot ? metadata.descriptions.plot.substring(0, 100) + '...' : 'N/A');
        console.log('Background:', metadata.descriptions.background ? metadata.descriptions.background.substring(0, 100) + '...' : 'N/A');
        console.log('History:', metadata.descriptions.history ? metadata.descriptions.history.substring(0, 100) + '...' : 'N/A');
      }
      
      console.log('\n=== MEDIA ===');
      if (metadata.coverArt) {
        console.log('Primary Cover:', metadata.coverArt.primary);
        console.log('Gallery Images:', metadata.coverArt.gallery?.length || 0);
        console.log('Volume Covers:', metadata.coverArt.volumeCovers?.length || 0);
        console.log('Character Art:', metadata.coverArt.characterArt?.length || 0);
      }
      
      console.log('\n=== LINKS ===');
      if (metadata.links) {
        console.log('Volumes Page:', metadata.links.volumesPage);
        console.log('Chapters Page:', metadata.links.chaptersPage);
        console.log('Characters Page:', metadata.links.charactersPage);
        console.log('Arcs Page:', metadata.links.arcsPage);
      }
      
      console.log('\n=== SUCCESS ===');
      console.log('All data extracted successfully!');
      
      // Check if dates were extracted
      if (metadata.publication?.published) {
        console.log('\n✅ Start date found:', metadata.publication.published);
      } else {
        console.log('\n⚠️ No start date found');
      }
      
      if (metadata.publication?.finished) {
        console.log('✅ End date found:', metadata.publication.finished);
      } else {
        console.log('⚠️ No end date found');
      }
      
      if (metadata.alternativeTitles?.length > 0) {
        console.log('✅ Alternative titles found:', metadata.alternativeTitles.length);
      } else {
        console.log('⚠️ No alternative titles found');
      }
      
    } else {
      console.error('Unexpected response structure:', response.data);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testEnhancedFandomExtraction();