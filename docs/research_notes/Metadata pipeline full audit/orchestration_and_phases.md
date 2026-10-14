# Orchestration layer and phases of the metadata enrichment pipeline

Scope: how one enrichment run is triggered, ordered, bounded, retried and locked. Method: static reading only (no runs, no DB access). All paths are relative to the repo root. `EP/` abbreviates `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/`.

"Verified" = I read the cited lines. "Inferred" = a consequence I derived but did not observe at runtime. Severity: Critical / High / Medium / Low. Impact estimates are reasoned from code, not measured.

Files read in full: `EP/pipeline-orchestrator.ts`, `EP/phase-provider-fetch.ts`, `EP/enrichment-lock.ts`, `EP/post-enrichment-hooks.ts`, `src/server/services/shared/with-timeout.ts`, `src/server/queue/handlers/metadata.ts`, `src/server/services/library/scanner/enrichment-handler.ts`. Read in part: `EP/phase-finalize.ts`, `EP/phase-db-persistence.ts`, `EP/phase-fandom-enrichment.ts`, `EP/phase-chapter-reconciliation.ts`, `EP/pipeline-orchestrator/volume-persistence.ts`, `EP/wiki-discovery.ts`, the trigger call sites. Not read: the bodies of the Phase 6 volume reconcile/prune modules, `fandom-db-persistence.ts`, `phase-finalize/*` helpers (only their loop annotations were indexed).

## Q1. What are the phases, in what order do they run, and what does each read/write?

### Takeaway
There is no job queue in the real path: every trigger calls `runEnrichmentPipeline` directly, which runs about 45 strictly sequential awaited steps under an in-memory per-manga lock. The code lives under a tRPC router directory, not under `src/server/services/pipeline/` (that directory holds unrelated release-event handlers).

### Cited Findings

Triggers (all call the same function, verified):
- `manga.oneClickEnrich` (protected mutation) awaits the whole pipeline inside the HTTP request, no options — [core.ts:266-303](src/server/trpc/routers/manga/metadataOperations/core.ts)
- `refreshMetaData` (**publicProcedure** mutation) optionally runs `clearAutoBindingsForReidentify`, then awaits the pipeline with `{forceRefresh, previousAniListId}`, then `removePhantomArtifacts` — [refresh/index.ts:70-144](src/server/trpc/routers/manga/metadataOperations/refresh/index.ts)
- Library scanner auto-match, awaited inline per manga group, groups processed at `concurrency: 5` — [scanner.ts:161-191, 450-451](src/server/services/library/scanner.ts), [scanner/enrichment-handler.ts:22-44](src/server/services/library/scanner/enrichment-handler.ts)
- Post-import enrichment — [import-from-pipeline.ts:210-218](src/server/trpc/routers/library/import-from-pipeline.ts)
- Post-manual-bind, fire-and-forget with `forceRefresh: true` — [provider-operations/binding.ts:144-160](src/server/trpc/routers/manga/provider-operations/binding.ts)
- About 25 scripts under `scripts/` and `scripts/surveys/` call it in their own process (e.g. `scripts/bulk-reidentify.ts:82`, `scripts/surveys/enrich-all.ts:76`).

Top level — [EP/pipeline-orchestrator.ts:744-796](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts):
1. `withEnrichmentLock(mangaId)` (line 750)
2. `phaseProviderFetch` (753)
3. `executeEnrichmentPhases` (756)
4. `phaseFinalize` (760)
5. completeness audit: re-reads all Volume rows, scores, logs (763-786)
6. hooks, all awaited inside the lock: `maybeSyncSuwayomiChapters`, `maybeTriggerAutoDownload`, `maybePlausibilityCheck` (790-792)

Phase 1, `phaseProviderFetch` — [EP/phase-provider-fetch.ts:105-533](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts):
- Reads: provider enable flags (111), `Manga.selectedSourceId` + `providerMetadata` (120-123), rejected AniList ids from `ProviderBinding` (128).
- Wave 1, `Promise.allSettled` of 6, each capped at 60s by `withTimeoutOrNull`: AniList, MangaDex (search + aggregate + chapter list), Fandom (discover + parse), Wikipedia, MangaUpdates, Kitsu (153-161).
- Wave 2, `Promise.all` of 6, each 60s: Wikipedia retry with hints, Fandom re-discovery (two sequential 60s attempts), MangaDex verify via `links.al`, ComicVine language-aware match (its only discovery path), MangaUpdates verify, Kitsu retry (253-364).
- Then serial: MAL fetch, 60s (401-405).
- Then in-memory: cross-series gate that blanks Fandom/Wikipedia chapter and volume lists (423-499), `buildEnrichmentResult` (502), selector cutover overlay (514).
- Writes (all fire-and-forget `void`): `recordBinding` (169), `writeFieldReview` to `Manga.providerMetadata` (1256), `persistSelectionAttempt` (1276), `updateCachedFandomUrl` to `Metadata.urls` (1154).
- Output: in-memory `UnifiedProviderResults` — [EP/types.ts:90-184](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types.ts).

