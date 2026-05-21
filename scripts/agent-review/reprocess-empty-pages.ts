/**
 * Reprocess Empty Pages
 *
 * Finds pages with 0 tokens and triggers reprocessing with refetch via the API.
 * Run with: npx ts-node scripts/agent-review/reprocess-empty-pages.ts [limit]
 *
 * Requires: Dev server running on localhost:3000 with FlareSolverr configured
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api/trpc/annotation.reprocess';

function log(message: string): void {
  process.stdout.write(`[reprocess] ${message}\n`);
}

interface ReprocessResult {
  result: {
    data: {
      json: {
        id: string;
        url: string;
        tokens: unknown[];
      };
    };
  };
}

async function reprocessPage(pageId: string): Promise<{ success: boolean; tokenCount?: number; error?: string }> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: { id: pageId, refetch: true },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    const result = (await response.json()) as ReprocessResult;
    const tokens = result.result?.data?.json?.tokens;
    const tokenCount = Array.isArray(tokens) ? tokens.length : 0;

    return { success: true, tokenCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const limit = parseInt(process.argv[2] ?? '10', 10);
  log(`Finding up to ${limit} empty pages for Vinland Saga...`);

  // Find empty pages
  const emptyPages = await prisma.annotatedPage.findMany({
    where: {
      mangaTitle: 'Vinland Saga',
      tokens: { equals: [] },
    },
    select: { id: true, url: true },
    take: limit,
  });

  log(`Found ${emptyPages.length} empty pages`);

  if (emptyPages.length === 0) {
    log('No empty pages to process');
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const page of emptyPages) {
    log(`\nReprocessing: ${page.url}`);
    const result = await reprocessPage(page.id);

    if (result.success) {
      success++;
      log(`  Success: ${result.tokenCount} tokens`);
    } else {
      failed++;
      log(`  Failed: ${result.error}`);
    }

    // Small delay between requests to avoid overwhelming FlareSolverr
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  log('\n=== Summary ===');
  log(`Processed: ${emptyPages.length}`);
  log(`Success: ${success}`);
  log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
