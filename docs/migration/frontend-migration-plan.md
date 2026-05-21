# Frontend Migration Plan: Old Metadata to Unified System

## Executive Summary

The frontend is currently using a fragmented metadata system with multiple type definitions and inconsistent property access. This plan outlines the migration to the new unified metadata system.

## Current State Analysis

### 1. Type Fragmentation

The frontend has **3 different MangaSearchResult definitions**:
- `src/types/domain/manga-types.ts:167` - Basic type with metadata field
- `src/types/domain/search-types.ts:313` - Similar but slightly different
- `src/server/trpc/routers/manga.ts:93` - Server-side type with different structure

### 2. Component-Level Type Extensions

Components are creating their own extended types:
- `CompleteMangaSearchResult` in confirmationStep.tsx - Adds rawData, issues, characters, creators
- `BaseMangaSearchResult` - Base type for search results
- Provider-specific fields accessed via `any` casts

### 3. Property Access Patterns

Components are accessing data through multiple paths:
```typescript
// Direct properties (SearchResult pattern)
manga.chapters
manga.volumes
manga.authors

// Metadata object (MangaSearchResult pattern)  
manga.metadata?.chapters
manga.metadata?.volumes
manga.metadata?.authors

// Provider-specific fields
manga.rawData?.issues
manga.providerSpecific?.characters
(manga as any).siteDetailUrl
```

### 4. Missing Type Safety

Current issues causing TypeScript errors:
- `rawData` property not defined in types but used extensively
- ComicVine fields (issues, issueCount, creators, siteDetailUrl) not typed
- Provider-specific extensions not properly handled
- Unsafe `any` casts throughout

## Migration Strategy

### Phase 1: Type System Alignment

#### 1.1 Create Unified Frontend Types
```typescript
// src/types/frontend/unified-search-types.ts
import { PartialUnifiedMetadata } from '@/types/metadata/unified-types';

export interface UnifiedSearchResult {
  // Core fields
  id: string;
  title: string;
  source: string;
  sourceId: string;
  
  // Unified metadata
  metadata: PartialUnifiedMetadata;
  
  // Provider-specific extensions
  providerData?: {
    // ComicVine specific
    issues?: any[];
    issueCount?: number;
    creators?: any[];
    siteDetailUrl?: string;
    
    // AniList specific
    mediaId?: number;
    
    // Fandom specific
    wikiUrl?: string;
    volumeList?: any[];
    
    // Generic raw data
    raw?: Record<string, unknown>;
  };
  
  // UI-specific fields
  coverUrl?: string; // For backward compatibility
  url?: string;
}
```

#### 1.2 Create Type Adapters
```typescript
// src/utils/frontend/type-adapters.ts
export function adaptToUnifiedSearchResult(
  result: any, // Old type
  source: string
): UnifiedSearchResult {
  // Smart adaptation logic
}

export function extractProviderData(
  result: UnifiedSearchResult,
  field: string
): any {
  // Safe extraction with fallbacks
}
```

### Phase 2: Component Migration

#### 2.1 Migration Order (by dependency)
1. **Base Components** (no dependencies)
   - `mangaSearchResult.tsx` - Display component
   
2. **Form Components** (use base)
   - `searchStep.tsx` - Search interface
   - `form.tsx` - Main form container
   
3. **Complex Components** (use form)
   - `confirmationStep.tsx` - Most complex, needs careful migration
   - `FandomImportWizard.tsx` - Provider-specific
   
4. **Page Components** (use all)
   - `manga/[id].tsx` - Detail page

#### 2.2 Component Migration Pattern

For each component:

1. **Update imports**
```typescript
// Before
import { MangaSearchResult } from '@/types/domain/manga-types';

// After
import { UnifiedSearchResult } from '@/types/frontend/unified-search-types';
import { adaptToUnifiedSearchResult } from '@/utils/frontend/type-adapters';
```

2. **Update state types**
```typescript
// Before
const [results, setResults] = useState<MangaSearchResult[]>([]);

// After
const [results, setResults] = useState<UnifiedSearchResult[]>([]);
```

3. **Update property access**
```typescript
// Before (unsafe)
const issues = (result as any).issues || result.metadata?.issues;

// After (type-safe)
const issues = result.providerData?.issues;
```

### Phase 3: API Integration

