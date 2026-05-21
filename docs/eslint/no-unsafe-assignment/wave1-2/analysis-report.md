# Wave 1-2 Analysis Report: @typescript-eslint/no-unsafe-assignment

**Status:** Analysis Complete
**Date:** 2025-11-08
**Analyzer:** Analyzer-A
**Target:** Low and Medium-Risk Violations (Waves 1-2)

---

## Executive Summary

### Total Violations Analyzed: 1,834

| Pattern Type | Occurrences | Files | Risk Level | Wave |
|-------------|-------------|-------|------------|------|
| **as any casts** | 1,251 | 333 | Medium | 2 |
| **Double casts (as unknown as)** | 304 | 113 | Low | 1 |
| **Explicit any declarations** | 223 | 97 | Medium | 2 |
| **Object.assign** | 56 | 36 | Low | 1 |

### Distribution by Category

- **Type assertions/casts:** 1,555 violations (85%)
- **Type declarations:** 223 violations (12%)
- **Object mutations:** 56 violations (3%)

---

## Pattern 1: Double Casts (as unknown as)

### Overview
- **Occurrences:** 304
- **Files Affected:** 113
- **Risk Level:** Low
- **Wave:** 1

### Characteristics

Double casts follow the pattern `expr as unknown as T`, creating a two-step type assertion through `unknown`. This is a TypeScript escape hatch when direct casting is not allowed.

### Common Contexts

#### 1. Error Type Coercion (45% of violations)
**Location:** `src/utils/async-result.ts`, error handling utilities
**Pattern:**
```typescript
error as unknown as E
new Error(String(error)) as unknown as E
```

**Example:**
```typescript
// Line 137-138: src/utils/async-result.ts
error as unknown as E :
new Error(`Error in mapAsyncResult: ${String(error)}`) as unknown as E);
```

#### 2. Generic Type Coercion (30% of violations)
**Location:** AsyncResult data extraction, generic transformations
**Pattern:**
```typescript
result as unknown as AsyncResult<T, E>
data as unknown as Record<string, unknown>
```

**Example:**
```typescript
// Line 525: src/utils/async-result.ts
return result as unknown as AsyncResult<T, ContextualError>;
```

#### 3. Component Props Casting (15% of violations)
**Location:** React components, prop passing
**Pattern:**
```typescript
manga as unknown as MangaWithRelations
state as unknown as UIStateAndActions
```

**Example:**
```typescript
// Line 412: src/components/manga/MobileChapterList.tsx
<BulkDownloadModal manga={manga as unknown as MangaWithRelations} />
```

#### 4. API Response Transformation (10% of violations)
**Location:** API routes, data fetching
**Pattern:**
```typescript
req as unknown as Record<string, unknown>
session as unknown as ExtendedSession
```

**Example:**
```typescript
// Line 173: src/lib/auth/config.ts
const extendedSession = session as unknown as ExtendedSession;
```

### Top Files by Violation Count

| File | Count | Primary Context |
|------|-------|-----------------|
| `src/utils/async-result.ts` | 22 | Error handling, generic transformations |
| `src/components/updateManga/ProviderSelectionForm.tsx` | 7 | Metadata extraction, status objects |
| `src/components/settings/kapowarr/EditKapowarrSourceModal.tsx` | 7 | Selector mapping, config objects |
| `src/components/addManga/UniversalImportWizard.tsx` | 6 | Volume data transformations |
| `src/components/settings/kapowarr/AddKapowarrSource.tsx` | 6 | Provider configuration |
| `src/components/addManga/services/sourceManagementService.ts` | 6 | Cover URL extraction |

### Fix Strategy

#### Approach: Type Guards + Proper Type Definitions

**Before:**
```typescript
error as unknown as E
```

**After:**
```typescript
function toErrorType<E extends Error>(error: unknown): E {
  if (error instanceof Error) {
    return error as E;
  }
  return new Error(String(error)) as E;
}
```

