# Unknown Manga Card Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Unknown Manga Card Fix

---
# Unknown Manga Card Fix

This document explains the issue where "unknown" manga cards were appearing in the library and the solution implemented to fix it.

## Problem

When adding manga using AniList-Native as the metadata provider, in some cases the application would create manga entries with "Unknown" as the title and no cover art. This happened when:

1. The AniList API was not properly configured or accessible
2. There was an error fetching metadata from AniList
3. The metadata returned from AniList was incomplete or invalid

Instead of failing gracefully with an error message, the application would create a manga entry with "Unknown" as the title and "/cover-not-found.jpg" as the cover URL. This resulted in "unknown" manga cards appearing in the library.

## Root Cause

The issue was in the `AniListNativeSearchProvider` class in `src/server/services/search/anilistNativeProvider.ts`. When there was an error fetching metadata from AniList, the `getMetadata` method would return a basic search result with "Unknown" as the title instead of throwing an error:

```typescript
// Old implementation
async getMetadata(id: string): Promise<SearchResult> {
  try {
    // ...
    if (!useForMetadata || !isConfigured) {
      logger.debug('AniList metadata disabled or not properly configured');
      return this.createBasicSearchResult(id, 'Unknown');
    }
    // ...
  } catch (error) {
    logger.error(`AniList metadata error: ${error instanceof Error ? error.message : String(error)}`);
    return this.createBasicSearchResult(id, 'Unknown');
  }
}
```

The `manga.add` mutation in `src/server/trpc/routers/manga.ts` would then use this "Unknown" metadata to create a manga entry in the database.

## Solution

The solution involved two main changes:

1. Modified the `AniListNativeSearchProvider` to throw errors instead of returning basic search results with "Unknown" titles:

```typescript
// New implementation
async getMetadata(id: string): Promise<SearchResult> {
  try {
    // ...
    if (!useForMetadata || !isConfigured) {
      logger.error('AniList metadata disabled or not properly configured');
      throw new Error('AniList is not properly configured for metadata. Please check your AniList settings.');
    }
    // ...
  } catch (error) {
    logger.error(`AniList metadata error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to get AniList metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

2. Enhanced error handling in the `manga.add` and `refreshMetaData` mutations to properly handle these errors and prevent creating manga entries with invalid metadata:

```typescript
// In manga.add mutation
try {
  detailedMetadata = await provider.getMetadata(firstResult.id);
} catch (metadataError) {
  logger.error(`Error getting metadata for ${firstResult.title}: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Failed to get metadata: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`,
  });
}

// Verify that we have valid metadata
if (!detailedMetadata || !detailedMetadata.title) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Invalid metadata received from ${source}.`,
  });
}
```

3. Updated the `delete-unknown-manga.js` script to use ES modules instead of CommonJS, and ran it to clean up existing "unknown" manga entries:

```javascript
// Updated script to use ES modules
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ... rest of the script
```

## Results

With these changes:

1. The application now properly handles errors when fetching metadata from AniList
2. Instead of creating manga entries with "Unknown" titles, it shows appropriate error messages to the user
3. Existing "unknown" manga entries have been cleaned up from the database

## Prevention

To prevent this issue from happening again:

1. Always ensure that AniList is properly configured before using it as a metadata provider
2. If you encounter any "unknown" manga cards in the library, you can run the `delete-unknown-manga.js` script to clean them up:

```bash
node scripts/delete-unknown-manga.js
```

3. The improved error handling will prevent new "unknown" manga entries from being created
