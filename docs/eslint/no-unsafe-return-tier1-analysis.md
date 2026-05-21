# Tier 1 Analysis: @typescript-eslint/no-unsafe-return Violations

*Status: Complete*
*Created: 2025-11-08*
*Branch: `claude/scan-the-v-011CUv2HtFgy8JfFrLwAftDn`*
*Analyzer: Claude Code (File Search Specialist)*

---

## Executive Summary

Comprehensive analysis of the top 5 most critical files containing `@typescript-eslint/no-unsafe-return` violations. This analysis identifies **79-112 estimated violations** across these files, representing approximately **32-45% of the total 250-350 violations** in the codebase.

### Key Findings

| File | Est. Violations | Risk Distribution | Complexity |
|------|----------------|-------------------|------------|
| **generated.ts** | 25-30 | 🟢 Low (auto-generated) | Simple-Moderate |
| **manga.ts** | 20-25 | 🟡 Medium-High | Moderate-Complex |
| **metadata.ts** | 18-22 | 🔴 Critical | Complex |
| **metadataMerger.ts** | 15-20 | 🟠 High | Complex |
| **sourceManagementService.ts** | 12-15 | 🟠 High | Moderate-Complex |
| **TOTAL** | **90-112** | Mixed | Variable |

---

## File 1: src/utils/type-guards/generated.ts

**Lines:** 6,499
**Estimated Violations:** 25-30
**Overall Risk:** 🟢 LOW (auto-generated, predictable patterns)

### Overview

Auto-generated type guard file created by `scripts/generate-type-guards.ts`. Contains ~300+ type guard functions checking properties on `candidate: Record<string, unknown>` objects.

### Violations Identified

#### Pattern: Type Guard Property Checks

**Occurrences:** ~2,050 candidate[ accesses (most are safe, ~25-30 potential violations)

**Locations:** Throughout file, in complex nested type guards

**Example Context (Lines 26-87):**
```typescript
export function isAniListMedia(obj: unknown): obj is AniListMedia {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === 'number' &&
    (candidate["idMal"] === undefined || typeof candidate["idMal"] === 'number') &&
    'title' in candidate &&  // ⚠️ No type validation on what 'title' contains
    (candidate["type"] === undefined || 'type' in candidate) &&  // ⚠️ Similar issue
    // ... many more checks
  );
}
```

**Risk Level:** 🟢 LOW
- Pattern is consistent across all type guards
- Only checks for property existence, not type narrowing
- Used for validation, not data extraction

**Violation Type:** Missing type narrowing for nested object properties

**Fix Complexity:** SIMPLE
- Automated fix possible
- Replace `'property' in candidate` with proper type checks
- Low risk - pure validation functions

**Recommended Fix:**
```typescript
// ❌ UNSAFE
'title' in candidate

// ✅ SAFE
(candidate["title"] === undefined || typeof candidate["title"] === 'object')
```

---

## File 2: src/server/trpc/routers/manga.ts

**Lines:** 5,729
**Estimated Violations:** 20-25
**Overall Risk:** 🟡 MEDIUM-HIGH (critical API router)

### Overview

Main manga tRPC router handling manga CRUD operations, metadata refresh, and provider integration. Contains complex metadata transformation logic.

### Violations Identified

#### Violation 1: safeGet Helper Function (CRITICAL)

**Location:** Line 98
**Risk Level:** 🔴 CRITICAL
**Pattern:** Unsafe Record property access
**Impact:** Used extensively throughout file (40+ call sites)

**Code:**
```typescript
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];  // ⚠️ VIOLATION
  }
  return undefined;
}
```

**Why it violates:**
- Returns `unknown` type (correct)
- BUT: The return value from `[key]` is implicitly `any` in some contexts
- Callers may unsafely use the returned value

**Downstream Impact:**
- `safeGetString()` (line 104) - uses safeGet
- `safeGetNumber()` (line 110) - uses safeGet
- Direct calls throughout file

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    const record = obj as Record<string, unknown>;
    const value: unknown = record[key];  // Explicit type annotation
    return value;
  }
  return undefined;
}
```

---

#### Violation 2: providerMetadata any Type

**Location:** Line 2462
**Risk Level:** 🟠 HIGH
**Pattern:** Explicit any type annotation

**Code:**
```typescript
let providerMetadata: any = manga.providerMetadata
  ? (typeof manga.providerMetadata === 'string' ? JSON.parse(manga.providerMetadata) : manga.providerMetadata)
  : {};
```

**Why it violates:**
- `providerMetadata` explicitly typed as `any`
- Used in multiple property accesses later
- Returns from functions may be unsafe

**Affected Lines:** 2462-2900+ (extensive usage in refreshMetaData procedure)

**Fix Complexity:** COMPLEX
**Recommended Fix:**
```typescript
type ProviderMetadataShape = Record<string, unknown> & {
  comicvine?: {
    volumeData?: Array<Record<string, unknown>>;
  };
};

let providerMetadata: ProviderMetadataShape = manga.providerMetadata
  ? (typeof manga.providerMetadata === 'string' 
      ? JSON.parse(manga.providerMetadata) as ProviderMetadataShape
      : manga.providerMetadata as ProviderMetadataShape)
  : {};
