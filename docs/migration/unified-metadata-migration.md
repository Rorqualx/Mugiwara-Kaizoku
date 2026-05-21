# Unified Metadata System Migration Guide

## Overview

The Unified Metadata System is a complete redesign of how metadata flows through the application, providing:
- **Type Safety**: End-to-end type checking with no `any` types
- **Data Consistency**: Single source of truth for metadata structure
- **Validation**: Comprehensive validation at every transformation point
- **Conflict Resolution**: Intelligent merging from multiple providers
- **Extensibility**: Easy to add new providers and fields

## Architecture Changes

### Before (Fragmented System)
```
Provider → Custom Types → SearchResult → Frontend State → JSON Blobs → Database
   ↓           ↓              ↓              ↓              ↓           ↓
AniList    No validation   150+ fields   Complex state    Type loss   Limited fields
```

### After (Unified System)
```
Provider → Unified Types → Validation → Merger → Type-Safe Pipeline → Complete Storage
   ↓           ↓              ↓           ↓            ↓                ↓
All providers  Single type   Zod schemas  Smart merge  Full types     All fields
```

## New Components

### 1. Type Definitions (`src/types/metadata/unified-types.ts`)
- `UnifiedMangaMetadata`: Complete metadata interface
- `PartialUnifiedMetadata`: For updates and transformations
- Supporting types for all metadata aspects
- No ambiguous fields or type overlaps

### 2. Base Adapter (`src/server/adapters/base-metadata-adapter.ts`)
- Abstract class for all providers
- Common transformation utilities
- Built-in validation
- Confidence scoring

### 3. Provider Adapters
- `unified-anilist-adapter.ts`: AniList implementation
- `unified-comicvine-adapter.ts`: ComicVine implementation
- Easy to add Wikipedia, Fandom, MangaDex

### 4. Validation Service (`src/server/services/metadata/validation-service.ts`)
- Zod schemas for runtime validation
- Business rule validation
- Sanitization utilities
- Completeness scoring

### 5. Merger Service (`src/server/services/metadata/unified-merger.ts`)
- Intelligent field merging
- Provider prioritization
- Conflict tracking
- Field-by-field selection support

### 6. Type Guards (`src/utils/metadata/type-guards.ts`)
- Runtime type checking
- Safe field extraction
- Validation helpers

## Migration Steps

### Phase 1: Backend Migration

#### Step 1: Install New System
```bash
# The files are already created, no installation needed
```

#### Step 2: Update Provider Adapters
Replace existing adapters with unified versions:

```typescript
// Old
import { AniListAdapter } from './anilistAdapter';

// New
import { UnifiedAniListAdapter } from './unified-anilist-adapter';
```

#### Step 3: Update Router
Use the new unified manga router:

```typescript
// In src/server/trpc/index.ts
import { unifiedMangaRouter } from './routers/unified-manga';

export const appRouter = router({
  // ... other routers
  manga: unifiedMangaRouter, // Replace old manga router
});
```

### Phase 2: Database Migration

#### Step 1: Add New Columns
```sql
-- Add missing metadata columns
ALTER TABLE "Metadata" 
ADD COLUMN IF NOT EXISTS "format" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "releaseYear" INTEGER,
ADD COLUMN IF NOT EXISTS "artists" TEXT[],
ADD COLUMN IF NOT EXISTS "themes" TEXT[],
ADD COLUMN IF NOT EXISTS "demographics" TEXT[],
ADD COLUMN IF NOT EXISTS "contentWarnings" TEXT[],
ADD COLUMN IF NOT EXISTS "ageRating" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "originalLanguage" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "serialization" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "favorites" INTEGER;
```

#### Step 2: Migrate Existing Data
```typescript
// Migration script
async function migrateExistingMetadata() {
  const allManga = await prisma.manga.findMany({
    include: { metadata: true }
  });
  
  for (const manga of allManga) {
    if (manga.providerMetadata) {
      // Parse and transform old format to new
      const oldData = JSON.parse(manga.providerMetadata);
      const unified = transformToUnified(oldData);
      
      await prisma.metadata.update({
        where: { id: manga.metadataId },
        data: unified
      });
    }
  }
}
```

### Phase 3: Frontend Migration

#### Step 1: Update Types
```typescript
// Old imports
import { SearchResult } from '@/server/services/search/types';
import { MangaMetadata } from '@/server/trpc/routers/manga';

// New imports
import { 
  UnifiedMangaMetadata,
  PartialUnifiedMetadata 
} from '@/types/metadata/unified-types';
```

#### Step 2: Update Confirmation Screen
```typescript
// Use unified types in state
const [metadata, setMetadata] = useState<PartialUnifiedMetadata>();

// Use validation service
const validation = validationService.validatePartial(metadata);
```

#### Step 3: Update API Calls
```typescript
// Old
await trpc.manga.add.mutate({
  title, source, metadata: { /* mixed structure */ }
});

// New
await trpc.manga.add.mutate({
  title,
  source,
  metadata: unifiedMetadata, // Type-safe metadata
  fieldSelections, // Optional field-by-field sources
  providerMetadata // Optional multiple sources
});
```

