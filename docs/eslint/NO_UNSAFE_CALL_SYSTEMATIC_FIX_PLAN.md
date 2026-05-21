# @typescript-eslint/no-unsafe-call - Systematic Fix Plan

**Generated:** 2025-11-09
**Current Violations:** 411 (down from 2,157)
**Status:** Ready for Execution
**Cascade Effect Confirmed:** ✅ 81% reduction achieved from Phase 1

---

## Executive Summary

Based on comprehensive Phase 0 analysis and confirmed cascade effects from Phase 1, we have a clear path to eliminate the remaining **411 `no-unsafe-call` violations**. This document provides a systematic, priority-ordered plan to achieve **80-95% reduction** (330-390 violations fixed).

### Key Achievements So Far

- **Original Count:** 2,157 violations
- **Current Count:** 411 violations
- **Already Reduced:** 1,746 violations (81%)
- **Cascade Effect:** Confirmed at 81% (exceeded 65-75% prediction!)

### Remaining Work

- **Target:** Fix 330-390 violations (80-95%)
- **Acceptable Remaining:** 20-80 violations (technical debt with justification)
- **Timeline:** 8-10 weeks
- **Effort:** 63-73 hours
- **Approach:** Pattern-based systematic fixes

---

## Violation Categories & Fix Strategies

### Category 1: Array Method Callbacks (~80-100 violations)

**Pattern Identified:**
```typescript
// ❌ WRONG - causes unsafe-call
items.map((item: any) => item.property)
items.filter((item: any) => item.condition)
items.forEach((item: any) => item.method())
items.reduce((acc: any, item: any) => ...)
```

**Root Cause:**
- Array element type not inferred
- Quick fix with `any` to bypass type error
- Cascades to all property/method accesses

**Fix Strategy:**
```typescript
// ✅ CORRECT - type the source
interface Item {
  property: string;
  condition: boolean;
  method(): void;
}

// TypeScript infers automatically
const items: Item[] = getItems();
items.map(item => item.property)
items.filter(item => item.condition)

// Or explicit typing
items.map((item: Item) => item.property)
```

**Priority:** **HIGH**
**Estimated Count:** 80-100 violations
**Effort:** 2-3 batches (~6-9 hours)
**Risk:** Low - straightforward typing

**Key Files:**
- `src/components/library/LibraryDisplay.tsx`
- `src/server/trpc/routers/manga.ts`
- `src/components/addManga/UniversalImportWizard.tsx`
- Various utility files

**Example Fix:**

src/components/library/LibraryDisplay.tsx:82
```typescript
// Before
const readCount = m.Chapter.filter((ch: any) => ch.readAt).length;

// After
import type { Chapter } from '@/types/domain/chapter-types';
const readCount = m.Chapter.filter((ch: Chapter) => ch.readAt).length;
// Or rely on inference:
const readCount = m.Chapter.filter(ch => ch.readAt).length;
```

---

### Category 2: Cheerio/jQuery Element Selectors (~60-80 violations)

**Pattern Identified:**
```typescript
// ❌ WRONG - elem is any
$('.selector').each((_: number, elem: any) => {
  $(elem).find('.nested').text()  // unsafe-call
  $(elem).attr('href')            // unsafe-call
  $(elem).next('.sibling')        // unsafe-call
})
```

**Root Cause:**
- Cheerio `Element` type not imported
- `elem` parameter defaults to `any`
- Each jQuery method call becomes unsafe-call

**Fix Strategy:**
```typescript
// ✅ CORRECT - import Cheerio types
import type { Element } from 'cheerio';

$('.selector').each((_: number, elem: Element) => {
  const $elem = $(elem);
  $elem.find('.nested').text()  // safe
  $elem.attr('href')            // safe
  $elem.next('.sibling')        // safe
})
```

**Priority:** **HIGH**
**Estimated Count:** 60-80 violations
**Effort:** 2 batches (~6 hours)
**Risk:** Very Low - standard Cheerio pattern

