# 📋 Week 5: Strategic Manual Review Plan

**Date**: October 2, 2025
**Approach**: Manual review of high-impact files
**Goal**: Fix 2,000-2,500 errors with proper type definitions
**Time Estimate**: 15-20 hours

---

## 🎯 Top 20 Files by Error Count

| Rank | File | Errors | Main Types | Priority |
|------|------|--------|------------|----------|
| 1 | `sourceManagementService.ts` | 467 | TS18046 (323), TS2339 (95) | 🔴 Critical |
| 2 | `FandomService.ts` | 305 | TS18046, TS2339 | 🔴 Critical |
| 3 | `test/setup.ts` | 286 | Test mocks | 🟡 Medium |
| 4 | `type-guards/generated.ts` | 242 | Generated | 🟢 Low |
| 5 | `metadataMerger.ts` | 194 | TS18046, TS2339 | 🔴 Critical |
| 6 | `test/utils/mockComponents.tsx` | 160 | Test mocks | 🟡 Medium |
| 7 | `searchStep.tsx` | 140 | TS18046, TS2339 | 🔴 Critical |
| 8 | `routers/manga.ts` | 129 | TS18046 | 🔴 Critical |
| 9 | `DynamicWikiParser.ts` | 121 | TS18046 | 🔴 Critical |
| 10 | `routers/metadata.ts` | 115 | TS18046 | 🔴 Critical |
| 11 | `urlParsingService.ts` | 106 | TS18046, TS2339 | 🔴 Critical |
| 12 | `importService.ts` | 104 | TS18046 | 🔴 Critical |
| 13 | `VolumesChaptersStep.tsx` | 95 | TS18046, TS2339 | 🔴 Critical |
| 14 | `type-adapters.ts` | 94 | TS18046 | 🔴 Critical |
| 15 | `UniversalImportWizard.tsx` | 89 | TS18046 | 🔴 Critical |
| 16 | `WikipediaService.ts` | 87 | TS18046 | 🔴 Critical |
| 17 | `ReviewConfidenceStep.tsx` | 77 | TS18046 | 🔴 Critical |
| 18 | `dataTransformers.ts` | 74 | TS18046 | 🔴 Critical |
| 19 | `metadataEnrichmentService.ts` | 69 | TS18046 | 🔴 Critical |
| 20 | `TableExtractor.test.ts` | 69 | Test mocks | 🟡 Medium |

**Total in Top 20**: ~2,825 errors (38% of remaining 7,419)

---

## 📊 Error Pattern Analysis

### **TS18046: 'X' is of type 'unknown'** (Dominant Pattern)

**Root Cause**: Objects typed as `unknown` or `Record<string, unknown>`

**Common Variables**:
- `result` - API/search results
- `metadata` - Provider metadata
- `data` - Generic data objects
- `obj` - Generic objects

**Solution Pattern**:
```typescript
// Instead of casting everywhere:
const title = (result as Record<string, unknown>)["title"];
const year = (result as Record<string, unknown>)["year"];

// Define proper interface:
interface SearchResult {
  title: string;
  year?: number;
  metadata?: {
    chapters?: number;
    volumes?: number;
  };
}

// Use it:
const result = data as SearchResult;
const title = result.title;
const year = result.year;
```

### **TS2339: Property does not exist** (Second Pattern)

**Root Cause**: Accessing properties not in type definition

**Solution Pattern**:
```typescript
// Instead of ignoring:
const value = obj.nonExistentProp; // Error

// Add to interface or use type guard:
interface ProperType {
  nonExistentProp?: string;
}

// Or use hasOwnProperty:
if ('nonExistentProp' in obj) {
  const value = (obj as { nonExistentProp: string }).nonExistentProp;
}
```

---

## 🚀 Execution Strategy

### **Phase 1: Quick Wins (Hours 1-5)**

**Files**: `sourceManagementService.ts`, `FandomService.ts`, `metadataMerger.ts`

**Approach**:
1. Identify common object types (SearchResult, ProviderMetadata, etc.)
2. Create proper interfaces in shared types file
3. Replace `unknown` casts with proper types
4. Fix property access errors

**Expected**: ~900 errors fixed

### **Phase 2: Service Layer (Hours 6-10)**

