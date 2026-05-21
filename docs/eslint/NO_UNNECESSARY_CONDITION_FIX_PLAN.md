# @typescript-eslint/no-unnecessary-condition Fix Plan

*Status: Active*
*Violations: 2,037*
*Created: 2025-11-09*
*Branch: claude/fix-unnecessary-condition-violations-011CUwphTnojQL6B1igmL8mu*

## Executive Summary

This document outlines a systematic approach to fix 2,037 violations of `@typescript-eslint/no-unnecessary-condition`. The violations fall into 6 main categories, with approximately **60% auto-fixable** and **40% requiring type refactoring**.

**Estimated Effort:**
- Phase 1 (Auto-fixes): 8-12 hours
- Phase 2 (Type Refactoring): 20-30 hours
- Phase 3 (Manual Review): 10-15 hours
- **Total**: 38-57 hours

---

## Violation Categories

### Category Breakdown

| Category | Count | Severity | Auto-fixable | Strategy |
|----------|-------|----------|--------------|----------|
| 1. Auto-generated type guards | 300-400 | Medium | Yes | Fix generator script |
| 2. Excessive defensive checking | 500-600 | High | Partial | Type refactoring |
| 3. Redundant null checks | 600-800 | Medium-High | Yes | ESLint auto-fix |
| 4. Nullish coalescing redundancy | 400-500 | Low-Medium | Yes | ESLint auto-fix |
| 5. Optional chaining + null check | 200-300 | Medium | Yes | Pattern replacement |
| 6. Always true/false conditions | 100-200 | Low | Partial | Case-by-case |
| **TOTAL** | **2,100-2,800** | - | **~60%** | **Phased approach** |

---

## Phase 1: Automated Fixes (60-70% of violations)

### 1.1 Fix Type Guard Generator Script

**Target**: 300-400 violations in generated type guards

**Root Cause**: `scripts/generate-type-guards.ts` generates unnecessary undefined checks for optional properties.

**Current Pattern** (lines 104-110):
```typescript
// VIOLATION - generated.ts
export function isComicInfoMetadata(candidate: unknown): candidate is ComicInfoMetadata {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate["Series"] === undefined || typeof candidate["Series"] === 'string') &&
    (candidate["Number"] === undefined || typeof candidate["Number"] === 'string')
  );
}
```

**Fixed Pattern**:
```typescript
// CORRECT - for optional properties
export function isComicInfoMetadata(candidate: unknown): candidate is ComicInfoMetadata {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (!("Series" in candidate) || typeof candidate["Series"] === 'string') &&
    (!("Number" in candidate) || typeof candidate["Number"] === 'string')
  );
}
```

**Action Items**:
1. ✅ Update `scripts/generate-type-guards.ts` at line 104
2. ✅ Regenerate type guards: `bun run generate:type-guards`
3. ✅ Verify fixes: `bun run lint src/utils/type-guards/generated.ts`

**Files Affected**:
- `src/utils/type-guards/generated.ts` (primary)
- `docs/eslint/no-unsafe-assignment/wave5-6/type-guards.ts` (secondary)

---

### 1.2 Remove Redundant Null/Undefined Checks

**Target**: 600-800 violations

**Pattern 1: Double null check**
```typescript
// VIOLATION
if (value !== undefined && value !== null) {
  // use value
}

// FIX
if (value != null) { // != catches both null and undefined
  // use value
}
```

**Pattern 2: Redundant checks after type narrowing**
```typescript
// VIOLATION
if (description !== undefined && description !== null) {
  result.description = description;
}

// FIX
if (description != null) {
  result.description = description;
}
// OR
result.description = description ?? result.description;
```

**Action Items**:
1. ✅ Create regex-based find/replace script
2. ✅ Replace `!== undefined && .* !== null` with `!= null`
3. ✅ Replace `!== null && .* !== undefined` with `!= null`
4. ✅ Run ESLint auto-fix: `bun run lint --fix`

**High Priority Files** (722 occurrences of `!== null`):
- `src/utils/type-guards/generated.ts` (25 occurrences)
- `src/server/trpc/routers/manga.ts` (54 occurrences)
- `src/utils/metadata-field-mapping.ts` (14 occurrences)
- `src/components/addManga/steps/confirmationStep/ConfirmationStep.tsx` (14 occurrences)

---

### 1.3 Fix Nullish Coalescing Redundancy

**Target**: 400-500 violations

**Pattern**: `?? null` or `?? undefined`