`executeEnrichmentPhases` — [EP/pipeline-orchestrator.ts:538-726](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts):

| Step | Lines | Reads | Writes |
|---|---|---|---|
| bonus-chapter count + chapter consensus | 558-566 | Chapter | none |
| 2 `phaseDbPersistence` | 567 | Chapter | Metadata (via persister); one transaction that deletes ALL Volume rows then merges Chapter rows; then Volume rows from provider volumes |
| 2.5 `reconcileFromProviderResults` | 570 | Chapter, Manga, Metadata | Chapter (creates PENDING rows, sets `volume`) |
| 3 collect proposals | 574-628 | Manga.providerMetadata, Metadata | none |
| 4 cross-validate + `persistValidatedVolumeRanges` | 631-636 | Volume, Manga | Volume create/update |
| 4.5 `applyVolumeCoverImages` | 639-642 | Volume | Volume |
| 4.6 `resolveFandomUrl` + `applyFandomVolumeFields` | 650-652 | Metadata.urls, network | Volume |
| 5 `runFandomEnrichmentPhase` (90s cap) + standalone gallery harvest | 657-659 | network, Chapter | Chapter, Volume, Manga.providerMetadata |
| 6 reassign/reconcile/fill/correct volumes | 666-669 | Chapter, Volume | Chapter, Volume |
| 6.2 three sparse-range prunes | 683-686 | Volume | Volume |
| 6.25-6.26b phantom volume/chapter prunes | 695-708 | Chapter, Volume, Metadata | deletes Volume/Chapter |
| 6.27 `assignOverflowChapters` | 711 | Chapter, Volume | Chapter, Volume |
| 6.5 bonus reassignment | 714-718 | Chapter | Chapter |
| 6.6 `pruneRedundantVolumeFileStubs` | 725 | Chapter | Chapter |

`phaseFinalize`: 31 sequential awaited steps (provider bindings, relations, recommendations, external links, synonyms, date/cover/description inheritance, Wikipedia volume fill, gallery union, manual manifest reapply, volume-id backfill, volume-file rows, archive linking, special chapters, Metadata.volumes/chapters backfill, status sync, cover pre-warm, cache invalidation, WebSocket emit), then a full `findUnique` with all relations — [EP/phase-finalize.ts:44-139](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize.ts).

The orchestrator's own header describes 7 phases and the function docstring still mentions an "AI agent enrichment (3-step merge)" path that does not exist in the function body — [EP/pipeline-orchestrator.ts:3-19, 732-743](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts).

### Inferences
- Phase numbering is unreliable as documentation: "Phase 5" means Fandom enrichment at line 654 and Finalize at line 758; "Phase 6" means the safety net at 661 and the completeness audit at 762.
- Because Phase 2 deletes all volumes and Phases 3-6 rebuild them, every run is effectively a full volume rebuild, not an incremental update.

### Gaps
- `docs/architecture/` contains only `architecture-overview.md`, `IMAGE_PROCESSING_UNIFICATION.md`, `PROVIDER_REGISTRY_MIGRATION.md`; I did not read them, so I cannot say whether the documented flow matches the code.
- `src/server/services/providers/` appears to be imported by only three files outside itself (`provider-initializer.ts` and two search providers); I did not trace whether it participates in enrichment at all.

## Q2. Where is work sequential that could be parallel, and where is concurrency unbounded or mis-bounded?

### Takeaway
Network fan-out in Phase 1 is already parallel; the remaining cost is in redundant Fandom discovery and hundreds of serial single-row DB statements. The larger risk is the opposite problem: the pipeline runs on the 15-connection UI pool with unbounded `Promise.all` bursts, and the scanner runs 5 pipelines at once.

### Cited Findings

