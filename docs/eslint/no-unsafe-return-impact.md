# Dependency Impact Analysis: @typescript-eslint/no-unsafe-return Violations

*Status: Complete*
*Created: 2025-11-08*
*Agent: D (Impact Analysis)*
*Branch: `claude/scan-the-v-011CUv2HtFgy8JfFrLwAftDn`*

---

## Executive Summary

This document analyzes the dependency impact of fixing **250-350** `@typescript-eslint/no-unsafe-return` violations. It identifies high-impact files, public APIs requiring careful review, critical dependency chains, and provides a recommended fix order based on dependency analysis.

**Key Findings:**
- **26 files** import from `type-guards` (HIGH IMPACT)
- **20+ tRPC routers** are public APIs requiring careful review
- **3 SDK files** export public functions
- **Critical path**: type-guards → adapters → services → routers → SDK
- **Recommended approach**: Bottom-up (utilities first, then services, then routers)

---

## 1. High-Impact Utility Functions

These shared utilities are widely used across the codebase. Changes here ripple through many files.

### 1.1 Type Guards (`src/utils/type-guards/`)

**Impact Level:** 🔴 **CRITICAL** (26 imports)

**Files:**
- `src/utils/type-guards/generated.ts` (6,499 lines, **25-30 violations**)
- `src/utils/type-guards.ts`
- `src/utils/validation/type-guards.ts`

**Imported By:** 26 files across the codebase

**Common Patterns:**
```typescript
// ❌ UNSAFE - Typical violation
export function isAniListMedia(obj: unknown): obj is AniListMedia {
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate["id"] === 'number' &&
    // ... validation checks
  );
}
```

**Impact Assessment:**
- **Scope**: Used in services, routers, adapters, and components
- **Risk**: Medium - These are type guards (validators), not data transformers
- **Breaking Changes**: Low - Return types are boolean, internal casts can be fixed safely
- **Dependencies**: Imported by metadataMerger, routers, search contexts

**Recommended Fix Priority:** P1 (High) - Fix early to enable dependent fixes

**Dependency Chain:**
```
type-guards (26 imports)
  ├─> metadataMerger.ts
  ├─> manga.ts (router)
  ├─> metadata.ts (router)
  ├─> search contexts
  └─> various adapters
```

---

### 1.2 Search Result Adapter (`src/utils/search/searchResultAdapter.ts`)

**Impact Level:** 🟡 **MEDIUM** (3 imports)

**Files:**
- `src/utils/search/searchResultAdapter.ts` (361 lines, **estimated 8-12 violations**)

**Exported Functions:**
- `adaptSearchResults(results: unknown[]): SearchResult[]`
- `adaptSearchResult(result: unknown): SearchResult | null`

**Imported By:**
- `src/contexts/search/MainSearchContext.tsx`
- `src/contexts/search/ModalSearchContext.tsx`
- `src/contexts/search/UnifiedSearchContext.tsx`

**Common Violations:**
```typescript
// Line 39: unsafe cast after type guard
if (isValidSearchResultArray(results)) {
    return results as SearchResult[];  // VIOLATION
}

// Line 92: unsafe status cast
const status = extractStatus(obj) as MangaPublicationStatus | undefined;

// Line 232: unsafe array cast
if (Array.isArray(titles) && titles.every(t => typeof t === 'string')) {
    return titles as string[];  // VIOLATION
}
```

**Impact Assessment:**
- **Scope**: Search functionality (3 React contexts)
- **Risk**: Medium - Used in UI, affects search results display
- **Breaking Changes**: Low - Internal transformations, contexts handle undefined
- **Performance**: No impact expected

**Recommended Fix Priority:** P2 (Medium)

**Dependency Chain:**
```
searchResultAdapter
  ├─> MainSearchContext (UI)
  ├─> ModalSearchContext (UI)
  └─> UnifiedSearchContext (UI)
```

---

### 1.3 Frontend Type Adapters (`src/utils/frontend/type-adapters.ts`)

**Impact Level:** 🟡 **MEDIUM** (1 import)

**Files:**
- `src/utils/frontend/type-adapters.ts` (483 lines, **estimated 15-20 violations**)

**Exported Functions:**
- `adaptMangaSearchResult(result, source?): UnifiedSearchResult`
- `adaptSearchResult(result, source?): UnifiedSearchResult`
- `adaptToUnifiedSearchResult(result, source?): UnifiedSearchResult`

**Imported By:**
- `docs/migration/frontend-migration-plan.md` (documentation only)

