#!/usr/bin/env node

/**
 * Test script to audit AniList search data for Fire Force
 * This script searches for Fire Force and displays all available data fields
 */

import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';

async function searchFireForce() {
  console.log('🔍 Searching for Fire Force on AniList...\n');
  
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: MANGA) {
          id
          title {
            romaji
            english
            native
          }
          description
          coverImage {
            large
            medium
          }
          bannerImage
          status
          chapters
          volumes
          format
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          synonyms
          tags {
            id
            name
            rank
            isMediaSpoiler
            isAdult
          }
          isAdult
          averageScore
          popularity
          countryOfOrigin
          staff {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
              }
            }
          }
          characters {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
              }
            }
          }
          externalLinks {
            id
            url
            site
            type
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      ANILIST_API_URL,
      {
        query,
        variables: { search: 'Fire Force' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
    );

    const results = response.data.data.Page.media;
    
    if (results.length === 0) {
      console.log('❌ No results found for Fire Force');
      return;
    }

    console.log(`✅ Found ${results.length} results for Fire Force\n`);

    // Display detailed information for each result
    results.forEach((manga, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Result ${index + 1}:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Basic Info
      console.log('\n📚 Basic Information:');
      console.log(`  ID: ${manga.id}`);
      console.log(`  Title (Romaji): ${manga.title.romaji || 'N/A'}`);
      console.log(`  Title (English): ${manga.title.english || 'N/A'}`);
      console.log(`  Title (Native): ${manga.title.native || 'N/A'}`);
      console.log(`  Format: ${manga.format || 'N/A'}`);
      console.log(`  Status: ${manga.status || 'N/A'}`);
      console.log(`  Adult Content: ${manga.isAdult ? 'Yes' : 'No'}`);
      console.log(`  Country of Origin: ${manga.countryOfOrigin || 'N/A'}`);
      
      // Volume/Chapter Info
      console.log('\n📖 Volume/Chapter Information:');
      console.log(`  Volumes: ${manga.volumes || 'Unknown'}`);
      console.log(`  Chapters: ${manga.chapters || 'Unknown'}`);
      
      // Dates
      console.log('\n📅 Dates:');
      if (manga.startDate) {
        const start = `${manga.startDate.year || '??'}/${manga.startDate.month || '??'}/${manga.startDate.day || '??'}`;
        console.log(`  Start Date: ${start}`);
      } else {
        console.log(`  Start Date: Unknown`);
      }
      
      if (manga.endDate) {
        const end = `${manga.endDate.year || '??'}/${manga.endDate.month || '??'}/${manga.endDate.day || '??'}`;
        console.log(`  End Date: ${end}`);
      } else {
        console.log(`  End Date: Not ended or unknown`);
      }
      
      // Popularity
      console.log('\n🌟 Popularity:');
      console.log(`  Average Score: ${manga.averageScore || 'N/A'}/100`);
      console.log(`  Popularity: ${manga.popularity || 'N/A'}`);
      
      // Cover Images
      console.log('\n🖼️  Cover Images:');
      console.log(`  Large: ${manga.coverImage?.large || 'N/A'}`);
      console.log(`  Medium: ${manga.coverImage?.medium || 'N/A'}`);
      console.log(`  Banner: ${manga.bannerImage || 'N/A'}`);
      
      // Genres
      if (manga.genres && manga.genres.length > 0) {
        console.log('\n🏷️  Genres:');
        manga.genres.forEach(genre => {
          console.log(`  - ${genre}`);
        });
      }
      
      // Synonyms
      if (manga.synonyms && manga.synonyms.length > 0) {
        console.log('\n🔄 Alternative Titles:');
        manga.synonyms.forEach(synonym => {
          console.log(`  - ${synonym}`);
        });
      }
      
      // Tags
      if (manga.tags && manga.tags.length > 0) {
        console.log('\n🏷️  Tags (Top 10):');
        manga.tags.slice(0, 10).forEach(tag => {
          console.log(`  - ${tag.name} (Rank: ${tag.rank}${tag.isAdult ? ', Adult' : ''}${tag.isMediaSpoiler ? ', Spoiler' : ''})`);
        });
      }
      
      // Staff
      if (manga.staff && manga.staff.edges && manga.staff.edges.length > 0) {
        console.log('\n👥 Staff:');
        manga.staff.edges.forEach(edge => {
          console.log(`  - ${edge.node.name.full || edge.node.name.native} (${edge.role})`);
        });
      }
      
      // External Links
      if (manga.externalLinks && manga.externalLinks.length > 0) {
        console.log('\n🔗 External Links:');
        manga.externalLinks.forEach(link => {
          console.log(`  - ${link.site}: ${link.url}`);
        });
      }
      
      // Description (truncated)
      if (manga.description) {
        console.log('\n📝 Description:');
        const cleanDesc = manga.description.replace(/<[^>]*>/g, '').trim();
        const truncated = cleanDesc.length > 200 ? cleanDesc.substring(0, 200) + '...' : cleanDesc;
        console.log(`  ${truncated}`);
      }
      
      console.log('\n');
    });
    
    // Summary of available data
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('📊 DATA AVAILABILITY SUMMARY:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const firstResult = results[0];
    console.log('\nAvailable fields with data:');
    const fields = [
      ['ID', !!firstResult.id],
      ['Title (Romaji)', !!firstResult.title.romaji],
      ['Title (English)', !!firstResult.title.english],
      ['Title (Native)', !!firstResult.title.native],
      ['Description', !!firstResult.description],
      ['Cover Images', !!firstResult.coverImage],
      ['Banner Image', !!firstResult.bannerImage],
      ['Status', !!firstResult.status],
      ['Chapters', !!firstResult.chapters],
      ['Volumes', !!firstResult.volumes],
      ['Format', !!firstResult.format],
      ['Start Date', !!firstResult.startDate],
      ['End Date', !!firstResult.endDate],
      ['Genres', firstResult.genres && firstResult.genres.length > 0],
      ['Synonyms', firstResult.synonyms && firstResult.synonyms.length > 0],
      ['Tags', firstResult.tags && firstResult.tags.length > 0],
      ['Average Score', !!firstResult.averageScore],
      ['Popularity', !!firstResult.popularity],
      ['Country of Origin', !!firstResult.countryOfOrigin],
      ['Staff', firstResult.staff && firstResult.staff.edges && firstResult.staff.edges.length > 0],
      ['Characters', firstResult.characters && firstResult.characters.edges && firstResult.characters.edges.length > 0],
      ['External Links', firstResult.externalLinks && firstResult.externalLinks.length > 0],
    ];
    
    fields.forEach(([field, hasData]) => {
      console.log(`  ${field}: ${hasData ? '✅ Available' : '❌ Not Available'}`);
    });
    
  } catch (error) {
    console.error('❌ Error searching AniList:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
searchFireForce();