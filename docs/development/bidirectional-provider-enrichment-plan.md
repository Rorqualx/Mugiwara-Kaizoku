# Bidirectional Provider Enrichment — Design Plan

*Status: Draft (revised 2026-05-27)*
*Originated from the `scripts/surveys/bind-loop/` harness (see iter-plan.md)*

## TL;DR

The bind-loop harness reached **98.8% strict pass** (417/422 probes, 0 false-positives)
and revealed two distinct gaps in the production enrichment pipeline:

1. **Uni-directional alt-title flow.** AniList feeds every other provider's
   verification, but no other cross-feeds exist (except a single MU→Fandom
   feed at `phase-provider-fetch.ts:190`). CV/MD/MU/Kitsu alt-titles dead-end
   in `providerMetadata.<p>.*` and never help re-match siblings.

2. **No authoritative cross-ID source.** When a provider's search doesn't
   surface the right entry (Kitsu missing #2271, MD missing #4875, CV
   missing #4862), the pipeline has no fallback. Search is the only path.

This plan adds two complementary stages:

- **Stage A — Wikidata Q-id discovery + enrichment** (NEW lead change).
  Closes 3 of 4 remaining hard misses by:
  - Surfacing franchise umbrella names that no other source exposes
    (`ワールドウィッチーズ`/World Witches for #2127)
  - Providing authoritative cross-IDs (`P8731`/`P4087`/`P11227`/`P11098`/`P12109`)
    that let us SKIP search when Wikidata already knows the canonical id
  - Adding 10-50 multilingual labels + franchise aliases per manga, free
- **Stage B — Cross-provider alt-title propagation** (still valuable).
  Catches the cases Wikidata doesn't cover by re-trying weak/missing
  providers with alt-titles from the providers that hit ≥95% confidence
  in Pass 1. Pass 3 is conditional — fires only when Pass 2 promoted
  a previously-weak provider OR a franchise alias / cross-ID became
  available that wasn't reachable before. Acts as the fallback when
  Wikidata has no entry for the manga.

Confidence flow:

```
Pass 1: AniList drives matching. Every provider gets a score:
        trusted ≥ 0.95 | good 0.85-0.94 | weak 0.55-0.84 | missing < 0.55
Pass 2: Only TRUSTED providers contribute alt-titles. Re-match weak/missing
        with that union. Replacements gated by score-strictly-higher.
Pass 3: CONDITIONAL — runs only if Pass 2 promoted a provider OR Wikidata
        franchise/cross-ID surfaced new material AND the target provider
        has at least 2 untried novel alts AND hasn't hit its query budget.
```

Expected impact: **harness ceiling 98.8% → 99.5–99.8%**, with the last
miss being any manga genuinely absent from both Wikidata and every
provider's search index.

---

## 1. Current architecture

`src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts`

```
Pass 0 (parallel fetch, title-only):
  ├── AniList.search(title)
  ├── MangaDex.search(title)
  ├── MangaUpdates.search(title)
  ├── Kitsu.search(title)
  ├── Fandom.search(title)
  └── ComicVine.search(title)  (rate-limited 200/hr)

Pass 1 (sequential verification, AniList-driven):
  ├── Fandom retry      ← uses AL.{romaji,english,native,synonyms} + MU.alternativeTitles  *
  ├── MangaDex verify   ← uses AL.id (links.al pre-filter) + AL.titles
  ├── ComicVine verify  ← uses AL.details + language guard
  ├── MangaUpdates      ← uses AL.{romaji,english,native,synonyms}
  └── Kitsu retry       ← uses AL.{romaji,english,native,synonyms}

  * The only existing cross-provider feed: Fandom benefits from MU.
```

Three notable gaps the harness surfaced:

- **CV's `aliases` and MD's `altTitles` never flow back** to help
  MU/Kitsu/Fandom/WP retries.
- **Kitsu's `attributes.titles` map** (often the only source of a romaji slug
  matching the wiki subdomain) doesn't feed back.
- **No authoritative cross-ID source.** When AniList search returns a
  candidate but the OTHER providers' searches don't, there's no Plan B —
  the binding just stays empty.

---

## 2. Stage A — Wikidata Q-id discovery + enrichment (LEAD)

### Why Wikidata

Wikidata is a manually-curated graph that exposes:

| Wikidata property | What it gives us |
|---|---|
| `labels.{en,ja,ko,zh,es,de,fr,ru,th,…}` | Canonical title in 8+ languages |
| `aliases.{lang}` | Colloquial/franchise/transliteration variants per language |
| `P8731` | AniList manga ID |
| `P4087` | MyAnimeList manga ID |
| `P11227` | MangaDex ID |
| `P11098` | Kitsu manga ID |
| `P12109` | MangaUpdates ID |
| `P12108` | Fandom wiki subdomain (sometimes) |
| `P361` (part of) | Franchise Q-id → fetch franchise entity for umbrella names |
| `P1296` | Encyclopedia of Modern Manga (additional cross-ref) |

Verified examples from the bind-loop:

- **#2127 Strike Witches franchise** (`Q1202631`):
  `aliases.ja: ["ワールドウィッチーズ", ...]` — slugifies to `worldwitches`,
  exactly the missing Fandom subdomain. **No other source has this.**
- **#2271 Why Does Nobody** (`Q106320423`):
  `aliases.en: ["Naze Boku no Sekai wo Daremo Oboeteinai no ka?"]` — the
  romaji that AniList only puts in `title.romaji` and that Kitsu's search
  can't surface from the English query.
- **#4875 GoH** (`Q3521063`):
  `labels.ja: ゴッド・オブ・ハイスクール` — katakana form neither AL nor MAL
  has.

### Stage A pipeline

```
Stage A.1 — Q-id discovery (per-enrichment, cached):
  IF Wikipedia is bound:
     query: /w/api.php?action=query&prop=pageprops&titles=<page>
     → pageprops.wikibase_item gives Q-id
  ELSE IF anilistId is known:
     query Wikidata SPARQL:
       SELECT ?q WHERE { ?q wdt:P8731 "<alid>" } LIMIT 1
     → first result is the Q-id
  ELSE:
     skip (manga has insufficient anchors to find Wikidata)

  Store: Metadata.wikidataQid = "Q12345"

Stage A.2 — Synonym union from Wikidata (added to persistMergedSynonyms):
  Fetch entity (one call, returns all language labels + aliases):
    GET /w/api.php?action=wbgetentities&ids=Q12345&languages=*&format=json

  Union into Metadata.synonyms:
    + labels[lang].value for all langs
    + aliases[lang][].value for all langs

  IF claims.P361 (part of) exists:
     fetch franchise entity (single call)
     union franchise labels + aliases too
     → catches franchise names like "World Witches" for Strike Witches manga

Stage A.3 — Cross-ID verification (new safety net in phase-cross-propagate):
  For each provider P where pass-1/pass-2 returned weak or missing:
    IF Wikidata has the canonical id (via claim P<provider>):
       use that id directly via provider.getMetadata(id) — skip search entirely
    This eliminates the "provider search doesn't surface" failure mode
    for any manga that has a Wikidata entry.
```

### Schema change

Single new column on `Metadata`:

```prisma
model Metadata {
  // ... existing fields ...
  wikidataQid    String?   @db.VarChar(20)  // "Q12345"
  @@index([wikidataQid])
}
```

Migration: additive, nullable, no backfill needed at create time.

### Cost analysis

- **Q-id lookup**: 1 call per manga, batchable 50 at a time, free
- **Entity fetch**: 1 call per manga, returns all languages, free
- **Franchise fetch**: 1 call per manga that has `P361`, free
- **Cross-ID verification**: replaces a provider search; net latency win

For the 78-manga library: **~160 calls total, ~30 seconds**. No rate
limit concerns (Wikidata allows 5 req/sec sustained per IP).

For an ongoing single-manga enrichment: **+2-3 calls** (negligible).

---

## 3. Stage B — Cross-provider alt-title propagation (FALLBACK)

Stage A handles manga that exist on Wikidata. For manga that don't (small
indie series, very recent releases), the alt-title cross-feed still helps.

