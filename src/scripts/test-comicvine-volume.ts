#!/usr/bin/env tsx
/**
 * Test script to fetch detailed ComicVine volume/issue information
 * 
 * This script demonstrates how to fetch individual volume or issue details
 * from ComicVine using the new tRPC endpoint.
 * 
 * Usage:
 *   pnpm tsx src/scripts/test-comicvine-volume.ts
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

import { logger } from '../utils/logger';

import type { AppRouter } from '../server/trpc/root';


// Create a tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  links: [
  httpBatchLink({
    url: 'http://localhost:3000/api/trpc',
    transformer: superjson
  })]

});

/**
 * Log character credits with pagination
 */
function logCharacterCredits(characters: Array<{ id: string; name: string }>): void {
  logger.info(`\n   Characters (${characters.length} total):`);
  characters.slice(0, 5).forEach((char) => {
    logger.info(`   - ${char.name} (ID: ${char.id})`);
  });
  if (characters.length > 5) {
    logger.info(`   ... and ${characters.length - 5} more`);
  }
}

/**
 * Log person credits (creators) with pagination
 */
function logPersonCredits(persons: Array<{ id: string; name: string; role?: string | null }>): void {
  logger.info(`\n   Creators (${persons.length} total):`);
  persons.slice(0, 5).forEach((person) => {
    logger.info(`   - ${person.name}${person.role ? ` (${person.role})` : ''} (ID: ${person.id})`);
  });
  if (persons.length > 5) {
    logger.info(`   ... and ${persons.length - 5} more`);
  }
}

/**
 * Log issue details from ComicVine API response
 */
function logIssueDetails(issue: {
  id: string | number;
  name?: string | null;
  description?: string | null;
  coverDate?: string | null;
  storeDate?: string | null;
  volume?: { id: string; name: string } | null;
  coverImages?: {
    small?: string | null;
    medium?: string | null;
    large?: string | null;
    original?: string | null;
  } | null;
  characterCredits?: Array<{ id: string; name: string }>;
  personCredits?: Array<{ id: string; name: string; role?: string | null }>;
}): void {
  logger.info('\n📖 Issue Details:');
  logger.info(`   ID: ${issue.id}`);
  logger.info(`   Name: ${issue.name ?? 'N/A'}`);
  logger.info(`   Description: ${issue.description ? issue.description.substring(0, 200) + '...' : 'N/A'}`);
  logger.info(`   Cover Date: ${issue.coverDate ?? 'N/A'}`);
  logger.info(`   Store Date: ${issue.storeDate ?? 'N/A'}`);

  if (issue.volume) {
    logger.info(`   Volume: ${issue.volume.name} (ID: ${issue.volume.id})`);
  }

  if (issue.coverImages) {
    logCoverImages(issue.coverImages);
  }

  if (issue.characterCredits && issue.characterCredits.length > 0) {
    logCharacterCredits(issue.characterCredits);
  }

  if (issue.personCredits && issue.personCredits.length > 0) {
    logPersonCredits(issue.personCredits);
  }
}

/**
 * Log cover images from volume or issue data
 */
function logCoverImages(coverImages: {
  small?: string | null;
  medium?: string | null;
  large?: string | null;
  original?: string | null;
}): void {
  logger.info('\n   Cover Images:');
  logger.info(`   - Small: ${coverImages.small ?? 'N/A'}`);
  logger.info(`   - Medium: ${coverImages.medium ?? 'N/A'}`);
  logger.info(`   - Large: ${coverImages.large ?? 'N/A'}`);
  logger.info(`   - Original: ${coverImages.original ?? 'N/A'}`);
}

/**
 * Log volume issues list
 */
function logVolumeIssues(
  issues: Array<{ id: string; issueNumber: string; name?: string | null }>,
  totalCount: number
): void {
  logger.info(`\n   Recent Issues (showing ${issues.length} of ${totalCount}):`);
  issues.forEach((issue) => {
    logger.info(`   - #${issue.issueNumber}: ${issue.name ?? 'Untitled'} (ID: ${issue.id})`);
  });
}

/**
 * Log characters with pagination
 */
function logCharacters(characters: Array<{ id: string; name: string }>): void {
  logger.info(`\n   Main Characters (showing ${characters.length}):`);
  characters.slice(0, 10).forEach((char) => {
    logger.info(`   - ${char.name} (ID: ${char.id})`);
  });
  if (characters.length > 10) {
    logger.info(`   ... and ${characters.length - 10} more`);
  }
}

/**
 * Log creators with pagination
 */
function logCreators(creators: Array<{ id: string; name: string; role?: string | null }>): void {
  logger.info(`\n   Creators (showing ${creators.length}):`);
  creators.slice(0, 10).forEach((creator) => {
    logger.info(`   - ${creator.name}${creator.role ? ` (${creator.role})` : ''} (ID: ${creator.id})`);
  });
  if (creators.length > 10) {
    logger.info(`   ... and ${creators.length - 10} more`);
  }
}

