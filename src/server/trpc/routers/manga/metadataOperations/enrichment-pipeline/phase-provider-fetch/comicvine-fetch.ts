/**
 * ComicVine discovery (language-aware matcher) for the provider-fetch phase.
 *
 * Moved out of `phase-provider-fetch.ts`. The language-aware matcher is the
 * only discovery path; a manual bind is fetched by volume id instead, an
 * unbound sentinel skips ComicVine, and rejected volume ids are never bound.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import { comicvineConfigService } from '@/server/services/comicvine/configService';
import {
  findComicVineMatchForAniList,
  type CandidateScore,
  type MatchResult,
} from '@/server/services/comicvine/discovery/language-aware-matcher';
import { isSupportedLanguage } from '@/server/services/comicvine/language-detection/guard-functions';
import type { SupportedLanguage } from '@/server/services/comicvine/language-detection/types';
import type { ComicVineIssue, ComicVineVolume } from '@/server/services/comicvine/service';
import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';

import type { ProviderDirective } from './provider-pins';

const log = logger.child('PhaseProviderFetch');

export interface ComicVineDirectResult {
  volumeId: number;
  publisherName: string | undefined;
  issues: ComicVineIssue[];
  seriesVolume: ComicVineVolume;
  /**
   * Phase 3 #2 (rollout): the language-aware matcher's titleSimilarity for
   * this volume. Undefined when the volume was pin-fetched by id
   * (manual binding) — the freshness check skips those.
   */
  matchScore?: number;
}

/**
 * Read the ComicVine preferred language from settings, falling back to 'en'.
 * Validates that the configured value is a supported language code.
 */
async function loadComicVinePreferredLanguage(): Promise<SupportedLanguage> {
  try {
    const cfg = await comicvineConfigService.loadConfig();
    if (isSupportedLanguage(cfg.preferredLanguage)) {
      return cfg.preferredLanguage;
    }
    log.warn('ComicVine: invalid preferredLanguage in settings, defaulting to en', {
      configured: cfg.preferredLanguage,
    });
    return 'en';
  } catch (error: unknown) {
    log.warn('ComicVine: failed to load config, defaulting to en', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'en';
  }
}

/**
 * When configured preference is 'en' but the AniList entry has no English title
 * and its country of origin is Japan, the only real ComicVine edition will be
 * Japanese — the guard would reject the correct match. Fall back to 'ja' so the
 * language check passes on the authentic edition instead of leaving the manga
 * unbound (or worse, falling back to stale cached data from a prior wrong match).
 */
function resolveEffectiveComicVineLanguage(
  anilist: AniListMangaDetails,
  configured: SupportedLanguage,
): SupportedLanguage {
  if (configured === 'en' && !anilist.title.english && anilist.countryOfOrigin === 'JP') {
    return 'ja';
  }
  return configured;
}

/**
 * Fetch a CV volume by id and shape it into the same `ComicVineDirectResult`
 * the matcher returns, so downstream phases (Volume persistence, externalLinks)
 * are unchanged.
 */
async function fetchComicVineVolumeById(volumeId: number, reason: string): Promise<ComicVineDirectResult | null> {
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    log.warn('ComicVine not initialized; cannot fetch volume by id', { volumeId, reason });
    return null;
  }
  const volume = await comicvineService.getCompleteVolumeInfo(volumeId);
  if (!volume) {
    log.warn('ComicVine: volume not found via API', { volumeId, reason });
    return null;
  }
  const issues = await comicvineService.getAllVolumeIssues(volumeId);
  log.info(`ComicVine: ${reason}`, {
    volumeId,
    name: volume.name ?? '',
    publisher: volume.publisher?.name ?? '',
    issueCount: issues.length,
  });
  return {
    volumeId,
    publisherName: volume.publisher?.name ?? undefined,
    issues,
    seriesVolume: volume,
  };
}

/**
 * Mirrors `MIN_TITLE_SIMILARITY` in the language-aware matcher (not exported
 * there): the title floor a candidate needs to be bound at all.
 */
const COMICVINE_MIN_TITLE_SIMILARITY = 0.55;

/**
 * Best candidate the matcher saw that is not rejected, by the matcher's own
 * rule (preferred language, title floor, final score, then issue count).
 * Used only when the matcher's pick is a rejected volume.
 *
 * A rejected origin-language fallback pick has no replacement: that path is
 * already the matcher's last resort, so the provider stays unbound.
 */