Add a new phase `phase-cross-propagate` between `phase-provider-fetch` and
`phase-finalize`:

```
phase-provider-fetch  (Pass 1 — unchanged. AniList attempts to match all
                       sources; each source's match gets a confidence score)
        ↓
Stage A.3: Wikidata cross-ID verification  (if Q-id known)
        ↓
phase-cross-propagate (NEW — Pass 2 + conditional Pass 3)
        ↓
phase-finalize        (including persistMergedSynonyms + Stage A.2 union)
```

### Confidence bucketing (after Pass 1)

Score every Pass-1 result with `dice(canonicalize(result.title), canonicalize(ref))`
across all refs (AniList romaji/english/native/synonyms). The best score
per provider lands it in one of four buckets:

| Bucket | Score | What it means | Pass 2 behavior |
|---|---|---|---|
| **trusted** | ≥ 0.95 | Effectively 100% (allows diacritic-only diffs) | Contributes alt-titles. Never re-matched. |
| **good** | 0.85 – 0.94 | Reliable match | Keeps its result. Does NOT contribute alts (could be a near-miss spinoff). Eligible for Pass-2 replacement only if a new candidate scores strictly higher. |
| **weak** | 0.55 – 0.84 | Plausible but uncertain | Re-matched in Pass 2 with the union of alts from `trusted` providers. |
| **missing** | < 0.55 or null | No usable result | Re-matched in Pass 2. |

