# Wikipedia Volume Parser Debugging Workflow

*Canonical: Yes*
*Last Updated: 2025-03-08*

## Overview

Step-by-step workflow for debugging and fixing Wikipedia volume parser issues — specifically misaligned chapter-to-volume assignments. Based on the Tokyo Revengers / Attack on Titan debugging session.

---

## Quick Commands

```bash
# Check enrichment quality for a specific manga
./scripts/validation/validate-enrichment-quality.sh --manga 213

# Run regression tests (known-good manga)
./scripts/validation/validate-enrichment-quality.sh --regression

# Save baseline before making changes
./scripts/validation/validate-enrichment-quality.sh --snapshot

# Compare against baseline after changes
./scripts/validation/validate-enrichment-quality.sh --compare

# Check DB state directly
npx ts-node -e "..." # See SQL queries below
```

---

## Architecture: Two Data Sources

The Wikipedia fallback phase (`phase-wikipedia-fallback.ts`) uses two extraction paths:

### Stage 1: findBestMatch (API-based)
```
findBestMatch → searchManga → "List of X chapters" page
  → parseChapterTables → tryOrderedListExtraction → chapters from <ol> format
  → parseNumberedChaptersPattern → extractFullVolumeSection per volume
  → countOlListChapters: Vol1=5, Vol2=9, Vol3=9, ...
  → findVolumeForChapter maps index→volume
```
- **Best for**: Chapter-to-volume assignments (structured HTML parsing)
- **Weakness**: May return placeholder titles ("Chapter N") if chapter list uses `<ol>` format without titles
- **Volume count source**: Volume markers in chapter list page (`id="volN"`)

### Stage 2: adaptiveExtract (Structural parsing)
```
adaptiveExtract → parseWikitableContent → parseVolumeTableWithDescriptions
  → extractChaptersFromRange or extractIndividualChapters
  → extractDescriptionAndChapters
```
- **Best for**: Volume descriptions, chapter titles, metadata
- **Weakness**: Pattern 4 (greedy regex) can match dates/ISBNs as chapters, producing bad volume assignments

### Merge Strategy (Current)

1. **findBestMatch runs first** — produces chapters with reliable volume assignments
2. **adaptive supplements** — adds titles, descriptions, metadata BUT never replaces findBestMatch's chapters
3. `supplementChapterMetadata()` — copies titles from adaptive into findBestMatch chapters by matching chapter number
4. `supplementVolumeDescriptions()` — copies descriptions from adaptive volumes

**Key rule**: findBestMatch's `volumeNumber` assignments are NEVER overridden by adaptive.

---

## Debugging Workflow

### Step 1: Identify the Problem

```sql
-- Check chapter-level data coverage
SELECT
  m.title,
  COUNT(*)::int as total_chapters,
  COUNT(c.title)::int as with_title,
  COUNT(c.volume)::int as with_volume,
  COUNT(c."releaseDate")::int as with_release_date
FROM "Chapter" c
JOIN "Manga" m ON c."mangaId" = m.id
WHERE m.id = <MANGA_ID>
GROUP BY m.title;

-- Check volume assignments (first 10 volumes)
SELECT volume, MIN("chapterNumber")::int as ch_start,
       MAX("chapterNumber")::int as ch_end, COUNT(*)::int as ch_count
FROM "Chapter"
WHERE "mangaId" = <MANGA_ID> AND volume IS NOT NULL
GROUP BY volume ORDER BY volume LIMIT 10;

-- Check Volume records
SELECT number, "chapterStart", "chapterEnd",
       LEFT(description, 60) as desc_preview
FROM "Volume"
WHERE "mangaId" = <MANGA_ID>
ORDER BY number LIMIT 10;
```

### Step 2: Check Server Logs

After triggering enrichment, filter logs:
```bash
grep -E "\[enrichmentPipeline\]|\[WIKIPEDIA\]" <server-output> | grep -v "Query:" | tail -40
```

**Key log lines to look for:**
```
findBestMatch: N chapters, M volumes     # Stage 1 results
adaptive: N chapters, M volumes           # Stage 2 results
Wikipedia merge: ...                      # Which source won
Volume range overlap ratio: X/Y (Z%)     # Volume quality check
Wikipedia volume data also has excessive overlaps  # Volume ranges rejected
Wikipedia set volume ranges...            # Ranges applied successfully
Volume assignment: N assigned             # Chapters assigned to volumes
Audit: N chapters without volume          # Unassigned chapters
```

### Step 3: Diagnose the Issue

