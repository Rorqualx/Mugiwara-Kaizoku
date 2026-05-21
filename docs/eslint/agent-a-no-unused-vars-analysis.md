# Agent A: no-unused-vars Detailed Analysis

*Generated*: 2025-11-07
*Total Violations*: 243 (analyzing in batches)
*Agent*: Analyzer A
*Status*: In Progress

---

## Executive Summary

This analysis provides a detailed, file-by-file, line-by-line examination of all `@typescript-eslint/no-unused-vars` violations in the codebase. Each violation is categorized by risk level with specific recommendations.

### Progress Status

- **Analyzed**: 16 violations (detailed analysis complete)
- **Collected**: ~50 violations (batch collection in progress)
- **Remaining**: ~193 violations (to be collected and analyzed)

### Risk Distribution (from analyzed violations)

- **Low Risk** (can auto-fix): 8 violations (50%)
- **Medium Risk** (needs review): 6 violations (37.5%)
- **High Risk** (needs user decision): 2 violations (12.5%)

---

## Methodology

For each violation, this analysis provides:

1. **File:Line:Column** - Exact location
2. **Variable Name** - What's unused
3. **Type** - [Import/Variable/Parameter/State Setter/Function/Interface/Type]
4. **Context** - Code snippet showing the violation
5. **References Check** - How many references exist
6. **Risk Level** - [Low/Medium/High]
7. **Recommendation** - [Remove/Prefix with _/Keep with comment/User decision]
8. **Rationale** - Why this recommendation

---

## Detailed Analysis by File

### src/pages/manga/[id].tsx (15 violations)

This is the manga detail page - a complex component with metadata handling, state management, and UI interactions. Many violations appear to be incomplete features or legacy code.

#### Line 46:10 - 'Manga' import

- **Type**: Import
- **Code**:
```typescript
import { Manga } from '@prisma/client';
```
- **References**: Searched codebase - "Manga" appears in string contexts (titles, messages) but the type itself is not used in this file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove import
- **Rationale**: The file uses `MangaWithRelations` and `MangaEntity` from domain types, not the raw Prisma `Manga` type. Clean removal.

---

#### Line 99:10 - 'hasMetadata' function

- **Type**: Function (utility/type guard)
- **Code**:
```typescript
function hasMetadata(obj: unknown): obj is {
    metadata?: Record<string, unknown>;
} {
    return isObject(obj) && 'metadata' in obj && isObject((obj as Record<string, unknown>)['metadata']);
}
```
- **References**: 0 references found in file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove
- **Rationale**: Type guard is well-implemented but completely unused. No references in the file. Safe to remove.

---

#### Line 110:10 - 'createDomainManga' function

- **Type**: Function (data transformation)
- **Code**:
```typescript
function createDomainManga(mangaData: Record<string, unknown>): MangaWithRelations {
    // Validate and create chapters array with domain types
    const chapters: ChapterEntity[] = [];
    if ('chapters' in mangaData && Array.isArray(mangaData['chapters'])) {
        for (const chapter of mangaData['chapters']) {
            // ... implementation
        }
    }
    // ... rest of function
}
```
- **References**: 0 references found
- **Exported**: No
- **Risk**: Medium
- **Recommendation**: Keep with comment or remove after user confirmation
- **Rationale**: This is a complex data transformation function (30+ lines). It appears to be legacy code from when data came from a different source. The function has logic for converting raw data to domain types. **User should confirm** this isn't needed for future features (e.g., importing from external sources). If truly not needed, safe to remove.

---

#### Line 372:10 - 'formatFileSize' function

- **Type**: Function (utility)
- **Code**:
```typescript
function formatFileSize(bytes: number): string {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
```
- **References**: 0 references in file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Move to shared utils or remove
- **Rationale**: This is a useful utility function but unused in this file. Should either be:
  1. Moved to `src/lib/format-utils.ts` or similar (if needed elsewhere)
  2. Removed if not needed anywhere

Check if file size formatting is needed elsewhere in the app first.

---

#### Line 429:10 - 'getLanguageName' function

