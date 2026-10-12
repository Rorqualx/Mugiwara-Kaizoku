// @file-size-justified: Single-purpose orchestrator that owns all 5 provider direct
// fetches (AniList, MangaDex, ComicVine, Fandom, Wikipedia) and their result coercion.
// Splitting per-provider would scatter shared types (UnifiedProviderResults, the *DirectResult
// interfaces) and obscure the matching/verification flow that crosses provider boundaries
// (e.g., AniList ↔ MangaDex links.al cross-ref, ComicVine language-aware fallback).
// Helpers that don't need cross-provider state already live under ./phase-provider-fetch/.
/* eslint-disable max-lines -- @file-size-justified above */
/**
 * Phase 1: Provider Fetch
 *
 * Fetches metadata from all 5 providers using local adapters directly:
 *   - AniList: Metadata (chapter count, genres, synopsis, cover, status)
 *   - MangaDex: Chapter list (numbers, titles, volume assignments)
 *   - ComicVine: Volume data with English-first publisher filtering
 *   - Fandom: Chapter data via adaptive parser
 *   - Wikipedia: Chapter list fallback
 *
 * Previously used ts-mangadex MetadataEnricher which bundled MangaDex +
 * AniList + ComicVine without language/publisher filtering. Now each
 * provider is called directly through local services that have proper
 * English-first filtering (especially ComicVine).
 */

