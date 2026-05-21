/**
 * Export Vinland Saga pages for agent review
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

async function exportVinlandSaga(): Promise<void> {
  const limit = parseInt(process.argv[2] ?? '10', 10);
  const pages = await prisma.annotatedPage.findMany({
    where: {
      mangaTitle: 'Vinland Saga',
      status: 'BOOTSTRAP',
    },
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

  process.stdout.write(`[export] Found ${pages.length} Vinland Saga pages\n`);

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

  const result = {
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

  process.stdout.write(`[export] Exported ${exportedPages.length} pages to ${outputPath}\n`);

  await prisma.$disconnect();
}

exportVinlandSaga().catch((error: unknown) => {
  process.stderr.write(`[export] Error: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
