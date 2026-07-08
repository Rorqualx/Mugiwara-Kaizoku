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

import { prisma } from '@/server/db';
import type { AniListMangaDetails } from '@/server/services/anilist/service';
import { anilistService } from '@/server/services/anilist/service';
import { comicvineConfigService } from '@/server/services/comicvine/configService';
import { findComicVineMatchForAniList } from '@/server/services/comicvine/discovery/language-aware-matcher';
import { isSupportedLanguage } from '@/server/services/comicvine/language-detection/guard-functions';
import type { SupportedLanguage } from '@/server/services/comicvine/language-detection/types';
import type { ComicVineIssue, ComicVineVolume } from '@/server/services/comicvine/service';
import { comicvineService } from '@/server/services/comicvine/service';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import type { MangaDexManga } from '@/server/services/mangadex/types';
import { validateBindingFreshness } from '@/server/services/metadata/binding-validators/freshness-check';
import { writeFieldReview } from '@/server/services/metadata/field-review';
import { aniListClaimFields, collectCandidates, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import { applySelectorCutover } from '@/server/services/metadata/selectors/cutover-overlay';
import { persistSelectionAttempt } from '@/server/services/metadata/selectors/persist-attempt';
import { computeShadowDeltas, runShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import { withTimeoutOrNull } from '@/server/services/shared/with-timeout';
import type { EnrichmentResult } from '@/types/domain/enrichment-result-types';
import { logger } from '@/utils/logger';

import { buildFallbackSearchQuery, stripTitlePatterns } from './matching/title-normalization';
import { pickBestTitleMatchWithScore } from './phase-provider-fetch/anilist-match';
import { buildEnrichmentResult } from './phase-provider-fetch/enrichment-result-builder';
import { extractMangaDexLinks } from './phase-provider-fetch/external-id-extractor';
import { fetchKitsuDirect, mapKitsuToUnifiedResult, type KitsuDirectResult } from './phase-provider-fetch/kitsu-fetch';
import { buildMALMetadataSupplements, fetchMALDirect, type MALDirectResult } from './phase-provider-fetch/mal-fetch';
import { fetchMangaDexAggregate } from './phase-provider-fetch/mangadex-aggregate';
import { fetchMangaDexChapters } from './phase-provider-fetch/mangadex-chapter-list';
import { pickBestMangaDexMatch, pickBestMangaDexMatchWithScore } from './phase-provider-fetch/mangadex-matcher';
import { buildMangaUpdatesMetadataSupplements, fetchMangaUpdatesDirect, verifyMUWithAniList, type MangaUpdatesDirectResult } from './phase-provider-fetch/mangaupdates-fetch';
import { discoverFandomWikiUrl, fetchFandomChapterData, fetchWikipediaChapterData, updateCachedFandomUrl } from './wiki-discovery';

import type { ChapterDataItem, EnrichmentPipelineOptions, EnrichmentProgress, UnifiedProviderResults } from './types';

const log = logger.child('PhaseProviderFetch');

/** Load enabled provider flags from per-provider config keys (`{provider}.enabled`). */
async function loadEnabledProviders(): Promise<Set<string>> {
  // Default: all on except `mal` and `kitsu` (matches `metadataProvidersEnabledMigration` defaults).
  // `kitsu` defaults off to soak before flipping the migration default.
  const PROVIDER_DEFAULTS: Record<string, boolean> = {
    anilist: true,
    mangadex: true,
    comicvine: false,
    mangaupdates: true,
    fandom: true,
    wikipedia: true,
    mal: false,
    kitsu: false,
  };
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
    select: { selectedSourceId: true, providerMetadata: true },
  });
  // Manual pin (selectedSourceId) wins. Otherwise reuse the AniList id already
  // bound in providerMetadata.anilist.providerId so re-enrichment fetches by ID
  // instead of re-searching by title. AniList's search can't reproduce some
  // titles at all (e.g. "Völundio ~Divergent Sword Saga~" returns nothing for
  // EVERY title/synonym variant, but id 123314 resolves fine) — and a failed
  // AniList anchor cascades into garbage ComicVine/Wikipedia matches. REIDENTIFY
  // clears providerMetadata.anilist first (clearAutoBindingsForReidentify), so
  // this fallback only fires when the binding is intentionally being kept.
  const pinnedAlId = mangaPin?.selectedSourceId
    ?? extractBoundAniListId(mangaPin?.providerMetadata)
    ?? null;

  // Only fetch from enabled providers (all in parallel).
  // Each call is capped at 60s so a hung provider can't stall the whole phase.
  const noop = Promise.resolve(null);
  const T = 60_000;
  // ComicVine is intentionally absent from this wave: its only discovery
  // path is the language-aware matcher in the second wave, which wants the
  // AniList anchor when one exists. Running a title-only search here too
  // just burned rate-limited ComicVine API calls on a result the verify
  // step then discarded.
  const [anilistSettled, mangadexSettled, fandomSettled, wikiSettled, muSettled, kitsuSettled] =
    await Promise.allSettled([
      enabled.has('anilist') ? withTimeoutOrNull(fetchAniListDirect(title, pinnedAlId, options?.previousAniListId), T, 'anilist-fetch') : noop,
      enabled.has('mangadex') ? withTimeoutOrNull(fetchMangaDexDirect(title), T, 'mangadex-fetch') : noop,
      enabled.has('fandom') ? withTimeoutOrNull(fetchFandomForPhase1(mangaId, title, options?.forceRefresh), T, 'fandom-fetch') : noop,
      enabled.has('wikipedia') ? withTimeoutOrNull(fetchWikipediaChapterData(title, mangaId), T, 'wikipedia-fetch') : noop,
      enabled.has('mangaupdates') ? withTimeoutOrNull(fetchMangaUpdatesDirect(title), T, 'mangaupdates-fetch') : noop,
      enabled.has('kitsu') ? withTimeoutOrNull(fetchKitsuDirect(title), T, 'kitsu-fetch') : noop,
    ]);

  const anilistData = anilistSettled.status === 'fulfilled' ? anilistSettled.value : null;

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
      manualPin: Boolean(mangaPin?.selectedSourceId),
    });
  }
  const mdData = mangadexSettled.status === 'fulfilled' ? mangadexSettled.value : null;
  if (mdData && typeof mdData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'mangadex',
      currentScore: mdData.matchScore,
      boundEntityId: mdData.mangaId,
      // MD bindings don't use Manga.selectedSourceId (that's AL-only).
      // Manual MD pins live in providerMetadata.mangadex.manualPin and aren't
      // exposed at this layer — false here is acceptable for v1.
      manualPin: false,
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
  // would no longer accept the existing binding. `manualPin: false` for
  // these three — only AniList uses Manga.selectedSourceId; per-provider
  // manual-pin support can be added later if the warn rate makes it useful.
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
      manualPin: false,
    });
  }
  if (kitsuData && typeof kitsuData.matchScore === 'number') {
    validateBindingFreshness({
      mangaId,
      provider: 'kitsu',
      currentScore: kitsuData.matchScore,
      boundEntityId: extractBoundProviderId(mangaPin?.providerMetadata, 'kitsu'),
      manualPin: false,
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
    await Promise.all([
      // Retry Wikipedia with Wikidata + provider chapter counts for placeholder fallback
      (async () => {
        if (wikipediaResult || !anilistData || !enabled.has('wikipedia')) return wikipediaResult;
        const mdxCh = mangadexData?.lastChapter ? parseInt(mangadexData.lastChapter, 10) : undefined;
        const muCh = muData?.latestChapter;
        const wikiHints = {
          anilistId: anilistData.id,
          ...(anilistData.details.idMal ? { malId: anilistData.details.idMal } : {}),
          ...(anilistData.details.chapters ? { anilistChapters: anilistData.details.chapters } : {}),
          ...(muCh && muCh > 0 ? { malChapters: muCh } : {}),
          ...(mdxCh && !isNaN(mdxCh) ? { mangadexChapters: mdxCh } : {}),
        };
        return withTimeoutOrNull(
          fetchWikipediaChapterData(title, mangaId, wikiHints), T, 'wikipedia-retry',
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
            fetchFandomForPhase1(mangaId, title, false, fandomLink.url), T, 'fandom-retry',
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
            T, 'fandom-alt-retry',
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
        return withTimeoutOrNull(
          verifyMangaDexWithAniList(title, anilistData, mangadexData), T, 'mangadex-verify',
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
      // we fetch by the bound id.
      (async () => {
        if (!enabled.has('comicvine')) return null;
        const anilistDetails = anilistData?.details ?? buildTitleOnlyAniListDetails(title);
        return withTimeoutOrNull(
          runLanguageAwareComicVineMatch(anilistDetails, mangaId), T, 'comicvine-verify',
        );
      })(),
      // Re-verify MangaUpdates using AniList cross-validation (year, country, titles).
      // The initial parallel fetch only uses title matching. Now that we have AniList data,
      // re-search with alternative titles and cross-validation scoring.
      (async () => {
        if (!anilistData || !enabled.has('mangaupdates')) return muData;
        const alDetails = anilistData.details;
        const alTitles = [
          alDetails.title.romaji, alDetails.title.english, alDetails.title.native,
          ...(alDetails.synonyms ?? []),
        ].filter((t): t is string => typeof t === 'string' && t.length >= 3);
        return withTimeoutOrNull(
          verifyMUWithAniList(
            title, alDetails.startDate?.year, alDetails.countryOfOrigin, alTitles, muData,
          ),
          T, 'mangaupdates-verify',
        );
      })(),
      // Retry Kitsu with AniList alt titles when initial title search returned nothing.
      // Kitsu's free-text search is finicky with romanizations; alt titles often unlock matches.
      (async () => {
        if (kitsuData || !anilistData || !enabled.has('kitsu')) return kitsuData;
        const alDetails = anilistData.details;
        const altTitles = [
          alDetails.title.romaji, alDetails.title.english, alDetails.title.native,
          ...(alDetails.synonyms ?? []),
        ].filter((t): t is string => typeof t === 'string' && t.length >= 3 && t !== title);
        if (altTitles.length === 0) return kitsuData;
        return withTimeoutOrNull(
          fetchKitsuDirect(title, { year: alDetails.startDate?.year, alternativeTitles: altTitles }),
          T, 'kitsu-retry',
        );
      })(),
    ]);
  wikipediaResult = wikipediaRetried;
  fandomResult = fandomRetried;
  mangadexData = mangadexVerified;
  comicvineData = comicvineVerified;
  muData = muVerified;
  kitsuData = kitsuRetried;

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
      manualPin: false,
    });
  }

  // Log any failures
  if (anilistSettled.status === 'rejected') {
    log.warn('AniList fetch failed', { error: String(anilistSettled.reason) });
  }
  if (mangadexSettled.status === 'rejected') {
    log.warn('MangaDex fetch failed', { error: String(mangadexSettled.reason) });
  }
  if (muSettled.status === 'rejected') {
    log.warn('MangaUpdates fetch failed', { error: String(muSettled.reason) });
  }
  if (kitsuSettled.status === 'rejected') {
    log.warn('Kitsu fetch failed', { error: String(kitsuSettled.reason) });
  }

  // Fetch MAL data when enabled and idMal is available (from AniList or MangaDex links.mal)
  const malData = enabled.has('mal')
    ? await withTimeoutOrNull(
        fetchMALWithCrossValidation(anilistData, mangadexData, title), T, 'mal-fetch',
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
      fandomResult = { ...fandomResult, chapterList: [], volumeList: [] };
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
      wikipediaResult = {
        ...wikipediaResult,
        chapterList: [],
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
  applySelectorCutoverInPlace({
    mangaId,
    anilist: anilistData,
    mangadex: mangadexData,
    mangaupdates: muData,
    mal: malData,
    kitsu: kitsuData,
    comicvine: comicvineData,
    enrichmentResult,
  });

  logPhase1Summary(enrichmentResult, {
    anilist: anilistData, mangadex: mangadexData, comicvine: comicvineData,
    fandom: fandomResult, wikipedia: wikipediaResult, mangaupdates: muData, kitsu: kitsuData,
  });

  return buildUnifiedResults(enrichmentResult, {
    comicvineData, muData, mangadexData, fandomResult, wikipediaResult, malData, kitsuData,
  });
}

/** Build the unified result object from all provider data */
function buildUnifiedResults(
  enrichmentResult: EnrichmentResult,
  providers: {
    comicvineData: ComicVineDirectResult | null;
    muData: MangaUpdatesDirectResult | null;
    mangadexData: MangaDexDirectResult | null;
    fandomResult: UnifiedProviderResults['fandomResult'];
    wikipediaResult: UnifiedProviderResults['wikipediaResult'];
    malData: MALDirectResult | null;
    kitsuData: KitsuDirectResult | null;
  },
): UnifiedProviderResults {
  const { comicvineData, muData, mangadexData, fandomResult, wikipediaResult, malData, kitsuData } = providers;

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

  return { enrichmentResult, fandomResult, wikipediaResult, comicvineResult, mangaupdatesResult, mangadexAggregate, mangadexChapterList, malResult: malData, kitsuResult };
}

// ============================================================================
// MAL Fetch with Cross-Validation
// ============================================================================

/** Fetch MAL data and cross-validate AniList ↔ MangaDex MAL IDs */
async function fetchMALWithCrossValidation(
  anilistData: AniListDirectResult | null,
  mangadexData: MangaDexDirectResult | null,
  title: string,
): Promise<MALDirectResult | null> {
  const idMal = anilistData?.details.idMal ?? mangadexData?.malId;
  if (!idMal) return null;

  let malData: MALDirectResult | null = null;
  try {
    malData = await fetchMALDirect(idMal);
  } catch (err: unknown) {
    log.warn('MAL fetch failed', { error: err instanceof Error ? err.message : String(err) });
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
  title: string, pinnedId?: string | null, fallbackId?: string | null,
): Promise<AniListDirectResult | null> {
  await anilistService.initialize();

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
  if (results.length === 0) {
    // The fresh title search found nothing. On reidentify the bound id was
    // cleared before the pipeline ran (clearAutoBindingsForReidentify), so a
    // correct binding would otherwise be destroyed whenever AniList's search
    // can't reproduce the title — e.g. "Völundio ~Divergent Sword Saga~"
    // returns 0 results for every title/synonym variant, but id 123314 resolves
    // fine. Fall back to the previous binding rather than failing the anchor
    // (a failed AniList anchor cascades into garbage ComicVine/Wikipedia matches).
    const fallback = await fetchAniListByPinnedId(fallbackId);
    if (fallback) {
      log.info('AniList: title search empty — falling back to previous binding id', { title, fallbackId });
      return fallback;
    }
    log.info('AniList: no results found', { title, searchQuery });
    return null;
  }
  const matched = pickBestTitleMatchWithScore(results, title);
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
// MangaDex Direct Fetch
// ============================================================================

/**
 * MangaDex metadata result — status, lastVolume, lastChapter, plus aggregate.
 * Aggregate provides definitive volume→chapter mapping for cross-validation.
 */
interface MangaDexDirectResult {
  mangaId: string;
  status: string;
  lastVolume: string | undefined;
  lastChapter: string | undefined;
  aggregate: UnifiedProviderResults['mangadexAggregate'];
  chapterList: ChapterDataItem[];
  malId: number | undefined;
  /** Phase 3 #2: matcher score for the picked entity; used by validateBindingFreshness. */
  matchScore?: number;
  /**
   * Manga-level description from MangaDex, localized when possible.
   * Used as a fallback when AniList returns an empty description
   * (iter-27: many obscure JP titles have no AL description but do have MD).
   */
  description: string | undefined;
  /** All non-empty entries from MangaDex attributes.links — al, mu, ap, kt, bw, amz, ebj, etc. */
  externalIds: Record<string, string>;
  /** Phase 1: MangaDex contentRating ('safe'/'suggestive'/'erotica'/'pornographic'). */
  contentRating: string | undefined;
  /** Phase 1: publicationDemographic ('shounen'/'shoujo'/'josei'/'seinen'). */
  publicationDemographic: string | undefined;
}

/** Pick the best-localized MangaDex description. English first, then JP-romaji, then any other. */
function pickMangaDexDescription(desc: Record<string, string> | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'object') return undefined;
  const en = desc['en'];
  if (en && en.trim().length > 0) return en.trim();
  const ja = desc['ja-ro'] ?? desc['ja'];
  if (ja && ja.trim().length > 0) return ja.trim();
  for (const v of Object.values(desc)) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Parse MAL ID from MangaDex links.mal (string) to number */
function parseMalLink(malLink: string | undefined): number | undefined {
  if (!malLink) return undefined;
  const parsed = parseInt(malLink, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Fetch MangaDex metadata + aggregate volume→chapter mapping.
 * Aggregate provides ground-truth volume ranges for cross-validation.
 */
async function fetchMangaDexDirect(title: string): Promise<MangaDexDirectResult | null> {
  const client = await getTsMangadexClient();

  const searchResult = await client.searchManga({ title });
  const dataArr = Array.isArray(searchResult.data) ? searchResult.data : [searchResult.data];
  const matched = pickBestMangaDexMatchWithScore(dataArr, title, client);
  if (!matched) {
    log.info('MangaDex: no results found', { title });
    return null;
  }
  const bestManga = matched.result;

  log.info('MangaDex: matched metadata', {
    id: bestManga.id,
    status: bestManga.attributes.status,
    lastVolume: bestManga.attributes.lastVolume,
    lastChapter: bestManga.attributes.lastChapter,
  });

  const [aggregate, chapterList] = await Promise.all([
    fetchMangaDexAggregate(client, bestManga.id),
    fetchMangaDexChapters(client, bestManga.id),
  ]);

  return {
    mangaId: bestManga.id,
    status: bestManga.attributes.status,
    lastVolume: bestManga.attributes.lastVolume ?? undefined,
    lastChapter: bestManga.attributes.lastChapter ?? undefined,
    aggregate,
    chapterList,
    malId: parseMalLink(bestManga.attributes.links?.mal),
    description: pickMangaDexDescription(bestManga.attributes.description as Record<string, string> | null | undefined),
    externalIds: extractMangaDexLinks(bestManga.attributes.links),
    matchScore: matched.score,
    // Phase 1: surface contentRating + publicationDemographic so the persister
    // can write the dedicated Metadata columns. Always present on attributes.
    contentRating: bestManga.attributes.contentRating,
    publicationDemographic: bestManga.attributes.publicationDemographic ?? undefined,
  };
}

/**
 * Build a MangaDexDirectResult from a `MangaDexManga` payload + side-fetched
 * aggregate/chapter list. Extracted from `verifyMangaDexWithAniList` to keep
 * the verifier's branching focused on discovery vs. result assembly.
 */
async function buildMangaDexDirectResult(
  client: Awaited<ReturnType<typeof getTsMangadexClient>>,
  best: MangaDexManga,
): Promise<MangaDexDirectResult> {
  const [aggregate, chapterList] = await Promise.all([
    fetchMangaDexAggregate(client, best.id),
    fetchMangaDexChapters(client, best.id),
  ]);
  return {
    mangaId: best.id, status: best.attributes.status,
    lastVolume: best.attributes.lastVolume ?? undefined,
    lastChapter: best.attributes.lastChapter ?? undefined,
    aggregate,
    chapterList,
    malId: parseMalLink(best.attributes.links?.mal),
    description: pickMangaDexDescription(best.attributes.description as Record<string, string> | null | undefined),
    externalIds: extractMangaDexLinks(best.attributes.links),
    contentRating: best.attributes.contentRating,
    publicationDemographic: best.attributes.publicationDemographic ?? undefined,
  };
}

/**
 * Re-verify MangaDex match using AniList cross-reference.
 * Re-searches with AniList title variants and uses links.al pre-filtering.
 */
async function verifyMangaDexWithAniList(
  title: string, anilist: AniListDirectResult, existing: MangaDexDirectResult | null,
): Promise<MangaDexDirectResult | null> {
  const client = await getTsMangadexClient();
  const queries = new Set([title]);
  const romaji = anilist.details.title.romaji;
  const english = anilist.details.title.english;
  const native = anilist.details.title.native;
  if (romaji) queries.add(romaji);
  if (english) queries.add(english);
  if (native) queries.add(native);
  for (const syn of anilist.details.synonyms ?? []) {
    if (syn.length >= 3) queries.add(syn);
  }

  const seenIds = new Set<string>();
  const allResults: MangaDexManga[] = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop -- MangaDex search is rate-limited and the loop typically runs only 3-7 query variants per title; serial is safer than parallel here
    const res = await client.searchManga({ title: q });
    const arr = Array.isArray(res.data) ? res.data : [res.data];
    for (const m of arr as MangaDexManga[]) {
      if (!seenIds.has(m.id)) { seenIds.add(m.id); allResults.push(m); }
    }
  }

  const chapters = anilist.details.chapters ?? null;
  const year = anilist.details.startDate?.year ?? null;
  const best = pickBestMangaDexMatch(allResults, title, client, anilist.id, chapters, year);
  if (!best) return existing;

  // If re-discovery found the same manga, keep existing (already has aggregate)
  if (existing && best.id === existing.mangaId) return existing;

  return buildMangaDexDirectResult(client, best);
}

// ============================================================================
// ComicVine Discovery (language-aware matcher)
// ============================================================================

interface ComicVineDirectResult {
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
 * Use the language-aware matcher to discover the best ComicVine volume for an
 * AniList entry, then fetch all its issues.
 *
 * Returns null if no candidate matches the preferred language — by design.
 * The loop in `docs/research/comicvine-accuracy/` measures this rate.
 */
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
 * Parse a ComicVine providerId into a numeric volume id.
 * The bind UI (`provider-bind-config.ts:extractProviderIdFromUrl`) extracts
 * `4050-N` from pasted URLs (4050 = CV volume type prefix), so the stored
 * providerId may be either `"50244"` or `"4050-50244"`. Both must resolve
 * to the volume id `50244`.
 */
function parseComicVineVolumeId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Match `4050-50244` (publisher prefix + id) or a bare `50244`.
  const match = /^(?:\d+-)?(\d+)$/.exec(trimmed);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Look up the manually-bound ComicVine volume id for a manga, if any.
 * Returns the numeric volumeId only when `providerMetadata.comicvine.manual === true`
 * — pipeline-set bindings are intentionally ignored so a stale auto-match
 * doesn't permanently lock out a better candidate.
 */
async function readManualComicVineVolumeId(mangaId: number): Promise<number | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const pm = manga?.providerMetadata as Record<string, unknown> | null;
  const cv = pm?.['comicvine'] as Record<string, unknown> | undefined;
  if (cv?.['manual'] !== true) return null;
  return parseComicVineVolumeId(cv['providerId']);
}

/**
 * Fetch a CV volume by id and shape it into the same `ComicVineDirectResult`
 * the matcher returns, so downstream phases (Volume persistence, externalLinks)
 * are unchanged.
 */
async function fetchManualComicVineMatch(volumeId: number): Promise<ComicVineDirectResult | null> {
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    log.warn('ComicVine not initialized; cannot honor manual binding', { volumeId });
    return null;
  }
  const volume = await comicvineService.getCompleteVolumeInfo(volumeId);
  if (!volume) {
    log.warn('ComicVine: manual binding volume not found via API', { volumeId });
    return null;
  }
  const issues = await comicvineService.getAllVolumeIssues(volumeId);
  log.info('ComicVine: honoring manual binding (matcher skipped)', {
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

async function runLanguageAwareComicVineMatch(
  anilistDetails: AniListMangaDetails,
  mangaId?: number,
): Promise<ComicVineDirectResult | null> {
  if (mangaId !== undefined) {
    const { isManuallyUnbound } = await import('./manual-binding-sentinel');
    if (await isManuallyUnbound(mangaId, 'comicvine')) {
      log.info(`ComicVine: skipping match for manga ${mangaId} — manually marked as unbound`);
      return null;
    }
    const manualVolumeId = await readManualComicVineVolumeId(mangaId);
    if (manualVolumeId !== null) {
      const manual = await fetchManualComicVineMatch(manualVolumeId);
      if (manual) return manual;
      // Manual binding existed but the API call failed — fall through to the
      // matcher rather than returning null, so the user still gets some result.
    }
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
    return null;
  }

  const matched = matchResult.matched;
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
function buildTitleOnlyAniListDetails(title: string): AniListMangaDetails {
  return { id: 0, title: { english: title } };
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
function applySelectorCutoverInPlace(inputs: ShadowInputs): void {
  try {
    const claims = buildClaimsForShadow(inputs);
    if (claims.length === 0) return;
    const byField = collectCandidates(claims);
    const shadow = runShadowSelection(byField);
    const legacyMetadata = (inputs.enrichmentResult.appliedMatch?.metadata ?? {}) as Record<string, unknown>;
    const legacyProvenance = (inputs.enrichmentResult.appliedMatch?.perFieldProvenance ?? {}) as Record<string, string>;

    // Capture the pre-overlay state so the telemetry shadowDeltas still
    // record what the legacy Object.assign chain would have picked. The
    // overlay then replaces it in-place for downstream persistence.
    const snapshotMetadata = { ...legacyMetadata };
    const snapshotProvenance = { ...legacyProvenance };
    const deltas = computeShadowDeltas(shadow, snapshotMetadata, snapshotProvenance);

    const cutover = applySelectorCutover(shadow, legacyMetadata, legacyProvenance);

    // Field-review markers (objective fields committed at low confidence or
    // abstained) → providerMetadata.fieldReview. Fire-and-forget.
    void writeFieldReview(inputs.mangaId, cutover.fieldReview);

    // Stash fieldAlternatives on the result so the persister can write
    // Metadata.fieldAlternatives. Lives on appliedMatch so it flows through
    // the existing channel.
    if (inputs.enrichmentResult.appliedMatch && Object.keys(cutover.fieldAlternatives).length > 0) {
      const am = inputs.enrichmentResult.appliedMatch as { metadata?: Record<string, unknown> };
      if (am.metadata) {
        am.metadata['fieldAlternatives'] = cutover.fieldAlternatives;
      }
    }

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

function buildClaimsForShadow(inputs: ShadowInputs): ProviderClaim[] {
  const claims: ProviderClaim[] = [];
  pushAniListClaim(inputs.anilist, claims);
  pushMangaDexClaim(inputs.mangadex, claims);
  pushMangaUpdatesClaim(inputs.mangaupdates, inputs.comicvine, claims);
  pushMALClaim(inputs.mal, claims);
  pushKitsuClaim(inputs.kitsu, claims);
  pushComicVinePublisherClaim(inputs.comicvine, claims);
  return claims;
}

function pushAniListClaim(anilist: AniListDirectResult | null, claims: ProviderClaim[]): void {
  if (!anilist) return;
  claims.push({ provider: 'anilist', matchConfidence: 0.95, fields: aniListClaimFields(anilist.details) });
}

function pushMangaDexClaim(mangadex: MangaDexDirectResult | null, claims: ProviderClaim[]): void {
  if (!mangadex) return;
  const fields: Record<string, unknown> = { status: mangadex.status };
  if (mangadex.description) fields['summary'] = mangadex.description;
  if (mangadex.contentRating) fields['contentRating'] = mangadex.contentRating;
  if (mangadex.publicationDemographic) fields['publicationDemographic'] = mangadex.publicationDemographic;
  claims.push({ provider: 'mangadex', matchConfidence: 0.95, fields });
}

function pushMangaUpdatesClaim(
  mangaupdates: MangaUpdatesDirectResult | null,
  comicvine: ComicVineDirectResult | null,
  claims: ProviderClaim[],
): void {
  if (!mangaupdates) return;
  claims.push({
    provider: 'mangaupdates',
    matchConfidence: 0.92,
    fields: buildMangaUpdatesMetadataSupplements({}, mangaupdates, comicvine?.publisherName),
  });
}

function pushMALClaim(mal: MALDirectResult | null, claims: ProviderClaim[]): void {
  if (!mal) return;
  claims.push({ provider: 'mal', matchConfidence: 0.92, fields: buildMALMetadataSupplements({}, mal) });
}

function pushKitsuClaim(kitsu: KitsuDirectResult | null, claims: ProviderClaim[]): void {
  if (!kitsu) return;
  const fields: Record<string, unknown> = {};
  if (kitsu.ageRating) fields['contentRating'] = kitsu.ageRating;
  if (kitsu.synopsis) fields['summary'] = kitsu.synopsis;
  if (kitsu.alternativeTitles.length > 0) fields['synonyms'] = kitsu.alternativeTitles;
  if (kitsu.subtype) fields['format'] = kitsu.subtype.toUpperCase();
  if (kitsu.posterImageUrl) fields['cover'] = kitsu.posterImageUrl;
  if (kitsu.chapterCount && kitsu.chapterCount > 0) fields['chapters'] = kitsu.chapterCount;
  if (kitsu.volumeCount && kitsu.volumeCount > 0) fields['volumes'] = kitsu.volumeCount;
  claims.push({ provider: 'kitsu', matchConfidence: 0.85, fields });
}

function pushComicVinePublisherClaim(comicvine: ComicVineDirectResult | null, claims: ProviderClaim[]): void {
  if (!comicvine?.publisherName) return;
  claims.push({
    provider: 'comicvine',
    matchConfidence: 0.85,
    fields: { publishers: [comicvine.publisherName] },
  });
}
