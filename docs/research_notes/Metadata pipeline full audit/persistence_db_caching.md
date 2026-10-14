# Persistence, Database and Caching Layer of the Metadata Pipeline

Method: static read of `prisma/schema.prisma`, `prisma/migrations/`, and source under `src/server` (ast-grep inventory of every `prisma.*` / `tx.*` / `backgroundPrisma.*` call). No database was queried; nothing was executed. "Verified" = read directly in the cited lines. "Inference" = reasoning from those lines, not observed at runtime. All row counts, timings and plan claims are estimates, never measurements.

Path abbreviations used in citations:
- `EP/` = `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/`
- `MO/` = `src/server/trpc/routers/manga/metadataOperations/`
- `SVC/` = `src/server/services/`
- `schema` = `prisma/schema.prisma`

Severity scale: CRITICAL (data loss / corruption reachable in normal use), HIGH (wrong data or large avoidable cost), MEDIUM (inefficiency or latent race), LOW (hygiene).

---

## 1. Write path: upserts, N+1 patterns, batching, projections

### Takeaway
The enrichment path issues roughly 300 Prisma call sites across ~60 files, about 50 of them inside loops, and almost all are per-row `update` round trips that could be one set-based statement. The single worst item is `persistNormalizedVolumes`: up to ~14 sequential statements per volume inside one interactive transaction with no timeout override.

### Cited Findings

**W1 (HIGH) — volume-persister is a per-volume N+1 inside one interactive transaction.** Verified.
- Loop body per volume: `findUnique` (no `select`, full row incl. `description`/`summary` text) → `update` or `create` (full row returned, only `id` used) → 5 junction syncs each doing `deleteMany` + `createMany` → 1–2 `chapter.updateMany`. — `SVC/volume-persister/index.ts:361-411`, junction helpers `:142-277`, linker `:283-331`.
- The 5 junction syncs are wrapped in `Promise.all` (`:398-404`) but run on a single transaction connection, so they are serialized anyway; the parallelism is cosmetic.
- No `{ timeout }` is passed to `$transaction` (`:361`, closes `:411`), whereas the sibling chapter merge passes `{ timeout: 30000 }` (`EP/phase-db-persistence.ts:259`).
- Callers: `EP/phase-db-persistence.ts:714` and `src/server/trpc/routers/manga/crud-operations/add-manga-volumes.ts:395`.
- Estimated impact: a 100-volume series ≈ 1,000–1,400 sequential round trips while holding one of the 15 UI-pool connections (see section 4).

**W2 (HIGH) — per-row `update` loops throughout the finalize phase.** Verified call sites (all `await` inside `for`):
- `EP/phase-finalize/volume-wikipedia-fill.ts:98, 129, 179, 255, 304, 402` (`volume.update` per volume) plus per-volume `chapter.aggregate` at `:248` and `:395`, `chapter.count` at `:299`, `chapter.updateMany` at `:278`. Example: `fillVolumePageCountFromChaptersDb` does one `aggregate` + one `update` per volume (`:238-257`); `fillVolumeReleaseDateFromChapters` repeats the same shape (`:385-404`). Each is expressible as a single `UPDATE "Volume" v SET ... FROM (SELECT "volumeId", SUM(pages) ... GROUP BY 1) s`.
- `EP/phase-finalize/volume-id-backfill.ts:175` and `:206` — one `chapter.update` per chapter to set `volumeId` (`:144-179`, `:181-210`); the range match is done in JS (`ranged.find`, `:200-203`). One `UPDATE ... FROM "Volume" WHERE c."chapterNumber" BETWEEN v."chapterStart" AND v."chapterEnd"` replaces up to N round trips (N = chapter count; 1,000+ for long series).
- `EP/phase-finalize/chapter-pages-fill.ts:46`, `chapter-cover-fill.ts:47`, `chapter-title-fill.ts:78` — one `chapter.update` per chapter. Candidates for `UPDATE ... FROM unnest($1::int[], $2::int[])`.
- `EP/phase-finalize.ts:176, 187, 198` (`chapter.updateMany` per volume) and `:711` (`chapter.update` per chapter).
- `EP/pipeline-orchestrator/fandom-volume-fields.ts:87, 108, 129` — three separate `findMany`→per-row `volume.update` loops (`:76-129`).
- `EP/fandom-volume-helpers/assignment-core.ts:79, 142`, `distribution.ts:48, 56`, `sequential.ts:37, 45`, `range-updates.ts:39, 97`, `descriptions.ts:20` — per-chapter / per-volume updates.
- `EP/fandom-db-persistence.ts:140, 213, 226, 375, 546` — per-row/per-volume updates; `:454` batched `createMany`.
- `EP/wikipedia-fallback/db-application.ts:46, 83`; `EP/phase-agent-application.ts:108, 187`; `EP/manual-volume-manifest-sentinel.ts:160, 168`; `MO/refresh/clear-auto-bindings.ts:290`.
- `EP/phase-db-persistence.ts:546` — per-chapter `tx.chapter.update` inside the 30 s transaction; `:441-451` per-phantom update.

**W3 (MEDIUM) — unbounded `Promise.all` of per-row updates on the UI pool.** `EP/pipeline-orchestrator/volume-persistence.ts:131-137` fires one `volume.updateMany` per existing volume concurrently, not in a transaction. Verified. Inference: for a 100-volume title this queues 100 statements against a 15-connection pool at once.

**W4 (MEDIUM) — free-index probing by query loop.** `EP/phase-finalize/ensure-volume-file-rows.ts:133-142` probes `chapter.findFirst({mangaId,index})` in a `while` loop, up to 1,000 iterations, then creates. Verified. One `SELECT max(index)` or `generate_series` anti-join replaces it.

**W5 (MEDIUM) — batched chapter insert is fine, but chunk size is small.** `EP/phase-db-persistence.ts:560-564` uses `createMany({skipDuplicates:true})` in chunks of 50. Verified. A 1,100-chapter title = 22 statements where 1–2 would do.

