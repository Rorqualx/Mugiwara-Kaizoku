/**
 * Provider Matching Service Example
 *
 * This example demonstrates how to use the ProviderMatchingService to:
 * 1. Find matches across multiple manga providers
 * 2. Match manga between specific providers
 * 3. Get enriched metadata by combining data from multiple sources
 *
 * Run with: npx tsx src/examples/provider-matching-example.ts
 */

import type { ProviderMatchResult } from '@/server/services/metadata/provider-matching/types-and-utils';
import { ProviderMatchingService } from '@/server/services/metadata/providerMatchingService';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

// Example configuration for metadata providers
const metadataConfig = {
  providerConfigs: {
    anilist: {
      enabled: true,
      apiUrl: 'https://graphql.anilist.co',
      throttleMs: 1000
    },
    wikipedia: {
      enabled: true,
      apiUrl: 'https://en.wikipedia.org/w/api.php',
      throttleMs: 500
    },
    comicvine: {
      enabled: false, // Requires API key
      apiKey: process.env["COMICVINE_API_KEY"] ?? '',
      apiEndpoint: 'https://comicvine.gamespot.com/api',
      throttleMs: 1000
    },
    fandom: {
      enabled: true,
      wikiDomain: 'onepiece.fandom.com',
      throttleMs: 1000
    }
  }
};

// Example matching configuration
const matchingConfig = {
  minScore: 0.1, // Low threshold for more lenient matching
  weights: {
    exact: 1.0,
    partial: 0.8,
    alternative: 0.7,
    pattern: 0.6
  },
  fetchMetadata: true,
  mergeMetadata: true
};

// Helper function to log separator
function logSeparator(): void {
  logger.info('\n' + '='.repeat(50) + '\n');
}

// Helper function to log match details
function logMatchDetails(match: ProviderMatchResult, index: number): void {
  logger.info(`\n${index + 1}. ${match.provider}:`);
  logger.info(`   ID: ${match.providerId}`);

  const matchData = match as unknown as Record<string, unknown>;
  const title = matchData['title'];
  if (typeof title === 'string') {
    logger.info(`   Title: ${title}`);
  }
  logger.info(`   Confidence: ${(match.confidence * 100).toFixed(1)}%`);

  const metadata = matchData['metadata'];
  if (metadata && typeof metadata === 'object') {
    const metadataObj = metadata as Record<string, unknown>;
    const description = metadataObj['description'];
    if (typeof description === 'string') {
      logger.info(`   Description: ${description.substring(0, 100)}...`);
    }

    const authors = metadataObj['authors'];
    if (Array.isArray(authors)) {
      logger.info(`   Authors: ${authors.join(', ')}`);
    } else {
      logger.info('   Authors: N/A');
    }

    const genres = metadataObj['genres'];
    if (Array.isArray(genres)) {
      logger.info(`   Genres: ${genres.join(', ')}`);
    } else {
      logger.info('   Genres: N/A');
    }
  }
}

// Example 1: Cross-provider matching
async function demonstrateCrossProviderMatching(service: ProviderMatchingService): Promise<void> {
  logger.info('1. Cross-Provider Matching');
  logger.info('Searching for "One Piece" across all providers...\n');

  const crossProviderResult = await service.findCrossProviderMatches('One Piece');

  if (isSuccess(crossProviderResult)) {
    const data = crossProviderResult.data;
    logger.info(`Found ${data.matches.length} matches:`);

    data.matches.forEach((match, index) => {
      logMatchDetails(match, index);
    });

    if (data.bestMatch) {
      const bestMatchData = data.bestMatch as unknown as Record<string, unknown>;
      const bestTitle = bestMatchData['title'];
      logger.info(`\n✓ Best match: ${data.bestMatch.provider} - "${typeof bestTitle === 'string' ? bestTitle : 'Unknown'}"`);
    }

    if (data.mergedMetadata) {
      const mergedData = data.mergedMetadata as unknown as Record<string, unknown>;
      logger.info('\n📊 Merged Metadata:');

      const mergedTitle = mergedData['title'];
      if (typeof mergedTitle === 'string') {
        logger.info(`   Title: ${mergedTitle}`);
      }

      const publisher = mergedData['publisher'];
      logger.info(`   Publisher: ${typeof publisher === 'string' ? publisher : 'Unknown'}`);

      const authors = mergedData['authors'];
      logger.info(`   Total authors: ${Array.isArray(authors) ? authors.length : 0}`);

      const genres = mergedData['genres'];
      logger.info(`   Total genres: ${Array.isArray(genres) ? genres.length : 0}`);

      const coverUrl = mergedData['coverUrl'];
      logger.info(`   Has cover: ${coverUrl ? 'Yes' : 'No'}`);

      const bannerImage = mergedData['bannerImage'];
      logger.info(`   Has banner: ${bannerImage ? 'Yes' : 'No'}`);
    }
  } else if (isError(crossProviderResult)) {
    console.error('Error in cross-provider matching:', crossProviderResult.error instanceof Error ? crossProviderResult.error.message : String(crossProviderResult.error));
  }
}

