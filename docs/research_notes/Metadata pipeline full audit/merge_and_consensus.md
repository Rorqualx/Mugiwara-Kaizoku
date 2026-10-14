# Field-merge, authority weighting and consensus resolution (metadata pipeline code audit)

Scope: how provider values are fused into one canonical `Metadata` row, and whether the algorithms/weights are correct and calibrated. Audit date 2026-10-10, branch `main` @ `c2447c1a9`. READ-ONLY; nothing in the repo was modified.

Conventions used below
- Paths are repo-relative. Abbreviations: `SEL/` = `src/server/services/metadata/selectors/`, `EP/` = `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/`, `MP` = `src/server/services/metadata/metadata-persister.ts`, `REG` = `src/lib/metadata/provider-registry.ts`, `HARN/` = `scripts/surveys/metadata-accuracy/`.
- **[V]** = verified by reading the code/result file cited. **[V-run]** = verified by executing the real production functions offline (pure, no DB/network) from a throw-away script in the session scratchpad (not saved in the repo); inputs are stated. **[I]** = inference.
- Severity: S1 = wrong canonical data written for a class of titles / data loss; S2 = systematic mis-selection or mis-calibration; S3 = latent/edge/cosmetic.
- IMPORTANT provenance caveat: `scripts/surveys/` is gitignored (`.gitignore:531`), so every harness, gold file and scorecard cited here exists only on this dev machine. They are NOT "checked in"; results are not reproducible from a clone. Scorecards for iter-MM / iter-PVM / iter-FC are the exception — copies live in `docs/sessions/`.

Headline findings (details in the sections)
1. **S1 — The accuracy gate does not mirror production for `status`.** `gate.ts` feeds MAL and MangaUpdates status into the selector; the live pipeline never emits a MAL, MangaUpdates or Kitsu status claim. Live status is a 2-way AniList-vs-MangaDex vote that AniList always wins with reported confidence 1.00. The headline "contested status 76.9% -> 84.6%" is not realised in production (re-run with live emitters: 76.9%).
2. **S1 — Several selector winners are written under keys the persister never reads** (`summary`, `cover`, `coverExtraLarge/Large/Medium`, `synonyms`, `idMal`), so the consensus selector is silently inert for those fields while its provider name is still stamped into provenance.
3. **S1 — `tags`, `authors`, `artists` are overlaid with MangaUpdates-only values** whenever MangaUpdates is bound, because the AniList claim does not emit those fields; AniList tags are dropped from `Metadata.tags`.
4. **S1 — An ongoing series can be treated as finished**: `aggregateChapterReleaseDates` fills a null `Metadata.endDate` with MAX(chapter.releaseDate) regardless of status, and a non-null `endDate` is the "terminal" signal for the phantom-prune and the stored trusted ceiling.
5. **S2 — Selector confidence is anti-monotonic in corroboration** (1 source = 1.00, 4 unanimous sources = 0.80, a 1-vs-1 disagreement = 0.77 "accept"); the reject tier is effectively unreachable and the review badge mostly fires on well-corroborated values.
6. **S2 — Weights are not consistent with measured accuracy** except for the one `status` edit; MangaUpdates chapters (36% contested accuracy) carries ~1.9x the vote of Kitsu (80%).
7. **S2 — `status` normalizer regexes are mis-anchored** (`/^a|b|c$/`): "On Hiatus" and "Not yet published" (the exact Jikan/MAL strings) normalise to invalid enum values; "suspended" normalises to COMPLETED. Latent today only because MAL status is not emitted (finding 1) — fixing 1 without fixing this would make Prisma writes throw.
8. **S2 — `resolveCountConsensus` tie-break is input-order dependent**; with a 2-vs-2 split the cluster containing AniList wins purely because AniList is collected first.

---

## Q1. How do the resolvers work (algorithms, tie-breaks, fallbacks, edge cases)?

### Takeaway
There are two independent fusion systems that never talk to each other: (a) the Phase-1.5 "consensus selector" (`SEL/`), which overlays winners onto a legacy AniList-first `Object.assign` chain for the scalar/list fields of `Metadata`; and (b) `resolveCountConsensus`, an unweighted seed-cluster vote used only to derive volume/chapter-count ceilings for the chapter/volume materialisation phases. The selector's effective weight is a static product of two per-provider constants (no real matcher score), its confidence formula is mis-shaped, and for many fields it has only one candidate, so "consensus" is frequently a single-source pick.

### Cited Findings

**Data flow (who decides what)**
- [V] Legacy chain: `buildEnrichmentResult` builds `metadata` from AniList, then `Object.assign`s MangaUpdates -> MAL -> Kitsu "supplements" that only fill gaps (each supplement checks `metadata[x]` is empty first); per-field provenance is recorded in `perFieldProvenance`. — `EP/phase-provider-fetch/enrichment-result-builder.ts:79-183` (assign helper `:191-202`; MAL gap-fill `EP/phase-provider-fetch/mal-fetch.ts:108-146`; MU gap-fill `EP/phase-provider-fetch/mangaupdates-fetch.ts:356-443`; Kitsu `enrichment-result-builder.ts:626-689`).
- [V] Selector cutover: immediately after, `applySelectorCutoverInPlace` builds claims, runs `collectCandidates` -> `runShadowSelection` -> `applySelectorCutover`, which overwrites `legacyMetadata[field]`/`legacyProvenance[field]` for every field with a non-null, non-guard-refused winner. Exceptions are swallowed (legacy picks kept). — `EP/phase-provider-fetch.ts:514-523`, `:1236-1286`; `SEL/cutover-overlay.ts:51-105`.
- [V] Claims actually emitted live (`buildClaimsForShadow`, `EP/phase-provider-fetch.ts:1288-1351`):
  - anilist: `title`(dropped — not in `FIELD_TYPE_REGISTRY`), summary, cover x4, bannerImage, chapters, volumes, genres, status (raw AL enum), averageScore, popularity, idMal, countryOfOrigin, format, synonyms, externalLinks, rating — `SEL/collect-candidates.ts:121-143`. **No tags, themes, authors, artists, startDate, endDate.**
  - mangadex: status, summary, contentRating, publicationDemographic only (`:1304-1311`). **No chapters/volumes.**
  - mal: output of `buildMALMetadataSupplements({}, mal)` = chapters, volumes, averageScore, rating (`mal-fetch.ts:116-143`). **No status.**
  - mangaupdates: output of `buildMangaUpdatesMetadataSupplements({}, mu, cvPublisher)` = publishers, genres, tags(categories), authors, artists, `alternativeTitles`(dropped — not a registry key), averageScore, rating, chapters(`latestChapter`) (`mangaupdates-fetch.ts:356-443`). **No status, no volumes.**
  - kitsu: contentRating(ageRating), summary, synonyms, format, cover, chapters, volumes (`:1331-1342`). **No status, no dates.**
  - comicvine: publishers only (`:1344-1351`). fandom/wikipedia: none (`REG:158-175` comments).
- [V] `matchConfidence` is NOT the matcher's score. It is the static registry constant per provider (`matchConfidenceFor`, `REG:199-201`; anilist .95, mangadex .95, mal .92, mangaupdates .92, kitsu .85, comicvine .85). `SEL/types.ts:24-27` and `SEL/collect-candidates.ts:25-27` still document it as "the matcher's binding score". Effective vote weight = constant x constant.

**Weight resolution** — `resolveWeight(field, provider)` = per-field override else `baseWeight` (`REG:207-214`); `SEL/authority.ts:37` is a re-export only.