**Before:**
```typescript
manga as unknown as MangaWithRelations
```

**After:**
```typescript
import { isMangaWithRelations } from '@/utils/type-guards';

if (!isMangaWithRelations(manga)) {
  throw new ValidationError('Invalid manga format');
}
// manga is now typed correctly
```

### Batching Strategy

**Total Batches: 8 (Batch 1.1.x)**

- **Batch 1.1.1** (14 files): `src/utils/` - Error handling utilities
- **Batch 1.1.2** (15 files): `src/components/addManga/` - Add manga wizards
- **Batch 1.1.3** (15 files): `src/components/settings/` - Settings forms
- **Batch 1.1.4** (14 files): `src/components/manga/` - Manga components
- **Batch 1.1.5** (14 files): `src/hooks/` - Custom hooks
- **Batch 1.1.6** (14 files): `src/components/updateManga/` + `src/components/library/` - Update & library
- **Batch 1.1.7** (14 files): `src/pages/` - Page components
- **Batch 1.1.8** (13 files): `src/lib/`, `src/store/`, remaining files

---

## Pattern 2: as any Casts

### Overview
- **Occurrences:** 1,251
- **Files Affected:** 333
- **Risk Level:** Medium
- **Wave:** 2

### Characteristics

Direct `as any` casts bypass all type checking. This is the most common and riskiest pattern in the codebase.

### Common Contexts

#### 1. Property Access on Dynamic Objects (35% of violations)
**Location:** Metadata extraction, provider data access
**Pattern:**
```typescript
(metadata as any).field
(providerMeta as any)[provider]
(obj as any).dynamicProperty
```

**Example:**
```typescript
// Lines 650-656: src/pages/manga/[id].tsx
const description = (providerMeta as any)[selectedSources["description"]]?.descriptions?.main;
synopsis = (providerMeta as any)[selectedSources["description"]]?.descriptions?.synopsis;
plot = (providerMeta as any)[selectedSources["description"]]?.descriptions?.plot;
```

#### 2. AsyncResult/Query Data Extraction (20% of violations)
**Location:** tRPC routers, API handlers
**Pattern:**
```typescript
(result as any).data
(result.data as any)
isSuccess(result as any)
```

**Example:**
```typescript
// Lines 2524-2525: src/server/trpc/routers/metadata.ts
if (isSuccess(result as any) && (result as any).data) {
  const manga = (result as any).data as any;
```

#### 3. Browser API Vendor Prefixing (15% of violations)
**Location:** Mobile/PWA utilities, orientation handling
**Pattern:**
```typescript
(screen as any).orientation
(elem as any).webkitRequestFullscreen
(document as any).webkitExitFullscreen
```

**Example:**
```typescript
// Lines 66-73: src/utils/mobile/orientation.ts
else if ((elem as any).webkitRequestFullscreen) {
  await (elem as any).webkitRequestFullscreen();
}
else if ((elem as any).mozRequestFullScreen) {
  await (elem as any).mozRequestFullScreen();
}
```

#### 4. Settings/Config Access (10% of violations)
**Location:** Component settings checks, feature flags
**Pattern:**
```typescript
(settings.data as any)?.transmission?.enabled
(settings as any).type === 'komga'
```

**Example:**
```typescript
// Line 134: src/components/manga/ChapterDetailModal.tsx
if (settings && isSuccess(settings) && (settings.data as any)?.transmission?.enabled) {
```

#### 5. Type Enum Assertions (10% of violations)
**Location:** Status fields, enum-like values
**Pattern:**
```typescript
'PENDING' as any
interval: 'daily' as any
status: value as any
```

**Example:**
```typescript
// Lines 361-362: src/pages/manga/[id].tsx
fileStatus: 'PENDING' as any,
libraryStatus: 'ACTIVE' as any,
```

#### 6. Mutation/Hook Type Workarounds (5% of violations)
**Location:** Hook compositions, mock functions
**Pattern:**
```typescript
fetchAnilistMutation as any
useQuery: (_params?: any) => ({})
```

