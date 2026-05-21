# Fandom Search & Metadata Audit Report - Fire Force

## Executive Summary

This audit traces the complete data flow for a Fire Force search using the Fandom provider, from initial search query through metadata extraction to UI presentation in the Universal Import Wizard.

## 1. Search Flow Architecture

### 1.1 Provider Initialization
**File:** `src/server/services/search/providers/FandomProvider.ts`

The FandomProvider initializes with 9 popular wikis by default:
- naruto, onepiece, dragonball, myheroacademia, **fireforce**, demonslayer, jujutsukaisen, attackontitan, bleach

Fire Force wiki configuration:
```typescript
fireforce: {
  name: 'Fire Force',
  subdomain: 'fire-force',  // Maps to https://fire-force.fandom.com
  categories: {
    characters: 'Characters',
    chapters: 'Chapters',
    volumes: 'Volumes',
    arcs: 'Story Arcs'
  }
}
```

### 1.2 Search Execution Path

1. **Query Detection** (lines 129-138): Provider detects "fire force" in query and prioritizes fireforce wiki
2. **Multi-Wiki Search** (lines 144-170): Searches up to 3 wikis in parallel
3. **API Calls**: Each wiki search triggers:
   - MediaWiki API search endpoint
   - Fandom v1 API (often deprecated/unavailable)
4. **Enhanced Metadata Fetch** (lines 130-179): Always fetches enhanced details for manga results

## 2. Metadata Extraction Process

### 2.1 Data Sources
**File:** `src/server/services/fandom/FandomService.ts`

The service extracts metadata from multiple sources:

#### A. Infobox Template (lines 644-826)
Primary metadata fields extracted:
- **Author**: Fields checked: Author, Written by, Writer, Creator, Created by
- **Artist**: Fields checked: Illustrated by, Artist, Illustrator
- **Publisher**: 8+ field variations checked (Publisher, English publisher, Licensed by, etc.)
- **Volumes/Chapters**: With special Chapter 0 detection logic (lines 746-765)
- **Alternative Titles**: 15+ field variations checked (Romaji, Kanji, Japanese, English, etc.)
- **Dates**: Original run, Published fields parsed into start/end dates

#### B. Wikitext Content Parsing (lines 829-1270)
Secondary extraction from page content:
- Synopsis/Plot sections
- Author/artist patterns in wikilinks
- Publisher detection (common publishers list)
- Volume/chapter counts from content patterns
- Date ranges from text
- Alternative titles from specific patterns

#### C. HTML Scraping (lines 1295-1430)
For accurate volume counts:
- Fetches List of Volumes page HTML
- Parses volume links and table cells
- Handles series-specific patterns (e.g., "Fire Force 1", "Fire Force 2")
- Updates counts if higher than infobox values

### 2.2 Special Logic

#### Chapter 0 Detection (lines 1517-1563)
The system includes sophisticated logic to detect and account for Chapter 0:
- 10+ patterns checked in wikitext
- Adjusts chapter count if Chapter 0 exists but isn't included
- Checks for prologue patterns that might indicate Chapter 0

#### Volume List URL Extraction (lines 835-862)
Searches for volume list pages:
- Patterns: [[List of Volumes]], [[Volumes and Chapters]], etc.
- Stores URL for potential volume data fetching

## 3. Data Transformation

### 3.1 Result Transformation
**File:** `src/server/services/search/providers/FandomProvider.ts` (lines 247-366)

Each Fandom result is transformed to standard SearchResult format:
```typescript
{
  id: `${wikiKey}:${result.id}`,
  title: result.title,
  alternativeTitles: [...],  // From multiple sources
  description: enhanced || abstract,
  coverImage: thumbnail,
  status: 'ONGOING' | 'FINISHED' | 'HIATUS',
  format: 'MANGA',
  year: extracted from published date,
  startDate/endDate: parsed from date ranges,
  author/artist: from infobox or content,
  authors/artists: arrays for multiple creators,
  publisher/magazine/demographic: from various fields,
  chapters/volumes: parsed as numbers,
  volumesListUrl: for volume parsing,
  score: relevance score (0-100),
  provider: 'fandom',
  providerUrl/wikiUrl/url: wiki page URL,
  metadata: {
    // All extracted data duplicated here
    wiki, wikiKey, originalType,
    synopsis, description,
    // ... all other fields
  }
}
```