**W6 (MEDIUM) — missing/oversized projections.**
- `SVC/metadata/metadata-persister.ts:176-179` reads `manga` with `include: { Metadata: true }` and no `select`, pulling `Manga.providerMetadata` and `Manga.rawProviderData` (both `Json`, `schema:186,194`) plus every Metadata column; then re-reads the same thing at `:275-278` after writing. Verified.
- `EP/phase-finalize.ts:133-136`, `EP/wiki-discovery.ts:228`, `EP/wikipedia-fallback/data-fetching.ts:13` use `include` without `select` on `Manga`. Verified (ast-grep).
- `SVC/volume-persister/index.ts:371` full-row `findUnique` where only `id` is used. Verified.
- `SVC/metadata/rawProviderDataService.ts:27-33` selects both JSON blobs, then `:205-217` rewrites `rawProviderData` with `providerMetadata` embedded inside it (`:210`) — the provider-metadata blob is stored twice on the same row. Verified.
- Positive: most other pipeline reads do use `select` (e.g. `EP/phase-db-persistence.ts:422-434`, `EP/phase-provider-fetch.ts:120-123`).

**W7 (LOW) — ParseFailureLog is one `create` per failure.** `SVC/metadata/parse-failure-logger.ts:37`. Verified. Fine at low volume; a noisy parser produces one round trip per failure.

### Inferences
- Total DB statements for one full enrichment of a ~100-volume / ~1,000-chapter title is plausibly in the low thousands, dominated by W1 and W2. This is a count of code paths, not a measurement.
- Replacing W1's body with (a) one `createMany skipDuplicates` + one `findMany` for ids, (b) one `deleteMany({volumeId: {in}})` + one `createMany` per junction table, and (c) one raw range-join `UPDATE` for chapter linking would reduce it to roughly 15 statements regardless of volume count.

### Gaps
- I did not read every loop body; loop membership comes from an ast-grep rule (`await $C.$M.$OP()` inside `for`/`while`), so calls inside `.map(async …)`/`Promise.all` are under-counted (W3 was found by reading).
- `SVC/metadata/chapter-enricher.ts:165/192` and `chapter-enricher/comicvine-enricher.ts:169/177` have update/create pairs that look like per-chapter find-then-write; not read in detail.

---

## 2. Transactions, races, conflict handling

### Takeaway
Only 5 `$transaction` sites exist in the whole enrichment pipeline directory; the dominant pattern is unlocked read-then-write across separate statements. The most serious verified issue is that every chapter-bearing enrichment run deletes all Volume rows for the title (cascading to user volume progress and bookmarks) and re-creates them outside the transaction, with failures downgraded to a warning.

### Cited Findings

**T1 (CRITICAL) — volumes are deleted in one transaction and re-created outside it; cascades hit user data.** Verified.
- `EP/phase-db-persistence.ts:252-259`: transaction = `deleteExistingVolumes` (`:54-56`, `tx.volume.deleteMany({ where: { mangaId } })`) + chapter merge.
- `:263`: `persistVolumes(...)` runs after the transaction has committed.
- `:264-266`: any error is caught and logged as `logger.warn`; the phase continues.
- Schema cascades from `Volume`: `VolumeProgress` `onDelete: Cascade` (`schema:524`), `BookmarkedVolume` `onDelete: Cascade` (`schema:2473`), `VolumeCreator/Character/Theme/Genre/StoryArc` Cascade (`schema:449,462,473,484,496`), `Chapter.volumeId` `onDelete: SetNull` (`schema:99`).
- Consequences: (a) per-user volume reading progress and volume bookmarks for the title are deleted on each such run; (b) every chapter's `volumeId` is nulled and must be re-derived by later backfill phases (the W2 loops); (c) Volume ids churn; (d) if `persistVolumes` or a later phase throws, the title is left with zero volumes and no error surfaced.

**T2 (HIGH) — `skipDuplicates` silently drops provider chapters on index collision and over-reports.** Verified.
- New rows get `index` values derived from `maxIndex` of a snapshot read (`EP/phase-db-persistence.ts:558-559`).
- Insert is `createMany({ skipDuplicates: true })` (`:563`) = `ON CONFLICT DO NOTHING` across every unique constraint on Chapter: `hash` (`schema:74`), `mangadexId` (`:95`), `suwayomiChapterId` (`:96`), partial `(mangaId, chapterNumber)` (`:117`), `(mangaId, index)` (`:120`), and `Chapter_one_null_per_volume` (`prisma/migrations/20260612100000_chapter_one_null_per_volume_partial_index/migration.sql:16-18`).
- Return value is `created: toCreate.length` (`:571`), not the summed `count`.
- Inference: a concurrent scanner / pack import / Suwayomi sync that takes the same `index` between the snapshot and the insert causes the provider chapter to vanish with no log line. The transaction runs at default READ COMMITTED (no `isolationLevel` passed), so the snapshot at `:421-435` is not protected.

**T3 (HIGH) — `Manga.providerMetadata` is a whole-document read-modify-write from many writers with no lock or version.** Verified writers (each reads the JSON, spreads, writes the full document back):
`SVC/metadata/metadata-persister.ts:176→269-272`; `EP/fandom-provider-storage.ts:19→97-100` (also `:123, 199, 225`); `EP/post-enrichment-hooks.ts:121→149-151, 178-180`; `EP/phase-finalize.ts:601→672-674`, `:769→796`; `EP/phase-finalize/volume-cache-writer.ts:99→116`; `EP/phase-fandom-enrichment.ts:237→254`; `EP/manual-volume-manifest-sentinel.ts:218→232`; `SVC/metadata/field-review.ts:44→59-61`; `SVC/metadata/chapter-enricher.ts:399-402`; `SVC/metadata/chapter-enricher/fandom-enricher.ts:214-217`; `MO/provider-metadata.ts:41→177`; `MO/refresh/clear-auto-bindings.ts:412→435`; `MO/refresh/comicvine-volume-scraper.ts:204→265, 273→288`; `MO/core.ts:156→178`.
- Only `metadata-persister` wraps its pair in a transaction (`:174`), and that is READ COMMITTED without `SELECT … FOR UPDATE`, so it does not prevent lost updates either.
- This JSON holds the live provider bindings, manual pins, manual volume manifest and per-field provenance (`metadata-persister.ts:185-234`; `prisma/migrations/20260708000000_add_provider_binding/migration.sql:4-5`). Inference: a user manual-bind or field pin landing mid-enrichment can be overwritten by a phase that read the document earlier, and vice versa.