#### 3.1 Update tRPC Hooks
```typescript
// src/hooks/useUnifiedSearch.ts
export function useUnifiedSearch() {
  const searchMutation = trpc.manga.searchUnified.useMutation();
  
  return {
    search: async (query: string) => {
      const results = await searchMutation.mutateAsync({ query });
      // Transform to frontend types
      return transformResults(results);
    }
  };
}
```

#### 3.2 Update Data Fetching
```typescript
// In components
const { search } = useUnifiedSearch();

const handleSearch = async (query: string) => {
  const results = await search(query);
  setSearchResults(results); // Type-safe
};
```

### Phase 4: Backward Compatibility

#### 4.1 Create Compatibility Layer
```typescript
// src/utils/frontend/compatibility.ts

// Support old property access patterns
export function createCompatibleResult(
  unified: UnifiedSearchResult
): any {
  return new Proxy(unified, {
    get(target, prop) {
      // Handle old property access
      if (prop === 'rawData') {
        return target.providerData?.raw;
      }
      // ... other mappings
      return target[prop];
    }
  });
}
```

#### 4.2 Gradual Migration
- Add compatibility wrappers initially
- Migrate one component at a time
- Remove wrappers after full migration

## Implementation Steps

### Step 1: Create New Type System (2 hours)
- [ ] Create `unified-search-types.ts`
- [ ] Create type adapter utilities
- [ ] Create compatibility layer
- [ ] Add comprehensive type guards

### Step 2: Migrate Base Components (3 hours)
- [ ] Update `mangaSearchResult.tsx`
- [ ] Test with mock data
- [ ] Verify UI rendering

### Step 3: Migrate Search Flow (4 hours)
- [ ] Update `searchStep.tsx`
- [ ] Update `form.tsx`
- [ ] Test search functionality
- [ ] Verify data flow

### Step 4: Migrate Confirmation Step (6 hours)
- [ ] Extract provider-specific logic
- [ ] Update field selectors
- [ ] Fix type errors
- [ ] Test all providers

### Step 5: Migrate Page Components (3 hours)
- [ ] Update manga detail page
- [ ] Update Fandom wizard
- [ ] Test navigation and data display

### Step 6: Cleanup (2 hours)
- [ ] Remove old type definitions
- [ ] Remove compatibility layer
- [ ] Update documentation
- [ ] Run full type check

## Specific Fixes Needed

### 1. confirmationStep.tsx Issues
```typescript
// Line 886 - Type mismatch
onClick={() => handleUseSource(provider, result.id)}
// Fix: Ensure id is always string
onClick={() => handleUseSource(provider, String(result.id))}

// Lines 1132, 3067 - Missing rawData
const rawData = result.rawData;
// Fix: Use providerData
const rawData = result.providerData?.raw;

// Lines 1145 - Missing urls
const urls = manga.urls;
// Fix: Use proper field
const urls = manga.metadata?.externalLinks?.map(l => l.url);

// Lines 3087-3099 - ComicVine fields
const issues = result.issues;
// Fix: Use providerData
const issues = result.providerData?.issues;
```

### 2. fandomTableParser.ts Issues
```typescript
// Line 1076 - ChapterInfo missing url
chapter.url
// Fix: Use externalUrl field from unified type
chapter.externalUrl
```

### 3. metadata.ts Router Issues
```typescript
// Lines 1465-1476 - Old ChapterInfo properties
chapter.url, chapter.japaneseReleaseDate
// Fix: Update to unified ChapterInfo structure
chapter.externalUrl, chapter.releaseDate
```

## Success Criteria

1. **Zero TypeScript Errors** - Full type safety
2. **All Tests Pass** - Existing functionality preserved
3. **Improved DX** - Better IntelliSense and type hints
4. **Maintained Compatibility** - No breaking changes for users
5. **Performance** - No degradation in search/display speed

## Risk Mitigation

1. **Data Loss** - Create backups before migration
2. **Breaking Changes** - Use feature flags for gradual rollout
3. **User Impact** - Test thoroughly in staging
4. **Rollback Plan** - Keep old code in separate branch

## Timeline

- **Total Estimated Time**: 20 hours
- **Recommended Approach**: Phased over 1 week
- **Critical Path**: confirmationStep.tsx (most complex)

## Next Steps

1. Review and approve plan
2. Create feature branch
3. Begin with Type System creation
4. Implement components in order
5. Test thoroughly
6. Deploy with monitoring