# Metadata Service Consolidation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Service Consolidation

---
# MetadataService Consolidation Plan

## Analysis

The `src/server/services/metadata/metadataService.standardized.ts` file appears to be the main implementation of the MetadataService, and there is no non-standardized counterpart to consolidate it with. The only other file in the directory is `metadataServiceProvider.ts`, which creates and provides a singleton instance of the standardized MetadataService.

The current TypeScript errors in the file are:
```
3 src/server/services/metadata/metadataService.standardized.ts:9
```

Based on this analysis, we don't need to consolidate this file with another one, but rather address the TypeScript errors directly.

## Type Error Analysis

The errors in the file are likely related to:

1. Type compatibility issues with the provider interfaces
2. Type safety in the `providers` property of the MetadataService class
3. TypeScript generics not being properly specified

## Implementation Plan

Since this is not a true consolidation task (there's no duplicate to merge), we'll focus on fixing the TypeScript errors while keeping the same file structure:

1. **Create Backup**:
   ```bash
   cp src/server/services/metadata/metadataService.standardized.ts docs/backups/metadataService.standardized.backup.ts
   ```

2. **Rename the File**:
   Since the "standardized" suffix is not needed (this is the only implementation), we should rename it to follow the canonical naming pattern:
   ```bash
   mv src/server/services/metadata/metadataService.standardized.ts src/server/services/metadata/metadataService.ts
   ```

3. **Update Provider Type**:
   Fix the type of the `providers` property in the MetadataService class:
   ```typescript
   // Instead of:
   private providers: Record<string, IntegrationAdapter<any>>;
   
   // Use a more specific type:
   private providers: Record<string, IntegrationAdapter<MangaMetadata>>;
   ```

4. **Fix Type Errors**:
   - Ensure proper generic type parameters for AsyncResult
   - Add type guards for array handling
   - Fix type casting in the convertToMetadata method

5. **Update Import References**:
   Update the import in `metadataServiceProvider.ts` to point to the new file name.

## Detailed Implementation Steps

### 1. Fix Provider Type

```typescript
private providers: Record<string, IntegrationAdapter<MangaMetadata>>;
```

### 2. Fix Type Safety in Provider Initialization

```typescript
private initializeProviders(configs: ProviderConfigs): void {
  try {
    // Initialize AniList provider if configured
    if (configs.anilist?.enabled) {
      this.providers.anilist = createAniListAdapter({
        enabled: configs.anilist.enabled,
        apiUrl: configs.anilist.apiUrl as string || 'https://graphql.anilist.co',
        throttleMs: configs.anilist.throttleMs
      }) as IntegrationAdapter<MangaMetadata>;
      this.logger('AniList provider initialized');
    }
    
    // Similar changes for other providers...
  } catch (error) {
    this.logger('Error initializing providers', error);
    throw error;
  }
}
```

### 3. Improve Type Safety in the convertToMetadata Method

```typescript
private convertToMetadata(manga: unknown, providerId: string): MangaMetadata {
  if (!manga || typeof manga !== 'object') {
    return {
      title: 'Unknown',
      status: DomainMangaStatus.UNKNOWN,
    };
  }

  const mangaRecord = manga as Record<string, unknown>;
  
  // Create a basic metadata object with defaults
  const metadata: MangaMetadata = {
    title: typeof mangaRecord.title === 'string' ? mangaRecord.title : 'Unknown',
    status: this.mapStatus(mangaRecord.status),
  };
  
  // Safely copy optional properties with type checking
  if (typeof mangaRecord.description === 'string') {
    metadata.description = mangaRecord.description;
  }
  
  if (typeof mangaRecord.coverUrl === 'string') {
    metadata.coverUrl = mangaRecord.coverUrl;
  } else if (typeof mangaRecord.coverImage === 'string' && !metadata.coverUrl) {
    metadata.coverUrl = mangaRecord.coverImage;
  }
  
  // Convert authors with type safety
  if (Array.isArray(mangaRecord.authors)) {
    metadata.authors = mangaRecord.authors
      .filter((author): author is string | { name: string } => 
        typeof author === 'string' || (author !== null && typeof author === 'object' && 'name' in author))
      .map((author) => {
        if (typeof author === 'string') return author;
        if (typeof author.name === 'string') return author.name;
        return 'Unknown Author';
      });
  }
  
  // Convert genres with type safety
  if (Array.isArray(mangaRecord.genres)) {
    metadata.genres = mangaRecord.genres
      .filter((genre): genre is string | { name: string } => 
        typeof genre === 'string' || (genre !== null && typeof genre === 'object' && 'name' in genre))
      .map((genre) => {
        if (typeof genre === 'string') return genre;
        if (typeof genre.name === 'string') return genre.name;
        return 'Unknown Genre';
      });
  }
  
  // Add links with type safety
  if (typeof mangaRecord.sourceUrl === 'string' || typeof mangaRecord.url === 'string') {
    metadata.links = [{
      url: (typeof mangaRecord.sourceUrl === 'string' ? mangaRecord.sourceUrl : 
           (typeof mangaRecord.url === 'string' ? mangaRecord.url : '')),
      site: providerId,
      label: String(mangaRecord.sourceId || mangaRecord.id || 'unknown')
    }];
  }
  
  // Add release year with type safety
  if (typeof mangaRecord.releaseYear === 'number' || typeof mangaRecord.year === 'number') {
    metadata.releaseYear = Number(mangaRecord.releaseYear || mangaRecord.year);
  }
  
  return metadata;
}

/**
 * Map any status value to a standardized DomainMangaStatus
 */
private mapStatus(status: unknown): DomainMangaStatus {
  if (typeof status === 'string') {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('ongoing') || statusLower.includes('publishing')) {
      return DomainMangaStatus.ONGOING;
    }
    if (statusLower.includes('completed') || statusLower.includes('finished')) {
      return DomainMangaStatus.COMPLETED;
    }
    if (statusLower.includes('hiatus')) {
      return DomainMangaStatus.HIATUS;
    }
    if (statusLower.includes('cancelled') || statusLower.includes('canceled')) {
      return DomainMangaStatus.CANCELLED;
    }
  }
  return DomainMangaStatus.UNKNOWN;
}
```

### 4. Update metadataServiceProvider.ts

```typescript
// Change the import from
import { MetadataService, MetadataServiceOptions } from './metadataService.standardized';
// to
import { MetadataService, MetadataServiceOptions } from './metadataService';
```

## Verification Steps

1. Run TypeScript type checking after making the changes:
   ```bash
   npm run type-check
   ```

2. Verify that the errors in the MetadataService file are resolved.

3. Verify that any code using the MetadataServiceProvider works as expected.

## Expected Outcome

After implementing these changes:

1. The file will be renamed to follow the canonical naming pattern (without the "standardized" suffix)
2. TypeScript errors will be resolved
3. Type safety will be improved throughout the implementation
4. Code that depends on the MetadataService will continue to work as before