Mis-bounded concurrency:
- **High.** The pipeline uses the UI Prisma pool, not the background pool. The orchestrator and phases import `prisma` from `@/server/db` ([EP/pipeline-orchestrator.ts:21](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts), [EP/phase-provider-fetch.ts:25](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts)); a text search for `backgroundPrisma` across `EP/` and `src/server/services/metadata/` returned no files. Pools are 15 (UI) and 5 (background) — [src/server/db.ts:38-40](src/server/db.ts).
- **High.** Unbounded `Promise.all` over every volume: `persistValidatedVolumeRanges` issues one `updateMany` per existing volume concurrently ([EP/pipeline-orchestrator/volume-persistence.ts:131-137](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator/volume-persistence.ts)); `applyVolumeCoverImages` does the same ([EP/pipeline-orchestrator.ts:385-399](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts)).
- **High.** Scanner auto-match runs up to 5 full pipelines concurrently ([scanner.ts:190](src/server/services/library/scanner.ts)). There is no global limiter: `ast-grep --pattern 'pLimit($$$)' src` returned nothing, and the only cross-run guard is the per-manga lock.
- **Medium.** Wave 1 and wave 2 each start 6 provider calls with no shared rate budget across concurrent pipelines ([EP/phase-provider-fetch.ts:153-161, 253-364](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts)).

Sequential work that could be parallel or batched:
- **High (latency).** Fandom wiki discovery is repeated up to 4-5 times per run for a title with no cached URL, and the cache is positive-only (`Metadata.urls` containing `.fandom.com`; a "not found" result is never stored) — [EP/wiki-discovery.ts:60-69, 287-299](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery.ts). Call sites: wave 1 ([phase-provider-fetch.ts:157](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts)), wave-2 alt-title retry (299-302), `resolveFandomUrl` ([fandom-volume-fields.ts:32-36](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator/fandom-volume-fields.ts), called at orchestrator 651 with no timeout), `phaseFandomEnrichment` ([phase-fandom-enrichment.ts:55](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts)), and `runStandaloneGalleryHarvest` (orchestrator 467-477, no timeout).
- **Medium.** `harvestFandomGalleryDirect` runs twice per non-gated run: once inside `phaseFandomEnrichment` ([phase-fandom-enrichment.ts:124](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts)) and again unconditionally (orchestrator 459). Each pass loops 13 candidate URLs serially (213-234), so 26 MediaWiki calls where 13 suffice.
- **Medium.** `inheritVolumeReleaseDatesToChapters` is called 3 times in finalize (lines 63, 83, 114); each call runs three per-volume serial `updateMany` loops ([EP/phase-finalize.ts:151-202](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize.ts)). `runBannerImageFallback` also runs twice (comment at 76-80).
- **Medium.** Per-row serial updates inside the Phase 2 interactive transaction: one `tx.chapter.update` per changed chapter ([EP/phase-db-persistence.ts:511-548](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence.ts)) under a 30s transaction timeout (line 259).
- **Medium.** `verifyMangaDexWithAniList` searches MangaDex serially once per title variant, including every AniList synonym of 3+ characters with no cap, and repeats the original `title` query that wave 1 already ran ([EP/phase-provider-fetch.ts:893-913](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts)). The in-code comment assumes "3-7 query variants".
- **Low.** Wave 1 fetches the MangaDex aggregate and full chapter list for the title-only match (835-838); if wave 2 picks a different manga both are fetched again (923) and the first pair is discarded.
- **Low.** Index of serial DB loops: 100+ `no-await-in-loop` suppressions under `EP/`, densest in `phase-finalize/volume-wikipedia-fill.ts` (10), `fandom-db-persistence.ts` (6), `wiki-discovery.ts` (5), `phase-finalize.ts` (4), `phase-db-persistence.ts` (4).
- **Low.** Single-row re-reads of the same Manga/Metadata row within one run: `loadStoredTerminalSignal` twice (orchestrator 102, 153), `providerMetadata` at phase-provider-fetch 120 and 1014, orchestrator 210, volume-persistence 103, phase-finalize 769, post-enrichment-hooks 121.