**Common Violations:**
```typescript
// Line 74: metadata cast
const resultMetadata = result["metadata"] as Record<string, unknown> | undefined;

// Line 87: unsafe cast
...(result["deck"] ?? result["summary"] ? { summary: (result["deck"] ?? result["summary"]) as string } : {}),

// Line 91-93: nested unsafe casts
large: (result["coverLarge"] ?? resultMetadata?.["coverLarge"]) as string

// Line 173: any cast (CRITICAL)
name: typeof a === 'string' ? a : (a as any).name

// Line 314: multiple unsafe casts
return (r["cover"] ?? r["coverUrl"] ?? r["coverImage"] ?? metadata?.["cover"]) as string;
```

**Impact Assessment:**
- **Scope**: Frontend type conversions
- **Risk**: Low-Medium - Only referenced in migration docs, not actively imported
- **Breaking Changes**: Very Low - Not widely used
- **Refactoring Opportunity**: Consider consolidating with searchResultAdapter

**Recommended Fix Priority:** P3 (Low-Medium)

**Note:** This file may be deprecated or in migration. Verify usage before extensive refactoring.

---

### 1.4 Validation & Type Narrowing

**Files:**
- `src/utils/validation/type-narrowing.ts` (183 lines, **estimated 3-5 violations**)
- `src/utils/validation.ts`

**Impact Level:** 🟢 **LOW** (0-1 imports)

**Exported Functions:**
- `narrowType<T>(value, typeGuard): T | null`
- `narrowWithFallback<T, F>(value, typeGuard, fallback): T | F`
- `safeNarrow<T>(value, typeGuard): T | undefined`
- `narrowToString/Number/Boolean/Array/Record`
- `ensureType<T>(value, typeGuard, errorMessage): T`

**Common Violations:**
```typescript
// Line 135: array cast after validation
if (TypeGuards.isArray(value) && value.every(itemTypeGuard)) {
    return value as T[];  // VIOLATION
}

// Line 150: record cast after validation
if (TypeGuards.isObject(value) && Object.values(value).every(valueTypeGuard)) {
    return value as Record<string, T>;  // VIOLATION
}
```

**Impact Assessment:**
- **Scope**: Utility helpers for type narrowing
- **Risk**: Very Low - Self-contained utility
- **Breaking Changes**: None - Return types are already constrained by type parameters
- **Note**: These casts are actually SAFE after validation - may be false positives

**Recommended Fix Priority:** P3 (Low) - Quick wins, low risk

---

### 1.5 Error Handling Utilities

**Files:**
- `src/utils/error-handling.ts`
- `src/utils/async-result.ts`

**Impact Level:** 🟢 **LOW**

**Common Violations:**
- Type casts in error object property access
- Generic type returns without validation

**Recommended Fix Priority:** P3 (Low)

---

## 2. Type System Dependencies

These files define core types that are returned unsafely throughout the codebase.

### 2.1 Core Type Definition Files

**Location:** `src/types/`

**Key Files:**
- `src/types/search.types.ts` - Search result types
- `src/types/metadata-types.ts` - Metadata structures
- `src/types/api/manga-router-types.ts` - API types with type guards
- `src/types/provider-types.ts` - Provider configurations
- `src/types/config.types.ts` - Configuration types

**Impact Assessment:**
- **Type definitions themselves don't have violations** (interfaces/types)
- **Violations occur in functions that RETURN these types**
- **Dependencies:** Almost all files import from these

**Dependency Pattern:**
```
Type Definitions (src/types/)
  ↓
Type Guards (src/utils/type-guards/)
  ↓
Adapters (src/utils/*/adapters)
  ↓
Services (src/server/services/)
  ↓
Routers (src/server/trpc/routers/)
  ↓
SDK (src/sdk/)
```

**Recommended Approach:**
- Fix violations in type guards FIRST
- Then fix adapter functions that return these types
- Services and routers will become easier to fix

---

### 2.2 Files Depending on Type Definitions

**High Dependency Files:**

| File | Type Imports | Estimated Violations | Risk |
|------|-------------|---------------------|------|
| `type-guards/generated.ts` | 50+ types | 25-30 | 🔴 Critical |
| `searchResultAdapter.ts` | SearchResult, MangaSearchResult | 8-12 | 🟡 Medium |
| `frontend/type-adapters.ts` | Multiple search types | 15-20 | 🟡 Medium |
| `metadataMerger.ts` | MangaMetadata, UnifiedMangaMetadata | 15-20 | 🟠 High |
| `manga.ts` (router) | 20+ types | 20-25 | 🟠 High |

