# Wiki-scraping half of the metadata pipeline (Fandom + Wikipedia discovery, fetching, parsing)

Audit basis: repository at HEAD `c2447c1a9` (2026-10-10). Key parser files were last touched 2026-05-20 (`2f6542eae`) and 2026-05-28 (`d99e62ab9`). Survey artifacts date from 2026-03 to 2026-05, so their numbers predate some later code.

Path abbreviations used in citations:

- `FA/` = `src/server/services/fandom/adaptive/`
- `FS/` = `src/server/services/fandom/`
- `WP/` = `src/server/services/wikipedia/`
- `EP/` = `src/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/`
- `SV/` = `scripts/surveys/`

Evidence tags: **[V]** = verified by reading the cited code, running the cited regex/function logic in isolation with node, or a single live request; **[I]** = inference from verified facts. Severity is my assessment (Critical / High / Medium / Low). Finding IDs (D = discovery, P = parsing, C = correctness, F = performance, O = observability, S = surveys, H = code health) are for cross-reference.

## Discovery: how the right wiki/page is found, guards and floors, and where cross-series contamination can still occur

### Takeaway
Fandom wiki-level discovery is a well-guarded 6-tier cascade (0 wrong / 0 false-positive on 445 harness cases), but page-level discovery inside a wiki is largely broken by Cloudflare: every HEAD/GET to a `/wiki/` URL returns 403, silently disabling the 34 generic URL patterns, alternative-URL retry, volume counting and two fallbacks. The cross-series gate only detects *overflow* against AniList's chapter count, is implemented three times with different rules, and falls back to the unreliable MangaDex tier whenever AniList has no chapter count.

### Cited Findings

**Fandom wiki (subdomain) discovery**

- [V] Tier order in `discoverFandomWikiUrl`: manual-unbound sentinel → cached `Metadata.urls` entry → Tier 0 AniList `externalLinks` → Tier 1 direct slug probe → Tier 2.5 animanga interwiki → Tier 3 MediaWiki search on catalog wikis → Tier 4 Fandom search → Tier 5 sub-series/parent fallback. — `EP/wiki-discovery.ts:49-136`, `:148-194`
- [V] Validator floors: `MIN_ACCEPT_SCORE = 0.45` (dice), `REJECT_SCORE_CEILING = 0.25`, `HIGH_CONFIDENCE_SCORE = 0.7` (skip page-existence probe), containment needs shorter string ≥ 5 chars and ≥ 40% of the longer, token-overlap gate rejects when ≥ 50% of sitename tokens (≥ 4 chars) are unexplained. Containment confidence is ratio-scaled `0.55 + (ratio − 0.4) × 0.5`, capped 0.95. — `EP/wiki-discovery/fandom-wiki-validator.ts:63-81`, `:247-261`, `:337-347`
- [V] Alt-title-only sitename matches always run the page-existence probe; the probe batches up to 10 candidate titles (`title`, `title (manga)`, `title (series)`) in one `titles=A|B|C&redirects=1` call. — `fandom-wiki-validator.ts:141-155`, `:398-443`
- [V] 36 generic/catalog subdomains are hard-rejected; `SHARED_CATALOG_DOMAINS` is an empty set, so page-title validation is dead code except when the sitename fetch fails. — `fandom-wiki-validator.ts:27-61`, `:170-174`
- [V] **D1 (Medium).** When `fetchSitename` fails (timeout/5xx) and the URL carries a page path, the validator falls back to `validateByPageTitle` alone for *any* subdomain, the exact weak signal the code comments say is unsafe ("page-title alone is too weak"). A transient siteinfo failure therefore lowers the acceptance bar. — `fandom-wiki-validator.ts:157-174` vs comment at `:53-60`
- [V] **D2 (Medium).** A cached Fandom URL is returned with no re-validation (`urls.find(u => u.includes('.fandom.com'))`); only `forceRefresh` clears it. A wrong binding is sticky across every non-forced enrichment. — `EP/wiki-discovery.ts:60-69`, `:287-299`
- [V] Slug probing generates up to 20 slugs (primary title + first 4 alt titles), including every single non-stopword word ≥ 3 chars and the last word, and probes them sequentially with a 5 s timeout each; a hit also costs a `srsearch=Chapter` request accepting any top-3 title matching `/chapter|volume|episode/`. — `EP/wiki-discovery.ts:362-423`, `:501-561`
- [V] Per-title hard-coding: 68-entry `FANDOM_SLUG_ALIASES`, 14 `KNOWN_DOMAIN_REDIRECTS`, a roughly 85-key `WIKI_SPECIFIC_URL_PATTERNS` table, and a `Pandora_Hearts` category + regex inside generic code. — `EP/wiki-discovery.ts:426-495`, `FA/types.ts:161`, `:342`, `FA/category-chapter-discovery.ts:28-35`, `:239`
- [V] Harness result: across the 16 final ledgers, 363 correct + 81 correct-null + 1 unknown, 0 wrong, 0 missed, 0 false-positive (445 cases); discovery latency p50 1.3 s, p90 9.4 s, max 26.6 s. — `SV/.fandom-discovery-ledger*.jsonl` (last row of each, `iter-Z-final`, 2026-05-05)
- [V] 350 of those 445 cases are synthetic titles whose truth was set from the algorithm's own output after spot-checking ("algorithm output becomes candidate truth"). — memory note `project_fandom_discovery_loop.md` (workflow paragraph), `SV/test-fandom-discovery.ts`

**Fandom page-level discovery (which page inside the wiki)**

- [V] With a `seriesTitle`, `adaptiveParse` first calls `resolveSeriesPageUrl` (MediaWiki API), then 4 slug patterns via `probeUrl`, then generic `discoverBestChapterVolumeUrl`. — `FA/orchestrator.ts:1702-1760`
- [V] **D3 (High).** `probeUrl` issues `HEAD` to the public page URL. A live check on 2026-10-10 returned `403` for `HEAD https://naruto.fandom.com/wiki/List_of_Volumes` and a 5.5 KB Cloudflare challenge (403) for `GET`, while `api.php?action=parse` returned 200 (348 KB). Code comments already say "HEAD probes often fail on Fandom due to Cloudflare blocking" and "Cloudflare blocked ~100% of Volume_N scrapes". — `FA/url-discoverer.ts:128-180`, `:417-419`; `FA/per-volume-iterator.ts:131-136`; live single-page check
- [V] Code paths that depend on those blocked requests: (a) the sequential HEAD loop over wiki-specific + 34 generic `URL_PROBE_PATTERNS` (`FA/url-discoverer.ts:400-415`, `FA/types.ts:109`); (b) content scoring and extraction scoring, which use a direct `fetch` GET (`FA/url-discoverer/scoring.ts:27-49`, `:279-291`); (c) `tryAlternativeBatch` for alternative URLs (`FA/orchestrator.ts:865-872`); (d) `discoverVolumeCount`, which stops at the first non-OK HEAD (`FA/orchestrator.ts:995-1030`); (e) series slug probing (`FA/orchestrator.ts:1725-1734`); (f) `directChapterExtract`, a direct page fetch (`EP/wiki-discovery/direct-chapter-extract.ts:76-83`).
- [V] When HEAD finds nothing, the API fallback re-checks only the first 3 *wiki-specific* patterns, then falls through to `discoverNovelPageNames` (search-based). Wikis outside the hard-coded table get no API check of the generic patterns. — `FA/url-discoverer.ts:419-464`
- [V] Hub-page rejection relies on extraction scoring ("Pattern scoring can be fooled by hub/disambiguation pages … e.g. bleach.fandom.com/wiki/Chapters"), which is one of the blocked GET paths in (b). — `FA/url-discoverer.ts:518-533`

**Wikipedia discovery**