**T4 (HIGH) — almost no transactional grouping in multi-step phases.** Verified by inventory: `$transaction` appears only at `EP/phase-bonus-reassignment.ts:293`, `EP/phase-chapter-reconciliation.ts:223`, `EP/phase-db-persistence.ts:252`, `EP/phase-volume-phantom-prune.ts:148`, `EP/phase-volume-stub-cleanup.ts:200` (plus `metadata-persister.ts:174`, `volume-persister/index.ts:361`). Files with many dependent writes and none: `EP/fandom-db-persistence.ts` (30 call sites), `EP/phase-finalize.ts` (31), `EP/phase-finalize/volume-wikipedia-fill.ts` (27), `EP/phase-volume-reconciliation.ts` (15), `EP/phase-volume-overflow.ts` (10, including `chapter.deleteMany` at `:173`), `MO/refresh/clear-auto-bindings.ts` (12, including `chapter.deleteMany :238` and `volume.deleteMany :357`). A crash or thrown error mid-phase leaves partially applied volume/chapter state.

**T5 (MEDIUM) — TOCTOU create paths that are not conflict-safe.**
- `EP/phase-finalize/ensure-volume-file-rows.ts:56-59` (find existing NULL-chapterNumber row) → `:136-142` (probe index) → `:143-158` plain `chapter.create`. No transaction, no `skipDuplicates`. Verified.
- The library scanner allocates whole-volume rows with the identical formula `100000 + volume*100` (`SVC/library/scanner/chapter-creator/auto-matcher.ts:232, 305`) as enrichment (`ensure-volume-file-rows.ts:133`). Verified. Inference: scan + enrichment running together contend for the same `(mangaId, index)` slot; the loser throws P2002.
- `EP/manual-volume-manifest-sentinel.ts:145→160/168` (findMany then update/create per volume), `EP/phase-finalize/manga-relation-resolver.ts:71→82/97` (findUnique → create/update), `SVC/metadata/binding-record.ts:70→82` (findFirst → create). Verified call order from the inventory; bodies not read in full.
- `SVC/volume-persister/index.ts:371→389` find-then-create is inside a transaction but at READ COMMITTED; a concurrent creator of the same `(mangaId, number)` makes `create` throw P2002 and aborts the entire all-volumes transaction (`:417-419` rethrows).

**T6 (MEDIUM) — the "conflict-safe Chapter writes" fix (commit `c2447c1a9`) covers three non-enrichment writers only.** Verified from the commit: it changed `src/server/queue/handlers/mangadex-download.ts`, `suwayomi-download.ts`, `SVC/download/fileImporter/chapter-processing.ts`, `SVC/suwayomi/chapter-sync.ts` to `createMany({skipDuplicates:true})` because Prisma cannot express the partial unique index for `upsert`. Enrichment-side plain `chapter.create` sites remain: `ensure-volume-file-rows.ts:143`, `SVC/metadata/chapter-enricher.ts:192`, `SVC/metadata/chapter-enricher/comicvine-enricher.ts:177`. The fix trades error floods for silent no-ops; callers that ignore `count` inherit T2's blind spot.

**T7 (MEDIUM) — `db.transaction` retry logic can never match Prisma error codes.** `src/server/db.ts:325-330` compares `error.message === 'P2034'` / `'P2024'`; Prisma puts the code on `error.code`, and the message is a sentence. Verified text. Effect: only messages containing `deadlock` are retried. (Inference on Prisma error shape from library knowledge, not from this repo.)

**T8 (MEDIUM) — chapter→volume linking mixes three numbering columns.** `SVC/volume-persister/index.ts:293-312` links where `chapterNumber` OR `number` falls in the volume range; fallback `:319-326` links by `Chapter.volume`. `Chapter` carries `index` (`schema:66`), `chapterNumber` (`:82`), `number` (`:89`), `volume` (`:93`), `volumeId` (`:94`). Verified. Inference: a stale `number` value on a row whose `chapterNumber` was corrected can attach it to the wrong volume; only `volumeId: null` rows are touched, so a wrong link is never revisited by this path.

**T9 (LOW) — stale-row deletion inside the merge.** `EP/phase-db-persistence.ts:551-555` deletes "stale PENDING" chapters by id list computed from the snapshot; safe within the tx, but relies on `_count` relations read at `:429-432` that a concurrent download could change before the delete. Inference.

### Inferences
- Concurrent enrichment + library scan + pack import cannot produce duplicate `(mangaId, chapterNumber)` or `(mangaId, index)` rows (DB constraints prevent it) but can produce: silently missing provider chapters (T2), aborted volume persistence (T5), chapters attached to wrong/no volume while T1's delete-and-rebuild window is open, and lost binding/pin edits (T3).
- Whole-volume rows (`chapterNumber IS NULL`, `filePath` set) are outside the `Chapter_one_null_per_volume` guard, which only covers `filePath IS NULL AND packDownloadId IS NULL`; nothing at DB level stops two file-backed NULL-number rows for the same volume.

### Gaps
- Whether anything restores `VolumeProgress`/`BookmarkedVolume` after T1 was not found and not exhaustively searched.
- Whether a per-manga mutex serializes enrichment against scans is an orchestration question owned by another researcher; no DB-level advisory lock was seen in the files read.
- Ghost-row sweep (`cleanupGhostCompletedChapters`) and `pageCountAttempts` (`schema:97`) were not re-verified.

---

## 3. Indexes

### Takeaway
The per-manga Chapter/Volume queries the pipeline issues are covered by existing composite indexes; the problems are redundant indexes (extra write cost on hot tables) and two JSON-expression lookups on `Manga.providerMetadata` for which no supporting index was found.

