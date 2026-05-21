/**
 * Run Agent Review for a specific manga title
 *
 * Processes BOOTSTRAP pages for the specified manga through the agent review system.
 *
 * Usage: bun scripts/agent-review/run-title-agent-review.ts "<manga-title>" [--dry-run]
 *
 * Example:
 *   bun scripts/agent-review/run-title-agent-review.ts "Vinland Saga"
 *   bun scripts/agent-review/run-title-agent-review.ts "Vinland Saga" --dry-run
 */

import { PrismaClient, Prisma, AnnotationStatus } from '@prisma/client';

// Import the agent review module using relative path for script execution
import { reviewPage, applyCorrections } from '@/server/ml/training/agent-review';

import type { AnnotationSourceType } from '@prisma/client';
import type { BIOTag } from '@/server/ml/features/bio-types';
import type { AgentReviewResult } from '@/server/ml/training/agent-review';

const prisma = new PrismaClient();

const AUTO_APPLY_THRESHOLD = 0.8;

function log(message: string): void {
  process.stdout.write(message + '\n');
}

interface RawToken {
  text?: string;
  tagName?: string;
  xpath?: string | null;
  linkHref?: string | null;
}

interface PageData {
  id: string;
  url: string;
  sourceType: AnnotationSourceType;
  tokens: RawToken[];
  labels: BIOTag[];
}

interface ReviewSummary {
  totalProcessed: number;
  approved: number;
  corrected: number;
  flagged: number;
  failed: number;
  totalCorrections: { added: number; removed: number; modified: number };
  errors: Array<{ pageId: string; url: string; error: string }>;
}

function convertTokensForReview(
  page: PageData
): Array<{
  index: number;
  text: string;
  tagName: string;
  label: BIOTag;
  xpath: string | null;
  linkHref: string | null;
}> {
  return page.tokens.map((t, i) => ({
    index: i,
    text: t.text ?? '',
    tagName: t.tagName ?? 'span',
    label: page.labels[i] ?? ('O' as BIOTag),
    xpath: t.xpath ?? null,
    linkHref: t.linkHref ?? null,
  }));
}

async function applyReviewResult(
  pageId: string,
  result: AgentReviewResult,
  originalLabels: BIOTag[]
): Promise<void> {
  const newLabels = applyCorrections(originalLabels, result.corrections);

  await prisma.annotatedPage.update({
    where: { id: pageId },
    data: {
      status: AnnotationStatus.AGENT_REVIEWED,
      labels: newLabels,
      agentReviewedAt: new Date(),
      agentReviewNotes: result.notes,
      agentCorrections: result.corrections as unknown as Prisma.InputJsonValue,
      agentConfidence: result.confidence,
      agentIssuesFound: result.issues as unknown as Prisma.InputJsonValue,
      agentModelVersion: result.modelVersion,
    },
  });
}

