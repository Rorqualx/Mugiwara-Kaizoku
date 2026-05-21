/**
 * Generate optimization report from comparison analysis
 *
 * Usage: bunx ts-node scripts/agent-review/generate-optimization-report.ts "<manga-title>"
 *
 * Requires:
 *   - .claude/agent-review/<slug>-optimizations.json (from compare-with-implementation.ts)
 */

import * as fs from 'fs';
import * as path from 'path';

import type { OptimizationAnalysis, BootstrapOptimization, AgentReviewOptimization } from './types/optimization-types';

function log(message: string): void {
  process.stdout.write(message + '\n');
}

function getSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// Report Section Generators
// ============================================================================

function generateHeader(analysis: OptimizationAnalysis): string {
  return [
    `# ${analysis.title} - Optimization Report`,
    '',
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    `**Total Optimizations:** ${analysis.summary.totalOptimizations}`,
    `**Estimated Accuracy Gain:** +${analysis.summary.estimatedAccuracyGain.toFixed(1)}%`,
    `**Risk Level:** ${analysis.summary.riskLevel.toUpperCase()}`,
    '',
    '---',
    '',
  ].join('\n');
}

function generateExecutiveSummary(analysis: OptimizationAnalysis): string {
  const lines = [
    '## Executive Summary',
    '',
    '### Impact Distribution',
    '',
    '| Impact | Count | Description |',
    '|--------|-------|-------------|',
    `| 🔴 High | ${analysis.summary.byImpact.high} | Critical fixes for accuracy |`,
    `| 🟡 Medium | ${analysis.summary.byImpact.medium} | Recommended improvements |`,
    `| 🟢 Low | ${analysis.summary.byImpact.low} | Nice-to-have enhancements |`,
    '',
    '### Category Breakdown',
    '',
    '| Category | Count | Focus Area |',
    '|----------|-------|------------|',
    `| Bootstrap Labeler | ${analysis.summary.byCategory.bootstrap} | Pattern detection, entity extraction |`,
    `| Agent Review | ${analysis.summary.byCategory.agentReview} | Validation rules, context checks |`,
    `| Pattern Detection | ${analysis.summary.byCategory.patterns} | Boundary detection, pattern matching |`,
    '',
    '---',
    '',
  ];

  return lines.join('\n');
}

function generateBootstrapSection(optimizations: BootstrapOptimization[]): string {
  if (optimizations.length === 0) {
    return '## Bootstrap Labeler Optimizations\n\nNo optimizations identified.\n\n---\n\n';
  }

  const lines = [
    '## Bootstrap Labeler Optimizations',
    '',
    'These changes improve the initial auto-labeling accuracy.',
    '',
  ];

  // Group by category
  const byCategory: Record<string, BootstrapOptimization[]> = {};
  for (const opt of optimizations) {
    const existing = byCategory[opt.category] ?? [];
    existing.push(opt);
    byCategory[opt.category] = existing;
  }

  for (const category of Object.keys(byCategory)) {
    const opts = byCategory[category];
    lines.push(`### ${formatCategory(category)}`, '');

    for (const opt of opts) {
      const icon = opt.impact === 'high' ? '🔴' : opt.impact === 'medium' ? '🟡' : '🟢';
      const risk = opt.breakingRisk === 'none' ? '✅ Safe' : `⚠️ ${opt.breakingRisk} risk`;

      lines.push(
        `#### ${icon} ${opt.entityType}`,
        '',
        `**Issue:** ${opt.issue}`,
        '',
        `**Current Behavior:** ${opt.currentBehavior}`,
        '',
        `**Proposed Change:** ${opt.proposedChange}`,
        '',
        `**Breaking Risk:** ${risk}`,
        '',
        '**Files to Modify:**',
        ...opt.affectedFiles.map((f) => `- \`${f}\``),
        ''
      );

      if (opt.implementation) {
        lines.push(`**Implementation:** ${opt.implementation}`, '');
      }

      if (opt.samples && opt.samples.length > 0) {
        lines.push('**Samples:**', '```', ...opt.samples.slice(0, 3), '```', '');
      }

      lines.push('---', '');
    }
  }

  return lines.join('\n');
}