### Cited Findings

**I1 (LOW–MEDIUM) — redundant indexes (each adds write cost, no read benefit).** Verified in schema:
- `Chapter @@index([mangadexId])` (`schema:125`) duplicates `@unique` (`:95`); `@@index([suwayomiChapterId])` (`:126`) duplicates `@unique` (`:96`).
- `Volume @@index([mangaId])` (`:437`) is a prefix of `@@unique([mangaId, number])` (`:436`).
- `ImageCache @@index([proxyPath])` (`:2454`) duplicates `@unique` (`:2445`).
- `cache_unified` hash index on `cache_key` (`:2753`) duplicates the primary key (`:2737`).
- `MangaRecommendation @@index([fromMangaId])` (`:3075`) is a prefix of the unique (`:3074`).
- `AutoDownloadRule @@index([userId])` (`:1309`) is a prefix of `@@id([userId, mangaId])` (`:1307`).
- `ParserCache @@index([namespace])` (`:575`) is a prefix of `@@unique([namespace, key])` (`:572`); `@@index([size])` (`:576`) has no evident reader.
- `Chapter @@index([mangaId, chapterNumber])` (`:127`) overlaps the partial unique on the same columns (`:117`); it is only non-redundant for `chapterNumber IS NULL` lookups.

**I2 (MEDIUM) — JSON-expression equality on `Manga.providerMetadata` in raw SQL.** `EP/phase-finalize/manga-relation-resolver.ts:58` and `EP/phase-finalize/recommendation-resolver.ts:39, 46` filter `"providerMetadata"->'anilist'->>'providerId' = …` / `->'mal'->>'providerId'`. Verified. No expression index appears in `schema` (Manga indexes: `:234-238`). Inference: sequential scan of `Manga` with detoasting of `providerMetadata` per row, executed per relation/recommendation edge being resolved; cheap at 72 titles, linear in library size.

**I3 (LOW) — `cache_unified` whole-document GIN.** `idx_cache_unified_gin` on `cache_value` (`schema:2752`; created in `prisma/migrations/20250925_redis_like_optimization/migration.sql:28`). No containment (`@>`) or key-exists query on `cache_value` exists in `src/server/cache/UnifiedCacheProvider/core.ts` or `maintenance.ts` (all reads are by `cache_key`; only `->`/`->>` projections at `core.ts:337,352`, `maintenance.ts:204`). Verified for those two files. Inference: the index is pure write overhead on every cache `set`. See C3.

**I4 (covered) — pipeline hot predicates and their indexes.** `where {mangaId}` on Chapter → `(mangaId, index)` unique (`schema:120`); `{mangaId, volume, chapterNumber: null}` (`ensure-volume-file-rows.ts:57`) → `(mangaId, volume)` (`:128`); `{volumeId}` aggregates (`volume-wikipedia-fill.ts:249`) → `(volumeId)` (`:124`); Volume by `(mangaId, number)` → unique (`:436`); ProviderBinding lookups → `(mangaId, provider, createdAt)` / `(mangaId, provider, origin)` (`:3037-3038`); AutoDownloadRule `{mangaId, enabled}` (`post-enrichment-hooks.ts:72-75`) → `(mangaId)` (`:1308`). Metadata array GIN and Manga trigram indexes exist (`prisma/migrations/20260417003253_add_trgm_and_array_search_indexes/migration.sql:21-53`).

**I5 (LOW) — `ImageCache.originalUrl` is unindexed** (`schema:2444`, indexes `:2454-2456`), which is why cleanup materializes the whole table in memory (see C6).

### Inferences
- `Chapter @@index([createdAt])` and `@@index([downloadStatus])` (`schema:121-122`) are low-selectivity single-column indexes on the most-written table; usefulness could only be confirmed from `pg_stat_user_indexes`.

### Gaps
- No `pg_stat_*` or `EXPLAIN` data (DB access was out of scope), so "unused" is not provable here.
- I searched migrations for GIN indexes only; a btree expression index on `providerMetadata` created in an older raw migration would have been missed. Treat I2 as "not found", not "confirmed absent".
- `metadata.findFirst` predicates (e.g. `EP/wiki-discovery.ts:252-329`, `gallery-union.ts:29`) were not read; `Metadata` has no `mangaId` column (the FK lives on `Manga.metadataId`, `schema:174`), so how those lookups are keyed is unverified.

---

## 4. Connection usage and the "two Prisma clients"

### Takeaway
The memory note is stale: `@/lib/prisma` no longer exists and has zero importers. The current duality is `prisma` (15-connection "UI" pool) vs `backgroundPrisma` (5-connection pool), and the enrichment pipeline does not use the background pool at all.

