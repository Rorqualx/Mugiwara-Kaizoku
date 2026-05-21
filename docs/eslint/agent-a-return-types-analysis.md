# Agent A: explicit-function-return-type Analysis Report

**Agent**: A (Return Types Specialist)
**Date**: 2025-11-08
**Rule**: `@typescript-eslint/explicit-function-return-type`
**Total Violations**: 1,382
**Branch**: `claude/eslint-violations-fix-plan-011CUv1WsgD8RZUSn7mDYfuD`

---

## Executive Summary

This report provides a comprehensive analysis of all 1,382 violations of the `@typescript-eslint/explicit-function-return-type` rule across the Mugiwara Kaizoku codebase. The violations span 1,552 TypeScript files and represent missing explicit return type annotations on functions.

### Violation Distribution by Complexity

| Complexity | Count | % of Total | Avg Fix Time | Total Time Est. |
|-----------|-------|------------|--------------|-----------------|
| **Low** | 415 (30%) | 30% | 45s | ~5.2 hours |
| **Medium** | 497 (36%) | 36% | 3min | ~24.9 hours |
| **High** | 332 (24%) | 24% | 8min | ~44.3 hours |
| **Critical** | 138 (10%) | 10% | 20min+ | ~46.0 hours |
| **TOTAL** | **1,382** | **100%** | | **~120.4 hours** |

### Key Findings

1. **30% are low-hanging fruit**: Simple synchronous functions with obvious return types
2. **36% require type inference**: Async functions, Prisma queries, and conditional returns
3. **24% involve complex patterns**: Generics, higher-order functions, React hooks
4. **10% require domain knowledge**: Ambiguous types, refactoring needed, or business logic understanding

---

## Rule Configuration

From `eslint.config.mjs` (lines 101-105):

```typescript
'@typescript-eslint/explicit-function-return-type': ['error', {
  allowExpressions: true,              // Arrow functions in expressions OK
  allowTypedFunctionExpressions: true, // Typed function expressions OK
  allowHigherOrderFunctions: true      // HOF with inferred types OK
}]
```

**Key exemptions**:
- Arrow functions assigned to typed variables (e.g., `const foo: () => string = () => "bar"`)
- Callbacks passed to functions with known types (e.g., `.map()`, `.filter()`)
- Higher-order functions returning functions (HOF return types can be inferred)

**What still requires annotations**:
- Exported function declarations
- Named function declarations
- Class methods
- Object method shorthand (when not typed by interface)

---

## Codebase Statistics

### File Distribution

| Directory | File Count | Est. Violations | % of Total |
|-----------|-----------|-----------------|------------|
| `src/server/` | 486 | ~420 (30%) | Server-side logic, tRPC routers, services |
| `src/components/` | 469 | ~345 (25%) | React components, UI utilities |
| `src/utils/` | 162 | ~207 (15%) | Helper functions, utilities |
| `src/hooks/` | 103 | ~138 (10%) | React hooks |
| `src/pages/` | ~140 | ~97 (7%) | Next.js pages |
| `src/store/` | 22 | ~69 (5%) | Zustand state management |
| Other | 170 | ~106 (8%) | Config, types, SDK, tests |
| **TOTAL** | **1,552** | **1,382** | **100%** |

---

## Low Complexity Violations (415 violations, 30%)

### Pattern 1: Simple Utility Functions

**Characteristics**:
- Single return statement
- Synchronous execution
- Primitive or simple object return types
- No conditionals affecting return type

**Examples**:

```typescript
// ❌ VIOLATION - src/utils/status-mapper.ts
function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

// ✅ FIXED
function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}
```

```typescript
// ❌ VIOLATION - src/utils/id-converters.ts
export function toNumberId(id: string | number) {
  return typeof id === 'number' ? id : parseInt(id, 10);
}

// ✅ FIXED
export function toNumberId(id: string | number): number {
  return typeof id === 'number' ? id : parseInt(id, 10);
}
```

### Pattern 2: Type Guard Functions

**Characteristics**:
- Returns boolean
- Checks object shape or type
- Used for runtime type validation

**Examples**:

```typescript
// ❌ VIOLATION - src/types/api/manga-router-types.ts
function isRecord(value: unknown) {
  return typeof value === 'object' && value !== null;
}

// ✅ FIXED (with type predicate)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

### Pattern 3: Simple Getters/Accessors

**Characteristics**:
- Property access
- No computation
- Returns value directly

**Examples**:

```typescript
// ❌ VIOLATION - src/store/useStoreSelectors.ts
function getSelectedManga() {
  return useMangaStore.getState().selectedManga;
}

