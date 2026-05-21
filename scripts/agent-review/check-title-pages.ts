/**
 * Check annotated pages status for any manga title
 *
 * Usage: bunx ts-node scripts/agent-review/check-title-pages.ts "<manga-title>"
 *
 * Example: bunx ts-node scripts/agent-review/check-title-pages.ts "Vinland Saga"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function log(message: string): void {
  process.stdout.write(message + '\n');
}

function getSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PageSummary {
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  emptyPages: number;
  avgTokensPerPage: number;
}

async function checkPages(mangaTitle: string): Promise<PageSummary> {
  const pages = await prisma.annotatedPage.findMany({
    where: { mangaTitle },
    select: {
      id: true,
      url: true,
      sourceType: true,
      status: true,
      tokens: true,
    },
    orderBy: { url: 'asc' },
  });

  if (pages.length === 0) {
    log(`\nNo pages found for "${mangaTitle}"`);
    log('Tip: Check the exact mangaTitle in the database or try a different spelling.');
    return {
      total: 0,
      bySource: {},
      byStatus: {},
      emptyPages: 0,
      avgTokensPerPage: 0,
    };
  }

  const summary: PageSummary = {
    total: pages.length,
    bySource: {},
    byStatus: {},
    emptyPages: 0,
    avgTokensPerPage: 0,
  };

  const emptyPageUrls: string[] = [];
  let totalTokens = 0;

  for (const p of pages) {
    summary.bySource[p.sourceType] = (summary.bySource[p.sourceType] ?? 0) + 1;
    summary.byStatus[p.status] = (summary.byStatus[p.status] ?? 0) + 1;
    const tokens = p.tokens as unknown[];
    const tokenCount = tokens?.length ?? 0;
    totalTokens += tokenCount;
    if (!tokens || tokenCount === 0) {
      summary.emptyPages++;
      emptyPageUrls.push(p.url);
    }
  }

  summary.avgTokensPerPage = Math.round(totalTokens / pages.length);

  const slug = getSlug(mangaTitle);
  log(`\n=== ${mangaTitle} Pages Summary ===`);
  log(`Slug: ${slug}`);
  log(`Total: ${summary.total}`);
  log(`Average tokens per page: ${summary.avgTokensPerPage}`);

  log('\nBy Source:');
  for (const [source, count] of Object.entries(summary.bySource)) {
    log(`  ${source}: ${count}`);
  }

  log('\nBy Status:');
  for (const [status, count] of Object.entries(summary.byStatus)) {
    log(`  ${status}: ${count}`);
  }

  log(`\nPages with 0 tokens: ${summary.emptyPages}`);
  if (emptyPageUrls.length > 0 && emptyPageUrls.length <= 10) {
    log('\nEmpty pages (need scraping):');
    for (const url of emptyPageUrls) {
      log(`  ${url}`);
    }
  } else if (emptyPageUrls.length > 10) {
    log(`\n(${emptyPageUrls.length} empty pages - run with verbose flag to see all)`);
  }

  return summary;
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];

  if (!mangaTitle) {
    log('Usage: bunx ts-node scripts/agent-review/check-title-pages.ts "<manga-title>"');
    log('');
    log('Example:');
    log('  bunx ts-node scripts/agent-review/check-title-pages.ts "Vinland Saga"');
    log('  bunx ts-node scripts/agent-review/check-title-pages.ts "One Piece"');
    process.exit(1);
  }

  try {
    await checkPages(mangaTitle);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