### Cited Findings
- **Stale note (verified).** `src/lib/` contains no prisma module; `from '@/lib/prisma'` has 0 importers; `from '@/server/db'` has 317. The only `new PrismaClient` in `src/` are in `src/server/db.ts` (`EnhancedPrismaClient` `:97-111`, `backgroundPrisma` `:263-266`). The note's "db.ts pools do not enforce UTC" is also outdated: `enforceUtc` is applied to both pools (`db.ts:59-65, 76, 90`).
- **P1 (HIGH) — enrichment runs entirely on the UI pool.** `db.ts:36-40` defines `uiConnectionLimit: 15` "reserved for page requests and tRPC queries" and `backgroundConnectionLimit: 5` for "enrichment pipeline, download monitor"; `db.ts:259-262` repeats that `backgroundPrisma` is "Used by enrichment pipeline". Actual `backgroundPrisma` users: `SVC/fandom/chapter-detail/cache-config.ts:14,37` only (plus the parameter name in `src/server/cache/UnifiedCacheProvider/core.ts:104`). All ~300 enrichment-pipeline call sites use `prisma` (three files alias it as `defaultPrisma`: `EP/manual-binding-sentinel.ts:24`, `EP/manual-volume-manifest-sentinel.ts:24`, `EP/phase-finalize/volume-cache-writer.ts:24`). Verified.
- **P2 (MEDIUM) — long interactive transactions pin UI-pool connections.** `volume-persister/index.ts:361` (unbounded loop, W1) and `phase-db-persistence.ts:252-259` (30 s timeout) each hold one of 15 connections for their duration; W3's `Promise.all` can demand many at once. Inference: a batch re-enrichment can starve tRPC requests — the exact thing the split was built to prevent.
- **P3 (LOW) — inconsistent client features.** `prisma` has query/slow-query event logging and websocket slow-query emission (`db.ts:120-155`); `backgroundPrisma` is a plain client with `log: ['error']` (`:263-266`). Slow queries on the background pool are invisible.
- **P4 (LOW, dev only) — pool leak across hot reloads.** Only the `EnhancedPrismaClient` is cached on `global` (`db.ts:243-252`); `pgPool` (`:70-75`), `backgroundPool` (`:84-89`) and `backgroundPrisma` (`:263`) are module-level and re-created on every module re-evaluation. Inference: each dev HMR reload of `db.ts` leaks up to 5 (+15 idle-capable) connections until `idleTimeoutMillis: 30_000` reaps them.
- **Pool totals (verified):** 15 + 5 = 20 connections per server process, same `DATABASE_URL`; `connectionTimeoutMillis` 20 s for both.
- `scripts/lib/standalone-prisma.ts:35` is a third, script-only client (expected; matches the standalone-script memory note).

### Inferences — concrete consolidation path
1. Decide the pool by execution context, not by import: export a `getDb()` that returns `backgroundPrisma` when running inside a queue worker / enrichment run (AsyncLocalStorage flag set by the pipeline orchestrator) and `prisma` otherwise; or simply pass a `db` handle into the pipeline entry point and thread it (the three `defaultPrisma` files already accept an injected client).
2. Give `backgroundPrisma` the same event listeners (extract `setupEventListeners` into a function applied to both).
3. Cache both pools and both clients on `globalThis` in development.
4. Re-size after step 1: enrichment concurrency × (1 tx connection + burst) must fit in the background pool; W3-style `Promise.all` bursts must be batched first or 5 connections will queue.
5. Fix `db.transaction` to test `error.code` (T7) and make it pool-aware.

### Gaps
- Queue workers, download monitor and pack import were not audited for which client they use.
- Postgres `max_connections` and whether multiple app processes share the DB were not checked.

---

## 5. Caching: `cache_unified`, in-run memoization, `ImageCache`

### Takeaway
`cache_unified` does a full-table `COUNT(*)` on every `set`, a write on every tracked `get`, carries a whole-document GIN index nobody queries, and has a namespace/primary-key mismatch that can cause permanent misses. Within one enrichment run, `Manga.providerMetadata` is re-read from Postgres by at least 33 separate call sites with no run-scoped memo.

### Cited Findings

**Schema and key design (verified).** `cache_unified`: PK `cache_key` only; `cache_value Json`; `namespace` nullable default `'default'`; `expires_at`, `access_count`, `access_frequency`, `last_accessed_at`, `tags[]`, `size_bytes` (`schema:2736-2757`). Keys over 255 chars are SHA-256 hashed (`core.ts:115-128`). Defaults: TTL 3600 s, max 100,000 entries (`core.ts:85-87`). Made LOGGED on 2026-07-05 (`prisma/migrations/20260705120000_persist_cache_unified/migration.sql:12`).

**C1 (HIGH) — every `set` runs `SELECT COUNT(*) FROM cache_unified`.** `core.ts:271` calls `evictIfNeeded`, which counts the full table (`maintenance.ts:24-26`) before each upsert. Verified. Estimated impact: O(table) work per cache write; at tens of thousands of rows this dominates the write. Eviction removes 10% ordered by `access_frequency, last_accessed_at` (`maintenance.ts:30-44`) and explicitly skips expired rows (`:38`), so expired entries are only removed by `clearExpiredEntries` (`:58-63`).

**C2 (HIGH) — tracked reads are writes.** `get` = `SELECT` (`core.ts:164-177`) + `UPDATE … access_count, last_accessed_at, access_frequency` (`:194-202`) unless `skipAccessTracking` is passed (`:189-191`). Only two callers pass it: `SVC/comicvine/modules/multiTierCache.ts:352` and `src/server/trpc/routers/home/anilist-stale.ts`. Verified. Because `access_frequency` and `last_accessed_at` are indexed (`schema:2754`), the update cannot be a heap-only (HOT) update, so each tracked read also writes new entries into every index on the table including the GIN (inference from Postgres semantics). Since the table became LOGGED, all of this is WAL-logged.

**C3 (MEDIUM) — index set is write-hostile for a KV cache.** Six indexes (`schema:2751-2756`) incl. whole-value GIN (I3) and a hash duplicate of the PK. Verified.

**C4 (HIGH, correctness) — namespace is filtered on read but not part of the key.** Reads/deletes filter `cache_key = $1 AND namespace = $2` (`core.ts:37-38, 168-169, 174-175, 200, 307-308`); writes upsert `ON CONFLICT (cache_key)` and the `DO UPDATE SET` list does not include `namespace` (`core.ts:273-288`). Verified. Consequence: if the same key string is ever written under two namespaces, the row keeps the first namespace, the second namespace's `get` misses forever, and every miss triggers a re-fetch + rewrite. `incr`, `expire`, `hset`, `hget` ignore namespace entirely (`core.ts:331-355, 376-380`; `maintenance.ts:178-185, 203-217`).

**C5 (HIGH, correctness) — `hashSet` SQL uses `??` where JSONB concatenation `||` is required.** `maintenance.ts:182`: `cache_value = cache_unified.cache_value ?? jsonb_build_object(...)`. Verified text. `??` is not a Postgres JSONB operator; the statement should error on conflict (update path), be caught at `:187-189`, and return `false`. Inference: looks like a `||`→`??` lint autofix applied inside a SQL template. Affected callers: ComicVine `MultiTierCache` hot tier (`SVC/comicvine/modules/multiTierCache.ts:404, 418`). Not runtime-confirmed.

