# Agent C: explicit-module-boundary-types Analysis Report

**Agent**: C (Module Boundary Types Specialist)
**Date**: 2025-11-08
**Total Violations**: 729 (as documented in TYPE_SAFETY_VIOLATIONS_PLAN.md)
**Rule**: `@typescript-eslint/explicit-module-boundary-types`

---

## Executive Summary

This rule enforces that **exported functions** must have explicit types for both their parameters and return values. This is critical for API boundaries as it ensures that consumers of these functions have proper type information.

| Missing Type Info | Est. Count | % of Total | Priority | Est. Fix Time |
|------------------|------------|------------|----------|---------------|
| Return Type Only | 450 | 62% | Medium | 15-20 hours |
| Parameters Only | 120 | 16% | High | 8-12 hours |
| Both Missing | 100 | 14% | Critical | 6-8 hours |
| Partial Parameters | 59 | 8% | Medium | 4-6 hours |
| **TOTAL** | **729** | **100%** | | **33-46 hours** |

### Key Findings

1. **Return Type Only** violations dominate (62%) - Most exported functions have typed parameters but missing return types
2. **React Hooks** are a major contributor - Many custom hooks lack return type annotations
3. **Utility Functions** mostly have complete types (low violation rate)
4. **tRPC Routers** have moderate violations in helper functions
5. **Service Layer** functions have mixed compliance

---

## Rule Configuration

**Current config** (eslint.config.mjs:108):
```typescript
'@typescript-eslint/explicit-module-boundary-types': 'error'
```

**What this enforces**:
- ALL exported functions must have explicit return types
- ALL exported function parameters must have explicit types
- Applies to: `export function`, `export const`, `export async function`
- Does NOT apply to: non-exported functions, arrow functions assigned to typed variables

---

## Violation Categories

### 1. Return Type Only Missing (≈450 violations, 62%)

**Pattern**: Parameters are typed but return type is missing

#### Common in:
- **React Hooks** (≈180 violations)
- **Helper Functions** (≈120 violations)
- **Service Methods** (≈90 violations)
- **Utility Functions** (≈60 violations)

#### Example Pattern:
```typescript
// ❌ VIOLATION
export function useLibraryScanner(options: UseScannerOptions = {}) {
  const [isScanning, setIsScanning] = useState(false);
  // ...
  return { scan, isScanning, scanResult };
}

// ✅ FIXED
export function useLibraryScanner(options: UseScannerOptions = {}): UseScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  // ...
  return { scan, isScanning, scanResult };
}

// Return type definition
interface UseScannerReturn {
  scan: (path: string, targetLibraryId: number, scanOptions?: ScanOptions) => Promise<void>;
  isScanning: boolean;
  scanResult: ScanResult | null;
}
```

#### Complexity Levels:

**Low Complexity (≈200)** - Simple return types
```typescript
export function capitalize(str: string) {  // Returns string
export function isBlank(value: unknown) {  // Returns boolean
export function getId() {  // Returns number
```

**Medium Complexity (≈180)** - React hooks, async functions
```typescript
export function useCustomTheme() {  // Returns complex object
export async function fetchManga(id: number) {  // Returns Promise<Manga | null>
```

**High Complexity (≈70)** - Generics, conditional returns
```typescript
export function createAdapter<T>(config: Config) {  // Returns generic type
export function mapStatus(status: unknown, provider?: string) {  // Returns enum
```

---

### 2. Parameters Only Missing (≈120 violations, 16%)

**Pattern**: Return type present but parameters missing types

#### Common in:
- **Event Handlers** (≈50 violations)
- **Callback Functions** (≈40 violations)
- **Legacy Code** (≈30 violations)

#### Example Pattern:
```typescript
// ❌ VIOLATION
export function handleSubmit(data): Promise<void> {
  return api.submit(data);
}

// ✅ FIXED
export function handleSubmit(data: FormData): Promise<void> {
  return api.submit(data);
}
```

#### Sub-categories:

**Event Handlers** (≈50)
```typescript
// Missing event type
export function onClick(event): void {
  event.preventDefault();
}

// Fixed
export function onClick(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
```

**Callback Functions** (≈40)
```typescript
// Missing callback parameter types
export function processItems(items, callback): void {
  items.forEach(callback);
}

// Fixed
export function processItems<T>(
  items: T[],
  callback: (item: T) => void
): void {
  items.forEach(callback);
}
```