```typescript
// VIOLATION
const title = manga?.title ?? null;
const author = manga?.author ?? undefined;

// FIX Option 1: Meaningful default
const title = manga?.title ?? 'Unknown Title';

// FIX Option 2: Accept undefined
const title = manga?.title; // undefined if not present

// FIX Option 3: Empty string default
const author = manga?.author ?? '';
```

**Action Items**:
1. ✅ Search for `?? null` pattern (341 occurrences in 101 files)
2. ✅ Search for `?? undefined` pattern (134 occurrences in 49 files)
3. ✅ Evaluate each case for appropriate default value
4. ✅ Replace with meaningful defaults or remove coalescing

**High Priority Files** (`?? null` count):
- `src/pages/manga/[id].tsx` (28 occurrences)
- `src/server/services/metadata/unified-merger.ts` (38 `?? undefined`)
- `src/utils/validation/guards/metadata.ts` (35 `?? undefined`)
- `src/types/manga/adapters.ts` (26 `?? undefined`)

---

### 1.4 Remove Redundant Checks After Optional Chaining

**Target**: 200-300 violations

**Pattern**: Checking for null/undefined after using `?.`

```typescript
// VIOLATION
if (manga?.chapters?.length !== undefined) {
  // Optional chaining already returns undefined if any part is null
}

// FIX
if (manga?.chapters?.length) {
  // Truthy check is sufficient
}
// OR
const length = manga?.chapters?.length ?? 0;
```

**Action Items**:
1. ✅ Search for patterns: `if (.*?\..* !== undefined)`
2. ✅ Search for patterns: `if (.*?\..* !== null)`
3. ✅ Remove redundant null/undefined checks
4. ✅ Use truthy checks or nullish coalescing

**Evidence**: 844 occurrences of `if (.*?\.` patterns across 278 files

---

## Phase 2: Type Refactoring (30-40% of violations)

### 2.1 Fix Excessive Defensive Type Checking

**Target**: 500-600 violations

**Root Cause**: Using `unknown` types without proper type definitions, leading to verbose runtime checks.

**Example: useTaskCounts.ts** (lines 147-152)

**Current Code**:
```typescript
// VIOLATION - 6 identical patterns
active: typeof dataUnknown === 'object' &&
        dataUnknown !== null &&
        'active' in dataUnknown &&
        typeof dataUnknown.active === 'number' ?
        dataUnknown.active : defaultTaskCounts.active,

queued: typeof dataUnknown === 'object' &&
        dataUnknown !== null &&
        'queued' in dataUnknown &&
        typeof dataUnknown.queued === 'number' ?
        dataUnknown.queued : defaultTaskCounts.queued,
// ... 4 more identical patterns
```

**Refactored Code**:
```typescript
// Step 1: Define proper type
interface TaskCountsData {
  active: number;
  queued: number;
  scheduled: number;
  failed: number;
  completed: number;
  outOfSync: number;
}

// Step 2: Create type guard
function isTaskCountsData(data: unknown): data is TaskCountsData {
  return (
    isObject(data) &&
    hasProperties(data, ['active', 'queued', 'scheduled', 'failed', 'completed', 'outOfSync']) &&
    typeof data.active === 'number' &&
    typeof data.queued === 'number' &&
    typeof data.scheduled === 'number' &&
    typeof data.failed === 'number' &&
    typeof data.completed === 'number' &&
    typeof data.outOfSync === 'number'
  );
}

// Step 3: Use type guard
const data = queryData?.data;
if (isTaskCountsData(data)) {
  return {
    active: data.active,
    queued: data.queued,
    scheduled: data.scheduled,
    failed: data.failed,
    completed: data.completed,
    outOfSync: data.outOfSync
  };
}
return defaultTaskCounts;
```

**Utility Functions** (from `/src/lib/type-guards/index.ts`):
- `isObject(value)` - Checks if value is a non-null object
- `hasProperty(obj, prop)` - Checks if object has property with type narrowing
- `hasProperties(obj, props)` - Checks if object has all properties

---

### 2.2 Top Priority Files for Type Refactoring

**Ranked by violation count and impact:**

#### 1. `src/server/trpc/routers/manga.ts` (68 violations)
- **Issue**: Excessive defensive checking in tRPC procedures
- **Fix**: Define proper input/output types, use Zod validation
- **Impact**: High (core API router)

#### 2. `src/components/updateManga/ProviderSelectionForm.tsx` (26 violations)
- **Issue**: Runtime type checking for form data
- **Fix**: Define proper form state types, use Mantine form typing
- **Impact**: Medium (UI component)

