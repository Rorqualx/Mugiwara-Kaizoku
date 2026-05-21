# ESLint Violations - Categorized Analysis

*Generated*: 2025-11-07
*Branch*: eslint/manual-review-workflow
*Source*: Main worktree lint analysis

---

## Executive Summary

| Rule | Total | Low Risk | Medium Risk | High Risk |
|------|-------|----------|-------------|-----------|
| no-unused-vars | 243 | 85 (35%) | 90 (37%) | 68 (28%) |
| no-non-null-assertion | 213 | 26 (12%) | 85 (40%) | 102 (48%) |
| require-await | 111 | 61 (55%) | 30 (27%) | 20 (18%) |
| **TOTAL** | **567** | **172 (30%)** | **205 (36%)** | **190 (34%)** |

---

## 1. no-unused-vars (243 violations)

### 1.1 Low Risk - Unused Imports (7 violations)

Can be safely removed with no impact.

**Examples:**
```
- useCallback (unused import)
- logger (unused import in some files)
- fs (unused import)
- Manga (unused type import)
```

**Action**: Remove imports

---

### 1.2 Low Risk - Unused Helper Functions (50 violations)

Local functions/interfaces that have no references.

**Top Files:**
- `src/components/addManga/steps/searchStep.tsx` - 8 violations
- `src/hooks/useManga.ts` - 6 violations
- `src/pages/settings/indexers.tsx` - 6 violations

**Common Patterns:**
- `isExtendedMangaSearchResult` - Type guard never used
- `validateDate` - Validation function never called
- `safeGet` - Helper function never called
- `getErrorMessage` - Error handling helper never used
- `LocalProviderSearchResult` - Interface never used
- `SearchOptions` - Interface never used

**Action**: Remove or prefix with `_` if kept for future use

---

### 1.3 Medium Risk - Unused Function Parameters (63 violations)

Parameters required by interface but not used in implementation.

**Common Parameter Names:**
- `libraryId` (multiple files)
- `onRefresh` (callback props)
- `onToggleMonitoring` (callback props)
- `onAutoSearch` (callback props)
- `onManualSearch` (callback props)
- `canUseMangal` (feature flag)

**Action**: Prefix with `_` (e.g., `_libraryId`) to indicate intentionally unused

---

### 1.4 High Risk - useState Setters Never Called (30 violations)

May indicate incomplete features or unnecessary state.

**Top Examples:**
- `setEnrichingId` in `src/pages/manga/[id].tsx:375` - Never called
- `setFormat` in download components - Never used
- Multiple `setState` functions in components

**Action**: MANUAL REVIEW REQUIRED
- Verify if feature is incomplete
- Check if state should be read-only
- Consider removing state entirely if truly unused

---

### 1.5 Medium Risk - Unused Destructured Values (40 violations)

Values destructured from hooks/objects but never used.

**Examples:**
```typescript
const { format, setFormat } = useState(...)  // setFormat never used
const { value, error, isLoading } = hook()   // isLoading never checked
```

**Action**: Remove from destructuring pattern

---

## 2. no-non-null-assertion (213 violations)

### 2.1 Low Risk - Safe After Undefined Check (26 violations)

Non-null assertion immediately after explicit undefined/null check.

**Pattern:**
```typescript
if (value !== undefined) {
  const result = someFunc(value!)  // Safe - already checked
}
```

**Top Files:**
- `src/utils/frontend/type-adapters.ts:96-100` - 5 violations
- `src/components/library/utils/libraryUtils.ts` - 7 violations

**Examples:**
```typescript
// Line 96-100 in type-adapters.ts
...(extractStatus(result) !== undefined ? { status: extractStatus(result)! } : {}),
...(extractFormat(result) !== undefined ? { format: extractFormat(result)! } : {}),
...(extractNumber(result, 'chapters') !== undefined ? { chapters: extractNumber(result, 'chapters')! } : {}),

// libraryUtils.ts
if (filters.chaptersMin !== null && filters.chaptersMin !== undefined) {
  filtered = filtered.filter(m => (m.Chapter ? m.Chapter.length : 0) >= filters.chaptersMin!);
}
```

