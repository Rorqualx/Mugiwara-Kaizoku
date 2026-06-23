# Fandom Search Results Filtering

## Problem
When searching for manga on Fandom, the search results include many non-manga entries such as:
- Game entries (e.g., "Fire force: Enbu no Shō")
- Organization/group entries (e.g., "Special Fire Force Company 8")
- Character entries
- Location entries
- Other wiki pages that aren't the main manga entry

The actual manga entries on Fandom follow a consistent naming pattern with "(manga)" in the title, like "Fire Force (manga)".

## Solution
Added filtering to the Fandom adapter to only return entries with "(manga)" in their title during search operations.

## Implementation Details

### Files Modified
- `src/server/services/fandom/fandom/search.ts`

### Changes Made

1. **`prioritizeMangaPage` function**:
   - Finds the actual manga page (entry ending with `(manga)` or `(series)`)
   - Filters out disambiguation pages, chapter pages, and volume pages
   - Returns the main manga page first, followed by at most 2 other results

2. **`filterAndSortResults` function**:
   - Applies type-based filtering and score-based sorting
   - Calls `prioritizeMangaPage` to ensure the manga entry is surfaced first
   - Used by the main search path before results are returned to callers

### Filter Logic
```typescript
// prioritizeMangaPage in src/server/services/fandom/fandom/search.ts
const mainMangaPage = results.find(r =>
  r.title.toLowerCase().endsWith('(manga)') ||
  r.title.toLowerCase().endsWith('(series)')
);
// Returns [mainMangaPage, ...otherResults.slice(0, 2)]
```

## Benefits

1. **Cleaner Search Results**: Users only see actual manga entries, not games, characters, or other wiki content
2. **Better User Experience**: No confusion about which entry to select
3. **Accurate Metadata**: Ensures we're fetching metadata from the correct manga page

## Future Enhancements

### Related Links Feature
The non-manga entries that are filtered out could potentially be captured and stored as "related links" for the manga. For example:
- Game adaptations
- Character pages
- Organization/group pages
- Spin-off series

These could be displayed on the manga detail page as additional resources for users interested in the broader franchise.

### Implementation Considerations for Related Links
1. Modify the search to capture filtered entries separately
2. Store them in a `relatedLinks` field in the manga metadata
3. Display them in a dedicated section on the manga detail page
4. Categories could include:
   - Games
   - Characters (entries without parentheses)
   - Organizations (entries with "Company", "Force", etc.)
   - Spin-offs (entries with different subtitles)

## Testing

To test the filtering:
1. Search for "Fire Force" on Fandom
2. Should only see "Fire Force (manga)" in results
3. Should NOT see:
   - "Fire force: Enbu no Shō"
   - "Special Fire Force Company 8"
   - "Special Fire Force"
   - Other non-manga entries