### 3.2 Relevance Scoring (lines 527-566)
Scoring algorithm:
- Main manga page (ending with "(manga)" or "(series)"): 100 points
- Exact title match: 95 points
- Title starts with query: 80 points
- Title contains query: 60 points
- Manga-specific pages: +20 points
- Non-manga content (anime/game/movie): -30 points

## 4. Wizard Data Handling

### 4.1 WizardContext
**File:** `src/components/addManga/context/WizardContext.tsx`

The wizard context manages:
- `formData`: Core form fields (title, description, status, etc.)
- `selectedSourcesMetadata`: Provider-specific metadata storage
- `volumesData`: Parsed volume information
- `mediaGallery`: Cover and banner images
- `chapterMetadataCache`: Cached chapter details

Initial metadata mapping (lines 141-234):
```typescript
initialMetadata[provider] = {
  id, sourceId, title,
  url: initialData.url || wikiUrl || providerUrl,
  volumes, chapters, // Parsed as numbers
  alternativeTitles, authors, artists,
  publisher, status, format,
  startDate, endDate,
  volumeData: [...], // If available
  rawData: complete search result
}
```

### 4.2 Search Step
**File:** `src/components/addManga/steps/searchStep.tsx`

Handles search execution and result processing:
- Provider detection and query parsing
- Result caching and deduplication
- Metadata extraction from results
- UI state management

## 5. UI Presentation

### 5.1 Metadata Display Components

#### VolumesChaptersStep
**File:** `src/components/addManga/steps/wizard/VolumesChaptersStep.tsx`

Displays volume/chapter data with:
- Volume count from metadata
- Chapter ranges
- Selection interface
- Metadata source dropdown (for selecting between providers)

Key features:
- Raw value tracking with provider suffix (e.g., "34:fandom")
- Allows selection from any metadata source
- Updates formData with selected values

### 5.2 Search Refresh Mechanism

The search refresh button clears caches and forces new searches:
- Clears cached search results
- Bypasses all cache layers
- Re-executes full search pipeline

## 6. Known Issues & Observations

### 6.1 Search Issues
- Fire Force search returned 0 results in test (likely due to exact match requirements)
- Fandom v1 API frequently returns 404/unavailable
- Search prioritization may not always select the correct wiki

### 6.2 Data Quality
- Chapter 0 detection is heuristic-based, may have false positives
- Volume counts from HTML scraping more accurate than infobox
- Alternative titles extraction is comprehensive but may include noise
- Date parsing handles multiple formats but may miss some

### 6.3 Performance Considerations
- Parallel wiki searches (up to 3 by default)
- Enhanced metadata fetch adds latency but provides complete data
- HTML scraping for volumes adds additional HTTP request
- Caching enabled with 1-hour TTL

## 7. Data Flow Summary

```
User Input (Fire Force)
    ↓
FandomProvider.search()
    ↓
Priority Wiki Detection (fireforce)
    ↓
Parallel Wiki Searches (3 wikis max)
    ↓
FandomService.search() per wiki
    ├── MediaWikiAPI.search()
    ├── FandomV1API.searchArticles() [often fails]
    └── getPageMetadata() [enhanced data]
        ├── Infobox parsing
        ├── Wikitext extraction
        └── HTML volume scraping
    ↓
Transform to SearchResult
    ↓
Relevance scoring & sorting
    ↓
Return to UI
    ↓
WizardContext storage
    ├── formData (basic fields)
    ├── selectedSourcesMetadata (provider data)
    └── volumesData (parsed volumes)
    ↓
UI Components
    ├── SearchResults display
    ├── VolumesChaptersStep
    └── Metadata form fields
```

## 8. Recommendations

1. **Improve Search Accuracy**: Consider fuzzy matching for wiki selection
2. **Optimize API Calls**: Skip deprecated v1 API if consistently failing
3. **Enhance Chapter Detection**: Add configuration for known Chapter 0 series
4. **Add Validation**: Verify extracted data against expected ranges
5. **Improve Caching**: Implement smarter cache invalidation
6. **Error Handling**: Add fallbacks for failed metadata extraction
7. **Volume Parsing**: Consider caching parsed volume HTML data

## Conclusion

The Fandom search and metadata extraction system is comprehensive but complex, with multiple data sources and transformation steps. The system successfully extracts detailed metadata through various methods, though accuracy depends on wiki data quality and structure consistency. The UI integration through the wizard provides good flexibility for selecting between multiple metadata sources.