**`selectNumeric`** (chapters, volumes, averageScore, popularity, idMal) — `SEL/select-numeric.ts`
- [V] Parse: finite numbers (strings via `parseFloat`), weight = matchConfidence x authority (`:119-137`). Zero is a valid candidate here (claims filter >0 upstream for kitsu/MAL/MU; AniList emits any `number`, incl. 0 — `collect-candidates.ts:129-130`).
- [V] Cluster: greedy single pass in weight-desc order; a candidate joins the first cluster whose **seed** value is within relative tolerance (`|a-b|/max(|a|,|b|,1) <= tol`; 5% chapters/volumes, 3% averageScore, 20% popularity, exact idMal) (`:38-45`, `:144-164`). The representative is never re-centred, so cluster membership depends on which provider has the highest static weight.
- [V] Winner: cluster with max summed weight, tie -> more members (`SEL/weighted-winner.ts:29-40`); value = the **highest-weight member's own value**, not the median/mode (`select-numeric.ts:166-173`).
- [V] Confidence = `min(1, agreement*(winnerWeight/clusterWeight) + 0.5*agreement)` where agreement = cluster share of total weight (`weighted-winner.ts:53-61`). Header comment says confidence = cluster share (`select-numeric.ts:11`) — stale.
- [V] Thresholds: accept >= 0.70, badge >= 0.40, reject < 0.40 (`SEL/thresholds.ts:54-60`). Reject returns `winner:null` -> legacy value kept.
- [V] Drift-guard is dead code in the selector: `runShadowSelection` always passes `existingValue: null, existingProvider: null` (`SEL/shadow-mode.ts:42-49`), so `shouldRefuseDrift` returns false at its first check (`select-numeric.ts:188-191`). It also has a latent bug: `pickProvider` returns `ctx.candidates[0]`, i.e. the first-listed claim (always AniList), not the winner (`:202-208`). The only live drift guard is the persister's (Q4).
- [V-run] Behaviour with production weights:
  | Input | Winner | Confidence / class |
  |---|---|---|
  | chapters {kitsu:100} | kitsu 100 | **1.00 accept** |
  | {anilist:100, mal:100} | anilist 100 | 1.00 accept |
  | {anilist:100, mal:100, kitsu:100, mangaupdates:100} | anilist 100 | **0.80 accept** |
  | {anilist:100, mal:200} (pure disagreement) | anilist 100 | **0.77 accept** |
  | {anilist:2, mal:139, kitsu:139, mangaupdates:139} | mal 139 | 0.63 badge |
  | volumes {anilist:2, mal:2, kitsu:34} (AoT wrong-anchor shape) | anilist 2 | **0.82 accept** |
  | 4-way split {100,200,300,400} | anilist 100 | 0.45 badge (not rejected) |
  | volumes {anilist:10, mal:11, kitsu:11} | mal 11 | 0.68 badge |
  | chapters {anilist:100, mal:104, kitsu:108} | anilist 100 | 0.82 (108 is 7.4% from the seed, so it does not chain) |
  | FMA {anilist:116, mal:116, kitsu:116, mangaupdates:128} | 116 | 0.67 badge (truth per harness gold = 108) |

**`selectCategorical`** (status, format, contentRating, publicationDemographic, countryOfOrigin, source, sourceId) — `SEL/select-categorical.ts`
- [V] Normalise -> group by normalised string -> max summed weight wins -> same confidence formula; thresholds accept 0.75 / reject 0.50; returns the normalised value (`:45-94`).
- [V] **Regex anchoring bug (S2)**: every alternation is written `/^a|b|c$/u`, so `^` binds only to the first alternative and `$` only to the last (`:115-120`, `:127-132`, `:139-142`, `:148-152`). [V-run] `"On Hiatus"` -> `"ON HIATUS"`, `"Not yet published"` -> `"NOT YET PUBLISHED"` (neither is in `enum MangaPublicationStatus`, `prisma/schema.prisma:2113-2122`), `"suspended"` -> `COMPLETED` (matches `ended$`), `"not completed"` -> `COMPLETED`. "On Hiatus"/"Not yet published" are the status strings `phase-data-assembly.ts:317` implies for Jikan (`'finished'`, `'discontinued'` lower-cased). A separate canonical mapper already exists and handles these (`src/utils/status-mapper.ts:15-28`) but the selector does not use it — duplicated, divergent normalisation.
- [V-run] Live status is at most AniList vs MangaDex: `{anilist:'RELEASING', mangadex:'completed'}` -> AniList ONGOING, **confidence 1.00 "accept"** (weights .95x.82=.779 vs .95x.40=.38). MangaDex alone -> its value with confidence 1.00. The 3-way review tier therefore never flags a status disagreement.
- [V-run] `contentRating` mixes vocabularies: Kitsu `ageRating` ("PG","R") and MangaDex ("safe","suggestive") are compared as categories; Kitsu-only -> `"pg"` written to `Metadata.contentRating` with confidence 1.00.

**`selectString`** (summary, cover*, bannerImage) — `SEL/select-string.ts`
- [V] Drops placeholders and summaries < 80 chars; score = authority x matchConfidence x richness (summary: `0.6 + 0.6*min(1,len/800) + 0.3*englishSignal`, cap 1.5; cover: URL-pattern bonuses, cap 1.5); confidence = score / max-possible (1.5) (`:104-117`, richness block). A perfect AniList summary scores .9025x1.5/1.5 = 0.90; a short one ~0.54-0.60 -> "badge".
- [V] **But the result is not persisted** — see Q4 key-mismatch finding.

**`selectList`** (genres, authors, artists, tags, themes, synonyms, urls, publishers) — `SEL/select-list.ts`
- [V] Union of all items keyed on lower-cased/whitespace-normalised form (+ small alias table for genres/tags/themes), item confidence = item weight / total weight, sort desc, cap per field (genres 12, tags 30, authors 8 ...), mean item confidence with a floor (1 candidate -> >= 0.5, 2 -> >= 0.4) (`:36-46`, `:87-133`, `:212-216`). No item-level threshold: every item from every provider is kept up to the cap; `Array.sort` stability means ties keep first-contributor order.

**`selectStructured`** (startDate earliest, endDate latest, rating, externalLinks, galleryImages) — `SEL/select-structured.ts`
- [V] Dates: earliest/latest wins irrespective of weight; confidence = weight share lifted to a floor (>=0.75 single, >=0.55 for 2-4, >=0.45 for 5+) (`:50-83`, `:268-273`). **Unreachable live**: no provider emits `startDate`/`endDate` claims (list above), so dates come only from AniList via the legacy chain (`enrichment-result-builder.ts:280-281`) or the chapter-release-date fill (Q3).
- [V] rating: highest `authority x matchConfidence x votesScale(scoredBy)` wins (`:119-168`); externalLinks/gallery: de-duplicated union, constant confidence 0.9 (`:179-251`).

**`resolveCountConsensus`** — `EP/phase-volume-cross-validation/count-consensus.ts:97-123`
- [V] Unweighted. 0 candidates -> count 0/'unknown'; 1 -> that value/'low'; else try every candidate as seed, cluster = all within absolute `±window` of the seed, keep the **first** largest cluster (`>` strict, `:110-114`); if size >= 2 -> `clusterWinner(median, members)`, 'high' if all candidates are in it else 'medium'; otherwise `fallback`. `median` of an even set rounds the mean (`:53-59`).
- [V] Volume adapter: window 1, winner = median, fallback = first present of `mangadex > anilist > anilist-db > mal > wikipedia` then min (`consensus-resolver.ts:112-120`). Candidates: AniList applied `metadata.volumes` (post-selector-overlay value, see Q3) or stored `Metadata.volumes` as `anilist-db`; MangaDex **max volumeNumber** in the aggregate; MAL volumes; Wikipedia `volumeList.length`; a Wikipedia count of exactly 1 is discarded when any other source >= 3 (`:52-93`). Kitsu's volumeCount is not a candidate.
- [V] Chapter adapter: window `2 + bonusChapterCount`, winner = `min(median, smallest member)`, fallback = plain min (`chapter-consensus-resolver.ts:52-65`, `:115-124`). Candidates: AniList chapters, MangaDex **max chapterEnd**, MAL, Wikipedia `chapterList.length`, Kitsu, MangaUpdates `latestChapter` (`:73-105`). `bonusChapterCount` = number of decimal-numbered Chapter rows currently in the DB (`EP/pipeline-orchestrator.ts:558-565`).
- [V] Consumers: chapter consensus caps stub creation only when confidence is high/medium (`EP/phase-db-persistence.ts:162-172`); the **volume consensus count is used regardless of confidence** (`pipeline-orchestrator.ts:525-530` returns `.count` only) and feeds `capVolumeCount`.
- [V-run] Edge behaviour:
  | Input (in collector order) | Result |
  |---|---|
  | vol [anilist 2, mal 2, mangadex 34, wikipedia 34] | **2**, medium (AniList-seeded cluster found first) |
  | same values, order [mangadex, wikipedia, anilist, mal] | **34**, medium — outcome flips with input order |
  | vol [anilist 34, mangadex 2, mal 30] (no cluster) | **2**, low (mangadex priority) -> cap = ceil(2x1.1)=3 volumes |
  | vol [10, 11, 12] | 11, high (window is not transitive but seed 11 covers all) |
  | ch [anilist 108, wikipedia 27, kitsu 116, mal 116, mu 128] | 116, medium |
  | ch [mangadex 395, anilist 1, mal 380] (no cluster) | **1**, low (min fallback; ignored as ceiling because 'low') |
  | ch ongoing [anilist-db 1100, mangadex 1130, mu 1128, kitsu 1090] | 1128, medium -> used as ceiling |

