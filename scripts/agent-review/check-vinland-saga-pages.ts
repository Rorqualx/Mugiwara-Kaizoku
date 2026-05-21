/**
 * Check Vinland Saga pages status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function log(message: string): void {
  process.stdout.write(message + '\n');
}

async function checkPages(): Promise<void> {
  const pages = await prisma.annotatedPage.findMany({
    where: { mangaTitle: 'Vinland Saga' },
    select: { id: true, url: true, sourceType: true, status: true, tokens: true },
    orderBy: { url: 'asc' },
  });

  const summary = {
    total: pages.length,
    bySource: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    emptyPages: 0,
  };

  const emptyPageUrls: string[] = [];

  for (const p of pages) {
    summary.bySource[p.sourceType] = (summary.bySource[p.sourceType] ?? 0) + 1;
    summary.byStatus[p.status] = (summary.byStatus[p.status] ?? 0) + 1;
    const tokens = p.tokens as unknown[];
    if (!tokens || tokens.length === 0) {
      summary.emptyPages++;
      emptyPageUrls.push(p.url);
    }
  }

  log('=== Vinland Saga Pages Summary ===');
  log(`Total: ${summary.total}`);
  log('\nBy Source:');
  for (const [source, count] of Object.entries(summary.bySource)) {
    log(`  ${source}: ${count}`);
  }
  log('\nBy Status:');
  for (const [status, count] of Object.entries(summary.byStatus)) {
    log(`  ${status}: ${count}`);
  }
  log(`\nPages with 0 tokens: ${summary.emptyPages}`);
  if (emptyPageUrls.length > 0) {
    log('\nEmpty pages (need scraping):');
    for (const url of emptyPageUrls) {
      log(`  ${url}`);
    }
  }

  await prisma.$disconnect();
}

checkPages().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