**Key Files:**
- `src/server/trpc/routers/metadata.ts` (~25 violations)
- `src/server/parsers/extractors/MetadataExtractor.ts` (~30 violations)
- `src/server/services/fandom/dynamic/DynamicWikiParser.ts` (~25 violations)

**Example Fix:**

src/server/trpc/routers/metadata.ts:2093
```typescript
// Before
$('.pi-data-label:contains("Genre")').each((_: number, elem: any) => {
  const genreText = $(elem).next('.pi-data-value').text().trim();
  if (genreText) {
    genres.push(...genreText.split(/[,;]/).map((g: string) => g.trim()));
  }
});

// After
import type { Element } from 'cheerio';

$('.pi-data-label:contains("Genre")').each((_: number, elem: Element) => {
  const genreText = $(elem).next('.pi-data-value').text().trim();
  if (genreText) {
    genres.push(...genreText.split(/[,;]/).map(g => g.trim()));
  }
});
```

**Impact:** Fixes ~5 unsafe-calls with one type annotation

---

### Category 3: React Event Handlers (~50-60 violations)

**Pattern Identified:**
```typescript
// ❌ WRONG - event typed as any
onChange: (e: any) => void
onClick: (event: any) => void
onSubmit: (data: any) => void
```

**Root Cause:**
- React event types not imported
- Generic event parameter typed as `any`
- Property accesses become unsafe-calls

**Fix Strategy:**
```typescript
// ✅ CORRECT - use proper React types
import type { ChangeEvent, MouseEvent, FormEvent } from 'react';

onChange: (e: ChangeEvent<HTMLInputElement>) => void
onClick: (event: MouseEvent<HTMLButtonElement>) => void
onSubmit: (e: FormEvent<HTMLFormElement>) => void
```

**Priority:** **MEDIUM**
**Estimated Count:** 50-60 violations
**Effort:** 2 batches (~6 hours)
**Risk:** Low

**Key Files:**
- `src/test/setup.ts` (~20 violations)
- `src/components/addManga/form.tsx` (~15 violations)
- `src/components/settings/**` (~15 violations)

**Example Fix:**

src/test/setup.ts:708
```typescript
// Before
const input = React.createElement('input', {
  type: 'text',
  value: value || '',
  onChange: (e: any) => props.onChange?.(e.target.value)
});

// After
import type { ChangeEvent } from 'react';

const input = React.createElement('input', {
  type: 'text',
  value: value || '',
  onChange: (e: ChangeEvent<HTMLInputElement>) => {
    props.onChange?.(e.target.value);
  }
});
```

---

### Category 4: API Response Processing (~40-50 violations)

**Pattern Identified:**
```typescript
// ❌ WRONG - API response typed as any
const data: any = await fetch(url).then(r => r.json());
data.process();        // unsafe-call
data.items.map(...)    // unsafe-call
```

**Root Cause:**
- API responses from tRPC/external sources typed as `any`
- No interface definitions for response shape
- All method/property accesses unsafe

**Fix Strategy:**
```typescript
// ✅ CORRECT - define response interfaces
interface ApiResponse {
  data: DataItem[];
  process(): void;
}

interface DataItem {
  id: number;
  name: string;
}

const response: ApiResponse = await fetch(url).then(r => r.json());
response.process();        // safe
response.data.forEach(item => item.id);  // safe
```

**Priority:** **HIGH**
**Estimated Count:** 40-50 violations
**Effort:** 3-4 batches (~10-12 hours)
**Risk:** Medium - need to verify API contracts

**Key Files:**
- `src/server/trpc/routers/manga.ts`
- `src/server/trpc/routers/metadata.ts`
- `src/server/trpc/routers/library.ts`
- `src/sdk/examples/usage.ts`
- `src/pages/test/comicvine-data.tsx`

**Example Fix:**