import { enabledDefaultFor, ALL_PROVIDERS } from '@/lib/metadata/provider-registry';
import { prisma } from '@/server/db';
import type { AniListMangaDetails } from '@/server/services/anilist/service';
import { anilistService } from '@/server/services/anilist/service';
import { getRejectedIdsByProvider, recordBinding, rejectedIdsFor } from '@/server/services/metadata/binding-record';
import { validateBindingFreshness } from '@/server/services/metadata/binding-validators/freshness-check';
import { writeFieldReview } from '@/server/services/metadata/field-review';
import { collectCandidates } from '@/server/services/metadata/selectors/collect-candidates';
import { applySelectorCutover, stashFieldAlternatives } from '@/server/services/metadata/selectors/cutover-overlay';
import { persistSelectionAttempt } from '@/server/services/metadata/selectors/persist-attempt';
import { computeShadowDeltas, runShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import { withTimeoutOrNull } from '@/server/services/shared/with-timeout';
import type { EnrichmentResult } from '@/types/domain/enrichment-result-types';
import { logger } from '@/utils/logger';

import { buildFallbackSearchQuery, stripTitlePatterns } from './matching/title-normalization';
import { isNovelMediaType, pickBestTitleMatchWithScore } from './phase-provider-fetch/anilist-match';
import { resolveAniListPin } from './phase-provider-fetch/anilist-pin';
import { buildTitleOnlyAniListDetails, runLanguageAwareComicVineMatch, type ComicVineDirectResult } from './phase-provider-fetch/comicvine-fetch';
import { buildEnrichmentResult } from './phase-provider-fetch/enrichment-result-builder';
import { withoutChaptersPastVolumeCeiling } from './phase-provider-fetch/fandom-volume-ceiling';
import { fetchKitsuDirect, mapKitsuToUnifiedResult, type KitsuDirectResult } from './phase-provider-fetch/kitsu-fetch';
import { fetchMALDirect, type MALDirectResult } from './phase-provider-fetch/mal-fetch';
import { fetchMangaDexDirect, verifyMangaDexWithAniList, type MangaDexDirectResult } from './phase-provider-fetch/mangadex-fetch';
import { fetchMangaUpdatesDirect, verifyMUWithAniList, type MangaUpdatesDirectResult } from './phase-provider-fetch/mangaupdates-fetch';
import { buildClaimsForShadow } from './phase-provider-fetch/provider-claims';
import { ProviderOutcomeTracker, unansweredProviders } from './phase-provider-fetch/provider-outcome';
import { buildProviderDirectives, skipsSecondWave } from './phase-provider-fetch/provider-pins';
import { settledValueOr } from './phase-provider-fetch/wave-merge';
import { discoverFandomWikiUrl, fetchFandomChapterData, fetchWikipediaChapterData, updateCachedFandomUrl } from './wiki-discovery';

import type { EnrichmentPipelineOptions, EnrichmentProgress, UnifiedProviderResults } from './types';

const log = logger.child('PhaseProviderFetch');

/** Load enabled provider flags from per-provider config keys (`{provider}.enabled`). */
async function loadEnabledProviders(): Promise<Set<string>> {
  // Default: all on except `mal` and `kitsu` (matches `metadataProvidersEnabledMigration` defaults).
  // `kitsu` defaults off to soak before flipping the migration default.
  const PROVIDER_DEFAULTS: Record<string, boolean> = Object.fromEntries(
    ALL_PROVIDERS.map((id) => [id, enabledDefaultFor(id)]),
  );
  try {
    const { getConfigBoolean } = await import('@/server/utils/configReader');
    const ids = Object.keys(PROVIDER_DEFAULTS);
    const flags = await Promise.all(
      ids.map(async (id) => {
        const value = await getConfigBoolean(`${id}.enabled`, PROVIDER_DEFAULTS[id] ?? true);
        return [id, value] as const;
      }),
    );
    const enabled = new Set<string>();
    for (const [id, value] of flags) {
      if (value) enabled.add(id);
    }
    return enabled;
  } catch (err: unknown) {
    log.warn('loadEnabledProviders failed, defaulting to safe-on set', {
      error: err instanceof Error ? err.message : String(err),
    });
    const enabled = new Set<string>();
    for (const [id, def] of Object.entries(PROVIDER_DEFAULTS)) {
      if (def) enabled.add(id);
    }
    return enabled;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run Phase 1: fetch metadata from all providers using local adapters.
 * Only fetches from providers enabled in settings. All run in parallel.
 */
// eslint-disable-next-line max-lines-per-function, max-statements, complexity -- Pre-existing: orchestrates 5 provider calls + cross-verification flow that doesn't decompose cleanly without scattering state. Future refactor candidate.
export async function phaseProviderFetch(
  mangaId: number,
  title: string,
  onProgress?: EnrichmentProgress,
  options?: EnrichmentPipelineOptions,
): Promise<UnifiedProviderResults> {
  const enabled = await loadEnabledProviders();
  const activeNames = [...enabled].join(', ');
  await onProgress?.('fetching', `Fetching metadata from ${activeNames}...`);

  // Read the AL pin from Manga before kicking off provider fetches. When
  // Manga.selectedSourceId is set, the AL fetch bypasses the title-similarity
  // matcher and uses the pinned entity directly — required for manual
  // overrides where the matcher would otherwise pick a more "complete"
  // wrong entity (e.g. an anthology vs the actual spin-off).
  const mangaPin = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { selectedSourceId: true, providerMetadata: true, mediaType: true },
  });
  // Binding-as-record (#2): durable rejections for this manga's bindings, all
  // providers in one query. A rejected id must NOT be re-pinned or re-picked —
  // that is what breaks the sticky-id reidentify loop (Attack on Titan bound
  // to the "No Regrets" spinoff).
  const rejections = await getRejectedIdsByProvider(mangaId);
  const rejectedAlIds = rejectedIdsFor(rejections, 'anilist');
  // Manual pins, unbound sentinels and rejections for the other providers.
  const directives = buildProviderDirectives(
    mangaPin?.providerMetadata, (provider) => rejectedIdsFor(rejections, provider),
  );
  // Format gate: light novels are demoted unless the library title is one.
  const demoteNovels = !isNovelMediaType(mangaPin?.mediaType);

  // Manual pin (selectedSourceId) always wins. Otherwise reuse the AniList id
  // already auto-bound in providerMetadata.anilist.providerId so re-enrichment
  // fetches by ID instead of re-searching by title — AniList's search can't
  // reproduce some titles at all (e.g. "Völundio ~Divergent Sword Saga~" returns
  // nothing for EVERY title/synonym variant, but id 123314 resolves fine), and a
  // failed AniList anchor cascades into garbage ComicVine/Wikipedia matches.
  // NOTE: clearAutoBindingsForReidentify does NOT clear providerMetadata.anilist
  // (AniList is its preserved anchor), so an auto binding survives reidentify —
  // hence we must skip it here when it has been rejected, forcing the matcher to
  // run. A rejected AUTO id drops to null; a manual pin is never filtered.
  // Only an all-digit selectedSourceId is an AniList id; other providers' ids
  // that landed in that column must not mask the bound id or count as a pin.
  const boundAlId = extractBoundAniListId(mangaPin?.providerMetadata);
  const { pinnedAlId, manualPin: hasManualAlPin } = resolveAniListPin({
    selectedSourceId: mangaPin?.selectedSourceId, boundAlId, rejectedAlIds,
  });

  // Only fetch from enabled providers (all in parallel).
  // Each call is capped at 60s so a hung provider can't stall the whole phase.
  const noop = Promise.resolve(null);
  const T = 60_000;
  // Timeout / error signals, so the result can report who did not answer.
  const outcomes = new ProviderOutcomeTracker();
  // ComicVine is intentionally absent from this wave: its only discovery
  // path is the language-aware matcher in the second wave, which wants the
  // AniList anchor when one exists. Running a title-only search here too
  // just burned rate-limited ComicVine API calls on a result the verify
  // step then discarded.
  const [anilistSettled, mangadexSettled, fandomSettled, wikiSettled, muSettled, kitsuSettled] =
    await Promise.allSettled([
      enabled.has('anilist') ? withTimeoutOrNull(fetchAniListDirect(title, { pinnedId: pinnedAlId, fallbackId: options?.previousAniListId, rejectedIds: rejectedAlIds, demoteNovels }), T, 'anilist-fetch', () => outcomes.markTimeout('anilist')) : noop,
      enabled.has('mangadex') ? withTimeoutOrNull(fetchMangaDexDirect(title, directives.mangadex), T, 'mangadex-fetch', () => outcomes.markTimeout('mangadex')) : noop,
      enabled.has('fandom') ? withTimeoutOrNull(fetchFandomForPhase1(mangaId, title, options?.forceRefresh), T, 'fandom-fetch', () => outcomes.markTimeout('fandom')) : noop,
      enabled.has('wikipedia') ? withTimeoutOrNull(fetchWikipediaChapterData(title, mangaId), T, 'wikipedia-fetch', () => outcomes.markTimeout('wikipedia')) : noop,
      enabled.has('mangaupdates') ? withTimeoutOrNull(fetchMangaUpdatesDirect(title, undefined, directives.mangaupdates), T, 'mangaupdates-fetch', () => outcomes.markTimeout('mangaupdates')) : noop,
      enabled.has('kitsu') ? withTimeoutOrNull(fetchKitsuDirect(title, undefined, directives.kitsu), T, 'kitsu-fetch', () => outcomes.markTimeout('kitsu')) : noop,
    ]);

  const anilistData = anilistSettled.status === 'fulfilled' ? anilistSettled.value : null;

  // Binding-as-record (#2): persist the fresh AUTO match as a durable binding
  // (with its score). Pin-fetched entities leave matchScore undefined and are
  // the existing binding, not a new decision — skip those.
  if (anilistData && typeof anilistData.matchScore === 'number') {
    void recordBinding({
      mangaId,
      provider: 'anilist',
      providerId: String(anilistData.id),
      origin: 'auto',
      score: anilistData.matchScore,
    });
  }

  // Phase 3 #2 — sticky-binding freshness check. Skipped when the entity
  // was pin-fetched (matchScore undefined → manual binding) or when there's
  // no prior binding to compare against. Warns only; auto-invalidation is
  // gated on calibration.
  if (anilistData && typeof anilistData.matchScore === 'number') {
    const boundAlId = extractBoundAniListId(mangaPin?.providerMetadata);
    validateBindingFreshness({
      mangaId,
      provider: 'anilist',
      currentScore: anilistData.matchScore,
      boundEntityId: boundAlId,
      manualPin: hasManualAlPin,
    });
  }
  const mdData = mangadexSettled.status === 'fulfilled' ? mangadexSettled.value : null;
  if (mdData && typeof mdData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'mangadex',
      currentScore: mdData.matchScore,
      boundEntityId: mdData.mangaId,
      // A pinned fetch has no matchScore and never reaches here; this is the
      // matcher result of a manual bind whose fetch-by-id failed.
      manualPin: directives.mangadex.pin.kind === 'pinned',
    });
  }
  let mangadexData = mangadexSettled.status === 'fulfilled' ? mangadexSettled.value : null;
  // Populated by the language-aware matcher in the second wave (see below).
  let comicvineData: ComicVineDirectResult | null = null;
  let fandomResult = fandomSettled.status === 'fulfilled' ? fandomSettled.value : null;
  let wikipediaResult = wikiSettled.status === 'fulfilled' ? wikiSettled.value : null;

  let muData = muSettled.status === 'fulfilled' ? muSettled.value : null;
  let kitsuData = kitsuSettled.status === 'fulfilled' ? kitsuSettled.value : null;

  // Phase 3 #2 (rollout) — sticky-binding freshness checks for the
  // remaining title-matched providers. Each warns when the current matcher
  // would no longer accept the existing binding. Manual binds are exempt.
  //
  // MAL is intentionally absent: it's pin-fetched by AL/MD `idMal`
  // cross-reference, so the matcher never runs and there's nothing to be
  // stale against. Fandom + Wikipedia are deferred — their discoverers
  // return only URLs (the validator score is dropped) and cached URLs skip
  // revalidation; a separate periodic revalidator fits that surface better.
  // ComicVine freshness is validated after the second wave — discovery only
  // happens there now (language-aware matcher), so there is no Phase-1 score.
  if (muData && typeof muData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'mangaupdates',
      currentScore: muData.matchScore,
      boundEntityId: extractBoundProviderId(mangaPin?.providerMetadata, 'mangaupdates'),
      manualPin: directives.mangaupdates.pin.kind === 'pinned',
    });
  }
  if (kitsuData && typeof kitsuData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'kitsu',
      currentScore: kitsuData.matchScore,
      boundEntityId: extractBoundProviderId(mangaPin?.providerMetadata, 'kitsu'),
      manualPin: directives.kitsu.pin.kind === 'pinned',
    });
  }

  // Second wave: retry/verify steps that need the AniList anchor. All six
  // read only `anilistData` plus the initial parallel-fetch snapshot
  // captured above and write disjoint results, so they run concurrently —
  // the previous strictly-sequential ordering stacked up to 6×60s of
  // avoidable worst-case latency without changing any input a step saw
  // (each step already read the pre-verify snapshot values). MAL stays
  // after this wave because it cross-references the *verified* MangaDex.
  const [wikipediaRetried, fandomRetried, mangadexVerified, comicvineVerified, muVerified, kitsuRetried] =
    await Promise.allSettled([
      // Retry Wikipedia with Wikidata + provider chapter counts for placeholder fallback
      (async () => {
        if (wikipediaResult || !anilistData || !enabled.has('wikipedia')) return wikipediaResult;
        const mdxCh = mangadexData?.lastChapter ? parseInt(mangadexData.lastChapter, 10) : undefined;
        const muCh = muData?.latestChapter;
        const wikiHints = {
          anilistId: anilistData.id,
          ...(anilistData.details.idMal ? { malId: anilistData.details.idMal } : {}),
          ...(anilistData.details.chapters ? { anilistChapters: anilistData.details.chapters } : {}),
          ...(muCh && muCh > 0 ? { mangaupdatesChapters: muCh } : {}),
          ...(mdxCh && !isNaN(mdxCh) ? { mangadexChapters: mdxCh } : {}),
        };
        return withTimeoutOrNull(
          fetchWikipediaChapterData(title, mangaId, wikiHints), T, 'wikipedia-retry', () => outcomes.markTimeout('wikipedia'),
        );
      })(),
      // Re-discover Fandom when initial parallel fetch failed. Two fallback strategies:
      //   (a) AniList externalLinks.Fandom — direct URL, highest confidence
      //   (b) Re-run discovery with AniList + MU alt titles — the initial call only
      //       had the user-supplied title; alt titles catch titles that search by
      //       their romaji/english/native variants instead of the one fed in.
      // eslint-disable-next-line complexity -- same justification as the enclosing function: two guarded fallback strategies; splitting them would scatter the retry state
      (async () => {
        if (fandomResult || !enabled.has('fandom') || (!anilistData && !muData)) return fandomResult;
        // (a) Direct AniList externalLinks
        const fandomLink = anilistData?.details.externalLinks?.find(
          link => link.url?.includes('.fandom.com') || link.site === 'Fandom',
        );
        if (fandomLink?.url) {
          log.info('Fandom: re-discovering via AniList externalLinks', { url: fandomLink.url });
          const retryResult = await withTimeoutOrNull(
            fetchFandomForPhase1(mangaId, title, false, fandomLink.url), T, 'fandom-retry', () => outcomes.markTimeout('fandom'),
          );
          if (retryResult?.parseSuccess) return retryResult;
        }
        // (b) Re-run discovery with alt titles when no externalLinks pointer exists
        const alDetails = anilistData?.details;
        const altTitles = [
          alDetails?.title.romaji, alDetails?.title.english, alDetails?.title.native,
          ...(alDetails?.synonyms ?? []),
          ...(muData?.alternativeTitles ?? []),
        ].filter((t): t is string => typeof t === 'string' && t.length >= 3 && t !== title);
        if (altTitles.length > 0) {
          log.info('Fandom: re-discovering with alt titles', { count: altTitles.length });
          const retryResult = await withTimeoutOrNull(
            fetchFandomForPhase1(mangaId, title, false, undefined, altTitles),
            T, 'fandom-alt-retry', () => outcomes.markTimeout('fandom'),
          );
          if (retryResult?.parseSuccess) return retryResult;
        }
        return fandomResult;
      })(),
      // Re-verify MangaDex using AniList cross-reference (links.al).
      // The initial parallel fetch only uses title scoring. Now that we have the AniList ID,
      // re-run discovery with links.al pre-filtering for definitive verification.
      (async () => {
        if (!anilistData || !enabled.has('mangadex')) return mangadexData;
        // A pinned entity must not be swapped via links.al; an unbound provider stays unbound.
        if (skipsSecondWave(directives.mangadex, mangadexData)) return mangadexData;
        return withTimeoutOrNull(
          verifyMangaDexWithAniList(title, anilistData, mangadexData, directives.mangadex.rejectedIds), T, 'mangadex-verify', () => outcomes.markTimeout('mangadex'),
        );
      })(),
      // Discover ComicVine via the language-aware matcher — the ONLY ComicVine
      // discovery path. The legacy English-first selector
      // (selectEnglishFirstVolume) was retired: it ignored
      // `comicvine.preferredLanguage` and its last-resort fallback accepted ANY
      // >=0.2 title match regardless of language. Without an AniList anchor the
      // matcher runs on a title-only stand-in so the hard language guard still
      // applies. When the manga has a manual ComicVine binding (set via
      // bindProvider mutation with `manual: true`), the matcher is skipped and
      // we fetch by the bound id; an unbound sentinel skips ComicVine entirely.
      (async () => {
        if (!enabled.has('comicvine')) return null;
        const anilistDetails = anilistData?.details ?? buildTitleOnlyAniListDetails(title);
        return withTimeoutOrNull(
          runLanguageAwareComicVineMatch(anilistDetails, mangaId, directives.comicvine), T, 'comicvine-verify', () => outcomes.markTimeout('comicvine'),
        );
      })(),
      // Re-verify MangaUpdates using AniList cross-validation (year, country, titles).
      // The initial parallel fetch only uses title matching. Now that we have AniList data,
      // re-search with alternative titles and cross-validation scoring.
      (async () => {
        if (!anilistData || !enabled.has('mangaupdates')) return muData;
        // The year/country re-search must not replace a pinned series or re-bind an unbound provider.
        if (skipsSecondWave(directives.mangaupdates, muData)) return muData;
        const alDetails = anilistData.details;
        const alTitles = [
          alDetails.title.romaji, alDetails.title.english, alDetails.title.native,
          ...(alDetails.synonyms ?? []),
        ].filter((t): t is string => typeof t === 'string' && t.length >= 3);
        return withTimeoutOrNull(
          verifyMUWithAniList(
            title,
            { year: alDetails.startDate?.year, countryOfOrigin: alDetails.countryOfOrigin, alternativeTitles: alTitles },
            muData, directives.mangaupdates.rejectedIds,
          ),
          T, 'mangaupdates-verify', () => outcomes.markTimeout('mangaupdates'),
        );
      })(),
      // Retry Kitsu with AniList alt titles when initial title search returned nothing.
      // Kitsu's free-text search is finicky with romanizations; alt titles often unlock matches.
      (async () => {
        if (kitsuData || !anilistData || !enabled.has('kitsu')) return kitsuData;
        // Unbound: the retry must not bind what the user removed. (A pinned
        // result is non-null and returned above; a pin whose fetch failed is
        // retried by title — the directive's pin is dropped so it is not re-fetched.)
        if (skipsSecondWave(directives.kitsu, kitsuData)) return kitsuData;
        const alDetails = anilistData.details;
        const altTitles = [
          alDetails.title.romaji, alDetails.title.english, alDetails.title.native,
          ...(alDetails.synonyms ?? []),
        ].filter((t): t is string => typeof t === 'string' && t.length >= 3 && t !== title);
        if (altTitles.length === 0) return kitsuData;
        return withTimeoutOrNull(
          fetchKitsuDirect(
            title, { year: alDetails.startDate?.year, alternativeTitles: altTitles },
            { pin: { kind: 'none' }, rejectedIds: directives.kitsu.rejectedIds },
          ),
          T, 'kitsu-retry', () => outcomes.markTimeout('kitsu'),
        );
      })(),
    ]);
  // A rejected or timed-out step keeps the first-wave value instead of
  // erasing it (or aborting the whole phase).
  const onWaveStepRejected = (step: string, reason: unknown): void => {
    outcomes.markError(step.split('-')[0] ?? step);
    log.warn(`Second-wave step ${step} failed — keeping first-wave result: ${reason instanceof Error ? reason.message : String(reason)}`);
  };
  wikipediaResult = settledValueOr(wikipediaRetried, wikipediaResult, 'wikipedia-retry', onWaveStepRejected);
  fandomResult = settledValueOr(fandomRetried, fandomResult, 'fandom-retry', onWaveStepRejected);
  mangadexData = settledValueOr(mangadexVerified, mangadexData, 'mangadex-verify', onWaveStepRejected);
  comicvineData = settledValueOr(comicvineVerified, null, 'comicvine-verify', onWaveStepRejected);
  muData = settledValueOr(muVerified, muData, 'mangaupdates-verify', onWaveStepRejected);
  kitsuData = settledValueOr(kitsuRetried, kitsuData, 'kitsu-retry', onWaveStepRejected);

  // ComicVine sticky-binding freshness check (moved here from the Phase-1
  // block — discovery now happens in the wave above). `matchScore` is the
  // matcher's titleSimilarity; undefined for manual pin-fetches, which the
  // check skips.
  if (comicvineData && typeof comicvineData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'comicvine',
      currentScore: comicvineData.matchScore,
      boundEntityId: extractBoundProviderId(mangaPin?.providerMetadata, 'comicvine'),
      manualPin: directives.comicvine.pin.kind === 'pinned',
    });
  }

  // Log any failures
  if (anilistSettled.status === 'rejected') {
    outcomes.markError('anilist');
    log.warn('AniList fetch failed', { error: String(anilistSettled.reason) });
  }
  if (mangadexSettled.status === 'rejected') {
    outcomes.markError('mangadex');
    log.warn('MangaDex fetch failed', { error: String(mangadexSettled.reason) });
  }
  if (muSettled.status === 'rejected') {
    outcomes.markError('mangaupdates');
    log.warn('MangaUpdates fetch failed', { error: String(muSettled.reason) });
  }
  if (kitsuSettled.status === 'rejected') {
    outcomes.markError('kitsu');
    log.warn('Kitsu fetch failed', { error: String(kitsuSettled.reason) });
  }

  // Fetch MAL data when enabled and idMal is available (from AniList or MangaDex links.mal)
  // An unbound MAL stays unfetched (it has no matcher, only this cross-reference fetch).
  const malData = enabled.has('mal') && !directives.malUnbound
    ? await withTimeoutOrNull(
        fetchMALWithCrossValidation(anilistData, mangadexData, title, (reason) => options?.claimRun?.noteFetchFailure('mal', reason)), T, 'mal-fetch', () => outcomes.markTimeout('mal'),
      )
    : null;

  // Multi-series wiki gate: when a wiki's chapter list is >2× the expected
  // count for this manga, the wiki is almost certainly a series-wide catalog
  // (e.g. jojo.fandom.com lists 900+ chapters across all 9 JoJo parts) or a
  // main-series wiki bound to a spin-off (e.g. naruto.fandom.com's 700
  // chapters on "Naruto Shinden" whose AL entry has 10). Wipe chapterList +
  // volumeList at the source so every downstream consumer sees an empty
  // set. Metadata fields (summary/cover) remain intact since they live on
  // the manga page, not the chapter list.
  //
  // Three-tier gate, most precise first:
  //   1. AniList comparison (>2× ratio with AL >= 5). Best signal — AL indexes
  //      spin-offs separately from main series even when MangaDex doesn't.
  //   2. MangaDex comparison (>2× ratio with mdx >= 10). Legacy signal.
  //   3. Title-pattern + absolute threshold. Last resort when both AL and MDx
  //      are unavailable (AL outage) and the manga title matches a sub-series
  //      pattern (`Part N`, `Vol N`, `Season N`).
  const OVERFLOW_RATIO = 2.0;
  // Same-universe spin-off backstop: catch a parent series' chapter list that
  // overflows the spin-off's AniList count by a large ABSOLUTE margin while
  // staying under the 2× ratio (e.g. AoT: Before the Fall AL=73, Fandom=139 →
  // the main series' 139 chapters; 139 < 146 so the 2× rule alone misses it).
  // Keep these mirrored with pipeline-orchestrator.ts.
  const FANDOM_TIGHT_RATIO = 1.5;
  const FANDOM_ABS_OVERFLOW = 40;
  const FANDOM_TIGHT_MIN_AL = 30;
  // OVERFLOW_MIN_AL set low (2) so spin-offs with tiny AL chapter counts
  // (Vagabond Saigo no Manga-ten AL=2, JJK 0 AL=4, Chainsaw Man Buddy
  // Stories AL=4) still trip the gate when their main-series wiki floods
  // 200+ chapters. The 2× ratio prevents false positives — a 2-chapter
  // manga whose wiki legitimately has 4 entries doesn't fire.
  const OVERFLOW_MIN_AL = 2;
  const OVERFLOW_MIN_MDX = 10;
  const SUB_SERIES_PATTERN = /\b(part|vol|volume|season|book|arc)\s*\d+/i;
  const SUB_SERIES_HARD_CAP = 200;
  const isSubSeriesTitle = SUB_SERIES_PATTERN.test(title);
  const mdxChCount = mangadexData?.chapterList.length ?? 0;
  const alChCount = anilistData?.details.chapters ?? 0;
  const shouldGate = (wikiChCount: number): { gate: boolean; reason: string } => {
    // Tier 1 — AniList. Most accurate count (spin-offs indexed separately).
    // When AniList provides a count, treat it as authoritative: a wiki count
    // within 2× AL means the wiki is on-series, regardless of how few
    // chapters MangaDex's English feed has. Falling through to the MangaDex
    // tier in that case caused false positives — e.g. Twin Star Exorcists
    // (AL=134, Fandom=135, MangaDex EN feed=12) tripped the MDX rule and
    // had its full chapter list discarded.
    if (alChCount >= OVERFLOW_MIN_AL) {
      if (wikiChCount > alChCount * OVERFLOW_RATIO) {
        return { gate: true, reason: `>${OVERFLOW_RATIO}x AniList (${wikiChCount} vs ${alChCount})` };
      }
      // Absolute-overflow backstop for same-universe spin-offs (1.5×–2× band).
      if (alChCount >= FANDOM_TIGHT_MIN_AL
          && wikiChCount > alChCount * FANDOM_TIGHT_RATIO
          && wikiChCount - alChCount >= FANDOM_ABS_OVERFLOW) {
        return { gate: true, reason: `>${FANDOM_TIGHT_RATIO}x & +${wikiChCount - alChCount} over AniList (${wikiChCount} vs ${alChCount})` };
      }
      return { gate: false, reason: '' };
    }
    // Tier 2 — MangaDex (fallback when AniList missing).
    if (mdxChCount >= OVERFLOW_MIN_MDX && wikiChCount > mdxChCount * OVERFLOW_RATIO) {
      return { gate: true, reason: `>${OVERFLOW_RATIO}x MangaDex (${wikiChCount} vs ${mdxChCount})` };
    }
    // Tier 3 — sub-series title + absolute cap (last resort).
    if (isSubSeriesTitle && wikiChCount > SUB_SERIES_HARD_CAP) {
      return { gate: true, reason: `sub-series title with ${wikiChCount} chapters (cap ${SUB_SERIES_HARD_CAP})` };
    }
    return { gate: false, reason: '' };
  };

  if (fandomResult) {
    const fandomChCount = fandomResult.chapterList.length;
    const { gate, reason } = shouldGate(fandomChCount);
    if (gate) {
      log.warn('Fandom chapter list disabled — likely cross-series wiki', {
        mangaId, fandomChapters: fandomChCount, reason, fandomUrl: fandomResult.url,
      });
      options?.claimRun?.noteGated('fandom', reason, { fandom: fandomResult });
      fandomResult = { ...fandomResult, chapterList: [], volumeList: [] };
    } else {
      // A whole-franchise wiki under the count gate still files its chapters under volumes this series does not have.
      fandomResult = withoutChaptersPastVolumeCeiling(mangaId, fandomResult, anilistData?.details.status, anilistData?.details.volumes);
    }
  }
  if (wikipediaResult) {
    const wikiChCount = wikipediaResult.chapterList.length;
    const { gate, reason } = shouldGate(wikiChCount);
    if (gate) {
      log.warn('Wikipedia chapter list disabled — likely cross-series article', {
        mangaId, wikipediaChapters: wikiChCount, reason,
        wikipediaTitle: wikipediaResult.data.title,
      });
      options?.claimRun?.noteGated('wikipedia', reason, { wikipedia: wikipediaResult });
      wikipediaResult = {
        ...wikipediaResult,
        chapterList: [],
        ownChapterCount: 0,
        data: { ...wikipediaResult.data, volumeList: [] },
      };
    }
  }

  // Build EnrichmentResult from direct provider data (MU + MAL + Kitsu supplement AniList)
  const enrichmentResult = buildEnrichmentResult({
    mangaId, title, anilist: anilistData, mangadex: mangadexData,
    comicvine: comicvineData, mangaupdates: muData, mal: malData, kitsu: kitsuData,
  });

  // Phase 1.5 #12 cutover: the selector is now the primary picker. Overlay
  // its winners onto the legacy enrichmentResult before persistence; legacy
  // Object.assign picks remain only for fields the selector couldn't decide
  // on (drift-guard refusals, all-candidates-failed cases).
  //
  // The telemetry row that used to be the "shadow" record is now the LIVE
  // record — same schema (MetadataSelectionAttempt), same write path.
  await applySelectorCutoverInPlace({
    mangaId,
    anilist: anilistData,
    mangadex: mangadexData,
    mangaupdates: muData,
    mal: malData,
    kitsu: kitsuData,
    comicvine: comicvineData,
    enrichmentResult,
    claimRun: options?.claimRun,
  });

  logPhase1Summary(enrichmentResult, {
    anilist: anilistData, mangadex: mangadexData, comicvine: comicvineData,
    fandom: fandomResult, wikipedia: wikipediaResult, mangaupdates: muData, kitsu: kitsuData,
  });

  if (fandomSettled.status === 'rejected') outcomes.markError('fandom');
  if (wikiSettled.status === 'rejected') outcomes.markError('wikipedia');
  const providerStatus = outcomes.build(enabled, {
    anilist: anilistData, mangadex: mangadexData, comicvine: comicvineData, fandom: fandomResult,
    wikipedia: wikipediaResult, mangaupdates: muData, kitsu: kitsuData, mal: malData,
  });
  const unanswered = unansweredProviders(providerStatus);
  if (unanswered.length > 0) {
    log.warn(`Provider fetch degraded for manga ${mangaId} — no answer from: ${unanswered.join(', ')}`);
  }

  options?.claimRun?.noteFetchPhase({ providerStatus, directives, anilist: anilistData, mangadex: mangadexData, comicvine: comicvineData, mangaupdates: muData, kitsu: kitsuData, mal: malData, fandom: fandomResult, wikipedia: wikipediaResult });
  return {
    ...buildUnifiedResults(enrichmentResult, {
      anilistData, comicvineData, muData, mangadexData, fandomResult, wikipediaResult, malData, kitsuData,
    }),
    providerStatus,
  };
}

