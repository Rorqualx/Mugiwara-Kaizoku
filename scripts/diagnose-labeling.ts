/**
 * Diagnostic script for auto-labeling system
 * Run with: bun run scripts/diagnose-labeling.ts
 */
import { runSingleIteration } from '../src/server/services/auto-labeling';

// Use process.stdout for CLI output
const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

async function diagnose(): Promise<void> {
  print('Running diagnostic with 15 samples...\n');

  const result = await runSingleIteration({ sampleSize: 15 });

  // Group by error type
  const byError = new Map<string, number>();
  for (const a of result.attempts) {
    const key = a.errorCategory ?? 'SUCCESS';
    byError.set(key, (byError.get(key) ?? 0) + 1);
  }

  print('\n=== Error Distribution ===');
  const sortedErrors = Array.from(byError.entries()).sort((a, b) => b[1] - a[1]);
  for (const [error, count] of sortedErrors) {
    print(`${error}: ${count} (${((count / result.attempts.length) * 100).toFixed(0)}%)`);
  }

  // Show entity type gaps
  print('\n=== Entity Type Coverage ===');
  const gaps = new Map<string, { extracted: number; expected: number; matched: number }>();

  for (const a of result.attempts) {
    for (const e of a.extractedEntities) {
      const g = gaps.get(e.type) ?? { extracted: 0, expected: 0, matched: 0 };
      g.extracted++;
      gaps.set(e.type, g);
    }
    for (const e of a.expectedEntities) {
      const g = gaps.get(e.type) ?? { extracted: 0, expected: 0, matched: 0 };
      g.expected++;
      gaps.set(e.type, g);
    }
    if (a.metrics) {
      // Count matches by looking at true positives
      for (const [type, m] of Object.entries(a.metrics.byEntityType)) {
        const g = gaps.get(type) ?? { extracted: 0, expected: 0, matched: 0 };
        g.matched += m.truePositives;
        gaps.set(type, g);
      }
    }
  }

  for (const [type, g] of Array.from(gaps.entries()).sort((a, b) => b[1].expected - a[1].expected)) {
    const coverage = g.expected > 0 ? (g.extracted / g.expected * 100).toFixed(0) : 'N/A';
    const matchRate = g.extracted > 0 ? (g.matched / g.extracted * 100).toFixed(0) : 'N/A';
    print(`${type.padEnd(15)}: extracted=${g.extracted.toString().padStart(3)}, expected=${g.expected.toString().padStart(3)}, matched=${g.matched.toString().padStart(3)} (coverage: ${coverage}%, match: ${matchRate}%)`);
  }

  // Show sample failures with details
  print('\n=== Sample Failures ===');
  const failures = result.attempts.filter(a => !a.success).slice(0, 5);
  for (const f of failures) {
    print(`\n${f.page.title} (${f.errorCategory})`);
    print(`  URL: ${f.page.url}`);
    print(`  Extracted (${f.extractedEntities.length}):`);
    for (const e of f.extractedEntities.slice(0, 5)) {
      print(`    - ${e.type}: "${e.value}" (${(e.confidence * 100).toFixed(0)}%)`);
    }
    print(`  Expected (${f.expectedEntities.length}):`);
    for (const e of f.expectedEntities.slice(0, 5)) {
      print(`    - ${e.type}: "${e.value}"`);
    }
  }

  // Recommendations
  print('\n=== Recommendations ===');
  const recommendations: string[] = [];

  const noContent = byError.get('NO_CONTENT') ?? 0;
  if (noContent > result.attempts.length * 0.3) {
    recommendations.push('HIGH: Many pages have NO_CONTENT - check if URLs point to actual content pages vs category/list pages');
  }

  const parserFailed = byError.get('PARSER_SELECTION_FAILED') ?? 0;
  if (parserFailed > 0) {
    recommendations.push('MEDIUM: Parser selection failing - review static analyzer confidence thresholds');
  }

  const titleGap = gaps.get('TITLE');
  if (titleGap && titleGap.matched < titleGap.expected * 0.5) {
    recommendations.push('HIGH: TITLE matching low - check title normalization (romanization, punctuation)');
  }

  const authorGap = gaps.get('AUTHOR');
  if (authorGap && authorGap.extracted < authorGap.expected * 0.3) {
    recommendations.push('MEDIUM: AUTHOR extraction low - parsers may not be extracting author field');
  }

  if (recommendations.length === 0) {
    recommendations.push('No critical issues detected');
  }

  for (const r of recommendations) {
    print(`- ${r}`);
  }

  print(`\n=== Summary ===`);
  print(`Total: ${result.attempts.length} pages`);
  print(`Success: ${result.attempts.filter(a => a.success).length}`);
  print(`Failed: ${result.attempts.filter(a => !a.success).length}`);
  print(`Avg F1: ${(result.metrics.avgF1 * 100).toFixed(1)}%`);
}

diagnose().catch((err: unknown) => {
  process.stderr.write(String(err) + '\n');
});
