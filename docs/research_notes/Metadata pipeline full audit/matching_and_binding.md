# Provider identification, title matching and binding algorithms (code audit)

Audit date 2026-10-10, read-only, HEAD `c2447c1a9`. Nothing was executed against APIs or the DB; every "verified" item below was read in source, every "inference" is reasoning from that source.
Path legend: `EP/` = `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/`, `PPF` = `EP/phase-provider-fetch.ts`, `SVC/` = `src/server/services/`. Severity scale: Critical / High / Medium / Low.

## 1. Which string-normalization and similarity algorithms are used, are they consistent, what do they cost, are they memoized?

### Takeaway
The live enrichment pipeline uses one core primitive (bigram Sørensen–Dice over an ASCII-only, whitespace-stripped normalization) but every provider wraps it in a different length penalty, bonus scheme and floor, and ComicVine and Wikipedia carry their own divergent copies. CPU cost is negligible (5–40 candidates); nothing is memoized, and the real cost is serial network fan-out over uncapped title variants.

### Cited Findings
- Core primitive: `normalizeTitle` = NFKD fold, lowercase, strip everything outside `[a-z0-9]` (including spaces); `diceCoefficient` = multiset bigram Dice, returns 0 when either side is under 2 chars — [src/server/utils/string.ts:118-148]; re-exported to the pipeline at [EP/utils.ts:10].
- Verified consequence: any non-Latin title (Japanese native, Korean, Chinese) normalizes to `""` and scores 0, so native titles never contribute to AniList/MangaDex/Kitsu/MangaUpdates scoring — stated in the code comment at [src/server/utils/string.ts:122-126]. Severity Medium: libraries with native-script folder names cannot be matched by this path at all.
- AniList picker: max Dice over english/romaji/native then synonyms, no length penalty; adult result ×0.5; single-token guard −0.25; tie-breaks primary-over-synonym then popularity; floor 0.3 — [EP/phase-provider-fetch/anilist-match.ts:58-73, 76-82, 87-89, 99]. Guard definition at [EP/matching/sequel-penalty.ts:74-88].
- MangaDex picker: `dice × lenRatio × chapterFactor × yearFactor`, where `lenRatio` uses RAW (un-normalized) string lengths; floor 0.4 — [EP/phase-provider-fetch/mangadex-matcher.ts:41-56, 79-91].
- Kitsu picker: Dice × one-sided length multiplier (only when candidate is over 1.5× the query, floored at 0.5) plus additive popularity (≤ +0.1) and year (+0.1 / −0.2); floor 0.3 — [EP/phase-provider-fetch/kitsu-fetch.ts:86-113, 131].
- MangaUpdates picker: same one-sided multiplier, additive popularity (≤ +0.15), country/type (+0.15 / −0.3), year (+0.1 / −0.25); floor 0.3 applied AFTER the additive terms — [EP/phase-provider-fetch/mangaupdates-fetch.ts:98-120, 161-192].
- ComicVine: a private copy of `diceCoefficient` and a different normalizer (`normalizeForComicVineSearch`), symmetric min/max length ratio on normalized strings, synonyms at ×0.85 only when the canonical score is under 0.5, floor 0.55 — [SVC/comicvine/discovery/language-aware-matcher.ts:123-158, 172-208, 283].
- Wikipedia: a third implementation — SET-based (not multiset) bigram Dice with a Unicode-aware normalizer `[^\p{L}\p{N}]`, multiplied by a raw-length ratio; floor 0.30 — [SVC/wikipedia/wikipedia/manga-extractor/best-match-finder-helpers.ts:195-235]. A fourth bigram copy lives in [SVC/metadata/binding-validators/wiki-freshness-audit.ts:51-80].
- Fandom validator uses the shared Dice plus containment and token heuristics — [EP/wiki-discovery/fandom-wiki-validator.ts:18, 63-80, 297-349].
- Repo-wide duplication found by `ast-grep` over function definitions: `levenshteinDistance` is defined 6 times ([src/server/utils/string.ts:16], [src/utils/string.ts:241], [SVC/metadata/provider-matching/types-and-utils.ts:153], [SVC/matching/base-filename-matcher.ts:75], [SVC/auto-labeling/ground-truth.ts:593], [src/server/ml/training/bootstrap-labeler/title-validator/fuzzy-matcher.ts:11]); Jaccard twice ([SVC/matching/base-filename-matcher.ts:148], [src/components/addManga/utils/result-matching.ts:44]); functions named `normalizeTitle` 8 times (e.g. [SVC/comicvine/title-variants.ts:18], [SVC/wikipedia/adaptive/url-discoverer.ts:352], [src/components/addManga/utils/result-matching.ts:89]). No Jaro-Winkler or trigram function definition was found in `src/`.
- A second, older matcher stack still exists beside the pipeline: [SVC/metadata/providerMatchingService.ts] (355 lines), [SVC/metadata/provider-matching/core-matching.ts:56] (`calculateTitleSimilarity`, 519 lines), [src/server/utils/providerMatcher.ts] (541 lines), plus the import-wizard scorer in `src/components/library/import-pipeline/hooks/useDetectMatch/helpers.ts` (the one `match-loop` tests, see section 6).
- No memoization: `normalizeTitle(c)` is recomputed per candidate per call; in MangaUpdates the `queryVariants` array (normalizing every AniList alt title) is rebuilt inside the per-hit loop — [EP/phase-provider-fetch/mangaupdates-fetch.ts:136-148]; Kitsu's `scoreCandidate` does the same per hit — [EP/phase-provider-fetch/kitsu-fetch.ts:74-78].
- Candidate pool sizes: AniList 5 per query [PPF:704-707], Kitsu 5 per query [EP/phase-provider-fetch/kitsu-fetch.ts:200], MangaUpdates 10 per query [EP/phase-provider-fetch/mangaupdates-fetch.ts:227], ComicVine 40 per variant [SVC/comicvine/discovery/language-aware-matcher.ts:365].
- Network fan-out is serial and uncapped by variant count: MangaDex verify searches title + romaji + english + native + every synonym of 3+ chars one at a time [PPF:893-913]; MangaUpdates and Kitsu do the same over alt titles [EP/phase-provider-fetch/mangaupdates-fetch.ts:217-234], [EP/phase-provider-fetch/kitsu-fetch.ts:191-207]; ComicVine iterates variants sequentially but breaks on first eligible match [SVC/comicvine/discovery/language-aware-matcher.ts:359-394].
- Redundant DB reads of the same `Manga.providerMetadata` row within one phase: [PPF:120-123], [PPF:1014-1017], and one `findUnique` per `isManuallyUnbound` call [EP/manual-binding-sentinel.ts:58-67] invoked at [PPF:1061], [EP/wiki-discovery.ts:56], [EP/wiki-discovery.ts:671].
- The score reported for a pick is NOT the score that selected it: `pickBestTitleMatchWithScore` re-derives raw max Dice without the adult ×0.5 or the −0.25 single-token penalty [EP/phase-provider-fetch/anilist-match.ts:122-138]; the MangaDex variant drops the chapter and year factors [EP/phase-provider-fetch/mangadex-matcher.ts:163-183]. That inflated value is what is stored in `ProviderBinding.score` [PPF:168-175] and compared against `bindMin` [PPF:182-190]. Severity Medium.