## API Changes

### Search Endpoint
```typescript
// Old: Returns different structures per provider
const results = await trpc.manga.search({ query, providers });
// results: { anilist: any[], comicvine: any[] }

// New: Returns unified structure
const results = await trpc.manga.searchUnified({ query, providers });
// results: { anilist: PartialUnifiedMetadata[], comicvine: PartialUnifiedMetadata[] }
```

### Add Manga Endpoint
```typescript
// Old: Accepts loose metadata structure
await trpc.manga.add({
  title, source,
  metadata: { /* various formats */ }
});

// New: Accepts unified metadata with validation
await trpc.manga.add({
  title, source,
  metadata: validatedMetadata,
  fieldSelections: { // Optional: specify source per field
    description: { source: 'anilist', value: '...' },
    volumes: { source: 'comicvine', value: 34 }
  }
});
```

### Metadata Merge Endpoint (New)
```typescript
// Merge multiple sources with intelligent conflict resolution
const merged = await trpc.manga.mergeMetadata({
  sources: [anilistData, comicvineData, wikipediaData],
  fieldSelections: userSelections // Optional
});
```

## Benefits After Migration

### 1. **Type Safety**
- No more `any` types
- Compile-time checking
- IntelliSense support
- Reduced runtime errors

### 2. **Data Completeness**
- All metadata fields preserved
- No data loss in pipeline
- Provider-specific data retained

### 3. **Validation**
- Automatic validation
- Business rule checking
- Data sanitization
- Quality scoring

### 4. **Flexibility**
- Mix and match providers
- Field-level source selection
- Custom merge strategies
- Easy provider addition

### 5. **Maintainability**
- Single source of truth
- Clear data flow
- Comprehensive documentation
- Testable components

## Testing the Migration

### Unit Tests
```typescript
describe('Unified Metadata System', () => {
  it('should transform AniList data correctly', async () => {
    const adapter = new UnifiedAniListAdapter(config);
    const result = await adapter.transform(anilistData);
    expect(result.status).toBe('success');
    expect(isPartialUnifiedMetadata(result.data)).toBe(true);
  });
  
  it('should merge multiple sources', () => {
    const merger = new UnifiedMetadataMerger();
    const result = merger.merge([source1, source2]);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.merged.title).toBeDefined();
  });
  
  it('should validate metadata correctly', () => {
    const validator = new MetadataValidationService();
    const result = validator.validatePartial(testData);
    expect(result.isValid).toBe(true);
    expect(result.completeness).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests
```typescript
it('should handle complete add manga flow', async () => {
  // Search
  const searchResults = await trpc.manga.searchUnified({ 
    query: 'One Piece' 
  });
  
  // Select and merge
  const merged = await trpc.manga.mergeMetadata({
    sources: Object.values(searchResults).flat()
  });
  
  // Add to library
  const manga = await trpc.manga.add({
    title: merged.merged.title,
    source: 'unified',
    metadata: merged.merged,
    libraryId: 1
  });
  
  expect(manga.id).toBeDefined();
  expect(manga.metadata).toMatchObject({
    title: 'One Piece',
    status: expect.any(String),
    format: expect.any(String)
  });
});
```

## Rollback Plan

If issues arise, you can rollback by:

1. **Keep old endpoints**: Run both systems in parallel initially
2. **Feature flag**: Use environment variable to switch systems
3. **Data backup**: Backup database before migration
4. **Gradual rollout**: Migrate one provider at a time

```typescript
// Feature flag approach
const useUnifiedSystem = process.env.USE_UNIFIED_METADATA === 'true';

export const mangaRouter = useUnifiedSystem 
  ? unifiedMangaRouter 
  : legacyMangaRouter;
```

## Troubleshooting

### Common Issues

#### 1. Type Errors
```typescript
// Error: Type 'any' is not assignable to type 'PartialUnifiedMetadata'
// Solution: Use type guards or validation
const validated = validationService.sanitize(unknownData);
```

#### 2. Missing Fields
```typescript
// Error: Property 'artists' does not exist
// Solution: Update to unified types
const artists = metadata.artists || []; // Now properly typed
```

#### 3. Validation Failures
```typescript
// Error: Invalid metadata: Volume count seems unusually high
// Solution: Check business rules
if (validation.warnings.length > 0) {
  // Handle warnings appropriately
  console.warn('Validation warnings:', validation.warnings);
}
```

## Support

For questions or issues with the migration:
1. Check the type definitions for field mappings
2. Review validation errors for data issues
3. Check logs for transformation problems
4. Refer to test files for usage examples

## Next Steps

After successful migration:
1. Remove legacy code
2. Add more providers (Wikipedia, Fandom, MangaDex)
3. Enhance merge strategies
4. Add user preferences for metadata sources
5. Implement metadata versioning
6. Add comprehensive logging and monitoring