**Action**: Remove `!`, TypeScript should infer type safely after check

---

### 2.2 Medium Risk - Map/Array Operations (85 violations)

Assumes Map.get() or array access will succeed.

**Pattern:**
```typescript
grouped.get(volumeNum)!.push(chapter)  // Assumes key exists
arr[index]!.property  // Assumes index valid
```

**Top Files:**
- `src/components/manga/VolumeChapterTable.tsx:90`
- `src/server/api/services/websocketService.ts` - 8 violations
- `src/server/services/search/UnifiedProviderRegistry.ts` - 8 violations

**Action**: REFACTOR REQUIRED
```typescript
// Before
map.get(key)!.push(item)

// After - Option 1: Optional chaining
map.get(key)?.push(item)

// After - Option 2: Explicit check
const arr = map.get(key)
if (arr) {
  arr.push(item)
}
```

---

### 2.3 High Risk - No Visible Checks (102 violations)

No apparent null/undefined check before non-null assertion.

**Pattern:**
```typescript
result.error!  // May be undefined!
data.field!    // No check visible
```

**Top Files:**
- `src/utils/offline/offline-storage.ts` - 10 violations
- `src/server/parsers/monitoring/MetricsCollector.ts` - 7 violations
- `src/server/services/download/downloadManager.ts` - 7 violations
- `src/server/services/metadata/utils/fandomTableParser.ts` - 7 violations

**Example:**
```typescript
// useProviderSearch.ts:150
onError(result.provider, result.error!);  // HIGH RISK - error may be undefined
```

**Action**: MANUAL REVIEW REQUIRED
1. Add proper null checks
2. Use optional chaining
3. Add type guards
4. Refactor to handle null/undefined cases

---

## 3. require-await (111 violations)

### 3.1 Low Risk - Event Handlers (33 violations)

Event handlers marked async but contain no await statements.

**Pattern:**
```typescript
eventSource.onopen = async () => {
  logger.info('Connected')  // No await
}

onClick = async () => {
  setValue(newValue)  // No await
}
```

**Top Files:**
- `src/sdk/examples/advanced-features.ts:232` - 4 violations
- `src/hooks/useBackgroundTask.ts` - 2 violations
- `src/hooks/useCalendar.ts` - 2 violations

**Action**: Remove `async` keyword

---

### 3.2 Low Risk - Simple Wrappers (28 violations)

Functions that just return values with no async operations.

**Pattern:**
```typescript
async getValue() {
  return this.cachedValue  // No await
}
```

**Top Files:**
- `src/server/cache/cache-adapter.ts:loadPreferences` - 4 violations
- `src/store/useStoreActions.ts` - 4 violations

**Action**: Remove `async` keyword if not required by interface

---

### 3.3 Medium Risk - Interface Methods (30 violations)

Methods that may need to match async interface requirements.

**Pattern:**
```typescript
class Adapter implements IAdapter {
  async fetchData() {  // Interface requires async
    return this.cache  // But no await needed
  }
}
```

**Action**: REVIEW REQUIRED
1. Check if interface requires async
2. Check if callers expect Promise
3. If required, add comment: `// eslint-disable-line @typescript-eslint/require-await`
4. If not required, remove `async`

---

### 3.4 High Risk - Complex Logic (20 violations)

Functions with complex logic that may be intentionally async for future-proofing.

**Pattern:**
```typescript
async fetchAllMatches() {
  // Multiple synchronous operations
  // But signature might be required or future-proof
}
```

**Action**: MANUAL REVIEW REQUIRED
- Check if async needed for consistency with similar methods
- Check if method planned to be async in future
- Verify all call sites

---