- **Type**: Function (utility)
- **Code**:
```typescript
function getLanguageName(code: string): string {
    const languages: Record<string, string> = {
        'en': 'English',
        'ja': 'Japanese',
        // ... more mappings
    };
    return languages[code] ?? code;
}
```
- **References**: 0 references in file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Move to shared i18n utils or remove
- **Rationale**: Language code mapping is useful functionality but unused here. Recommend:
  1. If i18n is planned, move to `src/lib/i18n-utils.ts`
  2. Otherwise remove (can recreate when needed)

---

#### Line 449:10 - 'formatDate' function

- **Type**: Function (utility)
- **Code**:
```typescript
function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
}
```
- **References**: 0 references in file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove (use library function)
- **Rationale**: This wraps native `toLocaleDateString()` with minimal added value. The codebase likely has better date formatting utilities (check if `date-fns` or similar is used). Remove and use standard approach when needed.

---

#### Line 512:11 - 'MangaDetailState' interface

- **Type**: Interface/Type
- **Code**:
```typescript
interface MangaDetailState {
    isDescriptionExpanded: boolean;
    isMonitored: boolean;
    isSynonymsExpanded: boolean;
}
```
- **References**: 0 references (state is managed inline with useState)
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove
- **Rationale**: This interface was likely created to type component state but is unused. The component uses individual `useState` hooks instead of a state object. Safe to remove.

---

#### Line 519:12 - 'isDescriptionExpanded' state variable

- **Type**: State variable (React useState)
- **Code**:
```typescript
const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
```
- **References**: State is declared but never read
- **Exported**: No
- **Risk**: **HIGH**
- **Recommendation**: **User Decision Required**
- **Rationale**: This is a UI state variable for expanding/collapsing the manga description. The state and setter are defined but never used, suggesting:
  1. **Incomplete feature**: Description expansion was planned but not implemented
  2. **Regression**: Feature was removed but state wasn't cleaned up

**User should decide**:
- If description expansion should be implemented → Keep and implement feature
- If not needed → Remove state

Impacts: This is user-facing functionality.

---

#### Line 519:35 - 'setIsDescriptionExpanded' state setter

- **Type**: State setter (React useState)
- **Code**: Same as above - the setter function
- **References**: 0 (never called)
- **Exported**: No
- **Risk**: **HIGH**
- **Recommendation**: **User Decision Required** (same as above)
- **Rationale**: Part of the same incomplete/removed description expansion feature.

---

#### Line 520:12 - 'isMonitored' state variable

- **Type**: State variable (React useState)
- **Code**:
```typescript
const [isMonitored, setIsMonitored] = useState<boolean>(false);
```
- **References**: State is declared but never read
- **Exported**: No
- **Risk**: Medium
- **Recommendation**: Remove (monitoring handled elsewhere)
- **Rationale**: Monitoring status is already fetched via tRPC (`autoDownloadConfig` on line 894). This local state appears to be redundant. The `setIsMonitored` setter is actually used later in the code (line 743), but `isMonitored` itself is never read. Likely can be removed if monitoring display uses the tRPC data directly.

**Note**: Need to verify `setIsMonitored` usage before removing.

---

#### Line 521:12 - 'isSynonymsExpanded' state variable

- **Type**: State variable (React useState)
- **Code**:
```typescript
const [isSynonymsExpanded, setIsSynonymsExpanded] = useState<boolean>(false);
```
- **References**: State is declared but never read
- **Exported**: No
- **Risk**: Medium
- **Recommendation**: User decision (incomplete feature)
- **Rationale**: Similar to description expansion - this appears to be an incomplete feature for showing/hiding manga synonyms (alternate titles). The synonyms data exists in manga metadata, but the UI toggle is not implemented.

**User should decide**: Implement or remove.

---

#### Line 521:32 - 'setIsSynonymsExpanded' state setter

- **Type**: State setter (React useState)
- **Code**: Same as above - the setter function
- **References**: 0 (never called)
- **Exported**: No
- **Risk**: Medium
- **Recommendation**: User decision (same as above)

---

#### Line 894:19 - 'autoDownloadConfig' query result