/** Build the unified result object from all provider data */
function buildUnifiedResults(
  enrichmentResult: EnrichmentResult,
  providers: {
    anilistData: AniListDirectResult | null;
    comicvineData: ComicVineDirectResult | null;
    muData: MangaUpdatesDirectResult | null;
    mangadexData: MangaDexDirectResult | null;
    fandomResult: UnifiedProviderResults['fandomResult'];
    wikipediaResult: UnifiedProviderResults['wikipediaResult'];
    malData: MALDirectResult | null;
    kitsuData: KitsuDirectResult | null;
  },
): UnifiedProviderResults {
  const { anilistData, comicvineData, muData, mangadexData, fandomResult, wikipediaResult, malData, kitsuData } = providers;

  const anilistCounts = anilistData
    ? { chapters: anilistData.details.chapters ?? null, volumes: anilistData.details.volumes ?? null }
    : null;

  const comicvineResult = comicvineData ? {
    volumeId: comicvineData.volumeId,
    volumeName: comicvineData.seriesVolume.name ?? '',
    publisherName: comicvineData.publisherName,
    issueCount: comicvineData.issues.length,
  } : null;

  const mangaupdatesResult = muData ? {
    seriesId: muData.seriesId, urlSlug: muData.urlSlug,
    title: muData.title, publisher: muData.publisher,
    categories: muData.categories, genres: muData.genres, status: muData.status,
    licensed: muData.licensed, completed: muData.completed, type: muData.type,
    year: muData.year, bayesianRating: muData.bayesianRating,
    ratingVotes: muData.ratingVotes, latestChapter: muData.latestChapter,
    authors: muData.authors, publishers: muData.publishers,
    publications: muData.publications, relatedSeries: muData.relatedSeries,
    recommendations: muData.recommendations,
    alternativeTitles: muData.alternativeTitles, animeMapping: muData.animeMapping,
  } : null;

  const mangadexAggregate = mangadexData?.aggregate ?? null;
  const mangadexChapterList = mangadexData?.chapterList ?? null;
  const kitsuResult = kitsuData ? mapKitsuToUnifiedResult(kitsuData) : null;

  return { enrichmentResult, anilistCounts, fandomResult, wikipediaResult, comicvineResult, mangaupdatesResult, mangadexAggregate, mangadexChapterList, malResult: malData, kitsuResult };
}

