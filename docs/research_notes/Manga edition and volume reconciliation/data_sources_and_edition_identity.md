# Data sources for volume-to-chapter mappings and edition identity (manga)

Research date: 2026-10-11. Items marked **[live probe]** are responses I got from the public API on that date (unauthenticated, one or two titles: mostly Berserk and One Piece), so they are evidence of the field shape and of one data point, not of catalogue-wide behaviour. Items marked **[snippet]** come from a search-result summary of the page, because the page itself could not be fetched; treat them as lower confidence.

## What does each source expose about volume count, chapter count, per-volume chapter lists, ISBNs and edition/format?

### Takeaway
No single public API answers all three questions. Tracker databases (AniList, MAL/Jikan, Kitsu, MangaBaka) give one scalar volume/chapter count per work and nothing per volume; MangaDex and Kitsu give per-chapter volume numbers, but they describe uploads, not a publisher's edition; only book-level sources (Bangumi per-volume subjects, openBD/NDL, Open Library, Google Books, Wikipedia's volume tables) carry ISBNs, and of those only Wikipedia pairs an ISBN with a chapter list.

### Cited Findings

**AniList (GraphQL, `https://graphql.anilist.co`)**
- `Media` exposes `chapters`, `volumes`, `format`, `status`, `countryOfOrigin`, `isLicensed`, `idMal`, `externalLinks{site,type,language,url}` and `relations`. For One Piece (30013), Berserk (30002) and Vagabond (30656), all `RELEASING`, both `chapters` and `volumes` were `null`. **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- `MediaFormat` for print is only `MANGA`, `NOVEL`, `ONE_SHOT` (the rest are anime formats). There is no value for tankobon, bunkoban, omnibus, kanzenban or colour edition. **[live probe, introspection]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- `MediaRelation` values: `ADAPTATION, PREQUEL, SEQUEL, PARENT, SIDE_STORY, CHARACTER, SUMMARY, ALTERNATIVE, SPIN_OFF, OTHER, SOURCE, COMPILATION, CONTAINS, SAME_UNIVERSE`. **[live probe, introspection]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- `externalLinks` carries official publisher/reader URLs with a language tag, e.g. for One Piece: MANGA Plus (English, Thai, German, Spanish, French), VIZ (English, two URLs), Shonen Jump (Japanese). **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- AniList's written-media criteria say that for a kanzenban entry "all chapters (including one-shots and extras) and volumes are to be included in the count", in contrast to MAL "where only the new chapters are in the Kanzanban entry". **[snippet]** — [AniList Written Media Criteria](https://anilist.notion.site/Written-Media-Criteria-3422051784ea4ae2b72d9fcc80dd62f9)

