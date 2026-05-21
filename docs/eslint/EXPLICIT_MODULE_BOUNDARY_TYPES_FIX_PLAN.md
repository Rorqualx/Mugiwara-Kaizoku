# Systematic Plan: Fix @typescript-eslint/explicit-module-boundary-types Violations

**Created**: 2025-11-09
**Branch**: `claude/fix-eslint-module-boundary-types-011CUwpxTMC5Ui9f1E9BcPcu`
**Status**: Ready for Execution
**Total Violations**: 621-633 remaining (13.2% complete - 96 already fixed)

---

## Executive Summary

This plan provides a systematic approach to fix all remaining `@typescript-eslint/explicit-module-boundary-types` violations. The rule enforces that **all exported functions** must have explicit parameter and return types, which is critical for API boundaries and type safety.

### Current State
- **Total violations**: 729 (documented)
- **Already fixed**: 96 violations (13.2%)
- **Remaining**: 633 violations
- **Progress**: Wave 1 partially complete, Wave 2-4 pending

### Key Insight: Smart Overlap Strategy
**89% of these violations (≈650) overlap with `explicit-function-return-type` violations**. Fixing these violations will automatically resolve 650 `explicit-function-return-type` violations as a bonus!

---

## Violation Categories (Prioritized)

Based on the comprehensive analysis in `agent-c-boundary-types-analysis.md`, violations fall into 4 categories:

| Category | Count | % | Priority | Est. Time | Why This Order |
|----------|-------|---|----------|-----------|----------------|
| **1. Both Missing** | 100 | 14% | **CRITICAL** | 6-8 hours | Highest risk - no type safety at all |
| **2. Parameters Only** | 120 | 16% | **HIGH** | 8-12 hours | Prevents unsafe argument passing |
| **3. Return Type Only** | 450 | 62% | **MEDIUM** | 15-20 hours | Most violations, but params already typed |
| **4. Partial Parameters** | 59 | 8% | **LOW** | 4-6 hours | Smallest count, often quick fixes |
| **TOTAL** | **729** | **100%** | | **33-46 hours** | |

---

## Phase 1: CRITICAL - Both Missing (100 violations, 6-8 hours)

### Why First
- **Zero type safety** - Most dangerous violations
- **Can propagate `any` types** throughout codebase
- **Breaks TypeScript strict mode** guarantees
- **Likely to cause runtime errors**

### Pattern Detection
```bash
# Find functions with untyped parameters (no colons)
ast-grep --pattern 'export function $NAME($PARAM) { $$$ }' src/ | grep -v ':'
```

### Common Locations
- **Unmigrated Legacy Code**: ≈60 violations
- **Test Helpers**: ≈25 violations
- **Migration Scripts**: ≈15 violations

### Fix Pattern
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

### Execution Strategy
1. **Batch size**: 25 violations per batch (4 batches total)
2. **Approach**:
   - Read function implementation
   - Identify parameter types from usage within function
   - Identify return type from all return statements
   - Check all call sites to validate types
   - Add both parameter and return types
3. **Validation**: TypeScript compilation + ESLint after each batch

### Estimated Batches
| Batch | Target | Files | Est. Time |
|-------|--------|-------|-----------|
| 1.1 | Legacy code | 15 | 2 hours |
| 1.2 | Test helpers | 10 | 1.5 hours |
| 1.3 | Migration scripts + utilities | 10 | 1.5 hours |
| 1.4 | Remaining edge cases | 15 | 2 hours |

---

## Phase 2: HIGH - Parameters Only (120 violations, 8-12 hours)

### Why Second
- **Parameter types prevent unsafe argument passing**
- **Return types already present** (easier to validate)
- **Affects public API surfaces**

### Common Sub-categories

#### 2.1 Event Handlers (≈50 violations)
```typescript
// ❌ VIOLATION
export function onClick(event): void {
  event.preventDefault();
}

// ✅ FIXED
export function onClick(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
```

