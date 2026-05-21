/**
 * Export Pages for Agent Review
 *
 * Exports pages that need LLM review to a JSON file for subagent processing.
 * Run with: npx ts-node scripts/agent-review/export-pages-for-review.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExportedPage {
  id: string;
  url: string;
  sourceType: string;
  tokens: Array<{
    index: number;
    text: string;
    label: string;
  }>;
  currentLabels: string[];
}

interface ExportResult {
  exportedAt: string;
  totalPages: number;
  pages: ExportedPage[];
}

function log(message: string): void {
  process.stdout.write(`[export] ${message}\n`);
}

async function exportPagesForReview(limit = 10): Promise<void> {
  log(`Exporting up to ${limit} pages for review...`);

  const pages = await prisma.annotatedPage.findMany({
    where: {
      status: 'BOOTSTRAP',
    },
    orderBy: { confidence: 'asc' },
    take: limit,
    select: {
      id: true,
      url: true,
      sourceType: true,
      tokens: true,
      labels: true,
      confidence: true,
    },
  });

  log(`Found ${pages.length} pages`);

  const exportedPages: ExportedPage[] = pages.map((page) => {
    const tokens = page.tokens as Array<{ text?: string }>;
    const labels = page.labels as string[];

    return {
      id: page.id,
      url: page.url,
      sourceType: page.sourceType,
      tokens: tokens.map((t, i) => ({
        index: i,
        text: t.text ?? '',
        label: labels[i] ?? 'O',
      })),
      currentLabels: labels,
    };
  });

  const result: ExportResult = {
    exportedAt: new Date().toISOString(),
    totalPages: exportedPages.length,
    pages: exportedPages,
  };

  const outputDir = path.join(process.cwd(), '.claude', 'agent-review');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'pages-for-review.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  log(`Exported ${exportedPages.length} pages to ${outputPath}`);

  await prisma.$disconnect();
}

const limit = parseInt(process.argv[2] ?? '10', 10);
exportPagesForReview(limit).catch((error: unknown) => {
  process.stderr.write(`[export] Error: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