**Example:**
```typescript
// Lines 1261-1263: src/components/addManga/UniversalImportWizard.tsx
fetchAnilistMutation: fetchAnilistMutation as any,
fetchFandomMutation: fetchFandomMutation as any,
parseFandomUrlMutation: parseFandomUrlMutation as any,
```

#### 7. Test Mocks/Utilities (5% of violations)
**Location:** Test setup, mocking
**Pattern:**
```typescript
(useRouter as any).mockReturnValue({})
(window as any).__mobileToast
```

**Example:**
```typescript
// Line 36: src/components/mobile/__tests__/MobileNavigationDrawer.test.tsx
(useRouter as any).mockReturnValue({ pathname: '/' });
```

### Top Files by Violation Count

| File | Count | Primary Context |
|------|-------|-----------------|
| `src/pages/manga/[id].tsx` | 32 | Metadata access, provider data |
| `src/utils/mobile/orientation.ts` | 31 | Browser API vendor prefixes |
| `src/server/trpc/routers/metadata.ts` | 24 | AsyncResult extraction, type coercion |
| `src/server/trpc/routers/search.ts` | 20 | Search result processing |
| `src/server/trpc/routers/manga.ts` | 18 | Manga data manipulation |
| `src/server/queue/calendar/CalendarSyncScheduler.ts` | 17 | Job scheduling |
| `src/server/parsers/__tests__/CachedUnifiedParser.integration.test.ts` | 16 | Test mocks |
| `src/utils/mobile/__tests__/native-bridge.test.ts` | 16 | Test mocks |

### Fix Strategy

#### Approach 1: Define Proper Types

**Before:**
```typescript
const description = (providerMeta as any)[provider]?.descriptions?.main;
```

**After:**
```typescript
interface ProviderMetadata {
  [provider: string]: {
    descriptions?: {
      main?: string;
      synopsis?: string;
      plot?: string;
    };
  };
}

function isProviderMetadata(obj: unknown): obj is ProviderMetadata {
  return typeof obj === 'object' && obj !== null;
}

if (isProviderMetadata(providerMeta)) {
  const description = providerMeta[provider]?.descriptions?.main;
}
```

#### Approach 2: Type Guards for AsyncResult

**Before:**
```typescript
if (isSuccess(result as any) && (result as any).data) {
  const manga = (result as any).data as any;
}
```

**After:**
```typescript
import { isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

if (isSuccess(result)) {
  const manga = result.data; // Already typed correctly
}
```

#### Approach 3: Browser API Type Augmentation

**Before:**
```typescript
if ((elem as any).webkitRequestFullscreen) {
  await (elem as any).webkitRequestFullscreen();
}
```

**After:**
```typescript
// src/types/browser-apis.d.ts
interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

// Usage
if (elem.webkitRequestFullscreen) {
  await elem.webkitRequestFullscreen();
}
```

#### Approach 4: Proper Enum Types

**Before:**
```typescript
fileStatus: 'PENDING' as any,
libraryStatus: 'ACTIVE' as any,
```

**After:**
```typescript
import { FileStatus, LibraryStatus } from '@prisma/client';

fileStatus: FileStatus.PENDING,
libraryStatus: LibraryStatus.ACTIVE,
```

### Batching Strategy

**Total Batches: 23 (Batch 2.1.x)**

Given 333 files with 1,251 violations, batches of ~40-50 files each:

- **Batch 2.1.1** (40 files): `src/pages/` - Page components
- **Batch 2.1.2** (40 files): `src/components/manga/` - Manga components
- **Batch 2.1.3** (40 files): `src/components/addManga/` - Add manga wizards
- **Batch 2.1.4** (40 files): `src/components/library/` + `src/components/settings/` - Library & settings
- **Batch 2.1.5** (40 files): `src/server/trpc/routers/` - tRPC routers
- **Batch 2.1.6** (40 files): `src/server/services/` part 1 - Service layer
- **Batch 2.1.7** (40 files): `src/server/services/` part 2 - Service layer
- **Batch 2.1.8** (40 files): `src/utils/` + `src/hooks/` - Utilities & hooks
- **Batch 2.1.9-23** (13 files each): Remaining files distributed by module