**Legacy Migrations** (≈30)
```typescript
// Old code without types
export function transform(input): TransformResult {
  return { ...input, processed: true };
}

// Fixed
export function transform(input: RawData): TransformResult {
  return { ...input, processed: true };
}
```

---

### 3. Both Missing (≈100 violations, 14%)

**Pattern**: No parameter or return types (CRITICAL)

#### Common in:
- **Unmigrated Legacy Code** (≈60 violations)
- **Test Helpers** (≈25 violations)
- **Migration Scripts** (≈15 violations)

#### Example Pattern:
```typescript
// ❌ CRITICAL VIOLATION
export function processData(input) {
  return input.map(item => item.value);
}

// ✅ FIXED
export function processData(input: DataItem[]): number[] {
  return input.map(item => item.value);
}
```

#### Risk Level: **CRITICAL**

These violations pose the highest risk because:
1. No type safety at module boundaries
2. Can propagate `any` types throughout codebase
3. Break TypeScript strict mode guarantees
4. Likely to cause runtime errors

#### Priority: **Fix First**

Estimated fix time: 3-5 minutes per violation (including type definition)

---

### 4. Partial Parameters (≈59 violations, 8%)

**Pattern**: Some parameters typed, some not

#### Common in:
- **Functions with Optional Parameters** (≈35 violations)
- **Variadic Functions** (≈15 violations)
- **Overloaded Functions** (≈9 violations)

#### Example Pattern:
```typescript
// ❌ VIOLATION - Second parameter untyped
export function searchManga(query: string, options): Promise<SearchResult[]> {
  return api.search(query, options);
}

// ✅ FIXED
export function searchManga(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  return api.search(query, options);
}
```

#### Sub-patterns:

**Optional Parameters** (≈35)
```typescript
// Missing type on optional param
export function formatDate(date: Date, format?): string {
  // ...
}

// Fixed
export function formatDate(date: Date, format?: string): string {
  // ...
}
```

**Variadic Functions** (≈15)
```typescript
// Missing rest parameter type
export function combine(base: string, ...parts): string {
  return [base, ...parts].join('/');
}

// Fixed
export function combine(base: string, ...parts: string[]): string {
  return [base, ...parts].join('/');
}
```

**Default Parameters** (≈9)
```typescript
// Missing type on default param
export function retry(fn: () => void, attempts = 3): Promise<void> {
  // attempts is 'any' because no explicit type
}

// Fixed
export function retry(fn: () => void, attempts: number = 3): Promise<void> {
  // attempts is properly typed as number
}
```

---

## Export Type Analysis

### Named Exports (≈650 violations, 89%)

**Most common pattern** - Standard function exports

```typescript
// Pattern
export function functionName(params): ReturnType { }
export const constName = (params): ReturnType => { }
export async function asyncName(params): Promise<T> { }
```

**Distribution**:
- `export function`: ≈420 violations (58%)
- `export const`: ≈150 violations (21%)
- `export async function`: ≈80 violations (11%)

**Fix priority**: Medium-High
- Critical for library code
- Important for shared utilities
- Medium priority for internal helpers

---

### Default Exports (≈60 violations, 8%)

**Less common** - Usually React components or main exports

```typescript
// Pattern
export default function ComponentName(props) { }
```

**Common in**:
- React components (≈40)
- Service instances (≈15)
- Configuration objects (≈5)

**Fix priority**: High
- Default exports are public API
- Often imported by external code
- Harder to refactor later

---

### Re-exports (≈19 violations, 3%)

**Rare** - Exported from barrel files or adapters

```typescript
// Pattern
export { someFunction } from './internal';
export * from './utils';
```

**Challenge**: May need to fix upstream types first

**Fix priority**: Low-Medium
- Check if types available upstream
- May need cascading fixes
- Could require interface updates

---

## File-by-File Breakdown

### Top 20 Files by Estimated Violation Count

Based on code analysis, project structure, and violation patterns:

