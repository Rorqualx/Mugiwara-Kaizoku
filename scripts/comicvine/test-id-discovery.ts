/**
 * ComicVine ID Discovery Strategy Tester
 *
 * Tests different strategies for efficiently finding ComicVine volume IDs
 * for manga titles in our test corpus.
 *
 * Strategies to test:
 * 1. Direct title search via ComicVine API
 * 2. Title + publisher filtering
 * 3. Title normalization + search
 * 4. Multi-query with variations
 * 5. Google search fallback
 *
 * Usage:
 *   bun scripts/comicvine/test-id-discovery.ts
 *   bun scripts/comicvine/test-id-discovery.ts --sample 10
 *   bun scripts/comicvine/test-id-discovery.ts --title "One Piece"
 */

import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
  id: number;
  name: string;
  publisher: string | { name: string };
  site_detail_url?: string;
  start_year?: number;
  count_of_issues?: number;
}

interface StrategyResult {
  strategy: string;
  found: boolean;
  volumeId?: number;
  matchConfidence: number; // 0-1
  results?: SearchResult[];
  durationMs: number;
  error?: string;
}

interface TitleTestResult {
  title: string;
  expectedPublisher: string;
  strategies: StrategyResult[];
  bestStrategy?: string;
  bestVolumeId?: number;
  success: boolean;
}

// ComicVine API key would need to be configured
const COMICVINE_API_KEY = process.env.COMICVINE_API_KEY || '';

/**
 * Normalize title for search
 * - Remove special characters
 * - Convert to lowercase
 * - Remove extraneous words
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Generate search variations for a title
 */
