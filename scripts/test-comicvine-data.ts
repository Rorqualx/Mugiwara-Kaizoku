import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.COMICVINE_API_KEY || '';
const BASE_URL = 'https://comicvine.gamespot.com/api';

async function testComicVineAPI() {
  console.log('Testing Comic Vine API directly...\n');
  console.log('API Key:', API_KEY ? 'Found' : 'NOT FOUND');
  
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    console.error('Please set a valid COMICVINE_API_KEY in your .env file');
    return;
  }
  
  try {
    // Search for Fire Force
    console.log('\nSearching for "Fire Force" with enhanced fields...');
    
    const searchUrl = `${BASE_URL}/search/`;
    const params = {
      api_key: API_KEY,
      format: 'json',
      query: 'Fire Force',
      resources: 'volume',
      field_list: 'id,name,image,start_year,publisher,count_of_issues,deck,description,genres,person_credits,characters,volume_number',
      limit: 3
    };
    
    console.log('Request URL:', searchUrl);
    console.log('Field list:', params.field_list);
    
    const response = await axios.get(searchUrl, { 
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaLibrary/1.0)'
      }
    });
    
    if (response.data.error !== 'OK') {
      console.error('API Error:', response.data.error);
      return;
    }
    
    const results = response.data.results || [];
    console.log(`\nFound ${results.length} results\n`);
    
    results.forEach((result: any, index: number) => {
      console.log(`\n========== Result ${index + 1}: ${result.name} ==========`);
      console.log('ID:', result.id);
      console.log('Name:', result.name);
      console.log('Start Year:', result.start_year);
      console.log('Publisher:', result.publisher?.name || 'N/A');
      console.log('Issue Count:', result.count_of_issues);
      console.log('Deck:', result.deck || 'N/A');
      
      // Check description
      console.log('\nDescription:');
      if (result.description) {
        const cleanDesc = result.description.replace(/<[^>]*>/g, '').trim();
        console.log('  Present:', cleanDesc.substring(0, 150) + '...');
        console.log('  Length:', cleanDesc.length, 'characters');
      } else {
        console.log('  NOT PRESENT');
      }
      
      // Check genres
      console.log('\nGenres:');
      if (result.genres && result.genres.length > 0) {
        console.log('  Present:', result.genres.map((g: any) => g.name || g).join(', '));
      } else if (result.genres) {
        console.log('  Empty array');
      } else {
        console.log('  NOT PRESENT');
      }
      
      // Check person credits
      console.log('\nPerson Credits (Authors/Artists):');
      if (result.person_credits && result.person_credits.length > 0) {
        console.log('  Found', result.person_credits.length, 'credits');
        result.person_credits.slice(0, 5).forEach((credit: any) => {
          console.log(`    - ${credit.name} (${credit.role || 'Unknown role'})`);
        });
      } else if (result.person_credits) {
        console.log('  Empty array');
      } else {
        console.log('  NOT PRESENT');
      }
      
      // Check characters
      console.log('\nCharacters:');
      if (result.characters && result.characters.length > 0) {
        console.log('  Found', result.characters.length, 'characters');
        result.characters.slice(0, 5).forEach((char: any) => {
          console.log(`    - ${char.name}`);
        });
      } else if (result.characters) {
        console.log('  Empty array');
      } else {
        console.log('  NOT PRESENT');
      }
      
      // Check what fields are actually present
      console.log('\nAll fields in response:');
      const fields = Object.keys(result);
      console.log('  ', fields.join(', '));
      
      // Check for any nested data
      console.log('\nField types:');
      fields.forEach(field => {
        const value = result[field];
        const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
        console.log(`  ${field}: ${type}`);
      });
    });
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('Invalid API key. Please check your COMICVINE_API_KEY in .env');
    }
  }
}

testComicVineAPI().catch(console.error);