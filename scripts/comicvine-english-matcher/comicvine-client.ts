/**
 * ComicVine API client with English preference scoring
 */

import { detectNonEnglishVariant, isEnglishPublisher } from './language-filter';
import type { AlternativeTitles, ComicVineAPIResponse, ComicVineMatch, ComicVineSearchResult } from './types';
import { calculateSimilarity, normalizeTitle, println, sleep } from './utils';

const COMICVINE_API = 'https://comicvine.gamespot.com/api';
const MIN_SIMILARITY = 0.4;

// Get API key from environment variable (required)
function getApiKey(): string {
  const key = process.env.COMICVINE_API_KEY;
  if (!key) {
    process.stderr.write('ERROR: COMICVINE_API_KEY environment variable is required.\n');
    process.stderr.write('Get your free API key at: https://comicvine.gamespot.com/api/\n');
    process.stderr.write('Then run: COMICVINE_API_KEY=your-key bun run scripts/comicvine-english-matcher/index.ts\n');
    process.exit(1);
  }
  return key;
}

const COMICVINE_API_KEY: string = getApiKey();

// Rate limit state
let comicVineRateLimited = false;
let comicVineRateLimitResetTime = 0;

/**
 * Search ComicVine with English preference scoring
 */
export async function searchComicVineWithEnglishPreference(
  primaryTitle: string,
  alternativeTitles?: AlternativeTitles,
  comicvineDelayMs: number = 18000
): Promise<ComicVineMatch | null> {
  // Skip if currently rate limited
  if (comicVineRateLimited && Date.now() < comicVineRateLimitResetTime) {
    println('  ComicVine still rate limited, skipping...');
    return null;
  }

  // Build search variants
  const searchVariants = buildSearchVariants(primaryTitle, alternativeTitles);
  println(`  Search variants: ${searchVariants.join(' | ')}`);

  // Collect all results from all variants
  const allResults = await collectSearchResults(searchVariants, comicvineDelayMs);

  if (allResults.length === 0) {
    return null;
  }

  // Deduplicate and score results
  const uniqueResults = deduplicateResults(allResults);
  return findBestMatch(uniqueResults, primaryTitle, alternativeTitles?.english);
}

function buildSearchVariants(
  primaryTitle: string,
  alternativeTitles?: AlternativeTitles
): string[] {
  const searchVariants: string[] = [];
  const seenNormalized = new Set<string>();

  const addVariant = (title: string | undefined | null): void => {
    if (!title || typeof title !== 'string') return;
    const trimmed = title.trim();
    if (trimmed.length < 2) return;

    const normalized = normalizeTitle(trimmed);
    if (normalized.length < 2 || seenNormalized.has(normalized)) return;

    seenNormalized.add(normalized);
    searchVariants.push(trimmed);
  };

  // Priority 1: English title (best for US comics DB)
  addVariant(alternativeTitles?.english);

  // Priority 2: Primary title
  addVariant(primaryTitle);

  // Priority 3: Primary without parentheticals
  const cleanPrimary = primaryTitle.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleanPrimary !== primaryTitle) {
    addVariant(cleanPrimary);
  }

  // Priority 4: Romaji title
  addVariant(alternativeTitles?.romaji);

  // Priority 5: First few synonyms
  if (alternativeTitles?.synonyms) {
    for (const synonym of alternativeTitles.synonyms.slice(0, 2)) {
      addVariant(synonym);
    }
  }

  // Limit to 3 variants
  return searchVariants.slice(0, 3);
}

async function collectSearchResults(
  variants: string[],
  delayMs: number
): Promise<ComicVineSearchResult[]> {
  const allResults: ComicVineSearchResult[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    if (!variant) continue;

    const results = await searchComicVineSingle(variant);
    if (results) {
      allResults.push(...results);
    }

    // Delay between variant searches (except last)
    if (i < variants.length - 1) {
      await sleep(delayMs);
    }
  }

  return allResults;
}

function deduplicateResults(results: ComicVineSearchResult[]): ComicVineSearchResult[] {
  const seenIds = new Set<number>();
  const unique: ComicVineSearchResult[] = [];

  for (const result of results) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      unique.push(result);
    }
  }

  return unique;
}

function findBestMatch(
  results: ComicVineSearchResult[],
  primaryTitle: string,
  englishTitle?: string | null
): ComicVineMatch | null {
  let bestMatch: ComicVineMatch | null = null;
  let bestScore = 0;

  for (const result of results) {
    const resultName = result.name ?? '';
    const publisher = result.publisher?.name;

    // Calculate base similarity
    let similarity = calculateSimilarity(primaryTitle, resultName);
    if (englishTitle) {
      const englishSimilarity = calculateSimilarity(englishTitle, resultName);
      similarity = Math.max(similarity, englishSimilarity);
    }

    // Apply scoring adjustments
    let score = similarity;
    const isNonEnglish = detectNonEnglishVariant(resultName, publisher);

    if (isNonEnglish) {
      score *= 0.7; // 30% penalty
      println(`    "${resultName}" [${publisher ?? 'no publisher'}] - non-English penalty`);
    }

    if (isEnglishPublisher(publisher)) {
      score *= 1.2; // 20% boost
      println(`    "${resultName}" [${publisher}] - English publisher boost`);
    }

    if (score > bestScore && similarity >= MIN_SIMILARITY) {
      bestScore = score;
      bestMatch = {
        id: result.id,
        name: resultName,
        publisher: publisher ?? null,
        url: result.site_detail_url ?? null,
        similarity,
        isEnglish: !isNonEnglish,
      };
    }
  }

  return bestMatch;
}

async function searchComicVineSingle(query: string): Promise<ComicVineSearchResult[] | null> {
  try {
    const url = new URL(`${COMICVINE_API}/search/`);
    url.searchParams.set('api_key', COMICVINE_API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('query', query);
    url.searchParams.set('resources', 'volume');
    url.searchParams.set('limit', '10');
    url.searchParams.set('field_list', 'id,name,publisher,site_detail_url,start_year,count_of_issues');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)',
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      println('  ComicVine rate limited (HTTP 429), waiting 10 min...');
      comicVineRateLimited = true;
      comicVineRateLimitResetTime = Date.now() + 600000;
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      println('  ComicVine API key invalid');
      return null;
    }

    const data = (await response.json()) as ComicVineAPIResponse;

    if (data.status_code === 107) {
      println('  ComicVine rate limited (status 107), waiting 10 min...');
      comicVineRateLimited = true;
      comicVineRateLimitResetTime = Date.now() + 600000;
      return null;
    }

    comicVineRateLimited = false;
    return data.results ?? null;
  } catch (error) {
    println(`  ComicVine search error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