| Rank | File | Est. Violations | Export Type | Priority | Fix Time |
|------|------|----------------|-------------|----------|----------|
| 1 | src/hooks/useProviderSearch.ts | 12 | Named | Critical | 45min |
| 2 | src/hooks/useMetadata.ts | 10 | Named | Critical | 35min |
| 3 | src/hooks/useDownloadQueue.ts | 9 | Named | High | 30min |
| 4 | src/hooks/useBackgroundTask.ts | 8 | Named | High | 25min |
| 5 | src/server/trpc/routers/manga.ts | 8 | Named | Critical | 30min |
| 6 | src/server/trpc/routers/metadata.ts | 7 | Named | Critical | 25min |
| 7 | src/hooks/useCalendar.ts | 7 | Named | High | 25min |
| 8 | src/hooks/useTaskCounts.ts | 6 | Named | Medium | 20min |
| 9 | src/utils/validation/guards/domain-guards.ts | 6 | Named | High | 20min |
| 10 | src/server/services/metadata/metadataService.ts | 6 | Named | Critical | 25min |
| 11 | src/components/addManga/utils/validation.ts | 5 | Named | Medium | 18min |
| 12 | src/server/services/search/UnifiedSearchService.ts | 5 | Named | Critical | 22min |
| 13 | src/utils/validation/schema-validation.ts | 5 | Named | Medium | 18min |
| 14 | src/hooks/useDomainSearch.ts | 5 | Named | Medium | 18min |
| 15 | src/hooks/useFilteredManga.ts | 4 | Named | Medium | 15min |
| 16 | src/server/parsers/UnifiedMetadataParser.ts | 4 | Named | High | 20min |
| 17 | src/server/services/calendar/CalendarEventService.ts | 4 | Named | Medium | 18min |
| 18 | src/utils/frontend/type-adapters.ts | 4 | Named | Medium | 15min |
| 19 | src/hooks/useLibraryScanner.ts | 4 | Named | High | 18min |
| 20 | src/hooks/useSettings.ts | 3 | Named | Medium | 12min |

### Directory Distribution

| Directory | Est. Violations | % of Total | Priority |
|-----------|----------------|------------|----------|
| src/hooks/ | 220 | 30% | High |
| src/server/trpc/routers/ | 95 | 13% | Critical |
| src/server/services/ | 155 | 21% | Critical |
| src/utils/ | 115 | 16% | Medium |
| src/components/ | 85 | 12% | Medium |
| src/server/parsers/ | 35 | 5% | High |
| src/server/adapters/ | 15 | 2% | High |
| src/lib/ | 9 | 1% | Low |

---

## Usage Analysis

### Internal-Only Exports (≈520 violations, 71%)

**Pattern**: Exported but only used within `src/`

**Characteristics**:
- Used by other files in the project
- Not part of public API
- Can infer types from usage
- Lower risk to change

**Fix priority**: Medium
- Important for maintainability
- Can be typed gradually
- Lower risk of breaking changes

**Example**:
```typescript
// src/utils/internal-helper.ts
export function processInternal(data) {  // Only used in src/
  return data.map(x => x * 2);
}

// Can infer from usage:
export function processInternal(data: number[]): number[] {
  return data.map(x => x * 2);
}
```

---

### External-Facing Exports (≈209 violations, 29%)

**Pattern**: Used in pages/, external consumers, or exported from index files

**Characteristics**:
- Part of public API surface
- Used in Next.js pages
- Exported from barrel files
- Critical for API stability

**Fix priority**: Critical
- Breaking changes impact consumers
- Must maintain backward compatibility
- Types become part of public contract

**Examples**:

**tRPC Procedures** (≈80 violations)
```typescript
// src/server/trpc/routers/manga.ts
export function getMangaById(id) {  // Used by frontend
  return prisma.manga.findUnique({ where: { id } });
}

// CRITICAL - Must match existing usage
export function getMangaById(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } });
}
```

**React Hooks** (≈90 violations)
```typescript
// src/hooks/useManga.ts
export function useManga(id) {  // Used in multiple pages
  const query = trpc.manga.getById.useQuery({ id });
  return query;
}

// CRITICAL - Return type must match
export function useManga(id: number): UseMangaResult {
  const query = trpc.manga.getById.useQuery({ id });
  return query;
}
```

**Utility Functions** (≈39 violations)
```typescript
// src/utils/formatters.ts
export function formatDate(date) {  // Used across app
  return date.toLocaleDateString();
}

// HIGH - Must handle all current usage
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString();
}
```

---

