# Phase 2: no-unsafe-call Remediation Strategy

**Generated**: 2025-11-08
**Status**: Planning
**Target**: Fix remaining `@typescript-eslint/no-unsafe-call` violations
**Prerequisite**: Phase 1 Wave 1 Complete ✅ (150 no-explicit-any violations fixed)

---

## Executive Summary

Phase 2 focuses on fixing the remaining `no-unsafe-call` violations after the **Wave 1 cascade effect**. With all 150 `any` types eliminated in Phase 1, we expect a significant auto-reduction in unsafe-call violations.

### Expected State After Wave 1 Cascade

**Original Count**: 2,157 violations
**Expected Cascade**: 1,400-1,600 violations (65-75% auto-resolved)
**Projected Remaining**: 500-700 violations

**Actual Count**: ⏳ *Pending ESLint re-scan*

### Phase 2 Approach

Rather than fixing ALL remaining violations immediately, Phase 2 takes a **strategic, high-ROI approach**:

1. **Validate cascade effect** - Measure actual remaining violations
2. **Focus on hot spots** - Target files with 20+ violations
3. **Pattern-based fixes** - Apply systematic fixes to common patterns
4. **Library type definitions** - Create missing type declarations
5. **Accept remaining low-impact** - Some violations may be acceptable

**Goal**: Reduce violations by 80%+ with focused effort on high-impact areas

---

## Phase 2 Wave Structure

### Wave 1: Cascade Validation & Hot Spot Analysis (Week 1)

**Actions**:
1. ✅ Phase 1 Wave 1 complete (150 any types fixed)
2. ⏳ Run full ESLint scan to measure cascade effect
3. ⏳ Categorize remaining violations by pattern and file
4. ⏳ Identify "hot spot" files (20+ violations each)
5. ⏳ Create Wave 2-4 batch plans based on actual data

**Expected Output**:
- Actual remaining violation count
- Hot spot file list
- Pattern frequency analysis
- Risk assessment per violation type

**Deliverable**: `phase2-wave1-cascade-analysis.md`

---

### Wave 2: Hot Spot Files - High Impact (Weeks 2-4)

**Target**: Files with 50+ violations (estimated 5-10 files, ~400-600 violations)

**Priority Files** (from Phase 0 analysis):
1. **src/components/addManga/UniversalImportWizard.tsx**
   - Estimated: 100-150 violations
   - Focus: Wizard step data interfaces
   - Strategy: Create comprehensive TypeScript interfaces for import wizard

2. **src/components/addManga/form.tsx**
   - Estimated: 80-100 violations
   - Focus: Form event handlers, validation
   - Strategy: React event types + form data interfaces

3. **src/components/addManga/searchStep.tsx**
   - Estimated: 60-80 violations
   - Focus: Search result processing
   - Strategy: SearchResult interface + provider types

4. **src/server/services/metadata/metadataMerger.ts**
   - Estimated: 50-70 violations
   - Focus: Metadata merging logic
   - Strategy: Metadata source interfaces

5. **src/pages/manga/[id].tsx**
   - Estimated: 40-60 violations
   - Focus: Page data processing
   - Strategy: Page props + manga detail interfaces

**Approach**:
- **One file per batch** (each file is a batch)
- Create dedicated interfaces for each file
- Comprehensive type coverage
- Pattern documentation for future reference

**Expected Reduction**: 400-600 violations → ~50-100 remaining in these files

---

### Wave 3: Pattern-Based Fixes (Weeks 5-7)

**Target**: Common patterns across multiple files (~200-300 violations)

#### Batch 1: Cheerio/jQuery Element Operations (~80-100 violations)

**Pattern**:
```typescript
// Before
$('.selector').each((_: number, elem: any) => {
  $(elem).text();
  $(elem).attr('href');
})

// After
import type { Element } from 'cheerio';
$('.selector').each((_: number, elem: Element) => {
  $(elem).text();
  $(elem).attr('href');
})
```

**Files**:
- `src/server/trpc/routers/metadata.ts`
- `src/server/parsers/extractors/MetadataExtractor.ts`
- `src/server/services/fandom/dynamic/DynamicWikiParser.ts`

#### Batch 2: Array Method Callbacks (~60-80 violations)

**Pattern**:
```typescript
// Before
items.map((item: any) => item.property)

// After
interface Item { property: string }
items.map((item: Item) => item.property)
```

**Files**: Multiple component and utility files

#### Batch 3: React Event Handlers (~50-70 violations)

**Pattern**:
```typescript
// Before
const onChange = (e: any) => { ... }

// After
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
```

**Files**: Settings components, form components

#### Batch 4: API Response Processing (~50-70 violations)

**Pattern**:
```typescript
// Before
const data: any = await api.fetch();
data.items.forEach(...)

// After
interface ApiResponse { items: Item[] }
const data: ApiResponse = await api.fetch();
data.items.forEach(...)
```

**Files**: tRPC routers, SDK examples

---

### Wave 4: Library Type Declarations (Week 8)

**Target**: Violations requiring custom type definitions (~100-150 violations)

**Strategy**: Create ambient type declarations for:

1. **Cheerio Advanced Features** (~40 violations)
   - `src/types/libraries/cheerio-extended.d.ts`
   - Advanced selector methods
   - Plugin types

