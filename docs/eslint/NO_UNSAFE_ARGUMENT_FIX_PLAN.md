# Systematic Fix Plan: @typescript-eslint/no-unsafe-argument Violations

**Created**: 2025-11-09
**Total Violations**: 377
**Branch**: `claude/fix-eslint-unsafe-argument-011CUwq4xoAG41hmgSpQuDb2`
**Status**: Planning Complete, Ready for Execution

---

## Executive Summary

Analysis of fresh ESLint scan reveals **377 violations** of `@typescript-eslint/no-unsafe-argument`. These violations have been reduced from the previous 1,093 through merged fixes. This plan provides a systematic approach to eliminate the remaining 377 violations.

---

## Violation Distribution

Based on codebase analysis:

| Category | Instances | % of Total | Complexity | Est. Hours |
|----------|-----------|------------|------------|------------|
| **Type Assertions** (`as any`) | ~325 | 86% | Medium | 15-20 |
| **Untyped JSON** (`.json()`) | ~55 | 15% | High | 8-12 |
| **Dynamic Objects** (`Record<string, any>`) | ~14 | 4% | Low | 2-3 |
| **TOTAL** | **~394*** | **100%** | **Mixed** | **25-35** |

*Note: Some overlap between categories, targeting 377 ESLint violations

---

## Category 1: Type Assertions (`as any`) - ~325 instances

### Sub-Pattern 1.1: Prisma Metadata Destructuring (High Priority)
**Count**: ~50-60 instances
**Files**: `manga.ts`, `metadata.ts`

**Pattern**:
```typescript
// ❌ WRONG
const { id, createdAt, updatedAt, manga, ...fields } = metadata as any;

// ✅ CORRECT
type OmittedFields = 'id' | 'createdAt' | 'updatedAt' | 'manga';
const { id, createdAt, updatedAt, manga, ...fields } = metadata as Omit<typeof metadata, OmittedFields>;
```

**Fix Strategy**:
1. Create utility type: `type MetadataFields = Omit<MangaMetadata, 'id' | 'createdAt' | 'updatedAt' | 'manga'>`
2. Replace `as any` with `as MetadataFields`
3. Validate TypeScript compilation

**Estimated Time**: 3-4 hours

---

### Sub-Pattern 1.2: Unimplemented Prisma Models (Medium Priority)
**Count**: ~10-15 instances
**Files**: `manga.ts`

**Pattern**:
```typescript
// ❌ WRONG
await (ctx.prisma as any).autoDownloadRule.create({ ... });

// ✅ CORRECT Option A: Add to schema.prisma
model AutoDownloadRule {
  id        Int      @id @default(autoincrement())
  mangaId   Int
  // ... fields
}

// ✅ CORRECT Option B: Type extension (if model truly pending)
interface PrismaClientExtended extends PrismaClient {
  autoDownloadRule: {
    create: (args: { data: AutoDownloadRuleCreateInput }) => Promise<AutoDownloadRule>;
  };
}
const extendedPrisma = ctx.prisma as unknown as PrismaClientExtended;
```

**Fix Strategy**:
1. **Recommended**: Add missing models to `schema.prisma`
2. **Alternative**: Create typed extension interface
3. Remove `@ts-expect-error` comments

**Estimated Time**: 4-5 hours (includes schema updates + migration)

---

### Sub-Pattern 1.3: Provider Metadata Type Mismatches (High Priority)
**Count**: ~20-30 instances
**Files**: `metadata.ts`, provider adapters

**Pattern**:
```typescript
// ❌ WRONG
providerMetadata: providerMetadata as any

// ✅ CORRECT
import { Prisma } from '@prisma/client';
providerMetadata: providerMetadata as Prisma.JsonValue
```

**Fix Strategy**:
1. Use `Prisma.JsonValue` for JSON fields
2. Create provider-specific type guards
3. Validate before assignment