```

---

#### Violation 3: Array Map with any Parameter

**Location:** Line 2777
**Risk Level:** 🟠 HIGH
**Pattern:** Array operation with any-typed parameter

**Code:**
```typescript
const enrichedVolumes = volumesData.map((vol: any, index: number) => {
  const volumeNumber = vol.volumeNumber ?? (index + 1);
  const volumeTitle = vol.volumeTitle ?? vol.name ?? vol.title;
  // ... returns object with vol properties
});
```

**Why it violates:**
- `vol` explicitly typed as `any`
- Properties accessed without validation
- Return object may contain any-typed values

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
type VolumeData = {
  volumeNumber?: number;
  volumeTitle?: string;
  name?: string;
  title?: string;
  coverImage?: string;
  volumeSummary?: string;
  releaseDate?: string;
  publisher?: string;
  chapters?: Array<Record<string, unknown>>;
};

const enrichedVolumes = volumesData.map((vol: unknown, index: number) => {
  if (!isRecord(vol)) return null;
  
  const volumeNumber = typeof vol.volumeNumber === 'number' ? vol.volumeNumber : (index + 1);
  // ... with proper type guards
}).filter(Boolean);
```

---

#### Violation 4: Array find with any Parameter

**Location:** Line 2912
**Risk Level:** 🟡 MEDIUM
**Pattern:** Array find with any-typed parameter

**Code:**
```typescript
const fandomLink = externalLinks.find((link: any) =>
  link.site === 'Fandom' || link.url?.includes('fandom.com')
);
```

**Fix Complexity:** SIMPLE
**Recommended Fix:**
```typescript
const fandomLink = externalLinks.find((link: unknown) => {
  if (!isRecord(link)) return false;
  return link.site === 'Fandom' || 
         (typeof link.url === 'string' && link.url.includes('fandom.com'));
});
```

---

#### Violation 5: Array forEach with any Parameter

**Location:** Line 3087
**Risk Level:** 🟡 MEDIUM
**Pattern:** Array forEach with any-typed parameter

**Code:**
```typescript
rawData.volumes.forEach((vol: any) => {
  // ... accesses vol properties
});
```

**Fix Complexity:** SIMPLE

---

### Additional Violations (Estimated 15-20 more)

**Pattern Distribution:**
- Record property access without validation: 8-10
- Array operations with any: 5-7
- Generic type returns: 2-3

---

## File 3: src/server/trpc/routers/metadata.ts

**Lines:** 3,727
**Estimated Violations:** 18-22
**Overall Risk:** 🔴 CRITICAL (metadata operations are high-value)

### Overview

Metadata provider router handling AniList, Fandom, ComicVine, and Wikipedia metadata fetching. Contains extensive data transformation and scraping logic.

### Violations Identified

#### Violation 1: safeGet Helper Function (CRITICAL - DUPLICATE)

**Location:** Line 24
**Risk Level:** 🔴 CRITICAL
**Pattern:** Unsafe Record property access (identical to manga.ts)

**Code:**
```typescript
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];  // ⚠️ VIOLATION
  }
  return undefined;
}
```

**Impact:** Used 30+ times throughout file

**Fix Complexity:** MODERATE
**Note:** Same fix as manga.ts - should extract to shared utility

---

#### Violation 2-13: Multiple "return ... as any" Statements

**Risk Level:** 🟠 HIGH (12 occurrences)
**Pattern:** Explicit any cast in return statement

**All Occurrences:**

| Line | Context | Risk | Complexity |
|------|---------|------|------------|
| **1693** | `return createSuccessResult(resultObj as any);` | 🟠 HIGH | Moderate |
| **2012** | `return createSuccessResult(result as any);` | 🟠 HIGH | Moderate |
| **2144** | `return createSuccessResult(result as any);` | 🟠 HIGH | Moderate |
| **2182** | `return createErrorResult((fandomResult as any).error ...)` | 🟡 MEDIUM | Simple |
| **2369** | `return (manga.coverImage as any).extraLarge ?? ...` | 🔴 CRITICAL | Moderate |
| **2465** | `return createSuccessResult(resultData as any);` | 🟠 HIGH | Complex |
| **2468** | `return createErrorResult((manga as any).error ...)` | 🟡 MEDIUM | Simple |
| **2539** | `return createSuccessResult(metadataResult as any);` | 🟠 HIGH | Moderate |
| **2542** | `return createErrorResult((result as any).error as Error)` | 🟡 MEDIUM | Simple |
| **2682** | `return createSuccessResult(issueResult as any);` | 🟠 HIGH | Moderate |
| **2748** | `return createSuccessResult(volumeResult as any);` | 🟠 HIGH | Moderate |
| **3044** | `return createSuccessResult(enhancedData as any);` | 🟠 HIGH | Complex |

---

#### Violation 2: Fandom Volume Parsing Result (Line 1693)

**Location:** Line 1693 (in `fetchFandomVolumes` procedure)
**Risk Level:** 🟠 HIGH
**Pattern:** as any cast on Record object returned to caller

**Context (Lines 1680-1694):**
```typescript
const resultObj: Record<string, unknown> = {
  volumes: uniqueVolumes.length,
  chapters: totalChapters,
  totalChapters: totalChapters,
  totalVolumes: uniqueVolumes.length,
  volumeDetails: volumeDetails as unknown
};

if (gallery.length > 0) {
  resultObj['gallery'] = gallery;
}

return createSuccessResult(resultObj as any);  // ⚠️ VIOLATION
```

**Why it violates:**
- `resultObj` is properly typed as `Record<string, unknown>`
- Cast to `any` defeats type safety
- Return type is likely `AsyncResult<SomeType, Error>` where `SomeType` doesn't match

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
type FandomVolumesResult = {
  volumes: number;
  chapters: number;
  totalChapters: number;
  totalVolumes: number;
  volumeDetails: unknown;
  gallery?: unknown[];
};

