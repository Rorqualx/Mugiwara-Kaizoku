/**
 * Reprocess annotated pages to update stored labels in the database.
 * Usage: bun scripts/reprocess-pages.ts [pageId1] [pageId2] ...
 */
import { PrismaClient } from '@prisma/client';
import { bootstrapLabels } from '../src/server/ml/training/bootstrap-labeler/index.js';

const prisma = new PrismaClient();

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

async function reprocess(pageId: string): Promise<void> {
  const page = await prisma.annotatedPage.findFirst({
    where: { id: pageId },
    select: { id: true, url: true, htmlSnapshot: true, version: true },
  });
  if (page === null) {
    log(`Page not found: ${pageId}`);
    return;
  }
  log(`Reprocessing: ${page.url}`);
  const result = bootstrapLabels(page.htmlSnapshot, page.url);
  log(`  Tokens: ${result.tokens.length} Labels: ${result.labels.length} Spans: ${result.spans.length}`);
  await prisma.annotatedPage.update({
    where: { id: pageId },
    data: {
      tokens: result.tokens as unknown as string,
      labels: result.labels,
      version: page.version + 1,
      status: 'BOOTSTRAP',
    },
  });
  log(`  Done: ${pageId}`);
}

async function main(): Promise<void> {
  const pageIds = process.argv.slice(2);
  if (pageIds.length === 0) {
    log('Usage: bun scripts/reprocess-pages.ts <pageId1> [pageId2] ...');
    await prisma.$disconnect();
    return;
  }
  for (const id of pageIds) {
    await reprocess(id);
  }
  await prisma.$disconnect();
}

main();
