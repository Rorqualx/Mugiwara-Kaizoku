# Fandom & ComicVine HTML Pattern Survey Results

**Date:** 2026-03-07
**Titles Surveyed:** 269 (120 batch 1 + 149 batch 2)
**Successful (had chapter data):** 85
**Failed/No Data:** 184

---

## Executive Summary

Surveyed 85 Fandom wiki pages with chapter/volume data across diverse manga genres.
Only **3 of 33 detected patterns** are currently handled by `extractChapterTitles`.
The **dominant structure** (70%+ of pages) is **wikitable + UL/LI lists** — not the numbered-dot patterns we currently parse.

### Current Coverage Gap

| Category | Handled | Total Found | Coverage |
|----------|---------|-------------|----------|
| Number-dot patterns (N. Title) | 3/10 | varied | ~30% |
| List structures (ol/ul/li) | 1/6 | varied | ~17% |
| Table structures | 0/7 | 53-63 pages | **0%** |
| Heading/container patterns | 0/5 | 16-63 pages | **0%** |
| Link-inside patterns | 1/5 | varied | ~20% |

---

## Pattern Frequency (Combined 85 Pages)

### Tier S — Found on 60%+ of pages

| # | Pattern | Description | Count | % | Handled? |
|---|---------|-------------|-------|---|----------|
| 1 | `TABLE_NUM_COL` | `<th>#</th>` column header | 63 | 74.1% | NO |
| 2 | `SPAN_HEADLINE_VOL` | `<span class="mw-headline">Volume</span>` | 63 | 74.1% | NO |
| 3 | `UL_LI_A` | `<ul><li><a>Title</a></li>` | 59 | 69.4% | NO |
| 4 | `LI_SPAN_A` | `<li><span><a>Title</a></span></li>` | 57 | 67.1% | NO |
| 5 | `COLLAPSIBLE` | `class="mw-collapsible"` sections | 55 | 64.7% | NO |
| 6 | `TABLE_WIKITABLE` | `class="wikitable"` table | 53 | 62.4% | NO |
| 7 | `A_NUM_DOT_TITLE` | `<a>N. Title</a>` (number inside link) | 52 | 61.2% | **YES** |
| 8 | `TABLE_TITLE_COL` | `<th>Title</th>` column header | 49 | 57.6% | NO |

### Tier A — Found on 15-60% of pages

| # | Pattern | Description | Count | % | Handled? |
|---|---------|-------------|-------|---|----------|
| 9 | `A_TITLE_CH_VOL` | `<a title="Chapter N">` attr | 19 | 22.4% | NO |
| 10 | `TABBER` | Tabber widget container | 16 | 18.8% | NO |
| 11 | `TABLE_CH_COL` | `<th>Chapter</th>` column | 14 | 16.5% | NO |
| 12 | `A_HREF_CH` | `href="/wiki/Chapter_N"` | 14 | 16.5% | NO |

### Tier B — Found on 5-15% of pages

| # | Pattern | Description | Count | % | Handled? |
|---|---------|-------------|-------|---|----------|
| 13 | `TD_NUM_TD_A` | `<td>N</td>...<td><a>Title</a></td>` | 10 | 11.8% | NO |
| 14 | `HASH_PREFIX` | `#N` prefix format | 8 | 9.4% | NO |
| 15 | `A_CH_NUM_ONLY` | `<a>Chapter N</a>` (no title) | 8 | 9.4% | NO |
| 16 | `EPISODE_PREFIX` | `Episode N` naming | 8 | 9.4% | NO |
| 17 | `A_NUM_DASH_TITLE` | `<a>N - Title</a>` | 7 | 8.2% | NO |
| 18 | `OL_LI_A` | `<ol><li><a>Title</a></li>` | 7 | 8.2% | **YES** |
| 19 | `CH_WORD_PREFIX` | `Chapter N:` prefix | 7 | 8.2% | NO |
| 20 | `NAVBOX` | Navigation box | 5 | 5.9% | NO |
| 21 | `TABLE_ARTICLE` | `class="article-table"` | 5 | 5.9% | NO |