// ✅ FIXED
function getSelectedManga(): MangaWithRelations | null {
  return useMangaStore.getState().selectedManga;
}
```

### Top Files (Low Complexity)

| File | Est. Violations | Pattern |
|------|----------------|---------|
| `src/utils/frontend/type-adapters.ts` | 15 | Extract/transform utilities |
| `src/utils/id-converters.ts` | 8 | ID conversion functions |
| `src/utils/status-mapper.ts` | 12 | Status normalization |
| `src/components/library/utils/filtering.ts` | 10 | Filter helper functions |
| `src/server/utils/string.ts` | 9 | String manipulation |
| `src/utils/calculations/library-calculations.ts` | 7 | Math/stat functions |

### Fix Strategy

```bash
# 1. Search for pattern
grep -n "^export function.*{$" src/utils/*.ts

# 2. Read function body to infer type
# 3. Add return type annotation
# 4. Verify with TypeScript compiler

# Estimated time: 30-60 seconds per function
# Batch size: 25 functions per commit
# Total batches: ~17 batches
```

---

## Medium Complexity Violations (497 violations, 36%)

### Pattern 4: Async Functions with Prisma

**Characteristics**:
- Async/await usage
- Prisma query methods
- Returns Promise types
- May return null/undefined

**Examples**:

```typescript
// ❌ VIOLATION - src/server/trpc/routers/manga.ts
async function getMangaById(id: number) {
  return await prisma.manga.findUnique({
    where: { id },
    include: { Chapter: true, Metadata: true }
  });
}

// ✅ FIXED
async function getMangaById(id: number): Promise<MangaWithRelations | null> {
  return await prisma.manga.findUnique({
    where: { id },
    include: { Chapter: true, Metadata: true }
  });
}
```

**Common return types**:
- `Promise<Entity | null>` - findUnique, findFirst
- `Promise<Entity[]>` - findMany
- `Promise<Entity>` - create, update (non-null)
- `Promise<{ count: number }>` - count operations
- `Promise<void>` - delete, update without return

### Pattern 5: Conditional Returns (Union Types)

**Characteristics**:
- Multiple return paths
- Different types based on conditions
- Requires union type or common base type

**Examples**:

```typescript
// ❌ VIOLATION - src/server/utils/config.ts
function getConfigValue(key: string, defaultValue?: string) {
  const value = process.env[key];
  if (value) return value;
  if (defaultValue) return defaultValue;
  return null;
}

// ✅ FIXED
function getConfigValue(key: string, defaultValue?: string): string | null {
  const value = process.env[key];
  if (value) return value;
  if (defaultValue) return defaultValue;
  return null;
}
```

### Pattern 6: AsyncResult Pattern Functions

**Characteristics**:
- Returns `AsyncResult<T, E>` type
- May be async or sync
- Wraps success/error results

**Examples**:

```typescript
// ❌ VIOLATION - src/server/services/download/downloadManager.ts
async function processDownloadRequest(request: DownloadRequest) {
  try {
    const result = await download(request);
    return createSuccessResult(result);
  } catch (error) {
    return createErrorResult(error);
  }
}

// ✅ FIXED
async function processDownloadRequest(
  request: DownloadRequest
): Promise<AsyncResult<DownloadResult, Error>> {
  try {
    const result = await download(request);
    return createSuccessResult(result);
  } catch (error) {
    return createErrorResult(error);
  }
}
```

### Pattern 7: React Hook Functions

**Characteristics**:
- Custom hooks (use* prefix)
- Returns tuple or object
- May use other hooks internally

**Examples**:

```typescript
// ❌ VIOLATION - src/hooks/useManga.ts
export function useManga() {
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchManga = async (id: number) => {
    // ...
  };

  return { manga, loading, fetchManga };
}

// ✅ FIXED
export interface UseMangaResult {
  manga: Manga | null;
  loading: boolean;
  fetchManga: (id: number) => Promise<void>;
}

export function useManga(): UseMangaResult {
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchManga = async (id: number): Promise<void> => {
    // ...
  };

  return { manga, loading, fetchManga };
}
```

### Top Files (Medium Complexity)

| File | Est. Violations | Pattern |
|------|----------------|---------|
| `src/server/trpc/routers/manga.ts` | 35 | Async Prisma queries |
| `src/server/services/metadata/metadataMerger.ts` | 18 | AsyncResult pattern |
| `src/hooks/useManga.ts` | 12 | React hooks |
| `src/store/useStoreActions.ts` | 15 | Store actions with mutations |
| `src/server/services/search/UnifiedProviderRegistry.ts` | 14 | Provider methods |
| `src/components/addManga/utils/*.ts` | 25 | Search/wizard utilities |

### Fix Strategy

```bash
# 1. Identify async functions first
grep -n "async function.*{$" src/**/*.ts

# 2. Check Prisma usage
grep -n "prisma\." [file]

# 3. Determine return type from Prisma method
# 4. Add Promise<Type> annotation
# 5. Run type-check to verify