#### 3. `src/components/addManga/utils/searchToWizardMapper.ts` (51 violations)
- **Issue**: Defensive checking when mapping search results
- **Fix**: Define adapter types, use type guards
- **Impact**: High (data transformation)

#### 4. `src/server/services/metadata/unified-merger.ts` (38 violations)
- **Issue**: Merging metadata from multiple sources without proper types
- **Fix**: Define metadata source types, use type guards
- **Impact**: High (critical service)

#### 5. `src/utils/validation/guards/metadata.ts` (35 violations)
- **Issue**: Over-defensive metadata validation
- **Fix**: Consolidate with existing type guards
- **Impact**: Medium (validation layer)

---

### 2.3 Improve Core Type Definitions

**Files needing type improvements:**

1. **`src/types/api/manga-router-types.ts`**
   - Add explicit return types for all tRPC procedures
   - Define input validation types

2. **`src/types/search.types.ts`**
   - Define discriminated unions for search results
   - Add adapter-specific types

3. **`src/types/universalImportWizard.types.ts`**
   - Define wizard step types
   - Add form state types

4. **`src/types/domain/manga-types.ts`**
   - Ensure all properties are properly typed
   - Add helper types for common patterns

---

## Phase 3: Manual Review & Complex Cases (10% of violations)

### 3.1 Always True/False Conditions

**Target**: 100-200 violations

**Pattern**: Conditions TypeScript can determine statically

**Example**:
```typescript
// VIOLATION
function processData(data: string) {
  if (typeof data === 'string') { // Always true - data is typed as string
    return data.toUpperCase();
  }
}

// FIX
function processData(data: string) {
  return data.toUpperCase();
}
```

**Action Items**:
1. ✅ Review ESLint errors manually
2. ✅ Remove redundant type checks
3. ✅ Improve type definitions if needed

---

### 3.2 Parser and Extractor Files

**High violation counts in specialized logic:**

- `src/server/parsers/core/DataNormalizer.ts` (33 violations)
- `src/server/parsers/extractors/ImageExtractor.ts` (24 violations)
- `src/server/parsers/core/ContentExtractor.ts` (20 violations)
- `src/server/parsers/extractors/TableExtractor.ts` (14 violations)

**Strategy**:
- Review each violation in context
- Many may be necessary for parsing untrusted HTML
- Focus on improving type definitions for parsed data

---

## Implementation Plan

### Week 1: Automated Fixes (Phase 1)

**Day 1-2: Generator Fix**
- [ ] Fix `scripts/generate-type-guards.ts`
- [ ] Regenerate type guards
- [ ] Test and verify
- [ ] Commit: `fix(type-guards): Remove unnecessary undefined checks in generator`

**Day 3-4: Null Check Cleanup**
- [ ] Create find/replace script for `!== undefined && !== null` → `!= null`
- [ ] Run on all TypeScript files
- [ ] Run `bun run lint --fix`
- [ ] Manual review of changes
- [ ] Commit: `fix(eslint): Replace double null checks with single != null`

**Day 5: Nullish Coalescing**
- [ ] Review all `?? null` and `?? undefined` cases
- [ ] Replace with meaningful defaults
- [ ] Commit: `fix(eslint): Replace ?? null/undefined with meaningful defaults`

---

### Week 2: Type Refactoring (Phase 2 - Part 1)

**Day 1-2: Core Router**
- [ ] Refactor `src/server/trpc/routers/manga.ts`
- [ ] Add proper types for all procedures
- [ ] Test all endpoints
- [ ] Commit: `refactor(trpc): Improve type safety in manga router`

**Day 3: Component Refactoring**
- [ ] Refactor `src/components/updateManga/ProviderSelectionForm.tsx`
- [ ] Add proper form state types
- [ ] Commit: `refactor(components): Improve type safety in ProviderSelectionForm`

**Day 4-5: Mapper and Service**
- [ ] Refactor `src/components/addManga/utils/searchToWizardMapper.ts`
- [ ] Refactor `src/server/services/metadata/unified-merger.ts`
- [ ] Commit: `refactor(services): Improve type safety in metadata services`

---

### Week 3: Type Refactoring (Phase 2 - Part 2)

**Day 1-2: Validation Layer**
- [ ] Refactor `src/utils/validation/guards/metadata.ts`
- [ ] Consolidate with existing type guards
- [ ] Commit: `refactor(validation): Consolidate metadata type guards`