export function pickNonRejectedComicVineCandidate(
  matchResult: Pick<MatchResult, 'allCandidates' | 'matchStrategy'>,
  rejectedIds: ReadonlySet<string>,
): CandidateScore | null {
  if (matchResult.matchStrategy === 'language-fallback') return null;
  const eligible = matchResult.allCandidates.filter(
    (c) => c.matchesPreferredLanguage
      && c.titleSimilarity >= COMICVINE_MIN_TITLE_SIMILARITY
      && !rejectedIds.has(String(c.volumeId)),
  );
  eligible.sort((a, b) => (
    b.finalScore !== a.finalScore ? b.finalScore - a.finalScore : b.countOfIssues - a.countOfIssues
  ));
  return eligible[0] ?? null;
}

/**
 * Use the language-aware matcher to discover the best ComicVine volume for an
 * AniList entry, then fetch all its issues.
 *
 * Returns null if no candidate matches the preferred language — by design.
 * The loop in `docs/research/comicvine-accuracy/` measures this rate.
 */
export async function runLanguageAwareComicVineMatch(
  anilistDetails: AniListMangaDetails,
  mangaId: number,
  directive: ProviderDirective<number>,
): Promise<ComicVineDirectResult | null> {
  const { pin, rejectedIds, boundId } = directive;
  if (pin.kind === 'unbound') {
    log.info(`ComicVine: skipping match for manga ${mangaId} — manually marked as unbound`);
    return null;
  }
  if (pin.kind === 'pinned') {
    const manual = await fetchComicVineVolumeById(pin.id, 'honoring manual binding (matcher skipped)');
    if (manual) return manual;
    // Manual binding existed but the API call failed — fall through to the
    // matcher rather than returning null, so the user still gets some result.
  } else if (pin.kind === 'unusable') {
    log.warn('ComicVine: manual binding id is not usable — running the matcher', { raw: pin.raw, reason: pin.reason });
  }

  const configuredLanguage = await loadComicVinePreferredLanguage();
  const preferredLanguage = resolveEffectiveComicVineLanguage(anilistDetails, configuredLanguage);
  if (preferredLanguage !== configuredLanguage) {
    log.info('ComicVine: overriding preferredLanguage for JP-only AniList entry', {
      configured: configuredLanguage,
      effective: preferredLanguage,
      anilistRomaji: anilistDetails.title.romaji,
    });
  }
  const matchResult = await findComicVineMatchForAniList(anilistDetails, preferredLanguage);

  if (!matchResult.matched || !matchResult.matchedVolume) {
    log.warn('ComicVine: no language-correct match', {
      preferredLanguage,
      candidatesConsidered: matchResult.allCandidates.length,
      rejectedForLanguage: matchResult.rejectedForLanguage.length,
    });
    // A title the search no longer finds is still the volume it was bound to.
    return boundId === undefined ? null : fetchComicVineVolumeById(boundId, 'search found no match — keeping the bound volume');
  }

  const matched = matchResult.matched;
  if (rejectedIds.has(String(matched.volumeId))) {
    // The matcher lives outside this pipeline and does not know about
    // rejections, so its pick is checked here and replaced by the next
    // non-rejected candidate — or by nothing, never by the rejected volume.
    const alternative = pickNonRejectedComicVineCandidate(matchResult, rejectedIds);
    if (!alternative) {
      log.info('ComicVine: matcher picked a rejected volume and no other candidate qualifies — leaving unbound', {
        mangaId, rejectedVolumeId: matched.volumeId,
      });
      return null;
    }
    const replacement = await fetchComicVineVolumeById(
      alternative.volumeId, `matcher pick ${matched.volumeId} is rejected — using next candidate`,
    );
    return replacement ? { ...replacement, matchScore: alternative.titleSimilarity } : null;
  }

  const issues = await comicvineService.getAllVolumeIssues(matched.volumeId);
  log.info('ComicVine: language-aware matcher selected', {
    volumeId: matched.volumeId,
    name: matched.name,
    detectedLanguage: matched.detectedLanguage,
    preferredLanguage,
    matchStrategy: matchResult.matchStrategy,
    titleSimilarity: matched.titleSimilarity.toFixed(2),
    issueCount: issues.length,
  });

  return {
    volumeId: matched.volumeId,
    publisherName: matched.publisherName ?? undefined,
    issues,
    seriesVolume: matchResult.matchedVolume,
    matchScore: matched.titleSimilarity,
  };
}

/**
 * Title-only stand-in for AniListMangaDetails when no AniList match exists.
 * Lets the language-aware matcher (and its hard language guard) run for
 * AniList-less manga instead of the retired English-first selector, which
 * ignored `comicvine.preferredLanguage` and fell back to ANY >=0.2 title
 * match regardless of language. The sentinel id is never read — the matcher
 * only consumes title fields, synonyms, and countryOfOrigin.
 */
export function buildTitleOnlyAniListDetails(title: string): AniListMangaDetails {
  return { id: 0, title: { english: title } };
}