**Third, divergent chapter-count heuristic** — `estimateChapterCountFromAssembly` (`EP/phase-data-assembly.ts:181-267`): MAX over AniList scalar, Fandom/Wikipedia/ComicVine list lengths, max chapter number, MangaDex lastChapter; then guards: cap to best list length if max > 3x best list; cap to `ceil(scalar*1.2)` if an AniList scalar exists; fallback caps via MangaDex lastChapter x1.2 or AL volumes x10. A **fourth** variant, `computeExpectedChapterCount` (`pipeline-orchestrator.ts:482-489`), returns Wikipedia `data.chapters` if > 0 else the scalar.

**`provider-metadata-utils.ts`** — [V] Not a fusion algorithm: `parseProviderMetadata` (string-or-object, never throws), `getProviderSection`, `readProviderId` (numeric ids coerced), `extractBoundProviderId` (`src/server/services/metadata/provider-metadata-utils.ts:26-78`). Deliberately excludes `extractBoundAniListId` (string-only) per its header (`:14-18`).

### Inferences
- [I] Because cluster value = highest-weight member and AniList has the highest numeric weight, the numeric selector is "AniList unless out-voted by weight", not a robust estimator; in any cluster containing AniList, AniList's exact number is what is stored even if three other sources agree on a slightly different number inside the 5% band (e.g. 100 vs 104/104/104).
- [I] The 5% relative tolerance is too tight for small counts (10 vs 11 volumes never cluster) and too loose for large ones (1,100 vs 1,150 chapters cluster), the opposite of what an absolute-plus-relative window would give; the count-consensus resolver uses a purely absolute window (±1 / ±2), so the two systems can disagree on the same inputs.
- [I] The chapter resolver's `window = 2 + number of decimal rows in the DB` makes the window grow without bound for titles with many `x.5`/split-part rows (dozens are common on MangaDex-sourced titles); combined with `clusterWinner = min(median, smallest)` the result degenerates to "smallest candidate wins with confidence high", which would let a short Wikipedia `chapterList.length` become a hard ceiling. Not observed at runtime in this audit.
- [I] Candidate semantics are mixed: "count" candidates include list lengths (Wikipedia), highest chapter number (MangaDex `chapterEnd`, MangaUpdates `latestChapter`) and true totals (AniList/MAL). For series with skipped/decimal/renumbered chapters these are different quantities.

### Gaps
- Title selection was not found in the selector at all: `title` is emitted by AniList but dropped because it is not a `MetadataField`; the canonical title is AniList `english ?? romaji ?? fallback` (`enrichment-result-builder.ts:248`). Whether another phase arbitrates titles across providers is outside the files read.
- `select-string` cover scoring and `buildCoverVariants` were read only far enough to establish the key mismatch (Q4); cover-quality heuristics were not evaluated against data.
- No runtime `MetadataSelectionAttempt` rows were inspected (DB access prohibited), so the frequency of each edge case in the real library is unknown.

---

## Q2. Are the per-provider/per-field weights consistent with measured accuracy? Has the code been recalibrated?

### Takeaway
Only one recalibration was made (status: MangaDex 0.96 -> 0.40, MAL -> 0.95), and half of it is inert because MAL never emits a status claim. All other weights still come from binding-accuracy intuition and contradict the harness: MangaUpdates chapters is the worst measured source (36% on contested titles) but carries the third-highest vote, Kitsu (as accurate as AniList) carries about half the vote of everyone else, and MAL (best measured for volumes/chapters) ranks below AniList. The gate that "proved" reweighting numeric fields is harmful is real but under-powered (2 errors in 80, 13-25 contested titles) and its truth is partly circular.

### Cited Findings

**Measured accuracy vs assigned weight** (harness: 202 titles = 78 library + 124 benchmark; contested = titles where >= 1 source dissents from truth) — `HARN/data/weights-scorecard.md:1-17`, `HARN/data/authority-weights.json`; weights `REG:68-176`. Effective vote = matchConfidence x field weight.

| Field | Provider | Contested acc (n) | All-case acc (n) | Registry field weight | Effective vote | Emits a live claim? |
|---|---|---|---|---|---|---|
| volumes | anilist | 77% (13) | 97% (105) | 0.95 | 0.9025 | yes |
| volumes | mal | **92%** (13) | 99% (79) | 0.92 | 0.8464 | yes |
| volumes | kitsu | 77% (13) | 97% (103) | 0.50 | 0.425 | yes |
| volumes | mangadex | 69% (13) | 96% (100) | 0.88 | 0.836 | **no** (weight inert) |
| volumes | mangaupdates | 77% (13) | 97% (102) | 0.90 | 0.828 | **no** (weight inert) |
| chapters | anilist | 80% (25) | 94% (80) | 0.95 | 0.9025 | yes |
| chapters | mal | **88%** (25) | 95% (65) | 0.92 | 0.8464 | yes |
| chapters | mangadex | 88% (24) | 96% (75) | 0.93 | 0.8835 | **no** (weight inert) |
| chapters | kitsu | 80% (25) | 94% (78) | 0.50 | 0.425 | yes |
| chapters | mangaupdates | **36%** (25) | 80% (79) | 0.88 | **0.8096** | yes |
| status | anilist | 77% (13) | 98% (165) | 0.82 | 0.779 | yes |
| status | mangadex | **23%** (13) | 94% (162) | 0.40 | 0.38 | yes |
| status | mal | **85%** (13) | 98% (108) | 0.95 | 0.874 | **no** (weight inert) |
| status | kitsu | **85%** (13) | 99% (164) | (base 0.56) | 0.476 | **no** |
| status | mangaupdates | 58% (12) | 97% (165) | 0.60 | 0.552 | **no** (weight inert) |
| startDate | anilist / kitsu / mangaupdates / mangadex | 62% / **85%** / 75% / 54% (12-13) | 96 / 99 / 98 / 95% | none | — | no selector candidates; AniList-only via legacy |
| endDate | anilist / kitsu | **93%** / 89% (28) | same | none | — | no selector candidates |

- [V] Rank inversions: (a) chapters — MangaUpdates (36%) out-votes Kitsu (80%) by 1.9x and is within 10% of MAL (88%); (b) volumes and chapters — AniList (77%/80%) out-ranks MAL (92%/88%); (c) Kitsu's base 0.56 is acknowledged in the code as a binding-accuracy artefact that "conflates binding reliability with field-value reliability" (`SEL/authority.ts:28-30`) but was left in place.
- [V] The harness's own proposed override table (volumes MAL .92/AL .77/Kitsu .77; chapters MAL .88/MDX .88/AL .80/Kitsu .80/MU .40; status MAL .85/Kitsu .85/AL .77/MU .58/MDX .40; startDate Kitsu .85) is in `HARN/data/weights-scorecard.md:19-52`. Only the two status numbers for MangaDex and MAL were adopted (`REG:93`, `REG:110`); MangaUpdates status 0.60 and AniList status 0.82 roughly match; nothing else was changed. Rationale recorded at `SEL/authority.ts:15-30`.
- [V] Engine vs best single source on the 36-title gold set: engine accuracy 87% overall (125/144); lift is negative for 4 of 5 fields — volumes -4pp, status -6pp, startYear **-14pp**, endYear -7pp, chapters +1pp. 16 of 19 engine errors had the correct value in an already-fetched source. — `HARN/data/scorecard.md:8-27`, `:50-53`. (This scorecard pre-dates the status reweight; file dated Jul 8 12:28.)
- [V] Gate results now: volumes 105/106 (contested 12/13), chapters 78/80 (23/25), status 164/166 (11/13); baseline status was 163/166 (10/13). — `HARN/data/gate-results.json`, `HARN/data/gate-baseline.json`. So the celebrated "76.9% -> 84.6%" is **one title out of 13**.