### Tier C — Found on 2-5% of pages

| # | Pattern | Description | Count | % | Handled? |
|---|---------|-------------|-------|---|----------|
| 22 | `NUM_DOT_A_PLAIN` | `N. <a>Title</a>` (no bold) | 4 | 4.7% | **YES** |
| 23 | `OL_START_ATTR` | `<ol start="N">` | 3 | 3.5% | NO |
| 24 | `ALT_PREFIX` | Round/Stage/Mission N | 3 | 3.5% | NO |
| 25 | `NUM_DOT_PLAIN` | `N. Title` (plain text) | 3 | 3.5% | NO |
| 26 | `UL_LI_NUM_A` | `<ul><li>N. <a>Title</a></li>` | 2 | 2.4% | NO |
| 27 | `SMALL_TAG` | `<small>Chapter info</small>` | 2 | 2.4% | NO |

### Tier D — Found on <2% of pages

| # | Pattern | Description | Count | % | Handled? |
|---|---------|-------------|-------|---|----------|
| 28 | `P_NUM_A` | `<p>N. <a>Title</a></p>` | 1 | 1.2% | NO |
| 29 | `A_HASH_NUM_TITLE` | `<a>#N Title</a>` | 1 | 1.2% | NO |
| 30 | `TABLE_SORTABLE` | Sortable table | 1 | 1.2% | NO |
| 31 | `A_CH_NUM_TITLE` | `<a>Chapter N: Title</a>` | 1 | 1.2% | NO |
| 32 | `DL_DD_A` | `<dl><dd><a>Title</a></dd>` | 1 | 1.2% | NO |
| 33 | `NUM_COLON_A` | `N: <a>Title</a>` | 1 | 1.2% | NO |

---

## Live HTML Samples (Verified)

### Structure 1: Wikitable + UL/LI (Most Common — 62-74% of pages)

**Used by:** JJK, Demon Slayer, Promised Neverland, One Piece, AoT, MHA, most major manga

```html
<!-- Volume container: table with styled rows -->
<table style="border-collapse:collapse; border:1px #2B1B17 solid;" width="100%">
  <tr style="text-align:center; border-top:3px #2B1B17 solid;">
    <td style="border:1px #2B1B17 solid; width:8%">
      <h4><span class="mw-headline" id="Volume_1">
        <a href="/wiki/Volume_1" title="Volume 1"><b>1</b></a>
      </span></h4>
    </td>
    <!-- Volume title, dates, ISBN cells... -->
  </tr>
  <tr>
    <td colspan="2" style="text-align:left; vertical-align:top;">
      <b>Chapters list:</b>
      <ul>
        <li>001. <a href="/wiki/Chapter_1" title="Chapter 1"><b>Title Here</b></a></li>
        <li>002. <a href="/wiki/Chapter_2" title="Chapter 2"><b>Next Title</b></a></li>
      </ul>
    </td>
  </tr>
</table>
```

**JJK variant:**
```html
<li>001. <a href="/wiki/Chapter_1" title="Chapter 1"><b>Ryoumen Sukuna</b></a>
  <span style="font-weight: normal"> (<span class="t_nihongo_kanji" lang="ja">両面宿儺</span>)</span>
</li>
```

### Structure 2: `<a>N. Title</a>` Inside Link (61% of pages)

**Used by:** Demon Slayer, many wikis with simpler formatting

```html
<!-- Number AND title are both inside the link -->
<li><a href="/wiki/Chapter_1" title="Chapter 1">1. Cruelty</a></li>
<li><a href="/wiki/Chapter_2" title="Chapter 2">2. The Stranger</a></li>
```

### Structure 3: `<ol>` Ordered Lists (8% but includes AoT)

**Used by:** Attack on Titan, some smaller wikis

