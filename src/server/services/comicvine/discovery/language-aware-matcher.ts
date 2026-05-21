/**
 * Language-Aware ComicVine Matcher
 *
 * Discovery layer that finds the best ComicVine volume for an AniList entry
 * while honoring the user's preferred language from settings.
 *
 * Replaces the legacy `selectEnglishFirstVolume` (English-only, hardcoded)
 * with a multi-variant search + hard language guard pipeline:
 *
 *   1. Try AniList English title  → search → score → guard
 *   2. If no candidate survives, try Romaji → search → score → guard
 *   3. If still no match, try Native → search → score → guard
 *   4. If still no match, return `matchStrategy: 'no-match'` (hard fail)
 *
 * The guard rejects candidates whose detected language does NOT equal the
 * preferred language from `comicvine.preferredLanguage`. There is no
 * silent fallback to English — that's by design, so the loop can measure
 * discovery failures rather than masking them.
 *
 * @module comicvine/discovery/language-aware-matcher
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import type { ComicVineVolume } from '@/server/services/comicvine/service';
import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';

import { detectFromContent } from '../language-detection/content-detection';
import { normalizeForComicVineSearch } from '../title-variants';

import type { SupportedLanguage } from '../language-detection/types';

const log = logger.child('ComicVineMatcher');

// ============================================================================
// Types
// ============================================================================

/**
 * Per-candidate scoring + diagnostics for one ComicVine volume search result.
 */
export interface CandidateScore {
  volumeId: number;
  name: string;
  publisherName: string | null;
  startYear: number | null;
  countOfIssues: number;
  /** Best title similarity across all AniList variants (0..1) */
  titleSimilarity: number;
  /** Detected language for this candidate */
  detectedLanguage: SupportedLanguage;
  /** Confidence of language detection (0..1) */
  languageConfidence: number;
  /** Human-readable reasons for the detected language */
  languageReasons: string[];
  /** True if `detectedLanguage` matches the requested preferred language */
  matchesPreferredLanguage: boolean;
  /** Combined ranking score: titleSimilarity * (1 + languageConfidence * 0.3) */
  finalScore: number;
}

/**
 * Result of a discovery run.
 */
export interface MatchResult {
  /** Best language-correct candidate, or null if no candidate passes the guard */
  matched: CandidateScore | null;
  /** Full ComicVine volume payload for the matched candidate (for downstream pipeline) */
  matchedVolume: ComicVineVolume | null;
  /** Candidates rejected because their detected language did not match the preferred language */
  rejectedForLanguage: CandidateScore[];
  /** All candidates considered across all query variants (deduplicated by volumeId) */
  allCandidates: CandidateScore[];
  /** The preferred language requested for this search */
  preferredLanguage: SupportedLanguage;
  /** Which query strategy produced the match */
  matchStrategy: 'english' | 'romaji' | 'native' | 'synonym' | 'language-fallback' | 'no-match';
  /** The query string that produced the matched candidate (for logging/debugging) */
  matchedQuery: string | null;
}

// ============================================================================
// Internal helpers
// ============================================================================

interface VariantQuery {
  query: string;
  strategy: 'english' | 'romaji' | 'native' | 'synonym';
}

/** Build the ordered list of search queries from AniList title fields. */
function buildSearchVariants(anilist: AniListMangaDetails): VariantQuery[] {
  const variants: VariantQuery[] = [];
  const seen = new Set<string>();

  const add = (raw: string | undefined | null, strategy: VariantQuery['strategy']): void => {
    if (!raw || typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (trimmed.length < 2) return;
    const normalized = normalizeForComicVineSearch(trimmed);
    if (normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    variants.push({ query: trimmed, strategy });
  };

  add(anilist.title.english, 'english');
  add(anilist.title.romaji, 'romaji');
  add(anilist.title.native, 'native');

  for (const synonym of anilist.synonyms ?? []) {
    add(synonym, 'synonym');
  }

  return variants;
}

/** Bigram Dice coefficient for fuzzy title similarity (0..1) */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg);
    if (count !== undefined && count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
}

/**
 * Length-ratio penalty: when a candidate name is significantly longer than the
 * AniList title, dice coefficient alone gives an inflated score (e.g., dice
 * "Dragon Ball" vs "Dragon Ball Z" ≈ 0.91). Multiplying by min/max length ratio
 * brings it down so spinoffs/sequels don't tie with the canonical title.
 */
function lengthRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  return Math.min(a.length, b.length) / Math.max(a.length, b.length);
}