**The gate is not production-equivalent for status (S1)**
- [V] `gate.ts` claims to mirror `buildClaimsForShadow` "exactly" and gives `mal` and `mangaupdates` a `status` field (`HARN/gate.ts:9-11`, `:41-47`). The live MAL and MangaUpdates claims contain no status key (`EP/phase-provider-fetch/mal-fetch.ts:108-146`; `mangaupdates-fetch.ts:356-443`; MAL/MU/Kitsu `status` is fetched — `mal-fetch.ts:23`, `kitsu-fetch.ts:23`, `mangaupdates-fetch.ts:35` — but never pushed).
- [V-run] Re-running the gate logic with the real selector and the real live emitter set (status from anilist + mangadex only): status **163/166, contested 10/13 = 76.9%** — identical to the pre-recalibration baseline; the extra error is title 485 (`COMPLETED` picked, truth `ONGOING`). With the gate's spec: 164/166. Adding a Kitsu status claim on top of the gate spec: 164/166 (no further change on this corpus). Volumes and chapters are identical in all three configurations (105/106, 78/80).
- [V-run] Gold-only subset (no consensus truth): volumes 25/26, chapters 16/18, status 34/36 (gate spec) vs 33/36 (live emitters).
- [V] Remaining gate errors: `4949` volumes 2 vs 34 (AoT, wrong binding); chapters `4655` 117 vs 113 (Soul Eater) and `4952` 116 vs 108 (FMA); status `492` ONGOING vs HIATUS (Hunter x Hunter) and `4659` COMPLETED vs ONGOING (Vinland Saga; gold at `HARN/truth.ts:61`, while all five providers report finished — `HARN/data/scorecard.md:48`).

**Soundness of the measurement itself**
- [V] Truth = curated gold (36 titles; `HARN/truth.ts`) else ">= 4 of 5 providers agree" (`HARN/derive-weights.ts:85-92`, `HARN/gate.ts:81-92`). Providers are therefore scored against their own majority for 166 of 202 titles; the "97% consensus-vs-gold calibration" is on 92 gold cells (`weights-scorecard.md:4`).
- [V] Weights were derived as raw contested accuracy rounded (JSON `weight` = acc), with Wilson-95% lower bounds reported but not used; the Wilson lower bounds are far lower (MAL volumes 0.67, MangaDex status 0.08) because n = 12-28 (`weights-scorecard.md:11-17`).
- [V] Segment tables show no manhua volume/chapter rows and <= 3 manhwa rows per count field (`weights-scorecard.md:66-104`), so nothing is known about non-Japanese titles. Wikipedia, Fandom and ComicVine were not measured at all (`:21`).
- [V] Benchmark ids are 900000+ and do not collide with gold ids (0 overlap; 36 gold titles) — checked in the offline run.
- [V] Registry/consolidation is committed now (`git log -- src/lib/metadata/provider-registry.ts` -> `5ab8da170`; resolver consolidation `f9efea967`); the memory notes still say "uncommitted".