src/server/trpc/routers/manga.ts:2777
```typescript
// Before
const enrichedVolumes = volumesData.map((vol: any, index: number) => {
  return {
    volumeNumber: vol.volumeNumber,
    title: vol.title,
    chapters: vol.chapters
  };
});

// After
interface VolumeData {
  volumeNumber: number;
  title: string;
  chapters: ChapterData[];
}

interface ChapterData {
  chapterNumber: number;
  title: string;
  url?: string;
}

const volumesData: VolumeData[] = await getVolumesData();
const enrichedVolumes = volumesData.map((vol, index) => ({
  volumeNumber: vol.volumeNumber,
  title: vol.title,
  chapters: vol.chapters
}));
```

---

### Category 5: Type Guards & Validation (~30-40 violations)

**Pattern Identified:**
```typescript
// ❌ WRONG - type guard operates on any
function isValid(data: any): boolean {
  return data.hasOwnProperty('id') &&  // unsafe-call
         data.id !== null &&            // unsafe-call
         typeof data.name === 'string';  // ok
}
```

**Root Cause:**
- Type guard functions accept `any` instead of `unknown`
- Property accesses become unsafe-calls
- Runtime validation defeats compile-time safety

**Fix Strategy:**
```typescript
// ✅ CORRECT - use unknown with proper guards
interface ValidData {
  id: number;
  name: string;
}

function isValid(data: unknown): data is ValidData {
  return typeof data === 'object' &&
         data !== null &&
         'id' in data &&
         typeof (data as Record<string, unknown>).id === 'number' &&
         'name' in data &&
         typeof (data as Record<string, unknown>).name === 'string';
}
```

**Priority:** **MEDIUM**
**Estimated Count:** 30-40 violations
**Effort:** 2 batches (~6 hours)
**Risk:** Low - standard pattern

**Key Files:**
- `src/utils/validation/guards/domain-guards.ts` (~25 violations)
- `src/utils/type-guards.ts` (~5 violations)
- `src/utils/validation/schema-validation.ts` (~10 violations)

**Example Fix:**

src/utils/type-guards.ts:255
```typescript
// Before
function isEnumValue<T>(enumObj: Record<string, T>, value: unknown): value is T {
  return Object.values(enumObj).includes(value as any);
}

// After
function isEnumValue<T extends string | number>(
  enumObj: Record<string, T>,
  value: unknown
): value is T {
  return Object.values(enumObj).some(v => v === value);
}
```

---

### Category 6: Library Type Declarations (~30-40 violations)

**Pattern Identified:**
External libraries with incomplete or missing type definitions

**Root Cause:**
- Old npm packages without TypeScript support
- Cheerio advanced features lack types
- Dynamic require() statements for CJS modules

**Fix Strategy:**
Create ambient type declarations:

```typescript
// src/types/libraries/cheerio-extended.d.ts
import { Element, Cheerio, CheerioAPI } from 'cheerio';

declare module 'cheerio' {
  interface CheerioAPI {
    customMethod(selector: string): Cheerio<Element>;
  }
}

// src/types/libraries/old-library.d.ts
declare module 'old-library' {
  export interface LibraryResult {
    process(): void;
    data: unknown[];
  }

  export function getData(): LibraryResult;
}
```

**Priority:** **LOW-MEDIUM**
**Estimated Count:** 30-40 violations
**Effort:** 1-2 batches (~4-6 hours)
**Risk:** Low - additive only

**Breakdown:**
- Cheerio advanced usage: ~15 violations
- Old NPM packages: ~15 violations
- Dynamic imports: ~10 violations

**Deliverables:**
- `src/types/libraries/cheerio-extended.d.ts`
- `src/types/libraries/[package-name].d.ts` (as needed)

---

### Category 7: Type Assertions with Validation (~20-30 violations)

**Pattern Identified:**
We know the type but TypeScript doesn't trust us

**Root Cause:**
- Prisma query results lose detailed type information
- External API → Internal type conversions
- Legacy JS modules calling new TS code

**Fix Strategy:**
```typescript
// ✅ CORRECT - assertion with validation
interface MangaWithChapters {
  id: number;
  title: string;
  chapters: {
    id: number;
    markRead(): void;
  }[];
}

const manga = await prisma.manga.findUnique({
  where: { id },
  include: { chapters: true }
}) as MangaWithChapters | null;

if (manga) {
  manga.chapters.forEach(ch => ch.markRead());  // safe!
}
```