**Day 3-5: Core Type Definitions**
- [ ] Improve `src/types/api/manga-router-types.ts`
- [ ] Improve `src/types/search.types.ts`
- [ ] Improve `src/types/universalImportWizard.types.ts`
- [ ] Commit: `refactor(types): Improve core type definitions`

---

### Week 4: Manual Review & Cleanup (Phase 3)

**Day 1-3: Parser Files**
- [ ] Review `src/server/parsers/core/DataNormalizer.ts`
- [ ] Review `src/server/parsers/extractors/ImageExtractor.ts`
- [ ] Review `src/server/parsers/core/ContentExtractor.ts`
- [ ] Review `src/server/parsers/extractors/TableExtractor.ts`
- [ ] Commit: `fix(parsers): Remove unnecessary conditions in parser logic`

**Day 4: Remaining High-Priority Files**
- [ ] Review and fix remaining files from Top 20 list
- [ ] Commit: `fix(eslint): Address remaining no-unnecessary-condition violations`

**Day 5: Verification & Documentation**
- [ ] Run full type check: `bun run type-check`
- [ ] Run full lint: `bun run lint`
- [ ] Verify violation count reduced to 0
- [ ] Update this document with results
- [ ] Final commit: `docs(eslint): Mark no-unnecessary-condition fixes complete`

---

## Automation Scripts

### Script 1: Find and Replace Null Checks

```bash
#!/bin/bash
# scripts/fix-null-checks.sh

# Replace !== undefined && !== null with != null
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Pattern 1: value !== undefined && value !== null
  sed -i 's/\([a-zA-Z0-9_.]\+\) !== undefined && \1 !== null/\1 != null/g' "$file"

  # Pattern 2: value !== null && value !== undefined
  sed -i 's/\([a-zA-Z0-9_.]\+\) !== null && \1 !== undefined/\1 != null/g' "$file"
done

echo "✅ Replaced double null checks with != null"
```

### Script 2: Find Nullish Coalescing Issues

```bash
#!/bin/bash
# scripts/find-nullish-issues.sh

echo "Files with ?? null:"
grep -r "?? null" src --include="*.ts" --include="*.tsx" -l | wc -l

echo "\nFiles with ?? undefined:"
grep -r "?? undefined" src --include="*.ts" --include="*.tsx" -l | wc -l

echo "\nTop files with ?? null:"
grep -r "?? null" src --include="*.ts" --include="*.tsx" -c | sort -t: -k2 -rn | head -10
```

### Script 3: Verify Generator Fix

```bash
#!/bin/bash
# scripts/verify-type-guard-fix.sh

# Regenerate type guards
bun run generate:type-guards

# Count violations in generated file
violations=$(bun run lint src/utils/type-guards/generated.ts 2>&1 | grep "no-unnecessary-condition" | wc -l)

if [ "$violations" -eq 0 ]; then
  echo "✅ Type guard generator fix successful - 0 violations"
else
  echo "❌ Still have $violations violations in generated type guards"
  exit 1
fi
```

---

## Testing Strategy

### Pre-Fix Baseline
```bash
# Capture current violation count
bun run lint 2>&1 | grep "no-unnecessary-condition" | wc -l > baseline.txt
```

### Post-Fix Verification
```bash
# After each phase, verify reduction
bun run lint 2>&1 | grep "no-unnecessary-condition" | wc -l

# Full validation
bun run type-check
bun run lint
bun run test
```

### Regression Prevention
```bash
# Ensure no new type errors
git diff main --name-only | xargs bun run type-check

# Ensure no functionality broken
bun run test:unit
bun run test:integration
```

---

## Success Metrics

### Quantitative
- ✅ Reduce violations from 2,037 to 0
- ✅ No new TypeScript errors introduced
- ✅ All tests passing
- ✅ Build succeeds

### Qualitative
- ✅ Improved type safety across codebase
- ✅ Reduced runtime type checking overhead
- ✅ More maintainable code
- ✅ Better TypeScript inference

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation**:
- Make changes in small, focused commits
- Run full test suite after each change
- Review each change before committing

### Risk 2: Type Inference Issues
**Mitigation**:
- Add explicit type annotations where needed
- Use type guards instead of removing checks entirely
- Test with `strictNullChecks` enabled

### Risk 3: Runtime Errors
**Mitigation**:
- Don't remove checks that validate external data
- Keep validation at API boundaries
- Use Zod schemas for input validation

---

## Top 20 Priority Files