The asymmetric rule — *only trusted (≥0.95) providers contribute alts* —
is the critical safeguard. The bind-loop iter found that MU's stale
`alternativeTitles` cache for Cheat Mode Farming contained "Farming Life
in Another World" (a different manga); had MU been "good" rather than
"trusted" and we'd still trusted its alts, that pollution would have
flipped picker output to the wrong CV entry. The 0.95 floor draws the
line at "the provider clearly matched the same manga".

### Pass 2 — re-match weak/missing with trusted alts

```
1. Build the trusted-only union:
   trustedAlts = ⋃ { alts(P) : P ∈ {AniList, Wikidata, MU, Kitsu, MD, MAL, CV}
                                 AND bucket(P) == trusted }

   where alts(P) is:
     AniList     → title.{romaji, english, native} + synonyms
     Wikidata    → labels[*] + aliases[*][*] + franchise labels/aliases
                   (Wikidata is ALWAYS trusted if its Q-id was confirmed
                    via AL/MAL cross-ID match in Stage A.1)
     MU          → alternativeTitles
     Kitsu       → canonicalTitle + alternativeTitles
     MD          → altTitles (locale map)
     MAL         → titles[] (Default/English/Japanese/Synonym typed)
     CV          → aliases (newline-separated string)

   Filter: dedupe (case + diacritic-fold), strip empties, strip refs
           already tried in Pass 1.

2. For each provider P in {weak, missing}:
   a. Skip if P is bound with manual:true (user overrode)
   b. Skip CV if rate-limit usage > 80%
   c. Pick up to 3 novel alts (highest novelty: low dice against any
      Pass-1 query for P)
   d. Search P with each alt, sequential, polite delay
   e. Score every returned candidate using ALL refs

3. Reconcile per provider:
   - If best Pass-2 score > Pass-1 score + 0.05  → replace
   - Else                                         → keep Pass-1 result
   - good (0.85-0.94) is replaced only if Pass-2 hits ≥ 0.95
   - trusted (≥ 0.95) is NEVER replaced unless Stage A.3 cross-ID gives
     an exact authoritative ID
```

### Pass 3 — conditional, only when expected to succeed

