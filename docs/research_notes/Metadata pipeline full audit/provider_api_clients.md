# Structured-API provider clients (AniList, MangaDex, Kitsu, Jikan/MAL, MangaUpdates, ComicVine)

Conventions used in these notes
- Paths are relative to the repository root. `PPF` = `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch.ts`; `PPF/` = the sibling directory `.../enrichment-pipeline/phase-provider-fetch/`.
- **[V]** = verified by reading the code at the cited lines. **[I]** = inference from verified code (not executed/measured). **[DOC]** = provider documentation. **[U]** = from my own background knowledge, NOT verified against a source in this session (treat as a lead, not a fact).
- Nothing was executed: no enrichment run, no DB access, no provider API calls. All request counts are derived from code paths, not measured.
- Severity: High = wrong data persisted or systematic failure/ban risk; Med = material waste or missing data; Low = hygiene.
- Default-enabled set: the code comment says all providers are on by default except `mal` and `kitsu` (PPF:65-66) [V comment; the actual defaults live in `src/lib/metadata/provider-registry.ts`, not re-read].

Top findings (ranked)
1. **AniList `externalLinks` is never fetched by the details query, so every consumer reads `undefined`** (High, accuracy + wasted discovery). `GET_MANGA_DETAILS` (`src/server/services/anilist/queries.ts:118-237`) has no `externalLinks` selection; the pipeline keeps only `details` (PPF:746-757). Consumers: Fandom direct-URL rediscovery (PPF:280-288), `extractAniListExternalLinks` (PPF/enrichment-result-builder.ts:373-383), selector claim (`src/server/services/metadata/selectors/collect-candidates.ts:139,145-152`). The search query DOES request them (`src/server/services/anilist/modularQueries.ts:648-655`, requested at `src/server/services/anilist/service.ts:521`) and then the result is discarded.
2. **AniList limiter is tuned for 90/min while the API is documented as degraded to 30/min; 429 handling ignores `Retry-After` and retries inside the 1-minute lockout** (High). See Rate limiting.
3. **Status selector only ever sees AniList + MangaDex.** MAL, MangaUpdates and Kitsu statuses are fetched but never put in a claim, so the `status` authority weights for MAL (0.95) are inert in the live pipeline (High, accuracy). See Extraction.
4. **`AniListService.initialize()` replaces the singleton client's internals on every enrichment when OAuth credentials are configured**, wiping the 1 h response cache and the rate-limiter window (High when credentials are set; otherwise not triggered). `src/server/services/anilist/service.ts:396-404`, called from PPF:691.
5. **MangaDex chapter catalogue: all-language `/chapter` paging at 100/page, capped at 50 pages, sorted ascending** — up to 50 serial requests per title and silent truncation of the *latest* chapters for heavily translated series; any page failure discards the whole list at `debug` level (Med/High). `PPF/mangadex-chapter-list.ts:28-29,135-147,187-193`.
6. **MangaDex re-verification always re-searches every AniList title + synonym (uncapped), even when the wave-1 match already carries `links.al` equal to the AniList id** (Med, 4-12 wasted requests/title). PPF:889-924.
7. **No persistent or negative caching on any structured client in the enrichment path; `forceRefresh` reaches none of them** (Med). `cache_unified` is used only by home/discovery routers and AniList health.
8. **MangaUpdates `latest_chapter` is treated as a total chapter count and the free-text `status` (which carries volume/chapter totals) is never parsed** (Med, accuracy).
9. **No retries at all for MangaDex, MangaUpdates, Kitsu; Jikan and AniList retry only on 429.** Failures are flattened to `[]`/`null`, indistinguishable from "no match" (Med).
10. **Kitsu's stated value-add (categories) and its ID `mappings` are never requested** (no `include=`), and a wrong wave-1 Kitsu match is never re-verified against AniList (Med).
11. **ComicVine: response cache is commented out ("TEMPORARY: BYPASS CACHE TO DEBUG ISSUE"), the HTTP client has no timeout, and rate-limit handling is broken** — a JSON rate-limit reply sleeps 60 s then fails; an HTTP 429 blocks the in-process limiter for an hour because `Retry-After` is never passed (High). `src/server/services/comicvine/comicvine/http-client.ts:427-435, 467-470, 529-532, 190`; `src/server/services/comicvine/service.ts:173-182`. Details in the ComicVine section.
12. **ComicVine `issue_number` is parsed with `parseInt`**, collapsing decimal issues and dropping issue 0/specials (High for affected series). `PPF/comicvine-volume-mapper.ts:54`; `PPF/enrichment-result-builder.ts:570-580`.

---

## Per provider: endpoints/queries, requests per title enrichment, and what could be batched, merged or eliminated

### Takeaway
A default enrichment costs roughly 2-3 AniList + 8-25 MangaDex (up to ~60+ for heavily translated series) + 2 MangaUpdates requests plus ComicVine (see ComicVine sub-section), all derived from code. The largest avoidable costs are MangaDex chapter paging and re-verification searches, the AniList search→details double fetch, and uncapped alt-title search fan-out in MangaDex/MangaUpdates/Kitsu.

### Cited Findings

Orchestration shape
- Wave 1 runs AniList, MangaDex, Fandom, Wikipedia, MangaUpdates, Kitsu in parallel, each wrapped in a 60 s `withTimeoutOrNull` (PPF:146-161) [V]. Wave 2 runs six verify/retry steps concurrently (PPF:253-364) [V]; MAL runs after wave 2 (PPF:401-405) [V]. ComicVine is only discovered in wave 2 (PPF:148-152, 325-331) [V].
- `withTimeoutOrNull` does not cancel the underlying work; it just stops awaiting (`src/server/services/shared/with-timeout.ts:8-31`) [V]. Timed-out provider calls keep consuming rate-limit budget in the background [I].

AniList (GraphQL, `https://graphql.anilist.co`)
- Pinned/bound id path: 1 request, `GET_MANGA_DETAILS` by id (PPF:661-674; `service.ts:609-627`) [V].
- Title path: `searchManga(stripped title, {limit:5, includeDescription:true})` (PPF:703-707), an optional second search with a shortened query when fewer than 3 hits (PPF:708-719), then `getMangaDetails(bestId)` (PPF:746) → **2-3 requests** [V]. If the search returns nothing, one more details call for the previous binding id (PPF:734) [V].
- The "search" query already selects title, description, coverImage, status, format, chapters, volumes, genres, synonyms, averageScore, popularity, idMal, bannerImage, start/endDate, tags, staff (perPage 10), countryOfOrigin, isAdult, source, externalLinks (`service.ts:499-522`; `modularQueries.ts:580-672`) [V]. The follow-up details query adds only: meanScore, siteUrl, characters, relations, recommendations, fuller staff (`queries.ts:118-237`) [V]. → **Merge**: add `relations`/`recommendations` to the search selection (or use one document with `Page{media(search)}` + the detail fragment) and drop the second request: saves 1 request and ≥1.5 s of limiter spacing per unpinned title [I].
- Over-fetch: `characters(sort: ROLE, perPage: 10)` with image/description/gender/age (`queries.ts:165-183`) and staff `image`/`description`/`primaryOccupations` (`queries.ts:184-201`). No use of `characters` was found in `PPF/enrichment-result-builder.ts` (text search for `characters` returned no hits there) [V for that file; other consumers of `AniListMangaDetails` not exhaustively checked]. `staff` has no `perPage`/`sort` in the details query (`queries.ts:184`) whereas the search variant uses `staff(sort: RELEVANCE, perPage: 10)` (`modularQueries.ts:631`) [V].
- Batching: no alias-based multi-ID batching is used on the enrichment path; each manga is a separate POST (`service.ts:612-615`) [V]. `src/server/services/anilist/batchOperations.ts` (256 lines) exists but is not imported by PPF [V: PPF imports at lines 24-59]. For library sweeps, `Page{ media(id_in: [...]) }` would fetch up to 50 bound titles per request [U: AniList `id_in` argument and perPage max 50].
- Adult filter: when the per-user setting `anilist.filterAdultContent` is true (default true on error), search sends `isAdult: false` (`service.ts:483-534`) [V] — adult titles cannot be matched by search at all; they resolve only via a pinned id [I].

