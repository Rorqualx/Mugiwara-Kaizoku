#!/usr/bin/env bun
/**
 * Agent-Driven Ground Truth Iteration
 *
 * 1. Sample pages from training data
 * 2. Load cached ground truth or mark for extraction
 * 3. Run auto-labeling on pages
 * 4. Compare extracted vs ground truth
 * 5. Generate improvement suggestions
 *
 * Run with: bun run scripts/agent-ground-truth-iteration.ts
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { samplePages, loadTrainingData } from '../src/server/services/auto-labeling/sampler';
import { calculateMetrics, aggregateMetrics } from '../src/server/services/auto-labeling/metrics';
import { extractWithParser } from '../src/server/services/auto-labeling/parser-bridge';
import { runBootstrapLabeling } from '../src/server/services/auto-labeling/bootstrap-bridge';
import { analyzeFailures, generateImprovementSummary } from '../src/server/services/auto-labeling/improvement-analyzer';
import {
  buildGroundTruthPrompt,
  createAgentGroundTruth,
  loadCachedGroundTruth,
  DEFAULT_AGENT_CONFIG,
} from '../src/server/services/auto-labeling/agent-ground-truth';
import type {
  SampledPage,
  ExtractedEntity,
  ExpectedEntity,
  LabelingAttempt,
  DiscoveredUrlType,
  AgentGroundTruth,
  AgentIterationResult,
  AgentIterationMetrics,
  AggregatedMetrics,
} from '../src/server/services/auto-labeling/types';

// Use process.stdout for CLI output
const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

// ============================================================================
// Configuration
// ============================================================================

interface IterationOptions {
  sampleSize: number;
  urlTypes: DiscoveredUrlType[];
  sources: Array<'fandom' | 'wikipedia' | 'comicvine'>;
  useCache: boolean;
  outputDir: string;
  targetF1: number;
}

const DEFAULT_OPTIONS: IterationOptions = {
  sampleSize: 15,
  urlTypes: ['MANGA_PAGE', 'VOLUMES', 'CHAPTERS'],
  sources: ['fandom', 'wikipedia', 'comicvine'],
  useCache: true,
  outputDir: 'data/auto-labeling/iterations',
  targetF1: 0.85,
};

// ============================================================================
// HTML Fetching
// ============================================================================

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MugiwaraBot/1.0)' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ============================================================================
// Ground Truth Extraction
// ============================================================================

/**
 * Create placeholder ground truth when agent extraction is not available.
 */
function createPlaceholderGroundTruth(page: SampledPage): AgentGroundTruth {
  const entities: ExpectedEntity[] = [
    {
      type: 'PAGE_TYPE',
      value: page.urlType,
      normalizedValue: page.urlType.toLowerCase(),
      required: true,
    },
  ];

  return createAgentGroundTruth(page, entities, 'placeholder');
}

/**
 * Output prompt for manual agent extraction.
 * Users can copy this prompt to Claude to get ground truth.
 */
function outputExtractionPrompt(page: SampledPage, html: string): void {
  const prompt = buildGroundTruthPrompt(page, html, DEFAULT_AGENT_CONFIG);
  const promptFile = join(DEFAULT_AGENT_CONFIG.cacheDir, 'pending-prompts', `${encodeURIComponent(page.url)}.txt`);

  // Ensure directory exists
  const promptDir = join(DEFAULT_AGENT_CONFIG.cacheDir, 'pending-prompts');
  if (!existsSync(promptDir)) {
    mkdirSync(promptDir, { recursive: true });
  }

  writeFileSync(promptFile, prompt);
  print(`  📝 Extraction prompt saved to: ${promptFile}`);
}

// ============================================================================
// Auto-Labeling
// ============================================================================

async function runAutoLabeling(page: SampledPage, html: string): Promise<ExtractedEntity[]> {
  // Run parser extraction
  const parserResult = await extractWithParser(page, html, {
    timeoutMs: 30000,
    minConfidence: 0.5,
  });

  // Run bootstrap labeling
  const bootstrapResult = runBootstrapLabeling(html, page.url, {
    minConfidence: 0.5,
  });

  // Merge entities from both sources
  return mergeEntities(parserResult.entities, bootstrapResult.entities);
}