// ============================================================================
// MAL Fetch with Cross-Validation
// ============================================================================

/** Fetch MAL data and cross-validate AniList ↔ MangaDex MAL IDs */
async function fetchMALWithCrossValidation(
  anilistData: AniListDirectResult | null,
  mangadexData: MangaDexDirectResult | null,
  title: string,
  onFailure?: (reason: string) => void,
): Promise<MALDirectResult | null> {
  const idMal = anilistData?.details.idMal ?? mangadexData?.malId;
  if (!idMal) return null;

  let malData: MALDirectResult | null = null;
  try {
    malData = await fetchMALDirect(idMal, onFailure);
  } catch (err: unknown) {
    log.warn('MAL fetch failed', { error: err instanceof Error ? err.message : String(err) });
    onFailure?.(err instanceof Error ? err.message : String(err));
  }

  // Cross-validate AniList ↔ MangaDex MAL IDs
  if (anilistData?.details.idMal && mangadexData?.malId &&
      anilistData.details.idMal !== mangadexData.malId) {
    log.warn('MAL ID mismatch between AniList and MangaDex', {
      anilistMalId: anilistData.details.idMal,
      mangadexMalId: mangadexData.malId,
      title,
    });
  }

  return malData;
}

// ============================================================================
// AniList Direct Fetch
// ============================================================================