---

## Pattern 3: Explicit any Declarations

### Overview
- **Occurrences:** 223
- **Files Affected:** 97
- **Risk Level:** Medium
- **Wave:** 2

### Characteristics

Variables, parameters, and properties explicitly typed as `any`, completely disabling type checking.

### Common Contexts

#### 1. Callback Parameters (40% of violations)
**Location:** Event handlers, generic callbacks
**Pattern:**
```typescript
onUpdate: (value: any, source: string) => void
handleFieldUpdate = (field: string, value: any) => {}
onCorrect: (value: any) => void
```

**Example:**
```typescript
// Lines 148-151: src/components/addManga/MetadataEditor.tsx
interface FieldEditorProps {
  value: any;
  onUpdate: (value: any, source: string, customUrl?: string) => void;
}
```

#### 2. Component Props (25% of violations)
**Location:** React component props
**Pattern:**
```typescript
interface Props {
  data?: any;
  metadata?: any;
  currentMetadata?: any;
}
```

**Example:**
```typescript
// Lines 21-31: src/components/addManga/MetadataEditor.tsx
interface MetadataEditorProps {
  value: any;
  originalValue?: any;
  data?: any;
}
```

#### 3. Generic Data Holders (20% of violations)
**Location:** State, config, schema
**Pattern:**
```typescript
const data: any = fetchData();
let state: { [key: string]: any }
schema?: any;
```

**Example:**
```typescript
// Lines 28-37: src/pages/api-playground.tsx
interface Endpoint {
  schema?: any;
  example: any;
  parameters?: {
    example: any;
  };
}
```

#### 4. Test Utilities (10% of violations)
**Location:** Test helper functions
**Pattern:**
```typescript
renderFieldValue(value: any, fieldName: string)
map((entry: any, idx: number) => {})
```

**Example:**
```typescript
// Line 122: src/pages/test/comicvine-data.tsx
const renderFieldValue = (value: any, fieldName: string): React.ReactElement => {
```

#### 5. Type Utility Placeholders (5% of violations)
**Location:** Mock types, temporary types
**Pattern:**
```typescript
let ReleaseScheduleType: any;
updateMutation: any
```

**Example:**
```typescript
// Line 23: src/components/calendar/ManualScheduleOverrideForm.tsx
let ReleaseScheduleType: any;
```

### Top Files by Violation Count

| File | Count | Primary Context |
|------|-------|-----------------|
| `src/server/services/metadata/__tests__/metadata-persister.test.ts` | 10 | Test data |
| `src/components/addManga/MetadataEditor.tsx` | 9 | Field editor props |
| `src/components/volumeChaptersTable.tsx` | 8 | Volume/chapter data |
| `src/components/system/LogViewer.tsx` | 8 | Log entry handling |
| `src/components/addManga/steps/confirmationStep/components/MetadataDisplay.tsx` | 12 | Metadata display |
| `src/components/addManga/steps/wizard/MediaSelectionStep.tsx` | 7 | Volume data |
| `src/components/addManga/steps/confirmationStep/components/VolumeChapterDisplay.tsx` | 7 | Chapter data |

### Fix Strategy

#### Approach: Replace with Specific Types

**Before:**
```typescript
interface FieldEditorProps {
  value: any;
  onUpdate: (value: any, source: string) => void;
}
```

**After:**
```typescript
type FieldValue = string | number | boolean | string[] | null | undefined;

interface FieldEditorProps {
  value: FieldValue;
  onUpdate: (value: FieldValue, source: string) => void;
}
```

**Before:**
```typescript
const handleFieldUpdate = (field: string, value: any, source: string) => {
  // ...
};
```