**Common types needed**:
- `React.MouseEvent<T>`
- `React.FormEvent<HTMLFormElement>`
- `React.ChangeEvent<HTMLInputElement>`
- `React.KeyboardEvent<T>`

#### 2.2 Callback Functions (≈40 violations)
```typescript
// ❌ VIOLATION
export function processItems(items, callback): void {
  items.forEach(callback);
}

// ✅ FIXED
export function processItems<T>(
  items: T[],
  callback: (item: T) => void
): void {
  items.forEach(callback);
}
```

#### 2.3 Legacy Migrations (≈30 violations)
```typescript
// ❌ VIOLATION
export function transform(input): TransformResult {
  return { ...input, processed: true };
}

// ✅ FIXED
export function transform(input: RawData): TransformResult {
  return { ...input, processed: true };
}
```

### Execution Strategy
1. **Batch size**: 20-25 violations per batch
2. **Approach**:
   - Group by sub-category (event handlers, callbacks, legacy)
   - Check all call sites to determine expected types
   - Add parameter types (return type already exists)
   - Validate no breaking changes to callers
3. **Tools**: ast-grep to find patterns, TypeScript LSP for type hints

### Estimated Batches
| Batch | Target | Est. Time |
|-------|--------|-----------|
| 2.1 | Event handlers | 3 hours |
| 2.2 | Callback functions | 2-3 hours |
| 2.3 | Legacy migrations | 2 hours |
| 2.4 | Remaining | 2 hours |

---

## Phase 3: MEDIUM - Return Type Only (450 violations, 15-20 hours)

### Why Third
- **Largest category** but parameters already typed
- **Lower risk** than missing parameter types
- **Can leverage TypeScript inference** for hints

### Sub-categories by Complexity

#### 3.1 Low Complexity (≈200 violations, 6-8 hours)
**Pattern**: Simple primitive or object returns

```typescript
// ❌ Simple functions
export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ✅ FIXED
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ❌ Boolean checks
export function isBlank(value: unknown) {
  return value === null || value === undefined || value === '';
}

// ✅ FIXED
export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}
```

**Approach**: Add obvious return types (string, boolean, number, void)

#### 3.2 Medium Complexity - React Hooks (≈180 violations, 6-8 hours)
**Pattern**: Custom hooks returning complex objects

```typescript
// ❌ VIOLATION
export function useLibraryScanner(options: UseScannerOptions = {}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const scan = useCallback(async (path: string) => {
    // ... implementation
  }, []);

  return { scan, isScanning, scanResult };
}

// ✅ FIXED - Define return type interface
interface UseLibraryScannerReturn {
  scan: (path: string, targetLibraryId: number, options?: ScanOptions) => Promise<void>;
  isScanning: boolean;
  scanResult: ScanResult | null;
}

export function useLibraryScanner(
  options: UseScannerOptions = {}
): UseLibraryScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const scan = useCallback(async (path: string) => {
    // ... implementation
  }, []);

  return { scan, isScanning, scanResult };
}
```

**Naming convention**: `Use{HookName}Return` or `Use{HookName}Result`

**Top files** (from analysis):
- `src/hooks/useProviderSearch.ts` - 12 violations
- `src/hooks/useMetadata.ts` - 10 violations
- `src/hooks/useDownloadQueue.ts` - 9 violations
- `src/hooks/useBackgroundTask.ts` - 8 violations

**CRITICAL LEARNING**: Cannot use `:unknown` for hook return types that are destructured!
```typescript
// ❌ WRONG - Breaks destructuring
export function useCustomHook(): unknown {
  return { data, loading };
}
// Component: const { data } = useCustomHook(); ❌ Error!

// ✅ CORRECT - Define proper interface
export function useCustomHook(): UseCustomHookReturn {
  return { data, loading };
}
```

#### 3.3 Medium Complexity - Async Functions (≈70 violations, 3-4 hours)
**Pattern**: Async service functions