**Type Flow Example:**
```typescript
// Type Definition (no violations)
interface SearchResult {
  id: string;
  title: string;
  provider: string;
}

// Type Guard (VIOLATION HERE)
function isSearchResult(obj: unknown): obj is SearchResult {
  const candidate = obj as Record<string, unknown>;  // ✅ Safe
  return typeof candidate["id"] === 'string';
}

// Adapter (VIOLATION HERE)
function adaptResult(data: unknown): SearchResult {
  if (isSearchResult(data)) {
    return data as SearchResult;  // ❌ VIOLATION
  }
  return defaultResult;
}

// Service uses adapter (inherits safety)
async function searchManga(query: string): Promise<SearchResult[]> {
  const results = await api.search(query);
  return results.map(adaptResult);  // ✅ Safe if adapter is fixed
}
```

---

## 3. Breaking Change Risks

These are public APIs that must be handled carefully to avoid breaking changes.

### 3.1 tRPC Routers (Public APIs)

**Location:** `src/server/trpc/routers/`

**Total Routers:** 42 files, **20+ export routers**

**Routers with Type Casts:** 15 files

**Critical Routers:**

| Router | Lines | Est. Violations | Public Procedures | Risk |
|--------|-------|----------------|-------------------|------|
| `manga.ts` | 5,729 | 20-25 | ~50 procedures | 🔴 **CRITICAL** |
| `metadata.ts` | 3,727 | 18-22 | ~30 procedures | 🔴 **CRITICAL** |
| `search.ts` | ~1,500 | 10-15 | ~10 procedures | 🟠 High |
| `chapter.ts` | ~1,200 | 8-12 | ~20 procedures | 🟠 High |
| `library.ts` | ~1,000 | 8-12 | ~15 procedures | 🟠 High |

**Breaking Change Risks:**

1. **Return Type Changes**
   - tRPC procedures have implicit return types
   - Changing return type = API contract change
   - **Mitigation:** Use type narrowing INSIDE procedures, keep return types same

2. **Client-Side Impact**
   - Frontend uses tRPC client with type inference
   - Type changes propagate to all client calls
   - **Mitigation:** Fix routers AFTER utilities are fixed

3. **Example Safe Fix:**
```typescript
// ❌ BEFORE (UNSAFE)
async getManga(id: number): Promise<Manga> {
  const data = await fetchManga(id);
  return data as Manga;  // VIOLATION
}

// ✅ AFTER (SAFE) - Return type unchanged, internal validation added
async getManga(id: number): Promise<Manga> {
  const data = await fetchManga(id);
  
  // Validate with type guard
  if (!isManga(data)) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Invalid manga data' });
  }
  
  return data;  // Now safely narrowed
}
```

**Recommended Fix Priority:** P1 (High) - But fix AFTER utilities

**Fix Order for Routers:**
1. Fix utility functions first (type guards, adapters)
2. Fix service methods (metadata, search)
3. Fix low-traffic routers (test fixes)
4. Fix high-traffic routers (manga, metadata, search)

---

### 3.2 SDK (src/sdk/)

**Location:** `src/sdk/`

**Files:**
- `kaizoku-api-sdk.ts` (SDK class)
- `examples/*.ts` (usage examples)

**Public Exports:** 3 main exports

**Breaking Change Risk:** 🟡 **MEDIUM**

**Analysis:**
- SDK is a **public interface** for external consumers
- Breaking changes here affect users outside the codebase
- Must maintain **backward compatibility**

**Current Violations:**
```typescript
// Line 8-10: Type guard (safe pattern)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Likely violations in response parsing methods
```

**Impact Assessment:**
- **External Users:** Unknown (could be 0 or many)
- **Risk Level:** Medium - Public API
- **Versioning:** May require minor version bump if return types change

**Recommended Approach:**
- **DO NOT** change public method signatures
- **DO** add internal validation
- **DO** improve error messages
- **CONSIDER** deprecation path if major changes needed

**Recommended Fix Priority:** P1 (High) - Manual review required

---

### 3.3 Exported Service Classes

**High-Risk Exports:**

| Service | Export Type | Imports | Risk | Violations |
|---------|------------|---------|------|-----------|
| `metadataMergerService` | Singleton | 3 files | 🟠 High | 15-20 |
| `MetadataMergerService` | Class | N/A | 🟠 High | 15-20 |
| `DownloadManager` | Class | Multiple | 🟡 Medium | 5-10 |
| `FileImporter` | Class | Multiple | 🟡 Medium | 5-10 |

**Breaking Change Considerations:**

1. **metadataMergerService (Singleton)**
   - Used in `manga.ts`, `metadata.ts` routers
   - Service methods called from multiple routers
   - **Risk:** Changes to method signatures break routers
   - **Mitigation:** Keep public method signatures, fix internals