interface AniListDirectResult {
  id: number;
  details: AniListMangaDetails;
  /**
   * Phase 3 #2: match score the matcher computed for this result against the
   * search query. Undefined when the AL entity was pin-fetched by id (manual
   * binding) — the freshness check skips those.
   */
  matchScore?: number;
}

/**
 * Read the persisted AniList binding id from `providerMetadata.anilist.providerId`.
 * Skips the manual-unbound sentinel (providerId: null) and returns null when no
 * AniList binding is present. Used to pin re-enrichment to the already-bound AL
 * entity when AniList's title search can't reproduce the match.
 */
export function extractBoundAniListId(providerMetadata: unknown): string | null {
  if (providerMetadata === null || typeof providerMetadata !== 'object') return null;
  const al = (providerMetadata as Record<string, unknown>)['anilist'];
  if (al === null || typeof al !== 'object') return null;
  const pid = (al as Record<string, unknown>)['providerId'];
  return typeof pid === 'string' && pid.length > 0 ? pid : null;
}

/**
 * Generic provider-binding id extractor — reads
 * `providerMetadata.<provider>.providerId` and returns it as a string.
 *
 * Used by Phase 3 #2 freshness checks for comicvine, mangaupdates, kitsu.
 * AniList uses the dedicated `extractBoundAniListId` because its path also
 * has to respect the `selectedSourceId` manual pin.
 */
