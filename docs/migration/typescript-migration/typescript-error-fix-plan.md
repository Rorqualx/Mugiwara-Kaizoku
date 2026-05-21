# TypeScript Error Fix Plan

## Executive Summary
Total errors identified: 89 errors across 18 files
Priority errors from requested files: 76 errors

## Error Categories

### 1. Null vs Undefined Type Mismatches (20 errors)
**Pattern**: `Type 'number | null | undefined' is not assignable to type 'number | undefined'`

### 2. Date vs String Type Mismatches (8 errors)  
**Pattern**: `Type 'Date' is not assignable to type 'string'`

### 3. Missing Properties on Interfaces (5 errors)
**Pattern**: `Property 'description' does not exist in type 'MetadataDetails'`

### 4. Interface Implementation Mismatches (4 errors)
**Pattern**: Properties not assignable to base interface

### 5. Selector/Extraction Type Issues (14 errors)
**Pattern**: `this.extractValue` returning incompatible types

## Detailed Error Analysis & Fixes

### File: `src/api/metadataProviders/adapters/anilistAdapter.ts`
**Errors**: 5
**Lines**: 243-246, 342

#### Error 1-2: Null handling for chapters/volumes (Lines 243-244)
```typescript
// Current
chapters: metadata.chapters, // Type 'number | null | undefined' not assignable to 'number | undefined'
volumes: metadata.volumes,

// Fix
chapters: metadata.chapters ?? undefined,
volumes: metadata.volumes ?? undefined,
```
**Root Cause**: AniList API returns `null` for missing values, but our interface expects `undefined`

#### Error 3-4: Date type mismatch (Lines 245-246)
```typescript
// Current  
startDate: metadata.startDate, // Type 'string | Date | null | undefined' not assignable to 'string | null | undefined'
endDate: metadata.endDate,

// Fix
startDate: metadata.startDate instanceof Date 
  ? metadata.startDate.toISOString() 
  : metadata.startDate ?? undefined,
endDate: metadata.endDate instanceof Date 
  ? metadata.endDate.toISOString() 
  : metadata.endDate ?? undefined,
```
**Root Cause**: Metadata can contain Date objects but interface expects strings

#### Error 5: Missing property 'description' (Line 342)
```typescript
// Current
const metadata: MetadataDetails = {
  description: this.cleanDescription(media.description), // 'description' does not exist

// Fix - Check MetadataDetails interface
// If 'summary' is the correct field:
summary: this.cleanDescription(media.description),
// Or update MetadataDetails interface to include 'description'
```
**Root Cause**: Interface mismatch - MetadataDetails has 'summary' not 'description'

---

### File: `src/api/metadataProviders/adapters/baseKapowarrAdapter.ts`
**Errors**: 2
**Lines**: 175, 248

#### Error 1: getChapters return type mismatch (Line 175)
```typescript
// Current signature
async getChapters(mangaId: string | number, options?: {...}): Promise<ChapterEntity[]>

// Expected by KapowarrAdapter interface
getChapters(mangaId: string): Promise<KapowarrChapter[]>

// Fix Option 1: Update interface to match implementation
interface KapowarrAdapter {
  getChapters(mangaId: string | number): Promise<ChapterEntity[]>;
}

// Fix Option 2: Create adapter method
async getKapowarrChapters(mangaId: string): Promise<KapowarrChapter[]> {
  const chapters = await this.getChapters(mangaId);
  return chapters.map(ch => this.toKapowarrChapter(ch));
}
```
**Root Cause**: Interface expects KapowarrChapter[] but implementation returns ChapterEntity[]

#### Error 2: searchManga return type mismatch (Line 248)
```typescript
// Fix: Ensure return type matches interface
async searchManga(query: string): Promise<KapowarrSearchResult[]> {
  const results = await this.search(query);
  return results.map(r => ({
    id: String(r.id ?? ''),
    // ... map to KapowarrSearchResult structure
  }));
}
```
**Root Cause**: Zod schema output type doesn't match KapowarrSearchResult interface