2. **Example Safe Fix:**
```typescript
// ❌ BEFORE (UNSAFE)
class MetadataMergerService {
  public extractTitle(data: unknown): string {
    const obj = data as Record<string, unknown>;
    return obj["title"] as string;  // VIOLATION
  }
}

// ✅ AFTER (SAFE) - Public signature unchanged
class MetadataMergerService {
  public extractTitle(data: unknown): string {
    // Internal validation added
    if (!data || typeof data !== 'object') {
      return '';
    }
    
    const obj = data as Record<string, unknown>;
    const title = obj["title"];
    
    // Type narrowing instead of cast
    if (typeof title === 'string') {
      return title;
    }
    
    return '';
  }
}
```

**Recommended Fix Priority:** P1 (High)

---

## 4. Dependency Graphs

### 4.1 High-Impact Files (Changing these affects many files)

```
┌─────────────────────────────────────────────────────┐
│ TIER 1: CRITICAL IMPACT (20+ dependencies)         │
└─────────────────────────────────────────────────────┘

type-guards/generated.ts (6,499 lines, 25-30 violations)
  ├─> Imported by: 26 files
  ├─> Used in: routers, services, adapters, components
  └─> Impact: 🔴 CRITICAL - Core type validation

┌─────────────────────────────────────────────────────┐
│ TIER 2: HIGH IMPACT (10-20 dependencies)           │
└─────────────────────────────────────────────────────┘

metadataMerger.ts (2,818 lines, 15-20 violations)
  ├─> Imported by: manga.ts, metadata.ts, search routers
  ├─> Used in: metadata operations, manga enrichment
  └─> Impact: 🟠 HIGH - Core metadata service

manga.ts router (5,729 lines, 20-25 violations)
  ├─> Public API: ~50 tRPC procedures
  ├─> Used by: Frontend, SDK, external consumers
  └─> Impact: 🔴 CRITICAL - Primary API endpoint

metadata.ts router (3,727 lines, 18-22 violations)
  ├─> Public API: ~30 tRPC procedures
  ├─> Used by: Frontend, manga detail pages
  └─> Impact: 🔴 CRITICAL - Metadata operations

┌─────────────────────────────────────────────────────┐
│ TIER 3: MEDIUM IMPACT (3-10 dependencies)          │
└─────────────────────────────────────────────────────┘

searchResultAdapter.ts (361 lines, 8-12 violations)
  ├─> Imported by: 3 search contexts
  ├─> Used in: Search UI components
  └─> Impact: 🟡 MEDIUM - Search functionality

frontend/type-adapters.ts (483 lines, 15-20 violations)
  ├─> Imported by: 1 migration doc
  ├─> Used in: Minimal (possibly deprecated)
  └─> Impact: 🟢 LOW - Limited usage

┌─────────────────────────────────────────────────────┐
│ TIER 4: LOW IMPACT (0-3 dependencies)              │
└─────────────────────────────────────────────────────┘

validation/type-narrowing.ts (183 lines, 3-5 violations)
  ├─> Imported by: 0-1 files
  ├─> Used in: Utility functions
  └─> Impact: 🟢 LOW - Isolated utility

Individual adapters, parsers, helpers
  └─> Impact: 🟢 LOW - Isolated changes
```

---

### 4.2 Low-Impact Files (Isolated changes, safe to fix)

**Categories:**

1. **Test Files**
   - `src/**/__tests__/*.test.ts`
   - Impact: None (not imported by production code)

2. **Example Files**
   - `src/sdk/examples/*.ts`
   - Impact: Very Low (documentation)

3. **Individual Parsers**
   - `src/server/services/fandom/*.ts`
   - `src/server/services/wikipedia/*.ts`
   - Impact: Low (used only by parent service)

4. **Utility Helpers**
   - `src/utils/error-helpers.ts`
   - `src/utils/property-guards.ts`
   - Impact: Low (1-2 imports)

**Recommended as Wave 1 Targets:** These are safe, low-risk quick wins.

---

### 4.3 Critical Dependency Paths

**Path 1: Search Flow**
```
user search query
  ↓
search.ts (router) [18-22 violations]
  ↓
ProwlarrMangaSearch (service)
  ↓
searchResultAdapter.ts [8-12 violations]
  ↓
type-guards/generated.ts [25-30 violations]
  ↓
SearchResult type (safe)
```

**Fix Order:** type-guards → searchResultAdapter → search service → search router

---

**Path 2: Metadata Flow**
```
manga metadata request
  ↓
metadata.ts (router) [18-22 violations]
  ↓
metadataMergerService [15-20 violations]
  ↓
provider-fetcher (service)
  ↓
type-guards [25-30 violations]
  ↓
MangaMetadata type (safe)
```