```typescript
// ❌ VIOLATION
export async function fetchManga(id: number) {
  const manga = await prisma.manga.findUnique({ where: { id } });
  return manga;
}

// ✅ FIXED
export async function fetchManga(id: number): Promise<Manga | null> {
  const manga = await prisma.manga.findUnique({ where: { id } });
  return manga;
}

// With AsyncResult pattern
export async function createManga(data: MangaInput): Promise<AsyncResult<Manga, Error>> {
  try {
    const manga = await prisma.manga.create({ data });
    return ok(manga);
  } catch (error) {
    return err(error as Error);
  }
}
```

**Top files**:
- `src/server/trpc/routers/manga.ts` - 8 violations
- `src/server/trpc/routers/metadata.ts` - 7 violations
- `src/server/services/metadata/metadataService.ts` - 6 violations

### Execution Strategy for Phase 3
1. **Start with low complexity** (200 violations) - Quick wins
2. **Move to async functions** (70 violations) - Clear patterns
3. **Finish with React hooks** (180 violations) - Requires interface creation

### Estimated Batches
| Batch | Category | Count | Est. Time |
|-------|----------|-------|-----------|
| 3.1 | Low complexity utilities | 50 | 2 hours |
| 3.2 | Low complexity utilities | 50 | 2 hours |
| 3.3 | Low complexity utilities | 50 | 2 hours |
| 3.4 | Low complexity utilities | 50 | 2 hours |
| 3.5 | Async service functions | 35 | 2 hours |
| 3.6 | Async service functions | 35 | 2 hours |
| 3.7 | React hooks (simple) | 45 | 2 hours |
| 3.8 | React hooks (complex) | 45 | 2-3 hours |
| 3.9 | React hooks (complex) | 45 | 2-3 hours |
| 3.10 | React hooks (complex) | 45 | 2-3 hours |

---

## Phase 4: LOW - Partial Parameters (59 violations, 4-6 hours)

### Why Last
- **Smallest category**
- **Often quick fixes** (just add type to one parameter)
- **Lower priority** than complete type missing

### Common Patterns

#### 4.1 Optional Parameters (≈35 violations)
```typescript
// ❌ VIOLATION
export function formatDate(date: Date, format?): string {
  return format ? date.toLocaleDateString(format) : date.toLocaleDateString();
}

// ✅ FIXED
export function formatDate(date: Date, format?: string): string {
  return format ? date.toLocaleDateString(format) : date.toLocaleDateString();
}
```

#### 4.2 Variadic Functions (≈15 violations)
```typescript
// ❌ VIOLATION
export function combine(base: string, ...parts): string {
  return [base, ...parts].join('/');
}

// ✅ FIXED
export function combine(base: string, ...parts: string[]): string {
  return [base, ...parts].join('/');
}
```

#### 4.3 Default Parameters (≈9 violations)
```typescript
// ❌ VIOLATION - 'attempts' inferred as 'any'
export function retry(fn: () => void, attempts = 3): Promise<void> {
  // ...
}

// ✅ FIXED - Explicit number type
export function retry(fn: () => void, attempts: number = 3): Promise<void> {
  // ...
}
```

### Execution Strategy
1. **Single batch approach** (59 violations, 4-6 hours)
2. Group by pattern (optional, variadic, defaults)
3. Quick fixes since return type already present

---

## Automation & Tools

### 1. AST-Grep Patterns

#### Find functions without return types
```bash
# Exported functions missing return types
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/ \
  | grep -v ': ' \
  | grep -v 'export function' \
  | sort | uniq

# Exported async functions missing return types
ast-grep --pattern 'export async function $NAME($$$) { $$$ }' src/ \
  | grep -v ': Promise'
```