function mergeEntities(parserEntities: ExtractedEntity[], bootstrapEntities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of parserEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    seen.set(key, entity);
  }

  for (const entity of bootstrapEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Page Processing
// ============================================================================

async function processPage(
  page: SampledPage,
  _options: IterationOptions
): Promise<{ attempt: LabelingAttempt; groundTruth: AgentGroundTruth | null; fromCache: boolean }> {
  const startTime = Date.now();

  // Fetch HTML
  const html = await fetchHtml(page.url);
  if (!html) {
    return {
      attempt: createFailedAttempt(page, 'Failed to fetch HTML', startTime),
      groundTruth: null,
      fromCache: false,
    };
  }

  // Get ground truth
  const cachedGroundTruth = loadCachedGroundTruth(page.url, DEFAULT_AGENT_CONFIG);
  const groundTruth = cachedGroundTruth ?? createPlaceholderGroundTruth(page);
  const fromCache = cachedGroundTruth !== null;

  // If no cached ground truth, save the prompt for later extraction
  if (!fromCache) {
    outputExtractionPrompt(page, html);
  }

  // Run auto-labeling
  const extractedEntities = await runAutoLabeling(page, html);

  // Calculate metrics
  const metrics = calculateMetrics(extractedEntities, groundTruth.entities, { minSimilarity: 0.6 });
  const success = metrics.f1 >= 0.5;

  const attempt: LabelingAttempt = {
    page,
    success,
    extractedEntities,
    expectedEntities: groundTruth.entities,
    metrics,
    durationMs: Date.now() - startTime,
    timestamp: new Date(),
  };

  return { attempt, groundTruth, fromCache };
}

function createFailedAttempt(page: SampledPage, error: string, startTime: number): LabelingAttempt {
  return {
    page,
    success: false,
    error,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: Date.now() - startTime,
    timestamp: new Date(),
  };
}

// ============================================================================
// Metrics Calculation
// ============================================================================

function calculateIterationMetrics(attempts: LabelingAttempt[]): AgentIterationMetrics {
  const overall = aggregateMetrics(attempts);

  // Group by source
  const bySource: Record<string, AggregatedMetrics> = {};
  const sources = ['fandom', 'wikipedia', 'comicvine'] as const;
  for (const source of sources) {
    const sourceAttempts = attempts.filter(a => a.page.source === source);
    if (sourceAttempts.length > 0) {
      bySource[source] = aggregateMetrics(sourceAttempts);
    }
  }

  // Group by page type
  const byPageType: Record<string, AggregatedMetrics> = {};
  const pageTypes: DiscoveredUrlType[] = ['MANGA_PAGE', 'VOLUMES', 'CHAPTERS', 'CHAPTERS_VOLUMES'];
  for (const pageType of pageTypes) {
    const typeAttempts = attempts.filter(a => a.page.urlType === pageType);
    if (typeAttempts.length > 0) {
      byPageType[pageType] = aggregateMetrics(typeAttempts);
    }
  }

  return {
    overall,
    bySource,
    byPageType,
    byEntityType: overall.byEntityType,
  };
}

// ============================================================================
// Result Output
// ============================================================================

function saveIterationResult(result: AgentIterationResult, options: IterationOptions): void {
  if (!existsSync(options.outputDir)) {
    mkdirSync(options.outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `iteration-${timestamp}.json`;
  const filepath = join(options.outputDir, filename);

  writeFileSync(filepath, JSON.stringify(result, null, 2));
  print(`\n📁 Results saved to: ${filepath}`);

  // Also save as latest.json for easy access
  const latestPath = join(options.outputDir, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(result, null, 2));
}

function printEntityCoverage(attempts: LabelingAttempt[]): void {
  print('\n=== ENTITY EXTRACTION COVERAGE ===');

  const entityCounts = new Map<string, number>();
  for (const attempt of attempts) {
    for (const entity of attempt.extractedEntities) {
      entityCounts.set(entity.type, (entityCounts.get(entity.type) ?? 0) + 1);
    }
  }

  const sortedTypes = Array.from(entityCounts.entries()).sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedTypes) {
    const avg = (count / attempts.length).toFixed(1);
    print(`  ${type.padEnd(20)}: ${count} total (${avg} per page)`);
  }
}

function printMetricsSummary(metrics: AgentIterationMetrics): void {
  print('\n=== METRICS SUMMARY ===');
  print(`Overall F1: ${(metrics.overall.microF1 * 100).toFixed(1)}%`);
  print(`Precision: ${(metrics.overall.microPrecision * 100).toFixed(1)}%`);
  print(`Recall: ${(metrics.overall.microRecall * 100).toFixed(1)}%`);

  if (Object.keys(metrics.bySource).length > 1) {
    print('\nBy Source:');
    for (const [source, m] of Object.entries(metrics.bySource)) {
      print(`  ${source}: F1=${(m.microF1 * 100).toFixed(1)}%`);
    }
  }

  if (Object.keys(metrics.byPageType).length > 1) {
    print('\nBy Page Type:');
    for (const [pageType, m] of Object.entries(metrics.byPageType)) {
      print(`  ${pageType}: F1=${(m.microF1 * 100).toFixed(1)}%`);
    }
  }
}

// ============================================================================
// Main Iteration
// ============================================================================

async function runIteration(options: IterationOptions = DEFAULT_OPTIONS): Promise<AgentIterationResult> {
  const startTime = Date.now();

  print('='.repeat(70));
  print('AGENT-DRIVEN GROUND TRUTH ITERATION');
  print('='.repeat(70));
  print('');

  // Load and sample pages
  const trainingData = loadTrainingData();
  const sampledPages = samplePages(trainingData, options.sampleSize, {
    requireAnilistId: true,
    urlTypes: options.urlTypes,
    sources: options.sources,
  });

  print(`Sampled ${sampledPages.length} pages`);
  print(`  Sources: ${options.sources.join(', ')}`);
  print(`  Page Types: ${options.urlTypes.join(', ')}`);
  print('');

  // Process pages
  const attempts: LabelingAttempt[] = [];
  const groundTruths: AgentGroundTruth[] = [];
  let cachedCount = 0;
  let freshCount = 0;

  for (let i = 0; i < sampledPages.length; i++) {
    const page = sampledPages[i];
    if (!page) continue;

    print(`[${i + 1}/${sampledPages.length}] Processing: ${page.title}`);
    print(`  URL: ${page.url}`);
    print(`  Type: ${page.urlType} | Source: ${page.source}`);

    const result = await processPage(page, options);
    attempts.push(result.attempt);

    if (result.groundTruth) {
      groundTruths.push(result.groundTruth);
      if (result.fromCache) {
        cachedCount++;
      } else {
        freshCount++;
      }
    }

    const status = result.attempt.success ? '✅' : '❌';
    const f1 = ((result.attempt.metrics?.f1 ?? 0) * 100).toFixed(1);
    const extracted = result.attempt.extractedEntities.length;
    print(`  ${status} F1: ${f1}% | Extracted: ${extracted} entities`);
    print('');
  }

  // Calculate metrics
  const metrics = calculateIterationMetrics(attempts);

  // Analyze failures and generate suggestions
  const improvements = analyzeFailures(attempts);

  // Build result
  const result: AgentIterationResult = {
    iterationId: `iter-${Date.now()}`,
    timestamp: new Date(),
    config: {
      sampleSize: options.sampleSize,
      targetF1: options.targetF1,
      maxIterations: 1,
      minMatchConfidence: 0.6,
      parallel: false,
      concurrency: 1,
      pageTimeoutMs: 30000,
      saveResults: true,
      outputDir: options.outputDir,
      filters: {
        urlTypes: options.urlTypes,
        sources: options.sources,
        requireAnilistId: true,
      },
    },
    samples: sampledPages,
    groundTruths,
    attempts,
    metrics,
    improvements,
    durationMs: Date.now() - startTime,
    targetMet: metrics.overall.microF1 >= options.targetF1,
    summary: {
      totalPages: sampledPages.length,
      successfulPages: attempts.filter(a => a.success).length,
      failedPages: attempts.filter(a => !a.success).length,
      cachedGroundTruths: cachedCount,
      freshGroundTruths: freshCount,
    },
  };

  // Print results
  print('='.repeat(70));
  print('ITERATION RESULTS');
  print('='.repeat(70));
  print('');
  print(`Total Pages: ${result.summary.totalPages}`);
  print(`Successful: ${result.summary.successfulPages}`);
  print(`Failed: ${result.summary.failedPages}`);
  print(`Cached Ground Truths: ${result.summary.cachedGroundTruths}`);
  print(`Fresh Ground Truths: ${result.summary.freshGroundTruths}`);

  printMetricsSummary(metrics);
  printEntityCoverage(attempts);

  // Print improvement suggestions
  print('');
  print(generateImprovementSummary(improvements));

  // Check if target met
  print('');
  if (result.targetMet) {
    print(`✅ TARGET MET! F1 >= ${(options.targetF1 * 100).toFixed(0)}%`);
  } else {
    print(`❌ Target not met. Current F1: ${(metrics.overall.microF1 * 100).toFixed(1)}%, Target: ${(options.targetF1 * 100).toFixed(0)}%`);
  }

  // Save results
  saveIterationResult(result, options);

  return result;
}

// ============================================================================
// Entry Point
// ============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const options: IterationOptions = { ...DEFAULT_OPTIONS };

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--sample-size' && args[i + 1]) {
    options.sampleSize = parseInt(args[++i] ?? '15', 10);
  } else if (arg === '--sources' && args[i + 1]) {
    options.sources = (args[++i] ?? '').split(',') as Array<'fandom' | 'wikipedia' | 'comicvine'>;
  } else if (arg === '--page-types' && args[i + 1]) {
    options.urlTypes = (args[++i] ?? '').split(',') as DiscoveredUrlType[];
  } else if (arg === '--no-cache') {
    options.useCache = false;
  } else if (arg === '--help') {
    print('Usage: bun run scripts/agent-ground-truth-iteration.ts [options]');
    print('');
    print('Options:');
    print('  --sample-size <n>      Number of pages to sample (default: 15)');
    print('  --sources <list>       Comma-separated sources: fandom,wikipedia,comicvine');
    print('  --page-types <list>    Comma-separated page types: MANGA_PAGE,VOLUMES,CHAPTERS');
    print('  --no-cache             Disable ground truth caching');
    print('  --help                 Show this help message');
    process.exit(0);
  }
}

runIteration(options).catch(err => {
  process.stderr.write('Error: ' + String(err) + '\n');
  process.exit(1);
});