### Inferences
- Similarity math is O(n+m) per pair and at most a few hundred pairs per title, so algorithmic optimization buys nothing; latency is dominated by the serial searches (a title with 10 AniList synonyms costs roughly 13 MangaDex searches in the verify step alone). Capping variants at 3–4 and de-duplicating by normalized form is the performance lever.
- Because each provider applies a different length treatment, the same pair of titles yields different scores per provider, so the per-provider floors and the registry's `bindMin` are not comparable quantities. AniList is the most permissive (no length penalty): the ComicVine file's own comment puts Dice("Dragon Ball","Dragon Ball Z") at about 0.91 [SVC/comicvine/discovery/language-aware-matcher.ts:150-153].
- Whitespace-stripped bigrams erase word boundaries, which is why two separate token-level patches exist (single-token guard, edition regexes). A token-set or word-aware score would remove the need for both.
- The four Dice variants can disagree on the same input (multiset vs set; ASCII vs Unicode normalization; raw vs normalized length), so a binding accepted by the Wikipedia picker can be flagged by `wiki-freshness-audit` or vice versa.

### Gaps
- The legacy `providerMatchingService` / `providerMatcher.ts` stack and the wizard scorer were located and sized but not read line by line; I did not establish which tRPC routes still reach them.
- `normalizeForComicVineSearch` [SVC/comicvine/title-variants.ts] and the body of the Fandom validator were not read in full.
- `applySequelPenalty` (−0.35) [EP/matching/sequel-penalty.ts:52-65] is not imported by `anilist-match.ts` (which imports only `applySingleTokenGuard`, line 15); whether any live path calls it was not checked.

## 2. What are the confidence thresholds and floors, how were they calibrated, and where are the magic numbers?

### Takeaway
There are three unrelated threshold families — per-matcher accept floors (0.30–0.55, hardcoded in each file), registry `bindMin` (0.55–0.70, log-only), and registry `matchConfidence` (a per-provider constant, not a match score) — and they are mutually inconsistent: matchers accept at 0.30 what the freshness check calls stale below 0.70, and nothing acts on the difference.