| Symptom | Likely Cause | Fix Location |
|---------|-------------|--------------|
| Vol 2 has 1 chapter, shifted | findBestMatch volume assignment off-by-one | `numbered-chapters-pattern.ts:extractVolumeInfo` |
| 0 titles gap-filled | findBestMatch has placeholder titles, adaptive returned 0 chapters | `phase-wikipedia-fallback.ts:supplementChapterMetadata` |
| "excessive overlaps — skipping" | Volume assignments are unreliable | `fandom-volume-helpers.ts:hasExcessiveOverlaps` |
| Only N volumes updated (expected M) | Missing Volume records in DB | `phase-wikipedia-fallback.ts:createMissingVolumes` |
| N chapters without volume | Volume ranges don't cover all chapters | `fandom-volume-helpers.ts:assignVolumesFromRanges` |
| Enhanced extractor returns 75 volumes (expected 34) | Parsing both JP and EN edition rows | `volume-list-extractor.ts` / enhanced extractor |

### Step 4: Trace the Data Flow

```
phase-wikipedia-fallback.ts → fetchWikipediaData(title)
  ↓
Stage 1: findBestMatch (API path)
  → searchManga → chapter list page
  → parseChapterTables → extractVolumeInfo → findVolumeForChapter
  → Result: chapters with volumeNumber assignments
  ↓
Stage 2: adaptiveExtract (structural path)
  → parseVolumeTableWithDescriptions → extractIndividualChapters
  → Result: chapters with titles, descriptions (but potentially bad volumes)
  ↓
mergeAdaptiveIntoExisting
  → KEEPS findBestMatch chapters (reliable volume assignments)
  → SUPPLEMENTS titles from adaptive via supplementChapterMetadata
  → SUPPLEMENTS volume descriptions via supplementVolumeDescriptions
  ↓
convertToGapFillMaps → chapterVolumeMap
  ↓
applyWikipediaVolumeRanges
  → createMissingVolumes (ensure Volume records exist)
  → updateVolumeRanges (set chapterStart/chapterEnd)
  → assignVolumesFromRanges (assign chapters to volumes)
```

### Step 5: Validate Fix

1. **Type check**: `bunx tsc --noEmit`
2. **Lint**: `npx eslint <modified-files>`
3. **Regression test**: `./scripts/validation/validate-enrichment-quality.sh --regression`
4. **Re-enrich the manga** via UI
5. **Check DB state** with SQL queries from Step 1
6. **Verify logs** show correct flow

---

## Common Fixes

### Pattern 4 False Positives (volume-parser.ts)

Pattern 4 in `extractIndividualChapters` is a greedy catch-all regex that matches any `N. text` pattern. It can match dates, ISBNs, etc.

**Fix**: `isSpuriousPattern4()` validates that matched numbers form a consecutive sequence (max gap of 3).

### Missing Volume Records

`updateVolumeRanges` only updates existing Volume records. If Wikipedia finds 34 volumes but DB only has 5, only 5 get ranges.

**Fix**: Call `createMissingVolumes()` before `updateVolumeRanges()` in `applyWikipediaVolumeRanges`.

### Adaptive Overriding findBestMatch

When adaptive has more chapters, the merge used to replace findBestMatch entirely. But adaptive's volume assignments are unreliable.

**Fix**: Always keep findBestMatch chapters. Only supplement titles/metadata from adaptive via `supplementChapterMetadata()`.

### Off-by-one Chapter Assignments

`validateAndFixChapterVolumeMap` checks if chapters start at 0 and shifts +1.

---

## Key Files

| File | Purpose |
|------|---------|
| `enrichment-pipeline/phase-wikipedia-fallback.ts` | Orchestrates Wikipedia fallback, merge logic |
| `wikipedia/volume-parser.ts` | HTML table parsing, chapter extraction |
| `wikipedia/chapter-parser/formats/numbered-chapters-pattern.ts` | Chapter list page parsing, volume assignment |
| `wikipedia/manga-extractor/best-match-finder.ts` | findBestMatch orchestration |
| `wikipedia/manga-extractor/best-match-finder-helpers.ts` | Enhanced extractor, processChapterList |
| `enrichment-pipeline/fandom-volume-helpers.ts` | Volume range management, assignment |
| `enrichment-pipeline/volume-range-sanitization.ts` | Volume range overlap detection |

---

## Adding Regression Cases

When fixing a manga, add it to the regression test suite:

1. **Verify correct data** in DB after fix
2. **Add to `scripts/validation/validate-enrichment-quality.sh`**:
```bash
REGRESSION_CASES=(
  "213|Tokyo Revengers|1:1-5|2:6-14|3:15-23|0.95|0.90"
  "185|Attack on Titan|1:1-4|2:5-8|3:9-12|0.80|0.90"  # Add new case
)
```
Format: `mangaId|title|vol:chStart-chEnd|...|minVolumeCoverage|minTitleCoverage`

3. **Run regression**: `./scripts/validation/validate-enrichment-quality.sh --regression`
4. **Save new baseline**: `./scripts/validation/validate-enrichment-quality.sh --snapshot`