**Estimated Time**: 3-4 hours

---

### Sub-Pattern 1.4: Result Type Conversions (Low Priority)
**Count**: ~30-40 instances
**Files**: Various routers

**Pattern**:
```typescript
// ❌ WRONG
return createSuccessResult(resultObj as any);

// ✅ CORRECT
return createSuccessResult(resultObj as ResultData);
// OR
return createSuccessResult<ResultData>(resultObj);
```

**Fix Strategy**:
1. Define proper result types
2. Use generic type parameters
3. Add runtime validation if needed

**Estimated Time**: 2-3 hours

---

### Sub-Pattern 1.5: Test Mocks (Low Priority)
**Count**: ~100-150 instances in `__tests__`
**Files**: Test files

**Pattern**:
```typescript
// ❌ WRONG
const mockPrisma = { manga: { findUnique: vi.fn() } } as any;

// ✅ CORRECT
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended';
const mockPrisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();
```

**Fix Strategy**:
1. Use `vitest-mock-extended` for Prisma mocks
2. Create typed mock utilities
3. Fix test files in batches

**Estimated Time**: 5-7 hours (defer to later wave)

---

## Category 2: Untyped JSON (`.json()`) - ~55 instances

### Sub-Pattern 2.1: External API Responses (Critical Priority)
**Count**: ~35-40 instances
**Files**: `clientSearchProvider.ts`, `prowlarrApi.ts`, various client files

**Pattern**:
```typescript
// ❌ WRONG
const data = await response.json();
return data.results; // data is any

// ✅ CORRECT
import { z } from 'zod';
import { fetchJSON } from '@/lib/api-client';

const SearchResultSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    // ... all fields
  }))
});

const data = await fetchJSON(url, SearchResultSchema);
return data.results; // data is typed
```

**Fix Strategy**:
1. **REUSE EXISTING**: Leverage `@/lib/api-client.ts` (already created!)
2. **REUSE EXISTING**: Leverage `@/lib/schemas/` (Zod schemas already exist!)
3. Migrate `.json()` calls to `fetchJSON<T>()` wrapper
4. Add runtime validation

**Infrastructure Already Exists**:
- ✅ `fetchJSON<T>()` utility (`lib/api-client.ts`)
- ✅ Zod schema library (`lib/schemas/`)
- ✅ AniList schemas (`lib/schemas/anilist.ts`)
- ✅ Common schemas (`lib/schemas/common.ts`)

**Estimated Time**: 6-8 hours (just migration work, no infrastructure needed!)

---

### Sub-Pattern 2.2: Internal API Calls (Medium Priority)
**Count**: ~15-20 instances
**Files**: `ml-dashboard.tsx`, various pages

**Pattern**:
```typescript
// ❌ WRONG
const metricsData = await metricsRes.json();
setMetrics(metricsData); // any

// ✅ CORRECT
import { z } from 'zod';

const MetricsSchema = z.object({
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
});

type Metrics = z.infer<typeof MetricsSchema>;

const data: unknown = await metricsRes.json();
const validated = MetricsSchema.parse(data);
setMetrics(validated); // typed
```

**Fix Strategy**:
1. Define Zod schemas for internal API responses
2. Add validation at call sites
3. Use typed state setters

**Estimated Time**: 3-4 hours

---

## Category 3: Dynamic Objects (`Record<string, any>`) - ~14 instances

### Sub-Pattern 3.1: Log Sanitization (Low Priority)
**Count**: ~8-10 instances
**File**: `server/utils/log-sanitizer.ts`

**Pattern**:
```typescript
// ❌ WRONG
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> { ... }

// ✅ CORRECT
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/Bearer .+/, 'Bearer [REDACTED]');
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}
```

**Fix Strategy**:
1. Replace `any` with `unknown`
2. Add type checks before access
3. Update function signatures

**Estimated Time**: 1-2 hours

---

