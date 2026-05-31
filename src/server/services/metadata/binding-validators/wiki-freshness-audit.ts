/**
 * Phase 3 #2 (rollout, Phase B): freshness audits for Fandom + Wikipedia.
 *
 * The in-pipeline freshness check (`phase-provider-fetch.ts`) runs the matcher
 * on every enrichment for AL/MD/CV/MU/Kitsu, then calls
 * `validateBindingFreshness` with the resulting score. Fandom + Wikipedia
 * don't fit that mold:
 *   - `discoverFandomWikiUrl` returns just a URL; cached URLs short-circuit
 *     re-discovery so there's no score to compare against on most enrichments.
 *   - Wikipedia's `selectMainPage` only runs when search results need to be
 *     ranked, not on a known bound page title.
 *
 * Those bindings still rot — wikis get renamed, redirected, or sourced via
 * an AL externalLinks entry that pointed at the wrong series in the first
 * place (helck.fandom.com listed as the Fandom for "Völundio ~Divergent
 * Sword Saga~" is a real case). This module re-scores every bound URL/page
 * out-of-band so the operator gets the same `[BindingFreshness]` signal
 * surface for the wiki providers as for the title-matched ones.
 *
 * Read-only — no DB writes, no auto-invalidation. Calls
 * `validateBindingFreshness` which logs at WARN level; the operator can
 * then run `scripts/surveys/invalidate-binding.ts` on flagged entries.
 */

import { prisma } from '@/server/db';
import {
  validateFandomWiki,
  type WikiValidationResult,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery/fandom-wiki-validator';
import { logger } from '@/utils/logger';

import { validateBindingFreshness } from './freshness-check';

const log = logger.child('WikiFreshnessAudit');

export interface FreshnessAuditSummary {
  provider: 'fandom' | 'wikipedia';
  scanned: number;
  stale: number;
  fresh: number;
  errors: number;
}

// ============================================================================
// Shared scoring helpers (kept inline so this module is self-contained).
// Mirrors the logic in services/wikipedia/.../best-match-finder-helpers.ts —
// dice coefficient × length-ratio to penalize candidates that fuzzy-match
// against a much shorter or much longer title.
// ============================================================================

function buildBigrams(s: string): Set<string> {
  const norm = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < norm.length - 1; i++) out.add(norm.slice(i, i + 2));
  return out;
}

function similarityScore(a: string, b: string): number {
  const A = buildBigrams(a);
  const B = buildBigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const dice = (2 * inter) / (A.size + B.size);
  const la = a.length;
  const lb = b.length;
  const ratio = la === 0 || lb === 0 ? 0 : Math.min(la, lb) / Math.max(la, lb);
  return dice * ratio;
}

/** Strip "(manga)" / "(video game)" / "List of … chapters" suffixes for scoring. */
function stripScoringSuffix(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/^List of\s+|\s+chapters?$/giu, '')
    .trim();
}

function bestSimilarity(candidate: string, refs: string[]): number {
  let best = 0;
  for (const r of refs) {
    const direct = similarityScore(r, candidate);
    const stripped = similarityScore(stripScoringSuffix(r), stripScoringSuffix(candidate));
    const score = Math.max(direct, stripped);
    if (score > best) best = score;
  }
  return best;
}

// ============================================================================
// DB row shapes
// ============================================================================

interface FandomRow {
  mangaId: number;
  title: string;
  synonyms: string[];
  fandomUrl: string;
}

interface WikipediaRow {
  mangaId: number;
  title: string;
  synonyms: string[];
  pageTitle: string;
}

async function loadFandomBindings(): Promise<FandomRow[]> {
  const rows = await prisma.manga.findMany({
    where: { Metadata: { urls: { hasSome: [] } } },
    select: {
      id: true,
      title: true,
      Metadata: { select: { urls: true, synonyms: true } },
    },
  });
  const out: FandomRow[] = [];
  for (const row of rows) {
    const urls = row.Metadata?.urls ?? [];
    const fandomUrl = urls.find((u) => u.includes('.fandom.com'));
    if (!fandomUrl) continue;
    out.push({
      mangaId: row.id,
      title: row.title,
      synonyms: row.Metadata?.synonyms ?? [],
      fandomUrl,
    });
  }
  return out;
}

interface WikipediaProviderEntry {
  providerId?: string;
}

