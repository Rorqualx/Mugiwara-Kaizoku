/**
 * Export annotated page labels for any manga title
 *
 * Usage: bunx ts-node scripts/agent-review/export-title-labels.ts "<manga-title>" [limit] [status]
 *
 * Example:
 *   bunx ts-node scripts/agent-review/export-title-labels.ts "Vinland Saga" 100
 *   bunx ts-node scripts/agent-review/export-title-labels.ts "One Piece" 50 AGENT_REVIEWED
 */

import * as fs from 'fs';
import * as path from 'path';

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

interface ExportedToken {
  index: number;
  text: string;
  label: string;
}

interface ExportedPage {
  id: string;
  url: string;
  sourceType: string;
  status: string;
  confidence: number | null;
  tokenCount: number;
  tokens: ExportedToken[];
  labelSummary: Record<string, number>;
}

interface ExportResult {
  title: string;
  slug: string;
  exportedAt: string;
  statusFilter: string;
  totalPages: number;
  pages: ExportedPage[];
  aggregatedLabels: Record<string, LabelAggregate>;
}

interface LabelAggregate {
  entityType: string;
  totalCount: number;
  samples: Array<{ text: string; url: string }>;
}

interface PageData {
  id: string;
  url: string;
  sourceType: string;
  status: string;
  tokens: unknown;
  labels: unknown;
  confidence: number | null;
}

function addSampleToAggregate(
  aggregate: LabelAggregate,
  text: string,
  url: string
): void {
  if (aggregate.samples.length >= 5) return;
  if (text.length === 0) return;
  const alreadyExists = aggregate.samples.some((s) => s.text === text);
  if (alreadyExists) return;
  aggregate.samples.push({ text, url });
}

function processPageLabels(
  page: PageData,
  aggregatedLabels: Record<string, LabelAggregate>
): ExportedPage {
  const tokens = page.tokens as Array<{ text?: string }>;
  const labels = page.labels as string[];
  const labelSummary: Record<string, number> = {};

  const exportedTokens: ExportedToken[] = tokens.map((t, i) => {
    const label = labels[i] ?? 'O';
    const text = t.text ?? '';

    if (label.startsWith('B-')) {
      const entityType = label.substring(2);
      labelSummary[entityType] = (labelSummary[entityType] ?? 0) + 1;

      if (!aggregatedLabels[entityType]) {
        aggregatedLabels[entityType] = { entityType, totalCount: 0, samples: [] };
      }
      aggregatedLabels[entityType].totalCount++;
      addSampleToAggregate(aggregatedLabels[entityType], text, page.url);
    }

    return { index: i, text, label };
  });

  return {
    id: page.id,
    url: page.url,
    sourceType: page.sourceType,
    status: page.status,
    confidence: page.confidence,
    tokenCount: tokens.length,
    tokens: exportedTokens,
    labelSummary,
  };
}

async function exportTitleLabels(
  mangaTitle: string,
  limit: number,
  statusFilter?: string
): Promise<ExportResult | null> {
  const whereClause: Record<string, unknown> = { mangaTitle };
  if (statusFilter) {
    whereClause.status = statusFilter;
  }

  const pages = await prisma.annotatedPage.findMany({
    where: whereClause,
    take: limit,
    select: {
      id: true,
      url: true,
      sourceType: true,
      status: true,
      tokens: true,
      labels: true,
      confidence: true,
    },
    orderBy: { url: 'asc' },
  });

  if (pages.length === 0) {
    log(`\nNo pages found for "${mangaTitle}"${statusFilter ? ` with status ${statusFilter}` : ''}`);
    return null;
  }

  log(`[export] Found ${pages.length} pages for "${mangaTitle}"`);

  const slug = getSlug(mangaTitle);
  const aggregatedLabels: Record<string, LabelAggregate> = {};
  const exportedPages = pages.map((page) => processPageLabels(page, aggregatedLabels));

  return {
    title: mangaTitle,
    slug,
    exportedAt: new Date().toISOString(),
    statusFilter: statusFilter ?? 'ALL',
    totalPages: exportedPages.length,
    pages: exportedPages,
    aggregatedLabels,
  };
}

function printUsage(): void {
  log('Usage: bunx ts-node scripts/agent-review/export-title-labels.ts "<manga-title>" [limit] [status]');
  log('');
  log('Arguments:');
  log('  manga-title  The exact manga title as stored in the database');
  log('  limit        Maximum pages to export (default: 50)');
  log('  status       Filter by status: BOOTSTRAP, AGENT_REVIEWED, REVIEWED, GOLD');
  log('');
  log('Example:');
  log('  bunx ts-node scripts/agent-review/export-title-labels.ts "Vinland Saga" 100');
  log('  bunx ts-node scripts/agent-review/export-title-labels.ts "One Piece" 50 BOOTSTRAP');
}

function printLabelSummary(aggregatedLabels: Record<string, LabelAggregate>): void {
  log('\n=== Label Summary ===');
  const sortedLabels = Object.values(aggregatedLabels).sort((a, b) => b.totalCount - a.totalCount);
  for (const label of sortedLabels) {
    log(`  ${label.entityType}: ${label.totalCount} occurrences`);
    if (label.samples.length > 0) {
      const sampleTexts = label.samples.slice(0, 3).map((s) => `"${s.text}"`);
      log(`    Samples: ${sampleTexts.join(', ')}`);
    }
  }
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];
  const limit = parseInt(process.argv[3] ?? '50', 10);
  const statusFilter = process.argv[4];

  if (!mangaTitle) {
    printUsage();
    process.exit(1);
  }

  try {
    const result = await exportTitleLabels(mangaTitle, limit, statusFilter);
    if (!result) {
      process.exit(1);
    }

    const outputDir = path.join(process.cwd(), '.claude', 'agent-review');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${result.slug}-labels.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    log(`[export] Exported ${result.totalPages} pages to ${outputPath}`);
    printLabelSummary(result.aggregatedLabels);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`[export] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