#### Find functions with untyped parameters
```bash
# Single parameter without type
ast-grep --pattern 'export function $NAME($PARAM) { $$$ }' src/ \
  | grep -v '$PARAM:' \
  | head -20

# Multiple parameters - at least one missing type
ast-grep --pattern 'export function $NAME($$$) { $$$ }' src/ \
  | grep '([^:)]*,' \
  | head -20
```

### 2. TypeScript Compiler Inference

Get TypeScript's inferred return types:
```bash
# Generate declaration files to see inferred types
npx tsc --declaration --emitDeclarationOnly --outDir /tmp/types 2>&1

# Check generated .d.ts files
find /tmp/types -name "*.d.ts" -exec grep "export function" {} \; | head -20
```

### 3. Batch Validation Script

Create `scripts/validate-boundary-types.sh`:
```bash
#!/bin/bash
# Validate batch of boundary type fixes

echo "=== Running TypeScript Compilation ==="
npm run type-check
TYPECHECK_EXIT=$?

echo "=== Counting Remaining Violations ==="
VIOLATIONS=$(npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l)

echo "=== Running Tests ==="
npm test -- --findRelatedTests $@
TEST_EXIT=$?

echo "=== Summary ==="
echo "TypeScript: $([ $TYPECHECK_EXIT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Violations Remaining: $VIOLATIONS"
echo "Tests: $([ $TEST_EXIT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"

exit $((TYPECHECK_EXIT + TEST_EXIT))
```

---

## Validation Strategy

### Per-Batch Validation (After every 20-30 fixes)

```bash
# 1. TypeScript compilation
npm run type-check

# 2. ESLint violation count
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# 3. Verify reduction
BEFORE=633  # Update with current count
AFTER=$(npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l)
FIXED=$((BEFORE - AFTER))
echo "✅ Fixed: $FIXED violations in this batch"

# 4. Run relevant tests
npm test -- --findRelatedTests [changed-files]
```

### Final Validation (After all phases complete)

```bash
# Should output 0
npm run lint 2>&1 | grep "explicit-module-boundary-types" | wc -l

# Full type check should pass
npm run type-check

# All tests should pass
npm test

# Check smart overlap bonus
npm run lint 2>&1 | grep "explicit-function-return-type" | wc -l
# Should be reduced by ~650 violations!
```

---

## Smart Overlap Strategy

### The Bonus Effect
**Fixing `explicit-module-boundary-types` automatically fixes `explicit-function-return-type`**

| Metric | Value |
|--------|-------|
| Module boundary violations | 729 |
| Overlap with function return type | ~650 (89%) |
| **Total impact** | **1,379 violations fixed for price of 729!** |

### Why This Works
Both rules require explicit return types on functions. The difference:
- `explicit-module-boundary-types`: Only exported functions
- `explicit-function-return-type`: All functions

When we fix an exported function's return type, we satisfy both rules simultaneously!

```typescript
// ❌ Violates BOTH rules
export function getManga(id: number) {
  return prisma.manga.findUnique({ where: { id } });
}

// ✅ Fixes BOTH violations with one change
export function getManga(id: number): Promise<Manga | null> {
  return prisma.manga.findUnique({ where: { id } });
}
```

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Risk**: Adding explicit types may reveal type mismatches at call sites

**Mitigation**:
- Validate all call sites before committing
- Use union types where multiple types are valid: `string | number`
- Add function overloads for complex cases
- Document breaking changes in commit message

**Example**:
```typescript
// Before: Accepts any type (unsafe)
export function format(value) {
  return String(value);
}

// After: Reveals that some callers pass incompatible types
export function format(value: string | number): string {
  return String(value);
}
// Now TypeScript will error if callers pass objects, arrays, etc.
```

### Risk 2: Complex Type Inference
**Risk**: Some functions have complex return types that are hard to type correctly

**Mitigation**:
- Use TypeScript LSP to see inferred types
- Check generated `.d.ts` declaration files
- Analyze all return statements in function
- Use generics for flexible functions
- Use `ReturnType<typeof fn>` utility type as hint