**C6 — `ImageCache` (verified unless noted).**
- Cover bytes stored in Postgres: `imageData Bytes` (`schema:2446`), plus a `metadata Json` that stores the full upstream response header map per image (`src/pages/api/image-proxy/[...path].ts:213-221`).
- Read path: `findUnique({ where: { proxyPath } })` with no `select` (`:159-161`) then a fire-and-forget `update lastAccessed` on every hit (`:164-167`) — one write per image view.
- Write path: fire-and-forget `create` with no conflict handling (`:205-222`); two concurrent first requests for the same image race on `proxyPath @unique` (MEDIUM; inference: P2002 logged, harmless but noisy).
- Eviction: daily 03:00 UTC cron (`SVC/image-cache/ImageCacheCleanupService.ts:153-154, 174-180`). Orphan detection loads all Metadata art fields (`:62-70`) and all `ImageCache` `(id, originalUrl)` rows (`:109-111`) into memory and diffs in JS. Size cap is disabled by default (`IMAGE_CACHE_MAX_ENTRIES` default `0`, `:153`; `:119`).
- **C6a (MEDIUM) — referenced set is Metadata-only.** `getReferencedUrls` reads only `Metadata.cover*`, `bannerImage`, `galleryImages` (`:61-88`). `Volume.coverImage` (`schema:406`) and `Chapter.coverImage` (`:83`) are not consulted. Inference: if volume/chapter covers are served through the image proxy, they are classified as orphans and deleted nightly, then re-downloaded on next view. Whether those URLs go through the proxy was not verified.
- Cost implication (inference): with no cap, table size grows with library size × art variants; bytes live in TOAST, inflate `pg_dump`/backup size and WAL, and are served through a Node API route on the UI pool.

**C7 (MEDIUM) — no in-run memo for hot rows.** The ast-grep inventory shows 33 `prisma.manga.findUnique` call sites inside `EP/` (56 including `MO/` and `SVC/metadata`), most selecting `providerMetadata` (e.g. `EP/phase-provider-fetch.ts:120-123, 1014-1017`, `EP/fandom-provider-storage.ts:19-22`, `EP/pipeline-orchestrator/volume-persistence.ts:103-106`). `volume.findMany({where:{mangaId}})` and `chapter.findMany({where:{mangaId}})` are likewise re-issued by nearly every phase file (see call map in section 1 citations). Verified as call sites; how many execute per run depends on control flow. A run-scoped context object holding `{manga, providerMetadata, volumes, chapters}` with explicit invalidation on write would remove most of these and also shrink T3's race window.

**C8 — what on the enrichment path actually uses `cache_unified` (verified).** Fandom chapter-detail cache: L1 500 entries / 5 min, L2 24 h, namespace `fandom:chapter-details`, on the background pool (`SVC/fandom/chapter-detail/constants.ts:18-26`, `cache-config.ts:29-38`). ComicVine `MultiTierCache` L2 (`multiTierCache.ts:352-418`). The Wikipedia extractor imports the provider as `_cacheProvider` (`SVC/wikipedia/wikipedia/manga-extractor/index.ts:15`) — the underscore alias suggests it is unused there (inference). Non-enrichment heavy user: the tRPC rate limiter uses `incr` on this table (`src/server/trpc/middleware.ts:141`), i.e. an advisory-locked, WAL-logged upsert per request (`core.ts:331-355`), and `incr`-created rows have no `expires_at` (`core.ts:345-349`).

### Inferences
- Per-enrichment cache cost for a title with N Fandom chapter-detail misses ≈ N × (`COUNT(*)` + upsert maintaining 6 indexes). Batched `setMany` and a sampled/periodic eviction check would cut this to near-constant.
- Simplest robust fix for C4: make the PK `(namespace, cache_key)` (or prefix keys with namespace in `normalizeKey`).

### Gaps
- No scheduler call to `clearExpiredEntries` was found in the lines read (`schedulers-initializer.ts` matches were image-cache and calendar only); `PostgresCacheProvider.ts:120` exposes `clearExpired()` but its trigger was not traced. Expired-row accumulation is therefore unconfirmed.
- Actual table sizes, hit rates and bloat are unknown (no DB access).
- `HotDataCacheProvider.ts` (538 lines) and `hot-promotion.ts` were not read.
- AniList stale-while-error path (`anilist-stale.ts`) not re-verified beyond its use of `skipAccessTracking`.

---

## 6. Schema drift

### Takeaway
The `AutoDownloadRule.userId` P2022 is not a schema-vs-code mismatch in the repository; schema, migration and code agree, so it indicates a database where migration `20260619210000_per_user_operational` has not been applied. Real in-repo drift exists around `cache_unified` and raw-SQL-only indexes.

### Cited Findings
- **D1 (MEDIUM) — AutoDownloadRule.** Schema has `userId` and `@@id([userId, mangaId])` (`schema:1291, 1307`); the migration adds the column, backfills, and re-keys (`prisma/migrations/20260619210000_per_user_operational/migration.sql:74-98`); the original table was keyed by `mangaId` alone (`prisma/migrations/20251212000001_consolidate_schema_drift/migration.sql:804-818`). Code selects `userId` (`EP/post-enrichment-hooks.ts:72-75`). The failure is swallowed as `logger.warn` (`:83-85`). Verified. Inference: on a DB missing that migration, post-enrichment auto-download silently never fires.
- **D2 (MEDIUM) — startup schema-ensurer contradicts the durability migration.** `src/server/startup/initializers/schema-ensurer.ts:82-111` creates `cache_unified` as `UNLOGGED` with only two indexes (`expires`, `namespace`) when the table is missing, while the migration chain makes it LOGGED and `schema:2751-2756` declares six indexes. Verified. Inference: any environment where the ensurer creates the table (fresh DB before/without migrations) gets a non-durable cache with a different index set. CLAUDE.md's "Use Redis-like UNLOGGED tables for caching" and the comment at `src/server/trpc/middleware.ts:141` are stale for this table.
- **D3 (LOW) — constraints that exist only in raw SQL.** `Chapter_one_null_per_volume` is created by migration only (`20260612100000…/migration.sql:16-18`) and is not representable in `schema`; the schema comment (`schema:118-119`) still says it is applied out-of-band via psql from `prisma/migrations/chapter_one_null_per_volume.sql`, which the migration header says was folded into the chain. `prisma db push` / `migrate diff` will see this as drift.
- **D4 (LOW) — `ProviderBinding` has no foreign key and no uniqueness.** Schema has no relation to `Manga` (`schema:3018-3039`); the migration creates no `REFERENCES` (`20260708000000_add_provider_binding/migration.sql:7-23`). Verified. Deleting a Manga leaves binding/rejection rows behind; duplicate active rows for the same `(mangaId, provider, providerId, origin)` are possible (see T5).

