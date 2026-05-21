# Prisma Types Migration Plan

**Date**: January 2025  
**Status**: Active  
**Objective**: Migrate entire codebase to use Prisma types as the single source of truth

## Current State Analysis

### Error Summary
- **Total TypeScript Errors**: ~2,121 lines
- **Main Error Categories**:
  1. Canonical type imports that no longer exist
  2. Property access on incorrect types (e.g., `{}` instead of arrays)
  3. Enum value mismatches (lowercase vs UPPERCASE)
  4. Type shape mismatches between components and Prisma

### Key Problem Areas

#### 1. Canonical Type References
Files still importing from `types/canonical`:
- `src/components/addManga/steps/confirmationStep/hooks/useConfirmationState.ts`
- `src/components/manga/BulkDownloadModal.tsx`
- 20+ other files

#### 2. Converter Utilities
Unnecessary converters in `src/utils/converters/`:
- `chapter-enum-converters.ts`
- `task-enum-converters.ts`
- `author-converter.ts`
- `kapowarr-converters.ts`

#### 3. Library Component Issues
Components expecting wrong type shapes:
- `chapters` being treated as `{}` instead of array
- Missing array methods (`length`, `filter`, `map`)
- Property access issues

#### 4. Enum Mismatches
- Components using lowercase enum values
- Prisma expects UPPERCASE values
- SyncStatus type conflicts

## Migration Strategy

### Phase 1: Type System Cleanup
1. **Remove all canonical type imports**
   - Replace with `import { ... } from '@prisma/client'`
   - Update all type references

2. **Delete converter utilities**
   - Remove entire `src/utils/converters` directory
   - Update imports to use Prisma types directly

3. **Clean up type definitions**
   - Remove duplicate definitions in `src/types`
   - Keep only necessary extended types that build on Prisma

### Phase 2: Fix Component Type Shapes
1. **Library components**
   - Fix `chapters` type from `{}` to proper array
   - Update all array operations
   - Fix property access patterns

2. **Search components**
   - Update MangaSearchResult to match Prisma shape
   - Fix provider-specific type conflicts

3. **Calendar components**
   - Fix JsonValue property access
   - Update schedule override types

### Phase 3: Enum Standardization
1. **Update all enum values to UPPERCASE**
   - TaskStatus: PENDING, IN_PROGRESS, COMPLETED, FAILED
   - ChapterStatus: PENDING, DOWNLOADING, COMPLETED, ERROR
   - MangaStatus: ONGOING, COMPLETED, HIATUS, CANCELLED
   - SyncStatus: PENDING, IN_PROGRESS, RESOLVED, FAILED

2. **Remove string casts**
   - Use enum values directly
   - No type assertions needed

### Phase 4: Component Refactoring
1. **Update prop interfaces**
   - Match Prisma type shapes exactly
   - Remove custom intermediate types

2. **Fix data transformations**
   - Work with Prisma shapes directly
   - No conversion layers

## Implementation Steps

### Step 1: Global Search and Replace
```bash
# Replace canonical imports
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's|from.*types/canonical.*|from "@prisma/client"|g' {} \;
```

### Step 2: Remove Converters
```bash
# Delete converter directory
rm -rf src/utils/converters
```

### Step 3: Fix Type Imports (Manual)
For each file with errors:
1. Identify the Prisma type needed
2. Import from `@prisma/client`
3. Update usage to match Prisma shape

### Step 4: Fix Component Props
Example transformation:
```typescript
// Before
interface Props {
  chapters: {}
}

// After
import { Chapter } from '@prisma/client'
interface Props {
  chapters: Chapter[]
}
```

### Step 5: Update Enum Usage
Example transformation:
```typescript
// Before
status === 'pending'

// After
import { TaskStatus } from '@prisma/client'
status === TaskStatus.PENDING
```

## Validation

After each phase:
1. Run `pnpm type-check`
2. Fix any new errors
3. Test functionality with `pnpm dev`
4. Commit changes

## Expected Outcomes

1. **Zero TypeScript errors**
2. **Single source of truth**: All types from Prisma
3. **No duplicate definitions**
4. **No conversion utilities**
5. **Direct Prisma shape usage**
6. **Consistent UPPERCASE enums**

## Files to Delete

- `src/utils/converters/` (entire directory)
- `src/types/canonical/` (entire directory)
- `src/types/canonical.ts`
- Any `.bak` or temporary files

## Files to Update

All files importing from:
- `types/canonical`
- `utils/converters`
- Custom type definitions that duplicate Prisma

## Success Criteria

- ✅ `pnpm type-check` shows 0 errors
- ✅ All imports from `@prisma/client`
- ✅ No converter utilities
- ✅ Components work with Prisma shapes
- ✅ Enums use UPPERCASE values
- ✅ No duplicate type definitions