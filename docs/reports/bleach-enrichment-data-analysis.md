# Bleach Enrichment Pipeline — Data Flow Analysis

*Manga ID: 201 | Total Chapters: 706 | Total Volumes: 74*
*Date: 2026-03-13*

---

## Current State After Re-Identify

| Metric | Count |
|--------|-------|
| Total chapters in DB | 706 |
| Chapters with real titles | **74** (10.5%) |
| Chapters with generic titles | **632** (89.5%) |
| Chapters with volume assignment | 74 |
| Chapters without volume | 632 |
| Chapters with files on disk | 0 |
| All chapters status | PENDING |

### Sample: Enriched Chapters (1-10)

| # | Title | Volume |
|---|-------|--------|
| 1 | The Death and the Strawberry | 1 |
| 2 | Goodbye Parakeet, Goodnite My Sista | 2 |
| 3 | Memories in the Rain | 3 |
| ... | ... | ... |
| 8 | The Blade and Me | 8 |

### Sample: Unenriched Chapters (75+)

| # | Title | Volume |
|---|-------|--------|
| 75 | Chapter 75 | NULL |
| 76 | Chapter 76 | NULL |
| ... | ... | ... |

---

## Phase 1: Provider Fetch (MangaDex + AniList + ComicVine)

**Result:** tier=full, completeness=96%, sources=3, errors=0

### What Each Provider Returned

#### MangaDex
- **74 granular chapters** — one per volume, not per individual chapter
- Each has: `chapterNumber` (volume-level: "1", "2"..."74"), `title`, `volume`, `pages`
- Language: English scan groups only
- **Problem:** MangaDex API returns volume-level chapter aggregation, not all 706 individual chapters

#### AniList
- **Scalar count only:** `totalChapters: 706`, `totalVolumes: 74`
- **No per-chapter data** — no `chapters[]` array, just a number
- Provides: metadata (genres, score, dates, synopsis, covers, etc.)

#### ComicVine
- **74 volumes** with titles, descriptions, and cover images
- `chapterStart`/`chapterEnd` are **broken**: mapped 1:1 to volume numbers (vol 1 → start:1/end:1, vol 8 → start:8/end:8)
- Should be: vol 1 → start:1/end:7, vol 8 → start:62/end:70
- **Per-chapter titles ARE embedded** in volume `description` text as unstructured "Chapter List":

```
Volume 1 description:
  "Chapter List
   1.Death＆Strawberry デス・アンド・ストロベリー
   2.Starter スターター
   3.Headhittin' ヘッドヒッティン
   4.WHY DO YOU EAT IT？ ...
   5.Binda・blinda ...
   6.microcrack. ...
   7.The Pink Cheeked Parakeet ..."

Volume 8 description:
  "Chapter List
   62.Lesson2-2：Bad Endin' In The Shaft ...
   63.Lesson2-3：Innercircle Breakdown ...
   64.BACK IN BLACK ...
   65.Collisions ...
   66.THE BLADE AND ME ...
   67.End of Lessons ...
   68.最後の夏休み
   69.25:00 gathering ...
   70.Where Hollows Fear To Tread ..."
```

#### Merger Output
- `enriched.manga.chapters`: 74 entries (MangaDex volume-level)
- `enriched.manga.volumes`: 74 entries (ComicVine volumes)
- Scalar metadata from AniList: 706 chapters total

---

## Phase 2: DB Persistence

```
granularChapters=74, granularVolumes=74, scalarChapterCount=706, inferredChapterCount=706
```

**Tier Selection:** `useGranularChapters = 74 >= 706 * 0.5 (353)` → **FALSE**

Since 74 granular chapters is far below the 50% threshold of 706, the system fell to **Tier 2** (scalar chapter list). Tier 2 generates chapters 1–706 from the scalar count, using `granularTitleMap` for any available titles.

But `buildGranularTitleMap` filters by `isLikelyEnglish()` and `source === 'mangadex'` — most of the 74 MangaDex chapters had volume-level titles that may not have passed the filter.