### Sub-Pattern 3.2: Result Object Construction (Low Priority)
**Count**: ~4-5 instances
**Files**: `metadata.ts`, `library.ts`

**Pattern**:
```typescript
// ❌ WRONG
const issueResult: Record<string, any> = { id: 1, title: 'Issue' };

// ✅ CORRECT
interface IssueResult {
  id: number;
  title: string;
  // ... all fields
}
const issueResult: IssueResult = { id: 1, title: 'Issue' };
```

**Fix Strategy**:
1. Define proper result interfaces
2. Use specific types instead of `Record<string, any>`
3. Leverage existing domain types where possible

**Estimated Time**: 1 hour

---

## Execution Plan: 5-Wave Strategy

### Wave 1: Quick Wins - Dynamic Objects (Day 1, 2-3 hours)
**Target**: 14 violations
**Priority**: P3 (Low)
**Rationale**: Easiest fixes, build momentum

**Batches**:
1. **Batch 1.1**: Log sanitizer (`log-sanitizer.ts`) - 8-10 violations
2. **Batch 1.2**: Result objects (`metadata.ts`, `library.ts`) - 4-5 violations

**Deliverables**:
- ✅ All `Record<string, any>` replaced with `unknown` or specific types
- ✅ 14 violations resolved
- ✅ Progress: 0% → 3.7%

---

### Wave 2: Security-Critical - Untyped JSON (Days 2-3, 8-12 hours)
**Target**: 55 violations
**Priority**: P0 (Critical)
**Rationale**: External data = security risk

**Batches**:
1. **Batch 2.1**: External API calls (search, providers) - 20 violations
2. **Batch 2.2**: Client downloads (transmission, deluge, sabnzbd) - 15 violations
3. **Batch 2.3**: Internal API calls (ML dashboard, etc.) - 20 violations

**Infrastructure** (Already Complete! ✅):
- ✅ `fetchJSON<T>()` utility exists
- ✅ Zod schema library exists
- ✅ Example usage exists

**Deliverables**:
- ✅ All `.json()` calls validated with Zod
- ✅ 55 violations resolved
- ✅ Progress: 3.7% → 18.3%

---

### Wave 3: High-Impact - Prisma Type Fixes (Days 4-5, 8-12 hours)
**Target**: ~90 violations (Patterns 1.1, 1.2, 1.3)
**Priority**: P1 (High)
**Rationale**: Core data layer, frequent code paths

**Batches**:
1. **Batch 3.1**: Metadata destructuring - 50-60 violations
2. **Batch 3.2**: Provider metadata types - 20-30 violations
3. **Batch 3.3**: Unimplemented Prisma models - 10-15 violations

**Deliverables**:
- ✅ Utility types for metadata destructuring
- ✅ Prisma schema updated (if needed)
- ✅ 90 violations resolved
- ✅ Progress: 18.3% → 42.2%

---

### Wave 4: Medium Complexity - Result Types (Day 6, 3-4 hours)
**Target**: ~40 violations (Pattern 1.4)
**Priority**: P2 (Medium)

**Batches**:
1. **Batch 4.1**: tRPC router result types - 20 violations
2. **Batch 4.2**: Service layer result types - 20 violations

**Deliverables**:
- ✅ Proper result type definitions
- ✅ Generic type parameters used
- ✅ 40 violations resolved
- ✅ Progress: 42.2% → 52.8%

---

### Wave 5: Test Files - Deferred (Future, 5-7 hours)
**Target**: ~150 violations in `__tests__`
**Priority**: P4 (Defer)
**Rationale**: Test code, lower risk

**Strategy**:
- Create PR for production code fixes first
- Address test files in separate initiative
- Use `vitest-mock-extended` for typed mocks

**Deliverables** (Future):
- ✅ All test mocks properly typed
- ✅ ~150 violations resolved
- ✅ Progress: 52.8% → 92.6%

---

## Success Criteria