### Gaps
- Which environment produced the P2022 (dev vs prod) cannot be determined without DB access.
- I did not diff every model against the migration chain; only models on the enrichment path were checked.

---

## 7. Data-model issues that harm accuracy

### Takeaway
Provenance exists but is stored as JSON on a different table from the values it describes, and only for series-level Metadata; Volume has one row-level `source` that is never updated, and Chapter has none. Several facts are stored two to four times and kept in sync by backfill phases.

### Cited Findings
- **M1 (HIGH) — per-field provenance lives in `Manga.providerMetadata.metadataProvenance` (JSON), not beside the Metadata columns.** Written at `SVC/metadata/metadata-persister.ts:225-234, 269-272`; alternatives in `Metadata.fieldAlternatives Json` (`schema:363`); per-run summary in `MetadataSelectionAttempt` (`schema:2987-3009`). Because it shares the document with bindings and pins, it is exposed to T3 lost updates, and it cannot be joined or constrained in SQL.
- **M2 (HIGH) — Volume provenance is row-level and frozen at creation.** `source/sourceId/sourceUrl` (`schema:414-416`) are set on create (`volume-persister/index.ts:88-90`) but `mapEnhancedVolumeToUpdate` omits `source` and `sourceId` (`:112-136`), so a row created by one provider and later overwritten field-by-field by others still reports the first source. And T1 deletes all volumes each run, so `source` mostly reflects whichever writer ran last after the wipe. Chapter has no source/provenance column at all (`schema:63-129`).
- **M3 (MEDIUM) — duplicated count/number fields.** Chapter: `pages` and `pageCount` (`schema:76, 91`), both written with the same value (`EP/phase-db-persistence.ts:414-415`; `EP/phase-finalize/chapter-pages-fill.ts:41-43`); `index` / `chapterNumber` / `number` (`:66, 82, 89`); `volume` / `volumeId` (`:93-94`). Volume: `chapterStart` / `chapterEnd` / `totalChapters` (`:409-411`) vs actual linked chapters; `pageCount` (`:403`) vs sum of chapter pages. Series: `Metadata.chapters` / `Metadata.volumes` (`:316, 318`) vs row counts, plus `rawProviderData.totalVolumes` (`SVC/metadata/rawProviderDataService.ts:209`).
- **M4 (MEDIUM) — denormalized counters are reconciled by dedicated backfills,** which is direct evidence they drift: `EP/phase-finalize/chapter-count-backfill.ts:21-38`, `volume-count-backfill.ts:29-38` (`volume.count` → `metadata.update`), `volume-wikipedia-fill.ts:238-257` (Volume.pageCount from chapters), `volume-id-backfill.ts` (volumeId from `volume`/ranges). Any writer outside the enrichment run (scanner, pack import, downloads) changes rows without re-running these.
- **M5 (MEDIUM) — large JSON on the hot `Manga` row.** `providerMetadata`, `rawProviderData`, `monitoringConfig`, `suwayomiPluginConfig` (`schema:186-188, 194`); `rawProviderData` embeds a second copy of `providerMetadata` (`rawProviderDataService.ts:210`). Any un-projected `Manga` read pays for it (W6).
- **M6 (LOW) — nullable semantics.** `Chapter.title` is non-null `VarChar(255)` (`schema:69`) so whole-volume rows store `''` (`ensure-volume-file-rows.ts:150`); `Chapter.updatedAt` and `Manga.updatedAt` lack `@updatedAt` (`schema:71, 184`) and must be set by hand (e.g. `phase-db-persistence.ts:417, 544`), so raw/`updateMany` writers that forget leave stale timestamps. Volume number is `Int` (`schema:392`), so fractional/special volumes cannot be represented.

### Inferences
- A normalized `FieldProvenance(entityType, entityId, field, provider, confidence, manual, updatedAt)` table (or per-entity JSONB column on Metadata/Volume/Chapter themselves) would remove M1/M2 and take provenance out of the T3 blast radius.
- Counts that can be derived (`Metadata.volumes`, `Volume.totalChapters`, `Volume.pageCount`) should either be views/computed at read time or be explicitly labelled "provider-claimed" vs "owned", since the two meanings are currently mixed in one column.

### Gaps
- Merge/consensus logic that decides the values is out of scope (other researcher); only storage shape was reviewed.
- `Metadata` `///` doc comments were filtered from my read; field-level intent notes there were not reviewed.

---

## 8. Files over 500 lines and duplicated persistence helpers

### Takeaway
Nine files on the persistence path exceed the project's 500-line commit limit, and volume upsert, chapter-to-volume linking and chapter index allocation are each re-implemented in five or more places with different conflict semantics.

### Cited Findings
**Over 500 lines (verified with `wc -l`):**
- `EP/phase-provider-fetch.ts` — 1,351
- `EP/phase-finalize.ts` — 824
- `EP/pipeline-orchestrator.ts` — 795
- `EP/phase-db-persistence.ts` — 778
- `SVC/metadata/metadata-persister.ts` — 750
- `EP/wiki-discovery.ts` — 726
- `EP/phase-volume-cross-validation.ts` — 690
- `EP/phase-provider-fetch/enrichment-result-builder.ts` — 689
- `EP/phase-volume-reconciliation.ts` — 688
- `EP/fandom-db-persistence.ts` — 678
- `SVC/metadata/chapter-enricher.ts` — 602
- `EP/phase-data-assembly.ts` — 545
- `src/server/cache/HotDataCacheProvider.ts` — 538
- At the limit: `EP/fandom-mediawiki-fallback.ts` and `EP/phase-provider-fetch/mangaupdates-fetch.ts` (500 each); `SVC/volume-persister/index.ts` 492; `UnifiedCacheProvider/core.ts` 457.