```html
<td colspan="3">
  <b>Chapters list:</b>
  <ol start="1">
    <li><a href="/wiki/To_You,_2,000_Years_From_Now" title="...">To You, 2,000 Years From Now</a></li>
    <li><a href="/wiki/That_Day_(Chapter_2)" title="...">That Day</a></li>
  </ol>
</td>
```

### Structure 4: `<a>N - Title</a>` Dash Separator (8% of pages)

**Used by:** JoJo Part 7, Skeleton Knight, some webtoon wikis

```html
<li><a href="/wiki/Chapter_1">1 - The Steel Ball Run Press Conference</a></li>
```

### Structure 5: `<td>N</td>...<td><a>Title</a></td>` Table Rows (12%)

**Used by:** Boruto, Saint Seiya, some manga.fandom.com pages

```html
<tr>
  <td style="text-align:center;">1</td>
  <td style="text-align:center;">Chapter 1</td>
  <td><a href="/wiki/Chapter_1" title="Chapter 1">Uzumaki Boruto!!</a></td>
</tr>
```

### Structure 6: Article-Table Class (6%)

**Used by:** Promised Neverland, Boruto, Heavy Object

```html
<table class="article-table" width="100%">
  <tr>
    <th><center><h3><span class="mw-headline" id="Volume_1">
      <a href="/wiki/Volume_1">Volume 1</a>
    </span></h3></center></th>
  </tr>
  <!-- Chapter list follows -->
</table>
```

### Structure 7: Tabber Containers (19%)

**Used by:** Blue Box, Act-Age, Moriarty, A Couple of Cuckoos

```html
<div class="tabber wds-tabber">
  <div class="tabbertab" title="Volume 1">
    <ul>
      <li><a href="/wiki/Chapter_1">1. First Chapter</a></li>
    </ul>
  </div>
</div>
```

### Structure 8: Collapsible Sections (65%)

**Used by:** Most major wikis (often wrapping other structures)

```html
<div class="mw-collapsible mw-collapsed">
  <table class="wikitable"><!-- chapter rows --></table>
</div>
```

### Structure 9: `#N` Hash Prefix (9%)

**Used by:** One Piece, Boruto, Psyren, Ballroom e Youkoso

```html
<td>#1</td>
<td><a href="/wiki/Chapter_1">Romance Dawn</a></td>
```

### Structure 10: `Chapter N:` Word Prefix (8%)

**Used by:** Conan, Nokotan, Skeleton Knight, Tokyo Revengers

```html
<a href="/wiki/Chapter_1" title="Chapter 1">Chapter 1: Beginning</a>
```

### Structure 11: Gallery-Based Chapter Listing (RARE but real)

**Used by:** My Deer Friend Nokotan (Shikanoko)

```html
<div class="wikia-gallery wikia-gallery-caption-below">
  <div class="wikia-gallery-item" style="width:127px;">
    <div class="thumb" style="height:127px;">
      <a class="image lightbox" href="/wiki/File:Chapter_1.jpg">
        <img src="..." />
      </a>
    </div>
    <div class="lightbox-caption" style="width:125px;">
      <a href="/wiki/Chapter_1" title="Chapter 1">Chapter 1</a>: "Girl Meets Deer"
    </div>
  </div>
</div>
```

**Key:** Chapter info is in `<div class="lightbox-caption">` with format `<a>Chapter N</a>: "Title"`

### Structure 12: Scene/Act Alternative Naming (Act-Age pattern)

**Used by:** Act-Age, some drama/theater manga

```html
<li><a href="/wiki/Scene_17" title="Scene 17">Scene 17: First Scene Together</a></li>
```

**Key:** Uses "Scene" instead of "Chapter" in both URL and display text.

### Structure 13: Paired Header+Content Tables (JoJo pattern)

**Used by:** JoJo Part 7 - Steel Ball Run