**Example**:
```typescript
// Hard to type manually
export function createAdapter<T>(config: Config) {
  return {
    fetch: (id: string) => fetch<T>(`/api/${id}`),
    create: (data: T) => post<T>('/api', data),
    // ... many methods
  };
}

// Use TypeScript to help
type AdapterReturn<T> = ReturnType<typeof createAdapterImpl<T>>;
export function createAdapter<T>(config: Config): AdapterReturn<T> {
  return createAdapterImpl<T>(config);
}
```

### Risk 3: Hook Return Type Destructuring
**Risk**: Using `:unknown` breaks destructuring in components

**Critical Rule**: NEVER use `:unknown` for hook return types!

**Solution**: Always create proper return type interfaces

```typescript
// ❌ BREAKS DESTRUCTURING
export function useCustomHook(): unknown {
  return { data: 'test', loading: false };
}
// const { data } = useCustomHook(); ❌ Error!

// ✅ WORKS CORRECTLY
interface UseCustomHookReturn {
  data: string;
  loading: boolean;
}

export function useCustomHook(): UseCustomHookReturn {
  return { data: 'test', loading: false };
}
// const { data } = useCustomHook(); ✅ Works!
```

---

## Commit Strategy

### Batch Commit Message Format

```
fix(types): Add explicit module boundary types - Phase [X] Batch [Y]

Adds explicit parameter and return types to exported functions violating
@typescript-eslint/explicit-module-boundary-types.

Category: [Both Missing | Parameters Only | Return Type Only | Partial]
Files changed: [N]
Violations fixed: [N]
Complexity: [Low | Medium | High]
Risk: [Low | Medium | High]

Changes:
- [file 1]: [description] ([N] functions)
- [file 2]: [description] ([N] functions)
- [file 3]: [description] ([N] functions)

Validation:
- TypeScript: ✅ PASS
- ESLint: ✅ [N] violations resolved
- Tests: ✅ PASS ([N] tests affected)

Smart Overlap Bonus:
- Auto-resolved [N] explicit-function-return-type violations

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Example Commit
```
fix(types): Add explicit module boundary types - Phase 1 Batch 1

Adds explicit parameter and return types to exported functions with both
parameter and return types missing (critical priority).

Category: Both Missing (Critical)
Files changed: 15
Violations fixed: 25
Complexity: Low-Medium
Risk: Low

Changes:
- src/server/services/legacy/migration-helpers.ts: Added types to 8 migration functions
- src/utils/data-processing.ts: Added types to 6 utility functions
- src/components/helpers/format-utils.ts: Added types to 4 formatters
- src/test/helpers/mock-data.ts: Added types to 7 test helpers

Validation:
- TypeScript: ✅ PASS (0 new errors)
- ESLint: ✅ 25 violations resolved
- Tests: ✅ PASS (12 affected tests)

Smart Overlap Bonus:
- Auto-resolved 25 explicit-function-return-type violations

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Execution Timeline

### Option A: Sequential (Safer, Recommended for Phase 1-2)

| Phase | Target | Est. Time | Cumulative | Risk |
|-------|--------|-----------|------------|------|
| Phase 1: Both Missing | 100 | 6-8 hours | 8 hours | High |
| Phase 2: Parameters Only | 120 | 8-12 hours | 20 hours | Medium |
| Phase 3: Return Type Only (Part 1) | 225 | 8-10 hours | 30 hours | Low |
| Phase 3: Return Type Only (Part 2) | 225 | 7-10 hours | 40 hours | Low |
| Phase 4: Partial Parameters | 59 | 4-6 hours | 46 hours | Low |
| **TOTAL** | **729** | **33-46 hours** | **1-2 weeks** | |

### Option B: Parallel (Faster, for Phase 3-4)

After completing high-risk Phase 1-2 sequentially, parallelize Phase 3:

