/**
 * MAL (MyAnimeList) Client via Jikan API
 *
 * Fetches manga metadata from MAL using the free Jikan proxy API.
 * No authentication required. Rate limit: 3 requests/second.
 *
 * @module scripts/mangadex/mal-client
 */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4/manga/';

const MAL_STATUS_MAP: Record<string, string> = {
  'Publishing': 'RELEASING',
  'Finished': 'FINISHED',
  'On Hiatus': 'HIATUS',
  'Discontinued': 'CANCELLED',
  'Not yet published': 'NOT_YET_RELEASED',
};

export interface MALResult {
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  chapters: number | null;
  volumes: number | null;
  status: string;
  score: number | null;
}

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

interface JikanMangaResponse {
  data?: {
    mal_id?: number;
    title?: string;
    title_english?: string | null;
    title_japanese?: string | null;
    chapters?: number | null;
    volumes?: number | null;
    status?: string;
    score?: number | null;
  };
}

/** Build a validated Jikan URL for a given MAL ID */
function buildJikanUrl(malId: number): string {
  if (!Number.isInteger(malId) || malId <= 0) throw new Error(`Invalid MAL ID: ${malId}`);
  return `${JIKAN_BASE_URL}${malId}`;
}

export async function fetchMALData(malId: number, retries = 3): Promise<MALResult | null> {
  const url = buildJikanUrl(malId);
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const wait = Math.min(10_000, (attempt + 1) * 2_000);
        process.stderr.write(`  [Jikan 429, retry in ${wait / 1000}s]\n`);
        await delay(wait);
        continue;
      }
      if (!resp.ok) return null;
      const json = (await resp.json()) as JikanMangaResponse;
      const d = json.data;
      if (!d) return null;
      return {
        malId: d.mal_id ?? malId,
        title: d.title ?? 'Unknown',
        titleEnglish: d.title_english ?? null,
        titleJapanese: d.title_japanese ?? null,
        chapters: d.chapters ?? null,
        volumes: d.volumes ?? null,
        status: MAL_STATUS_MAP[d.status ?? ''] ?? 'UNKNOWN',
        score: d.score ?? null,
      };
    } catch {
      if (attempt < retries - 1) await delay(1000);
    }
  }
  return null;
}