- **Type**: Variable (tRPC query result)
- **Code**:
```typescript
const { data: autoDownloadConfig } = trpc.manga.getAutoDownloadConfig.useQuery(
    { mangaId: mangaId ?? 0 },
    { enabled: !!mangaId && mangaId > 0 }
);
```
- **References**: Query is made but data is never used
- **Exported**: No
- **Risk**: Medium
- **Recommendation**: Remove query or implement feature
- **Rationale**: This fetches auto-download configuration but the data is never used in the UI. Either:
  1. Feature is incomplete (should display auto-download status)
  2. Query is leftover from refactoring

The query executes on every render (when enabled), causing unnecessary server calls. Should remove if not needed or implement the UI for showing auto-download config.

---

#### Line 1138:11 - 'totalSize' calculation

- **Type**: Variable (computed value)
- **Code**:
```typescript
const totalSize: number = manga?.Chapter?.reduce((sum: number, chapter: ChapterEntity) => {
    return sum + (typeof chapter.size === 'number' ? chapter.size : 0);
}, 0) ?? 0;
```
- **References**: Calculated but never used
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove or implement feature
- **Rationale**: This calculates the total size of all chapters for the manga but never displays it. Either:
  1. Remove if not needed
  2. Add to UI (e.g., "Total size: 1.2 GB" in manga stats)

Low risk because it's a simple calculation with no side effects.

---

#### Line 2220:26 - 'newCover' parameter

- **Type**: Function parameter (event handler)
- **Code**:
```typescript
onCoverSelected={newCover => {
    // Refresh the manga data after cover update
    void refetch();
    setIsCoverSelectorOpen(false);
}}
```
- **References**: Parameter is passed but not used
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Prefix with underscore: `_newCover`
- **Rationale**: This is a callback parameter from an event handler. The handler doesn't need the new cover value (it just refreshes all data). Following ESLint convention, prefix unused parameters with `_` to indicate intentional non-use.

**Fix**: `onCoverSelected={_newCover => {`

---

### src/pages/library/index.tsx (1 violation)

#### Line 8:29 - 'JSX' type import

- **Type**: Import (type)
- **Code**:
```typescript
import type { /* ... */ JSX } from 'react';
```
- **References**: Need to check file
- **Exported**: No
- **Risk**: Low
- **Recommendation**: Remove from import if unused
- **Rationale**: JSX type is often auto-imported by IDEs but not actually used. Need to verify if file uses `JSX.Element` or similar. If not, remove from import.

---

## Summary Statistics (Analyzed Files)

### By Type

| Type | Count | % |
|------|-------|---|
| State variable/setter | 5 | 31% |
| Function (utility) | 4 | 25% |
| Import | 2 | 13% |
| Query result | 1 | 6% |
| Interface | 1 | 6% |
| Calculated variable | 1 | 6% |
| Function parameter | 1 | 6% |
| **Total** | **16** | **100%** |

### By Risk Level

| Risk | Count | % | Action |
|------|-------|---|--------|
| Low | 8 | 50% | Safe to auto-fix |
| Medium | 6 | 37.5% | Needs review |
| High | 2 | 12.5% | User decision required |

---

## Patterns Discovered

### 1. **Incomplete UI Features**

Multiple violations involve state variables for UI interactions that were never completed:
- Description expansion (`isDescriptionExpanded`)
- Synonyms expansion (`isSynonymsExpanded`)
- Monitoring status (`isMonitored` - partially implemented)

**Recommendation**: Create user stories to either implement or remove these features.

### 2. **Utility Functions That Should Be Shared**

Several utility functions are defined locally but unused:
- `formatFileSize` - generic file size formatting
- `getLanguageName` - language code mapping
- `formatDate` - date formatting wrapper

**Recommendation**: Either:
- Move to shared utils in `src/lib/` if needed elsewhere
- Remove if truly not needed

### 3. **Data Transformation Legacy Code**

Functions like `createDomainManga` and `hasMetadata` suggest legacy data transformation logic that may have been replaced by tRPC/Prisma typed responses.

**Recommendation**: Verify these are not needed for import features, then remove.

### 4. **Unused tRPC Queries**

The `autoDownloadConfig` query executes but its data is never used, creating unnecessary server load.