Pass 3 is gated. It runs ONLY if Pass 2's outcome makes a third pass
worth its cost. The gate prevents wasted API calls on probes that
genuinely have no provider entry (e.g. #4830 Dark Summoner on CV).

A provider P qualifies for Pass 3 if **all** of these are true:

```
1. P is still in {weak, missing} after Pass 2.

2. At least ONE of the following pass-3 trigger signals fires:

   (a) Promotion signal: Pass 2 promoted a different provider Q from
       {weak, missing} → {good, trusted}. Q's new alts may unlock P.

   (b) Franchise signal: Stage A returned a Wikidata franchise (P361)
       and the franchise entity exposes new aliases not yet tried for P.
       Most useful for Fandom (franchise wikis like worldwitches).

   (c) Cross-ID-exists signal: Wikidata has P's canonical ID claim
       (P4087/P8731/P11227/P11098/P12109) but Pass 1/2 didn't reach it.
       Direct fetch via Stage A.3 should be retried after rate-limit clears.

3. P has at least 2 novel alts available that weren't tried in passes
   1 or 2 (no point re-running an identical query).

4. P has not hit its per-enrichment query budget (default: 6 total
   queries — 1 pass-1 + 3 pass-2 + 2 pass-3).
```

If P qualifies, Pass 3 builds a NEW alt-union including:
- Trusted alts from Pass 2's newly-promoted providers
- Wikidata franchise aliases (if signal 2b fired)
- The Wikidata canonical ID directly (if signal 2c fired, via Stage A.3)

Then re-runs the same search → score → reconcile loop with the same
strong-match invariant.

```
4. Reconcile Pass 3 results with Pass 2 / Pass 1 using the same rules.
```

### Why the gate matters

A naïve "always run 3 passes" wastes ~3× the API budget on the 70%
of manga where Pass 1 already produces all-trusted results. The gate
ensures Pass 3 fires only on the ~5-10% of manga where Pass 2 actually
introduced new information that could move the needle, AND where the
provider in question has plausible coverage.

In the bind-loop harness, exactly these probes would have triggered
Pass 3:
- **#2127 Strike Witches → Fandom worldwitches** — franchise signal
  fires (Stage A.2 surfaces `ワールドウィッチーズ` alias on franchise Q-id
  Q1202631); Fandom is weak after Pass 2; novel alts available
- **#2271 Why Does Nobody → Kitsu/MU** — promotion signal fires
  (MAL romaji becomes trusted in Pass 2); novel alts available
- **#4875 GoH → MD** — cross-ID-exists signal fires (Wikidata has
  `P11227` MangaDex ID); Stage A.3 direct fetch retried

---

## 4. Implementation outline

### New files

| File | Purpose |
|---|---|
| `src/server/services/wikidata/client.ts` | Wikidata API client (Q-id lookup, entity fetch, SPARQL helper) |
| `src/server/services/wikidata/entity-extractor.ts` | Pure: extracts labels + aliases + cross-IDs from an entity response |
| `src/server/services/wikidata/__tests__/entity-extractor.test.ts` | Unit tests |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate.ts` | Stage B orchestrator (Pass 2 + conditional Pass 3) |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate/alt-union.ts` | Pure: builds trusted-only union (provenance filtering: only providers ≥ 0.95 contribute) |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate/confidence-bucketing.ts` | Pure: scores each provider into trusted (≥0.95) / good (0.85-0.94) / weak (0.55-0.84) / missing (<0.55) |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate/pass3-gate.ts` | Pure: evaluates the 4 trigger conditions and returns the set of providers that qualify for Pass 3 |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate/query-budget.ts` | Per-provider per-enrichment counter (default cap: 6 calls — 1 pass-1 + 3 pass-2 + 2 pass-3) |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-cross-propagate/__tests__/*.test.ts` | Unit tests |
| `prisma/migrations/<ts>_add_metadata_wikidata_qid/migration.sql` | `ALTER TABLE "Metadata" ADD COLUMN "wikidataQid" VARCHAR(20)` + index |
| `scripts/surveys/backfill-wikidata-qids.ts` | One-shot: populate `Metadata.wikidataQid` for all ACTIVE manga |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `wikidataQid` field + index to `Metadata` |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts` | Add Stage A.1 (Q-id discovery) + Stage A.3 (cross-ID verification); extract retry helpers for reuse from phase-cross-propagate |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize.ts` | Extend `persistMergedSynonyms` with Stage A.2 (Wikidata labels/aliases + franchise) |
| `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types.ts` | Add `UnifiedProviderResults.wikidataEntity` field; extend `malResult` with `titles: Array<{type, title}>` |
| `src/server/services/jikan/...` | Capture full Jikan `titles[]`, not just canonical |
| `src/server/services/comicvine/discovery/language-aware-matcher.ts` | Expose CV `aliases` field |
| `scripts/surveys/backfill-merged-synonyms.ts` | Add Wikidata fetch (4th source) — ships now; production code follows |