**After:**
```typescript
type MetadataFieldValue = string | number | string[] | Date | null;

const handleFieldUpdate = (
  field: string,
  value: MetadataFieldValue,
  source: string
): void => {
  // Type guard for specific operations
  if (typeof value === 'string') {
    // String operations
  } else if (Array.isArray(value)) {
    // Array operations
  }
};
```

**Before:**
```typescript
interface VolumeData {
  metadata?: any;
  providerMetadata?: any;
}
```

**After:**
```typescript
import { ProviderMetadata } from '@/types/domain/metadata-types';

interface VolumeData {
  metadata?: Record<string, unknown>;
  providerMetadata?: ProviderMetadata;
}
```

### Batching Strategy

**Total Batches: 7 (Batch 2.2.x)**

- **Batch 2.2.1** (14 files): `src/components/addManga/` - Add manga components
- **Batch 2.2.2** (14 files): `src/components/manga/` - Manga components
- **Batch 2.2.3** (14 files): `src/components/library/` + `src/components/settings/` - Library & settings
- **Batch 2.2.4** (14 files): `src/pages/` - Page components
- **Batch 2.2.5** (14 files): `src/server/services/` - Service layer
- **Batch 2.2.6** (14 files): `src/components/` (other) - Other components
- **Batch 2.2.7** (13 files): Remaining files

---

## Pattern 4: Object.assign with any

### Overview
- **Occurrences:** 56
- **Files Affected:** 36
- **Risk Level:** Low
- **Wave:** 1

### Characteristics

`Object.assign` calls that involve `any` types, typically in state mutations or object merging.

### Common Contexts

#### 1. Redux State Mutations (30% of violations)
**Location:** Zustand store slices
**Pattern:**
```typescript
Object.assign(state, updates);
Object.assign(state, info);
```

**Example:**
```typescript
// Lines 217, 273: src/store/mobileSlice.ts
Object.assign(state, info);
Object.assign(state, updates);
```

#### 2. Test Mocking (40% of violations)
**Location:** Test setup, mock restoration
**Pattern:**
```typescript
Object.assign(console, originalConsole);
Object.assign(window, mocks);
```

**Example:**
```typescript
// Line 267: src/test/utils/testUtils.tsx
Object.assign(console, mocks);
restore: () => Object.assign(console, originalConsole),
```

#### 3. Object Merging (20% of violations)
**Location:** Data merging, config composition
**Pattern:**
```typescript
Object.assign(merged, primary);
Object.assign(enhancedError, { context });
```

**Example:**
```typescript
// Line 2015: src/components/addManga/services/sourceManagementService.ts
Object.assign(merged, primary);
```

#### 4. Component Mocking (10% of violations)
**Location:** Mantine component mocks
**Pattern:**
```typescript
Tabs: Object.assign(/* mock */)
Grid: Object.assign(/* mock */)
```

**Example:**
```typescript
// Lines 1097, 1174: src/test/setup.ts
Tabs: Object.assign(/* ... */),
Grid: Object.assign(/* ... */),
```

### Top Files by Violation Count

| File | Count | Primary Context |
|------|-------|-----------------|
| `src/test/utils/testUtils.tsx` | 5 | Test utilities |
| `src/server/parsers/resilience/RetryManager.ts` | 4 | Retry configuration |
| `src/server/parsers/pattern-recognition/core/PatternEvolutionManager.ts` | 5 | Pattern state |
| `src/test/setup.ts` | 4 | Mock setup |
| `src/server/parsers/config/FeatureFlags.ts` | 2 | Feature flag merging |

### Fix Strategy

#### Approach: Spread Syntax + Type Safety

**Before:**
```typescript
Object.assign(state, updates);
```

**After:**
```typescript
return { ...state, ...updates };
```

**Before:**
```typescript
Object.assign(merged, primary);
```

**After:**
```typescript
const merged = { ...base, ...primary };
```

**Before (Zustand immer):**
```typescript
updateInfo: (info) => {
  Object.assign(state, info);
}
```