```html
<!-- Orange header table -->
<table style="background:#d4813d; color:#660000;">
  <!-- Volume info -->
</table>
<!-- Silver content table -->
<table style="solid #031403;background:#C0C0C0;">
  <td style="font-size:85%;">
    <ol start="12">
      <li><a href="/wiki/SBR_Chapter_12">Title</a>
        <span style="font-weight: normal">(JP title)</span></li>
    </ol>
  </td>
</table>
```

**Key:** Prefixed chapter URLs (`SBR_Chapter_N`), paired table layout, `<ol start>` grouping.

---

## Currently Handled vs Needed

### Currently Handled (extractChapterTitles)

| Tier | Pattern | Regex | Coverage |
|------|---------|-------|----------|
| 1 | `N. <a><b>Title</b></a>` | `(\d{2,4})\.\s*<a[^>]*><b>([^<]+)</b></a>` | Partial |
| 1 | `N. <b><a>Title</a></b>` | `(\d{2,4})\.\s*<b><a[^>]*>([^<]+)</a></b>` | Partial |
| 1/2 | `N. <a>Title</a>` | `(\d{1,4})\.\s*<a[^>]*>([^<]+)</a>` | 4.7% |
| 3 | `<a>N. Title</a>` | `<a[^>]*>(\d{1,4})\.\s*([^<]+)</a>` | 61.2% |
| 4 | `<ol><li><a>Title</a></li>` | Ordered list extraction | 8.2% |

### HIGH PRIORITY — Need Implementation

| Priority | Pattern | Impact | Example Titles |
|----------|---------|--------|----------------|
| P0 | **Wikitable `<li>` inside `<td>`** | 62-74% | JJK, One Piece, MHA, AoT |
| P0 | **`<li><span><a>Title</a></span>`** | 67.1% | Most manga.fandom pages |
| P1 | **`<a title="Chapter N">` attr extraction** | 22.4% | Boruto, Blue Box, Nokotan |
| P1 | **`<td>N</td>...<td><a>Title</a>`** | 11.8% | Boruto, Saint Seiya, Kono Oto |
| P2 | **`<a>N - Title</a>` dash separator** | 8.2% | JoJo Part 7, Skeleton Knight |
| P2 | **`<a>Chapter N: Title</a>` word prefix** | 8.2% | Conan, Tokyo Revengers |
| P2 | **`<a>Chapter N</a>` (no title)** | 9.4% | Tsugumomo, Delicious in Dungeon |
| P3 | **`Episode N` naming** | 9.4% | Barakamon, By the Grace of Gods |
| P3 | **`#N` hash prefix** | 9.4% | One Piece, Boruto, Psyren |
| P3 | **`<a>#N Title</a>`** | 1.2% | Rare but valid |
| P3 | **Gallery `lightbox-caption`** | Rare | Nokotan |
| P3 | **Scene/Act/Round naming** | 3.5% | Act-Age, JoJo |
| P3 | **Prefixed chapter URLs** (`SBR_Chapter_N`) | Rare | JoJo SBR |
| P3 | **Quoted titles** `"<a>Title</a>"` | Naruto | Strip quotes from title |
| P3 | **Bullet-separated** `<a>N</a> • <a>N</a>` | MHA navbox | Numbers only, no titles |
| P3 | **Ruby annotations** after title | MHA, Naruto | Strip `<ruby>` from title |

### STRUCTURAL — Need Awareness (Not Direct Extraction)

These are container/wrapper patterns that affect HOW we find chapter data:

| Pattern | Impact | Notes |
|---------|--------|-------|
| Collapsible sections | 65% | Content hidden in collapsed divs |
| Tabber widgets | 19% | Chapters split across tabs |
| article-table class | 6% | Different table styling |
| Navbox | 6% | May contain false-positive chapter links |

---

## Sample Titles Per Pattern Group

### Group A: Wikitable + UL/LI (most common)
Jujutsu Kaisen, One Piece, My Hero Academia, Naruto, Demon Slayer, Promised Neverland, Chainsaw Man, Flame of Recca, Gamaran, Free!, Boys Over Flowers, Barbara, Captain Harlock