### Inferences
- For a 100-volume series the three inheritance passes issue up to roughly 900 `updateMany` statements (3 calls x 3 fields x 100 volumes); three set-based `UPDATE ... FROM "Volume"` statements run once would replace them. Estimated saving: seconds per run on large series.
- A library scan with auto-match can queue 5 x (up to V concurrent volume updates) on a 15-connection pool shared with page requests, so UI latency during scans is the likely symptom. This contradicts the intent of the dedicated background pool.
- For titles with no Fandom wiki, repeated discovery is probably the largest avoidable latency in the run; a per-run memo (or a short-lived negative cache) would remove 3-4 full discovery passes.
- Wave 1 could skip the MangaDex aggregate/chapter fetch until the match is verified, saving two paginated requests whenever verification changes the match.

### Gaps
- No timings were measured. The only wall-time figure available is the memory note's 88s for a 5-chapter title with `forceRefresh` (`project_enrichment_perf_verified.md`), which I did not reproduce.
- I did not read the Fandom chapter-detail batch processor (said to be capped at 10 concurrent) or provider-client rate limiters; those belong to other researchers.

## Q3. How are jobs scheduled, retried, de-duplicated and timed out?

### Takeaway
Enrichment is not queued, not retried, and not coalesced; the only timeout primitive stops waiting without cancelling the work. The one queue-based path (`bulkRefreshMetadata`) enqueues jobs whose handler is a stub, so bulk refresh does nothing while reporting success.

### Cited Findings

- **Critical (functional).** `bulkRefreshMetadata` enqueues `JobType.metadata_refresh` jobs ([bulk.ts:600-655](src/server/trpc/routers/bulk.ts)). The handler registered for `metadata_refresh`, `metadata_update` and `metadata_sync` ([queue/handlers/index.ts:33-35](src/server/queue/handlers/index.ts)) loads the manga, logs "Metadata refresh not fully implemented", emits a `metadata_updated` event and returns successfully without calling the pipeline — [queue/handlers/metadata.ts:25-70](src/server/queue/handlers/metadata.ts).
- **High.** `withTimeoutOrNull` does not cancel: "The inner promise continues to run and its result ... is discarded" — [with-timeout.ts:8-10](src/server/services/shared/with-timeout.ts). Consequences verified in code:
  - Phase 5 is raced against 90s (orchestrator 449-453) but `phaseFandomEnrichment` keeps going and later writes chapters/volumes, gallery and URL template ([phase-fandom-enrichment.ts:115, 124, 128](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts)) while Phase 6 prunes and finalize run, and potentially after the lock is released.
  - A wave-1 Fandom fetch that exceeds 60s leaves `fandomResult` null, so wave 2 starts a second Fandom fetch while the first is still running (phase-provider-fetch 157, 277-306).
- **High.** A wave-2 timeout discards good wave-1 data. The MangaDex verify step returns `withTimeoutOrNull(...)`, i.e. `null` on timeout, and the result is assigned unconditionally: `mangadexData = mangadexVerified` — [phase-provider-fetch.ts:310-315, 367](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts). Same for MangaUpdates (335-347, 369).
- **High.** Wave 2 uses `Promise.all`, not `allSettled` (253-254), and `withTimeoutOrNull` does not catch rejections. `verifyMangaDexWithAniList` has no try/catch around `client.searchManga` (889-924), so one MangaDex error during verification rejects the whole wave and aborts the pipeline, discarding all wave-1 results.
- **High.** The lock is in-memory and per-process: a `Map<number, Promise<void>>` — [EP/enrichment-lock.ts:11-39](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/enrichment-lock.ts). It has no timeout and no owner, and waiters are not coalesced: each waiter runs the full pipeline again after the holder finishes (22-25, 35).
- **High.** Destructive pre-work runs outside the lock: `clearAutoBindingsForReidentify` executes before `runEnrichmentPipeline` acquires the lock ([refresh/index.ts:101-112](src/server/trpc/routers/manga/metadataOperations/refresh/index.ts)); the manual-bind path likewise detaches chapters and deletes volumes before its fire-and-forget pipeline ([binding.ts:120-128, 144-160](src/server/trpc/routers/manga/provider-operations/binding.ts)).
- **Medium.** Un-timeboxed awaits inside the lock: `resolveFandomUrl` discovery (orchestrator 651), `runStandaloneGalleryHarvest` (459), `maybeSyncSuwayomiChapters` (790, calls an external engine — [post-enrichment-hooks.ts:43-60](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/post-enrichment-hooks.ts)), and all of `phaseFinalize`.
- **Medium.** `forceRefresh` reaches only two places: Fandom URL cache clearing (phase-provider-fetch 157 → wiki-discovery 60-62) and the Fandom detail-fetch/scraper skip checks ([phase-fandom-enrichment.ts:87, 327](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts)). It is not passed to the AniList, MangaDex, Wikipedia, MangaUpdates, Kitsu, ComicVine or MAL calls (155-160, 329, 403). The bind-path comment claiming "cached blobs are invalidated" ([binding.ts:139-140](src/server/trpc/routers/manga/provider-operations/binding.ts)) is not supported by the orchestration code.
- **Medium.** Wave-2 Fandom retry (a) passes `forceRefresh=false` with a URL override, and retry (b) re-runs discovery with alt titles, each with its own 60s cap run sequentially (283-304).
- **Medium (security, cross-cutting).** `refreshMetaData` is a `publicProcedure` mutation that can clear bindings and run a multi-minute pipeline ([refresh/index.ts:70](src/server/trpc/routers/manga/metadataOperations/refresh/index.ts)); CLAUDE.md lists public mutations as a blocked pattern.
- Sticky reidentify loop (history check): the binding-as-record fix is present. Rejected AniList ids are loaded (128), a rejected auto binding is not re-pinned (140-142), rejected search hits are filtered before scoring (724-726), and the fallback id is skipped when rejected (734). The plausibility hook records the rejection ([post-enrichment-hooks.ts:147-167](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/post-enrichment-hooks.ts)).
- Memory-note check: `project_enrichment_perf_verified.md` says `phase-provider-fetch.ts` imports the second Prisma client (`@/lib/prisma`). Current code imports `@/server/db` (line 25); `src/lib/prisma*` did not match any file. That claim is stale.