async function processPage(
  page: PageData,
  dryRun: boolean
): Promise<{ success: boolean; result?: AgentReviewResult; error?: string }> {
  try {
    const tokens = convertTokensForReview(page);
    const result = reviewPage({
      id: page.id,
      url: page.url,
      sourceType: page.sourceType,
      tokens,
      labels: page.labels,
    });

    if (!dryRun && result.confidence >= AUTO_APPLY_THRESHOLD) {
      await applyReviewResult(page.id, result, page.labels);
    }

    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function runAgentReview(mangaTitle: string, dryRun: boolean): Promise<ReviewSummary> {
  log(`\n=== Agent Review: ${mangaTitle} ===`);
  log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (applying changes)'}`);
  log(`Auto-apply threshold: ${AUTO_APPLY_THRESHOLD}`);

  // Get all BOOTSTRAP pages for this manga
  const pages = await prisma.annotatedPage.findMany({
    where: {
      mangaTitle,
      status: AnnotationStatus.BOOTSTRAP,
    },
    select: {
      id: true,
      url: true,
      sourceType: true,
      tokens: true,
      labels: true,
    },
    orderBy: { url: 'asc' },
  });

  if (pages.length === 0) {
    log(`\nNo BOOTSTRAP pages found for "${mangaTitle}"`);
    return {
      totalProcessed: 0,
      approved: 0,
      corrected: 0,
      flagged: 0,
      failed: 0,
      totalCorrections: { added: 0, removed: 0, modified: 0 },
      errors: [],
    };
  }

  log(`\nFound ${pages.length} BOOTSTRAP pages to process\n`);

  const summary: ReviewSummary = {
    totalProcessed: 0,
    approved: 0,
    corrected: 0,
    flagged: 0,
    failed: 0,
    totalCorrections: { added: 0, removed: 0, modified: 0 },
    errors: [],
  };

  for (const page of pages) {
    const pageData: PageData = {
      id: page.id,
      url: page.url,
      sourceType: page.sourceType,
      tokens: page.tokens as RawToken[],
      labels: page.labels as BIOTag[],
    };

    const { success, result, error } = await processPage(pageData, dryRun);
    summary.totalProcessed++;

    if (!success) {
      summary.failed++;
      summary.errors.push({ pageId: page.id, url: page.url, error: error ?? 'Unknown' });
      log(`  ✗ ${page.url} - ERROR: ${error}`);
      continue;
    }

    if (!result) continue;

    // Count status
    switch (result.status) {
      case 'approved':
        summary.approved++;
        break;
      case 'corrected':
        summary.corrected++;
        break;
      case 'flagged':
        summary.flagged++;
        break;
    }

    // Count corrections
    summary.totalCorrections.added += result.corrections.added.length;
    summary.totalCorrections.removed += result.corrections.removed.length;
    summary.totalCorrections.modified += result.corrections.modified.length;

    // Log result
    const statusIcon = result.status === 'approved' ? '✓' : result.status === 'corrected' ? '~' : '!';
    const applied = !dryRun && result.confidence >= AUTO_APPLY_THRESHOLD ? ' [APPLIED]' : '';
    log(
      `  ${statusIcon} ${page.url} - ${result.status} (confidence: ${result.confidence.toFixed(2)})${applied}`
    );

    if (result.issues.errors.length > 0 || result.issues.warnings.length > 0) {
      for (const issue of result.issues.errors) {
        log(`      ERROR: ${issue.message}`);
      }
      for (const issue of result.issues.warnings) {
        log(`      WARN: ${issue.message}`);
      }
    }
  }

  // Print summary
  log('\n=== Summary ===');
  log(`Total processed: ${summary.totalProcessed}`);
  log(`  Approved: ${summary.approved}`);
  log(`  Corrected: ${summary.corrected}`);
  log(`  Flagged: ${summary.flagged}`);
  log(`  Failed: ${summary.failed}`);
  log(`\nCorrections:`);
  log(`  Added: ${summary.totalCorrections.added}`);
  log(`  Removed: ${summary.totalCorrections.removed}`);
  log(`  Modified: ${summary.totalCorrections.modified}`);

  if (!dryRun) {
    const applied = summary.approved + summary.corrected;
    log(`\nApplied changes to ${applied} pages (status → AGENT_REVIEWED)`);
  } else {
    log('\n[DRY RUN] No changes were made. Run without --dry-run to apply.');
  }

  if (summary.errors.length > 0) {
    log('\n=== Errors ===');
    for (const err of summary.errors) {
      log(`  ${err.url}: ${err.error}`);
    }
  }

  return summary;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mangaTitle = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!mangaTitle) {
    log('Usage: bun scripts/agent-review/run-title-agent-review.ts "<manga-title>" [--dry-run]');
    log('');
    log('Options:');
    log('  --dry-run    Preview changes without applying them');
    log('');
    log('Examples:');
    log('  bun scripts/agent-review/run-title-agent-review.ts "Vinland Saga"');
    log('  bun scripts/agent-review/run-title-agent-review.ts "Vinland Saga" --dry-run');
    process.exit(1);
  }

  try {
    await runAgentReview(mangaTitle, dryRun);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