**After:**
```typescript
updateInfo: (info) => {
  return { ...state, ...info };
}
```

### Batching Strategy

**Total Batches: 3 (Batch 1.2.x)**

- **Batch 1.2.1** (12 files): `src/test/` - Test utilities and setup
- **Batch 1.2.2** (12 files): `src/server/parsers/` - Parser services
- **Batch 1.2.3** (12 files): Remaining files (store, components, utils)

---

## Consolidated Batch Execution Plan

### Wave 1: Low-Risk Patterns (360 violations, 149 files)

#### Phase 1.1: Double Casts (304 violations, 113 files)
- Batch 1.1.1-1.1.8: 8 batches of ~14 files each

#### Phase 1.2: Object.assign (56 violations, 36 files)
- Batch 1.2.1-1.2.3: 3 batches of ~12 files each

**Wave 1 Total: 11 batches**

### Wave 2: Medium-Risk Patterns (1,474 violations, 430 files)

#### Phase 2.1: as any Casts (1,251 violations, 333 files)
- Batch 2.1.1-2.1.23: 23 batches of ~14-40 files each

#### Phase 2.2: Explicit any (223 violations, 97 files)
- Batch 2.2.1-2.2.7: 7 batches of ~14 files each

**Wave 2 Total: 30 batches**

### Total Execution Plan
- **Total Batches:** 41
- **Average Batch Size:** ~40-50 violations per batch
- **Estimated Execution Time:** 41 agent runs

---

## Risk Assessment

### Low Risk (Wave 1): 360 violations
- **Double casts:** Mostly in utility functions and error handling
- **Object.assign:** Primarily in tests and isolated state mutations
- **Impact:** Minimal runtime risk, focused type safety improvements

### Medium Risk (Wave 2): 1,474 violations
- **as any casts:** Widespread across codebase, potential runtime errors
- **Explicit any:** Disables type checking, masks potential bugs
- **Impact:** Higher risk of runtime errors, requires careful type design

### High-Priority Files

Files requiring special attention due to high violation counts:

1. `src/pages/manga/[id].tsx` (32 as any) - Core manga page
2. `src/utils/mobile/orientation.ts` (31 as any) - Browser API
3. `src/server/trpc/routers/metadata.ts` (24 as any) - Metadata API
4. `src/utils/async-result.ts` (22 double casts) - Core utility
5. `src/server/trpc/routers/search.ts` (20 as any) - Search API

---

## Edge Cases Requiring Manual Review

### 1. Browser API Vendor Prefixes
**Files:** `src/utils/mobile/orientation.ts`, PWA utilities
**Issue:** Vendor-specific APIs not in TypeScript lib
**Solution:** Create global type augmentations in `src/types/browser-apis.d.ts`

### 2. Prisma JSON Fields
**Files:** Metadata routers, config services
**Issue:** Prisma JSON fields typed as `Prisma.JsonValue`
**Solution:** Create proper interfaces for known JSON structures

### 3. Test Mocks
**Files:** All `__tests__/` directories
**Issue:** Mock functions need `any` for flexibility
**Solution:** Use `jest.MockedFunction<T>` and proper generic types

### 4. Legacy AsyncResult Patterns
**Files:** tRPC routers using old AsyncResult pattern
**Issue:** Mixing AsyncResult pattern with as any
**Solution:** Standardize on discriminated union AsyncResult type

### 5. Dynamic Metadata Access
**Files:** Provider forms, metadata editors
**Issue:** Accessing fields by string keys
**Solution:** Create proper mapped types or type guards

---

## Next Steps

### Immediate Actions

1. **Review this analysis** with team leads
2. **Prioritize high-impact files** for first batches
3. **Create global type augmentations** for Browser APIs
4. **Define standard metadata interfaces** for provider data
5. **Set up automated batch execution** workflow

### Execution Sequence

1. Start with **Wave 1** (low-risk):
   - Begin with `src/utils/async-result.ts` (foundation)
   - Progress through double cast batches
   - Complete Object.assign transformations