export function extractBoundProviderId(providerMetadata: unknown, provider: string): string | null {
  if (providerMetadata === null || typeof providerMetadata !== 'object') return null;
  const entry = (providerMetadata as Record<string, unknown>)[provider];
  if (entry === null || typeof entry !== 'object') return null;
  const pid = (entry as Record<string, unknown>)['providerId'];
  if (typeof pid === 'string' && pid.length > 0) return pid;
  if (typeof pid === 'number' && Number.isFinite(pid)) return String(pid);
  return null;
}

/**
 * Try to fetch AniList by pinned ID, bypassing search + matcher.
 * Returns null if pinnedId is missing, invalid, or the API returns no data.
 */
async function fetchAniListByPinnedId(pinnedId: string | null | undefined): Promise<AniListDirectResult | null> {
  if (!pinnedId) return null;
  const pinnedIdNum = Number(pinnedId);
  if (!Number.isInteger(pinnedIdNum) || pinnedIdNum <= 0) return null;
  const details = await anilistService.getMangaDetails(pinnedIdNum);
  if (!details) {
    log.warn(`AniList: pinned ID ${pinnedIdNum} returned no details — falling back to search`);
    return null;
  }
  log.info('AniList: pinned ID fetched (matcher skipped)', {
    id: pinnedIdNum, chapters: details.chapters, volumes: details.volumes,
  });
  return { id: pinnedIdNum, details };
}