### Inferences
- Worst-case Phase 1 wall time is about 240s (60s wave 1 + up to 120s for the two sequential Fandom retries in wave 2 + 60s MAL), before Phase 5's 90s cap and the un-timeboxed steps.
- Duplicate enrichment is easy to trigger: import fires a pipeline, then a user clicks refresh; the second call waits and then repeats every provider call. Returning the in-flight promise to non-`forceRefresh` waiters would remove the duplicate.
- A single hung await (for example Suwayomi sync) holds the lock for that manga until process restart, and every later trigger for that title waits silently behind it.
- Scripts run in a separate process, so `scripts/bulk-reidentify.ts` and the server can enrich the same title concurrently with no mutual exclusion. A Postgres advisory lock keyed on mangaId would close this.
- After a plausibility rejection the wrong data from the current run stays persisted; the fix only takes effect on the next reidentify. No automatic re-run is scheduled (consistent with there being no scheduler).
- Zombie Phase 5 writes racing Phase 6 deletes is a plausible source of intermittent "phantom reappears after reidentify" reports, but I have no runtime evidence.

### Gaps
- I did not read `clear-auto-bindings.ts` beyond its header comment, so the exact rows at risk in the outside-the-lock race are not enumerated.
- Whether `fetchWikipediaChapterData`, `runLanguageAwareComicVineMatch`, `verifyMUWithAniList` and `fetchKitsuDirect` catch their own errors was not checked; only the MangaDex verify path was confirmed to throw through.
- Whether provider services cache responses internally (which would decide how much `forceRefresh` actually misses) belongs to the caching researcher.
- No periodic metadata refresh scheduler was found in the files I searched (`src/server/queue/`), but I did not search exhaustively (e.g. calendar/maintenance workers).

## Q4. Algorithmic complexity of the hot paths

### Takeaway
I found no O(n^2) loops over chapters or volumes in the orchestration code I read; lookups use Maps and Sets. The real cost is O(V) and O(C) database round-trips repeated across phases, plus repeated full-table reads of the same manga's chapters and volumes.

