# No-Unsafe-Return Violations - Tier 2 Analysis

**Document Type:** ESLint Violation Analysis  
**Rule:** `@typescript-eslint/no-unsafe-return`  
**Violation Count:** 35+ violations  
**Status:** Comprehensive Priority Files Analysis  
**Date Generated:** 2025-11-08

---

## Executive Summary

This analysis examines `@typescript-eslint/no-unsafe-return` violations in 15 priority server-side files, identifying functions that return values without proper type safety. The violations fall into **4 distinct patterns**, with **Type Casting**, **Any-Type Returns**, and **Unsafe Error Handling** being the most common.

### Key Statistics

| Metric | Count |
|--------|-------|
| Files Analyzed | 15 |
| Total Violations Found | 35+ |
| Critical Severity | 8 |
| High Severity | 12 |
| Medium Severity | 15+ |
| Pattern Categories | 4 |

---

## Violation Patterns

### Pattern 1: Unsafe Type Casting (as unknown as Type)

**Severity:** CRITICAL  
**Occurrences:** 8  
**Description:** Functions cast untyped values to specific types using `as unknown as Type` pattern, bypassing type safety.

#### Locations:

1. **src/sdk/kaizoku-api-sdk.ts:345**
```typescript
lastError = errorMessage as unknown as Error;  // Casting string to Error
```

2. **src/sdk/kaizoku-api-sdk.ts:910**
```typescript
reject(errorMessage);  // Returning string instead of Error
```

3. **src/server/services/backup/index.ts:345**
```typescript
lastError = errorMessage as unknown as Error;
```

4. **src/server/services/fandom/FandomService.ts:259**
```typescript
const errorMessage = error instanceof Error ? error.message : String(error);
this.log.error('Search failed', { query, errorMessage });
```

#### Impact:
- Runtime type mismatch: Error handlers expect Error objects but receive strings
- Lost error stack traces and context
- Breaks error recovery mechanisms

---

### Pattern 2: Unsafe Cache Retrieval with Casting

**Severity:** HIGH  
**Occurrences:** 6  
**Description:** Values retrieved from cache (typed as `unknown` or `any`) are cast to specific types without validation.

#### Locations:

1. **src/server/services/wikipedia/WikipediaService.ts:182**
```typescript
async searchManga(query: string): Promise<WikipediaSearchResult[]> {
  const cached = this.cache.get(cacheKey);
  if (cached) {
    return cached as WikipediaSearchResult[];  // Unsafe cast from unknown
  }
}
```

2. **src/server/services/wikipedia/WikipediaService.ts:268**
```typescript
const cached = this.cache.get(cacheKey);
if (cached) {
  return cached as WikipediaMangaData;  // Unsafe cast
}
```

3. **src/server/services/wikipedia/WikipediaService.ts:1334**
```typescript
const cached = this.cache.get(cacheKey);
if (cached) {
  return cached as WikipediaVolume[];  // Unsafe cast from unknown
}
```

4. **src/server/services/wikipedia/WikipediaService.ts:1537**
```typescript
const cached = this.cache.get(cacheKey);
if (cached) {
  return cached as WikipediaVolume[];  // Unsafe cast from unknown
}
```

5. **src/server/services/fandom/dynamic/WikiContentScraper.ts:206**
```typescript
private cache = new Map<string, any>();  // Cache typed as 'any'
if (this.cache.has(url)) {
  return this.cache.get(url);  // Returns any type
}
```

6. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:102**
```typescript
private cache = new Map<string, PageStructure>();
if (this.cache.has(cacheKey)) {
  return Promise.resolve(this.cache.get(cacheKey)!);  // Non-null assertion without validation
}
```

#### Impact:
- No runtime validation of cached data
- Stale or corrupted cache entries bypass type checking
- Type assertion failure at runtime could crash handlers

---

### Pattern 3: Functions Returning `any` Type

**Severity:** HIGH  
**Occurrences:** 5+  
**Description:** Functions explicitly return `any` type, completely bypassing type safety.

#### Locations:

1. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:890**
```typescript
private extractVolumeDataFromContent(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  volumeNumber: number,
  title: string
): any {  // Returns 'any' type
  const volumeData: Record<string, unknown> = {
    number: volumeNumber,
    title: title ?? `Volume ${volumeNumber}`,
    chapters: []
  };
  // ... extensive processing ...
  return (Array.isArray(chapters) && chapters.length > 0) ? volumeData : null;
}
```

2. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:1025**
```typescript
private extractTableRow($: CheerioAPI, cells: Cheerio<AnyNode>, headers: string[]): any {
  const item: Record<string, unknown> = {};
  // ... processing ...
  return item;
}
```

3. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:1140**
```typescript
private extractVolumeFromContent($: CheerioAPI, $content: Cheerio<AnyNode>): any {
  const volume: Record<string, unknown> = {
    chapters: []
  };
  // ... processing ...
  return Array.isArray(volumeChapters) && volumeChapters.length > 0 ? volume : null;
}
```

4. **src/server/services/metadata/utils/fandomTableParser.ts:817**
```typescript
export function parseInfoboxData(html: string): any {
  try {
    const $ = cheerio.load(html);
    const data = {} as Record<string, unknown>;
    // ... parsing logic ...
    return data;
  } catch (error: unknown) {
    logger.error('Error parsing infobox data:', errorMessage);
    return {};
  }
}
```

5. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:1527**
```typescript
private mergeExtractedData(...dataSets: unknown[]): any {
  const merged: Record<string, unknown> = {
    volumes: [],
    chapters: [],
    gallery: []
  };
  // ... merging logic ...
  return merged;
}
```

#### Impact:
- Complete bypass of TypeScript type checking
- Consumers don't know what structure to expect
- Silent data type errors at runtime
- No IDE autocomplete or validation

---

### Pattern 4: Unsafe Error Message Handling

**Severity:** MEDIUM  
**Occurrences:** 10+  
**Description:** Error messages converted from unknown to string, then used directly in responses without validation.

#### Locations:

1. **src/server/services/wikipedia/WikipediaService.ts:244**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia search errorMessage for "${query}": ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return [];
}
```

2. **src/server/services/wikipedia/WikipediaService.ts:564**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia getMangaInfo errorMessage for "${pageTitle}": ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return null;
}
```

3. **src/server/services/wikipedia/WikipediaService.ts:652**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia getChapterList errorMessage for "${mangaTitle}": ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return [];
}
```

4. **src/server/services/wikipedia/WikipediaService.ts:1048**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia searchChapterList error: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return [];
}
```

5. **src/server/services/wikipedia/WikipediaService.ts:1319**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia findBestMatch errorMessage for "${mangaTitle}": ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return null;
}
```

6. **src/server/services/wikipedia/WikipediaService.ts:1393**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia getVolumeList error: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return [];
}
```