2. Proceed to **Wave 2** (medium-risk):
   - Start with utility files and type guards
   - Move to server-side tRPC routers
   - Progress to component layers
   - Finish with page components

### Success Criteria

- ✅ All 1,834 violations resolved
- ✅ No new `any` types introduced
- ✅ Type safety improved across all layers
- ✅ Tests passing after each batch
- ✅ No runtime regressions

---

## Appendix A: File-by-File Breakdown

### Top 20 Files by Violation Count

| Rank | File | as any | double cast | explicit any | Object.assign | Total |
|------|------|---------|-------------|--------------|---------------|-------|
| 1 | `src/pages/manga/[id].tsx` | 32 | 1 | 4 | 0 | 37 |
| 2 | `src/utils/mobile/orientation.ts` | 31 | 0 | 0 | 0 | 31 |
| 3 | `src/server/trpc/routers/metadata.ts` | 24 | 2 | 3 | 0 | 29 |
| 4 | `src/utils/async-result.ts` | 0 | 22 | 0 | 0 | 22 |
| 5 | `src/server/trpc/routers/search.ts` | 20 | 3 | 0 | 0 | 23 |
| 6 | `src/server/trpc/routers/manga.ts` | 18 | 1 | 3 | 1 | 23 |
| 7 | `src/server/queue/calendar/CalendarSyncScheduler.ts` | 17 | 0 | 0 | 0 | 17 |
| 8 | `src/server/parsers/__tests__/CachedUnifiedParser.integration.test.ts` | 16 | 0 | 2 | 0 | 18 |
| 9 | `src/utils/mobile/__tests__/native-bridge.test.ts` | 16 | 0 | 1 | 0 | 17 |
| 10 | `src/server/services/library/__tests__/duplicateDetector.test.ts` | 15 | 0 | 0 | 0 | 15 |
| 11 | `src/server/parsers/pattern-recognition/persistence/DatabasePatternStore.ts` | 14 | 2 | 0 | 0 | 16 |
| 12 | `src/components/addManga/UniversalImportWizard.tsx` | 13 | 6 | 3 | 0 | 22 |
| 13 | `src/components/addManga/steps/confirmationStep/components/MetadataDisplay.tsx` | 12 | 0 | 4 | 0 | 16 |
| 14 | `src/server/services/library/metadataEnrichmentService.ts` | 12 | 0 | 0 | 0 | 12 |
| 15 | `src/server/queue/workers/calendarNotificationWorker.ts` | 12 | 0 | 0 | 0 | 12 |
| 16 | `src/pages/api/v1/auth/keys.ts` | 11 | 0 | 0 | 0 | 11 |
| 17 | `src/server/trpc/routers/system.ts` | 11 | 0 | 0 | 0 | 11 |
| 18 | `src/utils/testing/adapter-compliance.ts` | 11 | 0 | 0 | 0 | 11 |
| 19 | `src/utils/type-guards-extended.ts` | 11 | 0 | 0 | 0 | 11 |
| 20 | `src/hooks/useQueryWrapper.ts` | 11 | 11 | 0 | 0 | 22 |

---

## Appendix B: Pattern Recognition Summary

### Pattern Categories Identified

1. **Error Handling Patterns** (15%)
   - Generic error type coercion
   - Error wrapping and transformation
   - AsyncResult error handling

2. **Data Access Patterns** (40%)
   - Dynamic property access
   - Metadata field extraction
   - Provider-specific data access
   - JSON field access

3. **Type System Workarounds** (25%)
   - Generic type constraints
   - Component prop typing
   - API response typing
   - Enum-like value assertions

4. **Browser/Environment Compatibility** (10%)
   - Vendor-prefixed APIs
   - Global object augmentation
   - Feature detection

5. **Test/Mock Patterns** (10%)
   - Mock function typing
   - Test utility flexibility
   - Runtime object mutation

---

**Report Complete**
**Ready for Batch Execution**