**MyAnimeList official API v2 (`https://api.myanimelist.net/v2`)**
- The manga detail endpoint accepts `fields=...media_type,status,num_volumes,num_chapters,authors{first_name,last_name},related_anime,related_manga,recommendations,serialization{name},alternative_titles`. Counts are scalars per entry; there is no per-volume or ISBN field in the documented field list. — [MAL API v2 reference](https://myanimelist.net/apiconfig/references/api/v2)
- The reference is titled "MyAnimeList API (beta ver.)". — [MAL API v2 reference](https://myanimelist.net/apiconfig/references/api/v2)

**Jikan v4 (unofficial MAL scraper, `https://api.jikan.moe/v4`)**
- Jikan describes its data as "data parsed from MyAnimeList which is stored temporarily on our servers", so its `chapters`/`volumes` are MAL's values with up to 24 hours of staleness. — [jikan-rest README](https://github.com/jikan-me/jikan-rest/blob/master/README.md)
- "Any property (except arrays or objects) whose value does not exist or is undetermined, will be `null`." — [jikan-rest README](https://github.com/jikan-me/jikan-rest/blob/master/README.md)

**Kitsu (JSON:API, `https://kitsu.io/api/edge`)**
- `manga` attributes include `chapterCount`, `volumeCount`, `subtype`, `mangaType`, `status`, `serialization`. One Piece returned `chapterCount: null, volumeCount: null`; Berserk returned `chapterCount: null, volumeCount: 0`. **[live probe]** — [Kitsu manga 8](https://kitsu.io/api/edge/manga/8)
- `manga/{id}/chapters` returns chapter resources with `number`, `volumeNumber`, `titles`, `published`. For Berserk the first record had `number: 1, volumeNumber: 1, titles: {}, published: null`, and `meta.count` was 5000, which is far more than the series has chapters. **[live probe]** — [Kitsu manga 8 chapters](https://kitsu.io/api/edge/manga/8/chapters?page%5Blimit%5D=2)

**MangaDex (`https://api.mangadex.org`)**
- Manga attributes include `lastVolume`, `lastChapter`, `status`, `links`. For Berserk (ongoing) `lastVolume` and `lastChapter` were empty strings. **[live probe]** — [MangaDex manga search](https://api.mangadex.org/manga?title=Berserk&limit=3)
- `GET /manga/{id}/aggregate` returns `volumes -> {volume, count, chapters -> {chapter, id, count}}`, with a `none` bucket for chapters uploaded without a volume. Berserk (English) returned 44 volume keys including `none` (7 chapters); volume `1` contained chapters keyed `0.01`, `0.02`, `0.03`. **[live probe]** — [MangaDex aggregate for Berserk](https://api.mangadex.org/manga/801513ba-a712-498c-8f57-cae55b38cc92/aggregate?translatedLanguage%5B%5D=en)
- `GET /manga/{id}/feed` returns chapter entities with `volume`, `chapter`, `title`, `translatedLanguage`, `externalUrl`, `pages`, `publishAt`. Berserk English feed total was 425. **[live probe]** — [MangaDex feed for Berserk](https://api.mangadex.org/manga/801513ba-a712-498c-8f57-cae55b38cc92/feed?limit=3&translatedLanguage%5B%5D=en)
- Status enum: `ongoing`, `completed`, `hiatus`, `cancelled`. — [MangaDex static data](https://api.mangadex.org/docs/3-enumerations/)
- No ISBN field appears in the manga attributes or in the documented `links` keys. — [MangaDex static data](https://api.mangadex.org/docs/3-enumerations/)

**MangaUpdates API v1 (`https://api.mangaupdates.com/v1`)**
- A series record has these keys: `admin, anime, associated, authors, bayesian_rating, categories, category_recommendations, completed, description, forum_id, genres, image, last_updated, latest_chapter, licensed, publications, publishers, rank, rating_votes, recommendations, related_series, series_id, status, title, type, url, year`. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- There is no numeric volume-count field. Volume count lives in free-text `status`; for Berserk it was `"43 Volumes (Ongoing)"` followed by a markdown paragraph with links. `latest_chapter` was the integer 386. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- `publishers[]` has `publisher_name`, `type` (`Original` / `English`), and free-text `notes`. For Berserk the Dark Horse entry's note was `"42 Volumes - Ongoing  | 14 Omnibus; print, 3-in-1 - Ongoing"`. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- `publications[]` gives the serialising magazine (`Young Animal`, `Animal House`) with a free-text publisher string. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)

**MangaBaka (`https://api.mangabaka.org/v1`)**
- A series record has `total_chapters`, `final_volume`, `final_chapter`, `type`, `status`, `is_licensed`, `publishers`, `relationships`, `merged_with`, `source`, `links`. For Berserk: `total_chapters: "401"`, `final_volume: "43"`, `final_chapter: null`. **[live probe]** — [MangaBaka series search](https://api.mangabaka.org/v1/series/search?q=Berserk&limit=1)
- `publishers[]` has `name`, `language`, `type` (`Original`/`English`/`Other`), and `note`; the Dark Horse note is the same string MangaUpdates holds (`"42 Volumes - Ongoing  | 14 Omnibus; print, 3-in-1 - Ongoing"`). **[live probe]** — [MangaBaka series 1692](https://api.mangabaka.org/v1/series/1692)

**ComicVine**
- Komf (a Komga/Kavita metadata fetcher) labels its ComicVine provider "Experimental provider, can mismatch issue numbers". — [Snd-R/komf README](https://github.com/Snd-R/komf)

**Wikipedia / Wikidata**
- English Wikipedia's `{{Graphic novel list}}` row has `VolumeNumber`, `OriginalRelDate`, `OriginalISBN`, `LicensedRelDate`, `LicensedISBN`, `ChapterList` / `ChapterListCol1` / `ChapterListCol2`, `Summary`, and title fields (`OriginalTitle`, `TranslitTitle`, `LicensedTitle`). This is the one source here that puts an original ISBN, a licensed ISBN and a chapter list in the same row. — [Template:Graphic novel list](https://en.wikipedia.org/wiki/Template:Graphic_novel_list)
- Wikidata's Berserk item (Q18558978) is an instance of Q21198342 and carries `number of parts of this work` (P2635) = 41, publisher, and AniList, Kitsu and MangaUpdates ids. **[live probe]** — [Wikidata Q18558978](https://www.wikidata.org/wiki/Q18558978)
- Relevant properties: P2635 "number of parts of this work", P629 "version, edition or translation of", P747 "has version, edition or translation" (inverse of P629), P212 "ISBN-13", P1054 "NDL Bib ID", P648 "Open Library ID", P675 "Google Books ID". **[live probe, property search]** — [Wikidata P2635](https://www.wikidata.org/wiki/Property:P2635); [P629](https://www.wikidata.org/wiki/Property:P629); [P747](https://www.wikidata.org/wiki/Property:P747); [P212](https://www.wikidata.org/wiki/Property:P212)

**Open Library**
- `GET /isbn/{isbn}.json` returns an edition record. For 9781506711980: `title: "Berserk Deluxe Volume 1"`, `publishers: ["Dark Horse Manga"]`, `publish_date: "Mar 26, 2019"`, `isbn_13`, `isbn_10`, `series: ["Berserk Deluxe #1"]`, `physical_format: "Hardcover"`, `number_of_pages: 696`, and a `works` link (`/works/OL20066940W`). **[live probe]** — [Open Library ISBN lookup](https://openlibrary.org/isbn/9781506711980.json)

**Google Books**
- Volumes can be searched with `q=isbn:<number>`; `volumeInfo` includes `industryIdentifiers` (`ISBN_10`, `ISBN_13`), `publisher`, `publishedDate`, `pageCount`. — [Google Books API: Using the API](https://developers.google.com/books/docs/v1/using)

**NDL Japan and openBD (Japanese originals)**
- NDL Search offers a Search API (SRU, OpenSearch, OpenURL), a Harvest API (OAI-PMH) and a Thumbnail API. — [NDL Search API](https://ndlsearch.ndl.go.jp/en/help/api)
- openBD returns ONIX-shaped records by ISBN. For 9784592137177: `summary.title: "ベルセルク. 19"`, `summary.volume: ""`, `summary.series: "Jets comics"`, `summary.publisher: "白泉社"`, `summary.pubdate: "200004"`. **[live probe]** — [openBD get](https://api.openbd.jp/v1/get?isbn=9784592137177)

**Bangumi (`https://api.bgm.tv/v0`)**
- Books are modelled as a series subject plus one subject per volume. Searching ベルセルク returned subject 9640 (`series: true`, publisher 白泉社, magazine 月刊アニマルハウス→ヤングアニマル) and separate subjects "ベルセルク (1)" and "ベルセルク (2)" with `ISBN=9784592135746` / `9784592135753` and ISBN-10 in the infobox. The series record's `volumes` and `eps` were 0 in the search response. **[live probe]** — [Bangumi API search](https://api.bgm.tv/v0/search/subjects)

**Publisher catalogues, Anime-Planet, BookWalker**
- Komf's default provider list includes `yenPress`, `kodansha`, `viz` and `bookWalker` alongside `mangaUpdates, mal, nautiljon, aniList, mangaDex, bangumi, comicVine, hentag, webtoons, mangaBaka`, so at least one maintained open-source tool consumes those publisher/retailer sites as metadata providers. — [Snd-R/komf README](https://github.com/Snd-R/komf)
- Komf has a `useOriginalPublisher` option that prefers "original publisher and volume information if source has data about multiple providers". — [Snd-R/komf README](https://github.com/Snd-R/komf)

### Inferences
- "How many volumes does this edition have" is only answerable per edition from: MangaUpdates `publishers[].notes` (free text, needs parsing), Wikipedia volume tables (count rows with a `LicensedISBN`), and book catalogues queried by ISBN. Tracker scalars are per work, with the edition unstated.
- "Which chapters are in volume N" has two structured sources (MangaDex aggregate, Kitsu chapters) and one semi-structured (Wikipedia `ChapterList`). The MangaDex Berserk sample (`0.01`-`0.03` in volume 1, a `none` bucket, 44 keys against a 43-volume series) shows why the aggregate cannot be used as an official manifest without a cross-check.
- The openBD sample shows a trap for Japanese ISBN lookups: the `series` field held the imprint/label ("Jets comics"), not the manga title, and the volume number was inside the title string rather than the `volume` field.
- MangaBaka's publisher notes matching MangaUpdates' text verbatim suggests MangaBaka ingests MangaUpdates for that field, so the two are not independent votes.

### Gaps
- ComicVine's field model for manga (volume/issue resources, how tankobon and omnibus are entered) was not verified: the API needs a key and I found no ComicVine guideline page. Only the Komf caveat above is sourced.
- I did not fetch Viz, Kodansha, Yen Press, MANGA Plus, Anime-Planet or BookWalker directly. `https://api.kodansha.us/search` returned an empty body to an unauthenticated probe. Whether any of them has a documented public API, and their terms, is unconfirmed.
- NDL field-level detail (ISBN, series title, volume) is in a Japanese-language specification I did not read.
- Google Books `seriesInfo` is not mentioned on the "Using the API" page and my live query failed on quota, so its presence for manga is unconfirmed.
- Jikan timed out on three attempts from this host, so its manga field shape is taken from documentation only.
- The Kitsu `meta.count` of 5000 for Berserk chapters is unexplained (cap, placeholder rows, or bad data).

## Which sources distinguish editions explicitly, and which merge them? How do ISBN-13 and publisher series pages work as an edition key?

### Takeaway
Trackers merge editions into one work record and at best describe them in free text or as a related entry; ISBN-bearing sources are edition-specific by construction. In the samples, an ISBN-13 resolved to an edition with its own series string and format ("Berserk Deluxe #1", Hardcover), which is the closest thing to an explicit edition key that was observed.

### Cited Findings
- AniList has no edition/format enum beyond `MANGA`/`NOVEL`/`ONE_SHOT`. **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- AniList and MAL count kanzenban entries differently (AniList: all chapters and volumes; MAL: only the new chapters), so the same edition has different counts on the two sites by policy. **[snippet]** — [AniList Written Media Criteria](https://anilist.notion.site/Written-Media-Criteria-3422051784ea4ae2b72d9fcc80dd62f9)
- MangaDex models some variants as separate titles linked by a relation enum that includes `monochrome`, `colored`, `preserialization`, `serialization`, `alternate_version`, `alternate_story`, alongside `spin_off`, `side_story`, `adapted_from`, `based_on`, `doujinshi`, `same_franchise`, `shared_universe`, `prequel`, `sequel`, `main_story`. — [MangaDex static data](https://api.mangadex.org/docs/3-enumerations/)
- The MangaDex Berserk title has relations `preserialization, side_story, doujinshi, colored, doujinshi`. **[live probe]** — [MangaDex manga search](https://api.mangadex.org/manga?title=Berserk&limit=3)
- MangaUpdates keeps one series record and describes editions in publisher notes: tankobon count and omnibus count for the English licence sit in one string ("42 Volumes - Ongoing | 14 Omnibus; print, 3-in-1 - Ongoing"). **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- Open Library separates work from edition: the ISBN lookup returned an edition with `physical_format: "Hardcover"`, `series: ["Berserk Deluxe #1"]` and a pointer to a work key. **[live probe]** — [Open Library ISBN lookup](https://openlibrary.org/isbn/9781506711980.json)
- Wikidata has the work/edition pair P629 / P747; P747's description is "item that is an edition or translation of this item" and it is constrained to subjects that are works. — [Wikidata P747](https://www.wikidata.org/wiki/Property:P747)
- Wikipedia's volume template stores one `OriginalISBN` and one `LicensedISBN` per row, i.e. two editions per table (original and one licensed). — [Template:Graphic novel list](https://en.wikipedia.org/wiki/Template:Graphic_novel_list)
- Bangumi gives each Japanese volume its own subject with ISBN-13 and ISBN-10. **[live probe]** — [Bangumi API search](https://api.bgm.tv/v0/search/subjects)

### Inferences
- A workable edition key is (publisher, edition series string, language), anchored by the set of ISBN-13s. The Open Library sample shows the edition series string ("Berserk Deluxe") differs from the work title, which is what separates a 3-in-1 from the single-volume run.
- Wikipedia's two-ISBN row cannot represent a third edition (omnibus, deluxe, bunkoban) in the same table; where those exist they would have to be in separate tables or prose.
- MangaDex's `colored` / `alternate_version` relations give an explicit "different edition of the same work" signal that the trackers lack; AniList's nearest equivalents are `ALTERNATIVE` and `COMPILATION`.
- For the Berserk Wikidata item no P747/P212 statements came back in my query, which suggests edition-level items for manga are sparse; one item is not enough to generalise.

### Gaps
- No source was found that states format as a controlled value (tankobon / bunkoban / kanzenban / omnibus / full-colour digital). ONIX product-form codes would be the standard place, and openBD returns ONIX, but the sample record's `ProductForm` came back null in my extraction and I did not read ONIX documentation.
- I did not verify how publisher series pages (Viz, Kodansha, Yen Press) are structured or whether they list ISBNs per volume.
- How consistently Wikidata editors create edition items for manga volumes is unmeasured.

## Which sources publish cross-reference ids, and how complete/accurate are they for manga?

### Takeaway
Cross-references for manga come from the databases themselves (MangaDex `links`, AniList `idMal`, Kitsu `mappings`, MangaBaka `source`, MAL-Sync, Wikidata), not from the well-known community mapping lists, which are anime-only in the one case I checked. Coverage on Wikidata is thin and uneven by provider.

### Cited Findings
- MangaDex `links` keys and formats: `al` (AniList id), `ap` (Anime-Planet slug), `bw` (BookWalker JP, stored as `series/...`), `mu` (MangaUpdates id), `nu` (NovelUpdates slug), `kt` (Kitsu id or slug), `amz`, `ebj`, `cdj` (full URLs), `mal` (MAL id), `raw` (official untranslated URL), `engtl` (official English URL). The docs call it "a JSON object with some strange keys". — [MangaDex static data](https://api.mangadex.org/docs/3-enumerations/)
- Live data also contains a `bl` key (`"bl":"181526"`) that the documented table does not list. **[live probe]** — [MangaDex manga search](https://api.mangadex.org/manga?title=Berserk&limit=3)
- For Berserk, MangaDex `engtl` pointed at a Dark Horse multi-volume product page and `raw` at the Young Animal series page. **[live probe]** — [MangaDex manga search](https://api.mangadex.org/manga?title=Berserk&limit=3)
- AniList exposes `idMal` on `Media` (One Piece 30013 -> 13, Berserk 30002 -> 2). **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- Kitsu `mappings` for One Piece: `myanimelist/manga=13`, `anilist/manga=30013`, `mangaupdates=pb8uwds`. **[live probe]** — [Kitsu manga with mappings](https://kitsu.io/api/edge/manga?filter%5Bslug%5D=one-piece&include=mappings)
- MangaUpdates has two forms of the same id: the numeric `series_id` (51239621230) and the URL slug (`njeqwry`), and the slug is the base-36 encoding of the number (verified: `int("njeqwry", 36) == 51239621230`). MangaDex, Kitsu, Wikidata and MangaBaka store the slug form. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- MangaBaka `source` for Berserk maps to `anilist: 30002`, `anime_planet: "berserk"`, `anime_news_network: 2298`, `kitsu: 8`, `manga_updates: "njeqwry"`, `my_anime_list: 2`, `shikimori: 2`, and there is a reverse lookup `GET /v1/source/anilist/{id}`. **[live probe]** — [MangaBaka source lookup](https://api.mangabaka.org/v1/source/anilist/30002)
- MangaBaka records also have `merged_with` and a `relationships` object (`alternative`, `other`). **[live probe]** — [MangaBaka series 1692](https://api.mangabaka.org/v1/series/1692)
- MAL-Sync's API maps a MAL manga id to site-specific ids; MAL id 2 returned more than one MangaDex UUID under `Sites.Mangadex`, each with `malId` and `aniId`. **[live probe]** — [MAL-Sync API](https://api.malsync.moe/mal/manga/2)
- Wikidata statement counts on 2026-10-11: AniList manga ID (P8731) 8,709; MyAnimeList manga ID (P4087) 8,137; Anime News Network manga ID (P1984) 5,285; MangaUpdates manga ID (P11149) 4,027; Anime-Planet manga ID (P11348) 3,082; Kitsu manga ID (P11494) 584; MangaBaka manga ID (P14262) 224; Comic Vine ID (P5905) 48,598 across all item types. **[live probe, SPARQL]** — [Wikidata Query Service](https://query.wikidata.org/)
- Other Wikidata identifier properties found: Bangumi subject ID (P5732), BookWalker series ID JP (P11259) and global (P11363). **[live probe, property search]** — [Wikidata P5732](https://www.wikidata.org/wiki/Property:P5732); [P11259](https://www.wikidata.org/wiki/Property:P11259); [P11363](https://www.wikidata.org/wiki/Property:P11363)
- Fribb/anime-lists describes itself as an anime mapping project; its listed sources are MyAnimeList, TheTVDB, TheMovieDB, Anime-Planet, Kitsu, Anisearch, AniList, AniDB, LiveChart and Anime News Network, built from anime-offline-database; manga is not mentioned. It also states "this project cannot provide a way for corrections anymore". — [Fribb/anime-lists](https://github.com/Fribb/anime-lists)

### Inferences
- Wikidata is too sparse to be a primary join table for manga: about 8.7k AniList manga ids and under 600 Kitsu ids. It is useful as a tie-breaker and as the only source here that also links to library identifiers.
- One MAL id mapping to several MangaDex titles (MAL-Sync) means provider records are many-to-one across sites; a cross-reference tells you "same work", not "same edition".
- Any join on MangaUpdates must normalise between the numeric id and the base-36 slug.
- MangaDex `engtl` and `raw` are per-title pointers to a publisher page, so they are the most direct route from a scanlation-oriented record to an official edition.

### Gaps
- A Wikidata property for MangaDex title ids was not found by label search; I cannot say whether one exists.
- Manami-project/anime-offline-database and the `arm` mapping were not checked directly. Fribb's list is built from anime-offline-database, which suggests the same anime-only scope, but that is unverified.
- No accuracy audit of any of these mappings for manga was found; error rates are unknown.
- MangaBaka's documentation, licence and database-dump terms were not found. Komf's README mentions a `DATABASE` mode that "will only work if MangaBaka database is installed", which implies a downloadable database exists. — [Snd-R/komf README](https://github.com/Snd-R/komf)

## What are the documented inaccuracies?

### Takeaway
Most of the suspected problems are visible in live data, but few are documented by the services themselves; the strongest evidence is the probes below plus one maintainer caveat (Komf on ComicVine).

### Cited Findings
- **AniList counts null for ongoing series:** `chapters` and `volumes` were `null` for three of three `RELEASING` titles probed (One Piece, Berserk, Vagabond). **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- **Kitsu counts missing or zero:** One Piece `chapterCount`/`volumeCount` null; Berserk `volumeCount: 0`. **[live probe]** — [Kitsu manga 8](https://kitsu.io/api/edge/manga/8)
- **MangaDex aggregate reflects uploads:** Berserk volume 1 lists chapters `0.01`-`0.03`; 7 chapters sit in `none`; `lastVolume`/`lastChapter` are empty. **[live probe]** — [MangaDex aggregate for Berserk](https://api.mangadex.org/manga/801513ba-a712-498c-8f57-cae55b38cc92/aggregate?translatedLanguage%5B%5D=en)
- **MangaUpdates mixes media types in search:** searching "Sword Art Online" returned, in order, a `Novel`, four `Doujinshi`, a `Manga` titled "Sword Art Online." (2010), an `Artbook`, and a manga anthology. The `type` field is what separates them. **[live probe]** — [MangaUpdates series search](https://api.mangaupdates.com/v1/series/search)
- **MangaUpdates relations cross media types:** Berserk's `related_series` includes a `Side Story` that is a novel ("Berserk: Honou Ryuu no Kishi (Novel)") and `Spin-Off` entries. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- **Sources disagree on chapter totals for the same work:** Berserk is `latest_chapter: 386` on MangaUpdates, `total_chapters: "401"` on MangaBaka, and 425 English chapter uploads on MangaDex. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230); [MangaBaka series search](https://api.mangabaka.org/v1/series/search?q=Berserk&limit=1); [MangaDex feed for Berserk](https://api.mangadex.org/manga/801513ba-a712-498c-8f57-cae55b38cc92/feed?limit=3&translatedLanguage%5B%5D=en)
- **Wikidata volume count is stale:** Berserk has P2635 = 41, while MangaUpdates and MangaBaka both say 43. **[live probe]** — [Wikidata Q18558978](https://www.wikidata.org/wiki/Q18558978); [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- **ComicVine:** "Experimental provider, can mismatch issue numbers". — [Snd-R/komf README](https://github.com/Snd-R/komf)
- **Wikipedia structure variance:** `ChapterList` is entered as wikitext (the documented examples are bullet lines such as `* 001. "Former Part"`, with `{{nihongo}}` for Japanese titles); a row becomes single-language when both licensed fields are empty; `SublistOf` hides chapter lists and summaries when the list is transcluded into the parent page. — [Template:Graphic novel list](https://en.wikipedia.org/wiki/Template:Graphic_novel_list)
- **Jikan staleness and nulls:** responses are cached 24 hours and undetermined scalars are `null`. — [jikan-rest README](https://github.com/jikan-me/jikan-rest/blob/master/README.md)

### Inferences
- A null or zero count from AniList or Kitsu should be read as "unknown", never as a value; Kitsu's `0` is especially easy to mistake for data.
- The three-way Berserk chapter disagreement (386 / 401 / 425) is consistent with each site counting something different (numbered episodes, total including unnumbered, upload rows including duplicates from several groups), so a consensus over raw chapter totals needs per-source normalisation first.
- A parser for Wikipedia chapter lists has to tolerate free wikitext, single-language rows, and pages where the chapter lists are hidden by `SublistOf` and live on a sub-page.

### Gaps
- No forum or issue-tracker thread was found documenting ComicVine listing collected editions under the series name, or MangaDex stating that aggregate volumes are uploader-supplied. Two searches returned nothing relevant; the claims rest on the probe above and on the Komf caveat.
- Whether AniList leaves counts null for ongoing series by policy was not confirmed in the submission manual (the Notion pages were not fetched).
- Sample size is one to three titles per source; none of these rates are measured.

## Rate limits, authentication and terms of use for automated access (as of 2026)

### Takeaway
All the tracker APIs are usable without payment, but AniList is the constrained one: it is rate-limited to 30 requests per minute in a declared degraded state and its terms prohibit mass collection and use in competing tracker services. ComicVine and NDL restrict commercial use; MangaUpdates and Open Library ask for spacing, credit and identification; Google Books is unreliable without a key.

### Cited Findings
- **AniList limits:** the docs say the API "is currently in a degraded state and is limited to 30 requests per minute", described as temporary; the normal limit is 90 per minute; exceeding it gives a one-minute timeout with `Retry-After` and `X-RateLimit-Reset`; there is a separate burst limiter; they are "not currently accepting requests for increased rate limits". **[snippet]** — [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting)
- The live response carried `x-ratelimit-limit: 30` and `x-ratelimit-remaining: 29`. **[live probe]** — [AniList GraphQL endpoint](https://graphql.anilist.co)
- **AniList terms:** "Free for non-commercial usage"; "Using the AniList API as a backup or data storage service is strictly prohibited"; "Hoarding or mass collection of data from the AniList API is strictly prohibited"; use "within competing, non-complementary services of the same nature is prohibited. This includes, but is not limited to, anime and manga list or tracker services"; commercial use is free under $150 revenue per month, above which a licence is needed. — [AniList docs source, terms-of-use.md](https://github.com/AniList/docs/blob/master/docs/guide/terms-of-use.md); rendered at [docs.anilist.co](https://docs.anilist.co/guide/terms-of-use)
- **MAL official:** read-only calls can authenticate with the `X-MAL-CLIENT-ID` header ("When user login is not required"); user actions need OAuth2. — [MAL API v2 reference](https://myanimelist.net/apiconfig/references/api/v2)
- A third-party Rust client's docs claim MAL is limited to about 5 requests per minute with a 1-2 hour IP ban returning 403. This is one library's statement, possibly about an older API, and is not in MAL's reference. **[snippet, low confidence]** — [docs.rs/mal](https://docs.rs/mal)
- **Jikan:** 60 requests per minute, 3 per second, daily unlimited; "It's still possible to get rate limited from MyAnimeList.net instead"; all requests cached 24 hours; no key. — [jikan-rest README](https://github.com/jikan-me/jikan-rest/blob/master/README.md)
- **MangaDex:** "a global limit of approximately 5 requests per second per IP address"; 429 on excess, then a temporary 403 IP ban if requests continue; `GET /at-home/server/{id}` is 40 per minute; a non-spoofed `User-Agent` is mandatory and a `Via` header is forbidden; "Requests where offset + size > 10.000 will be rejected"; page size is typically capped at 100, 500 on some feeds; no CORS and no hotlinking, so images must be proxied. — [MangaDex limitations](https://api.mangadex.org/docs/2-limitations/)
- **MangaUpdates:** "You will credit MangaUpdates when using data provided by this API"; "You will use reasonable spacing between requests so as not to overwhelm the MangaUpdates servers"; no numeric limit is published; "Most API functions are public and do not require an account". — [MangaUpdates API](https://api.mangaupdates.com/)
- A series GET returned no rate-limit headers. **[live probe]** — [MangaUpdates series 51239621230](https://api.mangaupdates.com/v1/series/51239621230)
- **ComicVine:** "We officially support 200 requests per resource, per hour"; "we implement velocity detection to prevent malicious use"; "The API is strictly for non-commercial use only"; a key is required and obtained by logging in. — [Comic Vine API](https://comicvine.gamespot.com/api/)
- **Open Library:** 1 request per second by default, 3 per second for requests identified with a `User-Agent` and contact email; the APIs must not be used for bulk download; monthly data dumps are provided instead. — [Open Library developers API](https://openlibrary.org/developers/api)
- **Google Books:** public-data requests are meant to carry an API key or OAuth token; the key "identifies your project and provides API access, quota, and reports". — [Google Books API: Using the API](https://developers.google.com/books/docs/v1/using)
- A keyless ISBN query returned "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'" against a shared project. **[live probe]** — [Google Books volumes](https://www.googleapis.com/books/v1/volumes?q=isbn:9781506711980)
- **NDL Search:** individuals and non-profits need no application for non-commercial use; commercial organisations, and any for-profit use (including advertising revenue), must apply unless the provider licenses the metadata; continuous users are asked to register usage and contact details; no numeric limit, but concurrent access is restricted and heavy continuous traffic from one IP may be blocked; credit to NDL Search is required. — [NDL Search API](https://ndlsearch.ndl.go.jp/en/help/api)
- **MangaBaka:** `api.mangabaka.dev` now answers "deprecated and no longer serves traffic - switch to https://api.mangabaka.org". Unauthenticated reads on the `.org` host returned 200 with no rate-limit headers. **[live probe]** — [MangaBaka old host](https://api.mangabaka.dev/v1/series/search?q=Berserk&limit=1); [MangaBaka source lookup](https://api.mangabaka.org/v1/source/anilist/30002)
- **Bangumi:** Komf notes a token is needed only "to show nsfw items"; unauthenticated search worked. — [Snd-R/komf README](https://github.com/Snd-R/komf); **[live probe]** [Bangumi API search](https://api.bgm.tv/v0/search/subjects)
- **Kitsu, MAL-Sync, openBD:** all answered unauthenticated requests with 200 and no rate-limit headers. **[live probe]** — [Kitsu manga 8](https://kitsu.io/api/edge/manga/8); [MAL-Sync API](https://api.malsync.moe/mal/manga/2); [openBD get](https://api.openbd.jp/v1/get?isbn=9784592137177)

### Inferences
- AniList's 30 per minute and its anti-hoarding clause together rule out bulk or library-wide sweeps through AniList; per-title lookups on user action fit, batch re-enrichment needs throttling and caching. Whether a self-hosted library manager counts as a "competing ... tracker service" is a judgement the terms do not settle.
- The header on AniList now does reflect 30, whereas the docs snippet says the degraded limit is "not currently reflected in the headers"; the docs text may be older than the current behaviour.
- Anything that calls `api.mangabaka.dev` is broken as of this date and must move to `.org`.
- Google Books needs a per-project key to be dependable; Open Library and openBD are the keyless ISBN options.

### Gaps
- MAL's official rate limit is not stated in the reference I could read; the only number found is the low-confidence third-party one.
- Kitsu, Bangumi, MangaBaka, MAL-Sync and openBD rate limits and terms of use were not found in documentation; only the absence of limit headers was observed.
- Terms of use for Viz, Kodansha, Yen Press, MANGA Plus, Anime-Planet and BookWalker (scraping or API) were not researched.
- The AniList rate-limiting page returned 403 to direct fetches; the limits above come from a search summary of that page plus the live header.