**Recommendation**: Remove query or implement the UI to display the data.

### 5. **Unused Function Parameters**

Event handlers receive parameters that aren't used (e.g., `newCover` in callback).

**Recommendation**: Prefix with `_` per ESLint convention to indicate intentional non-use.

---

## Recommendations for Wave 1 (Quick Wins)

These violations are **Low Risk** and can be fixed immediately:

### Immediate Removals (No Risk)

1. **src/pages/manga/[id].tsx:46** - Remove unused `Manga` import
2. **src/pages/manga/[id].tsx:99** - Remove `hasMetadata` function
3. **src/pages/manga/[id].tsx:512** - Remove `MangaDetailState` interface
4. **src/pages/library/index.tsx:8** - Remove `JSX` from import (if confirmed unused)

### Rename with Underscore (No Risk)

5. **src/pages/manga/[id].tsx:2220** - Rename `newCover` to `_newCover`

### Conditional Removals (Need Quick Check)

6. **src/pages/manga/[id].tsx:372** - Remove `formatFileSize` (check if used elsewhere)
7. **src/pages/manga/[id].tsx:429** - Remove `getLanguageName` (check if used elsewhere)
8. **src/pages/manga/[id].tsx:449** - Remove `formatDate` (check if used elsewhere)
9. **src/pages/manga/[id].tsx:1138** - Remove `totalSize` calculation (or add to UI)

**Total Quick Wins**: 9 violations (~37.5% of analyzed)

---

## Next Steps

### For Agent B (Fixer)

1. **Start with Low Risk violations** - The 8 items above can be fixed immediately
2. **For Medium Risk violations** - Review context and make informed decisions:
   - Remove utility functions after checking usage elsewhere
   - Remove `createDomainManga` after confirming not needed for imports
   - Remove monitoring/query code or implement features
3. **For High Risk violations** - Escalate to user:
   - Description expansion feature
   - Synonyms expansion feature

### For User

**Decisions needed on**:
1. Should description expansion be implemented? (2 violations)
2. Should synonyms expansion be implemented? (2 violations)
3. Should auto-download config be displayed in UI? (1 violation)
4. Should monitoring status local state be removed? (1 violation + setter)

---

## Collection Progress

### Files Analyzed in Detail

- ✅ src/pages/manga/[id].tsx (15 violations)
- ✅ src/pages/library/index.tsx (1 violation)

### Files With No Violations (Confirmed Clean)

- ✅ src/pages/settings/index.tsx
- ✅ src/components/addManga/AddMangaModal.tsx
- ✅ src/components/chaptersTable.tsx

### Still Collecting From

- src/server/routers/*.ts
- src/server/services/*.ts
- src/components/addManga/**/*.tsx
- src/components/common/**/*.tsx
- src/components/calendar/**/*.tsx
- src/pages/**/*.tsx (remaining files)
- Other src directories

**Estimated remaining**: ~227 violations across ~100+ files

---

## Analysis Framework for Remaining Violations

For each violation found, follow this template:

```markdown
#### Line X:Y - 'variableName' description

- **Type**: [Import/Variable/Parameter/State Setter/Function/Interface/Type/Query]
- **Code**:
```typescript
[code snippet]
```
- **References**: [count] references found [where]
- **Exported**: [Yes/No]
- **Risk**: [Low/Medium/High]
- **Recommendation**: [Specific action]
- **Rationale**: [Why + any context needed]
```

---

## Appendix: Tools Used

### Reference Search Commands

```bash
# Find all references to a symbol
grep -rn "variableName" src/

# Find type references
ast-grep --pattern '$VAR: TypeName' src/

# Find function calls
ast-grep --pattern 'functionName($$$)' src/
```

### Collection Commands

```bash
# Get violations from a file
bunx eslint "path/to/file.tsx" 2>&1 | grep "no-unused-vars"

# Get violations from a directory
bunx eslint "src/pages/**/*.tsx" 2>&1 | grep "no-unused-vars"
```

---

*Last Updated*: 2025-11-07 20:30 UTC
*Analysis Status*: 16/243 violations analyzed (6.6%)
*Next Update*: After batch collection completes