**Priority:** **MEDIUM**
**Estimated Count:** 20-30 violations
**Effort:** 2-3 batches (~7-9 hours)
**Risk:** High - requires thorough validation

**Categories:**
- Prisma relations: ~10 violations
- API adapter transformations: ~10 violations
- Legacy code interop: ~5-10 violations

---

### Category 8: Accepted Technical Debt (~10-20 violations)

**Pattern Identified:**
Complex cases that are not cost-effective to fix

**Root Cause:**
- Complex type scenarios requiring advanced TypeScript
- External library boundaries we don't control
- Production-critical paths where risk > benefit

**Fix Strategy:**
Document and track:

```typescript
// eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Justification
// TODO: Create GitHub issue #XXX to properly type this in Phase 4
const result: any = complexLegacyFunction();
result.process();
```

**Priority:** **LOW**
**Estimated Count:** 10-20 violations
**Effort:** 1 batch (~3 hours)
**Risk:** Low - documenting existing state

**Approach:**
1. Case-by-case cost/benefit analysis
2. Document reasoning in code
3. Create technical debt GitHub issues
4. Track for future resolution

---

## Phased Implementation Plan

### Phase 2A: Pattern-Based Fixes (Weeks 1-4)

**Goal:** Fix common patterns with low-medium risk

| Wave | Category | Est. Violations | Batches | Effort | Risk | Priority |
|------|----------|----------------|---------|--------|------|----------|
| **Wave 1** | Cheerio Elements | 60-80 | 2 | 6h | Very Low | ⚡ Start Here |
| **Wave 2** | Array Callbacks | 80-100 | 3 | 9h | Low | ⚡ High ROI |
| **Wave 3** | React Events | 50-60 | 2 | 6h | Low | 🔶 Medium |
| **Wave 4** | Type Guards | 30-40 | 2 | 6h | Low-Med | 🔶 Medium |

**Totals:**
- **Violations Fixed:** 220-280 (53-68% of total)
- **Batches:** 9
- **Effort:** ~27 hours
- **Expected Outcome:** 190-130 violations remaining

---

### Phase 2B: Complex Fixes (Weeks 5-7)

**Goal:** Address higher-risk, business-critical violations

| Wave | Category | Est. Violations | Batches | Effort | Risk | Priority |
|------|----------|----------------|---------|--------|------|----------|
| **Wave 5** | API Responses | 40-50 | 3-4 | 12h | Med-High | ⚡ Critical |
| **Wave 6** | Library Types | 30-40 | 1-2 | 6h | Medium | 🔶 Medium |
| **Wave 7** | Type Assertions | 20-30 | 2-3 | 8h | High | 🔴 Careful |

**Totals:**
- **Violations Fixed:** 90-120 (22-29% of total)
- **Batches:** 6-9
- **Effort:** ~26 hours
- **Expected Outcome:** 100-10 violations remaining

---

### Phase 2C: Cleanup & Documentation (Week 8)

**Goal:** Final sweep and project completion

| Wave | Category | Est. Violations | Batches | Effort | Risk | Priority |
|------|----------|----------------|---------|--------|------|----------|
| **Wave 8** | Technical Debt | 10-20 | 1 | 3h | Low | 📝 Document |
| **Wave 9** | Verification | All | - | 4h | - | ✅ Validate |
| **Wave 10** | Documentation | - | - | 3h | - | 📚 Record |

**Totals:**
- **Violations Documented:** 10-20
- **Batches:** 1
- **Effort:** ~10 hours
- **Expected Outcome:** 20-80 acceptable violations with justification

---

## Total Project Summary

| Metric | Value |
|--------|-------|
| **Starting Violations** | 411 |
| **Expected Fixed** | 330-390 (80-95%) |
| **Acceptable Remaining** | 20-80 (5-20%) |
| **Total Waves** | 10 |
| **Total Batches** | 16-19 |
| **Total Effort** | 63-73 hours |
| **Duration** | 8-10 weeks |
| **Overall Risk** | Medium |

