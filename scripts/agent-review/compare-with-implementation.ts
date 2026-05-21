/**
 * Compare validation findings with current bootstrap/agent review implementation
 *
 * Phase 6: Identify optimization opportunities without breaking existing functionality
 *
 * Usage: bunx ts-node scripts/agent-review/compare-with-implementation.ts "<manga-title>"
 *
 * Requires:
 *   - .claude/agent-review/<slug>-analysis.json (from analyze-labels.ts)
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AnalysisIssue, AnalysisResult, StatusComparison } from './types/ground-truth';
import type {
  AgentReviewOptimization,
  BootstrapOptimization,
  IMPLEMENTATION_REFS,
  OptimizationAnalysis,
  OptimizationSummary,
  PatternImprovement,
} from './types/optimization-types';

function log(message: string): void {
  process.stdout.write(message + '\n');
}

function getSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// Bootstrap Optimization Detection
// ============================================================================

function detectMissingPatternOptimizations(analysis: AnalysisResult): BootstrapOptimization[] {
  const optimizations: BootstrapOptimization[] = [];
  const missingLabels = analysis.issues.filter((i) => i.category === 'missing_label');

  for (const issue of missingLabels) {
    const entityType = issue.entityType ?? 'UNKNOWN';

    optimizations.push({
      id: `bootstrap-missing-${entityType.toLowerCase()}`,
      category: 'missing_pattern',
      impact: issue.severity === 'high' ? 'high' : 'medium',
      entityType,
      issue: issue.description,
      currentBehavior: `${entityType} not being extracted from page content`,
      proposedChange: `Add pattern detection or CSS selector for ${entityType}`,
      affectedFiles: [
        'src/server/ml/training/bootstrap-labeler/pattern-detector/label-mapping.ts',
        'src/server/ml/training/bootstrap-labeler/entity-labelers.ts',
      ],
      codeLocation: 'LABEL_MAPPING and ENTITY_LABELERS in bootstrap-labeler',
      samples: issue.samples,
      breakingRisk: 'none',
      implementation: `Add "${entityType.toLowerCase()}" to LABEL_TEXT_TO_ENTITY_TYPE map`,
    });
  }

  return optimizations;
}

function detectOverLabelingOptimizations(analysis: AnalysisResult): BootstrapOptimization[] {
  const optimizations: BootstrapOptimization[] = [];
  const overLabeling = analysis.issues.filter((i) => i.category === 'over_labeling');

  for (const issue of overLabeling) {
    const entityType = issue.entityType ?? 'UNKNOWN';

    optimizations.push({
      id: `bootstrap-overlabel-${entityType.toLowerCase()}-${optimizations.length}`,
      category: 'over_labeling',
      impact: 'medium',
      entityType,
      issue: issue.description,
      currentBehavior: `Navigation/metadata text incorrectly labeled as ${entityType}`,
      proposedChange: 'Add navigation filtering before labeling',
      affectedFiles: [
        'src/server/ml/training/bootstrap-labeler/index.ts',
        'src/server/ml/training/agent-review/validation-rules/patterns.ts',
      ],
      codeLocation: 'Phase 1 (HTML Cleaning) or Phase 7 (BIO Label Generation)',
      samples: issue.samples,
      breakingRisk: 'low',
      implementation: 'Add patterns to NAVIGATION_PATTERNS or cleanHtml() function',
    });
  }

  return optimizations;
}

function detectSourceSpecificOptimizations(analysis: AnalysisResult): BootstrapOptimization[] {
  const optimizations: BootstrapOptimization[] = [];
  const sources = Object.keys(analysis.summary.pagesBySource);

  // Check if certain sources have consistently worse labeling
  const sourceQuality: Record<string, number> = {};
  for (const source of sources) {
    // Heuristic: sources with fewer entity types likely have missing patterns
    const entityCount = Object.keys(analysis.labelsByType).length;
    sourceQuality[source] = entityCount;
  }

  const avgQuality = Object.values(sourceQuality).reduce((a, b) => a + b, 0) / sources.length;

  for (const [source, quality] of Object.entries(sourceQuality)) {
    if (quality < avgQuality * 0.7) {
      optimizations.push({
        id: `bootstrap-source-${source.toLowerCase()}`,
        category: 'source_specific',
        impact: 'medium',
        entityType: 'MULTIPLE',
        issue: `${source} pages have fewer entity types than average`,
        currentBehavior: `${source} may be missing source-specific selectors`,
        proposedChange: `Review and enhance ${source} CSS selectors`,
        affectedFiles: [
          `src/server/ml/training/bootstrap-labeler/source-selectors/${source.toLowerCase()}.ts`,
          `src/server/ml/training/bootstrap-labeler/source-rules/${source.toLowerCase()}-rules.ts`,
        ],
        breakingRisk: 'none',
        implementation: `Add missing CSS selectors for ${source} infobox/metadata sections`,
      });
    }
  }

  return optimizations;
}

// ============================================================================
// Agent Review Optimization Detection
// ============================================================================

function detectValidationGaps(analysis: AnalysisResult): AgentReviewOptimization[] {
  const optimizations: AgentReviewOptimization[] = [];

  // Check for mislabeling issues that weren't caught
  const mislabeling = analysis.issues.filter((i) => i.category === 'mislabeling');

  for (const issue of mislabeling) {
    const entityType = issue.entityType ?? 'UNKNOWN';

    optimizations.push({
      id: `review-validation-${entityType.toLowerCase()}`,
      category: 'too_lenient',
      impact: issue.severity === 'high' ? 'high' : 'medium',
      entityType,
      issue: `Agent review did not catch: ${issue.description}`,
      currentRule: `Current ${entityType} validation rules may be incomplete`,
      proposedRule: `Add stricter validation for ${entityType}`,
      affectedFiles: ['src/server/ml/training/agent-review/validation-rules/entity-rules.ts'],
      samples: issue.samples,
      breakingRisk: 'low',
      compatibilityNotes: 'Review existing GOLD pages to ensure rule does not reject valid data',
    });
  }

  return optimizations;
}

function detectContextCheckGaps(analysis: AnalysisResult): AgentReviewOptimization[] {
  const optimizations: AgentReviewOptimization[] = [];
  const navigationNoise = analysis.issues.filter((i) => i.category === 'navigation_noise');

  if (navigationNoise.length > 0) {
    optimizations.push({
      id: 'review-navigation-context',
      category: 'missing_context_check',
      impact: 'medium',
      entityType: 'MULTIPLE',
      issue: 'Navigation elements being labeled as content',
      currentRule: 'NAVIGATION_PATTERNS may not cover all wiki navigation text',
      proposedRule: 'Expand NAVIGATION_PATTERNS with additional wiki/fandom patterns',
      affectedFiles: ['src/server/ml/training/agent-review/validation-rules/patterns.ts'],
      samples: navigationNoise.flatMap((i) => i.samples ?? []),
      breakingRisk: 'none',
      compatibilityNotes: 'Adding patterns only rejects; cannot break valid data',
    });
  }

  return optimizations;
}

function detectStatusComparisonInsights(comparison: StatusComparison | undefined): AgentReviewOptimization[] {
  if (!comparison) return [];

  const optimizations: AgentReviewOptimization[] = [];

  // If AGENT_REVIEWED has significantly better core metadata, bootstrap needs improvement
  const bootstrapCore = comparison.qualityMetrics.bootstrapCoreMetadata;
  const reviewedCore = comparison.qualityMetrics.agentReviewedCoreMetadata;

  if (reviewedCore > bootstrapCore + 1) {
    optimizations.push({
      id: 'review-bootstrap-gap',
      category: 'critical_entity_gap',
      impact: 'high',
      entityType: 'CORE_METADATA',
      issue: `BOOTSTRAP pages missing ${reviewedCore - bootstrapCore} core entity types vs AGENT_REVIEWED`,
      currentRule: 'Bootstrap not extracting core metadata from certain page types',
      proposedRule: 'Enhance bootstrap to extract core metadata from series overview pages',
      affectedFiles: [
        'src/server/ml/training/bootstrap-labeler/index.ts',
        'src/server/ml/training/bootstrap-labeler/positional-heuristics.ts',
      ],
      breakingRisk: 'low',
      compatibilityNotes: 'Adding extraction; existing functionality unchanged',
    });
  }

  return optimizations;
}

// ============================================================================
// Pattern Improvement Detection
// ============================================================================

function detectPatternImprovements(analysis: AnalysisResult): PatternImprovement[] {
  const improvements: PatternImprovement[] = [];

  // Check for boundary errors
  const boundaryErrors = analysis.issues.filter((i) => i.category === 'boundary_error');

  for (const issue of boundaryErrors) {
    improvements.push({
      id: `pattern-boundary-${improvements.length}`,
      patternType: 'label_value',
      impact: 'medium',
      entityTypes: [issue.entityType ?? 'UNKNOWN'],
      issue: issue.description,
      missingPattern: 'Pattern boundary detection not capturing full value',
      examples: issue.samples ?? [],
      affectedFile: 'src/server/ml/training/bootstrap-labeler/pattern-detector/detectors.ts',
      implementation: 'Adjust span boundary logic in detectLabelColonValuePatterns',
    });
  }

  // Check for value mismatches suggesting pattern gaps
  const valueMismatches = analysis.issues.filter((i) => i.category === 'value_mismatch');

  for (const issue of valueMismatches) {
    improvements.push({
      id: `pattern-value-${improvements.length}`,
      patternType: 'label_value',
      impact: 'medium',
      entityTypes: [issue.entityType ?? 'UNKNOWN'],
      issue: issue.description,
      missingPattern: 'Extracted value does not match ground truth',
      examples: issue.samples ?? [],
      affectedFile: 'src/server/ml/training/bootstrap-labeler/entity-labelers.ts',
      implementation: 'Review fuzzy matching thresholds or add alternative pattern',
    });
  }

  return improvements;
}

// ============================================================================
// Summary Generation
// ============================================================================

function generateSummary(
  bootstrapOpts: BootstrapOptimization[],
  reviewOpts: AgentReviewOptimization[],
  patterns: PatternImprovement[]
): OptimizationSummary {
  const all = [...bootstrapOpts, ...reviewOpts, ...patterns];

  const byImpact = {
    high: all.filter((o) => o.impact === 'high').length,
    medium: all.filter((o) => o.impact === 'medium').length,
    low: all.filter((o) => o.impact === 'low').length,
  };

  // Estimate accuracy gain: high=3%, medium=1%, low=0.5%
  const estimatedGain = byImpact.high * 3 + byImpact.medium * 1 + byImpact.low * 0.5;

  // Assess overall risk
  const highRiskCount = [...bootstrapOpts, ...reviewOpts].filter(
    (o) => 'breakingRisk' in o && o.breakingRisk === 'high'
  ).length;

  return {
    totalOptimizations: all.length,
    byImpact,
    byCategory: {
      bootstrap: bootstrapOpts.length,
      agentReview: reviewOpts.length,
      patterns: patterns.length,
    },
    estimatedAccuracyGain: Math.min(estimatedGain, 15), // Cap at 15%
    riskLevel: highRiskCount > 2 ? 'high' : highRiskCount > 0 ? 'medium' : 'low',
  };
}

// ============================================================================
// Main Analysis
// ============================================================================

async function compareWithImplementation(mangaTitle: string): Promise<OptimizationAnalysis | null> {
  const slug = getSlug(mangaTitle);
  const baseDir = path.join(process.cwd(), '.claude', 'agent-review');
  const analysisPath = path.join(baseDir, `${slug}-analysis.json`);

  if (!fs.existsSync(analysisPath)) {
    log(`Analysis file not found: ${analysisPath}`);
    log('Run analyze-labels.ts first.');
    return null;
  }

  const analysis: AnalysisResult = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

  log(`[compare] Analyzing ${analysis.issues.length} issues from validation...`);

  // Detect optimizations
  const bootstrapOpts: BootstrapOptimization[] = [
    ...detectMissingPatternOptimizations(analysis),
    ...detectOverLabelingOptimizations(analysis),
    ...detectSourceSpecificOptimizations(analysis),
  ];

  const reviewOpts: AgentReviewOptimization[] = [
    ...detectValidationGaps(analysis),
    ...detectContextCheckGaps(analysis),
    ...detectStatusComparisonInsights(analysis.statusComparison),
  ];

  const patterns = detectPatternImprovements(analysis);

  const result: OptimizationAnalysis = {
    title: mangaTitle,
    slug,
    analyzedAt: new Date().toISOString(),
    bootstrapOptimizations: bootstrapOpts,
    agentReviewOptimizations: reviewOpts,
    patternImprovements: patterns,
    summary: generateSummary(bootstrapOpts, reviewOpts, patterns),
  };

  // Save results
  const outputPath = path.join(baseDir, `${slug}-optimizations.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  log(`[compare] Optimization analysis saved to ${outputPath}`);

  return result;
}

function printUsage(): void {
  log('Usage: bunx ts-node scripts/agent-review/compare-with-implementation.ts "<manga-title>"');
  log('');
  log('Requires:');
  log('  .claude/agent-review/<slug>-analysis.json');
}

function printOptimizationSummary(result: OptimizationAnalysis): void {
  log('\n' + '='.repeat(60));
  log('OPTIMIZATION ANALYSIS SUMMARY');
  log('='.repeat(60));

  log(`\nTotal optimizations identified: ${result.summary.totalOptimizations}`);
  log(`Estimated accuracy improvement: +${result.summary.estimatedAccuracyGain.toFixed(1)}%`);
  log(`Overall risk level: ${result.summary.riskLevel.toUpperCase()}`);

  log('\n--- By Impact ---');
  log(`  🔴 High:   ${result.summary.byImpact.high}`);
  log(`  🟡 Medium: ${result.summary.byImpact.medium}`);
  log(`  🟢 Low:    ${result.summary.byImpact.low}`);

  log('\n--- By Category ---');
  log(`  Bootstrap Labeler: ${result.summary.byCategory.bootstrap}`);
  log(`  Agent Review:      ${result.summary.byCategory.agentReview}`);
  log(`  Pattern Detection: ${result.summary.byCategory.patterns}`);

  if (result.bootstrapOptimizations.length > 0) {
    log('\n--- Bootstrap Optimizations ---');
    for (const opt of result.bootstrapOptimizations.slice(0, 5)) {
      const icon = opt.impact === 'high' ? '🔴' : opt.impact === 'medium' ? '🟡' : '🟢';
      log(`  ${icon} [${opt.category}] ${opt.entityType}: ${opt.issue.slice(0, 60)}...`);
    }
  }

  if (result.agentReviewOptimizations.length > 0) {
    log('\n--- Agent Review Optimizations ---');
    for (const opt of result.agentReviewOptimizations.slice(0, 5)) {
      const icon = opt.impact === 'high' ? '🔴' : opt.impact === 'medium' ? '🟡' : '🟢';
      log(`  ${icon} [${opt.category}] ${opt.entityType}: ${opt.issue.slice(0, 60)}...`);
    }
  }

  log('\n' + '='.repeat(60));
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];

  if (!mangaTitle) {
    printUsage();
    process.exit(1);
  }

  const result = await compareWithImplementation(mangaTitle);
  if (!result) {
    process.exit(1);
  }

  printOptimizationSummary(result);
}

main().catch((error: unknown) => {
  process.stderr.write(`[compare] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