**Fix Order:** type-guards → provider services → metadataMerger → metadata router

---

**Path 3: Manga Operations**
```
manga CRUD operation
  ↓
manga.ts (router) [20-25 violations]
  ↓
metadataMergerService [15-20 violations]
  ↓
searchResultAdapter [8-12 violations]
  ↓
type-guards [25-30 violations]
  ↓
Manga type (safe)
```

**Fix Order:** type-guards → adapters → metadataMerger → manga router

---

**Path 4: SDK Usage (External)**
```
external SDK user
  ↓
kaizoku-api-sdk.ts [estimated 5-8 violations]
  ↓
tRPC client
  ↓
manga.ts / metadata.ts routers
```

**Fix Order:** routers → SDK wrapper

---

## 5. Recommended Fix Order

Based on dependency analysis, here's the optimal fix order to minimize breaking changes and maximize parallel work.

### 5.1 Wave-Based Approach

```
┌─────────────────────────────────────────────────────┐
│ WAVE 0: Foundation (Prerequisite)                   │
│ Duration: 0.5 day | Risk: 🟢 LOW                   │
└─────────────────────────────────────────────────────┘

Goal: Create reusable type safety utilities

Tasks:
1. Create src/utils/type-guards/safe-access.ts
   - getStringProperty()
   - getNumberProperty()
   - getArrayProperty()
   - getProperty<T>(validator)
   
2. Create tests for safe-access utilities

3. Document patterns in no-unsafe-return-patterns.md

Deliverable: Type safety utility library ready for use

┌─────────────────────────────────────────────────────┐
│ WAVE 1: Utilities & Type Guards (Bottom-Up)        │
│ Duration: 2 days | Risk: 🟢 LOW | Parallel: 4      │
└─────────────────────────────────────────────────────┘

Priority Order:

1.1 Type Guards (P0 - CRITICAL PATH)
    - type-guards/generated.ts [25-30 violations]
    - type-guards.ts [5-10 violations]
    - validation/type-guards.ts [3-5 violations]
    
    Impact: Unblocks all dependent files
    Agents: 2 agents (batches of 10-15)

1.2 Validation Utilities (P3 - LOW RISK)
    - validation/type-narrowing.ts [3-5 violations]
    - error-handling.ts [3-5 violations]
    
    Impact: Isolated utilities
    Agents: 1 agent (batch of 8-10)

1.3 Small Adapters (P3 - LOW RISK)
    - Individual helper files [1-3 violations each]
    - Property guards, validators
    
    Impact: Quick wins
    Agents: 1 agent (batch of 20-25)

Success Criteria:
✅ 40-50 violations fixed
✅ All type-guards fixed (critical path clear)
✅ Type safety utilities tested and documented

┌─────────────────────────────────────────────────────┐
│ WAVE 2: Adapters & Transformers (Middle Layer)     │
│ Duration: 2 days | Risk: 🟡 MEDIUM | Parallel: 3   │
└─────────────────────────────────────────────────────┘

Priority Order:

2.1 Search Adapters (P2 - MEDIUM)
    - searchResultAdapter.ts [8-12 violations]
    - frontend/type-adapters.ts [15-20 violations]
    
    Impact: Search functionality
    Agents: 1 agent (batch of 12-15)

2.2 Parser & Extractor Functions (P2-P3)
    - Fandom parsers [5-10 violations each]
    - Wikipedia parsers [5-10 violations each]
    - Metadata extractors [3-8 violations each]
    
    Impact: Metadata extraction
    Agents: 2 agents (batches of 10-15)

2.3 Download & File Utilities (P3)
    - Download utilities [3-5 violations each]
    - File importers [5-8 violations]
    
    Impact: Download system
    Agents: 1 agent (batch of 10-15)

Success Criteria:
✅ 80-100 violations fixed
✅ All adapters fixed (services unblocked)
✅ 50-60% total progress

┌─────────────────────────────────────────────────────┐
│ WAVE 3: Services (Business Logic)                  │
│ Duration: 2 days | Risk: 🟠 HIGH | Parallel: 2     │
└─────────────────────────────────────────────────────┘

Priority Order:

3.1 Metadata Services (P1 - CRITICAL)
    - metadataMerger.ts [15-20 violations]
    - provider-fetcher.ts [5-10 violations]
    - metadata-persister.ts [3-5 violations]
    - chapter-enricher.ts [3-5 violations]
    
    Impact: Core metadata operations
    Agents: 1 agent (batches of 8-10)
    Note: Manual review for metadataMerger

3.2 Download Services (P2 - MEDIUM)
    - downloadManager.ts [5-10 violations]
    - fileImporter.ts [5-10 violations]
    - volumeSplitter.ts [3-5 violations]
    
    Impact: Download operations
    Agents: 1 agent (batch of 10-15)

3.3 Other Services (P2-P3)
    - Fandom/Wikipedia services [8-12 violations each]
    - Config services [5-8 violations]
    
    Impact: Various subsystems
    Agents: 1 agent (batch of 10-15)

Success Criteria:
✅ 40-60 violations fixed
✅ All service methods validated
✅ 75-85% total progress

┌─────────────────────────────────────────────────────┐
│ WAVE 4: Routers & Public APIs (Top Layer)          │
│ Duration: 2 days | Risk: 🔴 CRITICAL | Parallel: 2 │
└─────────────────────────────────────────────────────┘

Priority Order:

4.1 Low-Traffic Routers (P2 - TEST)
    - settings.ts, config.ts, health.ts [3-5 violations each]
    - Purpose: Test router fix patterns
    
    Agents: 1 agent (batch of 5-8)

4.2 Medium-Traffic Routers (P1)
    - search.ts [10-15 violations]
    - chapter.ts [8-12 violations]
    - library.ts [8-12 violations]
    
    Agents: 1 agent (batches of 5-8)

4.3 High-Traffic Routers (P0 - CRITICAL)
    - manga.ts [20-25 violations]
    - metadata.ts [18-22 violations]
    
    Agents: 1 agent (batches of 5-8)
    Note: **Manual review REQUIRED** for each batch

Success Criteria:
✅ 50-70 violations fixed
✅ All router procedures validated
✅ No breaking changes to API contracts
✅ 90-95% total progress

┌─────────────────────────────────────────────────────┐
│ WAVE 5: SDK & External APIs (Final)                │
│ Duration: 0.5 day | Risk: 🔴 CRITICAL | Parallel: 1│
└─────────────────────────────────────────────────────┘

Priority Order:

5.1 SDK Core (P0 - BREAKING CHANGE RISK)
    - kaizoku-api-sdk.ts [5-8 violations]
    
    Process:
    - Deep analysis of each violation
    - Propose multiple fix approaches
    - **Human approval required**
    - Implement with tests
    - Update SDK documentation
    
    Agents: 1 agent + human reviewer

5.2 SDK Examples (P3 - LOW RISK)
    - examples/*.ts [1-3 violations each]
    
    Agents: Same agent (quick batch)

Success Criteria:
✅ All SDK violations fixed
✅ Backward compatibility maintained
✅ SDK version documented
✅ 95-100% total progress

┌─────────────────────────────────────────────────────┐
│ POST-WAVES: Exceptions & Documentation             │
│ Duration: 0.5 day                                   │
└─────────────────────────────────────────────────────┘

Tasks:
1. Document any remaining violations in no-unsafe-return-exceptions.md
2. Update comprehensive plan with actual results
3. Create final validation report
4. Update CHANGELOG.md
```