| Day | Agent A | Agent B | Agent C | Daily Total |
|-----|---------|---------|---------|-------------|
| 1 | Low complexity utils (50) | Async functions (35) | React hooks simple (45) | 130 |
| 2 | Low complexity utils (50) | Async functions (35) | React hooks (45) | 130 |
| 3 | Low complexity utils (50) | React hooks (45) | React hooks (45) | 140 |
| 4 | Low complexity utils (50) | React hooks (45) | Partial params (59) | 154 |

**Total time**: 3-4 days with 3 parallel agents (Phase 3-4 only)

---

## Success Criteria

### Per-Batch Success
- ✅ All violations in batch fixed with proper types
- ✅ TypeScript compilation passes (0 new errors)
- ✅ ESLint violations count reduced by batch size
- ✅ No breaking changes to existing call sites
- ✅ Tests pass for affected files
- ✅ Code review self-check completed

### Overall Completion
- ✅ 0 violations remaining (target: 0/729)
- ✅ All exported functions have explicit parameter types
- ✅ All exported functions have explicit return types
- ✅ No new type safety violations introduced
- ✅ Full test suite passes
- ✅ Type-check passes with strict mode
- ✅ Smart overlap bonus achieved (~650 function return type violations auto-resolved)
- ✅ Documentation updated if breaking changes made

---

## Progress Tracking

### Current Status
- **Total violations**: 633 remaining (96 already fixed)
- **Progress**: 13.2% complete
- **Current phase**: Phase 1 (Both Missing) - Not started
- **Next action**: Begin Phase 1 Batch 1

### Progress Dashboard
Track progress in `TYPE_SAFETY_PROGRESS.md`:

| Phase | Target | Fixed | Remaining | % Complete |
|-------|--------|-------|-----------|------------|
| Phase 1: Both Missing | 100 | 0 | 100 | 0% |
| Phase 2: Parameters Only | 120 | 0 | 120 | 0% |
| Phase 3: Return Type Only | 450 | 0 | 450 | 0% |
| Phase 4: Partial Parameters | 59 | 0 | 59 | 0% |
| **TOTAL** | **729** | **96** | **633** | **13.2%** |

---

## Next Actions

### Immediate (Phase 1 Batch 1)
1. ✅ Review this plan with user
2. ⏳ Identify first 25 "Both Missing" violations using ast-grep
3. ⏳ Create Phase 1 Batch 1 target file list
4. ⏳ Begin fixing violations
5. ⏳ Validate and commit

### Short-term (This Week)
- Complete Phase 1 (Both Missing - 100 violations)
- Begin Phase 2 (Parameters Only - 120 violations)
- Establish velocity metrics

### Long-term (Next 2 Weeks)
- Complete all phases (729 violations)
- Achieve ~650 smart overlap bonus
- Update to ~21% total progress on TYPE_SAFETY_PROGRESS
- Create PR with all boundary type fixes

---

## References

### Documentation
- **Main Plan**: `TYPE_SAFETY_VIOLATIONS_PLAN.md`
- **Progress Tracker**: `TYPE_SAFETY_PROGRESS.md`
- **Agent Analysis**: `agent-c-boundary-types-analysis.md` (1,015 lines)
- **ESLint Config**: `eslint.config.mjs:108`
- **TypeScript Config**: `tsconfig.json` (strict mode)
- **Claude Guide**: `CLAUDE.md`

### Related Work
- Wave 1 Batch 1-3 already complete (96 violations fixed)
- Wave 2 in progress (no-unsafe-argument - different rule)
- Phase 2-3 complete (AniList + manga detail page)

---

**Status**: Ready for execution
**Recommended Start**: Phase 1 Batch 1 (25 "Both Missing" violations)
**Expected Completion**: 33-46 hours (~1-2 weeks)
**Smart Overlap Bonus**: ~650 additional violations auto-resolved

---

*Plan created by Claude Code Assistant*
*Last updated: 2025-11-09*