### Group B: `<a>N. Title</a>` inside link
Demon Slayer, Psyren, Ballroom e Youkoso, Moriarty the Patriot, Blue Box, Act-Age, A Couple of Cuckoos, Buso Renkin

### Group C: Table-based `<td>N</td>...<td><a></a></td>`
Boruto, Saint Seiya, RG Veda, Prince of Tennis, Yotsuba&!, Kono Oto Tomare!, Magical Girl Site

### Group D: `<ol>` Ordered lists
Attack on Titan, Moriarty the Patriot, Psyren, Yotsuba&!

### Group E: Tabber containers
Blue Box, Act-Age, Moriarty the Patriot, Stellar Witch LIP, A Couple of Cuckoos, Skeleton Knight

### Group F: Dash separator `<a>N - Title</a>`
JoJo Part 7 - Steel Ball Run, Skeleton Knight, Meow Man, Saint Seiya, One Piece

---

## Recommended Implementation Priority

### Phase 1 (P0 — covers ~70% more pages)
1. Parse `<li>` chapter entries inside wikitable `<td>` containers
2. Handle `<li><span><a>Title</a></span></li>` nested structure
3. Extract from UL lists (not just OL) within volume table cells

### Phase 2 (P1 — covers ~30% more pages)
4. Extract chapter info from `<a title="Chapter N">` attributes
5. Parse `<td>N</td>...<td><a>Title</a></td>` table row patterns
6. Handle `<a>N - Title</a>` dash-separated format

### Phase 3 (P2 — edge cases)
7. Parse `Chapter N:` word prefix format
8. Handle `<a>Chapter N</a>` without title (use link text as title)
9. Support Episode/Round/Stage/Mission naming conventions
10. Handle `#N` hash prefix format

### Phase 4 (Structural awareness)
11. Unwrap collapsible sections before parsing
12. Iterate through tabber tabs
13. Exclude navbox content from chapter matching
14. Handle article-table vs wikitable class differences

---

## Cross-Wiki Comparison (Top 5 Manga — Verified Live)

| Wiki | Container | Chapter # Format | Chapter Title Format | List Type | Collapsible? |
|------|-----------|-----------------|---------------------|-----------|-------------|
| **One Piece** | `wikitable` + `navibox mw-collapsible` | `<a>N</a>` (linked numeral) | N/A (arcs only on main page) | `<ul>/<li>` in hlist | Yes |
| **Promised Neverland** | `article-table` per volume | `NNN.` plain text | `<a>Title</a>` (plain link) | `<ul>/<li>` | No |
| **My Hero Academia** | `toccolours mw-collapsible` | `NNN.` plain text | `<b><a>Title</a></b>` + ruby JP | `<ul>/<li>` | Yes |
| **Naruto** | `wikitable list-noicon fill-horiz` | `NNN.` plain text | `"<a>Title</a>"` (quoted!) + JP | `<ul>/<li>` | No |
| **Attack on Titan** | Inline-styled `<table>` | Implicit via `<ol start="N">` | `<a>Title</a>` (plain link) | `<ol>/<li>` | No |
| **JJK** | Inline-styled `<table>` | `NNN.` plain text | `<a><b>Title</b></a>` + nihongo span | `<ul>/<li>` | No |
| **Demon Slayer** | Inline-styled `<table>` | Inside link: `<a>N. Title</a>` | Title inside link | `<ul>/<li>` | Yes (tabber) |

### Universal Patterns (confirmed across all 7)
- Chapter links use `href="/wiki/Chapter_N"` or `href="/wiki/Title"` with `title="Chapter N"` attr
- Volume headers: `<span class="mw-headline" id="Volume_N">` inside `<h3>` or `<h4>`
- Chapter lists: `<ul>/<li>` (6/7 wikis) or `<ol>/<li>` (AoT)
- `<b>Chapters list:</b>` or `<b>Chapters List:</b>` label precedes lists in MHA, AoT, JJK
- Zero-padded `NNN.` numbering used by Neverland, MHA, Naruto, JJK