### Inferences
- [I] Before the status edit, live status was decided by MangaDex whenever it disagreed with AniList (0.912 vs 0.779). After it, AniList always wins. Given contested accuracy AniList 77% vs MangaDex 23%, the edit very likely did improve live status on AniList-vs-MangaDex disagreements, but by the "floor MangaDex" half only; the "MAL is the top authority" half does nothing. The corpus-level live number is unchanged from the old baseline (76.9%) only because the baseline file was itself computed with the unrealistic MAL/MU claims.
- [I] The conclusion "reweighting numeric fields regresses; clustering is near-optimal" (`SEL/authority.ts:23-27`) rests on a corpus where the selector makes 1 volume error and 2 chapter errors. A change that flips one title in either direction is +-1.25pp on chapters; the gate cannot distinguish a good reweight from noise, and it cannot see the confidence mis-calibration at all (it scores picks only).
- [I] The Vinland Saga gold entry is probably stale rather than the engine being wrong (the series concluded in 2025 per the auditor's background knowledge; not verifiable from the repo). If so, true status error on this corpus is 1/166 and one of the 13 "contested" status cases is mislabeled — further shrinking the evidence behind the status weights.
- [I] MangaUpdates `latestChapter` being 36% accurate on contested titles is expected from its semantics (highest released chapter number per scanlation feed, not a canonical count); the problem is a modelling one (treating it as a count vote) rather than a weight-tuning one. The memory note's observation that "a low-accuracy source still casts a helpful confirming vote" is consistent with that — but it also casts an unhelpful vote with weight 0.81 whenever only one or two other sources are present.

### Gaps
- No measurement exists for: Wikipedia/Fandom/ComicVine counts (which drive the count-consensus resolvers and volume ranges), genres/tags/authors/summary/cover correctness, or any per-status/per-era/per-media-type breakdown beyond the sparse segment table.
- The gate was not re-run against a pre-recalibration checkout to quantify the live before/after of the MangaDex floor; only the current code was executed.
- `HARN/collect.ts` was not read; the memory note states MAL is fetched via AniList's `idMal`, which (if also true in production) means AniList and MAL are not independent witnesses.

---

## Q3. End-of-series ceilings, phantom chapters/volumes, "trusted terminal scalar", plausibility guards — implementation and remaining failure modes

### Takeaway
The ceiling logic is a priority chain (AniList -> MAL -> MangaUpdates -> stored DB) gated by a terminal status or any non-empty `endDate`, validated by a 0.9x plausibility floor, with an exact (1.0x) margin when trusted and 1.1x otherwise; a stored-metadata prune is the backstop. It is carefully built for the AoT/Berserk/JJK cases, but it trusts signals that other phases synthesise (a back-filled `endDate`, a back-filled chapter count, a selector-overlaid `chapters`/`status`), and the plausibility detector cannot see the wrong-anchor case it was built for when the anchors out-vote independent witnesses.

### Cited Findings

**Trusted terminal scalar**
- [V] `resolveTrustedFinalChapter` = first non-null of `anilistTrustedCeiling`, `malTrustedCeiling`, `mangaupdatesTrustedCeiling`, `storedTrustedCeiling` (`EP/phase-data-assembly.ts:381-390`).
  - AniList: status in {COMPLETED, CANCELLED} **or** non-empty `metadata.endDate`, and `chapters > 0` (`:334-347`). Reads `appliedMatch.metadata`, i.e. **after** the selector overlay — `chapters`, `volumes` and `status` here may be another provider's value (overlay at `phase-provider-fetch.ts:514` precedes all later phases).
  - MAL: status in {'finished','discontinued'} and chapters > 0 (`:350-357`).
  - MangaUpdates: `completed` flag and `latestChapter > 0`, no volume ceiling (`:360-364`).
  - Stored: stored `endDate` or terminal stored status, and stored chapters > 0 (`:373-379`).
- [V] `plausibleTrustedCeiling`: ceiling discarded if `< 0.9 x rawExpectedChapterCount` (`:394-410`). Applied in data assembly (`:60-66`) and in the volume gate (`pipeline-orchestrator.ts:500-508`).
- [V] Volume gate: trusted -> exact chapter ceiling (margin 1.0) and exact `capVolumeCount`; untrusted -> 1.1x for both (`EP/phase-volume-cross-validation/constraint-validation.ts:24`, `:46-52`, `:70-86`). Other range guards: drop volume starting beyond the ceiling, drop > 3x-median volumes when > 3 volumes, drop after a gap > max(15, 4x median), close 1-chapter gaps, trim overlaps (`:96-179`).
- [V] Finalize backstop: `resolveRealExtent` requires terminal `publicationStatus` **or** non-null `Metadata.endDate`, and `Metadata.chapters > 0`; `realExtent = max(Metadata.chapters, max file-backed chapterNumber)` (`EP/phase-volume-phantom-prune.ts:92-114`). `classifyPhantomChapters` drops integer, non-file-backed chapters beyond the extent whose title is generic or duplicates an in-range title, unless more than 2 distinct-titled chapters exist beyond the extent (`EP/types.ts:374`, `:391-405`). Called from the orchestrator at `pipeline-orchestrator.ts:695`, `:703`.

**Plausibility detector (wrong-binding flag)**
- [V] `detectImplausibleCount`: among non-anchor candidates, find the value with most peers within max(1, 5%); require >= 2 agreeing and consensus >= 4x the stored count (`src/server/services/metadata/plausibility-check.ts:55-87`). Live hook uses the count-consensus `.raw` lists minus anchors (+ Kitsu volumes), sets `providerMetadata.bindingReview`, records an AniList binding rejection, and clears only when >= 2 non-anchors are within 15% of the stored value (`EP/post-enrichment-hooks.ts:99-188`). It never changes the count.

**Failure modes that remain**
1. **S1 — synthesised `endDate` makes ongoing series "terminal".** `aggregateChapterReleaseDates` writes `Metadata.endDate = MAX(Chapter.releaseDate)` whenever `endDate` is null, with no status check (`EP/phase-finalize.ts:402-424`, invoked at `:61`). On the next enrichment, a non-null stored `endDate` satisfies `resolveRealExtent` (`phase-volume-phantom-prune.ts:97-98`) and `storedTrustedCeiling` (`phase-data-assembly.ts:375`). [V] code path; runtime not observed.
2. **S1/S2 — self-referential chapter ceiling.** `backfillMetadataChaptersFromChapterRows` sets `Metadata.chapters = FLOOR(MAX(chapterNumber))` when null, and its own header says this over-counts by 4-11 on 5 of 12 spot-checked titles (`EP/phase-finalize/chapter-count-backfill.ts:1-14`, `:26-41`; invoked `phase-finalize.ts:125`). It is fill-only, so the value freezes; it then serves as `metaCeiling`/stored ceiling. Likewise `backfillMetadataVolumesFromVolumeRows` writes the count of Volume rows when volumes is null/0 (`volume-count-backfill.ts:27-41`). Neither write records provenance, so the persister guard and the UI cannot tell a provider count from a derived one.
3. **S2 — the 1.2x scalar cap defeats the plausibility floor.** `estimateChapterCountFromAssembly` caps the raw expected count to `ceil(scalar x 1.2)` whenever a scalar exists (`phase-data-assembly.ts:235-239`) *before* `plausibleTrustedCeiling` compares the scalar to `0.9 x raw`. When sources overshoot the scalar by > 20% (the "obviously broken scalar" case the floor exists for, e.g. scalar 1 vs ~370 listed), raw is already clamped to 1.2x scalar (=2), so the floor only un-trusts the ceiling; the expected count is still pinned near the broken scalar. [V] from the two code blocks; [I] that this is the Black Clover behaviour.
4. **S2 — narrow trust band.** A ceiling is trusted only when raw expected <= ceiling/0.9 (~1.11x). An 11-20% overshoot (specials/omake lists) drops to the untrusted 1.1x tolerances, re-admitting end-of-series phantoms. [V] arithmetic from `:235-239` and `:406-410`.
5. **S2 — MangaUpdates as a "trusted" terminal scalar.** `latestChapter` is third in the chain (`:360-364`) although it is the least accurate chapter signal measured (36% contested, `weights-scorecard.md:14`).
6. **S2 — wrong-anchor counts are stable.** With AniList and MAL both bound to a 2-volume spinoff, the selector returns 2 with confidence 0.82 "accept" against Kitsu 34 [V-run], the volume consensus returns 2 "medium" against MangaDex 34 + Wikipedia 34 because of seed order [V-run], and the persister's guard blocks a later non-anchor correction (Q4). Only the plausibility flag (needs >= 2 uncontaminated non-anchor witnesses at >= 4x) and a reidentify can repair it; the hook's own comment says witnesses are contaminated via cross-references (`post-enrichment-hooks.ts:94-98`).
7. **S2 — volume no-cluster fallback prefers MangaDex unconditionally.** [V-run] `[anilist 34, mangadex 2, mal 30]` -> 2 ('low'), and the count is consumed without looking at confidence (`pipeline-orchestrator.ts:525-530`), giving `capVolumeCount` a limit of 3. MangaDex's "count" is the max volume number present in its aggregate (`consensus-resolver.ts:68-72`), which is a lower bound for partially-uploaded series. The iter-PVM-N-tune-1 fix replaced "min" with "MangaDex first" to fix the opposite failure (`docs/sessions/iter-pvm-N-tune-1-scorecard.md:1-60`).
8. **S2 — `reconciliation` source fabricates volume ranges.** `splitChaptersAcrossVolumes` distributes an oversized orphan volume's non-file-backed chapters **evenly** (`perSplit = ceil(n / missingVolumes)`) and writes `chapterStart/chapterEnd` with `source: 'reconciliation'` (`EP/phase-volume-reconciliation.ts:102-145`); `ensureExpectedVolumesExist` creates empty placeholder Volume rows 1..expected with null ranges (`:356-372`); orphan volumes get `min..max` of whatever chapters point at them (`:431-444`). These rows carry no confidence and are indistinguishable downstream from provider-attested ranges except by the `source` string (special-cased in `refresh/clear-auto-bindings.ts:334` and `src/server/queue/modules/orphan-volume-prune.ts:11-47`). This matches the Akira "~9 chapters per volume" signature in the memory note.
9. **S3 — membership consensus is count-of-sources then a fixed priority** (mangadex > wikipedia > mangaupdates > comicvine > fandom), per-volume confidence = `min(1, 0.5 + 0.15 x #sources)`; ranges are `[first integer, last integer]` of winning chapters, so a single mis-assigned chapter stretches a range (`EP/phase-volume-cross-validation/membership-consensus.ts:41-47`, `:118-126`, `:139-152`).

### Inferences
- [I] Failure modes 1 + 2 together imply that for an ongoing series whose provider chapter scalar is null (AniList returns null for most releasing series), the first enrichment back-fills both `chapters` and `endDate`; on later runs newly discovered, untitled, not-yet-downloaded chapters above the frozen count satisfy `classifyPhantomChapters` and can be deleted, and the stored ceiling becomes "trusted" at merge time. The `distinctReal > 2` guard only protects series whose new chapters arrive with real titles. The memory note's "19 manga endDate-set-but-ONGOING" is consistent with this mechanism, but it attributes it to stale provider status.
- [I] Because the trusted-ceiling code reads the post-overlay metadata, "AniList's tankobon count is the canonical end (139), not MAL's 141" (`phase-data-assembly.ts:324-329`) is only true while AniList is the selector's numeric winner; the selector is free to hand it MAL's or MangaUpdates' number.

### Gaps
- `phase-volume-cross-validation.ts` (690 lines: range-vote C1 vs range-merge C2), `phase-chapter-reconciliation.ts` (`applyFusionCap`), `phase-volume-stub-cleanup.ts`, `phase-volume-prune-sparse.ts` and `fandom-db-persistence.ts` (`plausibleMaxChapter`) were not read line-by-line; their behaviour is taken from memory notes only where cited.
- Whether `Manga.publicationStatus` and `Metadata.status` can diverge (two status columns are consulted by different guards) was not traced.
- No DB inspection: the number of titles currently affected by failure modes 1-2 is unknown.

---

## Q4. Is there per-field provenance (which provider won, with what confidence)? Can manual overrides be clobbered by re-enrichment?

### Takeaway
Provenance is provider-name-only for the winning value; confidence is computed but persisted only as a coarse review badge for three fields and as raw vote weights for the losers. Manual protection exists for exactly two fields (cover, bannerImage), plus manual bindings and volume manifests; every other `Metadata` field is overwritten on each enrichment whenever a provider supplies a non-null value. Separately, the selector/persister key mismatch means several fields' provenance names a provider whose value was not the one stored.

### Cited Findings
- [V] Stored provenance shape: `Manga.providerMetadata.metadataProvenance[field] = { provider, manual? }` — no confidence, no timestamp, no value hash (`MP:206-234`; the comment at `:212-221` says confidence/alternatives were deferred). `ProvenanceEntry` type exists at `MP:29-52`.
- [V] Losers: `Metadata.fieldAlternatives[field] = [{provider, value, confidence}]` via `cutover-overlay.ts:95-102` -> `phase-provider-fetch.ts:1258-1266` -> `MP:550-561`. The `confidence` there is `min(1, matchConfidence x authority)` — a static per-provider number, not a share (`select-numeric.ts:179-185`; the comment says "share of total parsed weight").
- [V] Winner confidence survives only as (a) `providerMetadata.fieldReview[field] = {state:'low-confidence'|'abstained', confidence}` for `volumes|chapters|status`, replaced each run, written fire-and-forget (`src/server/services/metadata/field-review.ts:26-66`; `cutover-overlay.ts:71-93`), and (b) telemetry rows `MetadataSelectionAttempt` (`phase-provider-fetch.ts:1275-1280`).
- [V] **Key mismatch (S1).** The overlay writes winners under canonical column names (`cutover-overlay.ts:85-87`), but the persister reads legacy keys:
  | Field | Selector writes | Persister reads | Effect |
  |---|---|---|---|
  | summary | `metadata.summary` | `metadata['description']` (`MP:492`) | selector pick ignored; legacy AL-first/<80-char chain decides |
  | cover | `metadata.cover` | `metadata['coverImage']` (`MP:489`) | ignored |
  | coverExtraLarge/Large/Medium | same names | `metadata.covers.{extraLarge,large,medium}` (`MP:578-582`) | ignored |
  | synonyms | `metadata.synonyms` | `metadata['alternativeTitles']` (`MP:507`) | ignored |
  | idMal | `metadata.idMal` | `metadata['externalIds']?.malId` (`MP:650`) | ignored |
  | chapters, volumes, status, genres, authors, artists, tags, themes, format, countryOfOrigin, bannerImage, averageScore, popularity, publishers, contentRating, publicationDemographic, rating, externalLinks | same | same (`MP:495-516`, `:617-660`, `:717-741`) | selector pick is live |
  `collect-candidates.ts:82-83` says the alias table must be "kept in sync with metadata-persister's fallbacks"; it maps provider keys inward but nothing maps selector keys back out. Provenance is still stamped under `summary`/`cover`/`synonyms` with the selector's provider while the stored value came from the legacy key (whose provenance is under `description`/`coverImage`/`alternativeTitles`).
- [V] **MangaUpdates-only overlay for tags/authors/artists (S1).** AniList's claim omits tags, themes, authors, artists (`collect-candidates.ts:121-143`), while the MangaUpdates claim is built against an empty metadata object so it emits its full author/artist/category lists (`phase-provider-fetch.ts:1313-1324`; `mangaupdates-fetch.ts:378-386`, `:423-433`). With one candidate, the list selector accepts at the 0.5 floor (`select-list.ts:212-213`) and the overlay replaces the legacy value (AniList staff-derived authors/artists, `enrichment-result-builder.ts:309-325`; AniList tags + MangaUpdates additions). The selector-loop scorecard shows exactly this: `11:authors -> mangaupdates 1.00`, `11:artists -> mangaupdates 1.00` (`scripts/surveys/selector-loop/runs/full.scorecard.md`, cell-detail rows).
- [V] Persister drift guard: for `volumes`/`chapters` only, refuse when existing provenance is an anchor (anilist/mal), incoming provenance is a non-anchor, and drift > 20% (`MP:406-444`). Incoming provenance is the selector's cluster representative, so a cluster that contains AniList is "from AniList" even if AniList's number is the outlier inside the 5% band.
- [V] Manual pins: `pinFieldOverride` accepts `field: z.enum(['cover','bannerImage'])` only and stamps `{provider:'manual', manual:true}` (`src/server/trpc/routers/manga/metadataOperations/core.ts:204-256`); `applyManualPinGuards` deletes pinned fields (a cover pin locks all four cover columns) from the update and the flag is preserved on re-stamp (`MP:366-390`, `:223-228`). It is declared with `publicProcedure` although it is a mutation (`core.ts:204`) — contrary to the project's own security rule.
- [V] No other manual lock exists in `Metadata`: `manual: true` appears only in the cover picker, manual binding sentinel, manual volume-manifest sentinel and binding ops (grep of `src/`: `core.ts`, `manual-binding-sentinel.ts`, `manual-volume-manifest-sentinel.ts`, `phase-provider-fetch.ts`, `provider-operations/binding.ts`, `metadata-persister.ts`, `CoverSelectorModal/AlternativesTab.tsx`). `manga.update` edits only title/monitoring/sourceId (`crudOperations.ts:224-260`).
- [V] Overwrite rule for everything else: `getValue(new, existing, default)` — new non-null value always wins; existing kept only when the new value is null/empty (`MP:476-486`, `:628-632`). Reidentify additionally nulls `volumes` and `chapters` (`refresh/clear-auto-bindings.ts:379`) and deletes `bindingReview` (`:61`).
- [V] Writers that bypass the persister (no provenance, no guards): chapter/volume count back-fills (Q3), `aggregateChapterReleaseDates`, external-link merge (`phase-finalize.ts:385-388`), parent-series inheritance which **unconditionally** overwrites a variant edition's `authors` with the parent's (`phase-finalize.ts:515`), gallery/merged-synonyms writers, `fandom-db-persistence.ts:505`, `wiki-discovery.ts:314/343`, chapter enrichers (`ast-grep '$A.metadata.update($$$)'` hit list).

### Inferences
- [I] A user-visible consequence of the key mismatch: the "summary came from X" badge can be wrong, and all of the string selector's richness logic (English detection, length saturation, Kitsu/MangaDex synopsis competition) has no effect on stored data. The selector-loop's 100% on `summary`/`cover` cells measures a decision that is never applied.
- [I] MangaUpdates author strings are stored in MangaUpdates' own format, so the overlay likely changes author/artist display names and breaks equality with AniList-derived names used elsewhere (e.g. parent inheritance, search). Not verified against data.
- [I] Any correction made directly in the DB or by scripts such as `scripts/surveys/apply-manual-counts.ts` to chapters/volumes/status is clobbered at the next enrichment unless the provider value is null or (counts only) the 20%-drift anchor guard happens to apply.

### Gaps
- UI consumption of `metadataProvenance`/`fieldAlternatives` (`src/components/.../MetadataProvenance`) was not read; whether the UI shows the mismatched keys is unverified.
- `ProviderBinding` (binding-as-record) and the manual volume manifest re-apply path belong to other researchers and were not audited.

---

## Q5. Statistical soundness: is weighted voting used where robust estimators or source-accuracy-aware fusion would be better? Are static weights used where conditional ones are needed?

### Takeaway
The numeric path is a weighted plurality over hard clusters that returns one source's raw value; the count path is an unweighted plurality with ad-hoc fallbacks. Neither models source accuracy probabilistically, source dependence, or systematic bias, and all weights are global constants even though the largest known error modes are conditional (ongoing vs finished, anchor-bound vs independently searched, count vs max-number semantics). The confidence number is not a probability and is anti-correlated with evidence, so thresholds built on it are not meaningful.

### Cited Findings
- [V] Confidence shape: `min(1, a*(w/W) + 0.5a)` (`SEL/weighted-winner.ts:53-61`). With k equal-weight members in a unanimous cluster the value is `1/k + 0.5`: 1.00 for k<=2, 0.83 for 3, 0.75 for 4, 0.70 for 5 — decreasing with corroboration and touching the numeric accept line (0.70) at five unanimous sources. [V-run] single source 1.00; four unanimous 0.80; 1-vs-1 split 0.77.
- [V] Reject is practically unreachable: numeric reject needs confidence < 0.40, i.e. a singleton winner with < 27% of total weight (4+ way split of near-equal weights); categorical reject needs < 0.50. [V-run] a 4-way split scored 0.45 ("badge", still written). The gate reports `noPick: 0` on every field (`HARN/data/gate-results.json`).
- [V] The review badge is driven by that number (`cutover-overlay.ts:91-93`), so e.g. FMA (three sources agree on 116, one says 128) is flagged at 0.667 while a single-source value or a 1-vs-1 conflict is "accept" [V-run].
- [V] Robust statistics are used only inside `resolveCountConsensus` (cluster median for volumes; `min(median, min)` for chapters — which is simply the cluster minimum) (`consensus-resolver.ts:117`, `chapter-consensus-resolver.ts:121`).
- [V] Weights are static per (provider, field) (`REG:207-214`); there is no dependence on publication status, format/country, era, count magnitude, or binding path. The harness has a segment breakdown but it is nearly empty outside `manga-jp` (`weights-scorecard.md:66-104`).
- [V] The code already knows several conditional facts but encodes them as one-off guards instead of weights: AniList chapters is commonly null for ongoing series (`mal-fetch.ts:116`); MangaDex status flag is stale (`SEL/authority.ts:19-22`); AniList status can lag `endDate` (`phase-data-assembly.ts:339-343`); MAL folds specials into chapter counts (`:324-329`); AniList counts split-part releases (`chapter-consensus-resolver.ts:8-10`); Wikipedia `volumeList.length == 1` is a parse stub (`consensus-resolver.ts:80-90`); Kitsu returns 0 for unknown (`enrichment-result-builder.ts:668-669`).
- [V] Dates use extreme-value rules (earliest start / latest end, `select-structured.ts:32-33`) — the least robust choice — but are unreachable live; live dates are AniList-only with month/day defaulted to 01 when missing (`enrichment-result-builder.ts:351-356`), then cast to `Date` (`MP:606-613`), so year-only precision is silently stored as Jan 1.
- [V] Measured consequence of single-source dates: startYear engine accuracy 81% vs Kitsu 94% (-14pp), with AniList wrong and >= 2 other sources right on Dandadan, Soul Eater, Tengoku Daimakyou, Knights of the Zodiac (`HARN/data/scorecard.md:21-27`, `:36-47`).

### Inferences
- [I] Better-fitting estimators, in order of expected payoff for this data:
  1. Counts: weighted median (or mode over an absolute-plus-relative tolerance) across independent sources, returning the cluster's central value rather than the top-weight member; treat MangaUpdates `latestChapter` and MangaDex `chapterEnd` as lower bounds for ongoing series and as equality witnesses only when the series is finished.
  2. Categorical status: a small per-source confusion-matrix (Dawid-Skene / naive-Bayes) model is feasible with five sources and five classes and would naturally encode "MangaDex says ongoing when truth is completed" instead of a blanket 0.40; at minimum, emit the MAL/Kitsu/MangaUpdates status claims that are already fetched, and combine with the `endDate` signal the ceiling code already trusts.
  3. Confidence: posterior-style agreement (e.g. winner weight share, monotone in number of agreeing independent sources, with a single-source cap well below "accept").
  4. Source dependence: AniList and MAL (linked by `idMal`), and MangaDex when located via `links.al`, are correlated; they should count as one witness for wrong-entity errors (the plausibility detector already does this by excluding anchors, the selectors do not).
- [I] Conditional weights worth having, given what the code comments already document: by status (ongoing: AniList/MAL counts null or lagging, MangaUpdates/MangaDex are fresher; finished: AniList/MAL authoritative), by media type/country (volumes meaningless for webtoons; `MediaType` exists on `Manga`), and by binding provenance (anchor vs independently title-searched).
- [I] With n = 13-25 contested titles per field, no per-field weight can be estimated to better than roughly +-0.2 (Wilson intervals in the harness output), so fine-grained weights (0.88 vs 0.92 vs 0.95) are false precision; rank order and a handful of floors are all the data supports.

### Gaps
- No experiment was run with an alternative estimator; the expected gains above are qualitative. The harness's own "oracle routing ceiling 94% vs engine 87%" figure appears only in the memory note, not in a result file that was found.
- Independence between providers in production (does MAL fetch use AniList `idMal`? does Kitsu search independently?) is owned by the matching/binding researcher.

---

## Q6. What do selector-loop, merge-correctness (iter-MM), replay-consensus-stages, iter-PVM and iter-FC show about residual error?

### Takeaway
None of these harnesses provides a trustworthy residual-error number for field fusion. The selector-loop's "100% of 1,549 cells" is tautological (ground truth is seeded from the authority table with permissive allow-lists). The only curated-truth results are small and stale: iter-MM (15 titles, May 2026) ended with 40% of titles still missing the volume count and 40% the chapter count within 10%; iter-PVM (4 titles) ended at 2/4 passing with ~51% exact volume ranges; the metadata-accuracy gate (July 2026) shows 1-2 errors per ~100 on the three fields it covers.

### Cited Findings
- [V] **selector-loop**: ledger entries are generated by `seed-ledger.ts` from "design intent as expected-winner rules"; "tolerant" cells accept any provider in an allow-list and the README instructs to "relax the rule" when the picker disagrees (`scripts/surveys/selector-loop/README.md`, sections "Ledger seeding methodology", "When to revise the rules"). Example cell: `10:status` expected `mangadex,anilist,mal,mangaupdates,kitsu`, actual `mangadex`, verdict correct (`runs/full.scorecard.md` cell details). Result: 1549/1549 "correct", of which 415 (26.8%) are low-confidence (`runs/full.scorecard.md:3-6`), 23 fields x ~69 manga. Dated 2026-05-30, i.e. before the status reweight; its "strict" rule for status was MangaDex (`README.md` rule list), the opposite of today's weights. The cutover comment cites this scorecard as the justification for going live (`SEL/cutover-overlay.ts:6-8`).
- [V] **iter-MM (merge-correctness)**: scores DB state of 15 curated titles on volume count (within 10%), cross-series contamination (hard gate), gap consistency, chapter count (within 10%), bind accuracy, chapter-title coverage (`scripts/surveys/merge-correctness-harness.ts:1-28`; truth `scripts/surveys/merge-truth.json`, hand-curated from publisher/Wikipedia). iter-0 -> iter-8 (2026-05-16): composite 0.798 -> 0.820; `volumeCount_match` 0.33 -> 0.60; `chapterCount_match` 0.40 -> 0.60; contamination 55 -> 0 volumes; hard-gate failures 6 -> 0; passing (>= 0.95) 2 -> 7 of 15 (`scripts/surveys/.iter-mm-0-results.json` and `.iter-mm-8-results.json` summaries; `docs/sessions/iter-mm-8-scorecard.md`). Still failing at iter-8: A Certain Magical Index SS 0.34, Vinland Saga 0.60, Detective Conan: Hanzawa 0.60, Cheat Mode Farming 0.60, Twin Star Exorcists 0.78, Berserk/HxH/Bastard 0.80. iter-9 scored one title (Index SS: 0 volumes, 0 chapters, composite 0.52).
- [V] **iter-PVM (per-volume membership/ranges)**: 4 truth titles. iter-5: 3/4 pass, composite 0.613, range_exact 0.759, bonus_precision 1.0, range_contraction 1 (`docs/sessions/iter-pvm-5-scorecard.md`). Latest file iter-6: 2/4 pass, composite 0.3625, volumeCount_match 0.5, range_exact 0.509, range_contraction 4 (`scripts/surveys/.iter-pvm-6-results.json`). Sweat and Soap scores 0.000 in iter-5. The N-tune-1 write-up documents the min-fallback/Wikipedia-stub/anchor-not-threaded bug and its fix (`docs/sessions/iter-pvm-N-tune-1-scorecard.md`).
- [V] **iter-FC**: classifies downloaded files as single-chapter vs volume-archive; 100% on 48 truth samples, 5,595 rows classified (`docs/sessions/iter-fc-3-scorecard.md`). Not a metadata-fusion measurement.
- [V] **replay-consensus-stages.ts**: a single-manga diagnostic that replays `resolveVolumeManifest` from cached MangaDex/Wikipedia volume caches; imports `@/server/db` (needs a DB) and produces no persisted results (`scripts/surveys/replay-consensus-stages.ts:1-60`).
- [V] **metadata-accuracy gate** (July 2026, the most recent): see Q2 — volumes 105/106, chapters 78/80, status 164/166 with the gate's spec; 163/166 with live emitters [V-run]. Engine-vs-gold on 36 titles before the status change: 87% overall; startYear 81%, endYear 86% (`HARN/data/scorecard.md:8-16`).

### Inferences
- [I] Best available estimate of current residual error for the three gated fields on mainstream Japanese titles: ~1% volumes, ~2.5% chapters, ~1-2% status — dominated by wrong bindings and count-definition disagreements (specials/omake), not by weights. For dates the last measurement (13-19% wrong year) is still current because nothing in the date path changed. For genres/tags/authors/summary/cover there is no accuracy measurement at all.
- [I] The structural (volume-range) layer is much weaker than the scalar layer: on curated truth, 40% of titles miss counts and roughly half of volume ranges are not exact — consistent with the `reconciliation` garbage-range note.
- [I] iter-MM/PVM results are from mid-May and precede the phantom-prune work (June), the selector cutover (May 30) and the consolidation (July); they should be re-run before being quoted as current.

### Gaps
- iter-MM/PVM/FC harnesses need a live DB and were not re-run. `.iter-pvm-rollout.json` (790 KB) and the `docs/sessions/iter-pvm-N-scorecard.md` rollout were not analysed.
- No harness measures the confidence calibration (e.g. reliability diagram of selector confidence vs correctness).

---

## Q7. Remaining duplication/divergence after the resolver consolidation; files over 500 lines

### Takeaway
The consolidation removed copy-paste inside each system but left the structural duplication intact: two fusion engines plus a legacy chain, four chapter-count estimators, two drift guards (one dead), two anchor-exclusion tolerances, three status normalisers, and a dead `UnifiedMetadataMerger` tree. Fifteen non-test files in the audited directories exceed the 500-line rule.

### Cited Findings
- [V] Parallel fusion paths for the same fields: legacy `Object.assign` chain (`enrichment-result-builder.ts:79-183`) + selector overlay (`SEL/`) + count consensus (`count-consensus.ts`) + finalize back-fills (`phase-finalize/*-backfill.ts`). `chapters` alone can be set by four of them.
- [V] Four chapter-count estimators with different math: `selectNumeric` (weighted cluster), `resolveExpectedChapterCount` (unweighted cluster, min), `estimateChapterCountFromAssembly` (max with caps; the rename is documented at `phase-data-assembly.ts:160-166`), `computeExpectedChapterCount` (Wikipedia-first) (`pipeline-orchestrator.ts:482-489`). Two volume-count estimators: `selectNumeric` and `resolveExpectedVolumeCount`, with different candidate sets (Kitsu in one, MangaDex/Wikipedia in the other).
- [V] Tolerance constants scattered: 5% cluster (`select-numeric.ts:38-45`), 20% drift in two places (`select-numeric.ts:48`, `MP:416`), ±1/±2 absolute (`consensus-resolver.ts:116`, `chapter-consensus-resolver.ts:52`), 5%/±1 plausibility agree and 4x ratio (`plausibility-check.ts:28-34`), 15% corroboration (`post-enrichment-hooks.ts:101`), 1.1x/1.0x ceilings (`constraint-validation.ts:24`, `:76`), 1.2x scalar cap and 3x list cap (`phase-data-assembly.ts:222`, `:235`), 0.9 plausibility floor (`:394`).
- [V] Status normalisation in three places: `mapAniListStatus` + `mapToMangaStatus` (`enrichment-result-builder.ts:269`, `:342-348`), the selector's regex table (`select-categorical.ts:111-122`), and the "single source of truth" `src/utils/status-mapper.ts`.
- [V] Dead/legacy code: `UnifiedMetadataMerger` is instantiated only in tests (`src/server/services/metadata/__tests__/unified-merger.integration.test.ts`, `metadata-workflow.integration.test.ts:36`); `unified-merger/` (index 454 lines + 6 modules) and `metadata-merger.ts` (225) are referenced from non-test code only by `metadataService.ts` and each other. Selector drift guard dead (Q1). `matchConfidence` for fandom/wikipedia unused (`REG:160`, `:169`). `METADATA_FIELD_PRIORITY` (`source-priority-config.ts:102-146`) lists providers that never emit the field (e.g. status: kitsu, mal, mangaupdates) and is not consulted by the selectors.
- [V] Stale documentation that misstates behaviour: `thresholds.ts:19` and `types.ts:10-11` "NOT consumed yet"; `SEL/index.ts:13-15` "dispatch throws 'selector not implemented'"; `select-numeric.ts:11` confidence definition; `phase-provider-fetch.ts` doc "Fire-and-forget — caller must not await" above a synchronous overlay; `gate.ts:9-11` "mirrors production exactly"; "shadow" naming for the live path (`shadow-mode.ts`, `ShadowSelection`).
- [V] Tests present for the consolidated pieces: `tests/lib/metadata/provider-registry.test.ts`, `tests/server/services/metadata/plausibility-check.test.ts`, `tests/server/services/metadata/selectors/confidence-class.test.ts`, `tests/.../phase-volume-cross-validation/count-consensus.test.ts`, plus `SEL/__tests__/select-*.test.ts` (84-101 lines each). No test was found that asserts the selector's winner reaches the persisted column (the key-mismatch class), nor one covering the status regexes with real MAL strings.
- [V] Files over 500 lines (non-test, `wc -l`): `src/server/services/metadata/utils/fandom-table-parser/fandom-volume-parser.ts` 1434; `EP/phase-provider-fetch.ts` 1351; `EP/phase-finalize.ts` 824; `EP/pipeline-orchestrator.ts` 795; `EP/phase-db-persistence.ts` 778; `src/server/services/metadata/metadata-persister.ts` 750; `EP/wiki-discovery.ts` 726; `EP/phase-volume-cross-validation.ts` 690; `EP/phase-provider-fetch/enrichment-result-builder.ts` 689; `EP/phase-volume-reconciliation.ts` 688; `EP/fandom-db-persistence.ts` 678; `src/server/services/metadata/chapter-enricher.ts` 602; `.../fandom-table-parser/fandom-chapter-parser.ts` 597; `EP/phase-data-assembly.ts` 545; `src/server/services/metadata/provider-matching/core-matching.ts` 519. (`EP/phase-provider-fetch/mangaupdates-fetch.ts` and `EP/fandom-mediawiki-fallback.ts` sit at exactly 500.) The fusion-critical ones are `phase-provider-fetch.ts` (claim building lives at its tail), `metadata-persister.ts`, `enrichment-result-builder.ts`, `phase-data-assembly.ts`.

### Inferences
- [I] The key-mismatch and "claims not emitted" bugs are direct products of this duplication: the selector was added beside the legacy chain with its own field vocabulary and its own claim builders, and the only end-to-end check (selector-loop) scores the selector's output, not the persisted column.
- [I] A single claim-emission table (provider -> field -> extractor), shared by the legacy chain, the selector, the gate harness and the count resolvers, would have made findings 1-3 impossible and would let the harness be production-equivalent by construction.

### Gaps
- Client-side duplicates of `parseProviderMetadata` (noted as intentional in `provider-metadata-utils.ts:10-12`) were not enumerated.
- Line counts for directories owned by other researchers (provider HTTP clients, wiki parsers beyond those listed) were not collected.

---

## Appendix: prioritised fix list implied by the findings (auditor's recommendations — all [I])

| # | Severity | Change | Expected accuracy impact |
|---|---|---|---|
| 1 | S1 | Map selector output keys to the keys the persister reads (or make the persister read canonical keys) for summary/cover*/synonyms/idMal; add an end-to-end test | Makes string/list consensus effective; fixes wrong provenance for those fields |
| 2 | S1 | Emit AniList tags/themes/authors/artists claims (or exclude those fields from overlay) | Stops loss of AniList tags and author-name format changes on every MU-bound title |
| 3 | S1 | Do not synthesise `endDate` for non-terminal status (or store it separately); never treat a derived `endDate`/back-filled `chapters` as a terminal signal; record provenance for back-fills | Prevents ongoing series being pruned/capped as finished |
| 4 | S1/S2 | Emit MAL, Kitsu and MangaUpdates status claims; fix the regex anchoring first (or reuse `status-mapper.ts`); fix `gate.ts` to build claims with the production functions | Status contested accuracy 76.9% -> 84.6% on the harness corpus (1 title of 13); removes invalid-enum risk |
| 5 | S2 | Replace the confidence formula with a monotone agreement measure; cap single-source confidence below "accept" for objective fields | Review badge becomes meaningful; no change to picks |
| 6 | S2 | Make count-consensus tie-breaks deterministic and anchor-aware (anchors = one witness); honour `confidence` before using the volume count as a cap | Removes order-dependent 2-vs-2 outcomes; avoids caps from low-confidence MangaDex partials |
| 7 | S2 | Use dates from >= 2 sources (Kitsu/MangaUpdates/MangaDex are already fetched) with majority-year logic | startYear 81% -> ~94% on the gold set (best single source) |
| 8 | S2 | Re-derive weights only after 4 and with a larger contested sample; treat MangaUpdates `latestChapter` as a bound, not a count vote | Unknown; current evidence cannot rank weight sets |