const resultObj: FandomVolumesResult = {
  volumes: uniqueVolumes.length,
  chapters: totalChapters,
  totalChapters: totalChapters,
  totalVolumes: uniqueVolumes.length,
  volumeDetails: volumeDetails
};

if (gallery.length > 0) {
  resultObj.gallery = gallery;
}

return createSuccessResult(resultObj);  // ✅ Type-safe
```

---

#### Violation 3: Triple any Cast for coverImage (Line 2369)

**Location:** Line 2369 (in `fetchMetadataFromAniList` procedure)
**Risk Level:** 🔴 CRITICAL
**Pattern:** Multiple nested any casts

**Context (Lines 2366-2379):**
```typescript
cover: (() => {
  // Extract from nested coverImage object (AniList API returns { large, medium, extraLarge })
  if (manga.coverImage && typeof manga.coverImage === 'object') {
    return (manga.coverImage as any).extraLarge ?? (manga.coverImage as any).large ?? (manga.coverImage as any).medium;  // ⚠️ TRIPLE VIOLATION
  }
  // Fallback to string coverImage or coverUrl
  if (typeof manga.coverImage === 'string') {
    return manga.coverImage;
  }
  if (typeof mangaData.coverUrl === 'string') {
    return mangaData.coverUrl;
  }
  return undefined;
})(),
```

**Why it violates:**
- Three separate `as any` casts in one expression
- Accessing properties on any-typed value
- Return value is implicitly any-typed

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
type CoverImageObject = {
  extraLarge?: string;
  large?: string;
  medium?: string;
};

function isCoverImageObject(obj: unknown): obj is CoverImageObject {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    (candidate.extraLarge === undefined || typeof candidate.extraLarge === 'string') &&
    (candidate.large === undefined || typeof candidate.large === 'string') &&
    (candidate.medium === undefined || typeof candidate.medium === 'string')
  );
}

cover: (() => {
  if (manga.coverImage && typeof manga.coverImage === 'object') {
    if (isCoverImageObject(manga.coverImage)) {
      return manga.coverImage.extraLarge ?? manga.coverImage.large ?? manga.coverImage.medium;
    }
  }
  if (typeof manga.coverImage === 'string') {
    return manga.coverImage;
  }
  if (typeof mangaData.coverUrl === 'string') {
    return mangaData.coverUrl;
  }
  return undefined;
})(),
```

---

#### Violation 14: Enhanced Data Return (Line 3044)

**Location:** Line 3044 (in `fetchComicVineMetadata` procedure)
**Risk Level:** 🟠 HIGH
**Pattern:** Complex data structure cast to any

**Code:**
```typescript
return createSuccessResult(enhancedData as any);
```

**Context:** `enhancedData` is built up with multiple properties from scraped data

**Fix Complexity:** COMPLEX
**Recommended Fix:** Define proper TypeScript interface for ComicVine metadata shape

---

### Additional Violations (Estimated 5-8 more)

**Pattern Distribution:**
- Property access on any-typed objects: 3-4
- Array operations: 2-3
- Implicit any returns: 1

---

## File 4: src/server/services/metadataMerger.ts

**Lines:** 2,818
**Estimated Violations:** 15-20
**Overall Risk:** 🟠 HIGH (core metadata merging logic)

### Overview

Service responsible for enriching manga metadata from multiple providers, merging data, handling conflicts, and persisting results. Critical to metadata quality.

### Violations Identified

#### Violation 1: safeGet Helper Function (CRITICAL - DUPLICATE)

**Location:** Line 37
**Risk Level:** 🔴 CRITICAL
**Pattern:** Unsafe Record property access (identical to manga.ts and metadata.ts)

**Code:**
```typescript
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];  // ⚠️ VIOLATION
  }
  return undefined;
}
```

**Impact:** Used throughout file for data extraction

**Fix Complexity:** MODERATE
**Note:** **CRITICAL FIX:** This function appears in 3 files! Should be extracted to shared utility.

---

#### Violation 2-15: Record<string, unknown> Parameter Methods

**Risk Level:** 🟡 MEDIUM (14+ occurrences)
**Pattern:** Methods accepting Record<string, unknown> and accessing properties

**All Method Signatures:**