## Overlap Analysis

### Overlap with `explicit-function-return-type`

**Significant overlap exists** between this rule and `explicit-function-return-type`:

| Aspect | explicit-module-boundary-types | explicit-function-return-type |
|--------|--------------------------------|-------------------------------|
| Scope | **Exported functions only** | **All functions** |
| Parameters | ✅ Enforces types | ❌ Does not enforce |
| Return Type | ✅ Enforces types | ✅ Enforces types |
| Count | 729 violations | 1,382 violations |

### Violation Overlap

```
Total explicit-function-return-type: 1,382
Total explicit-module-boundary-types: 729

Overlap (exported functions): ≈650 (89% of boundary violations)
Unique to boundary-types (parameter issues): ≈79 (11%)
Unique to function-return-type (non-exported): ≈653 (47%)
```

### Fix Strategy

**Option 1: Fix boundary-types first** (Recommended)
- ✅ Fixes the most critical violations (exported API)
- ✅ Fixes both parameters AND return types
- ✅ Reduces function-return-type violations as side effect
- ⚠️ Still need to fix non-exported functions later

**Option 2: Fix function-return-type first**
- ⚠️ Only fixes return types, not parameters
- ⚠️ Misses critical API boundary issues
- ❌ Less impactful

**Recommendation**:
1. Fix `explicit-module-boundary-types` first (729)
2. This will auto-fix ≈650 `explicit-function-return-type` violations
3. Then fix remaining ≈732 non-exported function return types

---

## Recommendations

### Priority 1: Both Missing - Critical (100 violations)

**Why first**: Highest risk, no type safety at all

**Estimated time**: 6-8 hours (3-5 min per violation)

**Approach**:
1. Use ast-grep to find: `export function \w+\([^:)]+\) \{` (parameters without types)
2. Analyze function implementation to determine types
3. Add both parameter and return types
4. Validate against usage

**Example workflow**:
```bash
# Find violations
ast-grep --pattern 'export function $NAME($PARAMS) { $$$ }'

# For each violation:
# 1. Read function implementation
# 2. Identify parameter types from usage
# 3. Identify return type from return statements
# 4. Add types
# 5. Run type-check
```

---

### Priority 2: Parameters Only - High (120 violations)

**Why second**: Parameter types prevent unsafe argument passing

**Estimated time**: 8-12 hours (4-6 min per violation)

**Approach**:
1. Find functions with return types but untyped parameters
2. Check all call sites to determine expected types
3. Add parameter types
4. Validate no breaking changes

**Common fixes**:
```typescript
// Event handlers - add React types
onClick(event: React.MouseEvent<HTMLButtonElement>): void

// Callbacks - add function signature types
onComplete(callback: (result: T) => void): void

// Data processors - add specific types
transform(data: InputData): OutputData
```

---

### Priority 3: Return Type Only - Medium (450 violations)

**Why third**: Most violations, but parameters already typed

**Estimated time**: 15-20 hours (2-3 min per violation)

**Approach**:
1. Determine return type from implementation
2. For React hooks, create return type interfaces
3. For async functions, wrap in Promise<T>
4. For generic functions, use generic return types

**Patterns**:

**React Hooks**:
```typescript
// Create return interface
interface UseCustomHookReturn {
  data: Data | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCustomHook(): UseCustomHookReturn {
  // ...
}
```

**Async Functions**:
```typescript
export async function fetchData(id: number): Promise<Data | null> {
  const result = await api.get(`/data/${id}`);
  return result.data;
}
```

**Simple Functions**:
```typescript
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

---

### Priority 4: Partial Parameters - Medium (59 violations)

**Why last**: Fewer violations, often quick fixes

**Estimated time**: 4-6 hours (4-6 min per violation)

**Approach**:
1. Identify which parameters are missing types
2. Add types to untyped parameters
3. Ensure optional parameters have proper syntax
4. Validate default parameter types

---

## Fix Patterns by Category

### 1. React Hooks (≈220 violations)

**Pattern**: Create return type interfaces

```typescript
// Before
export function useCustomHook(id: number) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  return { data, loading, setData };
}

// After - Define return type
interface UseCustomHookReturn {
  data: Data | null;
  loading: boolean;
  setData: (data: Data | null) => void;
}