### Stage A integration in `phase-finalize` (`persistMergedSynonyms`)

The existing `persistMergedSynonyms` function (already added in the earlier
iter) becomes the union point for Wikidata data:

```ts
async function persistMergedSynonyms(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  // ... existing AniList/MU/Kitsu/MD/MAL unioning ...

  // NEW: Stage A.2 — Wikidata labels + aliases + franchise
  if (providerResults.wikidataEntity) {
    for (const t of expandWikidataLabelsAndAliases(providerResults.wikidataEntity)) {
      collected.add(t);
    }
    const franchiseQid = providerResults.wikidataEntity.claims?.P361?.[0]?.id;
    if (franchiseQid) {
      const franchise = await wikidataClient.getEntity(franchiseQid);
      if (franchise) {
        for (const t of expandWikidataLabelsAndAliases(franchise)) {
          collected.add(t);
        }
      }
    }
  }

  // ... existing persistence ...
}
```

### Stage A.3 integration in `phase-cross-propagate`

```ts
async function retryProvider(
  provider: Provider,
  providerResults: UnifiedProviderResults,
  altUnion: string[],
): Promise<void> {
  // FAST PATH: Wikidata-verified cross-ID
  const wd = providerResults.wikidataEntity;
  const claimedId = wd && extractWikidataProviderId(wd, provider);
  if (claimedId) {
    const direct = await fetchByProviderId(provider, claimedId);
    if (direct) {
      replacePass1Result(providerResults, provider, direct);
      return;
    }
  }

  // FALLBACK: alt-title re-search
  const novel = pickNovelAlts(altUnion, alreadyTried(providerResults, provider));
  for (const q of novel.slice(0, 3)) {
    const result = await search(provider, q);
    if (result && shouldReplace(providerResults, provider, result)) {
      replacePass1Result(providerResults, provider, result);
      return;
    }
  }
}
```

---

## 5. Safeguards

| Risk | Safeguard |
|---|---|
| Wikidata Q-id misidentified (matches wrong manga) | Verify the entity's `P8731` AniList ID matches our known AniList ID before trusting any of its claims |
| Wikidata cross-ID is wrong (Wikidata data error) | Sanity-check: pulled provider entity's title must dice-match against AL refs ≥ 0.6, else discard |
| Pass 2 overwrites a correct Pass 1 match with a worse pick | Strong-match invariant + replacement only when new score strictly higher (+0.05 threshold) |
| CV rate-limit blown | `cvRateLimitNear()` guard skips CV Pass 2 when >80% used |
| Infinite recursion | Single-pass design — alts computed once |
| Polluted alts (Cheat Mode → "Farming Life") | Provenance: weak providers don't contribute alts to the union |
| Slow runs | All Pass 2 retries run in `Promise.all` (parallel across providers, sequential within) |
| Strong bindings churn unnecessarily | `if (newScore > oldScore + 0.05)` replacement threshold (avoid flapping) |
| Wikidata API down | Stage A is fully optional — if `wikidataEntity` is null, Stage B alt-title fallback runs as before |