---

### 5.2 Parallel Execution Strategy

**Wave 1:** 4 agents working simultaneously
```
Agent A: type-guards/generated.ts (Batch 1: lines 1-2000)
Agent B: type-guards/generated.ts (Batch 2: lines 2001-4000)  
Agent C: type-guards/generated.ts (Batch 3: lines 4001-6499)
Agent D: validation utilities + small helpers
```

**Wave 2:** 3 agents working simultaneously
```
Agent A: searchResultAdapter + frontend/type-adapters
Agent B: Fandom & Wikipedia parsers
Agent C: Download & file utilities
```

**Wave 3:** 2 agents working simultaneously
```
Agent A: metadataMerger + metadata services
Agent B: Download services + other services
```

**Wave 4:** 2 agents working simultaneously (with coordination)
```
Agent A: Low/medium traffic routers
Agent B: High-traffic routers (slower, manual review per batch)
```

**Wave 5:** 1 agent + human collaboration
```
Agent: SDK (human reviews each violation)
```

---

### 5.3 Critical Path

The **critical path** determines the minimum time to complete:

```
Critical Path (Sequential Dependencies):

Day 1-2: type-guards [MUST COMPLETE FIRST]
  ↓
Day 3-4: searchResultAdapter, metadataServices [DEPENDS ON type-guards]
  ↓
Day 5-6: metadata.ts router, manga.ts router [DEPENDS ON services]
  ↓
Day 7: SDK [DEPENDS ON routers]

Total Critical Path: 7 days
```

**Optimization:**
- Parallel work on non-dependent files (parsers, utilities)
- Can reduce wall-clock time by 2-3 days
- Target: 5-7 days with parallel execution