function readWikipediaPageTitle(providerMetadata: unknown): string | null {
  if (providerMetadata === null || typeof providerMetadata !== 'object') return null;
  const entry = (providerMetadata as Record<string, unknown>)['wikipedia'];
  if (entry === null || typeof entry !== 'object') return null;
  const pid = (entry as WikipediaProviderEntry).providerId;
  return typeof pid === 'string' && pid.length > 0 ? pid : null;
}

async function loadWikipediaBindings(): Promise<WikipediaRow[]> {
  const rows = await prisma.manga.findMany({
    select: {
      id: true,
      title: true,
      providerMetadata: true,
      Metadata: { select: { synonyms: true } },
    },
  });
  const out: WikipediaRow[] = [];
  for (const row of rows) {
    const pageTitle = readWikipediaPageTitle(row.providerMetadata);
    if (!pageTitle) continue;
    out.push({
      mangaId: row.id,
      title: row.title,
      synonyms: row.Metadata?.synonyms ?? [],
      pageTitle,
    });
  }
  return out;
}

// ============================================================================
// Per-row scoring
// ============================================================================

async function scoreFandom(row: FandomRow): Promise<WikiValidationResult | { score?: number; errorReason: string }> {
  try {
    return await validateFandomWiki(row.fandomUrl, row.title, { altTitles: row.synonyms });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { errorReason: reason };
  }
}

function scoreWikipedia(row: WikipediaRow): number {
  const decoded = row.pageTitle.replace(/_/g, ' ');
  const refs = [row.title, ...row.synonyms];
  return bestSimilarity(decoded, refs);
}

// ============================================================================
// Public entry points
// ============================================================================

/**
 * Re-validate every Manga with a cached Fandom URL. Emits a
 * `[BindingFreshness]` warn line for any whose sitename score has fallen
 * below `MIN_BIND_SCORE.fandom` (0.55). Sequential — Fandom rate-limits.
 */
export async function runFandomFreshnessAudit(): Promise<FreshnessAuditSummary> {
  const rows = await loadFandomBindings();
  log.info(`Fandom freshness audit: ${rows.length} bound manga`);
  let stale = 0;
  let fresh = 0;
  let errors = 0;

  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design; respect upstream rate limits
    const result = await scoreFandom(row);
    if ('errorReason' in result) {
      log.warn(`Fandom audit: validation error for manga ${row.mangaId}`, {
        mangaId: row.mangaId,
        title: row.title,
        url: row.fandomUrl,
        reason: result.errorReason,
      });
      errors++;
      continue;
    }
    const score = result.score ?? 0;
    const verdict = validateBindingFreshness({
      mangaId: row.mangaId,
      provider: 'fandom',
      currentScore: score,
      boundEntityId: row.fandomUrl,
      manualPin: false,
    });
    if (verdict.stale) stale++; else fresh++;
  }

  const summary: FreshnessAuditSummary = { provider: 'fandom', scanned: rows.length, stale, fresh, errors };
  log.info('Fandom freshness audit complete', summary);
  return summary;
}

/**
 * Re-score every Manga with a `providerMetadata.wikipedia.providerId` binding
 * against its current Manga.title + synonyms. Emits a `[BindingFreshness]`
 * warn line when score falls below `MIN_BIND_SCORE.wikipedia` (0.55).
 *
 * No network calls — the page title is already in providerMetadata, and we
 * compare it directly to the manga's current title. (A separate validator
 * could refetch the page to confirm it's still about manga at all; that's
 * a Phase C concern.)
 */
export async function runWikipediaFreshnessAudit(): Promise<FreshnessAuditSummary> {
  const rows = await loadWikipediaBindings();
  log.info(`Wikipedia freshness audit: ${rows.length} bound manga`);
  let stale = 0;
  let fresh = 0;

  for (const row of rows) {
    const score = scoreWikipedia(row);
    const verdict = validateBindingFreshness({
      mangaId: row.mangaId,
      provider: 'wikipedia',
      currentScore: score,
      boundEntityId: row.pageTitle,
      manualPin: false,
    });
    if (verdict.stale) stale++; else fresh++;
  }

  const summary: FreshnessAuditSummary = { provider: 'wikipedia', scanned: rows.length, stale, fresh, errors: 0 };
  log.info('Wikipedia freshness audit complete', summary);
  return summary;
}