---

## 6. Test plan

### Unit tests

- `wikidata/entity-extractor.test.ts`: label/alias extraction, claim parsing, franchise resolution
- `alt-union.test.ts`: dedup case+diacritic, exclude already-queried, cap at N, provenance filtering
- `quality-bucketing.test.ts`: threshold boundaries (0.55, 0.85), null handling
- `phase-cross-propagate.test.ts`: mock providers, assert pass-2 only fires for weak/missing, assert strong-match invariant

### Integration test via bind-loop harness

The bind-loop harness already simulates Pass-2-like behavior with multi-query
corpus building. Add a `phase-cross-propagate-replay.ts` that:

1. Replays the harness against the SAME corpus
2. Applies the production Stage A + Stage B logic
3. Compares scorecard delta against the b23-refetch baseline

Expected wins:
- #2127 Strike Witches Fandom: Stage A franchise alias `worldwitches` → ✅
- #4830 CV: Stage A confirms no CV cross-ID exists → cleanly emit null → ⊘ no-match-emitted
- #4875 MD: Stage A cross-ID `P11227` → direct lookup → ✅
- #2271 Kitsu: Stage A cross-ID `P11098` (if Wikidata has it) OR Stage B with MAL romaji → ✅

Total expected lift: 98.8% → 99.5%+ on the 422-probe harness. With 0
false-positives (Stage A's cross-ID verification is exact-match, not
heuristic).

### Production validation

Run the bind-loop on production DB before + after deployment:

```bash
# Before
bun run scripts/surveys/bind-loop/build-corpus.ts
bun run scripts/surveys/bind-loop/replay.ts pre-deploy
bun run scripts/surveys/bind-loop/score.ts pre-deploy

# After Stage A deploy
bun run scripts/surveys/backfill-wikidata-qids.ts --apply
bun run scripts/surveys/bind-loop/replay.ts post-stage-a
bun run scripts/surveys/bind-loop/score.ts post-stage-a --vs pre-deploy

# After Stage B deploy
bun run scripts/surveys/bind-loop/replay.ts post-stage-b
bun run scripts/surveys/bind-loop/score.ts post-stage-b --vs post-stage-a
```

Acceptance: strict pass ≥ previous, false-positives ≤ previous.

---

## 7. Rollout strategy

### Stage A rollout (Wikidata)

**A.0 — Backfill script (ships first, no schema needed)**
Extend `scripts/surveys/backfill-merged-synonyms.ts` to also fetch
Wikidata labels + aliases + franchise. Ships in ~30 minutes; the
synonyms get unioned into `Metadata.synonyms` directly. No production code
change required, no schema change. Immediate harness improvement.

**A.1 — Schema migration + Q-id field**
Add `Metadata.wikidataQid` column. Run backfill to populate it. Now
production code can read the Q-id to avoid re-discovery on each enrichment.

**A.2 — Pipeline integration**
Add Stage A.1 (discovery) to `phase-provider-fetch.ts` and Stage A.2 (union)
to `persistMergedSynonyms`. Behind env flag `ENRICHMENT_WIKIDATA=1`. Flip
on in staging, watch logs 48h, then prod.

**A.3 — Cross-ID verification**
Add Stage A.3 fast-path to `phase-cross-propagate` (after that lands).
Behind env flag `ENRICHMENT_WIKIDATA_CROSS_ID=1`.

### Stage B rollout (alt-title cross-propagate)

**B.1 — Opt-in via env var** (`ENRICHMENT_CROSS_PROPAGATE=1`)
Deploy with flag off. Run bind-loop with flag on to verify.

**B.2 — Opt-out for staging**
Flip default to on for non-production. Watch logs for unexpected
replacements over 48h.