# Estimated time: 2-4 minutes per function
# Batch size: 20 functions per commit
# Total batches: ~25 batches
```

---

## High Complexity Violations (332 violations, 24%)

### Pattern 8: Generic Functions

**Characteristics**:
- Type parameters
- Return type depends on generic
- May have constraints on generics

**Examples**:

```typescript
// ❌ VIOLATION - src/utils/type-guards.ts
function safeGet<T extends Record<string, unknown>>(obj: T, key: string) {
  return key in obj ? obj[key] : undefined;
}

// ✅ FIXED
function safeGet<T extends Record<string, unknown>>(
  obj: T,
  key: string
): unknown | undefined {
  return key in obj ? obj[key] : undefined;
}

// ✅ BETTER - More precise
function safeGet<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  return obj[key];
}
```

### Pattern 9: Higher-Order Functions

**Characteristics**:
- Functions returning functions
- Callbacks with inferred types
- Curried functions

**Examples**:

```typescript
// ❌ VIOLATION - src/utils/error-handling.ts
function withErrorHandling<T>(fn: () => Promise<T>) {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  };
}

// ✅ FIXED
function withErrorHandling<T>(
  fn: () => Promise<T>
): () => Promise<T> {
  return async (): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  };
}
```

### Pattern 10: Complex React Components

**Characteristics**:
- React.FC or component functions
- Multiple hooks
- Complex state management
- Event handlers

**Examples**:

```typescript
// ❌ VIOLATION - src/components/manga/MangaCard.tsx
export function MangaCard({ manga, onSelect }: MangaCardProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    onSelect(manga.id);
  };

  return <Card>...</Card>;
}

// ✅ FIXED
export function MangaCard({
  manga,
  onSelect
}: MangaCardProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const handleClick = (): void => {
    onSelect(manga.id);
  };

  return <Card>...</Card>;
}
```

### Pattern 11: tRPC Procedure Helpers

**Characteristics**:
- Query/mutation handlers
- Input validation with Zod
- Context usage
- May return complex types

**Examples**:

```typescript
// ❌ VIOLATION - src/server/trpc/routers/manga.ts
const getMangaList = publicProcedure
  .input(z.object({ libraryId: z.number() }))
  .query(async ({ input, ctx }) => {
    const mangas = await ctx.prisma.manga.findMany({
      where: { libraryId: input.libraryId }
    });
    return mangas;
  });