**Result:** `0 updated, 0 created, 706 preserved` — all 706 chapters already existed from prior import, and Tier 2 had no new title data to apply.

**Volume persistence:** 74 volumes created from ComicVine data (with broken chapter ranges).

---

## Phase 3: AI Agent

```
AI agent enabled for manga 201 ("Bleach") via feature flag and rollout routing
Starting AI agent enrichment
Agent response received: confidence=0.8, toolCallsCount=1
```

### What the AI agent did

The Qwen3.5-2B local model received the enrichment prompt and decided to call **only 1 tool**: `mangadex_enrichment`. It did NOT call `fandom_enrichment` or `wikipedia_enrichment`.

The MangaDex tool re-ran `enrichByTitle("Bleach")` and got the same 74 chapters/volumes. This time, `buildChapterList()` (our fix) extracted all 74 chapter entries without the `isLikelyEnglish` filter.

```
MangaDex enrichment completed: chapterCount=74, volumeCount=74
Enrichment maps generated:
  chapterTitles: 74        ← volume titles applied as chapter titles
  volumeAssignments: 74
  volumeDescriptions: 74
  covers: 0
  descriptions: 0
```

**Applied to DB:** 74 chapters updated with titles + volume assignments.

### What the AI agent did NOT do

- Did NOT call `fandom_enrichment` — Fandom Bleach wiki has all 706 chapter titles
- Did NOT call `wikipedia_enrichment` — Wikipedia has chapter-to-volume mappings
- Did NOT parse ComicVine description text — 706 chapter titles are embedded there

---

## Root Cause: Why 632 Chapters Have No Data

### Data Availability by Source

| Source | Individual Chapter Titles | Chapter Count | Used? |
|--------|--------------------------|---------------|-------|
| **Fandom Wiki** | ~706 (all chapters listed) | 706 | NOT CALLED by AI agent |
| **Wikipedia** | ~706 (chapter lists) | 706 | NOT CALLED by AI agent |
| **ComicVine descriptions** | ~706 (embedded in text) | 706 | NOT PARSED |
| **MangaDex granular** | 74 (volume-level only) | 74 | USED |
| **AniList** | 0 (scalar only) | 706 (number) | Scalar count only |

### The 74 "chapter titles" are actually volume titles

The enrichment mapped ComicVine **volume titles** as chapter titles:
- Chapter 1 → "The Death and the Strawberry" (actually Volume 1's title)
- Real chapter 1 title: "Death & Strawberry"
- Real volume 1 contains chapters 1–7, not just chapter 1

### Volume chapter ranges are broken

ComicVine volumes have `chapterStart === chapterEnd === volumeNumber`:
- Volume 1: chapterStart=1, chapterEnd=1 (should be 1–7)
- Volume 8: chapterStart=8, chapterEnd=8 (should be 62–70)

This means volume-to-chapter assignment is wrong — each volume is linked to only 1 chapter instead of its actual range.

---

## What Needs to Change

### 1. AI Agent should call all enrichment tools (not just MangaDex)
The Qwen3.5-2B model only called 1 tool. Either:
- Force all tools to run in the orchestrator (don't rely on the LLM to choose)
- Add a gap-detection step: if agent maps cover < 50% of chapters, run Fandom + Wikipedia

### 2. Parse ComicVine chapter lists from volume descriptions
ComicVine descriptions contain structured "Chapter List" sections with numbered chapter titles. A parser could extract all ~706 individual chapter titles from the 74 volume descriptions.

### 3. Fix ComicVine chapter range mapping
`chapterStart`/`chapterEnd` are broken upstream in `mangadex-ts-client`. The chapter ranges need to be derived from the "Chapter List" content or from the next volume's start number.

### 4. Fandom + Wikipedia as mandatory enrichment (not optional)
These are the only sources with full per-chapter title coverage. They should always run, not be gated behind the AI agent's tool selection.