**B.3 — Full rollout**
Remove flag. Add the bind-loop as a pre-merge CI check.

---

## 8. Open questions

1. **Run Stage A on every enrichment, or only on user-triggered rebind?**
   Argument for "only on rebind": current bindings work, why disturb them.
   Argument for "every run": newly added manga or newly-published Wikidata
   entries could improve coverage incrementally. **Lean toward every run**
   for Stage A.2 (just adds synonyms; doesn't disturb bindings) and
   **only on rebind** for Stage A.3 (changes bindings).

2. **Should we cache Pass 1's "tried queries" so Pass 2 doesn't repeat
   them?** Yes — add a `triedQueries: Set<string>` to `UnifiedProviderResults`
   in `phase-provider-fetch`. Pass 2 computes `union − triedQueries`.

3. **`manual: true` bindings**: skip Stages A.3 and B for that provider.
   The user has explicitly chosen the binding.

4. **Telemetry**: log Stage A + Stage B outcomes to `EnrichmentLog` so we
   can measure actual production lift. Fields: `wikidataQidFound: bool`,
   `wikidataSynonymsAdded: number`, `crossIdReplacements: number`,
   `crossPropagateReplacements: number`.

5. **Wikidata SPARQL endpoint reliability**: the public endpoint can be
   slow during peak hours. Fall back to MediaWiki API `wbsearchentities`
   when SPARQL times out (>10s). Already handled by the client.

---

## 9. Estimated effort

| Step | LOC | Effort |
|---|---|---|
| **Stage A.0 — Wikidata in backfill script** | ~80 | 1h |
| Wikidata client (`client.ts` + `entity-extractor.ts`) | ~200 + 100 | 3h |
| Schema migration + Q-id field | ~30 | 0.5h |
| Backfill script (`backfill-wikidata-qids.ts`) | ~120 | 1.5h |
| `phase-provider-fetch.ts` Q-id discovery + cross-ID fast path | ~80 | 2h |
| `persistMergedSynonyms` Wikidata union | ~40 | 0.5h |
| Extract retry helpers from `phase-provider-fetch.ts` | ~100 moved | 2h |
| `alt-union.ts` + tests (trusted-only filter) | ~100 + 60 | 1.5h |
| `confidence-bucketing.ts` + tests (4 buckets at 0.55/0.85/0.95) | ~50 + 50 | 1h |
| `pass3-gate.ts` + tests (4 trigger conditions) | ~80 + 60 | 1.5h |
| `query-budget.ts` + tests | ~40 + 30 | 0.5h |
| `phase-cross-propagate.ts` main (Pass 2 + conditional Pass 3) | ~250 | 4h |
| Wire into orchestrator | ~10 | 0.5h |
| MAL `titles[]` capture | ~30 | 1h |
| CV `aliases` exposure | ~20 | 0.5h |
| Bind-loop integration test | ~100 | 1.5h |
| Production telemetry | ~50 | 1h |
| **Total** | **~1,490 LOC** | **~22h** |

The Stage A.0 step (Wikidata in backfill) is ~5% of the total work and
captures most of the synonym-union benefit. Worth shipping standalone.

---

## 10. Next steps

1. Review this plan
2. Decide on open questions (esp. #1 — every-run vs rebind-only)
3. **Ship Stage A.0** (Wikidata in `backfill-merged-synonyms.ts`) — quick win
4. Pick flag names: `ENRICHMENT_WIKIDATA`, `ENRICHMENT_WIKIDATA_CROSS_ID`,
   `ENRICHMENT_CROSS_PROPAGATE`
5. Cut a branch for Stage A.1+A.2 (schema + pipeline integration)
6. Run bind-loop with Stage A on; verify scorecard improvement
7. Implement Stage B (`phase-cross-propagate`)
8. Add Stage A.3 cross-ID fast path
9. Deploy in order A.0 → A.1 → A.2 → A.3 → B; verify at each step
10. Monitor 48h, then remove flags
