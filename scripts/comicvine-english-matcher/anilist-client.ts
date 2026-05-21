/**
 * AniList API client for fetching alternative titles
 */

import type { AniListMedia } from './types';
import { println, sleep } from './utils';

const ANILIST_API = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title {
      english
      romaji
      native
    }
    synonyms
  }
}
`;

export async function fetchAniListTitles(anilistId: number): Promise<AniListMedia | null> {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { id: anilistId },
      }),
    });

    if (response.status === 429) {
      println('  AniList rate limited, waiting 60s...');
      await sleep(60000);
      return fetchAniListTitles(anilistId);
    }

    if (!response.ok) {
      println(`  AniList error: ${response.status}`);
      return null;
    }

    const json = (await response.json()) as { data?: { Media?: AniListMedia } };
    return json.data?.Media ?? null;
  } catch (error) {
    println(`  AniList fetch error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
