# Remaining ESLint Violations - Comprehensive Analysis

*Date: 2025-12-23*
*Current Status: 59 problems (12 errors, 47 warnings)*
*Previous Session: Reduced from 184 → 59 (68% reduction)*

---

## Executive Summary

After fixing all `no-console` and `@typescript-eslint/no-unnecessary-condition` violations, the remaining 59 violations are **structural issues** that require code refactoring rather than simple fixes. These are primarily:

| Category | Count | Type | Effort |
|----------|-------|------|--------|
| Complexity | 18 | Warning | Medium-High |
| Max-Depth | 12 | Warning | Medium |
| Max-Lines-Per-Function | 8 | Error/Warning | High |
| Max-Lines (File) | 5 | Error | High |
| Max-Statements | 3 | Warning | Medium |
| Quick Fixes | 3 | Error | Low |

---

## 🔴 Part 1: Quick-Fix Errors (3 violations) - Immediate Action

### 1.1 `@typescript-eslint/no-unsafe-assignment` (1 error)

**File:** `src/components/addManga/steps/wizard/volumes-chapters/components/VolumeDetailsDrawer.tsx:191`

**Current Code:**
```typescript
// Line 191 - Unsafe assignment of `any` value
const someValue = someAnyTypedSource;
```

**Fix Strategy:**
- Add proper type annotation
- Use type guard or type assertion with validation
- Or use `unknown` with runtime check

**Estimated Effort:** 10-15 minutes

---

### 1.2 `no-param-reassign` (1 error)

**File:** `src/components/addManga/steps/wizard/media-selection/CoverImageCard.tsx:153`

**Current Code:**
```typescript
// Line 153 - Assignment to property of function parameter 'e'
e.someProperty = value;
```

**Fix Strategy:**
- Create a new object instead of mutating the parameter
- Or use spread operator: `const modified = { ...e, someProperty: value }`
- Or use eslint-disable if intentional (e.g., event handler)

**Estimated Effort:** 5-10 minutes

---

### 1.3 `@next/next/no-img-element` (1 error)

**File:** `src/components/addManga/steps/wizard/media-selection/CoverImageCard.tsx:134`

**Current Code:**
```typescript
// Line 134 - Using <img> instead of next/image
<img src={...} alt={...} />
```

**Fix Strategy:**
- Replace with `<Image>` from `next/image`
- Add required `width` and `height` props
- Or use `fill` prop with `position: relative` parent
- If external image, add domain to `next.config.mjs` images.remotePatterns

**Estimated Effort:** 15-20 minutes

---

## 🟠 Part 2: Complexity Violations (18 warnings)

**Rule:** `complexity` - Cyclomatic complexity exceeds 20

### Files Affected:

| File | Function | Complexity | Max |
|------|----------|------------|-----|
| `data-retrieval.ts:287` | `getChaptersForSource` | 29 | 20 |
| `source-selection.ts:58` | `handleAdditionalSourceSelection` | 22 | 20 |
| `useMangaSelection.ts:67` | async arrow function | 31 | 20 |
| `SearchSelectStep.tsx:101` | arrow function | 39 | 20 |
| `VolumeDetailsDrawer.tsx:254` | arrow function | **72** | 20 |
| `utils.ts:64` | `extractVolumeCount` | 25 | 20 |
| `utils.ts:111` | `extractTotalChapters` | **42** | 20 |
| `utils.ts:256` | `hasExistingVolumes` | 25 | 20 |
| `ScanItemDetailView.tsx:189` | `ScanItemDetailView` | **52** | 20 |
| `ScanResultsPanel.tsx:195` | `ScanResultsPanel` | 22 | 20 |
| `StatsSection.tsx:120` | `StatsSection` | 22 | 20 |
| `hooks/manga/index.ts:221` | arrow function | **54** | 20 |
| `library.ts:151` | arrow function | 21 | 20 |
| `WikipediaProvider.ts:348` | `buildOptionalMetadata` | 29 | 20 |
| `parsing-utils.ts:209` | `parseDateMatch` | **40** | 20 |
| `volume-parser.ts:485` | `extractDescriptionAndChapters` | 29 | 20 |
| `zero-indexed-pattern.ts:140` | `extractVolumeMapping` | 27 | 20 |
| `fandom-url-parser-utils.ts:540` | arrow function | 22 | 20 |

### Refactoring Strategy:

**High Priority (Complexity > 40):**
1. `VolumeDetailsDrawer.tsx` (72) → Split into 3-4 sub-components
2. `hooks/manga/index.ts` (54) → Extract helper functions
3. `ScanItemDetailView.tsx` (52) → Component decomposition
4. `extractTotalChapters` (42) → Break into parsing stages
5. `parseDateMatch` (40) → Create date format handlers