MangaDex (`https://api.mangadex.org`, vendored client `packages/mangadex-ts-client`)
- Wave 1 (`fetchMangaDexDirect`, PPF:816-856): `GET /manga?title=…&contentRating[]=safe,suggestive,erotica&limit=10` (`packages/mangadex-ts-client/src/providers/mangadex/client.ts:200-208`) [V]; then in parallel `GET /manga/{id}/aggregate` with no language filter (`PPF/mangadex-aggregate.ts:79`) and paged `GET /chapter?manga={id}&limit=100&offset=…&order[chapter]=asc` (`PPF/mangadex-chapter-list.ts:135-147`) [V].
- Search sends no `order[relevance]` and no `includes[]` (client.ts:200-208; call site PPF:819 passes only `{ title }`) [V]. A survey script in the repo does pass `order[relev…` explicitly (`scripts/surveys/lookup-binding-candidates.ts:190`) [V]. Whether MangaDex defaults to relevance ordering when `title` is supplied was not confirmed [gap].
- No `includes[]=author&includes[]=artist&includes[]=cover_art` on search → relationships arrive unexpanded; `MangaDexDirectResult` has no author/artist/cover fields (PPF:768-790) [V]. `getManga()` in the client defaults to those includes (client.ts:210-217) but the pipeline never calls it [V].
- Chapter paging: 100 rows/page, max 50 pages = 5,000 rows, across **all** translated languages and all scanlator uploads (`mangadex-chapter-list.ts:28-29,126-147`) [V]. File header states the `/chapter` endpoint rejects limit >100 "Non-feed limit query param may not be >100" (`mangadex-chapter-list.ts:9-12`) [V]. MangaDex docs: page size max 100, "500 for a handful of feed endpoints"; `offset + size > 10.000` rejected — [MangaDex limitations](https://api.mangadex.org/docs/2-limitations/) [DOC]. → **Switch to `GET /manga/{id}/feed` with `limit=500`**: 5× fewer requests for the same rows [I; the docs page does not name the feed endpoint explicitly, so confirm that `/manga/{id}/feed` is one of the 500-limit endpoints].
- Wave 2 (`verifyMangaDexWithAniList`, PPF:889-924): runs whenever AniList matched (PPF:310-315). It issues one search **per distinct title**: original + romaji + english + native + every synonym ≥3 chars, serially, uncapped (PPF:893-913) [V]. Only afterwards does it compare ids and keep `existing` if identical (PPF:921) [V]. → **Eliminate**: `existing.externalIds.al` is already in hand (PPF:849); if it equals `anilist.id`, skip all searches. Otherwise stop at the first query whose results contain a `links.al` match (`PPF/mangadex-matcher.ts:33-38`) [I]. Saves ~4-12 requests per title in the common case.
- If wave 2 picks a different manga, aggregate + full chapter paging run again for the new id (PPF:863-883, 923) and the wave-1 chapter pages are wasted [V].
- Typical cost [I]: 1 search + 1 aggregate + P chapter pages + Q verify searches, where P = ceil(all-language chapter rows / 100) ≤ 50 and Q = number of distinct AniList titles/synonyms + 1. A 200-chapter series with 5 languages ≈ 10 pages; Q ≈ 5-10 → ~17-22 requests.

MangaUpdates (`https://api.mangaupdates.com/v1`)
- Wave 1: `POST /series/search {search, per_page: 10}` once (no hints, so one query) then `GET /series/{id}` → **2 requests** (`PPF/mangaupdates-fetch.ts:217-248`; `src/server/services/mangaupdates/client.ts:99-140`) [V].
- Wave 2 (`verifyMUWithAniList`, mangaupdates-fetch.ts:464-500): no extra requests when the existing match has year gap ≤5 and no country/type mismatch (486-499) [V]. Otherwise, or when wave 1 found nothing and AniList has alt titles, it re-runs `fetchMangaUpdatesDirect` with **every** AniList title + synonym as a separate search (217-234; PPF:338-341), then one details call [V]. A title with 3 titles + 8 synonyms costs 12 searches + 1 details.
- The search hit already contains description, image, type, year, rating, genres, latest_chapter (`src/server/services/mangaupdates/types.ts:24-38`) [V]; the details call is still needed for associated names, publishers, categories, authors, status, related series (types.ts:44-71) [V].
- ID bridging not used: MangaDex `links.mu` is captured (`PPF/external-id-extractor.ts:16-25`) but MangaUpdates is always resolved by title search (mangaupdates-fetch.ts:212-249) [V]. Using the MangaDex `mu` link (after wave 1) to fetch by id would remove the search and the title-match risk [I; MangaDex `mu` values are a mix of legacy numeric ids and newer slugs — the code itself handles both forms at external-id-extractor.ts:62 — so an id-translation step may be needed; not verified].
- `getRecentReleases` searches releases by *title text* and filters client-side by `series_id` with a fixed 40-row page (`src/server/services/mangaupdates/service.ts:76-104`) [V]; not on the enrichment path (used by calendar provider) [I].

Kitsu (`https://kitsu.io/api/edge`) — default off
- `GET /manga?filter[text]=…&page[limit]=5` (`src/server/services/kitsu/client.ts:74-88`); wave 1 = **1 request** (`PPF/kitsu-fetch.ts:187-207` with no hints) [V]. The search response contains full resources, so no details call is made (`getMangaDetails` at client.ts:91-100 is unused by the pipeline) [V].
- Wave 2 retry only when wave 1 returned nothing: one search per AniList title/synonym, serial, uncapped (PPF:351-363; kitsu-fetch.ts:191-207) [V].
- No `include=` and no sparse fieldsets (`fields[manga]=…`) on any request (client.ts:79, 93) [V]. JSON:API `include=categories,mappings` in the same request would return categories and external-ID mappings without extra calls [U].
- ID bridging not used: MangaDex `links.kt` is captured (external-id-extractor.ts:34, 64) but Kitsu is always title-searched [V]. Kitsu also exposes a `mappings` resource filterable by external site/id (e.g. MAL or AniList id → Kitsu item) [U — could not load kitsu.docs.apiary.io; see Gaps].

Jikan / MyAnimeList (`https://api.jikan.moe/v4/manga`) — default off
- Only called when an `idMal` exists from AniList or MangaDex `links.mal` (PPF:582-588) [V]. `GET /manga/{id}` then `GET /manga/{id}/recommendations` → **2 requests**, serial (`PPF/mal-fetch.ts:54-98`; `src/server/services/jikan/client.ts:54-97,138-174`) [V].
- The recommendations call is unconditional once the base call succeeds (mal-fetch.ts:82) [V]; it could be deferred/lazy or skipped when AniList already returned recommendations [I].
- `/manga/{id}/full` is not used. [U] `/full` adds `relations` and `external` links to the base payload; it does not include recommendations, so it would not reduce the count but would add ID-bridging data for the same single request.

ComicVine
- _See the dedicated "ComicVine" section at the end of these notes (audited separately)._

### Inferences
- Because wave 2 MangaDex verification and MangaUpdates re-verification fan out over synonyms serially behind in-process limiters, the 60 s per-step timeout (PPF:147) is the practical cap; for synonym-heavy titles the step can time out and silently fall back to `null`/the wave-1 value while requests keep running in the background.
- Capping alt-title fan-out (e.g. english/romaji/native + top-N synonyms, stop on first confident hit) would bound the worst case for MangaDex, MangaUpdates and Kitsu with little recall loss; the exact N should be measured with the existing bind-loop harness.

### Gaps
- Request counts are derived from code, not measured. A trace of one real enrichment (count of outbound requests per host) would confirm them.
- MangaDex default sort order for `/manga?title=` and the exact list of 500-limit feed endpoints were not confirmed from the docs page fetched.
- Kitsu and Jikan documentation could not be loaded (kitsu.docs.apiary.io and docs.api.jikan.moe returned only a page title; they render client-side). All Kitsu/Jikan API-capability statements are marked [U].

---

## Rate limiting: implementation, cross-process sharing, header handling, consistency with documented limits

### Takeaway
Every limiter is an in-memory, per-process structure; none is Postgres-backed or shared between processes, and none reads `Retry-After`/`X-RateLimit-*` on the enrichment path. AniList is simultaneously too slow per request (fixed 1.5 s gap) and too aggressive in aggregate versus the documented degraded 30 req/min limit; MangaDex matches the documented ~5 req/s; Jikan has no per-minute cap; all sliding-window limiters have a concurrency race.

### Cited Findings

Documented limits
- AniList: normal limit 90 requests/minute; the docs state the API is currently in a degraded state limited to **30 requests/minute**, not reflected in headers; exceeding the limit triggers a 1-minute timeout with `Retry-After` (seconds) and `X-RateLimit-Reset`; a separate burst limiter exists — [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting) [DOC, obtained via web-search summary of that page; direct fetch returned HTTP 403, so re-check the live page for the current state].
- MangaDex: "approximately 5 requests per second per IP"; exceeding → HTTP 429 for all requests; persisting → temporary IP ban returning HTTP 403; `GET /at-home/server/{id}` 40/min; headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Retry-After` (UNIX timestamp); a non-spoofed `User-Agent` is required — [MangaDex limitations](https://api.mangadex.org/docs/2-limitations/) [DOC].
- MangaUpdates: no numeric limit published; Acceptable Use Policy: "You will use reasonable spacing between requests so as not to overwhelm the MangaUpdates servers" — [MangaUpdates API](https://api.mangaupdates.com/) [DOC].
- Jikan (3/s, 60/min), Kitsu (no published limit), ComicVine (200 requests/resource/hour + velocity detection): **not verified in this session** [U]; the task brief states these figures.

AniList
- Enrichment path uses `anilistClient.query()` → `AniListRateLimiter.waitForNextRequest()` (`src/server/services/anilist/client.ts:619-651, 161-188`) [V]. Constants: `minRequestInterval = 1500` ms, `maxRequestsPerMinute = 80` (client.ts:88-89) [V]. Sequential effective ceiling is therefore 40 req/min.
- A second, independent limiter exists: `anilistRequestQueue` with `MIN_DELAY_MS = 2000`, 5 s cooldown when `x-ratelimit-remaining` < 20 (`src/server/services/anilist/request-queue.ts:76-93,140-160`), used only by `queryWithPriority` (client.ts:686-743) [V]. The two limiters share no state, so the process can emit ~40/min (enrichment) + ~30/min (queue/home discovery) concurrently [I].
- `x-ratelimit-remaining` is parsed only in the queue path (client.ts:662-670, 720) [V]; `query()` never reads any rate-limit header, and neither path reads `Retry-After` or `X-RateLimit-Reset` [V].
- Race: `waitForNextRequest` reads `lastRequestTime`, sleeps, then writes it (client.ts:179-187) with no mutex; `acquireLock` is keyed per cache key (query+variables), not global (client.ts:118-135, 631) [V]. Concurrent distinct queries therefore sleep the same interval and fire together [I] — exactly the burst pattern AniList's burst limiter targets.
- Versus documented limits: against 90/min the 1.5 s fixed gap is over-conservative (a title needing 2-3 calls spends 3-4.5 s in limiter sleep); against the degraded 30/min it is too aggressive (40/min sequential, more under concurrency) [I]. Under bulk enrichment this predicts 429s after roughly 30 requests (~10-15 titles) per minute.
- `initialize()` → `Object.assign(anilistClient, newClient)` when `clientId && clientSecret` are configured (`service.ts:396-404`) copies the new instance's own fields (`rateLimiter`, `cache`, `axiosInstance`, token) over the singleton [V; class fields at client.ts:349-352]. `fetchAniListDirect` calls `anilistService.initialize()` on every enrichment (PPF:691) [V]. Result when credentials are set: the request-timestamp window and `lastRequestTime` reset to zero and the 1 h cache is emptied on every title [I] → limiter is effectively disabled across titles.

MangaDex
- Sliding window `maxRequests: 5, perMilliseconds: 1000` for the default client (`src/server/services/mangadex/ts-client-factory.ts:133-144`); the DB-configured client takes user-supplied values (ts-client-factory.ts:149-164) [V] — a mis-set config can exceed the documented limit [I].
- Limiter is an axios request interceptor (`packages/mangadex-ts-client/src/providers/mangadex/client.ts:86-91`) using `RateLimiter.waitIfNeeded` (`packages/mangadex-ts-client/src/core/rate-limiter.ts:22-47`) [V].
- Two separate client singletons each with their own limiter: `_client` (DB config, used by the pipeline via `getTsMangadexClient`, ts-client-factory.ts:167-175) and the eagerly created `tsMangadexClient`/`mangadexClient` (ts-client-factory.ts:180-183) [V]. If download/search code uses the sync export while enrichment uses the lazy one, the process can reach 10 req/s against a 5 req/s per-IP limit [I; importers of the sync export were not enumerated].
- `getScanlationGroup` bypasses the limiter entirely with a raw `axios.get` (ts-client-factory.ts:75-84) [V].
- At-home endpoint has its own 40/min limiter (ts-client-factory.ts:45-50; `at-home-rate-limiter.ts`) [V] — download path, out of scope.
- No handling of `X-RateLimit-Retry-After` or 429 on the pipeline client: `validateStatus` accepts <500 (client.ts:76), `safeRequest` throws `MangaDexApiError` when the body is an error envelope (client.ts:168-189) [V]. The generic `HttpClient` does read `retry-after` (`packages/mangadex-ts-client/src/core/http-client.ts:89-96`) but `MangaDexClient` does not use `HttpClient` [V].
- User-Agent is the generic `MangaDex-TypeScript-Client/2.0.0` (client.ts:71; ts-client-factory.ts:79,142) [V] — compliant with "must have a UA" but not app-identifying.

MangaUpdates
- Sliding window 60 requests / 60 s (`src/server/services/mangaupdates/client.ts:20-47`) [V]. Permits a burst of 60 back-to-back requests, then blocks until the window slides; with no published numeric limit this is a guess [I]. A spacing-based limiter (e.g. 1 req/s) matches the AUP wording better.
- No header handling, no 429 handling: any non-2xx throws (client.ts:77-80) [V].

Kitsu
- Sliding window 10 requests / 1 s (`src/server/services/kitsu/client.ts:19-43`) [V]; no 429 or header handling (client.ts:63-66) [V].

Jikan
- Fixed 350 ms minimum gap via module-level `lastRequestTime` (`src/server/services/jikan/client.ts:18-33`) ≈ 2.86 req/s [V]. No per-minute cap [V] — sustained use would reach ~171/min versus the 60/min figure in the brief [I, limit itself U].
- Same race as AniList: concurrent callers read the same `lastRequestTime` and fire together (client.ts:26-33) [V/I].
- 429 → wait `min(10 s, (attempt+1)×2 s)` then retry; `Retry-After` not read (client.ts:71-76, 151-156) [V].

Shared defects
- All three sliding-window `RateLimiter` copies (Kitsu client.ts:29-40, MangaUpdates client.ts:30-44, mangadex-ts-client rate-limiter.ts:22-47) check the window, `await` a sleep, then push a timestamp. N concurrent callers arriving at a full window all compute the same wait and all proceed together [V/I] → the limit is a soft target under `Promise.all`.
- No limiter state is persisted or shared: all are module-level/instance fields [V at the cited lines]. Any second Node process (worker, script, a second container) gets a fresh budget against the same IP [I]. The "Postgres-backed limiter" named in the brief was not found on any of these five clients' paths [V for the files read; `src/server/utils/rate-limit/` exists and was not audited].

### Inferences
- The AniList configuration is the most likely source of provider-side throttling in bulk runs; fixing it (single shared limiter, ≤30/min while degraded, honor `Retry-After`) should precede any other AniList optimisation, and merging search+details halves the budget consumed per title.
- A single shared limiter utility (token bucket with a serialized queue, header feedback, optional Postgres advisory-lock/row-backed mode for multi-process) would replace five divergent implementations.

### Gaps
- Not determined: how many OS processes issue provider requests in production (single Next.js server vs. separate job workers). This decides whether per-process limiters are adequate.
- `src/server/services/anilist/modules/adaptiveRateLimiter.ts` (236 lines, with tests) — live usage not traced; it is not referenced by `client.ts` or PPF.
- Jikan/Kitsu/ComicVine documented limits not verified from primary docs in this session.

---

## Retries, backoff, timeouts, circuit breaking, stale fallback, negative caching

### Takeaway
Resilience is thin and inconsistent: AniList and Jikan retry only on 429 without jitter or `Retry-After`; MangaDex, MangaUpdates and Kitsu have no retries; AniList has no HTTP timeout; errors are flattened to "no result"; there is no negative caching, and the AniList stale-while-error fallback applies only to home-page discovery, not enrichment.

### Cited Findings

AniList
- No request timeout: `axios.create` sets only baseURL and headers (`src/server/services/anilist/client.ts:355-361`) [V]; axios's default is no timeout [U]. A stalled socket holds the per-query lock taken at client.ts:631 until it resolves, so identical later queries wait behind it; the caller's 60 s `withTimeoutOrNull` stops waiting but cancels nothing [V/I].
- Retries: only for HTTP 429 or a GraphQL error with `extensions.code === 'RATE_LIMITED'`, max 3, backoff `3^n` s = 3 s, 9 s, 27 s (39 s total), no jitter (client.ts:461-463, 482-490, 516-518, 619) [V]. The documented lockout is 1 minute — [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting) [DOC] — so all three retries land inside the lockout [I]; total elapsed also approaches the 60 s phase timeout.
- 5xx, network errors and timeouts are not retried (client.ts:520-528, 601-609) [V].
- Bug: `handleGraphQLErrors(response, …)` is passed the Axios response object, not `response.data` (client.ts:559-565) [V]. `AxiosResponse` has no `errors` property, so the function always returns `{shouldRetry:false}` and GraphQL-level errors on HTTP 200 are never detected; execution falls through to `response.data.data` or the generic "No data returned" error (client.ts:579-583) [V/I]. It type-checks only because both types share an optional `data` key [I].
- Debug noise on every request: `console.error('[AniList HTTP DEBUG] …')` plus two `logger.warn` calls (client.ts:541-545, 556) [V] — violates the project's no-console rule and pollutes warn-level logs.
- `queryWithPriority` ignores its `_maxRetries` parameter and has no retry (client.ts:691, 705-742) [V].
- Error flattening: `searchManga` catches everything and returns `[]` (`service.ts:554-558`); `getMangaDetails` returns `null` (`service.ts:622-626`) [V]. The pipeline cannot distinguish "AniList down/429" from "no such title": a pinned-id failure logs "falling back to search" (PPF:666-668) and an empty search yields a null anchor (PPF:739-740), after which ComicVine matching proceeds on a title-only stand-in (PPF:327) [V]. The code's own comment notes a failed AniList anchor "cascades into garbage ComicVine/Wikipedia matches" (PPF:133-135) [V].
- Stale-while-error: `serveStaleAniList` reads expired `cache_unified` entries with `allowStale` (`src/server/trpc/routers/home/anilist-stale.ts:25-44`) [V]. Text search for `serveStaleAniList|cache_unified|cacheProvider` finds it only in home routers, `src/server/trpc/routers/anilist.ts`, cache providers and `src/server/services/anilist/health.ts` — not in the enrichment pipeline or `anilist/service.ts`/`client.ts` [V]. The memory note `project_cache_unified_durable_stale_fallback.md` is consistent with this scope (discovery only) [V for scope].
- No circuit breaker on the AniList enrichment path [V: none in client.ts/service.ts]. `health.ts` caches an availability status (health.ts:80-97) but PPF does not consult it [V: not imported in PPF:24-59].

MangaDex
- 30 s axios timeout (ts-client-factory.ts:153-154) [V]. No retries anywhere in `MangaDexClient` (client.ts:117-189) [V].
- `fetchMangaDexChapters` wraps the whole pagination loop in one try/catch; any single page failure returns `[]` and logs at `debug` (`PPF/mangadex-chapter-list.ts:122,187-193`) [V] — a 429 on page 30 of 40 discards 3,000 already-fetched rows invisibly. Same pattern for aggregate (`PPF/mangadex-aggregate.ts:97-103`) [V].
- A thrown search error in `verifyMangaDexWithAniList` (PPF:908) rejects the whole step; `withTimeoutOrNull` does not catch rejections (with-timeout.ts:18-27), and wave 2 uses `Promise.all` (PPF:254) not `allSettled` [V] → a single MangaDex 429/5xx in wave 2 rejects `phaseProviderFetch` entirely [I — unless the pipeline client swallows it; `safeRequest` rethrows (client.ts:183-188)]. Wave 1 is protected by `Promise.allSettled` (PPF:154) [V].

MangaUpdates / Kitsu
- 15 s `AbortController` timeout each (`mangaupdates/client.ts:17,61-62`; `kitsu/client.ts:17,52-53`) [V]. No retries; service layer converts every error to `[]`/`null` with `log.error` (`mangaupdates/service.ts:36-65`; `kitsu/service.ts:17-37`) [V].
- Consequence in the fan-out loops: a failed search for one alt title is silently treated as zero hits and the loop continues (mangaupdates-fetch.ts:225-234; kitsu-fetch.ts:198-207) [V].

Jikan
- 15 s timeout; up to 3 attempts for the base call and 2 for recommendations (`jikan/client.ts:17,56,140`) [V]. Retries on 429 (linear 2/4/6 s) and on thrown errors (flat 1 s) (client.ts:71-76, 84-92) [V]. Any other non-OK status, including 500/503/504, returns `null` immediately with a `debug` log (client.ts:78-81) [V]. [U] Jikan commonly returns 5xx when MyAnimeList itself is slow, so not retrying 5xx likely drops recoverable calls.
- `jikanService.isAvailable()` and `mangaUpdatesService.isAvailable()` cache their first result for the life of the process (`jikan/service.ts:116-122`; `mangaupdates/service.ts:110-116`) [V] — one failed startup probe marks the provider unavailable until restart for any caller that consults it [I; callers not traced].

Negative caching
- None. No structured client on the enrichment path writes a "not found" marker; every re-enrichment repeats all searches (no cache usage in `src/server/services/{mangadex,kitsu,jikan,mangaupdates}` or PPF/*; text search for cache provider usage returned only `anilist/health.ts`) [V].

### Inferences
- The combination "AniList 429 → three futile retries → `[]` → null anchor → title-only ComicVine/others" is a plausible root cause for wrong bindings created during bulk runs. Distinguishing transient failure from no-match (AsyncResult error vs. empty) and aborting/deferring the enrichment on anchor failure would be the durable fix.
- Wave 2's `Promise.all` makes MangaDex verification a single point of failure for the phase; switching to `allSettled` or wrapping each step in a catch aligns it with wave 1.

### Gaps
- Whether the phase-level caller catches a wave-2 rejection and how it then persists state was not traced (orchestration is another researcher's lane).
- No runtime logs were inspected to quantify actual 429/timeout rates.

---

## Caching: what is cached, keys, TTLs, invalidation, stampede protection, forceRefresh

### Takeaway
The enrichment path has almost no caching for structured APIs: only AniList has a 1-hour in-process, unbounded Map; MangaDex, MangaUpdates, Kitsu and Jikan have none. `cache_unified` is not used by these clients, and `forceRefresh` is never passed to them, so it under-invalidates (AniList) rather than over-invalidates.

### Cited Findings
- AniList: `AniListCache`, in-memory `Map`, TTL 3,600,000 ms, key = full query text + `JSON.stringify(variables)` (`src/server/services/anilist/client.ts:220-246`) [V]. Entries are deleted only when read after expiry (client.ts:265-275); there is no size bound or sweep [V] → unbounded growth over long uptimes [I]. Lost on restart [I].
- AniList stampede protection: per-key promise lock with double-checked cache read (client.ts:118-135, 619-651) [V]. With three or more concurrent waiters, all later waiters await the same original promise and then each installs its own lock, so they proceed concurrently (client.ts:124-130) [I]; the double-check after the lock still prevents duplicate fetches once the first completes.
- AniList cache is cleared wholesale by `initialize()` when credentials are configured (see Rate limiting) [I from `service.ts:396-404`].
- `forceRefresh` in the enrichment pipeline is consumed only by Fandom/wiki code: PPF:157, 1137-1142; `wiki-discovery.ts:52-60`; `phase-fandom-enrichment.ts:85-88, 327`; `fandom-chapter-detail-fetch.ts:225-227` (text search across the enrichment-pipeline directory) [V]. `fetchAniListDirect`, `fetchMangaDexDirect`, `fetchMangaUpdatesDirect`, `fetchKitsuDirect` and the ComicVine matcher receive no refresh flag (PPF:155-160, 325-331) [V]. A forced refresh within an hour of a prior fetch therefore serves the cached AniList response [I].
- MangaDex: `MangaDexClient` has no response cache (`packages/mangadex-ts-client/src/providers/mangadex/client.ts`, whole class) [V]. The package's `HttpClient`/`TTLCache` (5 min TTL, 500 entries, LRU eviction; `core/http-client.ts:61-79`, `core/cache.ts:7-84`) is not used by `MangaDexClient` [V].
- MangaUpdates, Kitsu, Jikan: no cache of any kind in client or service files [V].
- `cache_unified` (Postgres, `src/server/cache/UnifiedCacheProvider/`): referenced by home routers (`anilist-popular.ts`, `anilist-filtered.ts`, `anilist-stale.ts`), `src/server/trpc/routers/anilist.ts`, `src/server/trpc/middleware.ts`, `HotDataCacheProvider.ts`, `schema-ensurer.ts` and `anilist/health.ts` (text search) [V]. Its key design, TTLs and stampede behaviour were not audited because no enrichment-path provider client uses it.
- In-flight request de-duplication: none for MangaDex/MU/Kitsu/Jikan. Wave 1 and wave 2 can issue the same MangaDex search for the original title twice within seconds (PPF:819 and PPF:893/908) [V].
- Redundant DB read adjacent to caching: `readManualComicVineVolumeId` re-queries `manga.providerMetadata` (PPF:1013-1017) although it was loaded at PPF:120-123 [V].

### Inferences
- A small per-provider response cache in `cache_unified` (search results keyed by normalized query, entity payloads keyed by provider id; TTL by data type — e.g. hours for search, a day for finished-series entities, shorter for releasing ones) plus negative entries would remove most repeat traffic during reidentify/retry loops and give enrichment a stale-while-error path for the AniList anchor. `forceRefresh` should then bypass exactly those keys.
- Concrete TTL values need measurement of how often re-enrichment repeats within N hours; none are prescribed by the code today.

### Gaps
- `cache_unified` schema/TTL/eviction details and the LOGGED-table change described in the memory note were not re-verified (outside the clients' enrichment path).
- ComicVine caching is covered in the ComicVine section.

---

## Extraction completeness and correctness (fields ignored or mis-parsed, status mappings, counts)

### Takeaway
The reported MangaDex-status and MangaUpdates-chapter inaccuracies are not enum-mapping bugs: MangaDex status is passed through unmodified and maps correctly, and MangaUpdates `latest_chapter` is copied faithfully — the defects are that the pipeline treats a scanlation-progress number as a chapter total, and that the better status sources (MAL, MangaUpdates, Kitsu) never reach the status selector. Several high-value fields are fetched-and-dropped or never requested.

### Cited Findings

Status
- Live status candidates: AniList (`collect-candidates.ts:132`) and MangaDex (`PPF:1304-1311`, raw `attributes.status` from PPF:842) only [V].
  - MAL claim = `buildMALMetadataSupplements({}, mal)` (PPF:1326-1329), which emits only chapters, volumes, averageScore, rating (`PPF/mal-fetch.ts:108-146`) [V]. `MALResult.status` is computed (`jikan/service.ts:49`) and then unused by the selector [V].
  - MangaUpdates claim = `buildMangaUpdatesMetadataSupplements` (PPF:1313-1324), which emits publishers, genres, tags, authors, artists, alternativeTitles, averageScore, rating, chapters — no status (`PPF/mangaupdates-fetch.ts:356-414`) [V], although `status` and `completed` are extracted (mangaupdates-fetch.ts:276-278) [V].
  - Kitsu claim emits contentRating, summary, synonyms, format, cover, chapters, volumes — no status, startDate or endDate (PPF:1331-1342) [V], although all three are extracted (`PPF/kitsu-fetch.ts:158,164-165`) [V].
  - `authority.ts` documents MAL as the measured-best status source at weight 0.95 and MangaDex floored to 0.40 (`src/server/services/metadata/selectors/authority.ts:19-22`) [V]. With no MAL status candidate in the live claims, that override cannot take effect in production; status is a two-way AniList-vs-MangaDex vote [I]. The memory note's statement "status={anilist,mangadex,mal,mangaupdates}" does not match current code [V against PPF:1292-1342].
- MangaDex status mapping is correct for its four enum values: the normalizer maps `completed`→COMPLETED, `ongoing`→ONGOING, `hiatus`→HIATUS, `cancelled`→CANCELLED (`src/server/services/metadata/selectors/select-categorical.ts:111-122`) [V]. So the reported inaccuracy is source-side staleness and/or matched-edition mismatch, not a parse error [I]. The memory note records it as "stale, 23% contested" [V note text; measurement not reproduced].
- Normalizer regex anchoring bug: patterns such as `/^finished|completed|complete|ended$/u` anchor only the first and last alternatives (select-categorical.ts:115-120) [V]. Any string merely *containing* `complete` matches — including "Incomplete …" — so if MangaUpdates free-text status were ever fed in, "N Volumes (Incomplete…)" would normalize to COMPLETED [I]. The same substring flaw is live in `mapMUStatus` (`src/server/services/mangaupdates/adapter.ts:88-97`: `includes('complete')`, and `includes('year')` → ONGOING) [V].
- Divergent status vocabularies: AniList `NOT_YET_RELEASED` → `'UPCOMING'` (enrichment-result-builder.ts:342-348) vs `NOT_YET_PUBLISHED` (`anilist/service.ts:685-691`) vs MAL `'NOT_YET_RELEASED'` (`jikan/types.ts:65-71`); MAL 'Discontinued' → 'CANCELLED' [V]. Kitsu `unreleased` has no branch in the normalizer and would pass through as `UNRELEASED` (select-categorical.ts:117-121) [I; Kitsu enum values U].

Chapter / volume counts
- MangaUpdates: `latest_chapter` is copied to `latestChapter` (mangaupdates-fetch.ts:283) and used as the `chapters` supplement/claim when >0 (mangaupdates-fetch.ts:401-411) under the stated assumption it is "identical in meaning to AniList's `chapters`" [V]. [U] In MangaUpdates this field tracks the latest *released (scanlated) chapter* recorded on the site, which stalls when a series is licensed and is 0 for volume-only releases — consistent with the harness figure "MangaUpdates-chapters (36% accurate)" in the memory note. So: extraction is faithful; the semantic mapping is wrong [I].
- MangaUpdates free-text `status` (e.g. "34 Volumes (Complete)") is passed through as an opaque string (mangaupdates-fetch.ts:276) and never parsed for volume/chapter totals or completion [V]. [U] That string is MangaUpdates' statement of original-publication totals and would be a better volumes/status signal than `latest_chapter`.
- Mislabelled hint: MangaUpdates `latestChapter` is passed to the Wikipedia retry as `malChapters` (PPF:259, 264) [V].
- MangaDex: `lastChapter`/`lastVolume` and the aggregate are fetched but MangaDex contributes no `chapters`/`volumes` candidate to the selector (PPF:1304-1311) [V], despite the memory note listing MangaDex among the best contested-chapter sources [V note text].
- MangaDex aggregate: the `none` volume bucket (chapters not yet assigned to a volume) fails `parseFloat` and is dropped (`PPF/mangadex-aggregate.ts:39-40`) [V] → totals logged from the aggregate exclude the newest unvolumed chapters [I].
- MangaDex chapter list: rows with `externalUrl` are discarded (`mangadex-chapter-list.ts:53`) [V]. [U] Officially licensed series are often represented on MangaDex only as external-link chapters; those rows still carry number/title/volume/publishAt, so dropping them removes metadata for exactly the most popular titles.
- MangaDex chapter list truncation: ascending order + 5,000-row cap across all languages (`mangadex-chapter-list.ts:28-29,135-147`) [V] → for series whose all-language row count exceeds 5,000 the highest-numbered chapters are never fetched [I]; the 10,000 offset+limit ceiling is a hard API bound — [MangaDex limitations](https://api.mangadex.org/docs/2-limitations/) [DOC].
- MangaDex volume parse: `parseInt(attrs.volume)` (mangadex-chapter-list.ts:66) collapses fractional/alpha volume labels [V] (Low).
- ComicVine issue ordering uses `parseInt(issue_number)` (enrichment-result-builder.ts:569-580) [V] → decimal issue numbers collapse (Low; more in ComicVine section).

AniList
- `externalLinks` missing from the details query (see Top finding 1) [V]. Also absent from `queries.ts` entirely (text search for `externalLinks` in that file: no hits) [V].
- Recommendations: the query selects only `mediaRecommendation { id title{romaji english} coverImage{medium} }` (`queries.ts:221-234`); the extractor reads `rating`, `format`, `type`, `title.native`, `coverImage.large` (enrichment-result-builder.ts:407-440) [V] → those are always null and covers are always the medium size [I].
- Relations: node lacks `idMal`, `title.native`, `startDate`, `chapters/volumes` (`queries.ts:202-220`) [V] — useful for spin-off disambiguation and cross-provider bridging [I].
- Staff: role regexes `authorRole`/`artistRole` (enrichment-result-builder.ts:312-313) [V]. `\bart\b` matches "Story & Art" for both lists (intended); no handling of "Original Character Design"/"Assistant"/"Translator (English)" exclusions beyond the regex; staff list unbounded/unsorted in the details query (`queries.ts:184`) [V] (Low).
- Not requested at all: `source`, `favourites`, `trending`, `rankings`, `isLicensed`, `updatedAt`, `title.userPreferred`, `hashtag`, `stats` (compare `queries.ts:118-237`) [V absent; field existence in AniList schema U]. `updatedAt` would enable cheap change detection.
- Type erosion: `AniListMangaDetails.tags` narrows away `category`, forcing a cast at enrichment-result-builder.ts:292-293; recommendations require `as unknown as Record<string, unknown>` (enrichment-result-builder.ts:412) [V].
- `if (details.chapters)` / `if (details.volumes)` truthiness checks (enrichment-result-builder.ts:265-266) are fine for counts (0 is not meaningful) [V]; `averageScore` likewise.

MangaDex
- Extracted: status, lastVolume, lastChapter, links (all keys), description (en → ja-ro/ja → any), contentRating, publicationDemographic, aggregate, chapter list (PPF:840-855) [V].
- Ignored though present on the search payload: `title`/`altTitles` as alt-title contributions (used only for matching, `mangadex-matcher.ts:20-30`), `tags`, `originalLanguage`, `year`, `availableTranslatedLanguages`, `state`, `latestUploadedChapter` (`src/server/services/mangadex/types.ts:123-137`) [V]. Not requested: authors/artists/cover via `includes[]`, statistics (`getStatistics` exists, client.ts:283-289), cover list per volume (`getMangaCovers`, client.ts:245-258) [V].
- Description fallback picks "any other language" as last resort (PPF:793-803) [V] → a non-English description can be claimed as `summary` for an English library [I] (Low/Med).
- ID bridging: all `links.*` are persisted as external links (external-id-extractor.ts:16-54) but only `links.al` (matcher) and `links.mal` (PPF:847, 587) are used to drive fetches; `mu`, `kt`, `ap`, `nu`, `bw` are not (see request-cost section) [V].
- MU link URL builder: numeric → `/series/{n}`, non-numeric → `series.html?id={slug}` (external-id-extractor.ts:62) [V]; this looks inverted relative to the slug-style URL the code itself documents (`/series/{base36}/…`, mangaupdates-fetch.ts:60-63) [I — needs a live check of which form each id type resolves to].

MangaUpdates
- Extracted well: publishers (typed), categories with positive net votes, genres, authors with roles, publications, related series, recommendations (top 15), associated names, anime start/end, rating, type, year (mangaupdates-fetch.ts:267-302) [V].
- Ignored: `description` and `image` (no summary/cover fallback from MU), `category_recommendations`, `rank`, `last_updated`, `forum_id` (types.ts:44-71 vs. mangaupdates-fetch.ts:267-302) [V]. Alt titles from MU are only used when AniList supplied none (mangaupdates-fetch.ts:435-440) rather than unioned as Kitsu's are (enrichment-result-builder.ts:646-653) [V].

Kitsu
- Extracted: titles (all locales) + abbreviatedTitles, synopsis, status, subtype, ageRating(+guide), counts, dates, serialization, averageRating, user/favorites counts, poster and cover (kitsu-fetch.ts:146-173) [V].
- The module header names "community-curated category coverage" as a reason to use Kitsu (kitsu-fetch.ts:4-6), but no categories/genres are requested or typed (`kitsu/client.ts:79`; `kitsu/types.ts:28-57`) [V].
- `relationships`/`mappings` not typed or requested (types.ts:53-57) [V] → no MAL/AniList id cross-check of the Kitsu match [I].
- `chapterCount`/`volumeCount` of 0 treated as unknown (enrichment-result-builder.ts:673-677; PPF:1339-1340) [V] — correct.
- `serialization` (a magazine name) is used as a `publisher` fallback (enrichment-result-builder.ts:684-685) [V] — a magazine is not a publisher [I] (Low).
- Base host is `kitsu.io` (client.ts:16); external links are built as `https://kitsu.io/manga/{id}` (external-id-extractor.ts:64) [V]. [U] Kitsu has moved its primary domain to kitsu.app; whether kitsu.io API calls redirect reliably was not checked.

Jikan / MAL
- Typed/extracted: mal_id, title, title_english, title_japanese, chapters, volumes, status, score, scored_by, rank, popularity, genres, explicit_genres, url (`jikan/types.ts:24-42`; `jikan/service.ts:42-56`) [V]. `titleEnglish`/`titleJapanese` are dropped when building `MALDirectResult` (mal-fetch.ts:84-95) [V].
- Not typed, so silently ignored: `title_synonyms`/`titles[]`, `authors`, `serializations`, `published.from/to`, `type`, `synopsis`, `themes`, `demographics`, `images`, `members`, `favorites` [V absent from types.ts; presence in Jikan's payload U].
- MAL contributes no status, dates, synonyms or authors to the selector (PPF:1326-1329; mal-fetch.ts:108-146) [V] even though the memory note ranks MAL top for volumes and status [V note text].
- Recommendation edge reuses the field name `anilistId` to carry a MAL id (`jikan/service.ts:71-101`; mal-fetch.ts:34-41) [V] — error-prone naming.
- Unchecked cast: `(await resp.json()) as JikanMangaResponse` (jikan/client.ts:83, 161) with no runtime validation [V]; same for Kitsu (`kitsu/client.ts:67`) and MangaUpdates (`mangaupdates/client.ts:82`), where types declare nested objects as non-optional (e.g. `details.anime.start`, `details.image.url.original`, `record.image.url.original`) and are dereferenced directly (mangaupdates-fetch.ts:254; `mangaupdates/adapter.ts:26,65`) [V] → a null `image`/`anime` from the API throws and, via the service catch, turns a good match into `null` [I].

### Inferences
- Highest-leverage accuracy changes, all using data already fetched: (1) add status (and start/end dates) from MAL, MangaUpdates (`completed` boolean + parsed status text) and Kitsu to their selector claims; (2) stop claiming MangaUpdates `latest_chapter` as `chapters` (or down-weight it to a floor/lower-bound signal) and instead parse totals from MU `status`; (3) add MangaDex aggregate/lastChapter as a chapters candidate; (4) carry AniList `externalLinks` from the search result or add it to the details query.
- Because the harness gate reportedly builds candidates from "collected candidates" (memory note), its measured gains for MAL-status weighting may not be realised in production until MAL status is actually claimed; re-running the gate against claims produced by the live `buildClaimsForShadow` would confirm.

### Gaps
- MangaUpdates field semantics (`latest_chapter`, `status`) could not be confirmed from the official docs: the single-page docs at api.mangaupdates.com exceed the fetch window and the series section was not reachable.
- I did not inspect `src/lib/metadata/provider-registry.ts` weights or the gitignored harness (`scripts/surveys/metadata-accuracy/`); statements about measured accuracies come from the memory note only.
- Whether any downstream phase (e.g. phase-finalize) reads Kitsu/MAL status or dates outside the selector was not traced beyond the memory note's remark that start/end dates are filled by phase-finalize/Kitsu.

---

## Duplicate implementations, divergent helpers, provider-metadata-utils usage, oversized files, `any`

### Takeaway
There are no `any` types in the five audited client directories, but there is heavy duplication (five rate limiters, seven status mappers, three or more AniList clients) and several files exceed the project's 500-line limit; the canonical `provider-metadata-utils.ts` is bypassed by a local copy in the main orchestrator.

### Cited Findings
- `any`: `ast-grep --pattern '$A as any'` and a textual scan for `: any`/`any[]` return 0 hits in `src/server/services/{anilist,mangadex,kitsu,jikan,mangaupdates}` and `PPF/`; 3 `as any` hits in `packages/mangadex-ts-client/src` [V]. Type-safety risk comes instead from unchecked `as T` casts on JSON responses (see Extraction) and `as unknown as Record<string, unknown>` (enrichment-result-builder.ts:412) [V].
- Files over 500 lines (via `wc -l`) [V]: `PPF` 1351 (carries an explicit `@file-size-justified` header and `eslint-disable max-lines`, PPF:1-7); `PPF/enrichment-result-builder.ts` 689; `src/server/services/anilist/service.ts` 750, `client.ts` 749, `queries.ts` 748, `modularQueries.ts` 672, `modules/fieldInclusion.ts` 657, `modules/fragments.ts` 553, `modules/sorting.ts` 512; `src/server/services/mangadex/types.ts` 540; `src/server/parsers/adapters/AniListAdapter.ts` 854; `src/server/adapters/unified/AniListAdapter.ts` 557; `src/server/adapters/unified-anilist-adapter.ts` 524; `src/server/services/search/anilistProvider.ts` 537. `PPF/mangaupdates-fetch.ts` is exactly 500. Much of `anilist/client.ts` is JSDoc (e.g. lines 1-50, 58-84, 190-219).
- Rate limiter duplication: `AniListRateLimiter` (anilist/client.ts:85-189), `AniListRequestQueue` (anilist/request-queue.ts:73-223), `RateLimiter` in kitsu/client.ts:19-41, an identical `RateLimiter` in mangaupdates/client.ts:20-45, `RateLimiter` in packages/mangadex-ts-client/src/core/rate-limiter.ts:11-65, Jikan's `enforceRateLimit` (jikan/client.ts:23-33), plus `anilist/modules/adaptiveRateLimiter.ts` and `mangadex/at-home-rate-limiter.ts` [V].
- AniList client duplication: `anilist/client.ts` (two code paths `query` and `queryWithPriority` with different retry/limit behaviour), `anilist/validated-client.ts` (431 lines; 16 `anilistClient.*` call sites), and a separate AniList client inside the vendored package (`packages/mangadex-ts-client/src/providers/anilist/client.ts:25`) [V]. The package also ships its own ComicVine client (`packages/mangadex-ts-client/src/providers/comicvine/client.ts`, 171 lines) and a `MetadataEnricher` (`src/metadata/enricher.ts`), which the PPF header says was retired from the pipeline (PPF:18-21) [V] — likely dead code [I].
- Two AniList query systems: static strings in `queries.ts` and the builder in `modularQueries.ts` + `modules/conditional-queries/*`; the pipeline's search uses the builder while details uses the static string (`service.ts:499-523, 612-614`) [V] — this split is the direct cause of the `externalLinks` inconsistency [I].
- Status mapper duplication: `MAL_STATUS_MAP` (jikan/types.ts:65-71), `mapAniListStatus` (enrichment-result-builder.ts:342-348), `mapAniListStatusToPrisma` (anilist/service.ts:682-694), `mapProviderStatus` (`src/server/services/metadata/status-mapper.ts:28-60`), `mapToMangaStatus` (`@/utils/status-mapper`, imported at enrichment-result-builder.ts:13), the selector normalizer (select-categorical.ts:111-122), `mapMUStatus` (mangaupdates/adapter.ts:88-98) [V].
- `provider-metadata-utils.ts` bypassed: canonical `extractBoundProviderId` exists at `src/server/services/metadata/provider-metadata-utils.ts:76-78`; PPF defines its own `extractBoundProviderId` (PPF:647-655) and `extractBoundAniListId` (PPF:631-637) and hand-parses `providerMetadata` again in `readManualComicVineVolumeId` (PPF:1018-1021); PPF does not import the util (imports at PPF:24-59) [V]. The local AniList variant accepts only string ids while the canonical one also accepts numbers (PPF:635-636 vs utils:65-67) [V] — a numeric `providerId` would be ignored for AniList pinning [I].
- MangaDex result assembly duplicated: `fetchMangaDexDirect` (PPF:840-855) and `buildMangaDexDirectResult` (PPF:871-882) build the same object by hand; the second omits `matchScore` [V].
- Title-match scoring is re-implemented per provider (`pickBestMUMatch` mangaupdates-fetch.ts:130-204; Kitsu `scoreCandidate` kitsu-fetch.ts:74-114; MangaDex `scoreCandidates` mangadex-matcher.ts:59-92) with different length penalties and thresholds (0.3 / 0.3 / 0.4) [V] — matching quality itself is out of this lane.
- MangaUpdates has two adapters for the same payload: `adaptMUToMangaMetadata` (`mangaupdates/adapter.ts:46-83`, used by the provider-strategy path) and the inline mapping in `fetchMangaUpdatesDirect` (mangaupdates-fetch.ts:267-302) [V].
- Stale comments: `kitsu/types.ts:2` says `/api/edges/manga` while `kitsu/client.ts:14-16` documents that `/edges/` 404s; `jikan/service.ts:114` and PPF header "5 providers" (PPF:11) vs 8 fetched [V].
- Tests: enrichment-level tests exist for pickers/matchers (`tests/server/trpc/routers/enrichment-pipeline/{mangaupdates-picker,mangadex-matcher,anilist-bound-id}.test.ts`), `src/server/services/kitsu/__tests__/service.test.ts`, and AniList module tests; no test files were found for `jikan/client.ts`, `mangaupdates/client.ts`, `anilist/client.ts` retry/limiter behaviour, or `mangadex-chapter-list.ts` pagination (file-name search) [V for file names; test contents not read].

### Inferences
- A shared `ProviderHttpClient` (timeout, serialized limiter with header feedback, retry with jitter on 429/5xx honoring `Retry-After`, AsyncResult errors, optional `cache_unified` layer) would let the five small clients shrink to endpoint definitions and remove most findings in the rate-limit/retry sections at once.
- Consolidating status mapping onto the selector normalizer (with fixed anchoring) and deleting the others would prevent future drift.

### Gaps
- Dead-code status of `validated-client.ts`, `batchOperations.ts`, `modules/adaptiveRateLimiter.ts`, the `src/server/adapters/*anilist*` adapters, the provider `strategies/` and `metadata/provider-fetcher/` paths was not established; they are outside the enrichment path traced here and may serve search/import UI.
- The memory note about flaky ComicVine timing tests was not re-verified here (see ComicVine section).

---

## ComicVine (all key questions, audited by a delegated sub-agent; I spot-checked the items marked [V*] directly)

Paths in this section are relative to `src/server/services/comicvine/` unless prefixed. Items marked [V] were reported as read-in-code by the sub-agent; [V*] additionally re-read by me; [I] inference.

### Takeaway
ComicVine's live path costs only 2-3 requests for a matched title, but its response cache is commented out, its HTTP client has no timeout, and its rate-limit retry path is broken (a JSON rate-limit response sleeps 60 s then fails; an HTTP 429 blocks the limiter for a full hour because `Retry-After` is never passed). Most of the elaborate protection modules (circuit breaker, retry handler, velocity detector, field optimizer) are not on the enrichment path.

### Cited Findings

Live path
- PPF:1083/1095 → `discovery/language-aware-matcher.ts` → singleton `comicvineService` (`service.ts:523`) → `comicvine/volume-operations.ts` → `ComicVineHttpClient.fetchWithRetry` (`comicvine/http-client.ts:415`) → axios. The only protection layer on it is `modules/rateLimiter.ts` [V].

Endpoints and request cost
- Search: `GET /search` with `query, resources=volume, offset=page*limit, limit=40, field_list=BASIC_VOLUME`, page 0 only, no sort (`modularQueries.ts:334-345`; `discovery/language-aware-matcher.ts:365`) [V*].
- Issues: `GET /issues` with `filter=volume:N, field_list=ISSUE, offset, limit=100`, no sort, hard cap 10 pages = 1,000 issues (`modularQueries.ts:377-387`; `comicvine/volume-operations.ts:279-304`) [V].
- Volume detail: `GET /volume/4050-N` with `field_list=COMPLETE_VOLUME`, manual-binding path only (`comicvine/volume-operations.ts:152-155`; PPF:1035) [V].
- Cost per title: one search per title variant, sequential, breaking on first language-correct match (`language-aware-matcher.ts:359-393`), then ceil(issues/100) issue pages for the winner only; no per-candidate detail fetches [V]. Variants = english, romaji, native, then **every AniList synonym, uncapped** (`language-aware-matcher.ts:111-117`) [V*]. Typical: 2 requests (≤100 issues) or 3 (101-200). A no-match title costs (3 + number of synonyms) searches and no issue fetch. Manual path: 1 + ceil(N/100).
- 60 s phase cap without cancellation (PPF:147, 328-330; `src/server/services/shared/with-timeout.ts:8-10`) [V*]: limiter spacing is 1 s below 50% hourly usage and 3 s from 50%, so a 12-variant no-match title takes 12-36 s plus latency; on timeout the abandoned chain keeps spending quota and, with no cache, the next run repeats it [I]. (High)
- Field-list over-fetch: `BASIC_VOLUME` requests image, genres, concepts, person_credits, characters, volume_number, site_detail_url (`modularQueries.ts:59-74`) while the matcher reads only name, publisher, description/deck, start_year, count_of_issues (`language-aware-matcher.ts:234-258`) and downstream reads only `seriesVolume.name`/`.description` (PPF:552; `PPF/enrichment-result-builder.ts:111`) [V]. `ISSUE` requests person_credits, character_credits, volume, deck, store_date, site_detail_url (`modularQueries.ts:127-142`), none read by `PPF/comicvine-volume-mapper.ts:50-98` [V]. `COMPLETE_VOLUME` on the manual path includes the embedded issues list plus six `*_credits` fields (`modularQueries.ts:96-124`) though only name/description/publisher are consumed [V]. Trimming saves payload/latency, not requests. (Med/Low)
- Search pagination: the code pages `/search` by `offset` (`modularQueries.ts:335-337`); ComicVine's `/search` is believed to paginate by `page` [I/U]. The matcher is unaffected (page 0 only); `searchVolumes` paging (`service.ts:236-240`) probably repeats page 1 [I]. (Low)
- `service.initialize()` re-reads config and rebuilds the axios instance on every operation (`service.ts:122-160`), ~4+ times per title [V]. (Low)

Rate limiting
- Algorithm: sliding one-hour window of timestamps plus an adaptive minimum gap (`modules/rateLimiter.ts:113-167`). Live config: `maxRequestsPerHour 200, minDelayMs 1000, safeDelayMs 3000, maxDelayMs 5000, warningThreshold 0.75` (`service.ts:102-108`) [V*]. Gap is 1 s below 50% usage, 3 s at 50-75%, a 3→5 s ramp at 75-95%, 5 s at ≥95%; at 200 requests it sleeps until the oldest timestamp ages out, up to an hour (`modules/rateLimiter.ts:183-199`) [V].
- Not per-resource: every call uses the `'global'` bucket (`comicvine/http-client.ts:515`) [V*]. If ComicVine's limit is 200 per resource per hour (figure from the brief, [U]), a single global 200/h budget across search/issues/volume is ~3× more conservative than necessary; throughput ≈ 65-100 titles/hour [I]. (Med)
- In-memory and per instance: state is a `Map` plus `globalState` (`modules/rateLimiter.ts:43-44`), not shared via Postgres, lost on restart [V]. Independent callers sharing the same API key each have their own limiter or none: `src/server/adapters/unified-comicvine-adapter.ts:156` (own `new ComicVineService()`), `src/server/services/metadata/chapter-enricher.ts:516` and `metadata/chapter-enricher/comicvine-enricher.ts` (:316, new `FullyProtectedComicVineClient` per call → fresh limiter each time), `comicvine/filename-matcher.ts:257` (raw `fetch` with fixed 2,000 ms sleep at :86), `src/server/parsers/adapters/ComicVineAdapter.ts:213` (own axios, no limiter; imported only by a test) [V]. (High)
- No mutex: `acquireSlot` reads `lastRequestTime`, sleeps, then records (`modules/rateLimiter.ts:223-239`) [V]; concurrent enrichments compute the same delay and fire together [I]. (Med)
- JSON rate-limit retry is broken: `attemptRequest` sleeps `validation.waitTime` (60 s) then throws a plain `ComicVineError('Rate limit retry', 429, true)` (`comicvine/http-client.ts:529-532`) [V*]; `handleHttpError` treats any non-axios error as non-retryable and rewrites it to a 500 (`comicvine/http-client.ts:298-305`) [V*] → a 60 s wait followed by failure, no retry [I]. (High)
- `Retry-After` never read: `handleRateLimitError('global')` is called without the second argument (`comicvine/http-client.ts:190, 235`) [V*], so `blockedUntil` defaults to now + 1 hour (`modules/rateLimiter.ts:270-276`) [V*]; the subsequent retry sleeps the remainder inside `acquireSlot` (:130-131) rather than failing fast [V]. `backoffMultiplier` doubles up to 10 and decays ×0.9 per success (:268, :293) [V]. (High)
- HTTP 420 unhandled: only 401/403, 429, 404 and ≥500 are branched (`comicvine/http-client.ts:325-339`); the only 420 handling is in unused `comicvine/batch-operations.ts:158` [V]. (High if ComicVine still emits 420 for velocity blocks — [U])
- JSON `status_code`: only `1` and `429` are recognised plus a substring match on "rate limit" (`comicvine/http-client.ts:152-160, 184`); codes 100/101/107 are not distinguished [V]. (Med)
- Dead config: `comicvine.rateLimit` default 400 (`configService.ts:39`) is read into an empty `if` (`service.ts:150-153`) [V]. (Low)
- `velocityDetector`, `retryHandler`, `circuitBreaker`, `fieldOptimizer` are used only by `modules/fullyProtectedClient.ts` and tests, not by the pipeline's singleton service [V].

Retries, timeouts, breaker
- No HTTP timeout: `axios.create` has no `timeout` (`service.ts:173-182`) [V*]; a hung socket is bounded only by the non-cancelling 60 s race [I]. (High)
- `maxRetries = 5` (`comicvine/http-client.ts:418`); HTTP 429 backoff 1/2/4/8 s, cap 30 s (:128-131); 5xx backoff 10/20/40/80 s, cap 300 s (:117-120); no jitter [V]. The 5xx cycle totals 150 s against a 60 s phase cap [I]. (Med)
- Network errors (`ECONNRESET`, `ETIMEDOUT`, …) return `shouldRetry: false` (`comicvine/http-client.ts:312-320`) [V]. (Med)
- No circuit breaker on the live path; the only one is in `modules/fullyProtectedClient.ts:138-143` (failure 5, success 3, timeout 60,000 ms, 50%; defaults in `modules/circuitBreaker.ts:73-78`) [V]. (Med)
- Errors swallowed, no negative cache: operations catch and return `null`/`[]` (`comicvine/volume-operations.ts:158-163, 203-206, 309-314`); "not found", "rate-limited" and "outage" are indistinguishable, and an issue-fetch failure yields a match with 0 issues (PPF:1095) [V]. (Med)

Caching
- **The cache is switched off**: the read is commented out under "TEMPORARY: BYPASS CACHE TO DEBUG ISSUE" (`comicvine/http-client.ts:427-435`) and so is the write (:467-470); every call hits the network and logs at WARN twice [V*]. Consequently there is no in-flight dedupe either — `getOrFetch` (`modules/multiTierCache.ts:210-264`, 5 s window) is never called by the http client [V]. (High; re-enabling removes essentially all repeat-enrichment ComicVine requests, 2-3 per title, and frees the scarce 200/h budget [I])
- Configured but unused tiers: L1 `Map` 100 entries/5 min; L2 namespace `comicvine_http`, 1 h TTL via `cacheProvider`; L3 24 h (`comicvine/http-client.ts:59-67`) [V]. That L2 is the `cache_unified` table is inference.
- Key: `comicvine:${url}:${JSON.stringify(params)}` (`comicvine/http-client.ts:80-82`) — param-order sensitive, excludes the API key [V]. (Low) A 1 h TTL is short for immutable issue pages [I].
- `forceRefresh` is not passed to ComicVine (PPF:328-330) — moot while the cache is disabled [V].

Extraction
- `issue_number` parsed with `parseInt(…, 10)` (`PPF/comicvine-volume-mapper.ts:54`; `PPF/enrichment-result-builder.ts:570-580` [V*]) → "12.5" collides with 12; "0", "0.5" and non-numeric specials are dropped by the `<= 0`/`NaN` guard [V]. (High for series with decimal/zero issues)
- Volume `aliases` is not in `BASIC_VOLUME`, so the matcher scores only on `name` (`language-aware-matcher.ts:172-208`) [V] → series listed under a different romanisation are missed [I]. `aliases` is typed `string[]` at `comicvine/types.ts:269` vs `string | null` for issues (:93); the API is believed to return a newline-separated string [I/U]. (Med)
- `page_count` is read at `PPF/comicvine-volume-mapper.ts:68-71` but absent from `FIELD_LISTS.ISSUE`; the comment credits `fieldOptimizer`, which is not on the live path [V] → never populated [I]. (Med)
- Requested volume fields `genres`, `person_credits`, `volume_number`, `resource_type`, `*_credits` are probably not real ComicVine volume fields (API uses `people`, `concepts`, `locations`, `objects`) [I/U — not checked against ComicVine docs]. (Med)
- Fetched but ignored: volume image, start_year and count_of_issues (scoring only), site_detail_url, concepts, characters; issue store_date, person_credits roles, character_credits, site_detail_url, deck. `first_issue`/`last_issue` not requested on the matcher path [V]. Consumed: issue name, description, `image.super_url ?? original_url`, cover_date, associated_images, first line of aliases [V].
- Unchecked casts: `parsedData as T` (`comicvine/http-client.ts:538`), `response.results` with no shape validation (`comicvine/volume-operations.ts:202, 290`); `validated-client.ts` exists but has no importers [V]. (Low)

Hygiene
- Files over 500 lines: `src/server/adapters/unified-comicvine-adapter.ts` 834, `scrapingService.ts` 744, `src/server/parsers/adapters/ComicVineAdapter.ts` 606, `src/server/services/metadata/chapter-enricher.ts` 602, `comicvine/http-client.ts` 540, `service.ts` 523, `discovery/language-aware-matcher.ts` 506 [V].
- `any`: zero across `services/comicvine`, both adapters and `services/search` (ast-grep scan) [V]. `||` used for defaults at `modules/rateLimiter.ts:326`, `modules/fullyProtectedClient.ts:102, 109, 138`, `modules/fieldOptimizer.ts:287, 293, 363, 374` [V].
- Dead/duplicate (no importers found): `validated-client.ts`, `comicvine/batch-operations.ts`, `src/server/services/search/comicvineProvider.ts`; `src/server/parsers/adapters/ComicVineAdapter.ts` imported only by a test; `pagination-helper.ts` used only by `scrapingService` (HTML); `generateComicVineSearchVariants*` and `search-config.ts` not used by the matcher; `service.ts:97-98, 469-519` (`requestQueue`/`queueRequest`/`processQueue`) never called; `src/server/services/metadata/chapter-enricher.ts` duplicates `metadata/chapter-enricher/` [V].
- `search/providers/ComicVineProvider.ts:128, 276` and `search/providers/ComicVineProvider/search-optimizations.ts:384` reuse the singleton (shared limiter) [V].
- Tests: all six suites in `modules/__tests__/` use real timers (no `useFakeTimers`); `phase3-integration.test.ts` waits through real exponential backoff with wall-clock assertions (:146-152) and 60-120 s per-test timeouts (:53, :170, :208); `rateLimiter.test.ts:87` uses a real `setTimeout` [V]. These are the likely source of the "2 flaky ComicVine timing tests" in the memory note `project_flaky_comicvine_timing_tests.md` [I — the note's named tests were not cross-matched]. No tests exist for `http-client.ts`, `volume-operations.ts` or the matcher [V], which is how the disabled cache and broken retry went unnoticed [I].

### Inferences
- With a 200/h global budget, no cache, and 2-3 requests per matched title (more for unmatched), ComicVine is the throughput bottleneck for bulk enrichment (~65-100 titles/hour). Re-enabling the cache, capping synonym variants at ~3 and moving to per-resource buckets are the three changes with the largest effect, in that order.
- A single 429 currently stalls ComicVine for up to an hour inside `acquireSlot` while the pipeline's 60 s timeout silently returns `null` for each title in the meantime, so a bulk run after a 429 persists "no ComicVine match" for every title processed during the block. Failing fast with a typed "rate-limited" result and skipping (not nulling) ComicVine would avoid that.

### Gaps
- ComicVine's documented limits, `/search` pagination semantics, volume field names and current use of HTTP 420 were not checked against comicvine.gamespot.com/api/documentation (no fetch attempted for that page); all such statements are [U].
- Whether L2 maps to `cache_unified` and what was the original reason for disabling the cache ("debug issue") were not determined; `git log -S` on the bypass comment would date it.