/**
 * Log volume details from ComicVine API response
 */
function logVolumeDetails(volume: {
  id: string | number;
  name?: string | null;
  description?: string | null;
  startYear?: string | null;
  issueCount?: number | null;
  dateAdded?: string | null;
  dateLastUpdated?: string | null;
  publisher?: { id: string; name: string } | null;
  firstIssue?: { issueNumber: string; name?: string | null } | null;
  lastIssue?: { issueNumber: string; name?: string | null } | null;
  coverImages?: {
    small?: string | null;
    medium?: string | null;
    large?: string | null;
    original?: string | null;
  } | null;
  issues?: Array<{ id: string; issueNumber: string; name?: string | null }>;
  characters?: Array<{ id: string; name: string }>;
  creators?: Array<{ id: string; name: string; role?: string | null }>;
}): void {
  logger.info('\n📚 Volume Details:');
  logger.info(`   ID: ${volume.id}`);
  logger.info(`   Name: ${volume.name ?? 'N/A'}`);
  logger.info(`   Description: ${volume.description ? volume.description.substring(0, 200) + '...' : 'N/A'}`);
  logger.info(`   Start Year: ${volume.startYear ?? 'N/A'}`);
  logger.info(`   Issue Count: ${volume.issueCount ?? 'N/A'}`);

  if (volume.publisher) {
    logger.info(`   Publisher: ${volume.publisher.name} (ID: ${volume.publisher.id})`);
  }

  if (volume.firstIssue) {
    logger.info(`   First Issue: #${volume.firstIssue.issueNumber} - ${volume.firstIssue.name ?? 'N/A'}`);
  }

  if (volume.lastIssue) {
    logger.info(`   Last Issue: #${volume.lastIssue.issueNumber} - ${volume.lastIssue.name ?? 'N/A'}`);
  }

  logger.info(`   Date Added: ${volume.dateAdded ?? 'N/A'}`);
  logger.info(`   Last Updated: ${volume.dateLastUpdated ?? 'N/A'}`);

  if (volume.coverImages) {
    logCoverImages(volume.coverImages);
  }

  if (volume.issues && volume.issues.length > 0) {
    logVolumeIssues(volume.issues, volume.issueCount ?? 0);
  }

  if (volume.characters && volume.characters.length > 0) {
    logCharacters(volume.characters);
  }

  if (volume.creators && volume.creators.length > 0) {
    logCreators(volume.creators);
  }
}

/**
 * Test fetching Fire Force issue details by URL
 */
async function testIssueDetails(): Promise<void> {
  logger.info('1. Fetching Fire Force Volume 34 (Issue) details...');
  const issueUrl = 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/';

  try {
    const issue = await trpc["metadata"].fetchComicvineVolumeDetails.mutate({
      url: issueUrl
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Test script type bridging
    logIssueDetails(issue as any);
  } catch (error: unknown) {
    logger.info('   ❌ Failed to fetch issue details:', error instanceof Error ? error.message : String(error));
  }

  logger.info('\n' + '='.repeat(60) + '\n');
}

/**
 * Test fetching Fire Force volume (series) details by URL
 */
async function testVolumeDetails(): Promise<void> {
  logger.info('2. Fetching Fire Force Volume (Series) details...');
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force/4050-104877/';

  try {
    const volume = await trpc["metadata"].fetchComicvineVolumeDetails.mutate({
      url: volumeUrl,
      type: 'volume'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Test script type bridging
    logVolumeDetails(volume as any);
  } catch (error: unknown) {
    logger.info('   ❌ Failed to fetch volume details:', error instanceof Error ? error.message : String(error));
  }

  logger.info('\n' + '='.repeat(60) + '\n');
}

/**
 * Test fetching volume details by direct ComicVine ID
 */
async function testDirectId(): Promise<void> {
  logger.info('3. Fetching by direct ComicVine ID (104877 - Fire Force series)...');

  try {
    const volume = await trpc["metadata"].fetchComicvineVolumeDetails.mutate({
      id: '104877',
      type: 'volume'
    });
    const issueCount = 'issueCount' in volume ? (volume.issueCount ?? 0) : 0;
    logger.info(`   ✅ Successfully fetched: ${volume.name ?? 'N/A'} (${issueCount} issues)`);
  } catch (error: unknown) {
    logger.info('   ❌ Failed to fetch by ID:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main test function that orchestrates all ComicVine volume/issue tests
 */
async function testComicVineVolumeDetails(): Promise<void> {
  try {
    logger.info('=== Testing ComicVine Volume/Issue Details Fetching ===\n');

    await testIssueDetails();
    await testVolumeDetails();
    await testDirectId();

    logger.info('\n=== Test Complete ===');
  } catch (error: unknown) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testComicVineVolumeDetails().
then(() => {
  logger.info('\n✅ All tests completed successfully');
  process.exit(0);
}).
catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});