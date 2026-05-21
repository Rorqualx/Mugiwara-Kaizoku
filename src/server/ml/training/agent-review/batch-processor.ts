/**
 * Batch Processor for Agent Review
 *
 * Processes multiple pages in batches with rate limiting and error handling.
 */


import { Prisma, type AnnotationSourceType, type AnnotationStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import type { BIOTag } from '@/server/ml/features/bio-types';


import { reviewPage, applyCorrections } from './review-logic';
import { DEFAULT_BATCH_OPTIONS } from './types';


import type {
  BatchReviewOptions,
  BatchReviewResult,
  AgentReviewResult,
  DiscoveredUrl,
  AgentIssueType,
  ReviewIssue,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface PageData {
  id: string;
  url: string;
  sourceType: AnnotationSourceType;
  tokens: unknown[];
  labels: BIOTag[];
}

interface ProcessResult {
  pageId: string;
  success: boolean;
  result?: AgentReviewResult;
  error?: string;
}

type RawToken = { text?: string; tagName?: string; xpath?: string | null; linkHref?: string | null };

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get pages pending agent review
 */
export async function getPendingReviewPages(
  options: Partial<BatchReviewOptions> = {}
): Promise<PageData[]> {
  const opts = { ...DEFAULT_BATCH_OPTIONS, ...options };

  const whereClause: Record<string, unknown> = {
    status: opts.statusFilter ?? 'BOOTSTRAP',
  };

  if (opts.sourceTypeFilter) {
    whereClause['sourceType'] = opts.sourceTypeFilter;
  }

  if (opts.minConfidenceThreshold !== undefined) {
    whereClause['confidence'] = { lt: opts.minConfidenceThreshold };
  }

  const orderBy = getOrderBy(opts.priorityOrder);

  const pages = await prisma.annotatedPage.findMany({
    where: whereClause,
    orderBy,
    take: opts.maxPages ?? opts.batchSize * 10,
    select: {
      id: true,
      url: true,
      sourceType: true,
      tokens: true,
      labels: true,
      confidence: true,
    },
  });

  return pages.map((p) => ({
    id: p.id,
    url: p.url,
    sourceType: p.sourceType,
    tokens: p.tokens as unknown[],
    labels: p.labels as BIOTag[],
  }));
}

function getOrderBy(
  priorityOrder: BatchReviewOptions['priorityOrder']
): Record<string, 'asc' | 'desc'> {
  switch (priorityOrder) {
    case 'lowest_confidence':
      return { confidence: 'asc' };
    case 'oldest_first':
      return { createdAt: 'asc' };
    case 'newest_first':
      return { createdAt: 'desc' };
    default:
      return { confidence: 'asc' };
  }
}

// ============================================================================
// Review Statistics
// ============================================================================

/**
 * Get statistics about the review queue
 */
export async function getReviewQueueStats(): Promise<{
  totalPending: number;
  bySourceType: Record<string, number>;
  byStatus: Record<string, number>;
  avgConfidence: number;
}> {
  const [statusCounts, sourceCounts, avgResult] = await Promise.all([
    prisma.annotatedPage.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.annotatedPage.groupBy({
      by: ['sourceType'],
      where: { status: 'BOOTSTRAP' },
      _count: { id: true },
    }),
    prisma.annotatedPage.aggregate({
      where: { status: 'BOOTSTRAP' },
      _avg: { confidence: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of statusCounts) {
    byStatus[item.status] = item._count.id;
  }

  const bySourceType: Record<string, number> = {};
  for (const item of sourceCounts) {
    bySourceType[item.sourceType] = item._count.id;
  }

  return {
    totalPending: byStatus['BOOTSTRAP'] ?? 0,
    bySourceType,
    byStatus,
    avgConfidence: avgResult._avg.confidence ?? 0,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a batch of pages for agent review
 */
export async function processAgentReviewBatch(
  options: Partial<BatchReviewOptions> = {}
): Promise<BatchReviewResult> {
  const opts = { ...DEFAULT_BATCH_OPTIONS, ...options };
  const startTime = Date.now();

  const pages = await getPendingReviewPages(opts);
  const pagesToProcess = pages.slice(0, opts.batchSize);

  if (pagesToProcess.length === 0) {
    return createEmptyResult(startTime);
  }

  const results = await processWithConcurrency(pagesToProcess, opts);
  return aggregateResults(results, startTime);
}

async function processWithConcurrency(
  pages: PageData[],
  opts: BatchReviewOptions
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const chunks = chunkArray(pages, opts.concurrency);

  for (const chunk of chunks) {
    // eslint-disable-next-line no-await-in-loop -- Intentional chunking for concurrency control
    const chunkResults = await Promise.all(chunk.map((page) => processPage(page, opts)));
    results.push(...chunkResults);
  }

  return results;
}

async function processPage(page: PageData, opts: BatchReviewOptions): Promise<ProcessResult> {
  try {
    const tokens = convertTokensForReview(page);
    const result = reviewPage({
      id: page.id,
      url: page.url,
      sourceType: page.sourceType,
      tokens,
      labels: page.labels,
    });

    if (!opts.dryRun && result.confidence >= opts.autoApplyThreshold) {
      await applyReviewResult(page.id, result, page.labels);
    }

    return { pageId: page.id, success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { pageId: page.id, success: false, error: errorMessage };
  }
}

function convertTokensForReview(page: PageData): Array<{
  index: number;
  text: string;
  tagName: string;
  label: BIOTag;
  xpath: string | null;
  linkHref: string | null;
}> {
  return (page.tokens as RawToken[]).map((t, i) => ({
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
      status: 'AGENT_REVIEWED' as AnnotationStatus,
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

// ============================================================================
// URL Bootstrap Queue
// ============================================================================

/**
 * Queue discovered URLs for bootstrap labeling
 */
export async function queueDiscoveredUrls(
  discoveredUrls: DiscoveredUrl[],
  parentPageId: string
): Promise<number> {
  const urlsToBootstrap = discoveredUrls.filter((u) => u.shouldBootstrap);

  const results = await Promise.all(
    urlsToBootstrap.map((url) => queueSingleUrl(url, parentPageId))
  );

  return results.filter(Boolean).length;
}

async function queueSingleUrl(url: DiscoveredUrl, parentPageId: string): Promise<boolean> {
  const existing = await prisma.annotatedPage.findUnique({
    where: { url: url.url },
    select: { id: true },
  });

  if (existing) return false;

  await prisma.annotatedPage.create({
    data: {
      url: url.url,
      sourceType: 'FANDOM',
      htmlSnapshot: '',
      tokens: [],
      labels: [],
      status: 'BOOTSTRAP',
      notes: `Discovered from ${parentPageId} - pending bootstrap`,
    },
  });

  return true;
}

// ============================================================================
// Helpers
// ============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function createEmptyResult(startTime: number): BatchReviewResult {
  return {
    totalProcessed: 0,
    approved: 0,
    corrected: 0,
    flagged: 0,
    failed: 0,
    totalCorrections: { added: 0, removed: 0, modified: 0 },
    commonIssues: [],
    totalTimeMs: Date.now() - startTime,
    avgTimePerPageMs: 0,
    discoveredUrls: [],
    errors: [],
  };
}

function getSuccessfulResults(results: ProcessResult[]): AgentReviewResult[] {
  const successful: AgentReviewResult[] = [];
  for (const r of results) {
    if (r.success && r.result) successful.push(r.result);
  }
  return successful;
}

function countStatuses(reviewResults: AgentReviewResult[]): { approved: number; corrected: number; flagged: number } {
  let approved = 0, corrected = 0, flagged = 0;
  for (const r of reviewResults) {
    switch (r.status) {
      case 'approved':
        approved++;
        break;
      case 'corrected':
        corrected++;
        break;
      case 'flagged':
        flagged++;
        break;
      default:
        // Exhaustive check - should never reach here
        break;
    }
  }
  return { approved, corrected, flagged };
}

function countCorrections(reviewResults: AgentReviewResult[]): { added: number; removed: number; modified: number } {
  let added = 0, removed = 0, modified = 0;
  for (const r of reviewResults) {
    added += r.corrections.added.length;
    removed += r.corrections.removed.length;
    modified += r.corrections.modified.length;
  }
  return { added, removed, modified };
}

function collectIssues(reviewResults: AgentReviewResult[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  for (const r of reviewResults) {
    issues.push(...r.issues.errors, ...r.issues.warnings);
  }
  return issues;
}

function collectUrls(reviewResults: AgentReviewResult[]): DiscoveredUrl[] {
  const urls: DiscoveredUrl[] = [];
  for (const r of reviewResults) {
    urls.push(...r.discoveredUrls);
  }
  return urls;
}

function getTopIssueTypes(issues: ReviewIssue[]): Array<{ type: AgentIssueType; count: number }> {
  const counts = new Map<AgentIssueType, number>();
  for (const issue of issues) {
    counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 10).map(([type, count]) => ({ type, count }));
}

function aggregateResults(results: ProcessResult[], startTime: number): BatchReviewResult {
  const failed = results.filter((r) => !r.success);
  const successful = getSuccessfulResults(results);
  const statuses = countStatuses(successful);
  const corrections = countCorrections(successful);
  const issues = collectIssues(successful);
  const discoveredUrls = collectUrls(successful);
  const commonIssues = getTopIssueTypes(issues);
  const totalTimeMs = Date.now() - startTime;

  return {
    totalProcessed: results.length,
    ...statuses,
    failed: failed.length,
    totalCorrections: corrections,
    commonIssues,
    totalTimeMs,
    avgTimePerPageMs: results.length > 0 ? totalTimeMs / results.length : 0,
    discoveredUrls,
    errors: failed.map((f) => ({ pageId: f.pageId, error: f.error ?? 'Unknown error' })),
  };
}