### Cited Findings
- Chapter merge is linear: `byChapterNumber` Map and a prebuilt title/date index ([phase-db-persistence.ts:493-503](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence.ts), [file-content-matcher.ts:35-85](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/file-content-matcher.ts)). Cost is one DB round-trip per changed chapter (545-546).
- `pickProviderChsForVolume` scans all provider chapters once per phantom volume, O(V_phantom x C) in memory, plus a sort (462-467). **Low**: only volumes holding file-backed NULL-number rows are iterated.
- Reconciliation is linear with Set/Map lookups; creates in batches of 50 and updates in transactions of 50 ([phase-chapter-reconciliation.ts:83-144, 185-231](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-chapter-reconciliation.ts)).
- `extractMangaDexChapters` expands every aggregate volume range into per-integer entries (orchestrator 59-70); linear in chapter count but a malformed range (huge `chapterEnd`) would allocate proportionally. **Low**.
- `parseChaptersFromDescription` runs twice per ComicVine volume per run: `enrichComicVineWithChapterList` (orchestrator 248-263) and `extractBonusTitleMap` (265-305). **Low**.
- Repeated full reads: `prisma.chapter.findMany({ where: { mangaId } })` in merge (phase-db-persistence 421-435), reconciliation (phase-chapter-reconciliation 75-78), finalize specials (phase-finalize 107-110); `prisma.volume.findMany` in orchestrator 353, 766, volume-persistence 115, phase-finalize 153 (x3), 699, 752. **Low-Medium**.
- The final `findUnique` with `includeMangaRelations` (phase-finalize 133-136) is followed by another full Volume read for the completeness score (orchestrator 766-769), and `refreshMetaData` may read the whole manga a third time (refresh/index.ts 139-141). **Low**.

### Inferences
- For One Piece-scale titles (about 1,100 chapters, 100+ volumes) the run issues on the order of thousands of single-row statements. A shared per-run snapshot of chapters and volumes, plus set-based SQL for inheritance fills, would cut this by an order of magnitude; I estimate the DB portion is seconds to tens of seconds, small next to network time but material for pool pressure.
- The 30s transaction timeout on the merge is the one place where linear round-trips can become a correctness failure (see Q5).

### Gaps
- Bodies of `phase-volume-reconciliation.ts` (688 lines), `phase-volume-cross-validation.ts` (690), `phase-bonus-reassignment.ts`, `phase-volume-overflow.ts` and `fandom-db-persistence.ts` (678) were not read; quadratic loops there cannot be ruled out.

## Q5. Where can a phase swallow failure or return partial data that later phases treat as authoritative?

### Takeaway
"Provider timed out" and "provider has no match" are the same `null`, and nearly every phase catches and logs its own errors, so a degraded run still deletes all volumes, rebuilds from whatever arrived, and reports success. This is the most important correctness theme in the orchestration layer.

### Cited Findings
- **Critical.** Phase 2 deletes every Volume row for the manga whenever any provider chapter list or count exists (`deleteExistingVolumes` inside the merge transaction) — [phase-db-persistence.ts:54-56, 250-259](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence.ts). The comment says cross-validation "rebuilds volume ranges from all sources" (50-52), but rebuild depends on this run's provider results, which may be null from a 60s timeout.
- **High.** Timeouts are indistinguishable from no-match by design: "Callers branch on null the same way they branch on any other missing-provider-data case" — [with-timeout.ts:4-6](src/server/services/shared/with-timeout.ts). `UnifiedProviderResults` carries no per-provider status ([EP/types.ts:90-184](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types.ts)), and the rejection logging at phase-provider-fetch 386-398 covers thrown errors only.
- **High.** When AniList is null (including by timeout), ComicVine matching proceeds on a title-only stand-in (phase-provider-fetch 327, 1123-1125) and MangaDex keeps its unverified title-only match (311).
- **High.** The Phase 2 transaction failure is swallowed: a timeout or error in the merge is caught and logged as a warning, and `persistVolumes` in the same `try` is skipped ([phase-db-persistence.ts:250-266](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence.ts)); `persistMetadataToDb` likewise only warns on an error result (147-148). The orchestrator continues to Phases 2.5-6.
- **High.** `phaseDbPersistence` returns immediately when there is no `appliedMatch.metadata` (110), yet the orchestrator still runs reconciliation, cover application, Fandom enrichment and all Phase 6 prunes/deletes.
- **Medium.** Scanner result is always null. `runEnrichmentPipeline` returns `{ result: result.enrichmentResult, ... }` (orchestrator 794); the scanner handler casts that to `{ enrichmentResult? }` and returns `unified?.enrichmentResult ?? null` ([scanner/enrichment-handler.ts:34-36](src/server/services/library/scanner/enrichment-handler.ts)). `EnrichmentResult` has no `enrichmentResult` field ([enrichment-result-types.ts:32-43](src/types/domain/enrichment-result-types.ts)), so `scanItem.status = 'enriched'` and `scanItem.metadata` are never set ([scanner.ts:451-459](src/server/services/library/scanner.ts)). The `result: unknown` return type hides this from the compiler ([EP/types.ts:30-35](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types.ts)).
- **Medium.** Lost-update risk on `Manga.providerMetadata`: it is read, modified in memory and written back as a whole blob by many steps, some fire-and-forget and concurrent with awaited ones — `writeFieldReview` ([field-review.ts:42-62](src/server/services/metadata/field-review.ts), launched `void` at phase-provider-fetch 1256), `harvestFandomGalleryDirect` ([phase-fandom-enrichment.ts:237-254](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts)), `storeVolumeCoverData` ([phase-finalize.ts:769-799](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize.ts)), `maybePlausibilityCheck` ([post-enrichment-hooks.ts:144-152](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/post-enrichment-hooks.ts)).
- **Medium.** Feedback loop in the ComicVine fallback. `storeVolumeCoverData` writes the current DB volumes (from any source mix) to `providerMetadata.comicvine.volumeData` and unconditionally sets `importProfile.chapterSource = 'comicvine'` ([phase-finalize.ts:759-794](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize.ts)). `extractComicVineVolumes` later reads that blob back as "stored ComicVine volume ranges" and feeds it to cross-validation as ComicVine proposals (orchestrator 194-232). The fallback requires `comicvineResult.volumeId` to be defined (207-208), so it cannot fire when the API is unavailable, contrary to its log message (226).
- **Medium.** `fandomGated` is inferred from "Fandom result exists with an empty chapter list" (orchestrator 443-444), which is also true when the parser simply found nothing, so Phase 5 is skipped for un-gated wikis with empty Phase 1 parses.
- **Low.** Every finalize helper I read wraps its body in try/catch and logs "non-critical" (e.g. phase-finalize 151-169, 691-717, 747-805); `preWarmCoverCache`, `invalidateCache` and `emitWebSocketUpdate` swallow silently (720-740, 808-824). The pipeline's return value has no warnings list.
- **Low.** The pipeline's progress callback and both tRPC procedures report "completed" regardless of how many phases degraded (refresh/index.ts 143).