// Example 2: Provider-to-provider matching
async function demonstrateProviderToProviderMatching(service: ProviderMatchingService): Promise<void> {
  logger.info('2. Provider-to-Provider Matching');
  logger.info('Finding ComicVine match for "Attack on Titan" from AniList...\n');

  const providerMatchResult = await service.findProviderToProviderMatch(
    'Attack on Titan',
    'anilist',
    'comicvine'
  );

  if (isSuccess(providerMatchResult) && providerMatchResult.data) {
    const match = providerMatchResult.data;
    const matchData = match as unknown as Record<string, unknown>;

    logger.info('✓ Found match on ComicVine:');
    logger.info(`   ID: ${match.providerId}`);

    const title = matchData['title'];
    if (typeof title === 'string') {
      logger.info(`   Title: ${title}`);
    }
    logger.info(`   Confidence: ${(match.confidence * 100).toFixed(1)}%`);

    const metadata = matchData['metadata'];
    if (metadata && typeof metadata === 'object') {
      const metadataObj = metadata as Record<string, unknown>;

      const alternativeTitles = metadataObj['alternativeTitles'];
      if (Array.isArray(alternativeTitles)) {
        logger.info(`   Alternative titles: ${alternativeTitles.join(', ')}`);
      } else {
        logger.info('   Alternative titles: None');
      }

      const status = metadataObj['status'];
      if (typeof status === 'string') {
        logger.info(`   Status: ${status}`);
      }
    }
  } else {
    logger.info('No match found on ComicVine');
  }
}

// Example 3: Enriched metadata
async function demonstrateEnrichedMetadata(service: ProviderMatchingService): Promise<void> {
  logger.info('3. Enriched Metadata');
  logger.info('Getting enriched metadata for a manga...\n');

  // Assuming we have an AniList ID for "My Hero Academia"
  const enrichedResult = await service.getEnrichedMetadata(
    '85486', // Example AniList ID
    'anilist',
    'My Hero Academia'
  );

  if (isSuccess(enrichedResult) && enrichedResult.data) {
    const metadataObj = enrichedResult.data as unknown as Record<string, unknown>;
    logger.info('✓ Enriched metadata retrieved:');

    const title = metadataObj['title'];
    if (typeof title === 'string') {
      logger.info(`   Title: ${title}`);
    }

    const publisher = metadataObj['publisher'];
    logger.info(`   Publisher: ${typeof publisher === 'string' ? publisher : 'Unknown'}`);

    const description = metadataObj['description'];
    logger.info(`   Description length: ${typeof description === 'string' ? description.length : 0} chars`);

    const authors = metadataObj['authors'];
    if (Array.isArray(authors)) {
      logger.info(`   Authors: ${authors.join(', ')}`);
    } else {
      logger.info('   Authors: N/A');
    }

    const artists = metadataObj['artists'];
    if (Array.isArray(artists)) {
      logger.info(`   Artists: ${artists.join(', ')}`);
    } else {
      logger.info('   Artists: N/A');
    }

    const genres = metadataObj['genres'];
    if (Array.isArray(genres)) {
      logger.info(`   Genres: ${genres.join(', ')}`);
    } else {
      logger.info('   Genres: N/A');
    }

    const tags = metadataObj['tags'];
    if (Array.isArray(tags)) {
      const tagSlice = tags.slice(0, 5);
      logger.info(`   Tags: ${tagSlice.join(', ')}${tags.length > 5 ? '...' : ''}`);
    } else {
      logger.info('   Tags: N/A');
    }

    const year = metadataObj['year'];
    logger.info(`   Year: ${typeof year === 'number' || typeof year === 'string' ? year : 'N/A'}`);

    const status = metadataObj['status'];
    logger.info(`   Status: ${typeof status === 'string' ? status : 'None'}`);
  } else {
    logger.info('Could not retrieve enriched metadata');
  }
}

