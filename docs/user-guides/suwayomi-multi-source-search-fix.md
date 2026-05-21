# Suwayomi Multi Source Search Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Suwayomi Multi Source Search Fix

---
# Suwayomi Multi-Source Search Fix

## Issue Description

The Suwayomi plugin was failing to properly search across multiple sources. The original implementation only had a single-source search endpoint (`searchManga`) that required a specific `sourceId`, but there was no way to search across all installed sources simultaneously.

## Root Cause

1. The tRPC router (`/src/server/trpc/router/suwayomi.ts`) only exposed `searchManga` which searches within a single source
2. The adapter (`/src/api/metadataProviders/adapters/suwayomiAdapter.ts`) had multi-source search logic but it wasn't accessible via tRPC
3. Components using tRPC directly couldn't perform multi-source searches

## Solution

Added a new `searchMangaMultiSource` endpoint to the Suwayomi tRPC router that:

1. **Searches all installed sources in parallel** - Similar to how the adapter works
2. **Aggregates results** - Combines results from all sources into a single response
3. **Provides source information** - Each result includes which source it came from
4. **Handles errors gracefully** - Individual source failures don't break the entire search

### New Endpoint: `searchMangaMultiSource`

```typescript
searchMangaMultiSource: procedure
  .input(
    z.object({
      query: z.string(),
      enabledSources: z.array(z.string()).optional(),
      limit: z.number().optional().default(20),
    })
  )
  .query(async ({ input }) => {
    // Implementation details...
  })
```

**Parameters:**
- `query` - Search text (required)
- `enabledSources` - Array of source IDs to search (optional, defaults to all installed)
- `limit` - Maximum results to return (optional, default 20)

**Response:**
```typescript
{
  results: Array<{
    ...mangaData,
    sourceId: string,
    sourceName: string
  }>,
  totalSources: number,
  searchedSources: Array<{
    sourceId: string,
    sourceName: string,
    resultCount: number
  }>,
  error: string | null
}
```

## Usage Example

### In React Components

```typescript
// Using the new multi-source search
const searchResult = await trpc.suwayomi.searchMangaMultiSource.useQuery({
  query: "One Piece",
  limit: 50
});

// Results include source information
searchResult.results.forEach(manga => {
  console.log(`${manga.title} from ${manga.sourceName}`);
});
```

### Test Component

A test component has been created at `/src/components/test/SuwayomiMultiSourceSearchTest.tsx` to demonstrate the functionality.

## Benefits

1. **Improved Search Coverage** - Users can now search all their installed sources at once
2. **Better Performance** - Parallel search across sources
3. **Enhanced User Experience** - No need to search each source individually
4. **Source Attribution** - Results clearly show which source they came from
5. **Error Resilience** - One source failing doesn't prevent results from other sources

## Testing

To test the multi-source search:

1. Ensure Suwayomi server is running with Java 21
2. Install multiple sources in Suwayomi
3. Use the test component or integrate the new endpoint in your components
4. Search queries will now return results from all installed sources

## Integration with Existing Code

The existing adapter pattern is still used when Suwayomi is selected as a provider through the main search interface. This new endpoint provides direct access to multi-source search for components that need it.

## Related Files

- `/src/server/trpc/router/suwayomi.ts` - Added `searchMangaMultiSource` endpoint
- `/src/api/metadataProviders/adapters/suwayomiAdapter.ts` - Original multi-source logic
- `/src/components/test/SuwayomiMultiSourceSearchTest.tsx` - Test component
- `/src/hooks/useProviderSearch.ts` - Main search hook (uses adapters)