**Pattern to Apply:**
```typescript
// BEFORE: High complexity monolith
function complexFunction(data) {
  if (condition1) {
    if (condition2) {
      // deep logic
    }
  }
  // ... 50+ branches
}

// AFTER: Extracted helper functions
function handleCondition1(data) { /* ... */ }
function handleCondition2(data) { /* ... */ }
function complexFunction(data) {
  if (condition1) return handleCondition1(data);
  if (condition2) return handleCondition2(data);
  return defaultHandler(data);
}
```

**Estimated Effort:** 2-4 hours per high-priority function

---

## 🟡 Part 3: Max-Depth Violations (12 warnings)

**Rule:** `max-depth` - Blocks nested too deeply (max 4)

### Files Affected:

| File | Lines | Current Depth |
|------|-------|---------------|
| `anilist-provider/fetch-volumes.ts` | 377, 379 | 5, 6 |
| `data-retrieval.ts` | 400 | 5 |
| `utils.ts` | 164, 165, 169, 170, 173, 180 | 5, 6 |
| `zero-indexed-pattern.ts` | 224, 240 | 5 |

### Refactoring Strategy:

**Pattern - Early Return:**
```typescript
// BEFORE: Deep nesting
function process(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        for (const item of data.items) {
          if (item.valid) {
            // depth 5
          }
        }
      }
    }
  }
}

// AFTER: Early returns
function process(data) {
  if (!data?.items?.length) return;

  for (const item of data.items) {
    if (!item.valid) continue;
    processItem(item); // extracted
  }
}
```

**Pattern - Extract Inner Loop:**
```typescript
// BEFORE: Nested loops
data.volumes.forEach(vol => {
  vol.chapters.forEach(ch => {
    if (ch.valid) {
      // depth 5+
    }
  });
});

// AFTER: Extracted helper
function processChapter(ch) {
  if (!ch.valid) return null;
  // logic
}

data.volumes.forEach(vol => {
  vol.chapters.forEach(processChapter);
});
```

**Estimated Effort:** 30-60 minutes per file

---

## 🔵 Part 4: Max-Lines-Per-Function (8 violations)

**Rule:** `max-lines-per-function` - Function exceeds line limit

### Files Affected:

| File | Function | Lines | Max |
|------|----------|-------|-----|
| `SearchSelectStep.tsx:64` | arrow function | 318 | 300 |
| `VolumeCoversPanel.tsx:71` | arrow function | 383 | 300 |
| `VolumeDetailsDrawer.tsx:254` | arrow function | (part of 561-line file) | 300 |
| `FullFunctionalityLibraryManager.tsx:57` | Component | 395 | 300 |
| `ScanItemDetailView.tsx:189` | Component | **727** | 300 |
| `useUnifiedWebSocket.ts:92` | Hook | 312 | 300 |
| `FlareSolverrSettings.tsx:177` | Component | 501 | 500 |
| `fandom-extractors.ts:55` | `extractChaptersFromFandomVolumes` | 106 | 100 |
| `fandom-url-parser-utils.ts:409` | `extractGalleryImages` | **206** | 100 |
| `admin.ts:252` | async arrow function | 104 | 100 |

### Refactoring Strategy:

**Component Decomposition:**
```typescript
// BEFORE: Monolithic component (700+ lines)
export function ScanItemDetailView({ ... }) {
  // hooks
  // handlers
  // render logic
  return (
    <Container>
      {/* 500+ lines of JSX */}
    </Container>
  );
}

// AFTER: Decomposed
// ScanItemDetailView/index.tsx (main)
// ScanItemDetailView/hooks/useDetailState.ts
// ScanItemDetailView/components/HeaderSection.tsx
// ScanItemDetailView/components/MetadataSection.tsx
// ScanItemDetailView/components/ActionsSection.tsx
```

**Hook Extraction:**
```typescript
// BEFORE: All logic in component
function Component() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  // 50 lines of state management
  // 100 lines of handlers
}

// AFTER: Custom hook
function useComponentLogic() {
  // all state and handlers
  return { state1, state2, handlers };
}

function Component() {
  const { state1, state2, handlers } = useComponentLogic();
  // just render
}
```

**Estimated Effort:** 2-4 hours per large component

---

## 🟣 Part 5: Max-Lines File Violations (5 errors)

**Rule:** `max-lines` - File exceeds line limit

| File | Lines | Max | Over By |
|------|-------|-----|---------|
| `VolumeCoversPanel.tsx` | 509 | 500 | 9 |
| `VolumeDetailsDrawer.tsx` | 561 | 500 | 61 |
| `FullFunctionalityLibraryManager.tsx` | 583 | 500 | 83 |
| `ScanItemDetailView.tsx` | **1005** | 500 | **505** |
| `downloadOperations.ts` | 882 | 800 | 82 |

### Refactoring Strategy:

**File Splitting Patterns:**