### Per-Wave Criteria:
- ✅ TypeScript compilation passes (`npm run type-check`)
- ✅ ESLint violations reduced by target amount
- ✅ No new violations introduced
- ✅ All changes committed with descriptive messages

### Overall Completion (Waves 1-4):
- ✅ **Target**: 199/377 violations fixed (52.8%)
- ✅ **Production code**: 100% type-safe (excluding tests)
- ✅ **Security**: All external API calls validated
- ✅ **Type safety**: No `as any` in data layer

---

## Validation Strategy

### Per-Batch Validation:
```bash
# After each batch
npm run type-check  # Must pass
npm run lint 2>&1 | grep "no-unsafe-argument" | wc -l  # Count reduction
git diff --stat  # Review changes
```

### Per-Wave Validation:
```bash
# After completing each wave
npm run type-check  # Full TypeScript compilation
npm run lint        # Count all ESLint violations
npm test            # Run affected tests
```

---

## Risk Mitigation

### Wave 2 (External APIs):
- ✅ Use existing infrastructure (`fetchJSON`, schemas)
- ✅ Add fallback error handling
- ✅ Log validation failures for debugging
- ✅ Test with real API responses

### Wave 3 (Prisma):
- ✅ Create Prisma migration if schema changes needed
- ✅ Test database operations after changes
- ✅ Use `Partial<T>` for gradual object construction
- ✅ Commit after each file

---

## Human Escalation Points

Escalate to user when:

1. **Prisma Schema Changes Required** (Wave 3, Batch 3.3)
   - Adding `AutoDownloadRule` model requires migration
   - Ask: "Should I create a Prisma migration for missing models?"

2. **Breaking Type Changes** (Wave 3)
   - Changing metadata types may affect consumers
   - Ask: "This change affects 15 callers. Proceed?"

3. **Test File Strategy** (Wave 5)
   - Large effort for test files
   - Ask: "Defer test file fixes to separate PR?"

---

## Estimated Timeline

| Wave | Target | Days | Hours | % Complete |
|------|--------|------|-------|------------|
| Wave 1 (Dynamic Objects) | 14 | 0.5 | 2-3 | 3.7% |
| Wave 2 (Untyped JSON) | 55 | 1.5 | 8-12 | 18.3% |
| Wave 3 (Prisma Types) | 90 | 2 | 8-12 | 42.2% |
| Wave 4 (Result Types) | 40 | 1 | 3-4 | 52.8% |
| **TOTAL (Production)** | **199** | **5** | **21-31** | **52.8%** |
| Wave 5 (Tests - Deferred) | 150 | 1.5 | 5-7 | 92.6% |

---

## Next Immediate Actions

1. ✅ **Start Wave 1, Batch 1.1**: Fix log sanitizer (8-10 violations, ~1 hour)
2. ⏳ **Start Wave 1, Batch 1.2**: Fix result objects (4-5 violations, ~30 min)
3. ⏳ **Start Wave 2, Batch 2.1**: Migrate external API calls to `fetchJSON` (~20 violations)

---

## Notes

### Infrastructure Already Built ✅
Previous work created excellent foundation:
- ✅ `lib/api-client.ts` - Type-safe fetch wrappers
- ✅ `lib/schemas/` - Zod schema library
- ✅ `lib/schemas/anilist.ts` - Complete AniList schemas
- ✅ `lib/schemas/common.ts` - Reusable schema patterns
- ✅ `server/services/anilist/validated-client.ts` - Example usage

**This saves ~10-12 hours of work!**

### Test Files Decision
- **Recommendation**: Defer Wave 5 (test files) to separate PR
- **Rationale**: Production code is higher priority
- **Benefit**: Can merge production fixes sooner

---

*Last Updated*: 2025-11-09
*Status*: **READY FOR EXECUTION**
*Next Step*: Begin Wave 1, Batch 1.1 (Log Sanitizer)
