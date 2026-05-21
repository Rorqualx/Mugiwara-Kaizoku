# Fandom Integration Fix Plan

*Status: Planning*
*Created: 2025-11-30*

## Problem Summary

Testing the Fandom scraper with Fire Force revealed multiple issues preventing data flow:

1. **FandomProvider.search() returns 0 results** - Type filtering too strict
2. **Fandom services bypass PatternLibrary entirely** - Uses hardcoded patterns
3. **Architecture disconnect** - Fandom has separate parsing pipeline from UnifiedMetadataParser

## Root Cause Analysis

### Issue 1: Search Returning No Results

**File**: `src/server/services/fandom/fandom/search.ts:51-81`

```typescript
// PROBLEM: determineResultType() only returns 'manga' for:
// - titles ending with "(manga)"
// - titles ending with "(series)"

// Fire Force wiki search returns "Fire Force Wiki" NOT "Fire Force (manga)"
// Result: All results filtered out as 'article' type
```

**Evidence from tests**:
- MediaWiki API returns results (10 items)
- FandomService.getMangaInfo() extracts 305 chapters successfully
- FandomProvider.search() filters ALL results out before returning

### Issue 2: Fandom Bypasses PatternLibrary

**Grep search for PatternLibrary in src/server/services/fandom/**: NO MATCHES

The Fandom flow uses hardcoded patterns in:
- `WikiMetadataExtractor.ts` - Hardcoded field names: "author", "artist", "publisher"
- `chapter-detail/constants.ts` - Hardcoded selectors
- `dynamic/wiki-content-scraper/enrichment.ts` - Custom extraction logic

Meanwhile, PatternLibrary has:
- Volume patterns: `/Volume\s+(\d+)/i`, `/Vol\.?\s*(\d+)/i`
- Chapter patterns: `/Chapter\s+(\d+)/i`, `/Ch\.?\s*(\d+)/i`
- Status patterns: `/\b(ongoing|completed|hiatus|cancelled)\b/i`
- ISBN patterns: `/ISBN[\s:]*([0-9]{13})/i`
- Date patterns: Multiple formats
- Genre patterns

**These patterns are NOT used by Fandom**.

### Issue 3: Architecture Disconnect

```
UnifiedMetadataParser         Fandom Services (Separate)
        |                              |
        v                              v
   PatternLibrary              WikiMetadataExtractor (hardcoded)
        |                              |
        v                              v
   ContentExtractor            DynamicWikiParser
        |                              |
        v                              v
   DataNormalizer              WikiContentScraper
```

FandomAdapter exists and bridges to UnifiedMetadataParser, but:
- It calls FandomService directly, which uses hardcoded patterns
- PatternLibrary patterns are never applied
- Results don't benefit from centralized pattern matching

## Fix Plan

### Phase 1: Immediate Fix - Search Returns Results (High Priority)

**Goal**: Make FandomProvider.search() return results for manga queries

**Changes**:

1. **Relax type filtering in determineResultType()** (`fandom/search.ts:51-81`)
   - Add fallback for wiki-specific main pages
   - Recognize "Fire Force (manga)" pattern AND wiki main pages
   - Allow pages without "(manga)" suffix when on a manga-specific wiki

```typescript
// Before (too strict)
if (lowerTitle.endsWith('(manga)') || lowerTitle.endsWith('(series)')) {
  return 'manga';
}

// After (allows wiki main pages)
if (lowerTitle.endsWith('(manga)') || lowerTitle.endsWith('(series)')) {
  return 'manga';
}
// Fire Force wiki's main page IS the manga page
if (wikiContext?.isMangaWiki && !isChapterOrVolumePage(lowerTitle)) {
  // Check if this could be the main manga page
  if (calculateRelevanceScore(wikiContext.mainTitle, title) > 80) {
    return 'manga';
  }
}
```

2. **Add wiki context to search** (`fandom/search.ts`)
   - Pass wiki configuration to determine if it's a manga-focused wiki
   - Use wiki name to infer main manga page

3. **Fix relevance filtering in FandomProvider** (`FandomProvider.ts:258-285`)
   - Lower MINIMUM_SCORE from 0.2 to 0.1 initially
   - Increase MAX_RESULTS from 5 to 10
   - Add special case for main manga page (exact wiki name match)

### Phase 2: PatternLibrary Integration (Medium Priority)

**Goal**: Replace hardcoded patterns in Fandom services with PatternLibrary

**Changes**:

1. **Create PatternLibraryBridge** (`src/server/services/fandom/patterns/PatternLibraryBridge.ts`)
   ```typescript
   import { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

   export class PatternLibraryBridge {
     private patternLibrary: PatternLibrary;

     extractVolumeNumber(text: string): number | null {
       return this.patternLibrary.match('volume', text)?.value;
     }

     extractChapterNumber(text: string): number | null {
       return this.patternLibrary.match('chapter', text)?.value;
     }

     extractStatus(text: string): string | null {
       return this.patternLibrary.determineStatus(text);
     }

     extractISBN(text: string): string | null {
       return this.patternLibrary.match('isbn', text)?.value;
     }

     extractDate(text: string): string | null {
       return this.patternLibrary.match('date', text)?.value;
     }
   }
   ```

2. **Inject PatternLibraryBridge into WikiMetadataExtractor**
   - Replace hardcoded field lookups with pattern matching
   - Use PatternLibrary for status detection
   - Use PatternLibrary for date extraction

3. **Update DynamicWikiParser to use PatternLibrary**
   - Use volume patterns for volume detection
   - Use chapter patterns for chapter detection
   - Use status patterns for publication status

### Phase 3: UnifiedMetadataParser Integration (Lower Priority)

**Goal**: Route Fandom parsing through UnifiedMetadataParser for consistency

**Changes**:

1. **Enhance FandomAdapter** (`src/server/parsers/adapters/FandomAdapter.ts`)
   - Add PatternLibrary integration
   - Use ContentExtractor for raw extraction
   - Use DataNormalizer for output normalization

2. **Update FandomService to optionally use UnifiedMetadataParser**
   - Add `useUnifiedParser` option
   - When enabled, route through UnifiedMetadataParser
   - When disabled, use existing FandomService pipeline (backward compatible)

3. **Update FandomProvider to use FandomAdapter**
   - For `getMangaDetails()`, use FandomAdapter instead of direct FandomService
   - Benefit from PatternLibrary integration

## Implementation Order

1. **Phase 1a** (1-2 hours): Fix `determineResultType()` - CRITICAL
2. **Phase 1b** (1 hour): Fix FandomProvider relevance filtering
3. **Phase 2a** (2-3 hours): Create PatternLibraryBridge
4. **Phase 2b** (2-3 hours): Integrate into WikiMetadataExtractor
5. **Phase 3** (4-5 hours): Full UnifiedMetadataParser integration

## Files to Modify

### Phase 1
- `src/server/services/fandom/fandom/search.ts` - determineResultType()
- `src/server/services/search/providers/FandomProvider.ts` - relevance filtering

### Phase 2
- `src/server/services/fandom/patterns/PatternLibraryBridge.ts` (NEW)
- `src/server/services/fandom/dynamic/WikiMetadataExtractor.ts`
- `src/server/services/fandom/dynamic/DynamicWikiParser.ts`
- `src/server/services/fandom/dynamic/wiki-content-scraper/enrichment.ts`

### Phase 3
- `src/server/parsers/adapters/FandomAdapter.ts`
- `src/server/services/fandom/FandomService.ts`
- `src/server/services/search/providers/FandomProvider.ts`

## Verification Steps

After each phase, run test script:
```bash
bun run scripts/test-fandom-full-workflow.ts
```

Expected results after Phase 1:
- FandomProvider.search("Fire Force") returns 1+ results
- FandomService.getMangaInfo() continues to work (305 chapters)

Expected results after Phase 2:
- Volume/chapter numbers extracted using PatternLibrary
- Status detection uses PatternLibrary patterns
- ISBN/dates extracted consistently

Expected results after Phase 3:
- FandomAdapter.extract() produces NormalizedMangaData
- Data flows through unified pipeline
- All patterns applied consistently

## Risks and Mitigations

1. **Backward compatibility** - Keep existing FandomService pipeline, add new integration as opt-in
2. **Performance** - PatternLibrary patterns are cached, minimal overhead
3. **Wiki-specific patterns** - PatternLibrary supports special patterns for edge cases

## Success Criteria

1. `FandomProvider.search("Fire Force")` returns manga result
2. Volume/chapter extraction uses PatternLibrary patterns
3. Full workflow test passes with complete metadata
4. No regressions in existing Fandom functionality
