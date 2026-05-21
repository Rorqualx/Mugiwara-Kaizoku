/**
 * Analyze ML labels against ground truth
 *
 * Usage: bunx ts-node scripts/agent-review/analyze-labels.ts "<manga-title>"
 *
 * Requires:
 *   - .claude/agent-review/<slug>-labels.json (from export-title-labels.ts)
 *   - .claude/agent-review/<slug>-ground-truth.json (manually created or collected)
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  AnalysisIssue,
  AnalysisResult,
  AnalysisSummary,
  CoreMetadataCheck,
  GroundTruth,
  LabelTypeStats,
  MetadataCheckResult,
  StatusComparison,
  VolumeCheck,
} from './types/ground-truth';

function log(message: string): void {
  process.stdout.write(message + '\n');
}

function getSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface TokenData {
  index: number;
  text: string;
  label: string;
}

interface ExportedPage {
  id: string;
  url: string;
  sourceType: string;
  status: string;
  tokenCount: number;
  tokens: TokenData[];
  labelSummary: Record<string, number>;
}

interface ExportData {
  title: string;
  slug: string;
  totalPages: number;
  pages: ExportedPage[];
  aggregatedLabels: Record<string, { entityType: string; totalCount: number; samples: Array<{ text: string }> }>;
}

// ============================================================================
// Label Counting Functions
// ============================================================================

function countLabelsByType(pages: ExportedPage[]): Record<string, LabelTypeStats> {
  const stats: Record<string, LabelTypeStats> = {};

  for (const page of pages) {
    for (const [entityType, count] of Object.entries(page.labelSummary)) {
      if (!stats[entityType]) {
        stats[entityType] = { entityType, count: 0, samples: [], pageCount: 0 };
      }
      stats[entityType].count += count;
      stats[entityType].pageCount++;
    }
  }

  return stats;
}

function collectSamplesForEntity(pages: ExportedPage[], entityType: string, maxSamples = 5): string[] {
  const samples: string[] = [];
  const targetLabel = `B-${entityType}`;

  for (const page of pages) {
    if (samples.length >= maxSamples) break;
    for (const token of page.tokens) {
      if (token.label === targetLabel && !samples.includes(token.text)) {
        samples.push(token.text);
        if (samples.length >= maxSamples) break;
      }
    }
  }

  return samples;
}

// ============================================================================
// Core Metadata Checking
// ============================================================================

function checkMetadataField(
  pages: ExportedPage[],
  entityType: string,
  expected: string | number | string[]
): MetadataCheckResult {
  const samples = collectSamplesForEntity(pages, entityType);
  const found = samples.length > 0;

  let matches = false;
  if (found) {
    const expectedStr = Array.isArray(expected) ? expected.join(', ') : String(expected);
    matches = samples.some((s) => expectedStr.toLowerCase().includes(s.toLowerCase()));
  }

  return {
    found,
    expected,
    actual: samples,
    matches,
    notes: found ? undefined : `No ${entityType} labels found in ${pages.length} pages`,
  };
}

function checkCoreMetadata(pages: ExportedPage[], groundTruth: GroundTruth): CoreMetadataCheck {
  return {
    title: checkMetadataField(pages, 'TITLE', groundTruth.title),
    author: checkMetadataField(pages, 'AUTHOR', groundTruth.author),
    publisher: checkMetadataField(pages, 'PUBLISHER', groundTruth.publisher),
    demographic: checkMetadataField(pages, 'DEMOGRAPHIC', groundTruth.demographic),
    magazine: checkMetadataField(pages, 'MAGAZINE', groundTruth.magazine ?? ''),
    status: checkMetadataField(pages, 'STATUS', groundTruth.status),
    genres: checkMetadataField(pages, 'GENRE', groundTruth.genres),
    volumeCount: checkMetadataField(pages, 'VOLUME_COUNT', groundTruth.volumeCount),
    chapterCount: checkMetadataField(pages, 'CHAPTER_COUNT', groundTruth.chapterCount),
  };
}

// ============================================================================
// Volume Checking
// ============================================================================

function checkVolumeLabels(pages: ExportedPage[], groundTruth: GroundTruth): VolumeCheck[] {
  if (!groundTruth.volumes || groundTruth.volumes.length === 0) {
    return [];
  }

  const volumeNumbers = collectSamplesForEntity(pages, 'VOLUME_NUMBER', 100);
  const isbns = collectSamplesForEntity(pages, 'ISBN', 100);

  return groundTruth.volumes.slice(0, 10).map((vol) => {
    const issues: string[] = [];
    const volNumFound = volumeNumbers.includes(String(vol.number));
    const isbnFound = vol.isbn ? isbns.includes(vol.isbn) : false;

    if (!volNumFound) issues.push(`Volume ${vol.number} not found in labels`);
    if (vol.isbn && !isbnFound) issues.push(`ISBN ${vol.isbn} not found`);

    return {
      volumeNumber: vol.number,
      volumeNumberFound: volNumFound,
      isbnFound,
      isbnValue: vol.isbn,
      releaseDateFound: false,
      chapterRangeFound: false,
      issues,
    };
  });
}

// ============================================================================
// Issue Detection
// ============================================================================

const NAVIGATION_PATTERNS = ['ISBN', 'Release', 'Date', 'Pages', 'Chapters', 'Volume', 'Edit', 'View'];

function isNavigationText(text: string): boolean {
  return NAVIGATION_PATTERNS.includes(text);
}

function isOverLabeledToken(token: TokenData): boolean {
  const isTitleLabel = token.label.startsWith('B-VOLUME_TITLE') || token.label.startsWith('B-TITLE');
  return isTitleLabel && isNavigationText(token.text);
}

function createOverLabelingIssue(token: TokenData): AnalysisIssue {
  return {
    category: 'over_labeling',
    severity: 'medium',
    description: `"${token.text}" labeled as ${token.label.substring(2)} but appears to be navigation/metadata`,
    entityType: token.label.substring(2),
    samples: [token.text],
    recommendation: 'Add preprocessing to filter navigation elements before labeling',
  };
}

function detectOverLabeling(pages: ExportedPage[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const overLabeledTokens = page.tokens.filter(isOverLabeledToken);
    for (const token of overLabeledTokens) {
      const key = `over_labeling-${token.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        issues.push(createOverLabelingIssue(token));
      }
    }
  }

  return issues;
}

function detectMissingLabels(coreCheck: CoreMetadataCheck): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const fields = ['title', 'author', 'publisher', 'demographic', 'status', 'genres'] as const;

  for (const field of fields) {
    const check = coreCheck[field];
    if (!check.found) {
      issues.push({
        category: 'missing_label',
        severity: field === 'title' || field === 'author' ? 'high' : 'medium',
        description: `${field.toUpperCase()} not found in labels (expected: ${String(check.expected)})`,
        entityType: field.toUpperCase(),
        recommendation: `Add ${field.toUpperCase()} extraction from series overview pages`,
      });
    }
  }

  return issues;
}

// ============================================================================
// Status Comparison
// ============================================================================

function getEntitySets(
  bootstrapLabels: Record<string, LabelTypeStats>,
  reviewedLabels: Record<string, LabelTypeStats>
): { bootstrapOnly: string[]; reviewedOnly: string[] } {
  const bootstrapEntities = Object.keys(bootstrapLabels);
  const reviewedEntities = Object.keys(reviewedLabels);
  const reviewedSet = new Set(reviewedEntities);
  const bootstrapSet = new Set(bootstrapEntities);

  return {
    bootstrapOnly: bootstrapEntities.filter((e) => !reviewedSet.has(e)),
    reviewedOnly: reviewedEntities.filter((e) => !bootstrapSet.has(e)),
  };
}

function calculateQualityMetrics(
  bootstrap: ExportedPage[],
  reviewed: ExportedPage[],
  bootstrapLabels: Record<string, LabelTypeStats>,
  reviewedLabels: Record<string, LabelTypeStats>
): StatusComparison['qualityMetrics'] {
  const bootstrapTotal = Object.values(bootstrapLabels).reduce((sum, s) => sum + s.count, 0);
  const reviewedTotal = Object.values(reviewedLabels).reduce((sum, s) => sum + s.count, 0);

  const coreEntityTypes = ['TITLE', 'AUTHOR', 'PUBLISHER', 'DEMOGRAPHIC', 'GENRE'];
  const bootstrapCore = coreEntityTypes.filter((e) => bootstrapLabels[e]).length;
  const reviewedCore = coreEntityTypes.filter((e) => reviewedLabels[e]).length;

  return {
    bootstrapAvgLabels: Math.round(bootstrapTotal / bootstrap.length),
    agentReviewedAvgLabels: Math.round(reviewedTotal / reviewed.length),
    bootstrapCoreMetadata: bootstrapCore,
    agentReviewedCoreMetadata: reviewedCore,
  };
}

function compareBootstrapVsReviewed(pages: ExportedPage[]): StatusComparison | undefined {
  const bootstrap = pages.filter((p) => p.status === 'BOOTSTRAP');
  const reviewed = pages.filter((p) => p.status === 'AGENT_REVIEWED');

  if (bootstrap.length === 0 || reviewed.length === 0) {
    return undefined;
  }

  const bootstrapLabels = countLabelsByType(bootstrap);
  const reviewedLabels = countLabelsByType(reviewed);
  const { bootstrapOnly, reviewedOnly } = getEntitySets(bootstrapLabels, reviewedLabels);
  const qualityMetrics = calculateQualityMetrics(bootstrap, reviewed, bootstrapLabels, reviewedLabels);

  const findings: string[] = [];
  const metricComparison = qualityMetrics.agentReviewedCoreMetadata > qualityMetrics.bootstrapCoreMetadata
    ? 'better' : 'similar';
  findings.push(`AGENT_REVIEWED pages have ${metricComparison} core metadata coverage`);
  if (reviewedOnly.length > 0) {
    findings.push(`AGENT_REVIEWED has unique entities: ${reviewedOnly.join(', ')}`);
  }

  return {
    bootstrapCount: bootstrap.length,
    agentReviewedCount: reviewed.length,
    bootstrapOnlyEntities: bootstrapOnly,
    agentReviewedOnlyEntities: reviewedOnly,
    qualityMetrics,
    findings,
  };
}

// ============================================================================
// Main Analysis
// ============================================================================

function buildSummary(pages: ExportedPage[], labelStats: Record<string, LabelTypeStats>): AnalysisSummary {
  const pagesBySource: Record<string, number> = {};
  const pagesByStatus: Record<string, number> = {};
  let emptyPages = 0;

  for (const page of pages) {
    pagesBySource[page.sourceType] = (pagesBySource[page.sourceType] ?? 0) + 1;
    pagesByStatus[page.status] = (pagesByStatus[page.status] ?? 0) + 1;
    if (page.tokenCount === 0) emptyPages++;
  }

  return {
    totalPages: pages.length,
    pagesBySource,
    pagesByStatus,
    totalLabeledTokens: Object.values(labelStats).reduce((sum, s) => sum + s.count, 0),
    uniqueEntityTypes: Object.keys(labelStats).length,
    emptyPages,
  };
}

async function analyzeLabels(mangaTitle: string): Promise<AnalysisResult | null> {
  const slug = getSlug(mangaTitle);
  const baseDir = path.join(process.cwd(), '.claude', 'agent-review');
  const labelsPath = path.join(baseDir, `${slug}-labels.json`);
  const groundTruthPath = path.join(baseDir, `${slug}-ground-truth.json`);

  if (!fs.existsSync(labelsPath)) {
    log(`Labels file not found: ${labelsPath}`);
    log('Run export-title-labels.ts first.');
    return null;
  }

  if (!fs.existsSync(groundTruthPath)) {
    log(`Ground truth file not found: ${groundTruthPath}`);
    log('Create ground truth file manually or use the validate-ml-labels command.');
    return null;
  }

  const exportData: ExportData = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
  const groundTruth: GroundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

  const labelStats = countLabelsByType(exportData.pages);
  const coreMetadataCheck = checkCoreMetadata(exportData.pages, groundTruth);
  const volumeChecks = checkVolumeLabels(exportData.pages, groundTruth);

  const issues: AnalysisIssue[] = [
    ...detectMissingLabels(coreMetadataCheck),
    ...detectOverLabeling(exportData.pages),
  ];

  const result: AnalysisResult = {
    title: mangaTitle,
    slug,
    analyzedAt: new Date().toISOString(),
    summary: buildSummary(exportData.pages, labelStats),
    labelsByType: labelStats,
    coreMetadataCheck,
    volumeChecks,
    issues,
    statusComparison: compareBootstrapVsReviewed(exportData.pages),
  };

  const outputPath = path.join(baseDir, `${slug}-analysis.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  log(`[analyze] Analysis saved to ${outputPath}`);

  return result;
}

function printUsage(): void {
  log('Usage: bunx ts-node scripts/agent-review/analyze-labels.ts "<manga-title>"');
  log('');
  log('Requires:');
  log('  .claude/agent-review/<slug>-labels.json');
  log('  .claude/agent-review/<slug>-ground-truth.json');
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];

  if (!mangaTitle) {
    printUsage();
    process.exit(1);
  }

  const result = await analyzeLabels(mangaTitle);
  if (!result) {
    process.exit(1);
  }

  log('\n=== Analysis Summary ===');
  log(`Total pages: ${result.summary.totalPages}`);
  log(`Entity types found: ${result.summary.uniqueEntityTypes}`);
  log(`Total labeled tokens: ${result.summary.totalLabeledTokens}`);
  log(`\nIssues found: ${result.issues.length}`);

  for (const issue of result.issues) {
    const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
    log(`  ${icon} [${issue.category}] ${issue.description}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`[analyze] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