/**
 * Fetch AniList metadata directly using local AniListService.
 * Returns chapter count, genres, synopsis, cover, status, etc.
 *
 * When `pinnedId` is provided (from Manga.selectedSourceId), the search +
 * matcher are skipped and the AL entity is fetched by ID directly. This
 * lets manual overrides (the resolve-d-tier OVERRIDES table, Phase 4
 * cleanup) bypass the title-similarity matcher when it would otherwise
 * pick a different AL entity (e.g. an anthology with more chapter data
 * than the spin-off the user actually wants).
 */
async function fetchAniListDirect(
  title: string,
  opts: {
    pinnedId?: string | null;
    fallbackId?: string | null | undefined;
    rejectedIds?: ReadonlySet<string>;
    /** Format gate — applies to the matcher only; a pinned id is the user's choice. */
    demoteNovels?: boolean;
  } = {},
): Promise<AniListDirectResult | null> {
  const { pinnedId, fallbackId, rejectedIds, demoteNovels } = opts;
  await anilistService.initialize();

  const isRejected = (id: string | null | undefined): boolean =>
    id !== null && id !== undefined && (rejectedIds?.has(id) ?? false);

  const pinned = await fetchAniListByPinnedId(pinnedId);
  if (pinned) return pinned;

  // Iter-25: strip edition suffix ("Manga", "Colored"…), then retry with a
  // shortened query if the first search returned < 3 candidates. Scoring is
  // done against the original title so edition/spinoff filters still see
  // suffix markers ("GT"/"2nd"/"x365").
  const searchQuery = stripTitlePatterns(title);
  let results = await anilistService.searchManga(searchQuery, {
    limit: 5,
    includeDescription: true,
  });
  if (results.length < 3) {
    const fallback = buildFallbackSearchQuery(searchQuery);
    if (fallback) {
      const extras = await anilistService
        .searchManga(fallback, { limit: 5, includeDescription: true })
        .catch(() => [] as typeof results);
      const byId = new Map<number, (typeof results)[number]>();
      for (const r of results) byId.set(r.id, r);
      for (const r of extras) if (!byId.has(r.id)) byId.set(r.id, r);
      results = Array.from(byId.values());
    }
  }
  // Binding-as-record (#2): drop rejected entities before scoring so the matcher
  // cannot re-land a known-wrong id (e.g. the "No Regrets" spinoff for Attack on
  // Titan). With AniList corrected, the MangaDex links.al cross-ref then follows
  // the right entity automatically.
  if (rejectedIds && rejectedIds.size > 0) {
    results = results.filter((r) => !rejectedIds.has(String(r.id)));
  }
  if (results.length === 0) {
    // The fresh title search found nothing (or every hit was rejected). AniList's
    // search can't reproduce some titles at all — e.g. "Völundio ~Divergent Sword
    // Saga~" returns 0 results for every title/synonym variant, but id 123314
    // resolves fine — so fall back to the previous binding rather than failing the
    // anchor (a failed AniList anchor cascades into garbage ComicVine/Wikipedia
    // matches). Skip the fallback when that previous id has itself been rejected.
    const fallback = isRejected(fallbackId) ? null : await fetchAniListByPinnedId(fallbackId);
    if (fallback) {
      log.info('AniList: title search empty — falling back to previous binding id', { title, fallbackId });
      return fallback;
    }
    log.info('AniList: no results found', { title, searchQuery });
    return null;
  }
  const matched = pickBestTitleMatchWithScore(results, title, { demoteNovels: demoteNovels === true });
  if (!matched) return null;

  // Get full details
  const details = await anilistService.getMangaDetails(matched.result.id);
  if (!details) return null;

  log.info('AniList: matched', {
    id: matched.result.id,
    title: matched.result.title.english ?? matched.result.title.romaji,
    chapters: details.chapters,
    volumes: details.volumes,
    matchScore: matched.score.toFixed(2),
  });

  return { id: matched.result.id, details, matchScore: matched.score };
}

// ============================================================================
// Fandom Fetch (unchanged)
// ============================================================================

/**
 * Fetch Fandom data for Phase 1: discover wiki URL + adaptive parse.
 */
async function fetchFandomForPhase1(
  mangaId: number,
  title: string,
  forceRefresh?: boolean,
  urlOverride?: string,
  externalAltTitles?: string[],
): Promise<UnifiedProviderResults['fandomResult']> {
  const fandomUrl = urlOverride
    ?? await discoverFandomWikiUrl(mangaId, title, forceRefresh, externalAltTitles);
  if (!fandomUrl) return null;

  const fetchResult = await fetchFandomChapterData(fandomUrl, title, externalAltTitles);

  // Persist the actual article page the parser extracted from. This preserves
  // the granular spin-off page (e.g. ".../Attack_on_Titan:_Before_the_Fall_
  // (Manga)") instead of a title-reconstructed guess that drops the colon /
  // "(Manga)" suffix and re-binds to the wiki root → parent-series chapters.
  // Also covers cross-wiki redirects (e.g. monstermanga → obluda).
  const resolvedPageUrl = fetchResult.parseSuccess ? fetchResult.resolvedPageUrl : undefined;
  if (resolvedPageUrl) {
    void updateCachedFandomUrl(mangaId, resolvedPageUrl);
  }

  const effectiveUrl = resolvedPageUrl ?? fandomUrl;

  const result: NonNullable<UnifiedProviderResults['fandomResult']> = {
    url: effectiveUrl,
    chapterList: fetchResult.chapterList,
    volumeList: fetchResult.volumeList,
    parseSuccess: fetchResult.parseSuccess,
  };
  if (fetchResult.rawHtml) result.rawHtml = fetchResult.rawHtml;
  return result;
}