/**
 * Compute the best title similarity for a candidate against AniList title variants.
 *
 * Iter 6 changes:
 *   - Use only english/romaji/native (NOT synonyms) for the primary score.
 *     AniList synonyms include sequels/spinoffs (e.g., "Dragon Ball Z" appears
 *     in Dragon Ball's synonyms list), which inflates spinoff candidates.
 *   - Apply length_ratio penalty so "Dragon Ball Z" (13 chars) scores lower
 *     than exact "Dragon Ball" (11 chars) against AniList "Dragon Ball" (11 chars).
 *   - Synonyms still considered as a fallback at 0.85x weight, in case the
 *     english/romaji/native fields don't yield a good match (rare but possible).
 */
function bestTitleSimilarity(candidate: ComicVineVolume, anilist: AniListMangaDetails): number {
  const candidateNormalized = normalizeForComicVineSearch(candidate.name ?? '');
  if (!candidateNormalized) return 0;

  const canonical: string[] = [
    anilist.title.english,
    anilist.title.romaji,
    anilist.title.native,
  ].filter((t): t is string => typeof t === 'string' && t.length > 0);

  let best = 0;
  for (const variant of canonical) {
    const variantNormalized = normalizeForComicVineSearch(variant);
    if (variantNormalized.length < 2) continue;
    const dice = diceCoefficient(candidateNormalized, variantNormalized);
    const ratio = lengthRatio(candidateNormalized, variantNormalized);
    const score = dice * ratio;
    if (score > best) best = score;
  }

  // If the canonical fields didn't yield a confident match, fall back to
  // synonyms at a 0.85x discount (avoids spinoffs winning outright but still
  // catches edge cases where the primary fields are missing or wrong).
  if (best < 0.5) {
    for (const variant of anilist.synonyms ?? []) {
      if (typeof variant !== 'string' || variant.length === 0) continue;
      const variantNormalized = normalizeForComicVineSearch(variant);
      if (variantNormalized.length < 2) continue;
      const dice = diceCoefficient(candidateNormalized, variantNormalized);
      const ratio = lengthRatio(candidateNormalized, variantNormalized);
      const score = dice * ratio * 0.85;
      if (score > best) best = score;
    }
  }

  return best;
}

/**
 * Boost factor that rewards canonical/long-running editions. Logarithmic so a
 * 100-issue series doesn't dwarf a 5-issue one — just nudges them above ties.
 *
 * This was added in iter 3 of the comicvine-accuracy loop to fix cases where
 * the matcher picked alternate editions over canonical ones (e.g., Darkwood
 * One Piece (24 issues) over Viz One Piece (100+ issues) when both had
 * titleSimilarity=1.0). With this boost:
 *   - Viz One Piece: 1.0 * 1.30 * (1 + log10(101)*0.15) ≈ 1.69
 *   - Darkwood:      1.0 * 1.18 * (1 + log10(25)*0.15)  ≈ 1.43
 */
function issueCountBoost(countOfIssues: number): number {
  if (countOfIssues <= 0) return 1;
  return 1 + Math.log10(countOfIssues + 1) * 0.15;
}