## Priority Matrix

### Recommended Fix Order

#### Wave 1: Quick Wins (Est. 3-4 hours)
1. **no-unused-vars**: Remove unused imports (7) 🟢
2. **no-unused-vars**: Remove unused helpers (50) 🟢
3. **require-await**: Event handlers (33) 🟢
**Total**: ~90 violations

#### Wave 2: Safe Refactoring (Est. 5-6 hours)
1. **no-non-null-assertion**: After checks (26) 🟡
2. **require-await**: Simple wrappers (28) 🟡
3. **no-unused-vars**: Prefix parameters (40) 🟡
**Total**: ~94 violations

#### Wave 3: Manual Review (Est. 8-10 hours)
1. **no-non-null-assertion**: Map/Array ops (85) 🔴
2. **no-unused-vars**: useState setters (30) 🔴
3. **require-await**: Interface methods (30) 🔴
**Total**: ~145 violations

#### Wave 4: Complex Cases (Est. 10-12 hours)
1. **no-non-null-assertion**: No visible checks (102) 🔴
2. **no-unused-vars**: Props/parameters (33) 🔴
3. **require-await**: Complex logic (20) 🔴
**Total**: ~155 violations

---

## File-by-File Breakdown

### Top 20 Files by Violation Count

| # | File | no-unused-vars | no-non-null | require-await | Total |
|---|------|----------------|-------------|---------------|-------|
| 1 | src/pages/manga/[id].tsx | 15 | 3 | 1 | 19 |
| 2 | src/server/trpc/routers/manga.ts | 10 | 5 | 2 | 17 |
| 3 | src/utils/frontend/type-adapters.ts | 2 | 10 | 0 | 12 |
| 4 | src/utils/offline/offline-storage.ts | 1 | 10 | 0 | 11 |
| 5 | src/components/addManga/steps/searchStep.tsx | 8 | 2 | 0 | 10 |
| 6 | src/server/api/services/websocketService.ts | 1 | 8 | 1 | 10 |
| 7 | src/server/services/search/UnifiedProviderRegistry.ts | 1 | 8 | 1 | 10 |
| 8 | src/components/manga/MobileChapterList.tsx | 7 | 2 | 0 | 9 |
| 9 | src/components/manga/ResponsiveMangaDetail.tsx | 7 | 2 | 0 | 9 |
| 10 | src/sdk/examples/advanced-features.ts | 2 | 3 | 4 | 9 |
| 11 | src/sdk/examples/websocket-realtime.ts | 7 | 1 | 0 | 8 |
| 12 | src/components/library/utils/libraryUtils.ts | 1 | 7 | 0 | 8 |
| 13 | src/server/api/adapters/WebSocketApiAdapter.ts | 1 | 7 | 0 | 8 |
| 14 | src/server/parsers/monitoring/MetricsCollector.ts | 1 | 7 | 0 | 8 |
| 15 | src/server/services/download/downloadManager.ts | 1 | 7 | 0 | 8 |
| 16 | src/components/mobile/ActionSheet.tsx | 6 | 1 | 0 | 7 |
| 17 | src/hooks/useManga.ts | 6 | 0 | 2 | 8 |
| 18 | src/pages/settings/indexers.tsx | 6 | 1 | 0 | 7 |
| 19 | src/server/cache/cache-adapter.ts | 0 | 2 | 4 | 6 |
| 20 | src/server/parsers/pattern-recognition/core/MLPipeline.ts | 0 | 2 | 4 | 6 |

---

## Next Steps

1. ✅ Review this categorization
2. ⏭️ Set up agentic analyzer workflow (Phase 2)
3. ⏭️ Begin Wave 1 fixes (Low risk quick wins)
4. ⏭️ Test and validate after each wave
5. ⏭️ Document decisions in `manual-review-decisions.md`

---

*This document is the foundation for the manual review process*
*Update as new patterns emerge during cleanup*