| Rank | File | Violations | Phase | Priority |
|------|------|-----------|-------|----------|
| 1 | `src/server/trpc/routers/manga.ts` | 68 | 2 | High |
| 2 | `src/components/addManga/utils/searchToWizardMapper.ts` | 51 | 2 | High |
| 3 | `src/server/services/metadata/unified-merger.ts` | 38 | 2 | High |
| 4 | `src/utils/validation/guards/metadata.ts` | 35 | 2 | Medium |
| 5 | `src/server/parsers/core/DataNormalizer.ts` | 33 | 3 | Medium |
| 6 | `src/pages/manga/[id].tsx` | 28 | 1 | Medium |
| 7 | `src/components/updateManga/ProviderSelectionForm.tsx` | 26 | 2 | High |
| 8 | `src/types/manga/adapters.ts` | 26 | 2 | Medium |
| 9 | `src/utils/type-guards/generated.ts` | 25 | 1 | High |
| 10 | `src/server/parsers/extractors/ImageExtractor.ts` | 24 | 3 | Low |
| 11 | `src/server/parsers/core/ContentExtractor.ts` | 20 | 3 | Low |
| 12 | `src/server/services/fandom/FandomService.ts` | 16 | 2 | Medium |
| 13 | `src/server/services/calendar/ReleaseScheduleService.ts` | 15 | 2 | Medium |
| 14 | `src/server/services/metadata/validation-service.ts` | 15 | 2 | Medium |
| 15 | `src/components/addManga/steps/confirmationStep/ConfirmationStep.tsx` | 14 | 1 | Low |
| 16 | `src/utils/metadata-field-mapping.ts` | 14 | 1 | Medium |
| 17 | `src/server/parsers/extractors/TableExtractor.ts` | 14 | 3 | Low |
| 18 | `src/server/services/download/fileImporter.ts` | 9 | 2 | Low |
| 19 | `src/utils/validation/schema-validation.ts` | 9 | 2 | Low |
| 20 | `src/hooks/useTaskCounts.ts` | 8 | 2 | Medium |

---

## Quick Start Commands

```bash
# Phase 1: Start automated fixes
bun run scripts/fix-null-checks.sh
bun run lint --fix
git commit -m "fix(eslint): Automated no-unnecessary-condition fixes"

# Phase 2: Type refactoring (per file)
# Edit file → Test → Commit

# Phase 3: Verification
bun run type-check
bun run lint
bun run test

# Final push
git push origin claude/fix-unnecessary-condition-violations-011CUwphTnojQL6B1igmL8mu
```

---

## Progress Tracking

### Phase 1: Automated Fixes
- [ ] Generator fix (300-400 violations)
- [ ] Null check cleanup (600-800 violations)
- [ ] Nullish coalescing (400-500 violations)
- [ ] Optional chaining (200-300 violations)

### Phase 2: Type Refactoring
- [ ] Top 5 files (200+ violations)
- [ ] Files 6-10 (100+ violations)
- [ ] Files 11-20 (100+ violations)
- [ ] Core type definitions

### Phase 3: Manual Review
- [ ] Parser files (100+ violations)
- [ ] Remaining files
- [ ] Final verification

---

## Appendix: Pattern Examples

### Pattern 1: Generated Type Guards
```typescript
// BEFORE (violation)
(candidate["accessToken"] === undefined || typeof candidate["accessToken"] === 'string')

// AFTER (fixed)
(!("accessToken" in candidate) || typeof candidate["accessToken"] === 'string')
```

### Pattern 2: Double Null Check
```typescript
// BEFORE (violation)
if (value !== undefined && value !== null) { }

// AFTER (fixed)
if (value != null) { }
```

### Pattern 3: Nullish Coalescing
```typescript
// BEFORE (violation)
const title = manga?.title ?? null;

// AFTER (fixed)
const title = manga?.title ?? 'Unknown';
```

### Pattern 4: Optional Chaining
```typescript
// BEFORE (violation)
if (manga?.chapters?.length !== undefined) { }

// AFTER (fixed)
if (manga?.chapters?.length) { }
```

### Pattern 5: Type Guard Replacement
```typescript
// BEFORE (violation)
if (typeof obj === 'object' && obj !== null && 'field' in obj && typeof obj.field === 'string') { }

// AFTER (fixed)
if (isObject(obj) && hasProperty(obj, 'field') && typeof obj.field === 'string') { }
```

---

*Last Updated: 2025-11-09*
*This is a living document - update as fixes progress*