2. **Legacy NPM Packages** (~60 violations)
   - Packages without @types
   - Outdated type definitions
   - Create minimal `.d.ts` files

3. **Dynamic Imports** (~30 violations)
   - `require()` statements
   - Dynamic `import()` expressions
   - Module type assertions

4. **Browser API Extensions** (~20 violations)
   - Experimental APIs (if not covered in Phase 1)
   - Vendor-specific extensions

**Deliverable**: Type definition files in `src/types/libraries/`

---

### Wave 5: Type Assertions & Complex Cases (Week 9)

**Target**: Remaining complex violations (~100-200 violations)

**Categories**:

1. **Safe Type Assertions** (~100 violations)
   - Known safe casts with validation
   - Runtime checks present
   - Document reasoning

2. **Complex Generic Types** (~50 violations)
   - Higher-order function typing
   - Complex generic constraints
   - May require significant refactoring

3. **Third-Party Integration** (~30 violations)
   - External API responses
   - Plugin systems
   - Acceptable with validation

4. **Accepted Technical Debt** (~20 violations)
   - Too complex to fix cost-effectively
   - Low risk areas
   - Document and track

**Approach**:
- Case-by-case analysis
- Cost/benefit evaluation
- Document all decisions
- Create technical debt issues for accepted violations

---

## Success Metrics

### Phase 2 Goals

**Primary Goal**: Reduce violations by 80%+
- Original: 2,157
- After cascade: ~500-700
- After Phase 2: **<150** (stretch: <100)

**Secondary Goals**:
- ✅ All "hot spot" files at <10 violations
- ✅ Common patterns have standard fixes
- ✅ Library type definitions created
- ✅ Remaining violations documented

### Quality Gates

Each wave must meet:
- ✅ Zero new violations introduced
- ✅ All function signatures preserved (backward compatible)
- ✅ Pattern consistency with Phase 1
- ✅ Comprehensive documentation

---

## Risk Assessment

### Low Risk (~40%)
- Cheerio type annotations
- Simple array callbacks
- React event handlers
- Test code

### Medium Risk (~45%)
- Complex component refactoring
- API response typing
- Hot spot files (large files)

### High Risk (~10%)
- Core business logic changes
- Complex generic typing
- External library integration

### Critical Risk (~5%)
- Type assertions without validation
- Dynamic require() patterns
- Plugin system modifications

**Mitigation**:
- High/Critical risk items reviewed individually
- Separate batches for risky changes
- Enhanced testing requirements

---

## Dependencies & Prerequisites

### Required Before Phase 2 Start:
- ✅ Phase 1 Wave 1 complete (150 any types fixed)
- ⏳ ESLint environment fixed (dependency issues resolved)
- ⏳ Full ESLint re-scan completed
- ⏳ Cascade effect validated

### Nice to Have:
- Updated `@types/*` packages
- TypeScript 5.8.2+ features enabled
- IDE autocomplete verification

---

## Timeline Estimate

**Optimistic**: 6-8 weeks (if cascade is 75%)
**Realistic**: 8-10 weeks (if cascade is 65-70%)
**Pessimistic**: 10-12 weeks (if cascade <65% or high complexity)

**Assumes**:
- 10-15 hours/week effort
- No blocking issues
- Good cascade effect from Phase 1

---

## Next Steps

### Immediate (This Week):
1. ✅ Create this strategy document
2. ⏳ Fix ESLint environment dependencies
3. ⏳ Run full ESLint scan
4. ⏳ Create `phase2-wave1-cascade-analysis.md`

### Short-term (Next Week):
1. Analyze cascade results
2. Identify actual hot spot files
3. Create Wave 2 batch plans
4. Start first hot spot file fix

### Long-term (Next 2-3 months):
1. Execute Waves 2-5 systematically
2. Create library type definitions
3. Document patterns and decisions
4. Achieve 80%+ reduction goal

---

## Lessons from Phase 1

### What Worked Well:
- ✅ Systematic batch approach (20-25 violations per batch)
- ✅ Comprehensive documentation
- ✅ Pattern consistency
- ✅ Incremental commits
- ✅ Risk-based prioritization

### Apply to Phase 2:
- Continue batch-based approach
- One file per batch for hot spots
- Pattern-based batches for common violations
- Detailed analysis documents
- Clear commit messages

### Improvements:
- Larger batches OK for hot spots (40-60 violations/batch)
- More aggressive timeline (learned patterns)
- Parallel work on independent files possible
- Better tooling (scripts for pattern detection)

---

## Open Questions

1. **Actual cascade effect?** Need ESLint scan to confirm 65-75% projection
2. **Hot spot file priorities?** May change based on actual violation counts
3. **Library type definition scope?** May discover more needed than projected
4. **Acceptable final violation count?** Team decision on technical debt tolerance

---

## Conclusion

Phase 2 builds on the foundation established in Phase 1. With all `any` types eliminated, we expect a massive cascade reduction. The remaining violations will be tackled strategically, focusing on high-impact areas first.

**Expected Outcome**:
- 80%+ violation reduction (from 2,157 to <150)
- Clean, type-safe codebase
- Maintainable patterns established
- Minimal technical debt

**Ready to begin Phase 2 Wave 1: Cascade Validation!**

---

*Last Updated: 2025-11-08*
*Next Review: After cascade validation scan*
*Status: Planning → Ready for Execution*