### NEW Pattern: Quoted Titles (Naruto)

```html
<li>001. "<a href="/wiki/Naruto_Uzumaki!!_(chapter_1)" title="Naruto Uzumaki!! (chapter 1)">
Naruto Uzumaki!!</a>" (<span lang="ja">うずまきナルト!!</span>, <i>Uzumaki Naruto!!</i>)</li>
```

Titles wrapped in **quotation marks** — current parser would capture the opening `"` as part of the title.

### NEW Pattern: Bullet-Separated Compact List (MHA navbox)

```html
<td><a href="/wiki/Chapter_1" title="Chapter 1">1</a> •
<a href="/wiki/Chapter_2" title="Chapter 2">2</a> •
<a href="/wiki/Chapter_3" title="Chapter 3">3</a> • ...</td>
```

Chapter numbers as linked text separated by ` • ` — no titles, just numbers.

### NEW Pattern: Ruby Annotations (MHA, Naruto)

```html
<li>001. <b><a href="/wiki/Chapter_1">Izuku Midoriya: Origin</a></b>
<span style="font-weight: normal"> (<span class="t_nihongo_kanji" lang="ja">
<ruby lang="ja"><rb>緑</rb><rp> (</rp><rt>みどり</rt><rp>) </rp></ruby>...
</span></span></li>
```

Japanese text with `<ruby>/<rb>/<rt>` reading aids following chapter title.

---

## ComicVine Pattern Analysis

ComicVine pages are Cloudflare-protected (403 on direct fetch), but the codebase already has mature parsers in `src/server/services/comicvine/`. Analysis from existing production code:

### ComicVine Chapter Listing Patterns (Already Handled)

| Pattern | Structure | Example |
|---------|-----------|---------|
| **Structured HTML lists** | `<h2>Chapter Titles</h2><ul><li>Chapter 1: Title</li></ul>` | Most common |
| **Prose text** | Chapters in `.wiki-item-display` body text | Regex-parsed |
| **API descriptions** | Issue `description` field with HTML chapter lists | JSON API |

### ComicVine Chapter Title Formats (from `constants.ts`)

| Format | Example | Status |
|--------|---------|--------|
| `Chapter N: Title` | `Chapter 1: Romance Dawn` | Handled |
| `Chapter ROMAN: Title` | `Chapter CLXVI: Final Battle` | Handled |
| `Spell N: Title` | `Spell 1: Caiman` (Dorohedoro) | Handled |
| `N: Title` (plain) | `1: Romance Dawn` | Handled |
| `ROMAN: Title` | `I: Romance Dawn` | Handled |
| `Chapter 0-X: Title` | `Chapter 0-1: The Cursed Child` | Handled |
| `Final/Last Chapter` | `Final Chapter: Sayonara` | Handled |
| `Epilogue N` | `Epilogue 1: After the Battle` | Handled |
| `Special Chapter` | `Special Chapter: The Whistle` | Handled |
| `Side Story/Extra/Omake` | `Side Story: Origin` | Handled |

### ComicVine Volume Number Formats

| Format | Example | Status |
|--------|---------|--------|
| `Issue #N` | `Issue #34` | Handled |
| `#N` | `#34` | Handled |
| `Volume N` | `Volume 34` | Handled |
| `Vol. N` | `Vol. 34` | Handled |

**Key files:** `src/server/services/comicvine/constants.ts`, `list-parser.ts`, `text-parser.ts`, `metadata-extractor.ts`

**Conclusion:** ComicVine chapter parsing is well-covered. The major gap is on the **Fandom side** where wikitable + UL/LI patterns dominate but aren't handled by `extractChapterTitles`.

---

## Raw Data Files

- `docs/development/fandom-html-pattern-survey-data-merged.json` — All 269 survey results
- `scripts/surveys/selected-titles.json` — Batch 1 title selection
- `scripts/surveys/selected-titles-batch2.json` — Batch 2 title selection