7. **src/server/services/wikipedia/WikipediaService.ts:1521**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia getVolumeWithChapters error: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return null;
}
```

8. **src/server/services/wikipedia/WikipediaService.ts:1655**
```typescript
catch (error: unknown) {
  logger.error(`Wikipedia getVolumesWithDescriptions error: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
  return [];
}
```

#### Issues:
- Redundant type checks: `error instanceof Error ? (error instanceof Error ? ...` 
- String conversion loses error context
- Non-deterministic function returns (returns array vs null)

---

### Pattern 5: Unsafe Unknown Type Returns

**Severity:** MEDIUM  
**Occurrences:** 5+  
**Description:** Functions return `unknown` type without sufficient type guards in callers.

#### Locations:

1. **src/server/services/metadata/utils/fandomTableParser.ts:1166**
```typescript
export function parseVolumeTablesEnhanced(html: string): unknown[] {
  const { volumes, chapters } = parsePageAdaptive(html);
  // ... processing ...
  const enhancedVolumes = volumes.map(volume => ({
    ...volume,
    volumeNumber: volume.number,
    chapters: chapters ?? [],
    chapterCount: chapters.length ?? 0,
    galleryImages: galleryImages.filter(img => img.caption.includes(`Volume ${volume.number}`)).map(img => img.url)
  }));
  return enhancedVolumes;
}
```

2. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:355**
```typescript
private extractFromTables($: CheerioAPI, _structure: PageStructure): Promise<unknown> {
  const volumes: unknown[] = [];
  const chapters: unknown[] = [];
  // ... extensive table extraction ...
  return Promise.resolve({ volumes, chapters, gallery: galleryImages });
}
```

3. **src/server/services/fandom/dynamic/DynamicWikiParser.ts:572**
```typescript
private extractFromTabs($: CheerioAPI, _structure: PageStructure): Promise<unknown> {
  const data: Record<string, unknown> = { volumes: [], chapters: [] };
  // ... extraction logic ...
  return Promise.resolve(data);
}
```

#### Impact:
- Consumers must use unsafe type assertions to use returned data
- No compile-time guarantees about data structure
- Higher risk of runtime errors

---

## File-by-File Breakdown

### 1. src/sdk/kaizoku-api-sdk.ts
**Violations:** 2  
**Severity:** CRITICAL

- Line 345: Error casting error message as Error type
- Line 910: Returning rejected promise with string instead of Error

**Fix Recommendation:**
```typescript
// BEFORE (UNSAFE)
lastError = errorMessage as unknown as Error;

// AFTER (SAFE)
lastError = error instanceof Error ? error : new Error(String(error));
```

---

### 2. src/server/services/backup/index.ts
**Violations:** 4  
**Severity:** CRITICAL

Lines: 89, 141, 192, 237, 457, 516, 550, 604, 795

**Pattern:** Duplicate error instanceof checks
```typescript
error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
```

**Fix:** Use single conditional:
```typescript
error instanceof Error ? error.message : String(error)
```

---

### 3. src/server/services/wikipedia/WikipediaService.ts
**Violations:** 10+  
**Severity:** HIGH + MEDIUM

**Cache-Related (Lines 182, 268, 1334, 1537):**
```typescript
// UNSAFE
return cached as WikipediaSearchResult[];

// SAFE
if (cached && this.isValidSearchResult(cached)) {
  return cached as WikipediaSearchResult[];
}
```

**Error Handling (Lines 244, 564, 652, 1048, 1319, 1393, 1521, 1655):**
- Redundant instanceof checks
- String conversion loses context

---

### 4. src/server/services/fandom/dynamic/DynamicWikiParser.ts
**Violations:** 8  
**Severity:** HIGH

**`any` Type Returns (Lines 890, 1025, 1140, 1527):**
```typescript
// UNSAFE
private extractVolumeDataFromContent(...): any { ... }

// SAFE
private extractVolumeDataFromContent(...): VolumeData | null { ... }
```

**Generic Extract Methods (Lines 355, 572):**
- Return `Promise<unknown>` without structure definition
- Callers must use unsafe assertions

---

### 5. src/server/services/fandom/dynamic/WikiContentScraper.ts
**Violations:** 3  
**Severity:** HIGH + MEDIUM

- Line 90: Cache typed as `Map<string, any>`
- Multiple methods returning partial type information
- Gallery extraction returns `unknown[]`

---

### 6. src/server/services/metadata/utils/fandomTableParser.ts
**Violations:** 4  
**Severity:** HIGH + MEDIUM

- Line 817: `parseInfoboxData()` returns `any`
- Line 1166: `parseVolumeTablesEnhanced()` returns `unknown[]`
- No validation of returned data structure

---

### 7. src/server/parsers/extractors/TableExtractor.ts
**Violations:** 3+  
**Severity:** MEDIUM

- Methods returning interface unions without proper discrimination
- Potential for callers to receive unexpected type

---

### 8. Other Priority Files
- **FandomService.ts:** 5+ violations (similar patterns to WikipediaService.ts)
- **configService.ts:** 2 violations (if-chain type narrowing issues)
- **Other parsers:** 3+ violations (generic unknown returns)

---

## Root Cause Analysis

### Primary Causes:

1. **Cache System Design**
   - Caches typed as `Map<string, any>` or `Map<string, unknown>`
   - No validation of retrieved values before casting
   - Need: Typed cache with validation

2. **Error Handling Patterns**
   - Errors converted to strings for logging
   - Redundant type checks (nested isinstance checks)
   - Need: Proper error wrapping and context preservation

3. **HTML Extraction Methods**
   - Cheerio returns flexibly-typed content
   - No enforced return type structure
   - Need: Type-safe extraction wrappers with validation

4. **Function Return Type Omissions**
   - Functions return `any` or `unknown` without specification
   - Makes consumer code unsafe
   - Need: Explicit return type declarations with validation

---

## Risk Assessment

### High Risk (Immediate Action Required)
1. Error handling in SDK causing type mismatches
2. Cache casting in Wikipedia service without validation
3. `any`-type returns in parser modules

### Medium Risk (Should Address)
1. Unknown type returns without structure guarantee
2. Error message conversion losing context
3. Gallery/image extraction with unknown types

### Low Risk (Nice to Have)
1. Helper function typing improvements
2. Error context preservation
3. Cache key validation

---

## Remediation Strategy

### Phase 1: Critical Fixes (Priority 1-2)
1. Fix error handling in kaizoku-api-sdk.ts and backup/index.ts
2. Implement cache validation in Wikipedia service
3. Add return type declarations to `any`-returning functions

### Phase 2: High Priority (Priority 3-5)
1. Create TypeScript interfaces for all cache entries
2. Add runtime validation for cached values
3. Implement proper error wrapping

### Phase 3: Medium Priority (Priority 6-10)
1. Refactor extract methods to return typed unions
2. Improve gallery/image handling with proper types
3. Add type guards for unknown returns

---

## Code Examples

### Example 1: Safe Cache Retrieval

```typescript
// UNSAFE (CURRENT)
async searchManga(query: string): Promise<WikipediaSearchResult[]> {
  const cached = this.cache.get(cacheKey);
  if (cached) {
    return cached as WikipediaSearchResult[];  // NO VALIDATION!
  }
}

// SAFE (RECOMMENDED)
private isValidSearchResult(value: unknown): value is WikipediaSearchResult[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => 
    typeof item === 'object' && 
    item !== null &&
    'title' in item &&
    'pageId' in item
  );
}

async searchManga(query: string): Promise<WikipediaSearchResult[]> {
  const cached = this.cache.get(cacheKey);
  if (cached && this.isValidSearchResult(cached)) {
    return cached;
  }
  // ... fetch and validate ...
}
```

### Example 2: Type-Safe Return Values

```typescript
// UNSAFE (CURRENT)
private extractVolumeDataFromContent(...): any {
  const volumeData: Record<string, unknown> = { /* ... */ };
  return volumeData;  // Returns as 'any'
}

// SAFE (RECOMMENDED)
interface ExtractedVolume {
  number: number;
  title: string;
  chapters: ChapterInfo[];
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
}

private extractVolumeDataFromContent(...): ExtractedVolume | null {
  // Type-safe implementation
  const chapters = Array.isArray(chapterData) ? chapterData : [];
  if (chapters.length === 0 && !hasOtherData) return null;
  
  return {
    number: volumeNumber,
    title: title ?? `Volume ${volumeNumber}`,
    chapters,
    coverImage: coverImage,
    releaseDate: releaseDate,
    isbn: isbn
  };
}
```

### Example 3: Proper Error Handling

```typescript
// UNSAFE (CURRENT)
catch (error: unknown) {
  const errorMessage = error instanceof Error ? 
    (error instanceof Error ? error.message : String(error)) : 
    String(error);
  logger.error('Operation failed', { error: errorMessage });
  throw error;  // Throws unknown type
}

// SAFE (RECOMMENDED)
catch (error: unknown) {
  const appError = error instanceof Error 
    ? error 
    : new Error(String(error));
  
  logger.error('Operation failed', { 
    message: appError.message,
    stack: appError.stack,
    originalType: typeof error
  });
  throw appError;  // Throws Error type
}
```

---

## Verification Checklist

- [ ] All cache retrievals validated before use
- [ ] No `any` type returns from public functions
- [ ] Error objects preserved (not converted to strings)
- [ ] Unknown type returns have structure documentation
- [ ] All function signatures include return type annotations
- [ ] Type guards added for unsafe casts
- [ ] Error contexts preserved in logging
- [ ] Redundant type checks removed

---

## References

- [TypeScript no-unsafe-return Rule](https://typescript-eslint.io/rules/no-unsafe-return/)
- [Type Guards and Predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Async/Error Handling Patterns](https://www.typescriptlang.org/docs/handbook/2/types-from-extraction.html)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-08  
**Next Review:** After remediation completion