export function useCustomHook(id: number): UseCustomHookReturn {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  return { data, loading, setData };
}
```

**Convention**: Name return type as `Use{HookName}Return` or `Use{HookName}Result`

---

### 2. Async Service Functions (≈155 violations)

**Pattern**: Return `Promise<T>` with proper result type

```typescript
// Before
export async function createManga(data: MangaInput) {
  const manga = await prisma.manga.create({ data });
  return manga;
}

// After
export async function createManga(data: MangaInput): Promise<Manga> {
  const manga = await prisma.manga.create({ data });
  return manga;
}

// With error handling
export async function createManga(
  data: MangaInput
): Promise<AsyncResult<Manga, Error>> {
  try {
    const manga = await prisma.manga.create({ data });
    return ok(manga);
  } catch (error) {
    return err(error as Error);
  }
}
```

---

### 3. Type Guards (≈40 violations)

**Pattern**: Use type predicates

```typescript
// Before
export function isManga(value: unknown) {
  return value && typeof value === 'object' && 'title' in value;
}

// After - Type predicate
export function isManga(value: unknown): value is Manga {
  return value !== null &&
         typeof value === 'object' &&
         'title' in value &&
         'id' in value;
}
```

---

### 4. Utility Functions (≈115 violations)

**Pattern**: Explicit primitive or complex return types

```typescript
// Before - Simple
export function isEmpty(arr: unknown[]) {
  return arr.length === 0;
}

// After
export function isEmpty(arr: unknown[]): boolean {
  return arr.length === 0;
}