// Example 4: Available providers
function demonstrateAvailableProviders(service: ProviderMatchingService): void {
  logger.info('4. Available Providers');
  const providers = service.getAvailableProviders();
  logger.info(`Active providers: ${providers.join(', ')}`);
}

// Example 5: Update configuration
async function demonstrateConfigurationUpdate(service: ProviderMatchingService): Promise<void> {
  logger.info('5. Configuration Update');
  logger.info('Updating to stricter matching criteria...\n');

  service.updateConfig({
    minScore: 0.6, // Increase minimum score
    weights: {
      exact: 1.0,
      partial: 0.5, // Reduce partial match weight
      alternative: 0.4,
      pattern: 0.3
    }
  });

  const strictResult = await service.findCrossProviderMatches('One Piece');

  if (isSuccess(strictResult)) {
    logger.info(`With stricter criteria, found ${strictResult.data.matches.length} matches`);
    const firstMatch = strictResult.data.matches[0];
    if (firstMatch !== undefined) {
      logger.info(`Highest confidence: ${(firstMatch.confidence * 100).toFixed(1)}%`);
    }
  }
}

// Main demonstration function
async function demonstrateProviderMatching(): Promise<void> {
  logger.info('=== Provider Matching Service Demo ===\n');

  // Initialize the service
  const matchingService = new ProviderMatchingService(metadataConfig, matchingConfig);

  await demonstrateCrossProviderMatching(matchingService);
  logSeparator();

  await demonstrateProviderToProviderMatching(matchingService);
  logSeparator();

  await demonstrateEnrichedMetadata(matchingService);
  logSeparator();

  demonstrateAvailableProviders(matchingService);
  logSeparator();

  await demonstrateConfigurationUpdate(matchingService);
}

// Helper function to demonstrate title variations
async function demonstrateTitleVariations(): Promise<void> {
  logger.info('\n=== Title Variation Matching ===\n');

  const matchingService = new ProviderMatchingService(metadataConfig, {
    minScore: 0.1,
    fetchMetadata: false // Skip metadata fetch for speed
  });

  const titleVariations = [
    'One Piece',
    'ONE PIECE',
    'One Piece (manga)',
    'ワンピース',
    'One Piece: Wano Country Arc',
    'OP: One Piece'
  ];

  logger.info('Testing title variations for One Piece:\n');

  // Fix await-in-loop by using Promise.all
  const results = await Promise.all(
    titleVariations.map(async (title) => {
      const result = await matchingService.findCrossProviderMatches(title, {
        providers: ['anilist', 'comicvine'],
        limit: 5
      });
      return { title, result };
    })
  );

  // Process results synchronously
  for (const { title, result } of results) {
    if (isSuccess(result)) {
      const matchCount = result.data.matches.length;
      const bestConfidence = result.data.bestMatch?.confidence ?? 0;
      logger.info(`"${title}" -> ${matchCount} matches, best: ${(bestConfidence * 100).toFixed(1)}%`);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    await demonstrateProviderMatching();
    await demonstrateTitleVariations();

    logger.info('\n✅ Demo completed successfully!');
  } catch (error: unknown) {
    console.error('Demo error:', error);
    process.exit(1);
  }
}

// Run the demo if executed directly
// Note: This check works in CommonJS, in ES modules this would need to be handled differently
void main();