---

## Priority Order & Execution Sequence

### ⚡ Start Here (Week 1)

**Wave 1: Cheerio Elements**
- **Why first:** Very low risk, standard pattern, immediate confidence builder
- **Impact:** 60-80 violations fixed
- **Files:** 3 key files (metadata.ts, MetadataExtractor.ts, DynamicWikiParser.ts)
- **Pattern:** Single import statement fixes 5-8 violations per occurrence

**Batch 1.1:** src/server/trpc/routers/metadata.ts (~25 violations)
**Batch 1.2:** src/server/parsers/extractors/MetadataExtractor.ts (~30 violations)
**Batch 1.3:** src/server/services/fandom/dynamic/DynamicWikiParser.ts (~25 violations)

### ⚡ High ROI (Weeks 2-3)

**Wave 2: Array Callbacks**
- **Why second:** High volume, low risk, builds on Wave 1 momentum
- **Impact:** 80-100 violations fixed
- **Approach:** Pattern-based systematic replacement

**Batch 2.1:** Components - library, table views (~25-30 violations)
**Batch 2.2:** Routers - manga, metadata (~30-40 violations)
**Batch 2.3:** Utilities & misc files (~25-30 violations)

### 🔶 Medium Priority (Week 4)

**Wave 3: React Events**
**Wave 4: Type Guards**
- **Impact:** 80-100 violations fixed
- **Risk:** Low-medium, straightforward typing

### ⚡ Critical Business Logic (Weeks 5-6)

**Wave 5: API Responses**
- **Why critical:** Core business logic, affects data flow
- **Impact:** 40-50 violations fixed
- **Risk:** Medium-high - requires API contract verification

### 🔶 Infrastructure (Week 7)

**Wave 6: Library Types**
**Wave 7: Type Assertions**
- **Impact:** 50-70 violations fixed
- **Risk:** Medium-high - careful analysis required

### 📝 Final Sweep (Week 8)

**Wave 8: Technical Debt Documentation**
**Wave 9: Comprehensive Verification**
**Wave 10: Project Documentation**

---

## Success Metrics

### Primary Goals

- ✅ Fix 330-390 violations (80-95% of 411)
- ✅ All common patterns have standard fixes documented
- ✅ Hot spot files reduced to <10 violations each
- ✅ Zero production incidents
- ✅ All tests passing after each batch

### Secondary Goals

- ✅ Library type definitions created for reuse
- ✅ Technical debt tracked in GitHub issues
- ✅ Pattern documentation for future development
- ✅ Developer satisfaction with type safety improvements

### Quality Gates (Every Batch)

- ✅ Type-check passes: `bun run type-check`
- ✅ Lint passes: `bun run lint`
- ✅ Tests pass: `bun run test`
- ✅ Manual code review completed
- ✅ Commit message follows convention
- ✅ Progress tracking updated

---

## Risk Mitigation

### Risk Levels by Category

**Very Low Risk** (~60-80 violations):
- Cheerio type annotations
- Simple array callbacks with known types

**Low Risk** (~140-160 violations):
- React event handlers
- Type guards with clear validation
- Test code

**Medium Risk** (~90-120 violations):
- API response typing (requires verification)
- Library type declarations
- Complex components

**High Risk** (~40-50 violations):
- Type assertions in core business logic
- Complex generic scenarios
- External library integration

**Critical Risk** (~0-10 violations):
- May need to accept as technical debt
- Production-critical paths
- Advanced TypeScript features needed

### Mitigation Strategies

**For All Batches:**
1. Small batch sizes (10-25 violations)
2. One commit per batch (easy rollback)
3. Comprehensive testing before commit
4. Human review of all changes
5. Progressive difficulty (easy → hard)

**For High/Critical Risk:**
1. Individual analysis per violation
2. Enhanced testing requirements
3. Staging environment verification
4. Escalate to senior developers
5. Consider accepting as technical debt

---

## Batch Template & Workflow

### Standard Batch Process