/** Score one ComicVine volume against the AniList entry + preferred language. */
function scoreCandidate(
  volume: ComicVineVolume,
  anilist: AniListMangaDetails,
  preferredLanguage: SupportedLanguage,
): CandidateScore {
  const titleSimilarity = bestTitleSimilarity(volume, anilist);

  const publisherName = volume.publisher?.name ?? '';
  const description = (volume.description ?? volume.deck ?? '')
    .replace(/<[^>]*>/g, '')
    .slice(0, 500);

  const detection = detectFromContent(publisherName, volume.name ?? '', description, volume.name);
  const detectedLanguage = detection.detectedLanguage;
  const languageConfidence = detection.confidence;
  const matchesPreferredLanguage = detectedLanguage === preferredLanguage;

  const countOfIssues = volume.count_of_issues ?? 0;
  const finalScore =
    titleSimilarity * (1 + languageConfidence * 0.3) * issueCountBoost(countOfIssues);

  return {
    volumeId: volume.id,
    name: volume.name ?? '',
    publisherName: publisherName.length > 0 ? publisherName : null,
    startYear: volume.start_year ?? null,
    countOfIssues,
    titleSimilarity,
    detectedLanguage,
    languageConfidence,
    languageReasons: detection.reasons,
    matchesPreferredLanguage,
    finalScore,
  };
}

/**
 * Minimum title-similarity score (dice × length-ratio) below which a
 * ComicVine candidate is rejected outright.
 *
 * Was 0.3 — too permissive for ComicVine. False-positives here are
 * catastrophic because ComicVine's `volumeData` spawns hundreds of bogus
 * Volume rows + Chapter cover overrides on the manga detail page (e.g.
 * "Omniscient Reader's Viewpoint" got bound to ComicVine's "The Comic
 * Reader" 1970 fanzine at score ~0.36 — single shared word "reader"
 * inflated by bigram dice + synonym-fallback × 0.85 weight).
 *
 * 0.55 keeps legitimate matches (One Piece vs "One Piece", Bleach vs
 * "Bleach", etc., score ≥0.85) while killing single-token coincidences
 * like "Reader/Comic Reader" and "Saga/Devilman Saga".
 */
const MIN_TITLE_SIMILARITY = 0.55;

/** Pick the highest-scoring language-correct candidate, or null if none. */
function pickBestLanguageCorrect(candidates: CandidateScore[]): CandidateScore | null {
  const eligible = candidates.filter(
    (c) => c.matchesPreferredLanguage && c.titleSimilarity >= MIN_TITLE_SIMILARITY,
  );
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    // Tiebreaker: prefer the candidate with more issues (more complete edition)
    return b.countOfIssues - a.countOfIssues;
  });

  return eligible[0] ?? null;
}

/** Build an empty MatchResult for the no-match early-return paths. */
function emptyResult(preferredLanguage: SupportedLanguage): MatchResult {
  return {
    matched: null,
    matchedVolume: null,
    rejectedForLanguage: [],
    allCandidates: [],
    preferredLanguage,
    matchStrategy: 'no-match',
    matchedQuery: null,
  };
}

interface VariantSearchOutcome {
  matched: CandidateScore | null;
  matchedQuery: string | null;
  matchStrategy: MatchResult['matchStrategy'];
  allCandidatesById: Map<number, CandidateScore>;
  volumesById: Map<number, ComicVineVolume>;
}

/**
 * Iterate through query variants in priority order. For each variant, search
 * ComicVine, score every result, and try to pick a language-correct match.
 * Stops as soon as one variant produces a winning candidate.
 */