```
ScanItemDetailView.tsx (1005 lines) →
├── index.tsx (exports, main component ~100 lines)
├── types.ts (interfaces ~50 lines)
├── hooks/
│   ├── useDetailData.ts (~100 lines)
│   ├── useDetailActions.ts (~100 lines)
│   └── useDetailState.ts (~100 lines)
├── components/
│   ├── HeaderSection.tsx (~100 lines)
│   ├── MediaSection.tsx (~100 lines)
│   ├── MetadataSection.tsx (~100 lines)
│   ├── ChaptersSection.tsx (~100 lines)
│   └── ActionsSection.tsx (~100 lines)
└── utils.ts (helpers ~50 lines)
```

**Estimated Effort:** 4-8 hours per large file

---

## 🔶 Part 6: Max-Statements Violations (3 warnings)

**Rule:** `max-statements` - Function has too many statements (max 50)

| File | Function | Statements | Max |
|------|----------|------------|-----|
| `useMangaSelection.ts:67` | async arrow | 56 | 50 |
| `zero-indexed-pattern.ts:140` | `extractVolumeMapping` | 62 | 50 |

### Refactoring Strategy:

```typescript
// BEFORE: 60+ statements
async function bigFunction() {
  const a = ...;
  const b = ...;
  // 60+ assignments and operations
}

// AFTER: Grouped into phases
async function bigFunction() {
  const phase1Result = await handlePhase1();
  const phase2Result = processPhase2(phase1Result);
  return finalizeResult(phase2Result);
}
```

**Estimated Effort:** 1-2 hours per function

---

## 📊 Priority Matrix

### Immediate (Can fix in < 30 min total):
1. ✅ `no-img-element` in CoverImageCard.tsx
2. ✅ `no-param-reassign` in CoverImageCard.tsx
3. ✅ `no-unsafe-assignment` in VolumeDetailsDrawer.tsx

### Short-Term (1-2 sessions):
1. 🔸 `fandom-extractors.ts` - Extract chunks (6 lines over)
2. 🔸 `admin.ts` - Split async function (4 lines over)
3. 🔸 `VolumeCoversPanel.tsx` - Minor extraction (9 lines over)

### Medium-Term (Dedicated refactoring):
1. 🔶 `ScanItemDetailView.tsx` - Component decomposition (505 lines over, complexity 52)
2. 🔶 `VolumeDetailsDrawer.tsx` - Component decomposition (complexity 72)
3. 🔶 `downloadOperations.ts` - Service layer refactoring (82 lines over)

### Long-Term (Architecture review):
1. 🔷 Parser utilities (`utils.ts`, `parsing-utils.ts`, `volume-parser.ts`)
2. 🔷 Hook consolidation (`useMangaSelection`, `useUnifiedWebSocket`)
3. 🔷 Provider refactoring (`WikipediaProvider`, `fandom-url-parser-utils`)

---

## 🎯 Recommended Approach

### Phase 1: Quick Wins (30 minutes)
Fix the 3 quick-fix errors to eliminate all "real" errors.

### Phase 2: Low-Hanging Fruit (2 hours)
- Split `fandom-extractors.ts` function
- Split `admin.ts` async function
- Extract helper from `VolumeCoversPanel.tsx`

### Phase 3: Component Decomposition (8-16 hours)
Target the largest files:
1. `ScanItemDetailView.tsx` → 6-8 files
2. `VolumeDetailsDrawer.tsx` → 4-5 files
3. `FullFunctionalityLibraryManager.tsx` → 4-5 files

### Phase 4: Function Extraction (4-8 hours)
Reduce complexity in utility functions:
- `parseDateMatch` → date format handlers
- `extractTotalChapters` → parsing stages
- `extractVolumeMapping` → helper functions

---

## 📝 Implementation Checklist

```markdown
### Quick Fixes
- [ ] CoverImageCard.tsx: Replace <img> with next/image
- [ ] CoverImageCard.tsx: Fix param reassignment
- [ ] VolumeDetailsDrawer.tsx: Add type to unsafe assignment

### Short-Term Refactors
- [ ] fandom-extractors.ts: Split extractChaptersFromFandomVolumes
- [ ] admin.ts: Split async arrow function
- [ ] VolumeCoversPanel.tsx: Extract helper component

### Component Decomposition
- [ ] ScanItemDetailView.tsx: Create component folder structure
- [ ] VolumeDetailsDrawer.tsx: Extract sub-components
- [ ] FullFunctionalityLibraryManager.tsx: Component split

### Utility Refactors
- [ ] utils.ts: Reduce nesting in extractTotalChapters
- [ ] parsing-utils.ts: Create date format handlers
- [ ] zero-indexed-pattern.ts: Extract helper functions
```

---

## 🔗 Related Documentation

- [ESLint Rules Reference](./eslint-rules-reference.md)
- [ESLint Suppression Policy](./ESLINT_SUPPRESSION_POLICY.md)
- [Type Safety Progress](./TYPE_SAFETY_PROGRESS.md)
- [Architecture Overview](../architecture/architecture-overview.md)

---

*Last Updated: 2025-12-23*
*Status: Analysis Complete*
*Next Action: Fix 3 quick-fix errors, then prioritize component decomposition*
