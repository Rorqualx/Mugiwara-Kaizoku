/**
 * MangaDex Accuracy — Report Generator
 *
 * Generates markdown reports and metrics JSON from test results.
 * Extracted from test-mangadex-accuracy.ts to keep files under 500 lines.
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/research/mangadex-accuracy');
const ITERATIONS_DIR = path.resolve(OUTPUT_DIR, 'iterations');

const STATUS_MAP: Record<string, string> = {
  ongoing: 'RELEASING', completed: 'FINISHED', hiatus: 'HIATUS', cancelled: 'CANCELLED',
  RELEASING: 'RELEASING', FINISHED: 'FINISHED', HIATUS: 'HIATUS', CANCELLED: 'CANCELLED',
  NOT_YET_RELEASED: 'NOT_YET_RELEASED',
};
function normalizeStatus(s: string | undefined | null): string {
  return STATUS_MAP[s ?? ''] ?? 'UNKNOWN';
}
/** Coarsen status for comparison: CANCELLED≈FINISHED, HIATUS≈RELEASING */
function coarsenStatus(s: string): string {
  if (s === 'CANCELLED') return 'FINISHED';
  if (s === 'HIATUS') return 'RELEASING';
  return s;
}

function ensureDir(d: string): void { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

export type GroundTruthSource = 'anilist' | 'mangadex' | 'mal' | 'both' | 'all' | 'none';

export interface AniListResult { id: number; idMal: number | null; chapters: number | null; volumes: number | null; status: string; titleEnglish: string | null; titleRomaji: string; titleNative: string | null; synonyms: string[]; year: number | null }

export interface MALResult { malId: number; title: string; titleEnglish: string | null; chapters: number | null; volumes: number | null; status: string; score: number | null }

export interface AggregateMetrics {
  totalVolumes: number; totalChapters: number;
  maxChapterNumber: number; maxVolumeNumber: number;
}

export interface CandidateSummary {
  mangaDexId: string; titleEn: string | null; titleJaRo: string | null;
  titleSimilarity: number; linksAl: string | null; status: string;
  lastChapter: string | null; lastVolume: string | null;
}

export interface DiscoveryDiagnostics {
  candidatesReturned: number; matchedMangaDexId: string | null;
  matchedTitle: string | null; titleSimilarity: number;
  linksAl: string | null; expectedAniListId: number | null;
  crossReferenceCorrect: boolean;
  expectedMangaDexId: string | null; expectedVerified: boolean;
  discoveryCorrect: boolean;
  topCandidates: CandidateSummary[];
}

export interface MangaDexResult {
  mangaDexId: string | null; status: string | null;
  lastChapter: string | null; lastVolume: string | null;
  chapterCount: number; volumeCount: number;
  hasEnglishChapters: boolean; linksAl: string | null;
  aggregate: AggregateMetrics | null;
  discovery: DiscoveryDiagnostics; durationMs: number; error?: string;
}

export interface MangaTestResult {
  title: string; slug: string;
  anilist: AniListResult | null; mal: MALResult | null; mangadex: MangaDexResult | null;
  timestamp: string; iteration?: number; dataCeiling?: boolean;
  groundTruthSource: GroundTruthSource;
  /** Corpus-embedded MangaDex ground truth (for MangaDex-only titles) */
  mangadexGT?: { chapters?: number; volumes?: number; status?: string };
}

export function saveResults(r: MangaTestResult): void {
  const iterSuffix = r.iteration !== undefined ? `-iter-${r.iteration}` : '';
  const dir = path.join(ITERATIONS_DIR, `${r.slug}${iterSuffix}`);
  ensureDir(dir);
  const summary = { title: r.title, timestamp: r.timestamp, iteration: r.iteration, anilist: r.anilist, mal: r.mal, mangadex: r.mangadex, groundTruthSource: r.groundTruthSource, mangadexGT: r.mangadexGT };
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
}

export function generateReport(results: MangaTestResult[]): string {
  const L: string[] = [];
  const iter = results[0]?.iteration;
  const dataCeilingCount = results.filter((r) => r.dataCeiling).length;
  const eligible = results.filter((r) => !r.dataCeiling);
  L.push('# MangaDex Accuracy Report' + (iter !== undefined ? ` (Iteration ${iter})` : ''));
  L.push('', `**Generated**: ${new Date().toISOString()}`, `**Titles tested**: ${results.length} (${dataCeilingCount} data ceiling excluded)`, '');

  // Discovery (exclude data ceiling)
  const withMd = eligible.filter((r) => r.mangadex);
  const discoverySuccess = withMd.filter((r) => r.mangadex?.mangaDexId).length;
  const crossRefCorrect = withMd.filter((r) => r.mangadex?.discovery.crossReferenceCorrect).length;
  const simSum = withMd.reduce((s, r) => s + (r.mangadex?.discovery.titleSimilarity ?? 0), 0);

  // ID match (verified titles only)
  const verifiedTitles = withMd.filter((r) => r.mangadex?.discovery.expectedVerified);
  const idMatchCorrect = verifiedTitles.filter((r) => r.mangadex?.discovery.discoveryCorrect).length;

  L.push('## Discovery', '', '| Metric | Value |', '|--------|-------|');
  L.push(`| Discovery Success | ${discoverySuccess}/${withMd.length} (${withMd.length > 0 ? ((discoverySuccess / withMd.length) * 100).toFixed(1) : 0}%) |`);
  L.push(`| Cross-Reference Correct (links.al) | ${crossRefCorrect}/${discoverySuccess} (${discoverySuccess > 0 ? ((crossRefCorrect / discoverySuccess) * 100).toFixed(1) : 0}%) |`);
  if (verifiedTitles.length > 0) L.push(`| ID Match (verified) | ${idMatchCorrect}/${verifiedTitles.length} (${((idMatchCorrect / verifiedTitles.length) * 100).toFixed(1)}%) |`);
  L.push(`| Avg Title Similarity | ${withMd.length > 0 ? (simSum / withMd.length).toFixed(2) : '0'} |`);
  L.push(`| Data Ceiling (excluded) | ${dataCeilingCount} |`);
  L.push('');

  // Accuracy (only for titles with AniList ground truth)
  const withGT = eligible.filter((r) => r.anilist?.chapters && r.anilist.chapters > 0 && r.mangadex);
  const chAccurate = withGT.filter((r) => {
    const diff = Math.abs((r.mangadex?.chapterCount ?? 0) - (r.anilist?.chapters ?? 0));
    return diff <= Math.ceil((r.anilist?.chapters ?? 1) * 0.05);
  }).length;
  const volAccurate = withGT.filter((r) => {
    if (!r.anilist?.volumes) return false;
    return Math.abs((r.mangadex?.volumeCount ?? 0) - r.anilist.volumes) <= Math.ceil(r.anilist.volumes * 0.1);
  }).length;
  // Only compare status for cross-ref correct titles — comparing against a wrong match is meaningless
  const xrefCorrect = withMd.filter((r) => r.mangadex?.discovery.crossReferenceCorrect);
  const statusMatch = xrefCorrect.filter((r) => r.anilist && coarsenStatus(normalizeStatus(r.mangadex?.status)) === coarsenStatus(normalizeStatus(r.anilist.status))).length;
  const withEn = withMd.filter((r) => r.mangadex?.hasEnglishChapters).length;
  const withAgg = withMd.filter((r) => r.mangadex?.aggregate).length;

  L.push('## Accuracy (vs AniList)', '', '| Metric | Value |', '|--------|-------|');
  L.push(`| Chapter Count (±5%) | ${chAccurate}/${withGT.length} (${withGT.length > 0 ? ((chAccurate / withGT.length) * 100).toFixed(1) : 0}%) |`);
  L.push(`| Volume Count (±10%) | ${volAccurate}/${withGT.length} |`);
  L.push(`| Status Match | ${statusMatch}/${xrefCorrect.length} (${xrefCorrect.length > 0 ? ((statusMatch / xrefCorrect.length) * 100).toFixed(1) : 0}%) |`);
  L.push(`| English Availability | ${withEn}/${withMd.length} |`);
  L.push(`| Aggregate Coverage | ${withAgg}/${withMd.length} |`);
  L.push('');

  // MangaDex Ground Truth accuracy (titles where groundTruthSource is 'mangadex' or 'both')
  const mdGTResults = eligible.filter((r) => r.mangadexGT && r.mangadex?.mangaDexId);
  if (mdGTResults.length > 0) {
    const mdGTChAccurate = mdGTResults.filter((r) => {
      const expected = r.mangadexGT?.chapters;
      if (!expected || expected <= 0) return false;
      return Math.abs((r.mangadex?.chapterCount ?? 0) - expected) <= Math.ceil(expected * 0.05);
    }).length;
    const mdGTWithCh = mdGTResults.filter((r) => r.mangadexGT?.chapters && r.mangadexGT.chapters > 0).length;
    const mdGTStatusMatch = mdGTResults.filter((r) => {
      if (!r.mangadexGT?.status) return false;
      return coarsenStatus(normalizeStatus(r.mangadex?.status)) === coarsenStatus(normalizeStatus(r.mangadexGT.status));
    }).length;

    L.push('## Accuracy (vs MangaDex Ground Truth)', '', '| Metric | Value |', '|--------|-------|');
    L.push(`| Titles | ${mdGTResults.length} |`);
    L.push(`| Chapter Count (±5%) | ${mdGTChAccurate}/${mdGTWithCh} (${mdGTWithCh > 0 ? ((mdGTChAccurate / mdGTWithCh) * 100).toFixed(1) : 0}%) |`);
    L.push(`| Status Match | ${mdGTStatusMatch}/${mdGTResults.length} (${((mdGTStatusMatch / mdGTResults.length) * 100).toFixed(1)}%) |`);
    L.push('');
  }

  // Source Concordance (titles with both AniList and MAL data)
  const withMal = eligible.filter((r) => r.mal);
  const withAlAndMal = eligible.filter((r) => r.anilist && r.mal);
  if (withMal.length > 0) {
    const alMalChAgree = withAlAndMal.filter((r) => {
      if (!r.anilist?.chapters || !r.mal?.chapters) return false;
      return Math.abs(r.anilist.chapters - r.mal.chapters) <= Math.ceil(r.anilist.chapters * 0.05);
    }).length;
    const alMalWithCh = withAlAndMal.filter((r) => r.anilist?.chapters && r.mal?.chapters).length;
    const alMalStatusAgree = withAlAndMal.filter((r) => coarsenStatus(normalizeStatus(r.anilist?.status)) === coarsenStatus(normalizeStatus(r.mal?.status))).length;
    const mdMalLinkMatch = withMd.filter((r) => {
      const mdMal = r.mangadex?.discovery.topCandidates?.[0]; // not ideal but links.mal not in discovery
      return r.mal && r.anilist?.idMal === r.mal.malId;
    }).length;

    L.push('## Source Concordance', '', '| Metric | Value |', '|--------|-------|');
    L.push(`| Titles with MAL data | ${withMal.length}/${eligible.length} |`);
    L.push(`| AL↔MAL chapter agreement (±5%) | ${alMalChAgree}/${alMalWithCh} (${alMalWithCh > 0 ? ((alMalChAgree / alMalWithCh) * 100).toFixed(1) : 0}%) |`);
    L.push(`| AL↔MAL status agreement | ${alMalStatusAgree}/${withAlAndMal.length} (${withAlAndMal.length > 0 ? ((alMalStatusAgree / withAlAndMal.length) * 100).toFixed(1) : 0}%) |`);
    L.push('');
  }

  // Failure Mode Breakdown
  const noMatch = withMd.filter((r) => !r.mangadex?.mangaDexId).length;
  const wrongMatch = withMd.filter((r) => r.mangadex?.mangaDexId && !r.mangadex.discovery.crossReferenceCorrect && r.groundTruthSource !== 'mangadex').length;
  const apiErrors = eligible.filter((r) => r.mangadex?.error).length;
  L.push('## Failure Mode Breakdown', '');
  L.push(`- **No match found**: ${noMatch}`);
  L.push(`- **Wrong match (cross-ref fail)**: ${wrongMatch}`);
  L.push(`- **API errors**: ${apiErrors}`);
  L.push('');

  if (wrongMatch > 0) {
    L.push('### Cross-reference failures (sample)', '');
    withMd.filter((r) => r.mangadex?.mangaDexId && !r.mangadex.discovery.crossReferenceCorrect && r.groundTruthSource !== 'mangadex').slice(0, 10).forEach((r) => {
      const d = r.mangadex?.discovery;
      L.push(`- **${r.title}** — matched=${d?.matchedMangaDexId?.slice(0, 8)} (${d?.matchedTitle}) links.al=${d?.linksAl ?? 'none'} expected_al=${d?.expectedAniListId}`);
    });
    L.push('');
  }

  // Detailed table
  L.push('## Detailed Results', '', '| Title | GT | AL Ch | MAL Ch | MD Ch | Status | Cross-Ref | ID Match | En |');
  L.push('|-------|-----|-------|--------|-------|--------|-----------|----------|----|');
  for (const r of results) {
    const al = r.anilist; const md = r.mangadex; const ml = r.mal;
    const gtLabel = r.groundTruthSource === 'mangadex' ? 'MD' : r.groundTruthSource === 'both' ? 'AL+MD' : r.groundTruthSource === 'all' ? 'ALL' : 'AL';
    const statusOk = md?.discovery.crossReferenceCorrect || md?.discovery.discoveryCorrect;
    const idMatch = md?.discovery.expectedVerified ? (md.discovery.discoveryCorrect ? '✓' : '✗') : '-';
    L.push(`| ${r.title.slice(0, 30)} | ${gtLabel} | ${al?.chapters ?? r.mangadexGT?.chapters ?? '?'} | ${ml?.chapters ?? '-'} | ${md?.chapterCount ?? '-'} | ${statusOk ? '✓' : normalizeStatus(md?.status)} | ${md?.discovery.crossReferenceCorrect ? '✓' : '✗'} | ${idMatch} | ${md?.hasEnglishChapters ? '✓' : '-'} |`);
  }
  L.push('', '---', '*Generated by scripts/mangadex/test-mangadex-accuracy.ts*');

  // Save metrics JSON
  const metricsPath = iter !== undefined
    ? path.join(ITERATIONS_DIR, `metrics-iter-${iter}.json`)
    : path.join(OUTPUT_DIR, 'current-metrics.json');
  ensureDir(path.dirname(metricsPath));
  fs.writeFileSync(metricsPath, JSON.stringify({
    timestamp: new Date().toISOString(), iteration: iter, totalTitles: results.length,
    discoverySuccess, crossRefCorrect, idMatchCorrect, verifiedTitles: verifiedTitles.length,
    avgTitleSimilarity: withMd.length > 0 ? simSum / withMd.length : 0,
    chapterAccurate: chAccurate, volumeAccurate: volAccurate, statusMatch, withEnglish: withEn, withAggregate: withAgg,
    noMatch, wrongMatch, apiErrors,
    mdGroundTruthCount: mdGTResults.length,
    malFetched: withMal.length,
    dataCeilingCount,
  }, null, 2));

  return L.join('\n');
}