function generateAgentReviewSection(optimizations: AgentReviewOptimization[]): string {
  if (optimizations.length === 0) {
    return '## Agent Review Optimizations\n\nNo optimizations identified.\n\n---\n\n';
  }

  const lines = [
    '## Agent Review Optimizations',
    '',
    'These changes improve validation rules to catch more issues.',
    '',
  ];

  for (const opt of optimizations) {
    const icon = opt.impact === 'high' ? '🔴' : opt.impact === 'medium' ? '🟡' : '🟢';
    const risk = opt.breakingRisk === 'none' ? '✅ Safe' : `⚠️ ${opt.breakingRisk} risk`;

    lines.push(
      `### ${icon} [${formatCategory(opt.category)}] ${opt.entityType}`,
      '',
      `**Issue:** ${opt.issue}`,
      '',
      `**Current Rule:** ${opt.currentRule}`,
      '',
      `**Proposed Rule:** ${opt.proposedRule}`,
      '',
      `**Breaking Risk:** ${risk}`,
      '',
      '**Files to Modify:**',
      ...opt.affectedFiles.map((f) => `- \`${f}\``),
      ''
    );

    if (opt.compatibilityNotes) {
      lines.push(`**Compatibility Notes:** ${opt.compatibilityNotes}`, '');
    }

    if (opt.samples && opt.samples.length > 0) {
      lines.push('**Samples:**', '```', ...opt.samples.slice(0, 3), '```', '');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

function generatePatternSection(analysis: OptimizationAnalysis): string {
  const patterns = analysis.patternImprovements;

  if (patterns.length === 0) {
    return '## Pattern Detection Improvements\n\nNo improvements identified.\n\n---\n\n';
  }

  const lines = [
    '## Pattern Detection Improvements',
    '',
    'These changes improve pattern matching accuracy.',
    '',
    '| Pattern Type | Entity Types | Issue | File |',
    '|--------------|--------------|-------|------|',
  ];

  for (const p of patterns) {
    lines.push(
      `| ${p.patternType} | ${p.entityTypes.join(', ')} | ${p.issue.slice(0, 40)}... | \`${p.affectedFile.split('/').pop()}\` |`
    );
  }

  lines.push('', '---', '');

  return lines.join('\n');
}

function generateImplementationPlan(analysis: OptimizationAnalysis): string {
  const highImpact = [
    ...analysis.bootstrapOptimizations.filter((o) => o.impact === 'high'),
    ...analysis.agentReviewOptimizations.filter((o) => o.impact === 'high'),
  ];

  const safeChanges = [
    ...analysis.bootstrapOptimizations.filter((o) => o.breakingRisk === 'none'),
    ...analysis.agentReviewOptimizations.filter((o) => o.breakingRisk === 'none'),
  ];

  const lines = [
    '## Implementation Plan',
    '',
    '### Recommended Order',
    '',
    '1. **Start with safe, high-impact changes** - No breaking risk, maximum benefit',
    '2. **Add comprehensive tests** - Verify no regressions on existing GOLD pages',
    '3. **Implement low-risk changes** - Minor improvements with minimal risk',
    '4. **Review medium-risk changes** - Require careful testing',
    '',
    '### Phase 1: Safe High-Impact (Do First)',
    '',
  ];

  const safeHighImpact = highImpact.filter((o) => o.breakingRisk === 'none');
  if (safeHighImpact.length > 0) {
    for (const opt of safeHighImpact) {
      lines.push(`- [ ] **${opt.entityType}**: ${opt.issue.slice(0, 60)}`);
    }
  } else {
    lines.push('No safe high-impact changes identified.');
  }

  lines.push('', '### Phase 2: Safe Medium-Impact', '');

  const safeMedium = safeChanges.filter((o) => o.impact === 'medium');
  if (safeMedium.length > 0) {
    for (const opt of safeMedium.slice(0, 5)) {
      lines.push(`- [ ] **${opt.entityType}**: ${opt.issue.slice(0, 60)}`);
    }
  } else {
    lines.push('No safe medium-impact changes identified.');
  }

  lines.push(
    '',
    '### Verification Steps',
    '',
    '1. Run validation on existing GOLD pages to establish baseline',
    '2. Implement change',
    '3. Re-run validation - ensure no regressions',
    '4. Run on new test title to verify improvement',
    '',
    '---',
    ''
  );

  return lines.join('\n');
}

function generateNextSteps(): string {
  return [
    '## Next Steps',
    '',
    '1. **Review this report** - Prioritize optimizations based on your goals',
    '2. **Start with Phase 1** - Safe, high-impact changes first',
    '3. **Add tests** - Create test cases for each change',
    '4. **Implement incrementally** - One change at a time with verification',
    '5. **Re-run validation** - After changes, run `/validate-ml-labels` again',
    '6. **Compare metrics** - Track accuracy improvement over time',
    '',
    '---',
    '',
    '*Report generated by `/validate-ml-labels` Phase 6*',
    '',
  ].join('\n');
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================================
// Main Report Generation
// ============================================================================

function generateReport(analysis: OptimizationAnalysis): string {
  const sections = [
    generateHeader(analysis),
    generateExecutiveSummary(analysis),
    generateBootstrapSection(analysis.bootstrapOptimizations),
    generateAgentReviewSection(analysis.agentReviewOptimizations),
    generatePatternSection(analysis),
    generateImplementationPlan(analysis),
    generateNextSteps(),
  ];

  return sections.join('\n');
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];

  if (!mangaTitle) {
    log('Usage: bunx ts-node scripts/agent-review/generate-optimization-report.ts "<manga-title>"');
    log('');
    log('Requires:');
    log('  .claude/agent-review/<slug>-optimizations.json');
    process.exit(1);
  }

  const slug = getSlug(mangaTitle);
  const baseDir = path.join(process.cwd(), '.claude', 'agent-review');
  const optimizationsPath = path.join(baseDir, `${slug}-optimizations.json`);

  if (!fs.existsSync(optimizationsPath)) {
    log(`Optimizations file not found: ${optimizationsPath}`);
    log('Run compare-with-implementation.ts first.');
    process.exit(1);
  }

  const analysis: OptimizationAnalysis = JSON.parse(fs.readFileSync(optimizationsPath, 'utf-8'));
  const report = generateReport(analysis);

  const outputPath = path.join(baseDir, `${slug}-optimization-report.md`);
  fs.writeFileSync(outputPath, report);

  log(`[report] Generated optimization report: ${outputPath}`);
  log(`\nReport preview:\n${'='.repeat(60)}`);
  log(report.slice(0, 2000) + (report.length > 2000 ? '\n...(truncated)' : ''));
}

main().catch((error: unknown) => {
  process.stderr.write(`[report] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