**Files**: `importService.ts`, `urlParsingService.ts`, `WikipediaService.ts`, `metadataEnrichmentService.ts`

**Approach**:
1. Use interfaces from Phase 1
2. Add service-specific types
3. Fix API response typing

**Expected**: ~400 errors fixed

### **Phase 3: Component Layer (Hours 11-15)**

**Files**: `searchStep.tsx`, `VolumesChaptersStep.tsx`, `UniversalImportWizard.tsx`, `ReviewConfidenceStep.tsx`

**Approach**:
1. Use types from Phases 1-2
2. Fix component prop types
3. Add React type definitions

**Expected**: ~400 errors fixed

### **Phase 4: Routers & Utilities (Hours 16-20)**

**Files**: `routers/manga.ts`, `routers/metadata.ts`, `dataTransformers.ts`, `type-adapters.ts`

**Approach**:
1. Fix tRPC router types
2. Update utility function signatures
3. Add generic type constraints

**Expected**: ~300 errors fixed

---

## 📝 Type Definition Strategy

### **Create Central Types File**

**Location**: `src/types/provider-results.ts`

**Content**:
```typescript
/**
 * Common provider search result structure
 */
export interface BaseSearchResult {
  id: string;
  title: string;
  provider: string;
  source?: string;
  sourceId?: string;
}

/**
 * Extended search result with metadata
 */
export interface ExtendedSearchResult extends BaseSearchResult {
  description?: string;
  coverImage?: string;
  genres?: string[];
  year?: number;
  status?: string;
  volumes?: number;
  chapters?: number;
  metadata?: ProviderMetadata;
}

/**
 * Provider-specific metadata
 */
export interface ProviderMetadata {
  anilist?: AniListMetadata;
  comicvine?: ComicVineMetadata;
  fandom?: FandomMetadata;
  wikipedia?: WikipediaMetadata;
  [key: string]: unknown; // Allow additional providers
}

// Provider-specific interfaces...
```

---

## 🔍 Common Patterns to Extract

### **Pattern 1: Safe Property Access**

**Create utility**:
```typescript
// src/utils/type-guards/safe-access.ts
export function safeGet<T, K extends keyof T>(
  obj: T | unknown,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  if (!obj || typeof obj !== 'object') return defaultValue;
  return (obj as T)[key] ?? defaultValue;
}
```

### **Pattern 2: Type Guard Generator**

**Create utility**:
```typescript
// src/utils/type-guards/generators.ts
export function hasProperty<T, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return obj != null && typeof obj === 'object' && key in obj;
}
```

### **Pattern 3: Array Element Type**

**Create utility**:
```typescript
// src/utils/type-guards/array-guards.ts
export function isArrayOf<T>(
  arr: unknown,
  guard: (item: unknown) => item is T
): arr is T[] {
  return Array.isArray(arr) && arr.every(guard);
}
```

---

## 📊 Success Metrics

### **Quantitative**

- **Target**: 2,000-2,500 errors fixed
- **Files**: Top 20 high-impact files
- **Type Definitions**: 10-15 new interfaces
- **Utilities**: 5-10 helper functions

### **Qualitative**

- Proper type safety (not just casts)
- Reusable type definitions
- Documented patterns
- Maintainable code

---

## 🎯 Daily Goals

### **Day 1** (5 hours)
- Fix `sourceManagementService.ts` (~467 errors)
- Create base type definitions
- Document patterns

### **Day 2** (5 hours)
- Fix `FandomService.ts` (~305 errors)
- Fix `metadataMerger.ts` (~194 errors)
- Expand type definitions

### **Day 3** (5 hours)
- Fix service layer files (~400 errors total)
- Create utility functions
- Apply patterns

### **Day 4** (5 hours)
- Fix component layer (~400 errors)
- Fix routers & utilities (~300 errors)
- Final cleanup and testing

---

## ✅ Ready to Begin

**Starting with**: `src/components/addManga/services/sourceManagementService.ts`

**Errors**: 467 (6.3% of total)

**Main Issues**:
- TS18046 (323): Type unknown
- TS2339 (95): Property does not exist

**Approach**:
1. Read and understand the file
2. Identify object types
3. Create proper interfaces
4. Replace unknown casts
5. Fix property access

**Let's begin!** 🚀