function generateSearchVariations(title: string): string[] {
  const variations: string[] = [title];

  // Add normalized version
  const normalized = normalizeTitle(title);
  if (normalized !== title.toLowerCase()) {
    variations.push(normalized);
  }

  // Add title without common suffixes
  const withoutSuffix = title
    .replace(/\s*:.*$/, '') // Remove subtitle after colon
    .replace(/\s*\(.+$/, '') // Remove parenthetical
    .trim();

  if (withoutSuffix !== title) {
    variations.push(withoutSuffix);
    variations.push(normalizeTitle(withoutSuffix));
  }

  return [...new Set(variations)]; // Deduplicate
}

/**
 * Search ComicVine API directly
 */
async function searchComicVineAPI(query: string): Promise<{ results: SearchResult[]; error?: string }> {
  if (!COMICVINE_API_KEY) {
    return { results: [], error: 'No ComicVine API key configured' };
  }

  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    query,
    resources: 'volume',
    field_list: 'id,name,publisher,site_detail_url,start_year,count_of_issues',
    limit: '10',
  });

  try {
    const response = await fetch(`https://comicvine.gamespot.com/api/search?${params}`);
    const data = await response.json();

    if (data.error) {
      return { results: [], error: data.error };
    }

    return { results: data.results || [] };
  } catch (error) {
    return {
      results: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Calculate match confidence between search result and expected title
 */
function calculateMatchConfidence(
  result: SearchResult,
  expectedTitle: string,
  expectedPublisher: string
): number {
  let confidence = 0;

  // Exact name match (high confidence)
  if (result.name.toLowerCase() === expectedTitle.toLowerCase()) {
    confidence += 0.7;
  }
  // Contains name match (medium confidence)
  else if (result.name.toLowerCase().includes(expectedTitle.toLowerCase()) ||
           expectedTitle.toLowerCase().includes(result.name.toLowerCase())) {
    confidence += 0.4;
  }

  // Publisher match (boosts confidence)
  const resultPublisher = typeof result.publisher === 'string'
    ? result.publisher
    : result.publisher?.name || '';

  if (resultPublisher.toLowerCase().includes(expectedPublisher.toLowerCase()) ||
      expectedPublisher.toLowerCase().includes(resultPublisher.toLowerCase())) {
    confidence += 0.3;
  }

  // Resource type check (prefer 4050 volumes over 4000 issues)
  if (result.site_detail_url?.includes('/4050-')) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Test Strategy 1: Direct title search
 */
async function testDirectSearch(title: string): Promise<StrategyResult> {
  const startTime = Date.now();

  const { results, error } = await searchComicVineAPI(title);

  if (error) {
    return {
      strategy: 'Direct Search',
      found: false,
      matchConfidence: 0,
      durationMs: Date.now() - startTime,
      error,
    };
  }

  if (results.length === 0) {
    return {
      strategy: 'Direct Search',
      found: false,
      matchConfidence: 0,
      results,
      durationMs: Date.now() - startTime,
    };
  }

  // Use first result
  const bestMatch = results[0];
  return {
    strategy: 'Direct Search',
    found: true,
    volumeId: bestMatch.id,
    matchConfidence: 0.5, // Base confidence for first result
    results,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Test Strategy 2: Title + Publisher filtering
 */
async function testTitlePublisherSearch(
  title: string,
  publisher: string
): Promise<StrategyResult> {
  const startTime = Date.now();

  const { results, error } = await searchComicVineAPI(title);

  if (error || results.length === 0) {
    return {
      strategy: 'Title + Publisher',
      found: false,
      matchConfidence: 0,
      durationMs: Date.now() - startTime,
      error: error || 'No results',
    };
  }

  // Find best match with publisher
  let bestMatch: SearchResult | null = null;
  let bestConfidence = 0;

  for (const result of results) {
    const confidence = calculateMatchConfidence(result, title, publisher);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = result;
    }
  }

  if (bestMatch && bestConfidence >= 0.7) {
    return {
      strategy: 'Title + Publisher',
      found: true,
      volumeId: bestMatch.id,
      matchConfidence: bestConfidence,
      results,
      durationMs: Date.now() - startTime,
    };
  }

  return {
    strategy: 'Title + Publisher',
    found: false,
    matchConfidence: bestConfidence,
    results,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Test Strategy 3: Multi-query with variations
 */
async function testMultiQuerySearch(title: string): Promise<StrategyResult> {
  const startTime = Date.now();

  const variations = generateSearchVariations(title);
  let allResults: SearchResult[] = [];

  // Try each variation until we find a good match
  for (const variation of variations.slice(0, 3)) { // Limit to 3 variations
    const { results, error } = await searchComicVineAPI(variation);

    if (!error && results.length > 0) {
      allResults = results;

      // If we got exact match, use it
      const exactMatch = results.find(r =>
        r.name.toLowerCase() === title.toLowerCase()
      );

      if (exactMatch) {
        return {
          strategy: 'Multi-Query',
          found: true,
          volumeId: exactMatch.id,
          matchConfidence: 0.9,
          results,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  if (allResults.length > 0) {
    return {
      strategy: 'Multi-Query',
      found: true,
      volumeId: allResults[0].id,
      matchConfidence: 0.6,
      results: allResults,
      durationMs: Date.now() - startTime,
    };
  }

  return {
    strategy: 'Multi-Query',
    found: false,
    matchConfidence: 0,
    results: allResults,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Test all strategies for a single title
 */
async function testTitle(
  title: string,
  publisher: string
): Promise<TitleTestResult> {
  console.log(`\nTesting: ${title} (expected: ${publisher})`);
  console.log('='.repeat(60));

  const strategies: StrategyResult[] = [];

  // Strategy 1: Direct search
  const directResult = await testDirectSearch(title);
  strategies.push(directResult);
  console.log(`  Direct Search: ${directResult.found ? 'FOUND' : 'NOT FOUND'} (${directResult.durationMs}ms)`);
  if (directResult.error) {
    console.log(`    Error: ${directResult.error}`);
  } else if (directResult.results && directResult.results.length > 0) {
    console.log(`    Top result: ${directResult.results[0].name} (ID: ${directResult.results[0].id})`);
  }

  // Strategy 2: Title + Publisher
  const titlePubResult = await testTitlePublisherSearch(title, publisher);
  strategies.push(titlePubResult);
  console.log(`  Title + Publisher: ${titlePubResult.found ? 'FOUND' : 'NOT FOUND'} (${titlePubResult.durationMs}ms)`);
  if (titlePubResult.found) {
    console.log(`    Match confidence: ${(titlePubResult.matchConfidence * 100).toFixed(0)}%`);
  }

  // Strategy 3: Multi-query
  const multiQueryResult = await testMultiQuerySearch(title);
  strategies.push(multiQueryResult);
  console.log(`  Multi-Query: ${multiQueryResult.found ? 'FOUND' : 'NOT FOUND'} (${multiQueryResult.durationMs}ms)`);

  // Determine best result
  const foundStrategies = strategies.filter(s => s.found);
  const success = foundStrategies.length > 0;

  let bestStrategy: string | undefined;
  let bestVolumeId: number | undefined;

  if (success) {
    // Pick the one with highest confidence
    const best = foundStrategies.reduce((best, current) =>
      current.matchConfidence > best.matchConfidence ? current : best
    );
    bestStrategy = best.strategy;
    bestVolumeId = best.volumeId;
  }

  return {
    title,
    expectedPublisher: publisher,
    strategies,
    bestStrategy,
    bestVolumeId,
    success,
  };
}

/**
 * Main function
 */
async function main() {
  console.log('ComicVine ID Discovery Strategy Tester');
  console.log('=====================================\n');

  // Check API key
  if (!COMICVINE_API_KEY) {
    console.error('ERROR: COMICVINE_API_KEY environment variable not set!');
    console.log('Set it with: export COMICVINE_API_KEY=your_key_here');
    process.exit(1);
  }

  // Parse args
  const args = process.argv.slice(2);
  const singleTitleArg = args.find(a => a.startsWith('--title='));
  const sampleArg = args.find(a => a.startsWith('--sample='));

  if (singleTitleArg) {
    // Test single title
    const title = singleTitleArg.split('=')[1];
    await testTitle(title, 'Viz Media');
  } else if (sampleArg) {
    // Test sample of titles
    const sampleSize = parseInt(sampleArg.split('=')[1], 10);
    console.log(`Testing sample of ${sampleSize} titles...\n`);

    // Sample titles from corpus
    const sampleTitles = [
      { title: 'One Piece', publisher: 'Viz Media' },
      { title: 'Naruto', publisher: 'Viz Media' },
      { title: 'Dragon Ball', publisher: 'Viz Media' },
      { title: 'My Hero Academia', publisher: 'Viz Media' },
      { title: 'Demon Slayer', publisher: 'Viz Media' },
      { title: 'Attack on Titan', publisher: 'Kodansha Comics USA' },
      { title: 'Berserk', publisher: 'Dark Horse Comics' },
      { title: 'Sword Art Online', publisher: 'Yen Press' },
      { title: 'Made in Abyss', publisher: 'Seven Seas' },
      { title: 'Fairy Tail', publisher: 'Kodansha Comics USA' },
    ].slice(0, sampleSize);

    const results: TitleTestResult[] = [];

    for (const { title, publisher } of sampleTitles) {
      const result = await testTitle(title, publisher);
      results.push(result);
    }

    // Print summary
    console.log('\n\nSUMMARY');
    console.log('=======');
    const successCount = results.filter(r => r.success).length;
    console.log(`Success rate: ${successCount}/${results.length} (${((successCount / results.length) * 100).toFixed(0)}%)`);

    // Count by strategy
    const strategyCounts: Record<string, number> = {};
    for (const result of results) {
      if (result.bestStrategy) {
        strategyCounts[result.bestStrategy] = (strategyCounts[result.bestStrategy] || 0) + 1;
      }
    }

    console.log('\nBest strategies:');
    for (const [strategy, count] of Object.entries(strategyCounts)) {
      console.log(`  ${strategy}: ${count}`);
    }

    // Average durations
    console.log('\nAverage durations (ms):');
    for (const strategy of ['Direct Search', 'Title + Publisher', 'Multi-Query']) {
      const durations = results
        .map(r => r.strategies.find(s => s.strategy === strategy)?.durationMs)
        .filter((d): d is number => d !== undefined);

      if (durations.length > 0) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        console.log(`  ${strategy}: ${avg.toFixed(0)}ms`);
      }
    }

    // Save results
    const outputPath = path.join(process.cwd(), 'docs/research/comicvine-accuracy/ID_DISCOVERY_RESULTS.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);

  } else {
    console.log('Usage:');
    console.log('  --title="Title Name"  Test a single title');
    console.log('  --sample=N           Test N sample titles');
  }
}

main().catch(console.error);