async function searchVariantsForMatch(
  variants: VariantQuery[],
  anilist: AniListMangaDetails,
  preferredLanguage: SupportedLanguage,
): Promise<VariantSearchOutcome> {
  const allCandidatesById = new Map<number, CandidateScore>();
  const volumesById = new Map<number, ComicVineVolume>();
  let matched: CandidateScore | null = null;
  let matchedQuery: string | null = null;
  let matchStrategy: MatchResult['matchStrategy'] = 'no-match';

  for (const variant of variants) {
     
    // Limit 40 (was 20 in iter 1-2): canonical English editions sometimes
    // sit between rank 20-40 in ComicVine's search relevance, behind alternate
    // editions and spinoffs. Doubling the candidate pool catches them.
    // eslint-disable-next-line no-await-in-loop -- sequential by design: variants tried in priority order and the loop breaks on first language-correct match, avoiding unnecessary rate-limited ComicVine calls
    const volumes = await comicvineService.searchBasicVolumes(variant.query, 0, 40);
    if (volumes.length === 0) {
      log.info('No results for variant', { query: variant.query, strategy: variant.strategy });
      continue;
    }

    for (const volume of volumes) {
      if (allCandidatesById.has(volume.id)) continue;
      const scored = scoreCandidate(volume, anilist, preferredLanguage);
      allCandidatesById.set(volume.id, scored);
      volumesById.set(volume.id, volume);
    }

    const best = pickBestLanguageCorrect(Array.from(allCandidatesById.values()));
    if (best) {
      matched = best;
      matchedQuery = variant.query;
      matchStrategy = variant.strategy;
      log.info('Language-correct match found', {
        query: variant.query,
        strategy: variant.strategy,
        volumeId: best.volumeId,
        name: best.name,
        detectedLanguage: best.detectedLanguage,
        titleSimilarity: best.titleSimilarity.toFixed(2),
        finalScore: best.finalScore.toFixed(2),
      });
      break;
    }
  }

  return { matched, matchedQuery, matchStrategy, allCandidatesById, volumesById };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find the best ComicVine volume for an AniList entry that matches the
 * user's preferred language. Returns `matched: null` if no candidate
 * across all title variants passes the language guard.
 *
 * @param anilist - AniList manga details (must include title + synonyms)
 * @param preferredLanguage - Target language code from `comicvine.preferredLanguage`
 *                            (e.g., 'en', 'ja', 'fr'). Use 'any' to disable the guard.
 */
export async function findComicVineMatchForAniList(
  anilist: AniListMangaDetails,
  preferredLanguage: SupportedLanguage = 'en',
): Promise<MatchResult> {
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    log.warn('ComicVine not configured (no API key)');
    return emptyResult(preferredLanguage);
  }

  const variants = buildSearchVariants(anilist);
  if (variants.length === 0) {
    log.warn('No usable AniList title variants');
    return emptyResult(preferredLanguage);
  }

  const search = await searchVariantsForMatch(variants, anilist, preferredLanguage);

  const allCandidates = Array.from(search.allCandidatesById.values());
  const rejectedForLanguage = allCandidates.filter(
    (c) => !c.matchesPreferredLanguage && c.titleSimilarity >= MIN_TITLE_SIMILARITY,
  );

  if (!search.matched) {
    log.warn('No language-correct ComicVine match', {
      preferredLanguage,
      candidatesConsidered: allCandidates.length,
      rejectedForLanguage: rejectedForLanguage.length,
      anilistEnglish: anilist.title.english,
      anilistRomaji: anilist.title.romaji,
    });

    // English-preferred fallback: if no preferred-language candidate met the
    // 0.55 sim floor but a language-rejected candidate did, accept it.
    // Cold-import audit caught Sayonara Zetsubou Sensei being missed because
    // its only ComicVine entry is Japanese-published; the strict English-only
    // gate threw away a high-similarity match. The 0.55 floor (already applied
    // to `rejectedForLanguage`) plus the AL year/title scoring in finalScore
    // remain the guardrails.
    if (rejectedForLanguage.length > 0) {
      const sorted = [...rejectedForLanguage].sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return b.countOfIssues - a.countOfIssues;
      });
      const fallback = sorted[0];
      if (fallback) {
        log.info('ComicVine: language-fallback match (no preferred-language candidate)', {
          volumeId: fallback.volumeId,
          name: fallback.name,
          detectedLanguage: fallback.detectedLanguage,
          titleSimilarity: fallback.titleSimilarity.toFixed(2),
          finalScore: fallback.finalScore.toFixed(2),
        });
        return {
          matched: fallback,
          matchedVolume: search.volumesById.get(fallback.volumeId) ?? null,
          rejectedForLanguage: [],
          allCandidates,
          preferredLanguage,
          matchStrategy: 'language-fallback',
          matchedQuery: search.matchedQuery,
        };
      }
    }
  }

  return {
    matched: search.matched,
    matchedVolume: search.matched
      ? (search.volumesById.get(search.matched.volumeId) ?? null)
      : null,
    rejectedForLanguage,
    allCandidates,
    preferredLanguage,
    matchStrategy: search.matchStrategy,
    matchedQuery: search.matchedQuery,
  };
}
