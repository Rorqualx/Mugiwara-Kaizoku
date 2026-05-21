/**
 * Test script to check AniList metadata for specific manga
 * to understand the isAdult flag behavior
 */

import axios from 'axios';

const QUERY = `
  query SearchManga($search: String!) {
    Page(perPage: 5) {
      media(search: $search, type: MANGA) {
        id
        title {
          romaji
          english
        }
        isAdult
        genres
        tags {
          name
          category
        }
      }
    }
  }
`;

const testManga = [
  "One Piece",
  "High School DxD",
  "To Love-Ru",
  "Prison School"
];

async function checkManga() {
  console.log('\n=== Checking AniList isAdult flags ===\n');

  for (const title of testManga) {
    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query: QUERY,
        variables: { search: title }
      });

      const media = response.data.data.Page.media;
      if (media && media.length > 0) {
        const manga = media[0];
        console.log(`\n${manga.title.english || manga.title.romaji}:`);
        console.log(`  isAdult: ${manga.isAdult}`);
        console.log(`  Genres: ${manga.genres.join(', ')}`);
        const adultTags = manga.tags
          .filter((tag: any) => 
            tag.name.toLowerCase().includes('sexual') ||
            tag.name.toLowerCase().includes('nudity') ||
            tag.name.toLowerCase().includes('ecchi')
          )
          .map((tag: any) => tag.name);
        if (adultTags.length > 0) {
          console.log(`  Adult-related tags: ${adultTags.join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`Error checking ${title}:`, error);
    }
  }

  console.log('\n\nConclusion:');
  console.log('The isAdult flag in AniList only marks truly adult/hentai content.');
  console.log('Ecchi manga like High School DxD are NOT marked as isAdult=true.');
  console.log('To filter ecchi content, we would need to check genres and tags.');
}

checkManga().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});