**1. Analysis** (30 min)
- Identify pattern/category
- Review 3-5 example violations
- Determine fix strategy
- Estimate effort

**2. Implementation** (1-2 hours)
- Fix 10-25 violations
- Follow established patterns
- Document any deviations

**3. Validation** (30 min)
- Run type-check
- Run lint
- Run relevant tests
- Manual code review

**4. Commit** (15 min)
- Clear commit message
- Update progress tracking
- Push to feature branch

**5. Retrospective** (15 min)
- Update documentation
- Note any issues
- Adjust next batch plan

**Total per batch:** 2.5-4 hours

---

## Tools & Resources

### AST-Grep Patterns

Find violations by pattern:

```bash
# Array method callbacks
ast-grep --pattern '.map(($P: any) => $$$)' src/

# Cheerio .each()
ast-grep --pattern '.each(($_: number, $E: any) => $$$)' src/

# Event handlers
ast-grep --pattern 'onChange: ($E: any) => $$$' src/

# Type guards
ast-grep --pattern 'function $NAME($P: any): boolean { $$$ }' src/
```

### Validation Commands

```bash
# Type check
bun run type-check

# Lint (with fix)
bun run lint --fix

# Run tests
bun run test

# Full validation (before commit)
bun run type-check && bun run lint && bun run test
```

### Documentation References

- **Phase 0 Analysis:** `docs/eslint/phase0-no-unsafe-call-analysis.md`
- **Phase 2 Strategy:** `docs/eslint/phase2-strategy.md`
- **ESLint Rules:** `docs/eslint/eslint-rules-reference.md`
- **AST-Grep Guide:** `docs/development/ast-grep-guide.md`

---

## Next Steps

### Immediate Actions (This Week)

1. **Review this plan** - Understand approach and priorities
2. **Set up tracking** - Create progress tracking document
3. **Environment check** - Ensure lint/type-check working
4. **Launch Wave 1, Batch 1.1** - Fix Cheerio violations in metadata.ts

### Short-term (Next 2 Weeks)

1. Complete Wave 1 (Cheerio) - 3 batches
2. Complete Wave 2 (Array callbacks) - 3 batches
3. Update progress tracking
4. Assess velocity and adjust timeline

### Long-term (8-10 Weeks)

1. Execute all 10 waves systematically
2. Document patterns and decisions
3. Create technical debt issues for remaining violations
4. Final project report and retrospective

---

## FAQ

### Q: Why not fix all 411 violations?

**A:** Cost/benefit analysis. The final 10-20 violations may be:
- Extremely complex (20+ hours each)
- Low-risk areas
- External library limitations
- Better solved by library updates

Documenting them as technical debt is more pragmatic.

---

### Q: What if we discover more violations during fixes?

**A:** Expected! When you fix types, TypeScript can type-check deeper. Document new violations separately and add to Phase 3 if needed.

---

### Q: Can we parallelize batches?

**A:** Yes, if working on different files/areas. But avoid:
- Same file in parallel
- Dependent patterns (fix array types before array callbacks)
- Overwhelming QA resources

---

### Q: How do we measure success?

**A:**

**Quantitative:**
- 80-95% reduction (330-390 violations fixed)
- Zero new violations introduced
- All tests passing

**Qualitative:**
- Better IDE autocomplete
- Fewer type-related bugs
- Faster code reviews
- Developer confidence

---

## Conclusion

With 81% reduction already achieved through the cascade effect, we have a clear, systematic path to eliminate nearly all remaining `no-unsafe-call` violations. The pattern-based approach, risk-tiered execution, and small batch methodology proven in Phase 1 will ensure success.

**Expected Outcome:**
- **80-95% of violations fixed** (330-390 violations)
- **Type-safe codebase** with documented exceptions
- **Maintainable patterns** for future development
- **Measurable ROI** through reduced bugs and improved velocity

**Ready to begin Phase 2A, Wave 1: Cheerio Element Typing!** 🚀

---

*Last Updated:* 2025-11-09
*Status:* Ready for Execution
*Next Action:* Launch Wave 1, Batch 1.1