---

## 6. Risk Mitigation Strategies

### 6.1 Breaking Change Prevention

**Strategy 1: Return Type Preservation**
```typescript
// ❌ DON'T: Change return type
- function getData(): string
+ function getData(): string | undefined

// ✅ DO: Keep return type, throw on invalid data
function getData(): string {
  const data = fetchData();
  
  if (typeof data !== 'string') {
    throw new ValidationError('Invalid data type');
  }
  
  return data;
}
```

**Strategy 2: Internal Validation**
```typescript
// ✅ Add validation inside function, return type unchanged
async function getManga(id: number): Promise<Manga> {
  const data = await fetchManga(id);
  
  // Internal validation
  if (!isManga(data)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Invalid manga data structure'
    });
  }
  
  return data;  // Return type unchanged
}
```

**Strategy 3: Backward Compatible Overloads**
```typescript
// If return type MUST change, use overloads
function getManga(id: number): Manga;
function getManga(id: number, safe: true): Manga | undefined;
function getManga(id: number, safe?: boolean): Manga | undefined {
  // Implementation
}
```

---

### 6.2 Dependency Management

**Rule 1: Fix Dependencies First**
- Always fix utilities before services
- Always fix services before routers
- Never create circular dependencies

**Rule 2: Batch by Dependency Level**
- Group files by "distance from types"
- Fix lower layers first
- Test each layer before moving up

**Rule 3: Parallel Work Coordination**
- Use file locking in coordinator agent
- Agents never work on same file
- Agents never work on dependent files simultaneously

---

### 6.3 Testing Strategy

**Per Wave:**

**Wave 1-2:** Type-check + Lint
```bash
bun run type-check
bun run lint
```

**Wave 3:** Affected Tests
```bash
bun test --related src/server/services/metadataMerger.ts
```

**Wave 4:** Full Test Suite
```bash
bun test
```

**Wave 5:** Manual Integration Testing
- SDK usage examples
- Real API calls
- Error scenarios

---

## 7. High-Impact Files Reference

### Quick Reference Table

| File | Lines | Violations | Imports | Risk | Wave | Priority |
|------|-------|-----------|---------|------|------|----------|
| `type-guards/generated.ts` | 6,499 | 25-30 | 26 | 🔴 Critical | 1 | P0 |
| `manga.ts` (router) | 5,729 | 20-25 | N/A | 🔴 Critical | 4 | P0 |
| `metadata.ts` (router) | 3,727 | 18-22 | N/A | 🔴 Critical | 4 | P0 |
| `metadataMerger.ts` | 2,818 | 15-20 | 3 | 🟠 High | 3 | P1 |
| `frontend/type-adapters.ts` | 483 | 15-20 | 1 | 🟡 Medium | 2 | P2 |
| `searchResultAdapter.ts` | 361 | 8-12 | 3 | 🟡 Medium | 2 | P2 |
| `validation/type-narrowing.ts` | 183 | 3-5 | 0-1 | 🟢 Low | 1 | P3 |
| `kaizoku-api-sdk.ts` | ~500 | 5-8 | N/A | 🔴 Critical | 5 | P0 |

---

## 8. Key Decisions & Rationales

### Decision 1: Bottom-Up Fix Order

**Rationale:**
- Utilities are imported by 26+ files
- Fixing utilities first reduces violations in dependent files
- Allows parallel work on independent files
- Minimizes breaking changes by fixing foundation first

**Alternative Considered:** Top-down (routers first)
**Why Rejected:** Would require fixing same patterns repeatedly in utilities

---

### Decision 2: Separate Wave for SDK

**Rationale:**
- SDK is external-facing public API
- Breaking changes affect users outside our control
- Requires careful human review for each violation
- Cannot be parallelized effectively

**Alternative Considered:** Include in Wave 4 with routers
**Why Rejected:** SDK needs more careful review than routers

---

### Decision 3: Batch Sizes by Risk Level

**Rationale:**
- Low risk: 20-25 violations per batch (faster)
- Medium risk: 10-15 violations per batch (balanced)
- High risk: 5-8 violations per batch (careful)
- Critical: 1-3 violations per batch (very careful)

**Alternative Considered:** Fixed batch size of 10
**Why Rejected:** Wastes time on low-risk, rushes high-risk

---

### Decision 4: Manual Review for Critical Files

**Required for:**
- manga.ts router (5,729 lines)
- metadata.ts router (3,727 lines)
- metadataMerger.ts (2,818 lines)
- kaizoku-api-sdk.ts (external API)

**Rationale:**
- These files are critical infrastructure
- Changes affect many consumers
- Errors could cause production issues
- Worth the extra time for safety

