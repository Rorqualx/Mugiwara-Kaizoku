# Wave 1-2: @typescript-eslint/no-unsafe-assignment Analysis

**Status:** ✅ Analysis Complete - Ready for Execution
**Date:** 2025-11-08
**Analyzer:** Analyzer-A

---

## Overview

This directory contains the complete analysis and execution plan for remediating **1,834 violations** of `@typescript-eslint/no-unsafe-assignment` across **430 files** in the Mugiwara-Kaizoku codebase.

---

## Documents in This Directory

### 📊 [analysis-report.md](./analysis-report.md)
**Comprehensive Analysis Report**

The main analysis document containing:
- Executive summary with violation counts
- Detailed pattern breakdowns
- Top violating files
- Fix strategies with examples
- Risk assessment
- Edge cases requiring manual review

**Use this for:** Understanding the full scope, context, and detailed analysis.

### 📋 [batch-plan.json](./batch-plan.json)
**Structured Execution Plan**

Machine-readable JSON containing:
- Batch definitions (41 total)
- File groupings
- Violation estimates
- Priority assignments
- Fix strategies per batch

**Use this for:** Automated execution, progress tracking, batch orchestration.

### ⚡ [quick-reference.md](./quick-reference.md)
**Quick Lookup Guide**

Practical quick-reference containing:
- Pattern recognition cheat sheet
- Fix templates for common cases
- Type definition examples
- Type guards library
- Execution checklist
- Common pitfalls

**Use this for:** Day-to-day execution, quick pattern matching, fix templates.

---

## Violation Summary

| Pattern | Count | Files | Risk | Wave | Batches |
|---------|-------|-------|------|------|---------|
| **as any casts** | 1,251 | 333 | Medium | 2 | 23 |
| **as unknown as** | 304 | 113 | Low | 1 | 8 |
| **Explicit any** | 223 | 97 | Medium | 2 | 7 |
| **Object.assign** | 56 | 36 | Low | 1 | 3 |
| **TOTAL** | **1,834** | **430** | - | - | **41** |

---

## Execution Sequence

### Wave 1: Low-Risk Patterns (11 batches)
**Target:** 360 violations across 149 files

#### Phase 1.1: Double Casts
- **Batches:** 1.1.1 through 1.1.8
- **Violations:** 304
- **Strategy:** Type guards, proper error typing

#### Phase 1.2: Object.assign
- **Batches:** 1.2.1 through 1.2.3
- **Violations:** 56
- **Strategy:** Spread syntax, immutable patterns

### Wave 2: Medium-Risk Patterns (30 batches)
**Target:** 1,474 violations across 430 files

#### Phase 2.1: as any Casts
- **Batches:** 2.1.1 through 2.1.23
- **Violations:** 1,251
- **Strategy:** Interface definitions, type guards, browser API augmentations

#### Phase 2.2: Explicit any
- **Batches:** 2.2.1 through 2.2.7
- **Violations:** 223
- **Strategy:** Type unions, proper callback typing

---

## Quick Start

### For Executors

1. **Read** [quick-reference.md](./quick-reference.md) - Get familiar with patterns
2. **Review** current batch in [batch-plan.json](./batch-plan.json)
3. **Apply** fixes using templates from quick-reference
4. **Validate** using checklist in quick-reference
5. **Repeat** for next batch

### For Reviewers

1. **Check** [analysis-report.md](./analysis-report.md) for context
2. **Verify** fixes match recommended strategies
3. **Ensure** no new violations introduced
4. **Confirm** tests pass and types are sound

---

## Key Insights

### Most Common Patterns

1. **Dynamic Property Access** (35%)
   - Metadata field extraction
   - Provider-specific data
   - Example: `(metadata as any).field`

2. **AsyncResult Extraction** (20%)
   - tRPC result handling
   - Example: `(result as any).data`

3. **Browser API Workarounds** (15%)
   - Vendor-prefixed methods
   - Example: `(elem as any).webkitRequestFullscreen`

### High-Priority Files

Files with highest violation counts requiring extra care:

1. `src/pages/manga/[id].tsx` (37 violations)
2. `src/utils/mobile/orientation.ts` (31 violations)
3. `src/server/trpc/routers/metadata.ts` (29 violations)
4. `src/utils/async-result.ts` (22 violations)
5. `src/server/trpc/routers/search.ts` (23 violations)

---

## Fix Strategy Summary

### Pattern: as unknown as T

**Problem:** Double type assertion through unknown
**Solution:** Type guards and proper interfaces

```typescript
// Before
manga as unknown as MangaWithRelations

// After
if (!isMangaWithRelations(manga)) {
  throw new ValidationError('Invalid format');
}
// manga now correctly typed
```

