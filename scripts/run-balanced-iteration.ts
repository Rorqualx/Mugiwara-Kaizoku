#!/usr/bin/env bun
/**
 * Run a balanced iteration with 5 Fandom + 5 Wikipedia + 5 ComicVine pages.
 * Uses specific AniList IDs from the iteration plan.
 *
 * Run with: bun run scripts/run-balanced-iteration.ts
 */

import { runSingleIteration } from '../src/server/services/auto-labeling';

// Use process.stdout for CLI output
const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

const PLANNED_ANILIST_IDS = [
  // Fandom (5)
  110785, // 2.5 Dimensional Seduction
  127008, // 7th Time Loop
  98610,  // 86--EIGHTY-SIX
  127157, // #DRCL midnight children
  97371,  // 100-man no Inochi no Ue ni Ore wa Tatte Iru

  // Wikipedia (5)
  176074, // Afterglow
  53419,  // 5 Centimeters per Second
  138347, // 100 Ghost Stories That Will Lead to My Own Death
  86646,  // Akashic Records of Bastard Magic Instructor
  102259, // A Good Day to Be a Dog

  // ComicVine (5)
  110095, // A Business Proposal
  156158, // A Beast's Love Is Like the Moon
  154798, // 404 Demons
  108360, // A White Rose in Bloom
  30003,  // 20th Century Boys
];

async function main(): Promise<void> {
  print('='.repeat(70));
  print('BALANCED ITERATION: 5 Fandom + 5 Wikipedia + 5 ComicVine');
  print('='.repeat(70));
  print('');
  print('AniList IDs: ' + PLANNED_ANILIST_IDS.join(', '));
  print('');

  const result = await runSingleIteration({
    sampleSize: 50, // High sample size to get all pages from these IDs
    targetF1: 0.85,
    maxIterations: 1,
    minMatchConfidence: 0.6,
    parallel: true,
    concurrency: 3,
    pageTimeoutMs: 30000,
    saveResults: true,
    outputDir: 'data/auto-labeling/iterations',
    filters: {
      requireAnilistId: true,
      includeAnilistIds: PLANNED_ANILIST_IDS,
      sources: ['fandom', 'wikipedia', 'comicvine'],
      // Include all main page types: series pages, volume lists, chapter lists
      urlTypes: ['MANGA_PAGE', 'VOLUMES', 'CHAPTERS', 'CHAPTERS_VOLUMES'],
    },
  });

  // Print summary
  print('');
  print('='.repeat(70));
  print('ITERATION COMPLETE');
  print('='.repeat(70));
  print('');
  print('Total Pages: ' + result.attempts.length.toString());
  print('Success: ' + result.attempts.filter(a => a.success).length.toString());
  print('Failed: ' + result.attempts.filter(a => !a.success).length.toString());
  print('');

  // Group by source
  const bySource = {
    fandom: result.attempts.filter(a => a.page.source === 'fandom'),
    wikipedia: result.attempts.filter(a => a.page.source === 'wikipedia'),
    comicvine: result.attempts.filter(a => a.page.source === 'comicvine'),
  };

  for (const [source, attempts] of Object.entries(bySource)) {
    if (attempts.length === 0) continue;

    const avgF1 = attempts.reduce((sum, a) => sum + (a.metrics?.f1 ?? 0), 0) / attempts.length;
    const successful = attempts.filter(a => a.success).length;

    print('=== ' + source.toUpperCase() + ' (' + attempts.length.toString() + ' pages) ===');
    print('  Success: ' + successful.toString() + '/' + attempts.length.toString());
    print('  Avg F1: ' + (avgF1 * 100).toFixed(1) + '%');
    print('');

    for (const attempt of attempts) {
      const status = attempt.success ? '✅' : '❌';
      const f1 = (attempt.metrics?.f1 ?? 0) * 100;
      print('  ' + status + ' ' + attempt.page.title + ' (F1: ' + f1.toFixed(1) + '%)');
    }
    print('');
  }

  // Group by URL type
  print('=== BY PAGE TYPE ===');
  const urlTypes = ['MANGA_PAGE', 'VOLUMES', 'CHAPTERS', 'CHAPTERS_VOLUMES'] as const;
  for (const urlType of urlTypes) {
    const typeAttempts = result.attempts.filter(a => a.page.urlType === urlType);
    if (typeAttempts.length === 0) continue;

    const typeF1 = typeAttempts.reduce((sum, a) => sum + (a.metrics?.f1 ?? 0), 0) / typeAttempts.length;
    const typeSuccess = typeAttempts.filter(a => a.success).length;

    print('  ' + urlType + ': ' + typeSuccess.toString() + '/' + typeAttempts.length.toString() + ' success, F1=' + (typeF1 * 100).toFixed(1) + '%');
  }
  print('');

  // Overall metrics
  const totalF1 = result.attempts.reduce((sum, a) => sum + (a.metrics?.f1 ?? 0), 0);
  const avgF1 = result.attempts.length > 0 ? totalF1 / result.attempts.length : 0;

  print('='.repeat(70));
  print('OVERALL AVG F1: ' + (avgF1 * 100).toFixed(1) + '%');
  print('TARGET: 85%');
  print('='.repeat(70));
}

main().catch(err => {
  process.stderr.write('Error: ' + String(err) + '\n');
  process.exit(1);
});