---

### File: `src/api/metadataProviders/adapters/comicvineAdapter.ts`
**Errors**: 5
**Lines**: 201-204, 314

#### Same pattern as anilistAdapter.ts
- Use nullish coalescing for null → undefined conversion
- Convert Date objects to ISO strings
- Fix 'description' vs 'summary' field name

---

### File: `src/api/metadataProviders/adapters/fandomAdapter.ts`
**Errors**: 5
**Lines**: 195-198, 308

#### Same pattern as previous adapters
- Null handling for numeric fields
- Date to string conversion
- Interface property alignment

---

### File: `src/api/metadataProviders/scrapers/WebScraper.ts`
**Errors**: 14
**Lines**: 72-85 (multiple selector issues)

#### Selector type issues
```typescript
// Current
const value = this.extractValue($, element, selector);

// Fix: Add proper typing
const value = this.extractValue($, element, selector as SelectorConfig);
// Or ensure selector is properly typed from searchResults.metadata
```
**Root Cause**: `selector` type not properly inferred from Object.entries

---

### File: `src/api/utils/provider-registry.ts`
**Errors**: 16
**Lines**: 182+ (validateProvider method issues)

#### Provider validation issues
```typescript
// Add proper type guards and null checks
private validateProvider(provider: unknown): provider is ValidProvider {
  if (!provider || typeof provider !== 'object') return false;
  // Add comprehensive validation
}
```

---

### File: `src/api/utils/unified-cache-manager.ts`
**Errors**: 6
**Lines**: 425+ (cache type issues)

#### Cache typing issues
```typescript
// Ensure proper generic constraints
class UnifiedCacheManager<T extends Record<string, unknown>> {
  // Properly type cache operations
}
```

---

### File: `src/api/utils/unified-rate-limiter.ts`
**Errors**: 8
**Lines**: 630+ (rate limiter configuration)

#### Configuration type issues
```typescript
// Add proper typing for rate limiter config
interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  // ... other required fields
}
```

## Implementation Order

### Phase 1: Quick Fixes (1 hour)
1. Fix null → undefined conversions (nullish coalescing)
2. Fix Date → string conversions
3. Fix property name mismatches (description vs summary)

### Phase 2: Interface Alignment (2 hours)
1. Update MetadataDetails interface or usage
2. Align KapowarrAdapter interface with implementations
3. Fix return type mismatches

### Phase 3: Type Safety Improvements (2 hours)
1. Add proper type guards for provider validation
2. Fix selector typing in WebScraper
3. Improve cache and rate limiter typing

### Phase 4: Testing (1 hour)
1. Run type check after each phase
2. Ensure no regression
3. Run tests to verify functionality

## Key Patterns to Apply

### Pattern 1: Null to Undefined Conversion
```typescript
// Instead of direct assignment
field: value,

// Use nullish coalescing
field: value ?? undefined,
```

### Pattern 2: Date Handling
```typescript
// Type guard and convert
field: value instanceof Date ? value.toISOString() : value ?? undefined,
```

### Pattern 3: Property Alignment
```typescript
// Check interface definition and use correct property name
summary: value, // not description
```

### Pattern 4: Type Narrowing
```typescript
// Add type guards
if (isValidType(value)) {
  // Safe to use value
}
```

## Verification Commands

```bash
# Check specific files
pnpm tsc --noEmit src/api/metadataProviders/adapters/anilistAdapter.ts

# Check all errors
pnpm tsc --noEmit

# Count errors by file
pnpm tsc --noEmit 2>&1 | grep "error TS" | cut -d: -f1 | sort | uniq -c
```

## Notes

1. Many errors follow the same patterns across adapter files
2. The root cause is often API response types (null) vs our interface expectations (undefined)
3. Some interfaces may need updating to match actual usage
4. Consider creating shared utility functions for common conversions