// Before - Complex
export function groupBy<T>(arr: T[], key: keyof T) {
  return arr.reduce((acc, item) => {
    const k = item[key] as string;
    if (!acc[k]) acc[k] = [];
    acc[k]!.push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// After
export function groupBy<T>(
  arr: T[],
  key: keyof T
): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = item[key] as string;
    if (!acc[k]) acc[k] = [];
    acc[k]!.push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
```

---

### 5. Event Handlers (≈50 violations)

**Pattern**: Use React event types

```typescript
// Before
export function handleClick(event) {
  event.preventDefault();
  console.log('Clicked');
}

// After
export function handleClick(
  event: React.MouseEvent<HTMLButtonElement>
): void {
  event.preventDefault();
  console.log('Clicked');
}

// Generic handler
export function handleSubmit(
  event: React.FormEvent<HTMLFormElement>
): void {
  event.preventDefault();
  // ...
}
```

---

## Automated Fix Tools

### AST-Grep Patterns

**Find exported functions without return types**:
```bash
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/ \
  | grep -v ': ' \
  | head -20
```

**Find functions with untyped parameters**:
```bash
ast-grep --pattern 'export function $NAME($PARAM) { $$$ }' src/ \
  | grep -v '$PARAM:' \
  | head -20
```

### TypeScript Compiler Analysis

**Generate type inference report**:
```bash
# Get inferred types for all functions
npx tsc --noEmit --declaration --emitDeclarationOnly \
  --declarationDir /tmp/types 2>&1

# Analyze /tmp/types/*.d.ts to see inferred return types
```

---

## Validation Strategy

### Per-Batch Validation

After fixing each batch of 25-30 violations:

```bash
# 1. TypeScript compilation
npm run type-check

# 2. ESLint check
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# 3. Verify reduction
BEFORE=729
AFTER=$(npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l)
FIXED=$((BEFORE - AFTER))
echo "Fixed: $FIXED violations"

# 4. Run relevant tests
npm test -- --findRelatedTests [changed-files]
```

### Final Validation

```bash
# Should output 0
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# Type check should pass
npm run type-check

# All tests should pass
npm test
```

---

## Estimated Timeline

### Option A: Sequential (Safer)

| Wave | Target | Est. Time | Cumulative |
|------|--------|-----------|------------|
| Wave 1: Both Missing | 100 | 6-8 hours | 8 hours |
| Wave 2: Parameters Only | 120 | 8-12 hours | 20 hours |
| Wave 3: Return Type Only (Part 1) | 225 | 8-10 hours | 30 hours |
| Wave 4: Return Type Only (Part 2) | 225 | 7-10 hours | 40 hours |
| Wave 5: Partial Parameters | 59 | 4-6 hours | 46 hours |
| **Total** | **729** | **33-46 hours** | **1-2 weeks** |

### Option B: Parallel (Faster)

Divide work by directory, run 2-3 agents in parallel:

| Day | Agent A | Agent B | Agent C | Daily Total |
|-----|---------|---------|---------|-------------|
| 1 | hooks/ (110) | server/trpc/ (95) | server/services/ (80) | 285 |
| 2 | hooks/ (110) | server/services/ (75) | utils/ (58) | 243 |
| 3 | utils/ (57) | components/ (85) | server/parsers/ (35) | 177 |
| 4 | Remaining (24) | Validation | Validation | 24 |

**Total time**: 3-4 days with parallel execution

---

## Success Criteria

### Per-Batch
- ✅ All violations in batch fixed with proper types
- ✅ TypeScript compilation passes with no new errors
- ✅ ESLint violations count reduced by batch size
- ✅ No breaking changes to existing usage
- ✅ Tests pass for affected files

### Overall Completion
- ✅ 0 violations remaining (or justified exceptions documented)
- ✅ All exported functions have explicit parameter types
- ✅ All exported functions have explicit return types
- ✅ No new type safety violations introduced
- ✅ Full test suite passes
- ✅ Type-check passes with strict mode
- ✅ Documentation updated for any breaking changes

---

## Risk Mitigation

### 1. Breaking Changes

**Risk**: Adding explicit types may reveal type mismatches

**Mitigation**:
- Validate all call sites before committing
- Use union types where multiple types are valid
- Add overloads for complex functions
- Document breaking changes in commit message

### 2. Type Inference Issues

**Risk**: Complex functions may be hard to type correctly

**Mitigation**:
- Use TypeScript's inferred types as starting point
- Check declaration files (`.d.ts`) for hints
- Analyze all return statements
- Use generics for flexible functions

### 3. External Dependencies

**Risk**: Re-exported types may not have upstream types

**Mitigation**:
- Check library type definitions
- Create type definitions if needed
- Use `unknown` as last resort
- Document why types are incomplete

---

## Sample Commits

### Batch Commit Message Format

```
fix(types): Add explicit types to exported functions - Wave 1 Batch 3

Adds explicit parameter and return types to exported functions missing
both (explicit-module-boundary-types violations).

Files changed: 8
Violations fixed: 25
Complexity: Low-Medium
Risk: Low

Changes:
- src/hooks/useCustomHook.ts: Added UseCustomHookReturn interface (3 functions)
- src/utils/helpers.ts: Added parameter types to event handlers (5 functions)
- src/server/services/manga.ts: Added Promise<T> return types (4 functions)
- src/utils/validation/guards.ts: Added type predicates (3 functions)
[etc.]

Validation:
- TypeScript: ✅ PASS
- ESLint: ✅ 25 violations resolved
- Tests: ✅ PASS (affected: 12 tests)
```

---

## Next Steps

### Immediate Actions

1. **Review this analysis** - Confirm categorization and estimates
2. **Choose execution strategy** - Sequential vs. Parallel
3. **Set up validation pipeline** - Automate type-check + lint
4. **Create branch** - `fix/explicit-module-boundary-types`
5. **Begin Wave 1** - Fix "Both Missing" violations first

### Long-term Strategy

1. Complete all 729 violations (~2-4 weeks)
2. Move to `explicit-function-return-type` (remaining 732)
3. Enable stricter ESLint config
4. Prevent future violations in CI/CD
5. Document type patterns for future development

---

## Conclusion

With 729 violations of `explicit-module-boundary-types`, this represents a significant gap in the project's type safety at module boundaries. However, the violations are well-distributed and follow predictable patterns:

- **62% are return type only** - Relatively quick to fix
- **16% are parameters only** - Higher priority, moderate effort
- **14% are both missing** - Critical priority, immediate fixes needed
- **8% are partial parameters** - Lower priority, simple fixes

**Recommended approach**: Fix "Both Missing" violations first (100), then "Parameters Only" (120), followed by the larger set of "Return Type Only" (450) violations. This prioritizes the highest-risk issues while building momentum with the larger bulk of simpler fixes.

**Estimated completion**: 33-46 hours sequential, or 3-4 days with parallel agent deployment.

---

*Report generated by Agent C*
*Status: Complete and ready for execution*
*Next: Await coordinator approval to begin Wave 1 fixes*
