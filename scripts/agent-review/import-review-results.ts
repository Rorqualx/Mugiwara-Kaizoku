/**
 * Import Agent Review Results
 *
 * Imports review results from subagent processing and updates the database.
 * Run with: npx ts-node scripts/agent-review/import-review-results.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ReviewResult {
  pageId: string;
  status: 'approved' | 'corrected' | 'flagged';
  confidence: number;
  corrections: {
    added: Array<{ tokenRange: [number, number]; newLabel: string; reason: string }>;
    removed: Array<{ tokenRange: [number, number]; previousLabel: string; reason: string }>;
    modified: Array<{ tokenRange: [number, number]; from: string; to: string; reason: string }>;
  };
  issues: Array<{ type: string; severity: string; message: string }>;
  notes: string;
}

interface ImportFile {
  reviewedAt: string;
  modelVersion: string;
  results: ReviewResult[];
}

function log(message: string): void {
  process.stdout.write(`[import] ${message}\n`);
}

function applyLabelRange(
  labels: string[],
  range: [number, number],
  beginLabel: string,
  continueLabel: string
): void {
  const [start, end] = range;
  for (let i = start; i <= end && i < labels.length; i++) {
    labels[i] = i === start ? beginLabel : continueLabel;
  }
}

function applyCorrections(
  labels: string[],
  corrections: ReviewResult['corrections']
): string[] {
  const newLabels = [...labels];

  for (const removal of corrections.removed) {
    applyLabelRange(newLabels, removal.tokenRange, 'O', 'O');
  }

  for (const mod of corrections.modified) {
    applyLabelRange(newLabels, mod.tokenRange, `B-${mod.to}`, `I-${mod.to}`);
  }

  for (const addition of corrections.added) {
    applyLabelRange(newLabels, addition.tokenRange, `B-${addition.newLabel}`, `I-${addition.newLabel}`);
  }

  return newLabels;
}

async function updatePage(result: ReviewResult, importData: ImportFile): Promise<boolean> {
  const page = await prisma.annotatedPage.findUnique({
    where: { id: result.pageId },
    select: { labels: true },
  });

  if (!page) {
    log(`Page not found: ${result.pageId}`);
    return false;
  }

  const currentLabels = page.labels as string[];
  const newLabels = applyCorrections(currentLabels, result.corrections);

  await prisma.annotatedPage.update({
    where: { id: result.pageId },
    data: {
      status: 'AGENT_REVIEWED',
      labels: newLabels,
      agentReviewedAt: new Date(importData.reviewedAt),
      agentReviewNotes: result.notes,
      agentCorrections: result.corrections,
      agentConfidence: result.confidence,
      agentIssuesFound: { issues: result.issues },
      agentModelVersion: importData.modelVersion,
    },
  });

  log(`Updated page ${result.pageId} - status: ${result.status}`);
  return true;
}

async function importReviewResults(): Promise<void> {
  const inputPath = path.join(process.cwd(), '.claude', 'agent-review', 'review-results.json');

  if (!fs.existsSync(inputPath)) {
    log(`Review results file not found: ${inputPath}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as ImportFile;
  log(`Importing ${data.results.length} review results...`);

  let updated = 0;
  let failed = 0;

  for (const result of data.results) {
    const success = await updatePage(result, data).catch(() => false);
    if (success) {
      updated++;
    } else {
      failed++;
    }
  }

  log(`Import completed: ${updated} updated, ${failed} failed`);
  await prisma.$disconnect();
}

importReviewResults().catch((error: unknown) => {
  process.stderr.write(`[import] Error: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