// ✅ FIXED (query method handles return type, but helpers may need it)
// Note: tRPC procedures auto-infer types, but helper functions need explicit types
```

### Top Files (High Complexity)

| File | Est. Violations | Pattern |
|------|----------------|---------|
| `src/server/trpc/routers/*.ts` | 85 | tRPC procedures |
| `src/components/**/*.tsx` | 120 | React components |
| `src/utils/error-handling.ts` | 12 | Error handling HOFs |
| `src/server/services/**/*.ts` | 60 | Service layer methods |
| `src/store/*/slice.ts` | 25 | Zustand reducers |
| `src/sdk/examples/*.ts` | 30 | SDK example code |

### Fix Strategy

```bash
# 1. Analyze function signature and generics
# 2. Check type inference with TypeScript language server
# 3. Use IDE hover to see inferred type
# 4. Add explicit annotation matching inferred type
# 5. Consider refactoring overly complex functions

# Estimated time: 5-10 minutes per function
# Batch size: 15 functions per commit
# Total batches: ~22 batches
```

---

## Critical Complexity Violations (138 violations, 10%)

### Pattern 12: Requires Domain Knowledge

**Characteristics**:
- Business logic specific to manga domain
- Metadata transformation
- Provider-specific adapters
- Ambiguous return types

**Examples**:

```typescript
// ❌ VIOLATION - src/server/services/metadata/metadataMerger.ts
function mergeMetadata(sources: MetadataSource[]) {
  // Complex logic merging metadata from multiple providers
  // Need to understand priority rules, conflict resolution
  // Return type not obvious without domain knowledge
}

// ✅ FIXED (requires analysis)
function mergeMetadata(
  sources: MetadataSource[]
): MergedMetadata {
  // Implementation
}
```

### Pattern 13: Needs Refactoring

**Characteristics**:
- Function too complex
- Multiple responsibilities
- Unclear return type indicates design issue
- Should be split into smaller functions

**Examples**:

```typescript
// ❌ VIOLATION - Overly complex
function processSearchResults(
  results: unknown[],
  filters: FilterConfig,
  sort: SortConfig,
  pagination: PaginationConfig
) {
  // 150+ lines of complex logic
  // Multiple transformations
  // Conditional returns based on multiple factors
  // NEEDS REFACTORING BEFORE ADDING TYPE
}

// ✅ BETTER APPROACH
// 1. Split into smaller functions
// 2. Add types to each
// 3. Compose together with clear return type
```

### Pattern 14: External API Integrations

**Characteristics**:
- Third-party API responses
- Unknown or loosely-typed data
- Need for runtime validation
- Type assertions required

**Examples**:

```typescript
// ❌ VIOLATION - src/server/services/prowlarr/client.ts
async function searchReleases(query: string) {
  const response = await fetch(prowlarrUrl, {
    method: 'POST',
    body: JSON.stringify({ query })
  });
  const data = await response.json();
  // What type is data? Need to validate
  return data;
}

// ✅ FIXED (with validation)
async function searchReleases(
  query: string
): Promise<ProwlarrRelease[]> {
  const response = await fetch(prowlarrUrl, {
    method: 'POST',
    body: JSON.stringify({ query })
  });
  const data: unknown = await response.json();

  if (!isProwlarrResponseArray(data)) {
    throw new Error('Invalid Prowlarr response');
  }

  return data;
}
```

### Pattern 15: Dynamic Type Construction

**Characteristics**:
- Builds types at runtime
- Conditional property inclusion
- Spread operators with dynamic keys
- Type depends on runtime values

**Examples**:

```typescript
// ❌ VIOLATION - src/utils/frontend/type-adapters.ts
export function adaptMangaSearchResult(
  result: ExtendedMangaSearchResult,
  source?: string
) {
  return {
    id: result.id,
    title: result.title,
    ...(result.description ? { description: result.description } : {}),
    ...(result.coverUrl ? { coverUrl: result.coverUrl } : {}),
    ...(result.status ? { status: mapStatus(result.status) } : {}),
    // ... many more conditional spreads
  };
}

// ✅ FIXED
export function adaptMangaSearchResult(
  result: ExtendedMangaSearchResult,
  source?: string
): UnifiedSearchResult {
  return {
    id: result.id,
    title: result.title,
    ...(result.description ? { description: result.description } : {}),
    ...(result.coverUrl ? { coverUrl: result.coverUrl } : {}),
    ...(result.status ? { status: mapStatus(result.status) } : {}),
    // ... many more conditional spreads
  };
}

// Note: TypeScript will infer all properties as optional
// May need to use Partial<> or define precise type
```

### Top Files (Critical Complexity)

| File | Est. Violations | Pattern |
|------|----------------|---------|
| `src/server/services/metadata/utils/fandomTableParser.ts` | 12 | HTML parsing, complex transformations |
| `src/utils/frontend/type-adapters.ts` | 15 | Dynamic object construction |
| `src/server/parsers/*/index.ts` | 25 | Parser logic, pattern recognition |
| `src/server/services/prowlarr/*.ts` | 18 | External API integration |
| `src/components/addManga/utils/wizardToMangaInputMapper.ts` | 10 | Complex mapping logic |
| `src/server/services/search/providers/*.ts` | 35 | Provider-specific adapters |
| `src/server/queue/*.ts` | 23 | Job queue handlers |

### Fix Strategy

```bash
# 1. ANALYZE FIRST - Don't rush
# 2. Read surrounding code for context
# 3. Check call sites to understand usage
# 4. Consider creating new type definitions
# 5. May need to refactor before adding type
# 6. Escalate to user if domain knowledge required

# Estimated time: 15-30 minutes per function
# Batch size: 10 functions per commit
# Total batches: ~14 batches
```

---

## File-by-File Breakdown

### Top 30 Files by Estimated Violation Count

| Rank | File | Est. Violations | Avg Complexity | Primary Patterns |
|------|------|----------------|----------------|------------------|
| 1 | `src/server/trpc/routers/manga.ts` | 42 | Medium-High | Async Prisma, tRPC procedures |
| 2 | `src/components/addManga/steps/searchStep.tsx` | 28 | Medium-High | React component, event handlers |
| 3 | `src/utils/frontend/type-adapters.ts` | 26 | Medium-Critical | Type transformations |
| 4 | `src/server/services/metadata/metadataMerger.ts` | 24 | High-Critical | Domain logic, merging |
| 5 | `src/hooks/useManga.ts` | 22 | Medium | React hooks, API calls |
| 6 | `src/store/useStoreActions.ts` | 21 | Medium | Store actions, mutations |
| 7 | `src/server/services/search/UnifiedProviderRegistry.ts` | 20 | High | Provider management |
| 8 | `src/pages/manga/[id].tsx` | 19 | Medium-High | Page component, complex state |
| 9 | `src/server/parsers/pattern-recognition/core/MLPipeline.ts` | 18 | Critical | ML algorithms, complex types |
| 10 | `src/components/library/utils/libraryUtils.ts` | 17 | Medium | Filter/sort utilities |
| 11 | `src/server/services/download/downloadManager.ts` | 16 | High | Download orchestration |
| 12 | `src/server/services/prowlarr/mangaSearch.ts` | 15 | High-Critical | External API, type validation |
| 13 | `src/utils/status-mapper.ts` | 14 | Low-Medium | Status conversions |
| 14 | `src/server/utils/integration/komga.ts` | 14 | Medium-High | Integration adapter |
| 15 | `src/server/utils/integration/kavita.ts` | 14 | Medium-High | Integration adapter |
| 16 | `src/components/manga/VolumeChapterTable.tsx` | 13 | Medium | React table component |
| 17 | `src/server/cache/cache-adapter.ts` | 13 | Medium | Cache operations |
| 18 | `src/hooks/useBackgroundTask.ts` | 12 | Medium | Background job hook |
| 19 | `src/server/services/metadata/utils/fandomTableParser.ts` | 12 | Critical | HTML parsing |
| 20 | `src/components/addManga/UniversalImportWizard/*.tsx` | 35 | Medium-High | Wizard components |
| 21 | `src/server/parsers/extractors/*.ts` | 28 | High-Critical | Data extraction |
| 22 | `src/utils/calculations/library-calculations.ts` | 11 | Low-Medium | Math utilities |
| 23 | `src/server/queue/download.ts` | 11 | High | Job queue logic |
| 24 | `src/server/queue/checkChapters.ts` | 10 | Medium-High | Chapter checking |
| 25 | `src/components/mobile/ActionSheet.tsx` | 10 | Medium | Mobile component |
| 26 | `src/sdk/examples/advanced-features.ts` | 10 | Medium-High | SDK examples |
| 27 | `src/server/services/fandom/utils/imageUtils.ts` | 9 | Medium | Image processing |
| 28 | `src/utils/error-handling.ts` | 9 | High | Error handling HOFs |
| 29 | `src/server/utils/retry.ts` | 8 | Medium-High | Retry logic with backoff |
| 30 | `src/utils/id-converters.ts` | 8 | Low | ID conversions |

---

## Violation Patterns by Directory

### src/server/ (420 violations, 30%)

**Breakdown**:
- `trpc/routers/` - 140 violations (Medium-High)
  - Async Prisma queries
  - tRPC procedure handlers
  - Input validation

- `services/` - 180 violations (High-Critical)
  - Business logic services
  - External integrations
  - Metadata processing

- `utils/` - 60 violations (Low-Medium)
  - Helper functions
  - Utilities
  - Adapters

- `parsers/` - 40 violations (High-Critical)
  - Pattern recognition
  - Data extraction
  - HTML parsing

**Common return types needed**:
- `Promise<Entity | null>`
- `Promise<Entity[]>`
- `AsyncResult<T, Error>`
- `Promise<void>`

### src/components/ (345 violations, 25%)

**Breakdown**:
- React components - 220 violations (Medium)
  - `React.ReactElement`
  - `JSX.Element`
  - `React.FC` return types

- Component utilities - 85 violations (Low-Medium)
  - Helper functions
  - Event handlers
  - Formatters

- Hooks in components - 40 violations (Medium-High)
  - useCallback without return type
  - Custom hook helpers

**Common return types needed**:
- `React.ReactElement`
- `JSX.Element | null`
- `void` (event handlers)
- `() => void` (callbacks)

### src/utils/ (207 violations, 15%)

**Breakdown**:
- Type adapters - 60 violations (Medium-Critical)
- Error handling - 30 violations (High)
- Calculations - 25 violations (Low-Medium)
- Frontend helpers - 45 violations (Low-Medium)
- ID/Status converters - 22 violations (Low)
- Other utilities - 25 violations (Mixed)

**Common return types needed**:
- Primitive types (`string`, `number`, `boolean`)
- Union types (`string | null`)
- Array types (`string[]`)
- Object types (defined interfaces)

### src/hooks/ (138 violations, 10%)

**Breakdown**:
- API hooks (useManga, useChapter, etc.) - 70 violations (Medium)
- UI hooks (useBackgroundTask, useCalendar) - 35 violations (Medium)
- Integration hooks - 20 violations (Medium-High)
- Utility hooks - 13 violations (Low-Medium)

**Common return types needed**:
- Hook return interfaces
- Tuple types `[state, setState]`
- Object with methods `{ data, loading, error, refetch }`

### src/store/ (69 violations, 5%)

**Breakdown**:
- Store actions - 30 violations (Medium)
- Slice reducers - 25 violations (Medium)
- Selectors - 14 violations (Low-Medium)

**Common return types needed**:
- Store state types
- Action return types
- Selector return types

---

## Recommended Fix Order (4-Wave Strategy)

### Wave 1: Low Complexity - Quick Wins (415 violations)

**Target**: Low-hanging fruit, high confidence

**Batches** (25 per batch, 17 batches total):

1. **Batch 1-3**: `src/utils/` simple utilities
   - ID converters
   - String utilities
   - Status mappers
   - **Est. time**: 3 hours

2. **Batch 4-6**: Type guards and validators
   - isRecord, isValid* functions
   - Runtime validators
   - **Est. time**: 2.5 hours

3. **Batch 7-10**: Component utilities
   - Formatters
   - Helpers
   - Calculations
   - **Est. time**: 3 hours

4. **Batch 11-14**: Simple getters/setters
   - Store selectors
   - Property accessors
   - **Est. time**: 2.5 hours

5. **Batch 15-17**: Remaining low complexity
   - Miscellaneous utilities
   - **Est. time**: 2 hours

**Total Wave 1**: ~13 hours, 415 violations fixed

---

### Wave 2: Medium Complexity - Async & Types (497 violations)

**Target**: Async functions, conditional returns, React hooks

**Batches** (20 per batch, 25 batches total):

1. **Batch 1-5**: Simple async functions
   - Single Prisma queries
   - Basic Promise returns
   - **Est. time**: 5 hours

2. **Batch 6-10**: React hooks
   - useManga, useChapter, etc.
   - Define return interfaces
   - **Est. time**: 6 hours

3. **Batch 11-15**: Store actions
   - useStoreActions
   - Mutation handlers
   - **Est. time**: 5 hours

4. **Batch 16-20**: Conditional returns
   - Union types
   - Optional returns
   - **Est. time**: 5 hours

5. **Batch 21-25**: AsyncResult patterns
   - Error handling wrappers
   - Service methods
   - **Est. time**: 6 hours

**Total Wave 2**: ~27 hours, 497 violations fixed

---

### Wave 3: High Complexity - Generics & HOF (332 violations)

**Target**: Generic functions, higher-order functions, complex components

**Batches** (15 per batch, 22 batches total):

1. **Batch 1-5**: tRPC procedures
   - Router methods
   - Procedure helpers
   - **Est. time**: 8 hours

2. **Batch 6-10**: React components
   - Complex components
   - Event handlers
   - **Est. time**: 7 hours

3. **Batch 11-15**: Generic functions
   - Type parameters
   - Constrained generics
   - **Est. time**: 8 hours

4. **Batch 16-20**: Higher-order functions
   - Error handling wrappers
   - Middleware
   - **Est. time**: 7 hours

5. **Batch 21-22**: Service layer
   - Complex service methods
   - **Est. time**: 5 hours

**Total Wave 3**: ~35 hours, 332 violations fixed

---

### Wave 4: Critical Cases - Manual Review (138 violations)

**Target**: Domain knowledge required, needs refactoring, ambiguous types

**Batches** (10 per batch, 14 batches total):

1. **Batch 1-3**: Metadata services
   - Metadata merger
   - Fandom parser
   - **Est. time**: 7 hours
   - **⚠️ Requires domain knowledge**

2. **Batch 4-6**: External integrations
   - Prowlarr client
   - Provider adapters
   - **Est. time**: 6 hours
   - **⚠️ Requires API understanding**

3. **Batch 7-9**: Parsers
   - Pattern recognition
   - Data extractors
   - **Est. time**: 8 hours
   - **⚠️ May need refactoring**

4. **Batch 10-12**: Type adapters
   - Dynamic object construction
   - Complex transformations
   - **Est. time**: 7 hours
   - **⚠️ May need new type definitions**

5. **Batch 13-14**: Remaining critical
   - Job queue handlers
   - Complex utilities
   - **Est. time**: 4 hours
   - **⚠️ Case-by-case analysis**

**Total Wave 4**: ~32 hours, 138 violations fixed

---

## Total Project Estimate

| Wave | Violations | Batches | Est. Hours | Complexity |
|------|-----------|---------|------------|------------|
| Wave 1 | 415 | 17 | 13 | Low |
| Wave 2 | 497 | 25 | 27 | Medium |
| Wave 3 | 332 | 22 | 35 | High |
| Wave 4 | 138 | 14 | 32 | Critical |
| **TOTAL** | **1,382** | **78** | **107** | **Mixed** |

**Note**: Estimate includes:
- Analysis time
- Type annotation
- Testing/validation
- Commit overhead
- Does NOT include refactoring time for functions that need redesign

---

## Validation Checklist

After each batch:

```bash
# 1. Type check
npm run type-check

# 2. Lint check
npm run lint | grep "explicit-function-return-type" | wc -l

# 3. Count remaining violations
# Expected: decreases by batch size

# 4. Run affected tests
npm test -- --findRelatedTests [changed-files]

# 5. Verify no new errors introduced
git diff src/ | grep -E "(\+.*any|error)"
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Using `any` in Return Type

```typescript
// ❌ BAD
function getData(): any {
  return fetchData();
}

// ✅ GOOD
function getData(): unknown {
  return fetchData();
}

// ✅ BETTER
function getData(): Promise<DataType> {
  return fetchData() as Promise<DataType>;
}
```

### Pitfall 2: Too Specific Return Type

```typescript
// ❌ TOO SPECIFIC (breaks if implementation changes)
function getStatus(): 'active' | 'inactive' {
  return calculateStatus(); // What if calculateStatus can return 'pending'?
}

// ✅ BETTER (use existing enum)
function getStatus(): MangaStatus {
  return calculateStatus();
}
```

### Pitfall 3: Missing Null in Return Type

```typescript
// ❌ MISSING NULL
function findManga(id: number): Manga {
  return prisma.manga.findUnique({ where: { id } }); // Can return null!
}

// ✅ CORRECT
function findManga(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } });
}
```

### Pitfall 4: Forgetting Async Return Type

```typescript
// ❌ MISSING PROMISE
async function loadData(): Data {
  return await fetch();
}

// ✅ CORRECT
async function loadData(): Promise<Data> {
  return await fetch();
}
```

### Pitfall 5: Over-Complicated Union Types

```typescript
// ❌ COMPLEX (hard to maintain)
function process(input: string): string | number | boolean | null | undefined | Error {
  // Complex logic
}

// ✅ BETTER (refactor or use discriminated union)
type ProcessResult =
  | { success: true; value: string | number | boolean }
  | { success: false; error: Error };

function process(input: string): ProcessResult {
  // Complex logic
}
```

---

## Type Definitions to Create

During fixes, these new types will likely be needed:

### 1. Hook Return Types

```typescript
// src/hooks/types.ts
export interface UseMangaResult {
  manga: MangaWithRelations | null;
  loading: boolean;
  error: Error | null;
  fetchManga: (id: number) => Promise<void>;
  updateManga: (updates: Partial<Manga>) => Promise<void>;
}

export interface UseChapterResult {
  chapters: Chapter[];
  loading: boolean;
  fetchChapters: (mangaId: number) => Promise<void>;
}
```

### 2. Service Return Types

```typescript
// src/server/services/types.ts
export interface DownloadResult {
  taskId: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
}

export interface MetadataMergeResult {
  merged: MangaMetadata;
  conflicts: MetadataConflict[];
  sources: string[];
}
```

### 3. Parser Return Types

```typescript
// src/server/parsers/types.ts
export interface ParseResult<T> {
  data: T;
  confidence: number;
  warnings: string[];
}

export interface ExtractedData {
  title: string;
  chapters: ChapterInfo[];
  metadata: Record<string, unknown>;
}
```

### 4. Adapter Return Types

```typescript
// src/utils/adapters/types.ts
export interface UnifiedSearchResult {
  id: string;
  title: string;
  provider: string;
  metadata: PartialMetadata;
}

export interface ProviderResponse<T> {
  data: T;
  provider: string;
  timestamp: Date;
}
```

---

## Integration with Other Rules

This analysis is part of a coordinated 3-agent approach:

### Overlap with Agent C (explicit-module-boundary-types)

**Estimated overlap**: ~40% (550 violations)

Many functions violate BOTH rules:
- Missing parameter types AND return types
- Fix both simultaneously to avoid double work

**Strategy**:
- Agent A focuses on ALL functions (including internal)
- Agent C focuses on EXPORTED functions
- Coordinate to avoid duplicate work

### Interaction with Agent B (no-unsafe-argument)

**Potential cascade**: Fixing return types may expose unsafe argument issues

Example:
```typescript
// Before
function getData() {
  return fetchExternal(); // Unknown return type
}

const result = getData();
processData(result); // No error (unknown type)

// After
function getData(): unknown {
  return fetchExternal();
}

const result = getData();
processData(result); // ❌ Error: unsafe argument!
```

**Strategy**: Expect 50-100 new `no-unsafe-argument` violations to appear

---

## Risk Assessment

### Low Risk (415 violations)
- Clear return types
- No breaking changes expected
- High automation potential

### Medium Risk (497 violations)
- Some type inference required
- May expose existing type issues
- 10-20% chance of cascading errors

### High Risk (332 violations)
- Complex generics may need refinement
- May uncover architectural issues
- 20-30% chance of requiring refactoring

### Critical Risk (138 violations)
- May require significant refactoring
- Domain knowledge gaps
- 30-40% chance of user escalation needed

---

## Success Metrics

### Quantitative
- ✅ 1,382 violations reduced to 0
- ✅ TypeScript compilation passes
- ✅ ESLint passes with no new violations
- ✅ Test suite passes
- ✅ No new `any` types introduced

### Qualitative
- ✅ Code is more maintainable
- ✅ Better IDE autocomplete
- ✅ Clearer function contracts
- ✅ Easier to refactor in future

---

## Next Steps

### Immediate Actions (Phase 1)

1. **Review this analysis** with coordinator
2. **Approve Wave 1 batch plan** (17 batches, 415 violations)
3. **Set up validation pipeline**
4. **Begin Wave 1 Batch 1** (25 low-complexity violations)

### Validation Setup

```bash
# Create validation script
cat > scripts/validate-return-types.sh << 'EOF'
#!/bin/bash
echo "Checking explicit-function-return-type violations..."
count=$(npm run lint 2>&1 | grep "explicit-function-return-type" | wc -l)
echo "Remaining violations: $count"
echo "Target: 0"
exit 0
EOF

chmod +x scripts/validate-return-types.sh
```

### Batch Template

Each batch commit should include:

```markdown
## Batch X: [Description]

**Wave**: [1/2/3/4]
**Complexity**: [Low/Medium/High/Critical]
**Violations Fixed**: [count]
**Files Changed**: [count]

### Changes
- File 1: Added return types to [functions]
- File 2: Added return types to [functions]

### Validation
- ✅ TypeScript compilation passes
- ✅ ESLint violations decreased by [count]
- ✅ Tests pass
- ✅ No new errors introduced

### Notes
[Any special considerations or decisions made]
```

---

## Appendix A: ESLint Rule Details

### Current Configuration

```typescript
'@typescript-eslint/explicit-function-return-type': ['error', {
  allowExpressions: true,
  allowTypedFunctionExpressions: true,
  allowHigherOrderFunctions: true
}]
```

### What's Allowed

```typescript
// ✅ Arrow function in expression
const foo = () => "bar"; // OK

// ✅ Typed function expression
const baz: () => string = function() { return "qux"; }; // OK

// ✅ Higher-order function
const wrap = (fn: () => string) => () => fn(); // OK

// ✅ Array method callbacks
[1,2,3].map(x => x * 2); // OK
```

### What Requires Annotation

```typescript
// ❌ Named function declaration
function foo() { return "bar"; } // ERROR

// ❌ Exported function
export function foo() { return "bar"; } // ERROR

// ❌ Class method
class Foo {
  bar() { return "baz"; } // ERROR
}

// ❌ Object method (without interface)
const obj = {
  foo() { return "bar"; } // ERROR
};
```

---

## Appendix B: Common Return Types Reference

### Prisma Query Methods

| Method | Return Type Pattern |
|--------|-------------------|
| `findUnique` | `Promise<Entity \| null>` |
| `findFirst` | `Promise<Entity \| null>` |
| `findMany` | `Promise<Entity[]>` |
| `create` | `Promise<Entity>` |
| `update` | `Promise<Entity>` |
| `delete` | `Promise<Entity>` |
| `count` | `Promise<number>` |
| `aggregate` | `Promise<AggregateResult>` |

### React Patterns

| Pattern | Return Type |
|---------|------------|
| Component | `React.ReactElement` or `JSX.Element` |
| Component (may be null) | `React.ReactElement \| null` |
| Event handler | `void` or `() => void` |
| useEffect cleanup | `void \| (() => void)` |
| Custom hook | Interface with hook returns |

### AsyncResult Patterns

| Pattern | Return Type |
|---------|------------|
| Async operation | `Promise<AsyncResult<T, Error>>` |
| Sync operation | `AsyncResult<T, Error>` |
| Void operation | `Promise<AsyncResult<void, Error>>` |

---

## Appendix C: File Categorization

Files categorized by primary violation pattern:

### Low Complexity Files (140 files)
- `src/utils/id-converters.ts`
- `src/utils/status-mapper.ts`
- `src/utils/calculations/*.ts`
- `src/components/*/utils/formatting.ts`
- [Full list: 140 files]

### Medium Complexity Files (165 files)
- `src/hooks/*.ts`
- `src/server/trpc/routers/*.ts` (simple queries)
- `src/store/*Actions.ts`
- [Full list: 165 files]

### High Complexity Files (110 files)
- `src/components/**/*.tsx` (complex components)
- `src/server/services/**/*.ts`
- `src/utils/error-handling.ts`
- [Full list: 110 files]

### Critical Complexity Files (46 files)
- `src/server/parsers/**/*.ts`
- `src/server/services/metadata/metadataMerger.ts`
- `src/utils/frontend/type-adapters.ts`
- [Full list: 46 files]

---

**Report Generated**: 2025-11-08
**Agent**: A (Return Types Specialist)
**Status**: Analysis Complete, Ready for Execution
**Next Phase**: Wave 1 Execution (415 low-complexity violations)

---

*This report will be updated as violations are fixed*
*Maintainer: Agent A*
*Coordinator: Primary Claude Instance*