/** Log summary of Phase 1 results across all sources */
function logPhase1Summary(
  enrichmentResult: EnrichmentResult,
  providers: {
    anilist: AniListDirectResult | null;
    mangadex: MangaDexDirectResult | null;
    comicvine: ComicVineDirectResult | null;
    fandom: UnifiedProviderResults['fandomResult'];
    wikipedia: UnifiedProviderResults['wikipediaResult'];
    mangaupdates: UnifiedProviderResults['mangaupdatesResult'];
    kitsu: KitsuDirectResult | null;
  },
): void {
  const { anilist, mangadex, comicvine, fandom, wikipedia, mangaupdates, kitsu } = providers;
  log.info('Phase 1 complete', {
    status: enrichmentResult.status,
    anilist: anilist ? `${anilist.details.chapters ?? '?'} chapters` : 'failed',
    mangadex: mangadex
      ? `status=${mangadex.status} lastVol=${mangadex.lastVolume ?? '?'} lastCh=${mangadex.lastChapter ?? '?'}`
      : 'failed',
    comicvine: comicvine
      ? `${comicvine.issues.length} issues (${comicvine.publisherName ?? 'unknown publisher'})`
      : 'failed',
    fandom: fandom ? `${fandom.chapterList.length} chapters` : 'none',
    wikipedia: wikipedia ? `${wikipedia.chapterList.length} chapters` : 'none',
    mangaupdates: mangaupdates
      ? `${mangaupdates.title} (${mangaupdates.publisher ?? 'no publisher'}, licensed=${mangaupdates.licensed})`
      : 'none',
    kitsu: kitsu
      ? `${kitsu.canonicalTitle} (${kitsu.slug}, ageRating=${kitsu.ageRating ?? 'n/a'})`
      : 'none',
  });
}

// ============================================================================
// Phase 1.5 shadow-mode wrapper
// ============================================================================

/**
 * Build ProviderClaim[] from the same direct results buildEnrichmentResult
 * sees, run the cross-source consensus selector against them, and write a
 * MetadataSelectionAttempt row capturing the shadow output + deltas against
 * the legacy Object.assign chain's pick.
 *
 * Fire-and-forget — caller must not await. Errors are caught + logged
 * inside persistSelectionAttempt; nothing here can fail the enrichment.
 */
interface ShadowInputs {
  mangaId: number;
  anilist: AniListDirectResult | null;
  mangadex: MangaDexDirectResult | null;
  mangaupdates: MangaUpdatesDirectResult | null;
  mal: MALDirectResult | null;
  kitsu: KitsuDirectResult | null;
  comicvine: ComicVineDirectResult | null;
  enrichmentResult: EnrichmentResult;
  claimRun: EnrichmentPipelineOptions['claimRun'];
}

/**
 * Phase 1.5 #12 cutover: runs the selector synchronously, OVERLAYS its
 * winners onto the legacy enrichmentResult, and fires the telemetry write
 * fire-and-forget. The overlay is the load-bearing change; the telemetry is
 * for the selector-loop scorecard.
 *
 * Failures in the overlay path are caught + logged so a selector bug never
 * blocks enrichment — legacy picks remain as the fall-through.
 */
/**
 * The objective fields as currently stored, so an abstention can leave them
 * alone instead of writing the legacy chain's value over them. Empty for a
 * title with no Metadata row yet (or on a read error): the legacy value is
 * then kept, as before.
 */
async function loadStoredObjectiveValues(mangaId: number): Promise<Record<string, unknown>> {
  try {
    const row = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { Metadata: { select: { status: true, chapters: true, volumes: true } } },
    });
    return row?.Metadata ?? {};
  } catch (err: unknown) {
    logger.warn(`Stored-value lookup failed for manga ${mangaId}: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

async function applySelectorCutoverInPlace(inputs: ShadowInputs): Promise<void> {
  try {
    const claims = buildClaimsForShadow(inputs);
    if (claims.length === 0) return;
    const byField = collectCandidates(claims);
    const shadow = runShadowSelection(byField);
    inputs.claimRun?.noteSelection(claims, shadow);
    const legacyMetadata = (inputs.enrichmentResult.appliedMatch?.metadata ?? {}) as Record<string, unknown>;
    const legacyProvenance = (inputs.enrichmentResult.appliedMatch?.perFieldProvenance ?? {}) as Record<string, string>;

    // Capture the pre-overlay state so the telemetry shadowDeltas still
    // record what the legacy Object.assign chain would have picked. The
    // overlay then replaces it in-place for downstream persistence.
    const snapshotMetadata = { ...legacyMetadata };
    const snapshotProvenance = { ...legacyProvenance };
    const deltas = computeShadowDeltas(shadow, snapshotMetadata, snapshotProvenance);

    const cutover = applySelectorCutover(shadow, legacyMetadata, legacyProvenance, await loadStoredObjectiveValues(inputs.mangaId));

    // Field-review markers (objective fields committed at low confidence or
    // abstained) → providerMetadata.fieldReview. Awaited: it rewrites the
    // whole providerMetadata JSON, and when left in flight the persistence
    // phase read the row before it landed and wrote the markers away again.
    // It catches its own errors, so this cannot fail the enrichment.
    await writeFieldReview(inputs.mangaId, cutover.fieldReview);

    // Metadata.fieldAlternatives travels on appliedMatch.metadata to the persister.
    stashFieldAlternatives(
      inputs.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined,
      cutover.fieldAlternatives,
      new Set(claims.map(claim => claim.provider)).size,
    );

    logger.info('Phase 1.5 cutover overlay applied', {
      mangaId: inputs.mangaId,
      fieldsOverlaid: cutover.fieldsOverlaid,
      fieldsSkipped: cutover.fieldsSkipped,
      refusedFieldCount: cutover.refusedFields.length,
    });

    // Fire-and-forget telemetry — must not block enrichment.
    void persistSelectionAttempt(inputs.mangaId, shadow, deltas).catch((err: unknown) => {
      logger.warn(
        `Phase 1.5 telemetry write failed for manga ${inputs.mangaId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  } catch (err: unknown) {
    logger.warn(
      `Phase 1.5 selector cutover failed for manga ${inputs.mangaId} — keeping legacy picks: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
