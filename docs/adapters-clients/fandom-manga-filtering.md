# Fandom Manga Filtering

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Manga Filtering

---
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
- `/src/api/metadataProviders/adapters/fandomAdapter.ts`

### Changes Made

1. **_searchManga method (line 739-744)**:
   - Added filter before mapping to check if title contains "(manga)"
   - Only processes entries that match this pattern

2. **searchAsync method (line 344-349)**:
   - Added additional filtering at the MangaSearchResult level
   - Ensures consistency across different search result transformations

3. **searchMangaAsync method (line 1114-1115)**:
   - Added check to skip non-manga entries when converting to MangaMetadata
   - Maintains consistency with other search methods

### Filter Logic
```typescript
.filter(manga => {
  // Only include entries with "(manga)" in the title
  if (!manga || typeof manga !== 'object') return false;
  const title = typeof manga.title === 'string' ? manga.title : '';
  return title.toLowerCase().includes('(manga)');
})
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