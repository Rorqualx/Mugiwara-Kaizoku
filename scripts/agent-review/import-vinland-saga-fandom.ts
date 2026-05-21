/**
 * Import Vinland Saga Fandom Pages via tRPC API
 *
 * Calls the running dev server's batch import endpoint to add Fandom wiki pages.
 * Run with: npx ts-node scripts/agent-review/import-vinland-saga-fandom.ts
 *
 * Requires: Dev server running on localhost:3000
 */

const API_URL = 'http://localhost:3000/api/trpc/annotation.batchImport';

// Vinland Saga Fandom wiki volume URLs (29 volumes)
const VOLUME_URLS = Array.from({ length: 29 }, (_, i) => ({
  url: `https://vinlandsaga.fandom.com/wiki/Volume_${i + 1}`,
  mangaTitle: 'Vinland Saga',
}));

// Chapters and Volumes overview page
const OVERVIEW_URL = {
  url: 'https://vinlandsaga.fandom.com/wiki/Chapters_and_Volumes',
  mangaTitle: 'Vinland Saga',
};

// First 20 chapter URLs as a sample
const CHAPTER_URLS = Array.from({ length: 20 }, (_, i) => ({
  url: `https://vinlandsaga.fandom.com/wiki/Chapter_${i + 1}`,
  mangaTitle: 'Vinland Saga',
}));

function log(message: string): void {
  process.stdout.write(`[import-fandom] ${message}\n`);
}

interface BatchResult {
  result: {
    data: {
      json: {
        results: Array<{ url: string; status: string; pageId?: string; error?: string }>;
        progress: { total: number; completed: number; created: number; skipped: number; failed: number };
      };
    };
  };
}

async function callBatchImport(urls: Array<{ url: string; mangaTitle: string }>, notes: string): Promise<BatchResult> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      json: {
        urls,
        notes,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API call failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<BatchResult>;
}

async function main(): Promise<void> {
  log('Starting Vinland Saga Fandom import...');
  log(`Target: ${API_URL}`);

  // Import in batches (API limit is 50)
  const allUrls = [OVERVIEW_URL, ...VOLUME_URLS, ...CHAPTER_URLS];
  log(`Total URLs to import: ${allUrls.length}`);

  try {
    log('\nImporting overview + volumes + first 20 chapters...');
    const result = await callBatchImport(allUrls, 'Vinland Saga Fandom wiki - volumes and chapters');

    const progress = result.result.data.json.progress;
    log('\n=== Import Complete ===');
    log(`Total: ${progress.total}`);
    log(`Created: ${progress.created}`);
    log(`Skipped (exists): ${progress.skipped}`);
    log(`Failed: ${progress.failed}`);

    // Show failed URLs if any
    const failed = result.result.data.json.results.filter((r) => r.status === 'failed');
    if (failed.length > 0) {
      log('\nFailed URLs:');
      for (const f of failed) {
        log(`  ${f.url}: ${f.error ?? 'Unknown error'}`);
      }
    }
  } catch (error) {
    log(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    log('\nMake sure the dev server is running on localhost:3000');
    log('Run: bun run dev');
    process.exit(1);
  }
}

main();