- [V] `findBestMatch` iterates title variants; per variant `searchManga` does 1 OpenSearch (limit 5) + one `prop=extracts` request per hit + 1 "List of X chapters" search whose top result is appended unvalidated. — `WP/wikipedia/manga-extractor/best-match-finder.ts:42-63`; `WP/wikipedia/service.ts:53-112`, `:177-223`
- [V] `selectMainPage` layers: similarity floor `MIN_TITLE_SIMILARITY = 0.30` (bigram dice × length ratio, also on suffix-stripped forms); sub-series suffix gate (SS/NT/OG/SP/Re); manga-relevance keyword regex on the extract; non-manga title-suffix reject; `EXTRACT_NON_MANGA_PROOF`; generic stub titles; paren-disambiguator-not-in-query reject; high-confidence direct hit ≥ 0.85 for queries ≥ 8 chars with a space; best-score pick per tier. — `WP/wikipedia/manga-extractor/best-match-finder-helpers.ts:87-117`, `:119-183`, `:195-235`, `:259-293`, `:310-386`
- [V] Harness: 94.4% on 36 titles at the last ledger row (23 correct, 11 correct-null, 1 wrong, 1 missed, 0 false-positive). — `SV/.wp-discovery-ledger.jsonl` (row `iter-MM-9-B`, 2026-05-16)
- [V] **D4 (Medium).** Disambiguation detection is a string test `extract.includes('may refer to:')` on a 3-sentence plain-text extract, not the `pageprops.disambiguation` flag. — `WP/wikipedia/service.ts:84`; `WP/wikipedia/api-client.ts:160-164`
- [V] **D5 (Medium).** AniList synonyms are not passed to the matcher; alt titles are only tried (first 3) when the primary title returns *no data at all*. — `EP/wiki-discovery.ts:685-696`; `best-match-finder.ts:84-99`
- [V] **D6 (High).** The Wikidata bridge is a last resort, not a verifier. Phase 1 calls `fetchWikipediaChapterData(title, mangaId)` with no hints; the hinted retry runs only when the first result is null; inside, `tryWikidataFallback` runs only when both title-based stages returned nothing. `knownPageTitle` is declared but never set by any caller. A wrong article that yields data is never cross-checked against the AniList-ID→enwiki sitelink. — `EP/phase-provider-fetch.ts:158`, `:256-270`; `EP/wikipedia-fallback/data-fetching.ts:33`, `:54-64`, `:89-107`
- [V] **D7 (Medium).** The MAL branch queries Wikidata property `P4086`, which is "MyAnimeList **anime** ID"; the manga property is `P4087` (labels confirmed via one `wbgetentities` lookup). A MAL *manga* id is matched against anime ids, so the branch either finds nothing or returns an unrelated anime's article title. — `WP/wikidata/article-resolver.ts:5-8`, `:19`, `:52-55`
- [V] The Wikidata request sends `User-Agent: MugiwaraKaizoku/1.0 (manga-metadata-enrichment)` (no contact URL/email) and logs non-200 responses at `debug` only. — `WP/wikidata/article-resolver.ts:15`, `:94-97`, `:107-110`
- [V] "List of X chapters" resolution: exact title lookup → 37-entry `CHAPTER_LIST_ALIASES` → search fallback; sub-page/Part/volumes redirects trigger `fetchAllSiblingSubPages`. — `WP/wikipedia/manga-extractor/chapter-list-extractor.ts:126-164`, `:193-246`
- [V] **D8 (Medium).** Sibling-page relevance is substring containment of the normalised manga title in the page title (`normalizedPage.includes(normalizedManga)`), and `fetchAllSiblingSubPages` has no sequel filter; the 7-item `SEQUEL_SUFFIXES` list exists only in `parseDisambiguationPage`. — `WP/wikipedia/api-client.ts:203-209`, `:274-299`; `chapter-list-extractor.ts:616-668` vs `:458-476`
- [V] The adaptive Wikipedia discoverer batch-checks all candidate titles in one API call but then selects the **largest** page by byte size, both for pattern candidates and for the `intitle:` search fallback. — `WP/adaptive/url-discoverer.ts:431-467`, `:487-543`
- [V] `CHAPTER_LIST_ALIASES` maps `Tokyo Ghoul:re` to `List of Tokyo Ghoul chapters`. — `chapter-list-extractor.ts:139-140`

**Cross-series gate**

- [V] Thresholds: gate when wiki chapters > 2.0 × AniList (AL ≥ 2), or > 1.5 × AL and ≥ +40 absolute with AL ≥ 30; else MangaDex tier (> 2 × MDX, MDX ≥ 10); else sub-series title pattern with > 200 chapters. On gate, `chapterList` and `volumeList` are emptied. — `EP/phase-provider-fetch.ts:423-499`
- [V] **D9 (Medium).** Three separate implementations with different rule sets: `shouldGate` (3 tiers), `filterFandomChaptersByCrossSeriesGate` (2 tiers, no sub-series cap) and `isCrossSeriesWiki` (2× AL + sub-series cap, no tight band, no MangaDex tier). The module header says the mirror "MUST stay consistent". — `EP/phase-provider-fetch.ts:444-473`; `EP/cross-series-gate.ts:9-11`, `:42-69`; `EP/phase-fandom-enrichment.ts:349-365`
- [V] **D10 (High).** The AniList tier is used only when `anilistData.details.chapters` is ≥ 2 (`?? 0` otherwise); with no AniList count the gate uses the MangaDex chapter-list length, the signal the 2026-05-04 fix identified as structurally unreliable. — `EP/phase-provider-fetch.ts:442-467`; memory note `project_chapter_manifest_gate_fix.md`
- [V] The Wikipedia gate counts the *post-normalisation* list, which can include synthetic placeholder chapters (see C1/C2). — `EP/phase-provider-fetch.ts:485-498`; `EP/wikipedia-fallback/data-fetching.ts:66-79`
- [V] **D11 (Medium).** The later Fandom phase re-runs `adaptiveParse(fandomUrl, { fallbackToLegacy, useCache:false })` **without** `seriesTitle`/`seriesAltTitles`, unlike Phase 1. — `EP/fandom-adaptive-bridge.ts:19-24`; `EP/phase-fandom-enrichment.ts:67-68` vs `EP/wiki-discovery.ts:592-598`

