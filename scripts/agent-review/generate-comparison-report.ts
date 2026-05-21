/**
 * Generate markdown comparison report from analysis results
 *
 * Usage: bunx ts-node scripts/agent-review/generate-comparison-report.ts "<manga-title>"
 *
 * Requires:
 *   - .claude/agent-review/<slug>-analysis.json (from analyze-labels.ts)
 *   - .claude/agent-review/<slug>-ground-truth.json
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AnalysisResult, GroundTruth } from './types/ground-truth';

function log(message: string): void {
  process.stdout.write(message + '\n');
}

function getSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// Report Section Generators
// ============================================================================

function generateHeader(analysis: AnalysisResult, groundTruth: GroundTruth): string {
  const lines: string[] = [
    `# ${analysis.title} Ground Truth Comparison Report`,
    '',
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    `**Total Pages in Database:** ${analysis.summary.totalPages}`,
    `**Status Breakdown:** ${Object.entries(analysis.summary.pagesByStatus).map(([k, v]) => `${v} ${k}`).join(', ')}`,
    '',
    '---',
    '',
  ];
  return lines.join('\n');
}

function generateQualitySummary(analysis: AnalysisResult): string {
  const lines: string[] = [
    '## Annotation Quality Summary',
    '',
    '### What\'s Working Well',
    '',
    '| Aspect | Status | Notes |',
    '|--------|--------|-------|',
  ];

  const labelTypes = Object.keys(analysis.labelsByType);
  const workingWell = labelTypes.filter((lt) => analysis.labelsByType[lt].count > 0);

  for (const entityType of workingWell.slice(0, 8)) {
    const stats = analysis.labelsByType[entityType];
    lines.push(`| ${entityType} | ✅ Found | ${stats.count} occurrences across ${stats.pageCount} pages |`);
  }

  lines.push('', '### Issues Found', '', '| Issue | Severity | Description |', '|-------|----------|-------------|');

  for (const issue of analysis.issues) {
    const icon = issue.severity === 'high' ? '🔴 High' : issue.severity === 'medium' ? '🟡 Medium' : '🟢 Low';
    lines.push(`| ${issue.category} | ${icon} | ${issue.description} |`);
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

function generateGroundTruthComparison(analysis: AnalysisResult, groundTruth: GroundTruth): string {
  const lines: string[] = [
    '## Ground Truth vs. Actual Comparison',
    '',
    '### Core Metadata',
    '',
    '| Field | Ground Truth | Found in Labels |',
    '|-------|--------------|-----------------|',
  ];

  const check = analysis.coreMetadataCheck;
  const fields = [
    { name: 'Title', check: check.title },
    { name: 'Author', check: check.author },
    { name: 'Publisher', check: check.publisher },
    { name: 'Demographic', check: check.demographic },
    { name: 'Magazine', check: check.magazine },
    { name: 'Status', check: check.status },
    { name: 'Genres', check: check.genres },
    { name: 'Volume Count', check: check.volumeCount },
    { name: 'Chapter Count', check: check.chapterCount },
  ];

  for (const { name, check: fieldCheck } of fields) {
    const expected = Array.isArray(fieldCheck.expected)
      ? fieldCheck.expected.join(', ')
      : String(fieldCheck.expected);
    const status = fieldCheck.found
      ? fieldCheck.matches ? '✅ Correct' : `⚠️ Found: ${fieldCheck.actual.join(', ')}`
      : '❌ Not labeled';
    lines.push(`| **${name}** | ${expected} | ${status} |`);
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

function generateVolumeDetails(analysis: AnalysisResult, groundTruth: GroundTruth): string {
  if (analysis.volumeChecks.length === 0) {
    return '';
  }

  const lines: string[] = [
    '## Volume Details',
    '',
    '| Volume | Number Found | ISBN Found | Issues |',
    '|--------|--------------|------------|--------|',
  ];

  for (const vol of analysis.volumeChecks) {
    const numStatus = vol.volumeNumberFound ? '✅' : '❌';
    const isbnStatus = vol.isbnFound ? '✅' : vol.isbnValue ? '❌' : 'N/A';
    const issues = vol.issues.length > 0 ? vol.issues.join('; ') : 'None';
    lines.push(`| Vol ${vol.volumeNumber} | ${numStatus} | ${isbnStatus} | ${issues} |`);
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

function generateStatusComparison(analysis: AnalysisResult): string {
  const comp = analysis.statusComparison;
  if (!comp) {
    return '';
  }

  const lines: string[] = [
    '## BOOTSTRAP vs AGENT_REVIEWED Comparison',
    '',
    '| Metric | BOOTSTRAP | AGENT_REVIEWED |',
    '|--------|-----------|----------------|',
    `| Page Count | ${comp.bootstrapCount} | ${comp.agentReviewedCount} |`,
    `| Avg Labels/Page | ${comp.qualityMetrics.bootstrapAvgLabels} | ${comp.qualityMetrics.agentReviewedAvgLabels} |`,
    `| Core Metadata Types | ${comp.qualityMetrics.bootstrapCoreMetadata}/5 | ${comp.qualityMetrics.agentReviewedCoreMetadata}/5 |`,
    '',
  ];

  if (comp.agentReviewedOnlyEntities.length > 0) {
    lines.push(`**Entities only in AGENT_REVIEWED:** ${comp.agentReviewedOnlyEntities.join(', ')}`);
    lines.push('');
  }

  if (comp.findings.length > 0) {
    lines.push('### Key Findings', '');
    for (const finding of comp.findings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
  }

  lines.push('---', '');
  return lines.join('\n');
}

function generateRecommendations(analysis: AnalysisResult): string {
  const highPriority = analysis.issues.filter((i) => i.severity === 'high');
  const mediumPriority = analysis.issues.filter((i) => i.severity === 'medium');

  const lines: string[] = [
    '## Recommendations',
    '',
    '### High Priority Fixes',
    '',
  ];

  if (highPriority.length === 0) {
    lines.push('No high priority issues found.');
  } else {
    for (let i = 0; i < highPriority.length; i++) {
      const issue = highPriority[i];
      lines.push(`${i + 1}. **${issue.category}**: ${issue.recommendation}`);
    }
  }

  lines.push('', '### Medium Priority Fixes', '');

  if (mediumPriority.length === 0) {
    lines.push('No medium priority issues found.');
  } else {
    for (let i = 0; i < mediumPriority.length; i++) {
      const issue = mediumPriority[i];
      lines.push(`${i + 1}. **${issue.category}**: ${issue.recommendation}`);
    }
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

function generateNextSteps(analysis: AnalysisResult): string {
  const lines: string[] = [
    '## Next Steps',
    '',
    '1. Review and fix high priority issues identified above',
    '2. Create corrected ground truth annotations for 5-10 sample pages',
    '3. Update bootstrap labeler rules based on findings',
    '4. Re-run validation after fixes to measure improvement',
    '',
  ];

  return lines.join('\n');
}

// ============================================================================
// Main Report Generation
// ============================================================================

function generateReport(analysis: AnalysisResult, groundTruth: GroundTruth): string {
  const sections = [
    generateHeader(analysis, groundTruth),
    generateQualitySummary(analysis),
    generateGroundTruthComparison(analysis, groundTruth),
    generateVolumeDetails(analysis, groundTruth),
    generateStatusComparison(analysis),
    generateRecommendations(analysis),
    generateNextSteps(analysis),
  ];

  return sections.filter(Boolean).join('\n');
}

async function main(): Promise<void> {
  const mangaTitle = process.argv[2];

  if (!mangaTitle) {
    log('Usage: bunx ts-node scripts/agent-review/generate-comparison-report.ts "<manga-title>"');
    log('');
    log('Requires:');
    log('  .claude/agent-review/<slug>-analysis.json');
    log('  .claude/agent-review/<slug>-ground-truth.json');
    process.exit(1);
  }

  const slug = getSlug(mangaTitle);
  const baseDir = path.join(process.cwd(), '.claude', 'agent-review');
  const analysisPath = path.join(baseDir, `${slug}-analysis.json`);
  const groundTruthPath = path.join(baseDir, `${slug}-ground-truth.json`);

  if (!fs.existsSync(analysisPath)) {
    log(`Analysis file not found: ${analysisPath}`);
    log('Run analyze-labels.ts first.');
    process.exit(1);
  }

  if (!fs.existsSync(groundTruthPath)) {
    log(`Ground truth file not found: ${groundTruthPath}`);
    process.exit(1);
  }

  const analysis: AnalysisResult = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  const groundTruth: GroundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

  const report = generateReport(analysis, groundTruth);

  const outputPath = path.join(baseDir, `${slug}-ground-truth-comparison.md`);
  fs.writeFileSync(outputPath, report);

  log(`[report] Generated comparison report: ${outputPath}`);
  log(`\nReport preview:\n${'='.repeat(60)}`);
  log(report.slice(0, 1500) + (report.length > 1500 ? '\n...(truncated)' : ''));
}

main().catch((error: unknown) => {
  process.stderr.write(`[report] Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