### Inferences
- A run during a ComicVine/Wikipedia/Fandom outage can wipe curated volume rows (covers, ISBNs, descriptions, release dates) and leave fewer or none, because the delete is unconditional and the rebuild is best-effort. Estimated impact: data loss on any title enriched during an outage; the manual volume manifest is the only protected path. Suggested fix: carry per-provider status (`ok | no_match | timeout | error`) in `UnifiedProviderResults` and skip destructive steps when a previously contributing source did not answer.
- For a large series the per-row merge inside a 30s interactive transaction can time out, which rolls back the merge and skips volume persistence, yet the run still proceeds and reports success.
- Fire-and-forget `writeFieldReview` racing later awaited whole-blob writes can drop either the review markers or another section; atomic `jsonb_set`-style updates per key would remove the race.
- The stored-volume feedback loop lets a previous run's output re-enter as ComicVine-attributed evidence, which could entrench a wrong range across runs.

### Gaps
- I did not confirm at runtime that any volume loss has occurred; this is derived from code only.
- I did not read `metadataPersistenceService.persistMetadata` or the provenance guards (other researcher's lane), so whether a null-provider run can overwrite good scalar metadata is not assessed here.
- Whether Phase 6 prunes use live provider results or stored signals when Phase 1 returned nothing was not traced into the prune modules.

## Q6. Dead or duplicated orchestration code, oversized files, structural simplifications

### Takeaway
The queue-based metadata path is dead, two phase modules have no importers, the cross-series gate exists in three copies, and 13 files in scope exceed the project's 500-line limit, including the three central orchestration files.

### Cited Findings

Dead or stub code:
- Queue handler for three job types is a stub (see Q3) — [queue/handlers/metadata.ts:20-23, 57-60](src/server/queue/handlers/metadata.ts); it also constructs an unused `MetadataService` at module load.
- `src/server/queue/updateMetadata.ts` still describes a mangal-era update task with the mangal call commented out (lines 53-62).
- No non-test importers found for `EP/phase-agent-application.ts` (230 lines) or `EP/phase-wikipedia-fallback.ts` (106 lines) using a fixed-string search for `/<module>'` across `src` and `scripts`.
- `assembleSourceData` (in `phase-data-assembly.ts`, 545 lines, which also builds gap analysis and source coverage) has exactly one call site, which uses only `expectedChapterCount`, `trustedFinalChapter` and `sources.comicvine` (orchestrator 154-168).
- `_title` parameter is named as unused but is used (orchestrator 540, 651, 658).

Duplication:
- Cross-series gate constants and logic in three places, with a "Keep these mirrored" comment: [phase-provider-fetch.ts:423-473](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts), [pipeline-orchestrator.ts:133-147](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator.ts), [phase-fandom-enrichment.ts:349-365](src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment.ts). The orchestrator copy re-gates a list Phase 1 already blanked.
- Identical phase-to-WebSocket maps in [core.ts:275-288](src/server/trpc/routers/manga/metadataOperations/core.ts) and [refresh/index.ts:50-63](src/server/trpc/routers/manga/metadataOperations/refresh/index.ts).
- `fetchMangaDexDirect` and `buildMangaDexDirectResult` build the same object twice (phase-provider-fetch 835-855 vs 863-883).
- Two re-export shims for the same function: `EP/../enrichment-pipeline.ts` and `EP/index.ts`.
- Phantom pruning runs in four places per reidentify: orchestrator 695-708, `prunePhantomVolumes` in finalize (phase-finalize 51), and `removePhantomArtifacts` after the pipeline (refresh/index.ts 128).

Files over 500 lines (limit per CLAUDE.md), from `wc -l`:

| Lines | File |
|---|---|
| 1434 | `src/server/services/metadata/utils/fandom-table-parser/fandom-volume-parser.ts` |
| 1351 | `EP/phase-provider-fetch.ts` (carries `@file-size-justified`, plus `max-lines`, `max-statements`, `complexity` suppressions at lines 1-7, 104) |
| 824 | `EP/phase-finalize.ts` |
| 795 | `EP/pipeline-orchestrator.ts` (`@file-size-justified`, line 1) |
| 778 | `EP/phase-db-persistence.ts` |
| 750 | `src/server/services/metadata/metadata-persister.ts` |
| 726 | `EP/wiki-discovery.ts` |
| 690 | `EP/phase-volume-cross-validation.ts` |
| 689 | `EP/phase-provider-fetch/enrichment-result-builder.ts` |
| 688 | `EP/phase-volume-reconciliation.ts` |
| 678 | `EP/fandom-db-persistence.ts` |
| 602 | `src/server/services/metadata/chapter-enricher.ts` |
| 597 | `src/server/services/metadata/utils/fandom-table-parser/fandom-chapter-parser.ts` |
| 545 | `EP/phase-data-assembly.ts` |
| 519 | `src/server/services/metadata/provider-matching/core-matching.ts` |

Tests: 20 test files exist under enrichment-pipeline paths, but a search of `tests/` and `src/**/*.test.ts` for `runEnrichmentPipeline`, `withEnrichmentLock` or `phaseProviderFetch` returned no files.

Placement: the pipeline (about 26,000 lines) lives under `src/server/trpc/routers/manga/metadataOperations/`, and services import upward into the router tree ([scanner/enrichment-handler.ts:13](src/server/services/library/scanner/enrichment-handler.ts)).

### Inferences
- The orchestrator, lock, wave logic and timeout behaviour have no direct test coverage, which is consistent with the scanner return-shape bug and the wave-2 null-overwrite going unnoticed.
- Structural simplifications, in rough order of value: (1) a typed `PipelineContext` holding per-provider status, a per-run chapter/volume snapshot and the resolved Fandom URL, passed to every phase; (2) a declarative phase list with name, timeout and criticality instead of ~45 hand-sequenced awaits; (3) move the pipeline to `src/server/services/` and wire the existing queue handler to it so bulk refresh, retries and dedup come from the job system; (4) one shared cross-series gate function; (5) delete the two unimported phase modules and the stub queue path or implement it.
- The `@file-size-justified` argument for `phase-provider-fetch.ts` (shared types would scatter) is weak: the per-provider fetchers at 687-1167 and the selector-claim builders at 1216-1351 share only result interfaces.

### Gaps
- The importer search used single-quoted import strings only; a double-quoted or computed dynamic import of `phase-agent-application` or `phase-wikipedia-fallback` would be missed.
- I did not check whether the pre-commit hook currently exempts `@file-size-justified` files or blocks them.
- I did not audit `src/server/services/metadata/metadataService.ts`, `chapter-enricher.ts` or `providerMatchingService.ts` for being legacy parallel orchestration; their relationship to the live pipeline is unknown.