### Pattern: as any

**Problem:** Bypasses all type checking
**Solution:** Proper type definitions and guards

```typescript
// Before
(metadata as any).field

// After
interface Metadata {
  field?: string;
}
if (isMetadata(metadata)) {
  const value = metadata.field;
}
```

### Pattern: : any

**Problem:** Disables type checking for declarations
**Solution:** Specific type unions

```typescript
// Before
value: any

// After
type FieldValue = string | number | string[] | null;
value: FieldValue
```

### Pattern: Object.assign

**Problem:** Type-unsafe mutations
**Solution:** Spread syntax

```typescript
// Before
Object.assign(state, updates)

// After
return { ...state, ...updates }
```

---

## Progress Tracking

### Wave 1 Progress
- [ ] Batch 1.1.1 - Utils Error Handling
- [ ] Batch 1.1.2 - AddManga Wizards
- [ ] Batch 1.1.3 - Settings Forms
- [ ] Batch 1.1.4 - Manga Components
- [ ] Batch 1.1.5 - Hooks
- [ ] Batch 1.1.6 - Update & Library
- [ ] Batch 1.1.7 - Pages
- [ ] Batch 1.1.8 - Lib & Store
- [ ] Batch 1.2.1 - Test Utilities
- [ ] Batch 1.2.2 - Parser Services
- [ ] Batch 1.2.3 - Store & Components

### Wave 2 Progress
- [ ] Batch 2.1.1 - Pages Core
- [ ] Batch 2.1.2 - Manga Components
- [ ] Batch 2.1.3 - AddManga Wizards
- [ ] Batch 2.1.4 - Library & Settings
- [ ] Batch 2.1.5 - tRPC Routers
- [ ] Batch 2.1.6 - Services Part 1
- [ ] Batch 2.1.7 - Services Part 2
- [ ] Batch 2.1.8 - Utils & Hooks
- [ ] Batches 2.1.9-2.1.23 - Remaining
- [ ] Batches 2.2.1-2.2.7 - Explicit any

---

## Validation Checklist

After each batch:

```bash
# Type check
bun run type-check

# Lint
bun run lint

# Tests (if affected)
bun test src/path/to/module

# Commit
git add .
git commit -m "fix(eslint): Resolve no-unsafe-assignment in [batch-id]"
```

---

## Common Type Definitions Needed

### Create Global Augmentations

**File:** `src/types/browser-apis.d.ts`

```typescript
interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface Screen {
  orientation?: {
    lock: (orientation: OrientationLockType) => Promise<void>;
    unlock: () => void;
  };
}
```

### Create Type Guards

**File:** `src/utils/type-guards/metadata.ts`

```typescript
export function isProviderMetadata(obj: unknown): obj is ProviderMetadata {
  return typeof obj === 'object' && obj !== null;
}

export function isMangaWithRelations(obj: unknown): obj is MangaWithRelations {
  // Implementation
}
```

---

## Support

### Questions?

1. Check [quick-reference.md](./quick-reference.md) for common patterns
2. Review [analysis-report.md](./analysis-report.md) for detailed context
3. Consult [batch-plan.json](./batch-plan.json) for specific batch details

### Issues?

- Type errors after fix? Review type definitions
- Tests failing? Check test assumptions
- Build failing? Run `bun run type-check` for details

---

## Statistics

### By Module

| Module | Violations | % of Total |
|--------|-----------|------------|
| Components | 650 | 35% |
| Server | 580 | 32% |
| Utils | 240 | 13% |
| Pages | 180 | 10% |
| Hooks | 120 | 7% |
| Other | 64 | 3% |

### By Pattern Type

| Pattern | Violations | % of Total |
|---------|-----------|------------|
| as any | 1,251 | 68% |
| as unknown as | 304 | 17% |
| : any | 223 | 12% |
| Object.assign | 56 | 3% |

---

## Success Criteria

✅ All 1,834 violations resolved
✅ No new `any` types introduced
✅ Type safety improved
✅ All tests passing
✅ No runtime regressions
✅ Type-check passes
✅ ESLint passes

---

## Next Steps

1. **Immediate:** Start with Batch 1.1.1 (Utils Error Handling)
2. **Create:** Global type augmentations for browser APIs
3. **Define:** Standard metadata interfaces
4. **Execute:** Follow batch plan sequentially
5. **Validate:** After each batch, run full validation

---

**Analysis Complete - Ready for Execution**

Generated: 2025-11-08
Analyzer: Analyzer-A
Total Violations: 1,834
Total Batches: 41
Estimated Execution Time: 41 agent runs