### Inferences
- [I] D3 means that, for a wiki not in `WIKI_SPECIFIC_URL_PATTERNS`, page discovery effectively reduces to `resolveSeriesPageUrl` + search-based "novel alias" discovery. The 34 generic patterns, content scoring, hub rejection, alternative-URL merge (Punpun pattern), `discoverVolumeCount` and `directChapterExtract` contribute latency but no results. Caveat: confirmed on one wiki from one IP on one day; production egress could be treated differently.
- [I] D10: AniList commonly reports `chapters: null` for still-releasing series, so ongoing titles are exactly the population that falls to the MangaDex tier and can have a correct Fandom list wiped (the Twin Star Exorcists failure class).
- [I] The gate is one-directional. A wrong wiki/article whose list is shorter than, or within 1.5–2× of, the AniList count passes (e.g. a sequel of similar length, or D8's substring siblings).
- [I] D11: on a shared franchise wiki, if the stored URL is domain-only, the second parse runs generic discovery and can land on the parent series; mitigation depends on Phase 1 having persisted `resolvedPageUrl` (`EP/phase-provider-fetch.ts`, `fetchFandomForPhase1`).
- [I] D5/D6 explain the two residual WP harness misses recorded in memory (Rainbow Days → bare page, Magi → disambiguation only): both are solved by an ID-based lookup (Wikidata P8731 → enwiki sitelink) used *first*, with title search as fallback.
- [I] The 100% Fandom-discovery figure is an upper bound on real accuracy because most truth labels were derived from the algorithm's own output.

### Gaps
- Not verified whether Cloudflare blocks HEAD/GET from the production host, or for all wikis; only one live probe was made (read-only constraint, no bulk scraping).
- I did not trace `resolveSeriesPageUrl` scoring in detail (`FA/series-page-resolver.ts:41-177`) or the interwiki target extraction beyond the catch blocks.
- Whether `ProviderBinding` rejections (binding-as-record) cover Fandom/Wikipedia cached URLs was out of lane and not checked.
- Not measured: how many library titles currently have `anilist chapters = null`, i.e. the real exposure of D10.

## Parsing: structures handled, number and ordering of pattern handlers, failing page classes, and which endpoint is parsed

### Takeaway
Both providers parse **rendered HTML** from `action=parse&prop=text` (cheerio on Fandom, mostly raw regex on Wikipedia chapter lists), using about 11 Fandom structure parsers plus a 7-strategy legacy parser and about 7 Wikipedia list formats, arbitrated mainly by "whichever returns more chapters wins". Wikitext is already fetched in batches of 50 for one enrichment path and was 20× smaller in a live check, which makes template-level wikitext parsing the cheaper and more stable primary for chapter pages.

### Cited Findings

**Endpoints**

- [V] Fandom pages are fetched with `api.php?action=parse&page=…&prop=text&redirects=1` via axios, 30 s default timeout. — `FS/utils/mediaWikiApiFetch.ts:151-183`
- [V] Wikipedia pages use `action=parse&prop=text|sections&redirects` (by title) or `action=parse&pageid=…&prop=text`. — `WP/wikipedia/api-client.ts:315-335`
- [V] Wikitext is used in one place: batch `revisions` queries (50 titles per request, `redirects=1`) to pull chapter numbers and titles from infobox template parameters. — `FA/category-chapter-discovery.ts:270-300`, `:340-357`, `:424-480`
- [V] Live size comparison for one page (naruto `List_of_Volumes`): `prop=text` 348,019 bytes in 0.54 s; `prop=wikitext` 17,268 bytes in 0.34 s. — single live check, 2026-10-10
- [V] No FlareSolverr import or reference exists anywhere under `FS/`, `WP/` or `EP/`. — ast-grep import/string scan (0 matches)

**Fandom handlers and ordering**

- [V] 11 structure parsers: alternating-row, arc-based, bulleted-list (plus an "enhanced" variant with 5 sub-extractors), category-page, collapsible-table, id-volume-table, jojo, numbered-row, paragraph-link, plain-table, shifted-column. — `FA/orchestrator.ts:21-57`; `FA/bulleted-list-parser.ts:474-884`
- [V] Legacy `parsePageAdaptive` has strategies labelled 1, 1b, 1c, 1d, 1e, 2, 3 across 4,044 lines. — `src/server/services/metadata/utils/fandom-table-parser/` (label scan)
- [V] Order inside `tryExtractFromUrl`: id-volume-table (accept if ≥ 50 chapters) → JoJo (≥ 50) → static-analysis recommended parser (confidence ≥ 0.6; early return needs ≥ 3 volumes, ≥ 5 chapters, density ≥ 3) → legacy table parser → alternatives in fixed order (JoJo, id-volume, alternating-row, bulleted, standalone tables, table-list, plain-table, shifted-column, arc-based, numbered-row, category-page, collapsible, enhanced table-list) → acceptance thresholds → paragraph-link and gallery fallbacks. — `FA/orchestrator.ts:303-797`
- [V] Arbitration between parsers is by count: a later parser replaces the result when `chapters.length >` the current count (e.g. lines 409, 423, 439, 463), and static-analysis chapters replace the result when 5× larger or when they carry > 2× more non-generic titles. — `FA/orchestrator.ts:373-386`, `:405-477`, `:686-702`
- [V] Post-extraction supplements in `adaptiveParse`: "Volume N Chapters:" labels, `Category:Volumes`, per-volume page iteration (up to 8 call sites, memoised only for *failures*), category/allpages chapter discovery, Volume 0 probe, per-chapter page details, wikitext title enrichment. — `FA/orchestrator.ts:1661-1678`, `:1857-2248`
- [V] Per-volume page extraction has 3 strategies (Chapter_N links → `li` text → `table tr` text) plus section headings. — `FA/per-volume-iterator.ts:313-408`, `:674-712`
- [V] Further fallback layers outside the adaptive parser: `directChapterExtract` (links, cells, `N. Title` text lines), the legacy `scrapeFandomChapters` scraper, and `extractFromMediaWikiApi` (always runs). — `EP/wiki-discovery/direct-chapter-extract.ts:58-97`; `EP/phase-fandom-enrichment.ts:84-104`
- [V] Rowspan handling exists for Wikipedia volume tables only (`fillFromRowspans`, `setupRowspan`, `propagateRowspan`). — `WP/wikipedia/table-normalizer.ts:160-233`

**Wikipedia handlers and ordering**

- [V] `parseChapterTables`: chapter-range pattern → page-structure hints → format hints → `extractChapterMatches` (numbered-with-quotes regex vs `<ol start>`/bare `<ol>` extraction, then special chapters, then "One Piece style") → zero-indexed pattern (skipped for ol-start) → numbered-chapters pattern → artifact filter (> 50% CSS/DOM-artifact titles rejects the batch). — `WP/wikipedia/chapter-parser/index.ts:46-123`, `:141-228`
- [V] Chapter extraction runs regexes over the whole raw HTML string, e.g. `/(\d{1,3}(?:\.\d+)?)\.\s*["""]([^"""]+)["""]?/g` and a quoted-`<li>` pattern. — `chapter-parser/index.ts:150`, `:193`, `:251`, `:299`, `:334`
- [V] The quote character classes contain three identical ASCII `"` bytes (`5b 22 22 22 5d`) although the comment says "Match both curly quotes … and regular double quotes". — `chapter-parser/index.ts:149-150`, `:193` (hex dump)
- [V] Three overlapping Wikipedia sub-pipelines run per title and are merged: `findBestMatch` (getMangaInfo + `wikipediaVolumeExtractor` + volume-list URL + `getChapterList`), `adaptiveExtract` (static analyser + media-section parser), and an optional adaptive retry. — `WP/wikipedia/manga-extractor/best-match-finder.ts:138-185`; `EP/wikipedia-fallback/data-fetching.ts:56-61`, `:266-334`
- [V] A title-specific module exists: `fire-force-extraction.ts` (222 lines). — `WP/wikipedia-extractor/fire-force-extraction.ts`

**Known failing page classes (from memory notes and checked-in results)**

- [V] Recorded residual Fandom failures: Death Note first-tab chapters 1–7 (title-based links without `Chapter_N`), Tokyo Ghoul:re (shares the base-series wiki). Recorded Wikipedia failures: no chapter list exists (Goodnight Punpun), partial sub-page extraction (Ace of Diamond), sparse coverage (Horimiya, Kaguya-sama). — memory note `project_parser_accuracy_loop.md`
- [V] Broad sample (50 titles, 2026-04-14): Witch Hat Atelier title ratio 0.02 and Kaiju No. 8 0.18 ("partial-titles"), 3 "fandom-miss" (Konosuba, Gintama, Toradora), 1 count mismatch (Deadman Wonderland 57 vs 47). — `SV/broad-sample-results.json`
- [V] 300-title stratified sample conclusion recorded in memory: 86 titles have Wikipedia volume tables but no chapter data; 46 differ by sequel counting; 2 real parser bugs. — memory note `project_parser_improvement_loop.md`

### Inferences
- [I] "More chapters wins" arbitration rewards over-extraction: a parser that misreads dates, page counts or ISBN fragments as chapter numbers (see C4, C5) returns a longer list and therefore beats a correct shorter one. No arbitration step scores sequence plausibility (contiguity, monotonic volume order, duplicate rate).
- [I] The curly-quote character classes were probably flattened by an encoding normalisation at some point; rendered Wikipedia HTML mostly uses straight quotes, so impact is likely small, but any page using typographic quotes around chapter titles is silently unmatched.
- [I] A wikitext-first design would be more reliable for the dominant cases: Wikipedia chapter lists are built from `{{Graphic novel list}}`/`{{Numbered list}}` templates with explicit parameters (volume number, release dates, ISBN, chapter list), and Fandom chapter pages carry infobox parameters the code already reads. Parsing parameters avoids rowspans, skin markup and quote heuristics; rendered HTML stays as fallback for hand-written tables. Wikidata is useful for *binding* (P8731 → sitelink), not for manifests.
- [I] `action=query&prop=revisions&rvprop=content|ids` (up to 50 titles per call) also returns revision ids, which would enable a revision-keyed raw cache (see F7).

### Gaps
- No checked-in data says which Fandom parser wins how often in production; `structureType` is logged (`EP/fandom-adaptive-bridge.ts:32-36`) but not persisted or surveyed.
- I did not read all 11 parser files line by line; `alternating-row`, `arc-based`, `collapsible`, `shifted-column`, `paragraph-link`, `category-page`, `jojo` and `id-volume-table` were only outlined.
- Whether Wikipedia list pages in the library actually use the templates named above was not sampled (no bulk fetching allowed).
- The legacy `FS/dynamic/` and `FS/fandom/` trees (≈ 6k lines) were not traced for liveness beyond `scrapeFandomChapters` being called.

## Correctness traps: number vs index, generic titles, ISBN rows, bonus chapters, uncollected chapters, title language, ranges, duplicates

### Takeaway
Several traps are verifiably open at the source level: the Wikipedia path fabricates placeholder chapters and overwrites the infobox count with a self-derived `max + 1`; real chapters numbered 978/979 are dropped everywhere; chapter numbers ≥ 1000 are truncated by a 3-digit regex; and two chapter-number extractors read dates, page counts and English ISBNs as chapters. Volume/duplicate handling differs between the two Fandom consumers.

### Cited Findings

- [V] **C1 (High) — self-derived count plus one.** `calculateAccurateChapterCount` returns `maxRegularChapter + maxEpilogueOffset + 1` unconditionally ("+1 for chapter 0 if present"), and `finalizeMangaInfo` overwrites `result.chapters` with it whenever a chapter list exists. Downstream code treats `data.chapters` as the *infobox-declared* count. — `WP/wikipedia/manga-extractor/best-match-finder.ts:203-235`, `:245-249`; consumers `EP/wikipedia-fallback/data-fetching.ts:113-125`, `:272-275`, `:449-457`; `EP/wiki-discovery/chapter-normalization.ts:30-35`
- [V] **C2 (High) — synthetic chapters labelled as Wikipedia data.** Stage 4 appends `Chapter N` placeholders from `maxNum + 1` for `(target − extracted)` items, with the "infobox" count first in priority. For a complete list 1..N, C1 makes target = N + 1, so one phantom `Chapter N+1` is appended. Stage 2.5b replaces the whole list with `1..bestCount` placeholders when extraction is < 30% of the best count (cap 2000). `getChapterList` also pads placeholders up to a list-item-derived max when it exceeds parsed count × 1.2. — `EP/wikipedia-fallback/data-fetching.ts:133-177`; `WP/wikipedia/manga-extractor/chapter-list-extractor.ts:274-283`
- [V] Stage 4 arithmetic uses list *length* against a *count* target but numbers from the *max*: a list with internal gaps or decimals (length < max) is extended past the target. — `data-fetching.ts:164-174`
- [V] `generateMissingChapterList` builds `Chapter i` for every i up to the max chapter found in volumes, assigning volume `0` when unknown. — `best-match-finder-helpers.ts:689-728`
- [V] **C3 (High) — real chapters 978 and 979 are deleted.** Both normalisers drop any chapter whose number equals 978 or 979 as an "ISBN fragment", with no context check. — `EP/wiki-discovery/chapter-normalization.ts:40`, `:200`, `:234`; helper `FA/utils/isbn-filter.ts:10-12`
- [V] **C4 (High) — chapter numbers ≥ 1000 are truncated.** The main Wikipedia regex captures `\d{1,3}` with no left boundary: `1050. "Luffy vs Kaido"` yields chapter `050` (node test). `extractMaxChapterFromListItems` also ignores numbers ≥ 1000, and `directChapterExtract` allows 4 digits. — `WP/wikipedia/chapter-parser/index.ts:150`; `chapter-list-extractor.ts:69`; `EP/wiki-discovery/direct-chapter-extract.ts:65`
- [V] The same regex matches sentence-final years: `in 1999." <a href="…` yields chapter `999` with title ` <a href=` (node test). The artifact filter only rejects when > 50% of titles are artifacts. — `chapter-parser/index.ts:150`, `:96-123`
- [V] **C5 (High) — dates, page counts and ISBNs read as chapters (Fandom).** Per-volume extractor (used on every `li` and every `table tr` when no `Chapter_N` links exist): `"Released March 4, 2019"` → 4 (the `ch\.?\s*(\d+)` pattern matches inside "Mar**ch 4**"), `"192 pages"` → 192, `"2019-03-04"` → 2019, `"978-4-08-880220-9"` → 978, `"ISBN 978-0-316-12345-6"` → 0.316. The bulleted-list extractor (applied to every `td, th` line) gives the same results except the "March" case. — `FA/per-volume-iterator.ts:252-279`, `:356-402`; `FA/bulleted-list-parser.ts:61-92`, `:275-304` (node test of both functions)
- [V] Only 4 of the 11 structure parsers import the ISBN context filter (`id-volume-table`, `numbered-row`, `jojo`, `plain-table`); `bulleted-list` and `per-volume-iterator` do not. — ast-grep string scan for `isbn-filter`
- [V] **C6 (Medium) — duplicate policy differs by consumer.** Phase 1 `normalizeFandomChapters` is last-writer-wins on the flat list (`byNumber.set` without a `has` check); the later bridge sorts by volume and is first-writer-wins explicitly to stop bonus chapters in late volumes overwriting real ones. — `EP/wiki-discovery/chapter-normalization.ts:155-160` vs `EP/fandom-adaptive-bridge.ts:69-96`
- [V] **C7 (Medium) — chapter 0 handling differs.** Phase 1 normaliser drops `num <= 0`; the bridge's flat path keeps chapter 0 ("legitimate in Dragon Ball, FMA"); its nested path drops `<= 0`. — `chapter-normalization.ts:199`, `:233`; `fandom-adaptive-bridge.ts:79-81`, `:106`
- [V] Prequel "Chapter 0-1" is encoded as `0.1`; "0-10" would become `0.10` = `0.1` (same float). — `FA/per-volume-iterator.ts:254-264`; `FA/bulleted-list-parser.ts:63-73`
- [V] **C8 (Medium) — special chapters get non-numeric numbers.** Epilogue/Prologue/Special/Extra/Omake/Bonus matches get `chapterNumber` like `"Epilogue 1"` or bare `"Special"`; the normaliser passes strings through `parseChapterToken` and skips nulls, so each special is either dropped or reduced to a bare number that can collide with a regular chapter (which of the two depends on `parseChapterToken`, not read). Dedup against numbered chapters is by lower-cased title only. — `WP/wikipedia/chapter-parser/index.ts:184-220`; `chapter-normalization.ts:94-100`, `:38-39`
- [V] **C9 (Medium) — per-volume renumbering turns numbers into ordinals.** When raw count > 2× unique numbers and volumes exist, chapters are renumbered `1..N` by (volume, original number); the sibling-page path renumbers by array index when dedup collapses > 3×, with the comment "sub-pages are already in chapter order", but page order is search-result order from two queries. — `chapter-list-extractor.ts:98-123`, `:616-668`; `api-client.ts:281-289`
- [V] "One Piece style" extraction numbers every `"quoted" (parenthetical)` match in the HTML by its index. — `chapter-parser/index.ts:330-361`
- [V] **C10 (Medium) — wikitext title capture truncates at `|`.** Patterns capture `[^\n|}]+`, so `|title = [[Romance Dawn (chapter)|Romance Dawn]]` yields `[[Romance Dawn (chapter)` and `|title = {{Nihongo|The Storm|嵐|Arashi}}` yields `{{Nihongo`; both pass the acceptance test (length ≥ 2, not numeric/generic). — `FA/category-chapter-discovery.ts:282-300`, `:312-334` (node test)
- [V] Title-language order: `ch_title`, `chapter_title`, `english_title`, `ename`, `etitle`, `title`, `name`, `english`, then `jname/japanese/jp_title`. A ≥ 2-character Japanese `|title` wins over `|english`; the Japanese fallback is deliberate. — `category-chapter-discovery.ts:282-300`
- [V] Generic-title detection is re-implemented with different regexes: `^Chapter\s*\d+$`, `^(Chapter|Ch\.?)\s*\d+$` with and without an "has a letter" test, and `^Chapter\s+\d+$`. — `FA/orchestrator.ts:377`, `:1892`, `:2009`, `:2217`; `category-chapter-discovery.ts:328`, `:555-557`; `EP/wikipedia-fallback/data-fetching.ts:353-356`
- [V] Category discovery is skipped when *any one* existing chapter has a non-generic title (`.some(...)`). — `FA/orchestrator.ts:2008-2011`, `:2216-2219`
- [V] Wikitext title enrichment is capped at 300 chapters; the adjacent comment claims the cap covers "Bleach 686". — `category-chapter-discovery.ts:507-510`
- [V] Volume ranges: Phase 1 derives `chapterStart/End` as min/max of chapter numbers assigned to the volume. — `chapter-normalization.ts:294-312`, `:321-342`
- [V] Volume inheritance: chapters without a release date inherit the volume's release date. — `chapter-normalization.ts:178-186`, `:246-248`, `:84-90`
- [V] Wikipedia volume numbers are `parseInt(vol.number) || 0`. — `best-match-finder-helpers.ts:424`
- [V] Year guard: `isLikelyYearContamination` requires `num > declaredCount × 2`. — `chapter-normalization.ts:107-119`

### Inferences
- [I] C1 + C2 together are a deterministic source of "phantom end-of-series chapter" rows on the `findBestMatch` path; this matches the symptom class described in memory (`project_phantom_end_of_series_fix.md`: AoT ch 140/141). The 2026-06-29 fix added downstream ceilings and pruning; the generator itself is still present. Whether the phantom survives merge is for the consensus/persistence researchers.
- [I] C1 also makes several "infobox credibility" checks circular: one stray extracted number (e.g. 1999 from C4) raises the "declared" count to 2000, which disables the year guard (`num <= declared × 2`) and can trigger Stage 2.5b to replace the list with 2000 placeholders.
- [I] C3/C4 affect exactly the long-running series (One Piece, Detective Conan, Hajime no Ippo, Kochikame, Golgo 13) where chapter-level accuracy is most visible. One Piece's Wikipedia path may be shielded by the "one-piece" format hint, which instead numbers by index (C9).
- [I] C5's "March N" misread only occurs on wikis whose volume pages lack `/wiki/Chapter_N` links (strategies 2 and 3), which are the title-linked wikis where the parser has the least other signal.
- [I] Min/max volume ranges plus C6's last-writer-wins mean one bonus chapter with a reused low number in a late volume can stretch that volume's range across the series (the "garbage volume ranges" class noted in memory).
- [I] Chapters not yet collected in tankōbon have no explicit representation: Fandom leaves them without a volume, and the Wikipedia path may assign volume `0` (`generateMissingChapterList`) or inherit nothing; I found no "uncollected" flag in the wiki normalisers.
- [I] Inheriting the volume release date as a chapter release date stores a tankōbon date where a magazine date is expected.

### Gaps
- Not checked whether a downstream filter removes titles starting with `[[` or `{{` (C10), or drops volume `0`.
- Not checked how often `calculateAccurateChapterCount`'s +1 coincides with a real chapter 0.
- `parseChapterToken` (`@/server/parsers/chapter-number-extractor`) and the `zero-indexed`/`numbered-chapters` format files were not read.
- None of the C-findings were reproduced end to end against the database (read-only audit, no enrichment runs).

## Performance: requests per title, parallelism, caching and TTLs, parser cost, regex backtracking, User-Agent/429 handling, FlareSolverr

### Takeaway
The Fandom chain is the slowest part of enrichment (broad-sample p50 18 s, p90 103 s against a 60 s non-cancelling cap) and is run twice per enrichment with caching disabled; much of its request budget goes to Cloudflare-blocked probes. One Wikipedia regex has verified exponential backtracking that blocks the event loop for seconds to hours on an unquoted list item.

### Cited Findings

**Latency and timeouts**

- [V] Phase 1 wraps each provider in `withTimeoutOrNull(…, 60_000)`; the helper "does NOT cancel the underlying work — it only stops awaiting". — `EP/phase-provider-fetch.ts:147-160`; `src/server/services/shared/with-timeout.ts:8-11`
- [V] Fandom parse durations in the 50-title broad sample: p50 18.1 s, p90 102.7 s, max 180 s; 9 of 41 parses (22%) exceeded 60 s and 3 exceeded 120 s. — `SV/broad-sample-results.json` (`fandomDurationMs`, 2026-04-14)
- [V] Whole-enrichment durations: p50 52 s, p90 136 s, max 225 s (n = 500, 2026-04-16); p50 30 s, p90 47 s (n = 30, 2026-04-19); 59.6 s average over 50 cold imports (2026-05-07). — `SV/baseline-results-n500.json`, `SV/baseline-results-r6-n30.json`, `SV/.50-titles-import-report-v1.md`
- [V] After a Fandom timeout, up to two more 60 s attempts run (AniList-link retry, alt-title retry). — `EP/phase-provider-fetch.ts:277-306`
- [V] **F1 (High).** `adaptiveParse` runs twice per enrichment: in Phase 1 (`fetchFandomChapterData`) and again in `phaseFandomEnrichment` (`tryAdaptiveParser`), both with `useCache: false`; the second is followed by a chapter-detail phase, optionally the legacy scraper, and always the MediaWiki fallback. — `EP/wiki-discovery.ts:592-598`; `EP/fandom-adaptive-bridge.ts:19-24`; `EP/phase-fandom-enrichment.ts:67-99`

**Request counts (from code; not instrumented)**

- [V] Discovery, cold: up to 20 sequential slug probes (+1 search per hit), 1–2 validator calls per candidate, 2 catalog wikis × (1 search + up to 3 link lookups), 2 catalog searches, Fandom search, then Tier 5 repeats direct/interwiki/search for parent variants. — `EP/wiki-discovery.ts:93-133`, `:148-194`, `:368-398`; `EP/wiki-discovery/interwiki-discovery.ts:41-63`
- [V] Page discovery: 1–2 resolver calls, 4 HEAD probes, then a **sequential** HEAD per candidate (wiki-specific + 34 generic; stops only after 8 hits), ≤ 3 API checks, search-based alias discovery, then 2 GETs per existing URL for scoring. — `FA/orchestrator.ts:1711-1734`; `FA/url-discoverer.ts:400-415`, `:419-464`, `:493-533`
- [V] Extraction and supplements: 1 parse fetch; up to 15 alternative URLs in batches of 3; `Category:Volumes`; per-volume iteration at concurrency 3 with a 1.5 s sleep-and-retry on any null; `discoverChaptersViaCategory` called at up to 2 points on the success path (3 call sites, no memo) with up to 5 category enumerations + allpages + up to 6 wikitext batches each; Volume 0 probe; 2–3 metadata fetches. — `FA/orchestrator.ts:913-959`, `:1056-1062`, `:2012`, `:2220`, `:2265`, `:2158`, `:2185-2193`; `FA/per-volume-iterator.ts:166-194`; `FA/category-chapter-discovery.ts:63-70`, `:507-527`
- [V] **F2 (High).** Per-chapter detail fetches are uncapped: one `action=parse` request per chapter with a URL and no cover, issued from two places in the same parse; the comment says "cap at 500 to avoid long hangs" but no cap is applied. Batch size 75, 50 ms delay. — `FA/orchestrator.ts:2160-2173`, `:1411-1433`; `FS/chapter-detail/batch-processor.ts:174-175`, `:413-414`
- [V] `enrichChapterDetailsFromPages` re-fetches the already-parsed page HTML to scrape chapter URLs. — `FA/orchestrator.ts:1400-1408`
- [V] Wikipedia `searchManga`: 1 OpenSearch + up to 5 separate extract requests (parallel) + 1 list search, per title variant. — `WP/wikipedia/service.ts:186-213`
- [V] Wikipedia sub-pages are fetched in parallel with no concurrency limit (`Promise.allSettled` over all siblings). — `chapter-list-extractor.ts:626-635`

**Caching**

- [V] Fandom pattern cache is bypassed by every pipeline caller (`useCache: false`). — `EP/wiki-discovery.ts:594`; `EP/fandom-adaptive-bridge.ts:23`
- [V] The only Fandom HTML cache is per-volume-iterator's in-process map: 5 min TTL, 50 entries, successes only. — `FA/per-volume-iterator.ts:152-194`
- [V] Chapter-detail service documents an L1 5 min / 500 entries and L2 24 h cache. — `FS/chapter-detail/constants.ts:15-16`
- [V] Wikipedia two-tier cache and pattern cache are disabled by stubs ("stale parsed data … making parser improvements ineffective"). — `WP/wikipedia/manga-extractor/index.ts:71-86`, `:285-288`
- [V] Remaining Wikipedia caches are in-process Maps with a 1 h TTL, expiry checked only on `get`, no size bound; `getChapterList` still caches **parsed** chapters under `chapters:${title}`. — `WP/wikipedia/utils.ts:30-52`; `manga-extractor/index.ts:65`; `chapter-list-extractor.ts:185-190`, `:285`; `service.ts:160-164`
- [V] No cache anywhere stores raw HTML/wikitext keyed by page revision. — reading of the fetch utilities above

**Parser cost**

- [V] cheerio is the only HTML parser (134 importing files under `src/server`, 90 wiki-related); 85 `load(...)` call sites in the wiki directories. — ast-grep import and call scans
- [V] Each structure parser takes the HTML **string** and loads it itself, usually once in `isXStructure` and once in `parseX` (2 load sites per parser file; 6 in `bulleted-list-parser.ts`). `tryExtractFromUrl` additionally loads once itself and calls the static analyser and legacy parser. — `FA/orchestrator.ts:313-363`, `:405-653`; per-file `load(` counts
- [V] `extractChaptersFromVolumePage` accepts an optional pre-loaded `$`, showing the reuse pattern exists but is not general. — `FA/per-volume-iterator.ts:313-319`

**Regex backtracking**

- [V] **F3 (Critical for availability).** `extractQuotedLiChapters` uses `/<li(?:\s[^>]*)?>(?:[^<]*?|<[^>]*>)*?[\u0022\u201C\u201D]([^\u0022\u201C\u201D<]+)[\u0022\u201C\u201D]/gi` (a lazily repeated group whose first alternative can split any text run in every possible way). On a single `<li>` with an unquoted title and no later text-level quote, node measured 0.05 s at 20 chars, 0.78 s at 24, 3.4 s at 26 and 14.3 s at 28 (×4 per 2 chars, i.e. 2ⁿ). It runs first on every `<ol>` of every Wikipedia chapter page, and the unquoted-`<li>` fallback exists precisely for lists without quotes. — `WP/wikipedia/chapter-parser/index.ts:239-264`, `:295-319` (node benchmark)
- [V] A heuristic scan of 1,399 regex literals found 4 nested-quantifier candidates; the other 3 (`EP/utils.ts:107`, `EP/fandom-mediawiki-fallback/chapter-title-patterns.ts:294`, `:319`) were not benchmarked. 30 literals use `[\s\S]*?`. — ast-grep regex scan
- [V] `extractMaxChapterFromListItems` and `countOlLiInWikitables` run global `[\s\S]*?` regexes over the full page HTML. — `chapter-list-extractor.ts:44-70`

**User-Agent, 429, FlareSolverr**

- [V] Wikipedia API client sends `MugiwaraKaizoku/1.0 (https://github.com/mugiwara-kaizoku; manga-metadata-fetcher) axios/1.x`, 30 s timeout, 3 attempts with `Retry-After`/exponential backoff on 429 and 503 only. The same client is duplicated in two files. — `WP/wikipedia/api-client.ts:26-126`; `WP/wikipedia-extractor/api-client.ts:34-118`
- [V] The contact URL in that UA is not the repository named in the memory note's known-good UA (`github.com/Rorqualx/Mugiwara-Kaizoku` + email). — memory note `feedback_wikipedia_bot_header.md`
- [V] At least 10 distinct User-Agent strings are used across wiki code, including misspellings (`MuggiwaraBot`, `MugiwariKaizoku`) and a bare `Mozilla/5.0`; 23 sites use `MugiwaraKaizoku/1.0 (manga-metadata-fetcher)` with no contact. `fetchSitename` and `findExistingMangaPage` send no UA at all. — ast-grep string scan; `EP/wiki-discovery/fandom-wiki-validator.ts:365-379`, `:405-411`
- [V] Fandom `fetchPageWithRedirectInfo` has no retry or 429 handling; it logs and returns null. — `FS/utils/mediaWikiApiFetch.ts:170-182`
- [V] FlareSolverr is not used by any wiki code path. — ast-grep scan (0 matches)

### Inferences
- [I] With a 60 s cap that does not cancel, a slow Fandom parse is abandoned but keeps issuing requests while the retry starts another full parse against the same host; this plausibly explains the "later calls hit MW API rate limits" comment at `FA/orchestrator.ts:1942-1945`.
- [I] D3 means roughly 40 sequential HEAD requests (≈ 0.17 s each when 403 is fast, up to 5 s each on timeout) are spent per cold parse for no information.
- [I] F3 is not interruptible: a synchronous regex blocks the event loop, so the 60 s timeout timer cannot fire and the whole server process stalls. At 2ⁿ growth, a 40-character unquoted item is on the order of a day. Measured on node/V8; Bun's JavaScriptCore regex engine is also backtracking, so the same class of blow-up is expected but was not measured.
- [I] A single 348 KB page is parsed by cheerio on the order of 10–25 times in one `tryExtractFromUrl` call; passing one loaded `$` through the parser interfaces would remove that. Actual CPU time was not measured.
- [I] A revision-keyed raw-content cache (`page + revid → wikitext/HTML`) would give the "parser fixes take effect immediately" property that motivated disabling the parsed-result caches, while removing the duplicate fetches in F1/F2.
- [I] Batching (`titles=A|B|C` with `prop=extracts|pageprops`, and `revisions` for chapter pages) could replace most per-page `action=parse` calls: the 5 extract requests per search, and the per-chapter detail fetches where only infobox fields are needed.

### Gaps
- No instrumentation exists for requests-per-title; counts above are static upper bounds, not measurements.
- Survey latencies predate the `findVolumeUrlPattern` parallelisation and failure memo, so current tail latency may be better than the April figures.
- cheerio load time per page was not benchmarked.
- I did not confirm whether `isAlreadyEnriched` (`EP/phase-fandom-enrichment.ts:368-381`) short-circuits the second parse in practice.

## Observability: ParseFailureLog usage, what is recorded, and what it implies about unhandled patterns

### Takeaway
`ParseFailureLog` cannot answer "which patterns are unhandled": it has 5 write sites, all in exception handlers for network/discovery calls, none passing `mangaId`, none inside any parser, and nothing in the repository reads the table. The dominant failure mode, a parser returning zero or too few chapters without throwing, is recorded only in transient logs.

### Cited Findings

- [V] Schema: `id, source, url, stage, mangaId?, reason, contextJson?, createdAt`, indexed on `(source, createdAt)`, `(mangaId)`, `(stage, createdAt)`. — `prisma/schema.prisma` (`model ParseFailureLog`)
- [V] Logger: context truncated to 2,048 bytes; insert failures are swallowed with a warning. — `src/server/services/metadata/parse-failure-logger.ts:6-47`
- [V] All call sites (5): catalog search failure, interwiki search failure, direct-extract fetch exception, `findBestMatch` exception, adaptive-supplementation exception. — `EP/wiki-discovery/mediawiki-search-discovery.ts:56`; `EP/wiki-discovery/interwiki-discovery.ts:70`; `EP/wiki-discovery/direct-chapter-extract.ts:104`; `EP/wikipedia-fallback/data-fetching.ts:250`, `:325`
- [V] None of the 5 sites passes `mangaId`; `reason` is the exception message. — same files
- [V] `findBestMatch` and `getChapterList` catch their own errors and return null/[] before the pipeline-level catch, so the two Wikipedia sites fire only for errors thrown outside those functions. — `WP/wikipedia/manga-extractor/best-match-finder.ts:122-127`; `chapter-list-extractor.ts:287-292`
- [V] No reader: the only `parseFailureLog.*` call in `src/` and `scripts/` is the `create`. — ast-grep scan
- [V] The type allows `comicvine | mangadex | kitsu` sources, but no such call sites exist. — `parse-failure-logger.ts:8`
- [V] No call site in `FA/` (orchestrator, 11 parsers, per-volume iterator, category discovery) or in `WP/` parsers. — ast-grep scan
- [V] Silent-null patterns: `tryExtractFromUrl` returns `{ success: false, url }` from a bare `catch {}`; sitename/page-existence failures log at debug; Wikidata failures log at debug; `directChapterExtract` returns `[]` on any non-OK response without logging. — `FA/orchestrator.ts:794-796`; `EP/wiki-discovery/fandom-wiki-validator.ts:375-378`, `:422-425`; `WP/wikidata/article-resolver.ts:94-110`; `direct-chapter-extract.ts:83`
- [V] The parser that won, its confidence and counts are written to the info log only. — `EP/fandom-adaptive-bridge.ts:32-36`

### Inferences
- [I] Because of D3, `direct-chapter-extract.fetch` rows will be rare even though that fallback fails on essentially every call: a 403 is `!response.ok` → `[]`, not an exception.
- [I] The table as written measures catalog-wiki API instability, not parser coverage; no ranking of "top unhandled patterns" can be derived from it.
- [I] Useful structured outcomes would be: zero/low-yield parses (page URL, revision id, chosen parser, counts by parser, expected count), gate trips (which tier, counts), placeholder synthesis (how many chapters were fabricated), and timeouts; keyed by `mangaId`.

### Gaps
- The table's contents (row counts by stage) were not queried; database access was out of scope.
- I did not check whether any dashboard or tRPC route reads the table through raw SQL.

## Survey artifacts: current coverage and residual error

### Takeaway
Checked-in results show strong wiki-level discovery (Fandom 0 wrong on 445 cases, Wikipedia 94.4% on 36) but weak chapter-field completeness: `Chapter.title` is the most-missing field in every sample, 68% of the surveyed library had neither wiki, and 7 of 45 Wikipedia bindings in the 50-title cold import scored below the 0.55 similarity threshold. The two HTML-pattern survey scripts have no checked-in outputs.

### Cited Findings

- [V] Library tier distribution at survey time (9,549 titles): `neither` 6,487 (67.9%), `wiki_only` 2,518 (26.4%), `fandom_wiki` 384 (4.0%), `fandom_only` 160 (1.7%). — `SV/baseline-results-n500.json`, `SV/baseline-results-r6-n30.json` (`tierDistribution`)
- [V] n = 500 (2026-04-16): overall completeness median 73.8; chapters median 67.1; volumes median 73.3; per tier `fandom_wiki` 87.5 (25 titles), `fandom_only` 84.7 (25), `wiki_only` 75.05 (132), `neither` 72.3 (318). Top missing fields (titles affected): `Volume.isbn` 434, `Chapter.title` 432, `Volume.pageCount` 426, `Chapter.releaseDate` 350, `Volume.releaseDate` 254, `Chapter.volumeId` 230. — `SV/baseline-results-n500.json` (`summary`)
- [V] Round 6, n = 30 (2026-04-19): overall median 93.15, chapters median 86.1, volumes 92.7; top missing `Chapter.title` 25, `Chapter.releaseDate` 22, `Chapter.pages` 21, `Volume.pageCount` 19. — `SV/baseline-results-r6-n30.json`
- [V] The same file's `parserAccuracy` block reports `expected: 0` for every special-chapter type (decimal, prologue, epilogue, chapter_zero, non_numeric, range, omake), so `specialsRecoveryRate` 0 is "no ground truth", not a measurement. It also reports 21 of 30 titles with a volume 0 and mean chapter gap −549.5 (median 1.5). — `SV/baseline-results-r6-n30.json` (`summary.parserAccuracy`, `summary.specialChapters`)
- [V] Broad sample, 50 titles (2026-04-14): Fandom discovery rate 0.76; accuracy 0.9375 on titles with ground truth; only 21 of 50 "ok"; 15 had no ground truth; 9 were "fandom-skipped"; Ao Ashi returned 0 chapters against a ground truth of 410. — `SV/broad-sample-results.json`
- [V] 50-title cold import (2026-05-07): bind rates Fandom 78% (39/50), Wikipedia 90% (45/50); Wikipedia average similarity 0.70 with 7 bindings below 0.55; overall completeness 84.4% (volumes 74.0, chapters 78.3); totals missing across 49 titles: `Chapter.title` 6,202, `Chapter.description` 2,853, `Chapter.releaseDate` 2,845, `Chapter.volumeId` 2,232, `Volume.isbn` 390. — `SV/.50-titles-import-report-v1.md` (§2–§4)
- [V] Suspect Wikipedia bindings listed there include `Boys_High_School_(Brooklyn)` for "The Daily Lives of High School Boys", `Season_1` for "Cheese in the Trap Season 1", and `Overlord_(novel_series)`. Guards for the first two were added afterwards. — `SV/.50-titles-import-report-v1.md` (§5); `best-match-finder-helpers.ts:103-108`, `:132-148`
- [V] Wikipedia binding kill list from the purge sweep has 18 entries, e.g. bound articles "Tippi Hedren", "Jackie Chan", "Association football", "Orc". — `SV/.bad-bindings-kill-list-wiki.json`
- [V] Fandom discovery ledgers and Wikipedia ledger: see Discovery section (445 cases, 0 wrong; 36 cases, 1 wrong + 1 missed).
- [V] `fandom-html-pattern-survey.mjs` writes `fandom-html-pattern-survey-results.md` and `-data.json`; `pattern-coverage-test.mjs` reads `docs/development/fandom-html-pattern-survey-data-merged.json`. None of these outputs exist in the repository; only the input `SV/selected-titles.json` does. — `SV/fandom-html-pattern-survey.mjs:253-262`; `SV/pattern-coverage-test.mjs:273`, `:435`; `find` over the repo
- [V] Percentages embedded in the URL scorer ("8.2% of wikis use `<ol>`", "22.4% use `<a title="Chapter N">`") appear to come from that survey. — `FA/url-discoverer/scoring.ts:61`, `:70`
- [V] `chapters-gap-survey.ts` and `volumes-gap-survey.ts` are live-DB SQL surveys of `Metadata.chapters`/`volumes` nulls and fallback sources; they write no result files. — `SV/chapters-gap-survey.ts:1-14`; `SV/volumes-gap-survey.ts:1-6`
- [V] `audit-wikipedia-bindings.ts` re-scores bound article titles with dice × length ratio (reject < 0.55, soft < 0.70) and `audit-live-bindings.ts` re-validates Fandom URLs; neither has a checked-in result. Memory records 0 wrong among 17 flagged Fandom bindings on 95 titles, and a 69-binding Wikipedia run. — `SV/audit-wikipedia-bindings.ts:1-19`; memory notes `project_fandom_discovery_loop.md`, `feedback_wikipedia_bot_header.md`
- [V] Memory figures: parser accuracy on a 60-title corpus Fandom ~95% / Wikipedia ~88% (2026-04-05); 300-title stratified sample 77% with the stated ceiling being Wikipedia's lack of chapter data (2026-04-12). — memory notes `project_parser_accuracy_loop.md`, `project_parser_improvement_loop.md`

### Inferences
- [I] The surveys measure *counts* and *field presence*, not per-chapter correctness: a list padded with placeholders (C2) or with misnumbered entries (C4, C9) scores as complete. The 77% → "ceiling" conclusion partly reflects that Stage 2.5b/4 placeholders were introduced to close the count gap.
- [I] Discovery accuracy is not the binding constraint on manifest quality; per-chapter title/date/volume extraction is, for the roughly 32% of titles that have any wiki, and nothing wiki-side can help the 68% with neither.
- [I] The Wikipedia matcher's 0.30 similarity floor is far below the audit's own 0.55 rejection threshold, so the matcher can create bindings the audit would flag; the relevance gates narrow but do not close that gap.
- [I] Sample sizes are small for the claims made (36 Wikipedia titles; 30-title rounds), and the Wikipedia truth set was built around known failures, so 94.4% is not a population estimate.

### Gaps
- No checked-in output for the HTML pattern survey or the pattern coverage test, so the share of wikis per structure type and the residual uncovered patterns cannot be cited.
- No ground truth exists for special/bonus/decimal chapters (`expected: 0`), for per-chapter titles, or for volume assignment.
- No post-May survey exists; the effect of later changes (binding-as-record, resolver consolidation, phantom-chapter fix) on wiki accuracy is unmeasured.
- The gap surveys' numeric results are not stored, so current library-wide null rates are unknown from artifacts alone.

## Code health: duplicated helpers, oversized files, untyped parse outputs, brittle selectors

### Takeaway
The wiki code is large (about 50k lines), heavily duplicated and almost untested: 88 function names are defined more than once (135 extra copies), 29 files exceed the 500-line project limit, and only three unit-test files cover it. Explicit `any` is absent, but parse outputs cross module boundaries as `Record<string, unknown>` with casts.

### Cited Findings

- [V] Size: `FS/` 31,149 lines, `WP/` 15,122, legacy `fandom-table-parser/` 4,044, plus wiki modules under `EP/`. — `wc -l` over the directories
- [V] 29 `.ts` files over 500 lines among the wiki-related files in those four locations; largest are `FA/orchestrator.ts` 2,607 (with `@file-size-justified` and `eslint-disable max-lines, max-depth`), `fandom-volume-parser.ts` 1,434, `WP/wikipedia/manga-extractor/index.ts` 1,426, `WP/volume-parser.ts` 1,051, `FA/static-analyzer.ts` 1,026, `FA/bulleted-list-parser.ts` 1,024. — `wc -l`; `FA/orchestrator.ts:1-2`
- [V] `adaptiveParse` is 685 lines and `tryExtractFromUrl` 495 lines, each under `complexity, max-statements, max-lines-per-function` disables. — `FA/orchestrator.ts:302-797`, `:1643-2328`
- [V] Duplicate definitions (same name, separate bodies) out of 1,127 function declarations: `extractChapterNumber` ×10, `cleanChapterTitle` ×8, `extractVolumeNumber` ×7, `extractCoverImage` ×6, `cleanWikitext` ×5, `extractChaptersFromCell` ×4, `buildAbsoluteUrl` ×4, `fetchWithRetry` ×3, `parseVolumeTable` ×3; 88 names in total, 135 extra copies. — ast-grep `function_declaration` scan
- [V] The duplicated `extractChapterNumber` copies behave differently (see C5: the per-volume copy matches "March 4", the bulleted copy does not; the category copy is anchored and supports `Act`/`File`). — `FA/per-volume-iterator.ts:252-279`; `FA/bulleted-list-parser.ts:61-92`; `FA/category-chapter-discovery.ts:222-243`
- [V] The identical "rebuild volumes from per-volume data" block is pasted three times, each with the same comment about rate limits. — `FA/orchestrator.ts:1936-1950`, `:1980-1994`, `:2054-2068`
- [V] Zero `any` type annotations in `FS/`, `WP/`, `EP/wiki-discovery/` and `fandom-table-parser/`. — ast-grep `predefined_type` scan
- [V] Untyped hand-offs via `unknown`: `normalizeFandomChapters`/`normalizeFandomVolumes` take `Array<Record<string, unknown>>` and re-parse every field with `parseNum`/`asString`; scoring casts `unknown[]` to ad-hoc shapes; a double cast reads `chapterStart/End` off volumes; `phaseFandomEnrichment` types results as `Record<string, unknown>` / `unknown[]`. — `EP/wiki-discovery/chapter-normalization.ts:150-152`, `:72-75`, `:265-267`; `FA/url-discoverer/scoring.ts:233-236`; `EP/phase-fandom-enrichment.ts:62`
- [V] Field-name ambiguity is handled by fallbacks everywhere (`chapterNumber ?? number`, `volumeNumber ?? volume`, `coverImage ?? coverUrl`). — `EP/fandom-adaptive-bridge.ts:73-91`; `chapter-normalization.ts:198-208`
- [V] Brittle selectors/heuristics: an ordered image-selector list of about 40 entries ending in `.mw-parser-output img:not([width="1"])`; substring selectors `a[href*="/wiki/Chapter_"]`; redirect/disambiguation detection by HTML string tests; `includes('may refer to:')`. — `FS/chapter-detail/constants.ts:112-176`; `FA/per-volume-iterator.ts:324`; `chapter-list-extractor.ts:301-327`; `service.ts:84`
- [V] Layering: a server Wikipedia service imports from a React component tree (`@/components/library/library-manager/…/title-cleaning`). — `WP/wikipedia/manga-extractor/best-match-finder.ts:13`
- [V] Stale or contradictory comments: "cap at 500" with no cap (`FA/orchestrator.ts:1411`); "Bleach 686 … get full coverage" beside a 300 cap (`category-chapter-discovery.ts:507-509`); "curly quotes" beside ASCII-only classes (`chapter-parser/index.ts:149-150`); wrong Wikidata property comment (`article-resolver.ts:7`).
- [V] Dead or disabled code kept in place: stubbed two-tier cache functions and unused cache constants, pattern-cache `get` whose result is discarded, empty `SHARED_CATALOG_DOMAINS` branches. — `WP/wikipedia/manga-extractor/index.ts:55-86`, `:285-288`; `fandom-wiki-validator.ts:61`, `:118-120`, `:163-166`
- [V] Tests found for this area: `tests/server/services/fandom/chapter-number-extraction.test.ts`, `tests/server/services/fandom/series-page-candidates.test.ts`, `tests/server/trpc/routers/enrichment-pipeline/cross-series-gate.test.ts` (plus adapter tests outside the audited paths). No HTML/wikitext fixture tests for the 11 structure parsers or the Wikipedia chapter parsers were found. — `find` over `tests/` and `src/**/__tests__`
- [V] The cross-series gate unit test covers `cross-series-gate.ts` only, not the `shouldGate` closure or `isCrossSeriesWiki`. — `EP/cross-series-gate.ts:9-11`; D9

### Inferences
- [I] Accuracy work has been done through live-network survey loops instead of fixture tests, which is why regressions were detected by re-running 30-minute samples and why parsed-result caches had to be disabled. A corpus of saved pages (HTML + wikitext + expected manifest) would make C3–C5, C10 and F3 one-line regression tests.
- [I] The duplicated number/title helpers are the direct cause of inconsistent behaviour between parsers; a single canonical extractor with context guards (ISBN, date, page-count) would fix C5 everywhere at once.
- [I] Roughly 6k lines under `FS/dynamic/` and `FS/fandom/` look like earlier parser generations kept alive as fallbacks; their marginal yield is unknown (no per-source attribution is persisted beyond `sourcesUsed` in logs).

### Gaps
- Dead-code status of `FS/dynamic/`, `FS/fandom/`, `FS/patterns/` and `WP/wikipediaExtraction.ts` was not established (importer tracing not done).
- ESLint was not run (read-only audit); the count of existing disables in these directories was not tallied.
- Test files under `src/**/__tests__` were only name-matched; their assertions were not reviewed.
