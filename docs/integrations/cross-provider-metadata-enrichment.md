# Cross Provider Metadata Enrichment

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Cross Provider Metadata Enrichment

---
# Cross-Provider Metadata Enrichment

This document describes the cross-provider metadata enrichment system in Kaizoku, which combines metadata from multiple sources to provide a comprehensive manga experience.

## Overview

Kaizoku's cross-provider metadata enrichment system allows the application to gather and merge metadata from multiple sources, ensuring that users have access to the most complete and accurate information about their manga collection. This system addresses the limitations of individual metadata providers by combining their strengths.

## Metadata Sources

The system currently integrates with the following metadata sources:

1. **AniList** - Provides comprehensive anime/manga metadata including genres, status, cover art, and basic volume/chapter information
2. **ComicVine** - Offers detailed Western comics metadata with good cover art and publication information
3. **MangaDex** - Supplies chapter-specific information and scanlation details
4. **Fandom Wikis** - Contains detailed chapter titles, accurate volume/chapter counts, and series-specific information

Each source has its strengths and weaknesses:

| Provider | Strengths | Weaknesses |
|----------|-----------|------------|
| AniList | Comprehensive anime/manga database, good cover art, reliable basic info | Sometimes lacks detailed chapter information |
| ComicVine | Excellent for Western comics, detailed publication info | Limited manga coverage |
| MangaDex | Good chapter-specific information, scanlation details | Metadata can be inconsistent |
| Fandom | Detailed chapter titles, accurate volume/chapter counts | Requires web scraping, not all series have wikis |

## Enrichment Process

The metadata enrichment process follows these steps:

1. **Primary Provider Metadata Retrieval**
   - When a manga is added to the library, metadata is first fetched from the primary provider (AniList, ComicVine, or MangaDex)
   - This establishes the base metadata record in the database

2. **Cross-Provider Matching**
   - The system attempts to match the manga with corresponding entries in other providers
   - String similarity algorithms are used to handle variations in naming conventions
   - Confidence thresholds ensure accurate matching

3. **Metadata Merging**
   - Additional metadata is fetched from secondary providers
   - The `MetadataMergerService` intelligently combines this information
   - Priority rules determine which source's data takes precedence for each field

4. **Fandom Integration**
   - For chapter-specific information, Fandom wikis are queried
   - Chapter titles, accurate volume counts, and chapter counts are extracted
   - This information supplements or replaces the existing metadata

5. **Validation and Repair**
   - The merged metadata undergoes validation to ensure consistency
   - Any issues are automatically repaired when possible
   - The system logs the provenance of each metadata field for transparency

## Implementation Details

### MetadataMergerService

The `MetadataMergerService` is the core component responsible for coordinating the metadata enrichment process. It includes methods for:

```typescript
class MetadataMergerService {
  // Main enrichment method
  async enrichMangaMetadata(mangaId: number): Promise<any>
  
  // Fandom-specific enrichment
  async enrichChapterMetadataFromFandom(mangaId: number): Promise<boolean>
  
  // Helper methods
  private getOtherProviders(primaryProvider: string): string[]
  private enhanceMetadata(baseMetadata: Partial<MangaMetadata>, additionalMetadata: SearchResult, metadataProvenance: Record<string, string>, provider: string): void
  private updateMangaMetadata(mangaId: number, metadata: MangaMetadata, metadataProvenance: Record<string, string>): Promise<any>
  
  // Check if enrichment is needed
  needsMetadataEnrichment(manga: any): boolean
}
```

### ProviderMatcher

The `ProviderMatcher` handles the cross-provider matching logic:

```typescript
class ProviderMatcher {
  // Find a match for a manga title in a specific provider
  async findMatch(title: string, provider: string): Promise<string | null>
  
  // Calculate match probability
  private calculateMatchProbability(title1: string, title2: string): number
}
```

### Metadata Provenance Tracking

The system tracks the source of each metadata field, allowing for transparency and debugging:

```typescript
// Example metadata provenance object
const metadataProvenance = {
  "coverLarge": "anilist-native",
  "summary": "anilist-native",
  "genres": "anilist-native",
  "volumes": "fandom",
  "chapters": "fandom",
  "urls": "anilist-native, comicvine, mangadex"
};
```

## Automatic Enrichment Triggers

The metadata enrichment process is automatically triggered in several scenarios:

1. **Initial Addition** - When a manga is first added to the library
2. **Manual Refresh** - When a user manually refreshes metadata via the UI
3. **On-Demand Enrichment** - When viewing a manga with incomplete metadata
4. **Scheduled Updates** - During periodic library scans (if configured)

## Example: One Piece

For a manga like "One Piece", the enrichment process might work as follows:

1. User adds One Piece from AniList
   - Basic metadata is retrieved: cover art, genres, status, etc.

2. System attempts to match with other providers
   - Finds matching entries in MangaDex and Fandom

3. Additional metadata is retrieved and merged
   - MangaDex provides scanlation information
   - Fandom provides detailed chapter titles and accurate counts

4. Final metadata record includes:
   - Cover art from AniList
   - Genres and status from AniList
   - Chapter titles from Fandom
   - Accurate volume count (100+) from Fandom
   - Accurate chapter count (1000+) from Fandom
   - URLs to all provider pages

## Benefits

The cross-provider metadata enrichment system offers several benefits:

1. **More Complete Information** - Users see comprehensive metadata regardless of the original source
2. **Better Organization** - Accurate chapter titles and volume information improve library organization
3. **Enhanced User Experience** - Detailed metadata makes browsing and reading more enjoyable
4. **Flexibility** - The system can adapt to changes in provider APIs or data structures
5. **Extensibility** - New metadata sources can be added to the system with minimal changes

## Testing and Verification

Several test scripts are available to verify the metadata enrichment system:

- `scripts/test-metadata-merger.js` - Tests the general metadata merger functionality
- `scripts/test-fandom-integration.mjs` - Tests the Fandom integration specifically
- `scripts/test-one-piece-fandom.mjs` - Tests the integration with the One Piece wiki
- `scripts/find-one-piece.js` - Finds One Piece in the database and tests enrichment
- `scripts/test-string-similarity.js` - Tests the string similarity matching algorithm

## Future Improvements

Potential enhancements to the cross-provider metadata enrichment system include:

1. **Additional Metadata Sources** - Integration with more providers like MyAnimeList, Kitsu, etc.
2. **Improved Matching Algorithms** - More sophisticated title matching for better accuracy
3. **User Preferences** - Allow users to specify preferred metadata sources for different fields
4. **Conflict Resolution UI** - Interface for users to resolve metadata conflicts manually
5. **Caching Mechanisms** - Reduce API calls and improve performance
6. **Offline Metadata** - Support for offline metadata databases
7. **Metadata Export/Import** - Allow users to export and import metadata