**Duplicated helpers (verified call sites):**
- *Volume create/update* — seven implementations: `SVC/volume-persister/index.ts:361-394` (find→update/create in tx); `EP/pipeline-orchestrator.ts:353-390` (findMany→createMany→updateMany); `EP/pipeline-orchestrator/volume-persistence.ts:115-137` (createMany skipDuplicates + parallel updateMany); `EP/fandom-volume-helpers/volume-creation.ts:42-62`; `EP/phase-volume-reconciliation.ts:375-390, 461`; `EP/fandom-db-persistence.ts:645-657`; `EP/manual-volume-manifest-sentinel.ts:145-168`.
- *Chapter→volume linking* — `SVC/volume-persister/index.ts:283-331`; `EP/phase-finalize/volume-id-backfill.ts:64-206` (four strategies); `EP/phase-finalize.ts:153-198`; `EP/phase-volume-reconciliation.ts:469, 655-664`; `EP/wikipedia-fallback/volume-ranges.ts:65`; `EP/phase-finalize/link-archive-covered-chapters.ts:29`; `EP/fandom-db-persistence.ts:178-226, 622-674`; `EP/special-chapter-placement.ts:67, 112`.
- *Chapter index allocation* — `EP/phase-db-persistence.ts:558` (max of snapshot); `EP/fandom-db-persistence.ts:422` and `EP/phase-bonus-reassignment.ts:174` (`chapter.aggregate`); `EP/phase-finalize/ensure-volume-file-rows.ts:133-142` (`100000+vol*100` probe loop); `SVC/library/scanner/chapter-creator/auto-matcher.ts:232, 305` (same formula, no probe); `SVC/download/fileImporter/chapter-processing.ts:344-345` (max index query).
- *Transaction client type* — declared separately at `SVC/volume-persister/index.ts:39`, `EP/phase-db-persistence.ts:46`, inline in `src/server/db.ts:303`, and a type-guard module at `src/utils/type-guards/adapters/native-download/modules/prisma-transaction.ts`.
- *Metadata count backfill* — `Metadata.chapters`/`volumes` written from `chapter-count-backfill.ts:38`, `volume-count-backfill.ts:38`, `phase-finalize.ts:385, 423, 501`, `volume-wikipedia-fill.ts:224, 381`, `chapter-enricher.ts:207, 346`, `comicvine-enricher.ts:190`, `fandom-enricher.ts:161`, `fandom-db-persistence.ts:505`.

### Inferences
- A single `ChapterRepository` / `VolumeRepository` (set-based upsert, one linking routine, one index allocator backed by a per-manga advisory lock or a sequence-like `max()+1` inside the insert statement) would resolve W1–W4, T2, T5 and most of T4 together, and is the natural place to add conflict-count checking.

### Gaps
- Line counts are whole-file (including comments); the commit hook's exact counting rule was not checked.
- Test coverage of these writers under `tests/` was not reviewed.

---

## Severity summary (for the report writer)

| ID | Severity | One-line finding | Primary evidence |
|----|----------|------------------|------------------|
| T1 | CRITICAL | Enrichment deletes all volumes (cascading to user volume progress/bookmarks), rebuilds outside the tx, swallows failure | `EP/phase-db-persistence.ts:54-56, 252-266`; `schema:524, 2473` |
| T2 | HIGH | `skipDuplicates` insert silently drops chapters on index collision; reports wrong count | `EP/phase-db-persistence.ts:558-571` |
| T3 | HIGH | `providerMetadata` whole-document read-modify-write from 15+ writers, no locking | list in T3 |
| T4 | HIGH | Only 5 transactions across ~300 pipeline DB call sites | list in T4 |
| W1 | HIGH | volume-persister: ~14 statements per volume in one un-timed interactive tx | `SVC/volume-persister/index.ts:361-411` |
| W2 | HIGH | ~50 per-row update loops in finalize/fandom phases | list in W2 |
| P1 | HIGH | Enrichment uses the 15-conn UI pool; background pool has one consumer | `src/server/db.ts:36-40, 259-266`; `cache-config.ts:37` |
| C1 | HIGH | `COUNT(*)` of cache table on every cache write | `core.ts:271`; `maintenance.ts:24-26` |
| C2 | HIGH | Tracked cache reads issue a WAL-logged UPDATE touching all indexes | `core.ts:194-202`; `schema:2751-2756` |
| C4 | HIGH | Namespace filtered on read, absent from PK/upsert → permanent misses | `core.ts:168-175, 273-288` |
| C5 | HIGH | `hashSet` SQL uses `??` instead of `||` | `maintenance.ts:182` |
| M1/M2 | HIGH | Provenance in JSON on another table; Volume source frozen; Chapter has none | `metadata-persister.ts:225-272`; `volume-persister/index.ts:112-136` |
| D1 | MEDIUM | P2022 = unapplied migration, swallowed as warn | `post-enrichment-hooks.ts:72-85`; migration `20260619210000:74-98` |
| D2 | MEDIUM | schema-ensurer recreates cache table UNLOGGED with 2 of 6 indexes | `schema-ensurer.ts:82-111` |
| T5/T7/T8 | MEDIUM | Non-conflict-safe creates; dead retry branch; mixed numbering columns in linker | cited above |
| C6a/C7 | MEDIUM | Image orphan check ignores Volume/Chapter covers; no in-run memo (33 `manga.findUnique` sites) | cited above |
| I1–I3 | LOW–MEDIUM | 8+ redundant indexes; unindexed JSON-expression lookups; unused GIN | cited above |
