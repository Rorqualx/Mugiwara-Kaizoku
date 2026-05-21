# Fandom Cover Art Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Cover Art Fixes

---
# Fandom Cover Art Fixes

## Summary
Fixed the issue where Fandom search results were not displaying cover art by enhancing the thumbnail extraction and URL cleaning logic.

## Problem
The Fandom provider was returning correct search results but cover art was missing. The issue was caused by:
1. Fandom image URLs containing revision parameters that needed to be stripped
2. Thumbnail extraction not checking all possible image locations
3. Missing fallback to page scraping when API doesn't return thumbnails

## Solution

### 1. Enhanced URL Cleaning (service.ts)
- Strip `/revision/latest` parameters from image URLs
- Remove query parameters like `?cb=20160915132758`
- Ensure URLs are complete with `https:` prefix
- Handle various Fandom image URL formats

### 2. Improved Thumbnail Extraction (service.ts)
- Check both `src` and `data-src` attributes
- Try multiple CSS selectors for thumbnails
- Add fallback to fetch page and extract cover image directly
- Enhanced logging to track thumbnail extraction

### 3. Updated Adapter Mapping (fandomAdapter.ts)
- Check multiple fields for cover images: `thumbnail`, `cover`, `coverImage`
- Extract from `providerSpecific.thumbnail` if available
- Provide proper fallback values

### 4. Enhanced Search Flow
```javascript
// searchSpecificWiki method now:
1. Parses search results from Special:Search page
2. Extracts thumbnails with proper URL cleaning
3. If no thumbnail found, fetches page details via API
4. If still no thumbnail, scrapes the actual manga page
5. Returns results with properly formatted thumbnail URLs
```

## Example Fixed URL
Before: `https://static.wikia.nocookie.net/fire-brigade-of-flames/images/f/f1/FIRE_FORCE_1.png/revision/latest?cb=20160915132758`
After: `https://static.wikia.nocookie.net/fire-brigade-of-flames/images/f/f1/FIRE_FORCE_1.png`

## Files Modified
1. `/src/server/services/fandom/service.ts`
   - Enhanced `extractCoverImage` method
   - Improved `searchSpecificWiki` with better thumbnail extraction
   - Added URL cleaning logic throughout
   - Enhanced logging for debugging

2. `/src/api/metadataProviders/adapters/fandomAdapter.ts`
   - Updated `_searchManga` to check multiple thumbnail fields
   - Enhanced cover image extraction logic

3. `/src/api/metadataProviders/fandomClient.ts`
   - Ensured thumbnail is properly passed in search results

## Testing
To test the fix:
1. Clear any cached data
2. Search for "Fire Force" in the Fandom provider
3. Cover art should now display in search results
4. Cover art should carry through to the confirmation page

## Future Improvements
- Consider implementing a more robust image proxy to handle Fandom's image serving
- Add support for extracting images from volume list pages
- Implement better caching for cover images