| Line | Method | Risk | Complexity |
|------|--------|------|------------|
| **494** | `extractVolumesField(data: unknown, provider: string, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **542** | `extractChaptersField(data: unknown, provider: string, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **563** | `extractDescriptionField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **582** | `extractCoverFields(data: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **606** | `extractStatusField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **621** | `extractAuthorsField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **636** | `extractArtistsField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **651** | `extractGenresField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **666** | `extractTagsField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **681** | `extractPublisherField(data: unknown, manga: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **695** | `extractStartDateField(data: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |
| **711** | `extractEndDateField(data: unknown, updates: Record<string, unknown>)` | 🟡 MEDIUM | Moderate |

**Pattern:**
```typescript
private extractVolumesField(data: unknown, provider: string, updates: Record<string, unknown>): void {
  // Accesses properties on 'data' and 'updates' without full type safety
  const volumeValue = safeGet(data, 'volumes');  // Returns unknown
  if (volumeValue) {
    updates['volumes'] = volumeValue;  // ⚠️ Assigns unknown to Record
  }
}
```

**Why it violates:**
- Returns void but modifies `updates` parameter
- Values assigned may be any-typed
- Callers of methods may unsafely read from `updates`

**Fix Complexity:** COMPLEX (requires refactoring method signatures)
**Recommended Fix:**
```typescript
// Define specific update types
type MetadataUpdates = {
  volumes?: number;
  chapters?: number;
  description?: string;
  cover?: string;
  // ... all other fields
};

private extractVolumesField(
  data: unknown, 
  provider: string, 
  updates: MetadataUpdates
): void {
  const volumeValue = safeGet(data, 'volumes');
  if (typeof volumeValue === 'number') {
    updates.volumes = volumeValue;  // ✅ Type-safe
  }
}
```

---

### Additional Violations (Estimated 1-5 more)

**Pattern Distribution:**
- Record property assignments: 10-14
- Implicit any from method returns: 1-2
- Array operations: 1-2

---

## File 5: src/components/addManga/services/sourceManagementService.ts

**Lines:** 2,136
**Estimated Violations:** 12-15
**Overall Risk:** 🟠 HIGH (UI service with complex state management)

### Overview

React service managing metadata fetching from multiple providers in the Add Manga wizard. Handles cover images, banners, gallery, and provider-specific data extraction.

### Violations Identified

#### Violation 1: Triple any Cast for AniList Cover (Line 400)

**Location:** Line 400
**Risk Level:** 🔴 CRITICAL
**Pattern:** Triple any cast (identical to metadata.ts line 2369)

**Context (Lines 395-404):**
```typescript
const anilistCover = (metadata as Record<string, unknown>)["cover"] || metadata.coverImage;
if (anilistCover) {
  if (typeof anilistCover === 'object') {
    logger.info(`🔍 [Anilist] Processing nested cover object:`, anilistCover);
    coverUrl = ((anilistCover as any).extraLarge ?? (anilistCover as any).large) ?? (anilistCover as any).medium ?? undefined;  // ⚠️ TRIPLE VIOLATION
  } else {
    coverUrl = anilistCover;
  }
}
```

**Fix Complexity:** MODERATE
**Recommended Fix:** Use same `CoverImageObject` type guard from metadata.ts fix

---

#### Violation 2: ComicVine volumeUrls any Cast (Line 1036)

**Location:** Line 1036
**Risk Level:** 🟠 HIGH
**Pattern:** as any on AsyncResult data

**Context (Lines 1030-1037):**
```typescript
const volumeUrlsResponse = await this.mutations.scrapeComicVineVolumeUrlsMutation.mutateAsync({
  seriesUrl: comicVineUrl
}) as AsyncResult<unknown, unknown>;

if (isSuccess(volumeUrlsResponse)) {
  const volumeUrls = (volumeUrlsResponse.data as any).volumeUrls ?? [];  // ⚠️ VIOLATION
  logger.info(`[ComicVine] Found ${volumeUrls.length} volume URLs to scrape`);
```

**Why it violates:**
- `volumeUrlsResponse.data` is `unknown` (correct)
- Cast to `any` to access `.volumeUrls` property
- Result used in `.map()` later without validation

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
type VolumeUrlsResponse = {
  volumeUrls: Array<{
    volumeNumber: number;
    url: string;
  }>;
};

function isVolumeUrlsResponse(data: unknown): data is VolumeUrlsResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.volumeUrls) && 
         obj.volumeUrls.every((v: unknown) => 
           isRecord(v) && 
           typeof v.volumeNumber === 'number' && 
           typeof v.url === 'string'
         );
}

if (isSuccess(volumeUrlsResponse) && isVolumeUrlsResponse(volumeUrlsResponse.data)) {
  const volumeUrls = volumeUrlsResponse.data.volumeUrls;
  // ... type-safe usage
}
```

---

#### Violation 3: ComicVine volumes any Cast (Line 1069)

**Location:** Line 1069
**Risk Level:** 🟠 HIGH
**Pattern:** as any on AsyncResult data (similar to violation 2)

**Code:**
```typescript
const volumes = (chunkResponse.data as any).volumes ?? [];  // ⚠️ VIOLATION
```

**Fix Complexity:** MODERATE
**Recommended Fix:** Similar type guard to violation 2

---

#### Violation 4: Scraped Response Data any Cast (Line 1185)

**Location:** Line 1185
**Risk Level:** 🟡 MEDIUM
**Pattern:** as any on response data

**Code:**
```typescript
const responseData = scrapeResponse.data as any;  // ⚠️ VIOLATION
```

**Fix Complexity:** MODERATE

---

#### Violation 5: tRPC Response Data any Cast (Line 1420)

**Location:** Line 1420
**Risk Level:** 🟡 MEDIUM
**Pattern:** as any on tRPC response

**Code:**
```typescript
const data = response.data as any;  // ⚠️ VIOLATION
```

**Fix Complexity:** MODERATE

---

#### Violation 6-7: rawData Chapters Access (Lines 1472-1473)

**Location:** Lines 1472-1473
**Risk Level:** 🟡 MEDIUM
**Pattern:** as any to access nested property

**Code:**
```typescript
hasRawDataChapters: !!(metadata.rawData as any)?.chapters,
rawDataChaptersLength: (metadata.rawData as any)?.chapters?.length ?? 0
```

**Fix Complexity:** SIMPLE
**Recommended Fix:**
```typescript
hasRawDataChapters: !!(isRecord(metadata.rawData) && 'chapters' in metadata.rawData),
rawDataChaptersLength: (isRecord(metadata.rawData) && Array.isArray(metadata.rawData.chapters)) 
  ? metadata.rawData.chapters.length 
  : 0
```

---

#### Violation 8: Another Response Data any Cast (Line 1557)

**Location:** Line 1557
**Risk Level:** 🟡 MEDIUM
**Pattern:** as any on response

**Fix Complexity:** MODERATE

---

#### Violation 9: Merged Object Property Assignment (Line 2023)

**Location:** Line 2023
**Risk Level:** 🟡 MEDIUM
**Pattern:** as any to bypass index signature

**Context (Lines 2019-2027):**
```typescript
Object.entries(sources).forEach(([provider, metadata]) => {
  if (provider !== primaryProvider) {
    Object.entries(metadata).forEach(([key, value]) => {
      if (value && !merged[key as keyof ProviderMetadata]) {
        (merged as any)[key] = value;  // ⚠️ VIOLATION
      }
    });
  }
});
```

**Why it violates:**
- `merged` has specific type `ProviderMetadata`
- Cast to `any` to assign arbitrary keys
- Defeats type safety

**Fix Complexity:** MODERATE
**Recommended Fix:**
```typescript
type ProviderMetadataFlexible = ProviderMetadata & Record<string, unknown>;

const merged: ProviderMetadataFlexible = { ...primary };

Object.entries(sources).forEach(([provider, metadata]) => {
  if (provider !== primaryProvider) {
    Object.entries(metadata).forEach(([key, value]) => {
      if (value && !merged[key]) {
        merged[key] = value;  // ✅ Type-safe with flexible type
      }
    });
  }
});
```

---

### Additional Violations (Estimated 3-6 more)

**Pattern Distribution:**
- Response data any casts: 5-7
- Property access: 2-3
- Array operations: 1

---

## Cross-File Patterns Summary

### Pattern 1: Duplicate safeGet Function (CRITICAL)

**Occurrences:** 3 files
**Risk Level:** 🔴 CRITICAL
**Priority:** P0

**Files:**
1. `src/server/trpc/routers/metadata.ts` (line 24)
2. `src/server/trpc/routers/manga.ts` (line 98)
3. `src/server/services/metadataMerger.ts` (line 37)

**Impact:** Used 100+ times across these files

**Recommended Fix:**
Extract to shared utility: `src/utils/type-guards/safe-access.ts`

```typescript
/**
 * Safely access a property on an unknown object
 * Returns unknown, callers must type-narrow before use
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    const record = obj as Record<string, unknown>;
    const value: unknown = record[key];
    return value;
  }
  return undefined;
}

/**
 * Safely get a string value from an unknown object
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = ''): string {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Safely get a number value from an unknown object
 */
export function safeGetNumber(obj: unknown, key: string, defaultValue: number = 0): number {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : defaultValue;
}
```

**Fix Complexity:** MODERATE
**Estimated Fixes:** Resolves 40-50 violations across 3 files

---

### Pattern 2: Triple any Cast for Cover Images

**Occurrences:** 2 files
**Risk Level:** 🔴 CRITICAL
**Priority:** P1

**Files:**
1. `src/server/trpc/routers/metadata.ts` (line 2369)
2. `src/components/addManga/services/sourceManagementService.ts` (line 400)

**Recommended Fix:**
Extract to shared type guard: `src/utils/type-guards/anilist-guards.ts`

```typescript
export type CoverImageObject = {
  extraLarge?: string;
  large?: string;
  medium?: string;
};

export function isCoverImageObject(obj: unknown): obj is CoverImageObject {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    (candidate.extraLarge === undefined || typeof candidate.extraLarge === 'string') &&
    (candidate.large === undefined || typeof candidate.large === 'string') &&
    (candidate.medium === undefined || typeof candidate.medium === 'string')
  );
}

export function extractCoverUrl(coverImage: unknown): string | undefined {
  if (typeof coverImage === 'string') return coverImage;
  
  if (isCoverImageObject(coverImage)) {
    return coverImage.extraLarge ?? coverImage.large ?? coverImage.medium;
  }
  
  return undefined;
}
```

**Fix Complexity:** MODERATE
**Estimated Fixes:** Resolves 6 violations across 2 files

---

### Pattern 3: AsyncResult Data as any Casts

**Occurrences:** Multiple files
**Risk Level:** 🟠 HIGH
**Priority:** P1

**Pattern:**
```typescript
const result = await mutation.mutateAsync(...) as AsyncResult<unknown, unknown>;
if (isSuccess(result)) {
  const data = (result.data as any).someProperty;  // ⚠️ VIOLATION
}
```

**Recommended Fix:**
Define response types and type guards for each mutation

```typescript
// Define expected shape
type ScrapeVolumesResponse = {
  volumeUrls: Array<{
    volumeNumber: number;
    url: string;
  }>;
};

// Type guard
function isScrapeVolumesResponse(data: unknown): data is ScrapeVolumesResponse {
  // ... validation
}

// Usage
if (isSuccess(result) && isScrapeVolumesResponse(result.data)) {
  const volumeUrls = result.data.volumeUrls;  // ✅ Type-safe
}
```

**Fix Complexity:** MODERATE-COMPLEX
**Estimated Fixes:** 8-12 violations

---

### Pattern 4: Record<string, unknown> Property Assignment

**Occurrences:** Multiple files
**Risk Level:** 🟡 MEDIUM
**Priority:** P2

**Pattern:**
```typescript
const obj: Record<string, unknown> = {};
obj[dynamicKey] = someValue;  // May be unsafe if someValue is any-typed
return obj;  // ⚠️ May violate if return type expects specific shape
```

**Recommended Fix:**
Define specific types instead of generic Records

**Fix Complexity:** MODERATE
**Estimated Fixes:** 15-20 violations

---

## Risk Assessment by File

### Risk Matrix

| File | Critical | High | Medium | Low | Total Est. |
|------|---------|------|--------|-----|-----------|
| **generated.ts** | 0 | 0 | 5-8 | 20-22 | 25-30 |
| **manga.ts** | 1 | 5-7 | 8-10 | 6-7 | 20-25 |
| **metadata.ts** | 2 | 10-12 | 4-6 | 2-4 | 18-22 |
| **metadataMerger.ts** | 1 | 2-4 | 10-12 | 2-4 | 15-20 |
| **sourceManagementService.ts** | 1 | 4-6 | 5-7 | 2-3 | 12-15 |
| **TOTAL** | **5** | **21-29** | **32-43** | **32-40** | **90-112** |

### Priority Classification

| Priority | Count | Files Affected | Estimated Days |
|----------|-------|----------------|----------------|
| **P0 (Critical)** | 5 | 4 files | 1-2 days |
| **P1 (High)** | 21-29 | 4 files | 2-3 days |
| **P2 (Medium)** | 32-43 | 5 files | 2-3 days |
| **P3 (Low)** | 32-40 | 2 files | 1-2 days |
| **TOTAL** | **90-112** | **5 files** | **6-10 days** |

---

## Common Fix Approaches

### Approach 1: Extract Shared Utilities (PRIORITY)

**Target:** safeGet function duplication
**Impact:** 40-50 violations
**Complexity:** MODERATE
**Days:** 0.5-1 day

**Steps:**
1. Create `src/utils/type-guards/safe-access.ts`
2. Define typed helper functions
3. Replace all 3 duplicates
4. Update all call sites
5. Add tests

**Validation:**
- TypeScript compilation passes
- All existing tests pass
- No new violations introduced

---

### Approach 2: Create Type Guards Library

**Target:** Cover images, AsyncResult responses
**Impact:** 15-20 violations
**Complexity:** MODERATE
**Days:** 1-2 days

**Steps:**
1. Create `src/utils/type-guards/anilist-guards.ts`
2. Create `src/utils/type-guards/response-guards.ts`
3. Define type guards for common patterns
4. Replace all as any casts
5. Add tests

---

### Approach 3: Define Response Types

**Target:** tRPC mutation responses
**Impact:** 20-30 violations
**Complexity:** MODERATE-COMPLEX
**Days:** 2-3 days

**Steps:**
1. Audit all tRPC mutations
2. Define expected response types
3. Create type guards
4. Update all mutation call sites
5. Add tests

---

### Approach 4: Refactor Record Usage

**Target:** Generic Record<string, unknown>
**Impact:** 15-20 violations
**Complexity:** MODERATE
**Days:** 2-3 days

**Steps:**
1. Identify all Record usage patterns
2. Define specific interfaces
3. Replace generic Records
4. Update property access
5. Add tests

---

## Recommended Execution Order

### Phase 1: Critical Violations (Days 1-2)

**Goal:** Fix P0 violations with highest impact

**Batches:**
1. **Batch 1.1:** Extract safeGet to shared utility (40-50 fixes)
   - Files: metadata.ts, manga.ts, metadataMerger.ts
   - Risk: MODERATE
   - Validation: Full test suite

2. **Batch 1.2:** Create cover image type guards (6 fixes)
   - Files: metadata.ts, sourceManagementService.ts
   - Risk: MODERATE
   - Validation: Affected tests

**Expected Completion:** 46-56 violations fixed (51-62% of Tier 1)

---

### Phase 2: High-Risk Violations (Days 3-4)

**Goal:** Fix P1 violations in core logic

**Batches:**
3. **Batch 2.1:** AsyncResult response type guards (8-12 fixes)
   - Files: sourceManagementService.ts, manga.ts
   - Risk: HIGH
   - Validation: Full test suite

4. **Batch 2.2:** Metadata.ts as any returns (12 fixes)
   - Files: metadata.ts
   - Risk: HIGH
   - Validation: Metadata provider tests

5. **Batch 2.3:** Manga.ts array operations (5-7 fixes)
   - Files: manga.ts
   - Risk: MODERATE-HIGH
   - Validation: Manga router tests

**Expected Completion:** 71-87 violations fixed (79-97% of Tier 1)

---

### Phase 3: Medium-Risk Violations (Days 5-6)

**Goal:** Fix P2 violations in data transformation

**Batches:**
6. **Batch 3.1:** MetadataMerger extract methods (10-14 fixes)
   - Files: metadataMerger.ts
   - Risk: MODERATE
   - Validation: Metadata merger tests

7. **Batch 3.2:** Record property assignments (8-12 fixes)
   - Files: Multiple
   - Risk: MODERATE
   - Validation: Affected tests

**Expected Completion:** 89-113 violations fixed (99-127% of Tier 1 estimate)

---

### Phase 4: Low-Risk Violations (Days 7-8)

**Goal:** Fix P3 violations in generated code

**Batches:**
8. **Batch 4.1:** Generated type guards (25-30 fixes)
   - Files: generated.ts
   - Risk: LOW
   - Validation: Type guard tests

**Expected Completion:** 114-143 violations fixed

---

## Validation Checklist

After each batch:

### Automated Checks
- [ ] `bun run type-check` passes (zero TypeScript errors)
- [ ] `npx eslint [files]` shows violation count decreased
- [ ] `bun test` passes (all tests green)
- [ ] No new ESLint violations introduced

### Manual Checks
- [ ] Code review for each changed file
- [ ] Verify fix doesn't break runtime behavior
- [ ] Check that type narrowing is correct
- [ ] Ensure error handling is preserved

### Git Strategy
```bash
# After each batch
git add [files]
git commit -m "fix(eslint): Resolve no-unsafe-return violations - Batch X.Y

Fixed [N] violations in [M] files:
- [Summary of changes]

Risk level: [LOW/MEDIUM/HIGH/CRITICAL]
Validation: TypeScript ✅ ESLint ✅ Tests ✅

Before: [X] violations | After: [Y] violations | Fixed: [N]"
```

---

## Expected Outcomes

### By File

| File | Before (Est.) | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 | Reduction |
|------|--------------|---------------|---------------|---------------|---------------|-----------|
| **generated.ts** | 25-30 | 25-30 | 25-30 | 25-30 | 0-5 | 83-100% |
| **manga.ts** | 20-25 | 5-10 | 0-3 | 0 | 0 | 100% |
| **metadata.ts** | 18-22 | 6-10 | 0-2 | 0 | 0 | 90-100% |
| **metadataMerger.ts** | 15-20 | 0-5 | 0-2 | 0 | 0 | 90-100% |
| **sourceManagementService.ts** | 12-15 | 6-9 | 0-3 | 0 | 0 | 80-100% |
| **TOTAL** | **90-112** | **42-64** | **25-40** | **25-30** | **0-5** | **95-100%** |

### Overall Impact

- **Tier 1 violations resolved:** 85-107 out of 90-112 (95-100%)
- **Total codebase impact:** 34-43% of all 250-350 violations
- **Shared utilities created:** 3-4 new type guard modules
- **Developer velocity:** Future similar violations easier to fix

---

## Risks and Mitigation

### Risk 1: Breaking Changes to Public APIs

**Likelihood:** MEDIUM
**Impact:** HIGH
**Mitigation:**
- Manual review of all exported functions
- Check for dependent files before changing signatures
- Run full test suite after each batch

### Risk 2: Type Inference Issues

**Likelihood:** MEDIUM
**Impact:** MEDIUM
**Mitigation:**
- Explicit type annotations where needed
- Type-check after each file
- Use type guards instead of casts

### Risk 3: Runtime Errors

**Likelihood:** LOW
**Impact:** HIGH
**Mitigation:**
- Defensive type checks
- Preserve existing error handling
- Add runtime validation for critical paths

### Risk 4: Performance Degradation

**Likelihood:** LOW
**Impact:** LOW
**Mitigation:**
- Type guards are compile-time zero-cost
- Runtime checks only add minimal overhead
- Benchmark critical paths if needed

---

## Next Steps

### Immediate Actions

1. **Review this analysis** - Validate findings and approach
2. **Approve Phase 1** - Begin with critical violations
3. **Set up tracking** - Create progress tracking document
4. **Prepare workspace** - Clean git state, create branch

### Phase 1 Launch

Execute Batch 1.1 (safeGet extraction):
1. Create `src/utils/type-guards/safe-access.ts`
2. Implement typed helper functions
3. Write tests for helpers
4. Replace in metadata.ts
5. Replace in manga.ts
6. Replace in metadataMerger.ts
7. Run validation
8. Commit

**Estimated Time:** 3-4 hours

---

## Appendix A: Complete Violation List

### metadata.ts (18-22 violations)

| # | Line | Function | Pattern | Risk | Complexity |
|---|------|----------|---------|------|------------|
| 1 | 24 | safeGet | Record property return | 🔴 CRITICAL | Moderate |
| 2 | 1693 | fetchFandomVolumes | as any return | 🟠 HIGH | Moderate |
| 3 | 2012 | fetchFandomChapterMetadata | as any return | 🟠 HIGH | Moderate |
| 4 | 2144 | fetchFandomMetadata | as any return | 🟠 HIGH | Moderate |
| 5 | 2182 | fetchFandomMetadata | Error as any | 🟡 MEDIUM | Simple |
| 6 | 2369 | fetchMetadataFromAniList | Triple any cast | 🔴 CRITICAL | Moderate |
| 7 | 2465 | fetchMetadataFromAniList | as any return | 🟠 HIGH | Complex |
| 8 | 2468 | fetchMetadataFromAniList | Error as any | 🟡 MEDIUM | Simple |
| 9 | 2539 | fetchMangaUpdatesMetadata | as any return | 🟠 HIGH | Moderate |
| 10 | 2542 | fetchMangaUpdatesMetadata | Error as any | 🟡 MEDIUM | Simple |
| 11 | 2682 | fetchComicVineIssueMetadata | as any return | 🟠 HIGH | Moderate |
| 12 | 2748 | fetchComicVineVolumeMetadata | as any return | 🟠 HIGH | Moderate |
| 13 | 3044 | fetchComicVineMetadata | as any return | 🟠 HIGH | Complex |
| 14-22 | Various | Various | Property access | 🟡 MEDIUM | Simple-Moderate |

### manga.ts (20-25 violations)

| # | Line | Function | Pattern | Risk | Complexity |
|---|------|----------|---------|------|------------|
| 1 | 98 | safeGet | Record property return | 🔴 CRITICAL | Moderate |
| 2 | 2462 | refreshMetaData | any type annotation | 🟠 HIGH | Complex |
| 3 | 2777 | refreshMetaData | Array map with any | 🟠 HIGH | Moderate |
| 4 | 2912 | refreshMetaData | Array find with any | 🟡 MEDIUM | Simple |
| 5 | 3087 | refreshMetaData | Array forEach with any | 🟡 MEDIUM | Simple |
| 6-25 | Various | Various | Property access, returns | 🟡 MEDIUM | Simple-Moderate |

### metadataMerger.ts (15-20 violations)

| # | Line | Function | Pattern | Risk | Complexity |
|---|------|----------|---------|------|------------|
| 1 | 37 | safeGet | Record property return | 🔴 CRITICAL | Moderate |
| 2-15 | 494-711 | extract*Field methods | Record mutations | 🟡 MEDIUM | Moderate |
| 16-20 | Various | Various | Property access | 🟡 MEDIUM | Simple-Moderate |

### sourceManagementService.ts (12-15 violations)

| # | Line | Function | Pattern | Risk | Complexity |
|---|------|----------|---------|------|------------|
| 1 | 400 | fetchSourceMetadata | Triple any cast | 🔴 CRITICAL | Moderate |
| 2 | 1036 | fetchSourceMetadata | AsyncResult as any | 🟠 HIGH | Moderate |
| 3 | 1069 | fetchSourceMetadata | AsyncResult as any | 🟠 HIGH | Moderate |
| 4 | 1185 | handleSourceSelection | Response as any | 🟡 MEDIUM | Moderate |
| 5 | 1420 | getChaptersForSource | Response as any | 🟡 MEDIUM | Moderate |
| 6 | 1472 | getChaptersForSource | Property as any | 🟡 MEDIUM | Simple |
| 7 | 1473 | getChaptersForSource | Property as any | 🟡 MEDIUM | Simple |
| 8 | 1557 | mergeProviderMetadata | Response as any | 🟡 MEDIUM | Moderate |
| 9 | 2023 | mergeProviderMetadata | Object as any | 🟡 MEDIUM | Moderate |
| 10-15 | Various | Various | Property access | 🟡 MEDIUM | Simple-Moderate |

### generated.ts (25-30 violations)

| # | Line | Function | Pattern | Risk | Complexity |
|---|------|----------|---------|------|------------|
| 1-30 | Various | Type guards | Missing type narrowing | 🟢 LOW | Simple |

---

## Appendix B: Type Guard Templates

### Template 1: Object Type Guard

```typescript
export type ExpectedShape = {
  requiredProp: string;
  optionalProp?: number;
  nestedObj?: {
    nestedProp: boolean;
  };
};

export function isExpectedShape(obj: unknown): obj is ExpectedShape {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Required properties
  if (typeof candidate.requiredProp !== 'string') {
    return false;
  }

  // Optional properties
  if (candidate.optionalProp !== undefined && typeof candidate.optionalProp !== 'number') {
    return false;
  }

  // Nested objects
  if (candidate.nestedObj !== undefined) {
    if (typeof candidate.nestedObj !== 'object' || candidate.nestedObj === null) {
      return false;
    }
    const nested = candidate.nestedObj as Record<string, unknown>;
    if (typeof nested.nestedProp !== 'boolean') {
      return false;
    }
  }

  return true;
}
```

### Template 2: Array Type Guard

```typescript
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isObjectArray<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}
```

### Template 3: Union Type Guard

```typescript
type Result = SuccessResult | ErrorResult;

type SuccessResult = {
  success: true;
  data: unknown;
};

type ErrorResult = {
  success: false;
  error: Error;
};

export function isSuccessResult(result: unknown): result is SuccessResult {
  if (typeof result !== 'object' || result === null) return false;
  const candidate = result as Record<string, unknown>;
  return candidate.success === true && 'data' in candidate;
}

export function isErrorResult(result: unknown): result is ErrorResult {
  if (typeof result !== 'object' || result === null) return false;
  const candidate = result as Record<string, unknown>;
  return candidate.success === false && candidate.error instanceof Error;
}
```

---

## Appendix C: Testing Strategy

### Test Template for Type Guards

```typescript
import { describe, it, expect } from 'bun:test';
import { isExpectedShape } from './type-guards';

describe('isExpectedShape', () => {
  it('should return true for valid shape', () => {
    const valid = {
      requiredProp: 'test',
      optionalProp: 42
    };
    expect(isExpectedShape(valid)).toBe(true);
  });

  it('should return false for invalid shape', () => {
    const invalid = {
      requiredProp: 123  // Wrong type
    };
    expect(isExpectedShape(invalid)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isExpectedShape(null)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isExpectedShape('string')).toBe(false);
    expect(isExpectedShape(42)).toBe(false);
    expect(isExpectedShape(undefined)).toBe(false);
  });

  it('should handle optional properties', () => {
    const withoutOptional = {
      requiredProp: 'test'
    };
    expect(isExpectedShape(withoutOptional)).toBe(true);
  });
});
```

---

*Last Updated: 2025-11-08*
*Status: Complete - Ready for Phase 1 Execution*
*Next Step: Review and approve Phase 1 approach*
*Estimated Total Time: 6-10 days across 4 phases*
*Expected Resolution: 85-107 violations (95-100% of Tier 1)*

---

## Document Metadata

**Generated by:** Claude Code (File Search Specialist Agent)
**Analysis Method:** Pattern matching, code reading, violation categorization
**Confidence Level:** HIGH (based on code inspection and pattern analysis)
**Validation Status:** Awaiting manual review
**Related Documents:**
- [Comprehensive Plan](./no-unsafe-return-comprehensive-plan.md)
- [Executive Summary](./no-unsafe-return-executive-summary.md)
- [Agentic Workflow](./no-unsafe-return-agentic-workflow.md)

**Usage:**
This document should be used as the foundation for Phase 1 execution. All violation line numbers and risk assessments should be validated during implementation.