### Cited Findings
- Accept floors, all inline literals: AniList 0.3 [EP/phase-provider-fetch/anilist-match.ts:99]; MangaDex 0.4 [EP/phase-provider-fetch/mangadex-matcher.ts:91]; Kitsu 0.3 [EP/phase-provider-fetch/kitsu-fetch.ts:131]; MangaUpdates 0.3 [EP/phase-provider-fetch/mangaupdates-fetch.ts:189]; ComicVine 0.55 [SVC/comicvine/discovery/language-aware-matcher.ts:283]; Wikipedia 0.30 [SVC/wikipedia/wikipedia/manga-extractor/best-match-finder-helpers.ts:195]; Fandom accept 0.45 / reject ceiling 0.25 / high-confidence 0.7 / containment ratio 0.4 [EP/wiki-discovery/fandom-wiki-validator.ts:63-80].
- Registry `bindMin`: anilist 0.70, mangadex 0.70, mal 0.65, mangaupdates 0.60, kitsu/comicvine/fandom/wikipedia 0.55 — [src/lib/metadata/provider-registry.ts:82, 99, 116, 131, 145, 154, 163, 172]. Its only consumer is `validateBindingFreshness`, which only logs a warning ("Phase 3 v1 — logs only") — [SVC/metadata/binding-validators/freshness-check.ts:15-16, 31-33, 51-69].
- Registry `matchConfidence` (0.95/0.95/0.92/0.92/0.85/0.85) is pushed verbatim as the claim confidence regardless of how well the entity matched — [PPF:1299-1350]; registry doc at [src/lib/metadata/provider-registry.ts:37-43]. Severity High: a 0.31-Dice AniList pick enters the field selectors with confidence 0.95.
- Other hardcoded literals: adult ×0.5 [anilist-match.ts:77]; single-token −0.25 [sequel-penalty.ts:84-85]; MangaDex chapter factor 0.7–1.0 and year 1.15/1.0/0.8 [mangadex-matcher.ts:46, 53-55]; MU alias bypass Dice ≥ 0.9 and length ≥ 4 [mangaupdates-fetch.ts:156-158]; ComicVine language boost 0.3, issue-count boost `log10 × 0.15`, synonym discount 0.85 below 0.5 [language-aware-matcher.ts:195-202, 223, 249]; cross-series gate ratios 2.0 / 1.5 / +40 / 30 / 2 / 10 / 200 [PPF:423-440] (comment at 428 says these must be kept mirrored by hand with `pipeline-orchestrator.ts`); plausibility ≥ 2 agreeing sources, ≥ 4× ratio, 5% tolerance [SVC/metadata/plausibility-check.ts:28, 31, 34]; corroboration tolerance 15% [EP/post-enrichment-hooks.ts:99-103].
- Stated calibration provenance: registry values were "transcribed verbatim" from former homes and the weights are "gate-tuned" via `scripts/surveys/metadata-accuracy/gate.ts` [provider-registry.ts:13-16]; `bindMin` is described as "derived from each provider's existing matcher accept-threshold + bind-loop parity data" [freshness-check.ts:24-29]; plausibility thresholds "tuned on the metadata-accuracy harness" with true errors at 17× and 392× and "nothing in the 4×–16× band" [plausibility-check.ts:17-19]; ComicVine 0.55 was raised from 0.3 after one incident (Omniscient Reader's Viewpoint bound to a 1970 fanzine at about 0.36) [language-aware-matcher.ts:268-282]; Wikipedia 0.30 "tuned against post-purge re-enrichment data" [best-match-finder-helpers.ts:185-194].
- MangaUpdates floor can be cleared with zero title similarity when AniList hints are present: 0.15 (popularity cap) + 0.15 (type concordance) + 0.10 (year) = 0.40 ≥ 0.30 — [mangaupdates-fetch.ts:107, 115, 175, 180, 189]. Severity High for the hinted path (the wave-2 verify and the no-existing-match retry at [mangaupdates-fetch.ts:478-496]).

### Inferences
- The `bindMin` doc comment and the values disagree: AniList's accept floor is 0.30 but its `bindMin` is 0.70, so "below these floors the current matcher would no longer have accepted the binding" is not true as written. Either the accept floors are too low or `bindMin` is aspirational.
- The band between accept floor and `bindMin` (0.30–0.70 for AniList) is where wrong bindings live; today it produces a log line and a durable `auto` row but no review flag. Routing that band to `providerMetadata.bindingReview` (which already exists) would be the cheapest accuracy gain.
- Passing the real match score as `matchConfidence` (or `min(registry, score)`) would let weak matches lose field consensus instead of winning it.
- Several thresholds were set from one or two incidents (ComicVine 0.55, plausibility 4×) rather than a labeled distribution, so their false-negative rate is unmeasured.

### Gaps
- I did not open `scripts/surveys/metadata-accuracy/gate.ts` or its result files (another researcher's lane), so I cannot confirm how weights were gated.
- No calibration artifact for the per-matcher accept floors (0.3 / 0.4) was found in the files read.

## 3. How are spinoffs, sequels, light novels, colored editions, same-name foreign works and media type disambiguated, and which known failure classes are still structurally possible?

### Takeaway
Disambiguation is a closed regex list of edition and sequel keywords plus per-provider side signals (year, chapter count, country, language); there is no format/media-type gate anywhere in the pipeline matchers. Subtitle-style spinoffs, light novels and Western comics remain structurally bindable, and the only post-hoc detector fires solely when the wrong entity is at least 4× smaller.

### Cited Findings
- `hasEditionMismatch`: 9 edition patterns (color/colored, omnibus, box set, deluxe, カラー, 完全版) and 11 spinoff/sequel patterns (shin, gaiden, part N, 4-koma, anthology, `-bu`, gt, r2, kai, shippuden, ordinals, xNN) — [EP/utils.ts:32-60]. The doc comment says spinoff qualifiers are checked "candidate→query only" but the code checks both directions [EP/utils.ts:64-65 vs 71-74].
- Application is inconsistent: AniList and MangaDex accept a candidate if ANY of its titles is compatible [anilist-match.ts:49-51], [mangadex-matcher.ts:76]; Kitsu checks only `canonicalTitle` [kitsu-fetch.ts:123]; MangaUpdates checks `record.title` with a known-alias bypass [mangaupdates-fetch.ts:150-159]; the MangaDex `links.al` path retries with the filter OFF [mangadex-matcher.ts:103-118].
- Subtitle spinoffs carry no listed keyword ("Attack on Titan: No Regrets", "Before the Fall", "Lost Girls"), so only raw Dice separates them from the parent; AniList has no length penalty and sees just 5 search results [anilist-match.ts:58-73], [PPF:704-707].
- No format or media-type gate: the AniList search query is `media(search: $search, type: MANGA)` with no format filter [SVC/anilist/modules/fieldInclusion.ts:414]; a text search for "novel" and "format" in `anilist-match.ts`, `mangadex-matcher.ts` and `kitsu-fetch.ts`, and for "novel" in `mangaupdates-fetch.ts`, returns nothing. Kitsu `subtype` is collected [kitsu-fetch.ts:159] but used only as a field claim [PPF:1337]. MangaUpdates `type` is used only for country concordance and only when hints exist [mangaupdates-fetch.ts:98-110].
- `phaseProviderFetch` selects only `selectedSourceId` and `providerMetadata` from the manga row [PPF:120-123]; `Manga.mediaType` is not read in this file, so Western comics are searched on all manga providers with the same floors.
- Colored editions: the search query is stripped of trailing `Digital|HD|Complete|Omnibus|Colored|Full Color|Manga` [EP/matching/title-normalization.ts:27] while scoring uses the original title [PPF:699-703, 742]. The regex is end-anchored, so "Jujutsu Kaisen (Official Colored)" (ends with `)`) and "Chainsaw Man - Color" (bare "Color" is not in the alternation) are not stripped.
- When the matcher returns null (as opposed to the search returning zero rows) there is no fallback to the previous binding id [PPF:727-743].
- ComicVine language handling: hard guard on detected language [language-aware-matcher.ts:239-246, 286-290]; fallback pool restricted to the origin language, excluding third-language translations and `unknown` [language-aware-matcher.ts:444-456]; preference auto-switches to `ja` for JP titles with no English title [PPF:979-987]; without an AniList anchor a title-only stand-in is used, which has no country and therefore no fallback [PPF:1123-1125, 327].
- ComicVine issue-count boost multiplies the final score [language-aware-matcher.ts:221-224, 250-251] and is applied before the tie-break, not only as one.
- A failed manual ComicVine fetch silently falls through to the auto matcher [PPF:1065-1071].
- Post-hoc detection: `detectImplausibleCount` fires only when the stored count is at least 4× LOWER than a consensus of at least 2 non-anchor sources [plausibility-check.ts:55-87]. Volume witnesses are MangaDex and Wikipedia plus Kitsu [EP/post-enrichment-hooks.ts:130-138]; Kitsu and MAL are disabled by default [provider-registry.ts:115, 144].
- The cross-series wiki gate (wiki chapter list over 2× AniList, or over 1.5× and +40) blanks Fandom/Wikipedia chapter lists rather than rebinding [PPF:444-499].

### Inferences
- Attack on Titan → spinoff: the original sticky-id loop is fixed (section 4), but a first-time mis-pick is still possible whenever the parent is not in AniList's top 5 for the folder title, and it is then only caught if the spinoff is 4× smaller with 2 independent witnesses. Severity High.
- Blood Lad → light novel: still structurally possible on AniList, Kitsu and MangaUpdates because nothing filters `format = NOVEL` / subtype / type. (AniList's `type: MANGA` includes novels — this is my knowledge of the AniList API, not something the repo states.) A one-line `format_not_in: [NOVEL]` plus Kitsu subtype and MU type hard filters would close the class. Severity High, low effort.
- Wrong bindings to a LARGER or similar-sized entity (a sequel, a parent series for a spinoff query, a remake) are invisible to the plausibility detector by construction. Severity High.
- Witness contamination: MangaDex is re-resolved through `links.al` to whatever AniList picked [mangadex-matcher.ts:137-141], so when AniList is wrong MangaDex agrees with it and stops being an independent witness — acknowledged in the comment at [EP/post-enrichment-hooks.ts:95-97]. With Kitsu off, a volume finding needs MangaDex AND Wikipedia to both be independently right, which is the weakest case exactly when the anchor is wrong.
- Colored-edition titles will usually get no AniList anchor (search poisoned, then every candidate rejected by the bidirectional edition check), which pushes ComicVine onto the title-only path. Severity Medium.
- Bidirectional spinoff regexes false-reject legitimate titles containing "Shin", "Kai", "Part 2" in their real name; MangaUpdates has a bypass, Kitsu (canonical title only) does not. Severity Medium for Kitsu coverage.
- ComicVine: an exact-title short volume can lose to a near-title long-runner, e.g. similarity 1.0 with 1 issue scores 1.0 × 1.045 while similarity 0.85 with 300 issues scores 0.85 × 1.37 = 1.17 (arithmetic from the formula at lines 221-224). Severity Medium; this is the mini-series/one-shot vs. main-series class.
- Polish ComicVine volumes: closed for the fallback path; still possible if `detectFromContent` labels a Polish edition as English, or when the user sets the preference to `any`.
- Western comics: nothing prevents a comic title from binding to a same-named manga at Dice ≥ 0.3 on AniList. Severity Medium (depends on library mix).

### Gaps
- `detectFromContent` (ComicVine language detection) was not read, so the residual Polish/French mis-detection rate is unknown.
- I did not verify whether `Manga.mediaType` is consulted upstream (e.g. in the orchestrator, another researcher's lane) to skip manga providers for comics.
- The Wikipedia picker's sub-series suffix logic and manga-relevance check [best-match-finder-helpers.ts:160-183, 237-260] and the full Fandom validator were only sampled.

## 4. How does the durable ProviderBinding table work, how do plausibility checks write rejections, how does phase-provider-fetch consult them, and what gaps remain?

### Takeaway
`ProviderBinding` is an append-only log whose only reader is the AniList rejection filter. Rejections for every other provider are written but never read, manual pins for MangaDex/MangaUpdates/Kitsu are stored but not honored by the fetch path, and an existing AniList auto-binding is pin-fetched forever (never re-scored) unless the 4× plausibility detector happens to fire.

### Cited Findings
- Schema: `id, mangaId (bare Int, no relation), provider, providerId, origin ('manual'|'auto'|'rejected'), score?, reason?, createdAt, supersededAt?`, two non-unique indexes, no uniqueness constraint — [prisma/schema.prisma:3018-3039]. Committed in `d1cd35968`.
- Service API: `recordBinding`, `recordRejection` (idempotent per active id), `getRejectedIds`, `clearRejection`; every function swallows errors — [SVC/metadata/binding-record.ts:44-138].
- Complete caller list (ast-grep over `src/` and `scripts/`): `recordBinding` at [PPF:169] (anilist, auto) and [src/server/trpc/routers/manga/provider-operations/binding.ts:226] (manual, any provider); `recordRejection` at [EP/post-enrichment-hooks.ts:161] (anilist only) and [binding.ts:292] (manual unbind, any provider); `clearRejection` at [binding.ts:227]; `getRejectedIds` ONLY at [PPF:128] with the literal `'anilist'`.
- Consultation flow: rejected ids are loaded [PPF:128]; a stored auto id is used as the pin only if not rejected, while `selectedSourceId` always wins [PPF:140-142]; rejected ids are dropped from search results before scoring [PPF:724-726]; the previous-id fallback is skipped if rejected [PPF:734].
- Rejection writer: when `detectImplausibleCount` fires, `providerMetadata.bindingReview` is set and the currently bound AniList id is rejected, whatever the source of the stored count — [EP/post-enrichment-hooks.ts:140-167]. The flag clears only on positive corroboration (2 candidates within 15%) [EP/post-enrichment-hooks.ts:168-183].
- Live binding state is still held elsewhere: `Manga.providerMetadata.<provider>.providerId` (written by `persistProviderBindings`, which preserves `manual: true` entries and refreshes auto ones) [EP/phase-finalize.ts:596-644], plus `Manga.selectedSourceId` [PPF:141] — the module header says so itself [binding-record.ts:4-12].
- An `auto` row is appended on every enrichment in which the matcher ran [PPF:165-176]; auto rows are never superseded (`supersededAt` is set only by `clearRejection`) [binding-record.ts:127-132]. Nothing reads `auto` or `manual` rows.
- Reidentify: `forceRefresh` clears non-manual entries for `comicvine, fandom, wikipedia, mangadex, mangaupdates` only — not anilist, kitsu or mal — and deletes `bindingReview` [src/server/trpc/routers/manga/metadataOperations/refresh/clear-auto-bindings.ts:7, 41-63]; called at [refresh/index.ts:101-110].
- AniList is pin-fetched from the stored auto id on every run, which returns no `matchScore` [PPF:661-674, 696-697]; both `recordBinding` and the freshness check are guarded on `matchScore` being a number [PPF:168, 182].
- MangaDex, MangaUpdates and Kitsu are always re-discovered by title search; the stored `providerId` is never used to fetch [PPF:156, 159, 160, 816-821]. The code comment confirms manual MangaDex pins "aren't exposed at this layer" [PPF:199-202]. Only ComicVine honors a manual id [PPF:1013-1022, 1065-1068].
- The manual-unbound sentinel is honored for comicvine, fandom and wikipedia only [PPF:1061], [EP/wiki-discovery.ts:56, 671], although its type also lists mangadex and mangaupdates [EP/manual-binding-sentinel.ts:26]. It is set only by a script; the UI path is a TODO [EP/manual-binding-sentinel.ts:19-22]. `unbindProvider` deletes the entry instead of writing the sentinel [binding.ts:276-293].
- `bindProvider` writes `selectedSourceId: providerId` for ANY provider whenever the manga has no `selectedSourceId` (or `manga.source === provider`) [binding.ts:212-220]; `phaseProviderFetch` interprets `selectedSourceId` as an AniList id and fetches it by number [PPF:141, 661-673].
- Cached Fandom URLs are returned without revalidation unless `forceRefresh` [EP/wiki-discovery.ts:60-69]; Fandom and Wikipedia freshness checks are explicitly deferred [PPF:220-226].
- Cross-validation that only logs: AniList `idMal` vs MangaDex `links.mal` mismatch [PPF:597-605]. `tryCrossRef` returns null when no search result links to the AniList id and falls back to title scoring with no penalty for candidates whose `links.al` points at a different AniList id [mangadex-matcher.ts:96-101, 137-145].

### Inferences
- (High) Manual unbind is ineffective for MangaDex, MangaUpdates, Kitsu, Fandom, Wikipedia and ComicVine: the rejection row is written but no picker reads it, and the JSON entry is simply deleted, so the next enrichment can re-bind the same entity. The memory note lists "wiring rejection-exclusion into the MangaDex/CV/MU/Wiki pickers" as an explicit out-of-scope follow-up; it is still open in current code.
- (High) Manual binds for MangaDex/MangaUpdates/Kitsu are cosmetic: `persistProviderBindings` keeps the manual id in JSON while the data actually fetched comes from whatever the fuzzy matcher picked that run, so the UI can show "bound to X" over data from Y.
- (High) "Re-identify" cannot repair a wrong AniList auto-binding of similar or larger size: the id survives `forceRefresh`, is pin-fetched, the matcher never runs, freshness never runs, and plausibility only catches 4×-smaller entities. For already-bound manga the AniList freshness check is effectively dead code.
- (Critical if reachable — needs a runtime check) A manual bind of a bare numeric non-AniList id (MangaUpdates series id, Kitsu id, ComicVine "50244") on a manga with empty `selectedSourceId` will be stored as the AniList pin and fetched as AniList media #50244: a wrong anchor that is treated as manual, so it bypasses the matcher, the freshness check and the rejection filter. Whether enrichment normally pre-populates `selectedSourceId` was not verified.
- (Medium-High) Rejection mis-attribution: the detector always rejects the AniList id. If the low stored count came from elsewhere, a CORRECT AniList id gets durably rejected; the matcher then excludes it and binds the next-best candidate at ≥ 0.3 — typically a spinoff. There is no expiry; only a manual bind clears it.
- (Medium) Non-AniList bindings are non-deterministic across runs (search ranking changes flip the pick) and waste API calls; pin-fetching a stored id that still passes validation would fix both.
- (Low-Medium) Table growth is unbounded (one auto row per matcher run) and, with no reader of auto/manual rows and no FK, the "current state = latest un-superseded row" contract in the header is not actually implemented; orphan rows survive manga deletion.
- (Medium) Contradictory ID evidence is discarded: a MangaDex candidate whose `links.al` names a different AniList entry is strong negative evidence against either that candidate or the AniList pick, and a MAL-id mismatch is a direct signal that the anchor and MangaDex disagree; both are currently log lines.
- (Low) `recordBinding` is fire-and-forget (`void`) before the pipeline finishes, so an auto row is written even if later phases fail or the pick is later contradicted.

### Gaps
- Not verified at runtime: whether `selectedSourceId` is populated by enrichment (which would change both the Critical item above and whether the rejection filter ever applies), and what values `Manga.source` takes.
- `persistProviderBindings` lines after 658 and `fetchProviderMetadata` in `binding.ts` (called with `manga.title`, not the bound id, at line 204) were not read in full.
- I did not query the DB, so the number of `ProviderBinding` rows, active rejections and `bindingReview` flags in dev/prod is unknown.
- `scripts/surveys/metadata-accuracy/flag-sweep.ts` (the "thorough backstop" named at [EP/post-enrichment-hooks.ts:112-114]) was not read.

## 5. How is cross-provider ID bridging used versus fuzzy search, and where could it replace fuzzy matching?

### Takeaway
Only MAL is resolved purely by ID. MangaDex uses `links.al` as a filter over fuzzy search results, Wikidata is a last-resort fallback for Wikipedia, and the MangaUpdates and Kitsu ids that MangaDex already returns are extracted for display only while both providers are fuzzy-searched.

### Cited Findings
- MAL: fetched only by id from AniList `idMal` or MangaDex `links.mal`, never by title [PPF:581-592], [EP/phase-provider-fetch/mal-fetch.ts:4-6, 54-55].
- AniList: fetched by stored id when pinned or auto-bound, else fuzzy [PPF:140-142, 696-697].
- MangaDex: `links.al` filter applied to candidates that a title search surfaced; fuzzy fallback otherwise [mangadex-matcher.ts:33-38, 96-119, 137-145]; verify step fans out title variants to find them [PPF:889-924].
- MangaDex `attributes.links` keys `al, mal, mu, nu, ap, kt, amz, ebj, cdj, raw, engtl, bw` are extracted [EP/phase-provider-fetch/external-id-extractor.ts:12-25] and carried on the result as `externalIds` [PPF:784-785, 849]; the module header says they are for `Metadata.externalLinks` and the UI [external-id-extractor.ts:4-8]. URL builders for `mu` and `kt` exist [external-id-extractor.ts:60-66].
- MangaUpdates and Kitsu are fuzzy-searched in wave 1 [PPF:159-160] and again in wave 2 using AniList titles/year/country as hints, not ids [PPF:335-363].
- Wikidata: `resolveWikipediaTitle(anilistId, malId)` runs only as "Stage 2.5a ... when both prior stages returned nothing" [EP/wikipedia-fallback/data-fetching.ts:63-64, 85-103]; the hints are supplied only on the wave-2 retry, which runs only if wave 1 returned null [PPF:256-270].
- Fandom: AniList `externalLinks` is Tier 0, still passed through the validator because AniList links can be wrong [EP/wiki-discovery.ts:77-87]; also used on retry [PPF:279-289].
- ComicVine: no id bridge; fuzzy plus language guard only [PPF:316-331].
- Wave 1 launches MangaDex, MangaUpdates, Kitsu, Fandom and Wikipedia title-only in parallel with AniList, before any anchor exists [PPF:153-161].

### Inferences
- Highest-value replacement: once MangaDex is resolved (ideally via `links.al`), use `links.mu` and `links.kt` to fetch MangaUpdates and Kitsu by id and skip fuzzy matching entirely for those two; fall back to search only when the link is absent. This removes two fuzzy matchers from the common path and two wave-1 searches.
- Make Wikidata the PRIMARY Wikipedia resolver when an AniList or MAL id exists (title search as fallback). Today a wrong title-only Wikipedia pick in wave 1 suppresses the retry, so the id bridge is never consulted in exactly the case it would correct.
- Persisted ids should be pin-fetched and re-validated (cheap id lookup + similarity check against the anchor's titles) rather than re-searched; this also makes manual binds effective (section 4).
- Use bridges as validators, not only as resolvers: MangaDex `links.al`/`links.mal` disagreeing with the AniList pick should lower confidence in the anchor or raise `bindingReview`.
- MangaDex cannot be queried by AniList id directly, so its fuzzy search stays, but the variant fan-out can stop at the first query that yields a `links.al` hit (the current loop always runs every variant, [PPF:906-913]).

### Gaps
- Kitsu's and MangaUpdates' own id-mapping endpoints, and coverage rates of `links.mu`/`links.kt` on MangaDex, are outside the repo; I found no measurement of them in the files read.
- `SVC/wikipedia/wikidata/article-resolver.ts` was not opened; which Wikidata properties it queries is unverified.
- AniList `externalLinks` may carry other provider URLs; I only confirmed the Fandom use.

## 6. What do the existing harnesses measure and what do their latest results say about residual error?

### Takeaway
The two loop harnesses report 94.7% and 100% but neither exercises the code path audited above: `match-loop` scores the import wizard's scorer, `bind-loop` replays a shim over a frozen May-2026 corpus that excludes AniList and MAL. The AniList anchor matcher has a 52-case live harness with no stored results. All numbers predate the June–July 2026 matcher changes.

### Cited Findings
- `match-loop/replay.ts` imports `normalizeSearchTitle`, `calculateConfidence`, `scoreWithYear`, `getBestMatch` from `@/components/library/import-pipeline/hooks/useDetectMatch/helpers` and the `search/providers/*` adapters for anilist, mangadex, mangaupdates, wikipedia, fandom — [scripts/surveys/match-loop/replay.ts:1-25]. Corpus: 76 import folders [scripts/surveys/match-loop/corpus.json].
- `match-loop` baseline: 31 correct, 6 low-confidence, 7 wrong-target, 1 no-match, 31 unlabeled; labeled 45/76; strict 71.1%, acceptable 84.4% — [scripts/surveys/match-loop/runs/baseline.scorecard.md].
- `match-loop` latest (`m15-17`, generated 2026-05-23): 72 correct, 1 low-confidence, 0 wrong-target, 3 false-positive; labeled 76/76; strict 94.7%, acceptable 96.1%. The three false positives are Attack on Titan doujin folders ("No Requiem", "Operation Usurper", "Project Ouroboros") matched to the Wikipedia "Attack on Titan" article at 64–72% where the ledger expects no-match — [scripts/surveys/match-loop/runs/m15-17.scorecard.md].
- `bind-loop` scope: 6 providers (`wikipedia, mangaupdates, comicvine, mangadex, kitsu, fandom`) — no anilist, no mal [scripts/surveys/bind-loop/replay.ts:22]; README describes 78 manga × 6 providers, a frozen `corpus.json` of raw search results, and a ledger "seeded from the 2026-05-27 binding-audit findings" [scripts/surveys/bind-loop/README.md]. Ledger holds 422 labeled probes [scripts/surveys/bind-loop/ledger.json].
- `bind-loop/replay.ts` states the pick logic may live in production code OR in "per-provider helpers ... below (when the production path doesn't yet expose a hook)" and defines its own diacritic/Hepburn scoring helpers [scripts/surveys/bind-loop/replay.ts:5-8, 38-45].
- `bind-loop` baseline: 322 correct, 79 wrong-target, 6 false-positive; strict 78.2%; per provider wikipedia 88.4%, mangaupdates 73.3%, comicvine 88.6%, mangadex 88.6%, kitsu 93.3%, fandom 31.7% — [scripts/surveys/bind-loop/runs/baseline.scorecard.md].
- `bind-loop` mid-run `b9-nfkd`: strict 88.2%, fandom 44.4% with 28 nulls where a wiki was expected — [scripts/surveys/bind-loop/runs/b9-nfkd.scorecard.md].
- `bind-loop` final `b26-targeted`: 412 correct, 10 no-match-emitted, 0 wrong-target, 0 false-positive; strict 100% for all six providers — [scripts/surveys/bind-loop/runs/b26-targeted.scorecard.md].
- `score.ts` declares `ANCHOR_PICKER_TRUST_SCORE = 0.85` and ledger entries carry `source: 'audit' | 'anchor'` [scripts/surveys/bind-loop/score.ts:27-42].
- `matching-harness.ts` runs the real `pickBestTitleMatch` against a 52-case ground-truth set over live AniList HTTP; known hard cases listed include GIGANT → Gigantis, "Kingdom Hearts Manga", "Dragon Ball GT" (expected no-match), and "Naruto" with two entries tying at 1.000 [scripts/surveys/matching-harness.ts:1-45].
- Unit tests located next to the code: [SVC/metadata/binding-validators/__tests__/freshness-check.test.ts], [SVC/metadata/binding-validators/__tests__/wiki-freshness-audit.test.ts], [src/server/trpc/routers/manga/metadataOperations/refresh/__tests__/clear-auto-bindings.test.ts].
- Run artifacts are dated May 22–27 2026 (directory listing of both `runs/` folders); ComicVine language gates (2026-06), the registry consolidation and binding-as-record (2026-07) landed afterwards per commit log and memory notes.

### Inferences
- The 71.1% → 94.7% `match-loop` improvement is not like-for-like: the labeled denominator grew from 45 to 76, with the 31 newly labeled items all landing in "correct".
- The `bind-loop` 100% should be read as "the shim reproduces the ledger on 78 titles", not as production accuracy: the final iteration is named "targeted", the ledger was seeded from the same audit that motivated the fixes, anchor-sourced entries appear to be auto-trusted above 0.85 (constant seen, usage not traced), and the replay carries its own scoring helpers. The project memory note says the same ("replay.ts shim ≠ real accuracy").
- No stored measurement exists for the two matchers that matter most: the AniList anchor picker and the MAL bridge. Residual error on the anchor is therefore unknown, and it is the error that cascades into MangaDex (via `links.al`), ComicVine, Wikipedia and Fandom.
- None of the harnesses measure the binding lifecycle (rejection, reidentify, manual pin honored, stale id), which is where section 4 finds the highest-severity gaps.
- The only documented residual failures are the three AoT doujin false positives in the wizard path and the Fandom discovery nulls from mid-loop; both are "should be no-match / should be found" errors rather than wrong-series picks.

### Gaps
- No result file for `matching-harness.ts` was found and I did not run it (it calls the live AniList API, outside the constraints).
- The gitignored `parity-*.ts` harnesses (`parity-grid-harness.ts`, `parity-chapter-stats-harness.ts`) and `scripts/surveys/metadata-accuracy/` outputs were not read.
- `tests/` was not inventoried for matcher coverage beyond the three colocated test files above.
- `bind-loop/iter-plan.md` and the intermediate scorecards b10–b25 were not read, so which production files each iteration changed (versus harness-only helpers) is unverified.
- Memory notes other than `project_binding_as_record.md` were not re-read; claims attributed to "memory" come from that note and the MEMORY.md index.