---

## 9. Success Metrics

### Quantitative Metrics

- **Violations Fixed:** 225+ out of 250 (90%+)
- **Files Changed:** 70-100 files
- **Test Coverage:** 100% of changed files
- **Breaking Changes:** 0
- **New TypeScript Errors:** 0
- **Regressions:** 0

### Qualitative Metrics

- **Type Safety:** Improved (more runtime validation)
- **Maintainability:** Improved (clearer type handling)
- **Code Quality:** Improved (fewer unsafe casts)
- **Documentation:** Comprehensive (patterns documented)

### Per-Wave Metrics

| Wave | Target Fixes | Expected % | Risk Level | Rollback Risk |
|------|-------------|-----------|-----------|--------------|
| Wave 1 | 120-155 | 35-45% | 🟢 Low | Very Low |
| Wave 2 | 80-120 | 65-75% | 🟡 Medium | Low |
| Wave 3 | 40-60 | 85-90% | 🟠 High | Medium |
| Wave 4 | 50-70 | 95-100% | 🔴 Critical | High |
| Wave 5 | 5-10 | 100% | 🔴 Critical | High |

---

## 10. Coordination with Other Agents

### Agent Deliverables

This analysis (Agent D) complements:

**Agent A** (Tier 1 Analysis):
- Provides detailed analysis of top 5 critical files
- Uses dependency info from this document

**Agent B** (Tier 2 Analysis):
- Analyzes files 6-20
- Uses impact ratings from this document

**Agent C** (Pattern Analysis):
- Identifies common fix patterns
- Uses file categorization from this document

**Coordinator Agent:**
- Uses fix order recommendations
- Uses parallel execution strategy
- Uses risk assessments for batch assignments

---

## 11. Appendix: Dependency Import Counts

### Complete Import Analysis

```bash
# Type guards (HIGH IMPACT)
from '@/utils/type-guards': 26 imports

# Adapters (MEDIUM IMPACT)
from '@/utils/search/searchResultAdapter': 3 imports
from '@/utils/frontend/type-adapters': 1 import

# Services (MEDIUM IMPACT)
from '@/server/services/metadataMerger': 3 imports

# Validation (LOW IMPACT)
from '@/utils/validation/type-narrowing': 0-1 imports
from '@/utils/validation': 2-3 imports
```

### Router Export Analysis

```bash
# Total routers exporting public APIs: 20+
# Routers with type casts: 15
# Estimated violations in routers: 100-150

High-traffic routers:
- manga.ts: 20-25 violations
- metadata.ts: 18-22 violations
- search.ts: 10-15 violations
- chapter.ts: 8-12 violations
- library.ts: 8-12 violations
```

---

## 12. Final Recommendations

### Immediate Actions (Before Wave 1)

1. ✅ Create `src/utils/type-guards/safe-access.ts` utility file
2. ✅ Set up file locking registry for coordinator
3. ✅ Prepare validation scripts for automated testing
4. ✅ Review and approve this impact analysis

### During Execution

1. ✅ Follow fix order strictly (utilities → services → routers → SDK)
2. ✅ Run validation after EVERY batch
3. ✅ Document any unexpected issues
4. ✅ Coordinate parallel agents to avoid conflicts
5. ✅ Manual review for all P0 (critical) files

### After Completion

1. ✅ Update no-unsafe-return-progress.md with final results
2. ✅ Document remaining exceptions (if any)
3. ✅ Update type system architecture docs
4. ✅ Consider stricter ESLint rules to prevent regressions

---

## 13. Conclusion

**Summary:**

This impact analysis identified:
- **26-import dependency** on type-guards (highest impact)
- **20+ public tRPC routers** requiring careful review
- **Critical path**: 7 days sequential, 5-7 days with parallelization
- **Recommended approach**: Bottom-up (utilities first)
- **Risk level**: LOW-MEDIUM with proper mitigation

**Key Insight:**

The dependency structure naturally suggests a **layered fix approach**:
1. Foundation (type guards, utilities) - Wave 1-2
2. Business logic (services) - Wave 3
3. Public APIs (routers, SDK) - Wave 4-5

This approach:
- ✅ Minimizes breaking changes
- ✅ Enables parallel execution
- ✅ Reduces total work (fix once, benefits propagate up)
- ✅ Provides clear rollback points per wave

**Next Steps:**

1. Approve this impact analysis
2. Review complementary analyses from Agents A, B, C
3. Finalize comprehensive plan
4. Launch Wave 1 execution

---

*Analysis Complete*
*Agent D: Impact Analysis*
*Ready for Coordinator Review*
*2025-11-08*
