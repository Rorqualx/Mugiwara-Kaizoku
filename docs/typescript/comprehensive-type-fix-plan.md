# Comprehensive Type Error Fix Plan

## Current Situation
- **3,273 TypeScript errors** remain after initial fixes
- Main issues are AsyncResult misuse, enum values, and duplicate types
- Top 5 files account for ~525 errors (16% of total)

## Systematic Fix Approach

### Step 1: Remove All Type Converters and Compatibility Layers
These are causing type fragmentation and should be eliminated:
- Remove all files in `src/utils/converters/`
- Remove compatibility imports/exports
- Update all usages to import directly from `@prisma/client`

### Step 2: Fix Enum Value Mismatches
All enum values MUST be UPPERCASE to match Prisma:
- Search for lowercase enum values: `pending`, `completed`, `ongoing`, etc.
- Replace with: `PENDING`, `COMPLETED`, `ONGOING`
- Update string literals in comparisons

### Step 3: Fix AsyncResult Access Patterns
Many files incorrectly access AsyncResult properties:
```typescript
// WRONG
const data = asyncResult.data;

// CORRECT
if (isSuccess(asyncResult)) {
  const data = asyncResult.data;
}
```

### Step 4: Consolidate Duplicate Types
Remove all duplicate interface definitions:
- Keep only one definition of each interface
- Place shared types in `src/types/`
- Import from single location

### Step 5: Update All Imports
Ensure all type imports come from correct sources:
- Prisma types from `@prisma/client`
- Domain types from `src/types/`
- No circular dependencies

## File-Specific Fixes

### searchStep.tsx (238 errors)
- Fix AsyncResult access patterns
- Update enum values to UPPERCASE
- Remove type assertions

### libraryUtils.ts (81 errors)
- Update status enum values
- Fix type imports

### test-comicvine-volume.ts (78 errors)
- This is a test file - can be excluded from type checking

### useBackgroundTask.ts (77 errors)
- Fix AsyncResult patterns
- Update task status enums

### ProviderSelectionForm.tsx (51 errors)
- Update manga status values
- Fix form type definitions

## Execution Order

1. **Phase 1**: Remove converters and compatibility layers
2. **Phase 2**: Global enum value updates (find/replace)
3. **Phase 3**: Fix AsyncResult patterns in top 10 files
4. **Phase 4**: Consolidate duplicate types
5. **Phase 5**: Fix remaining errors file by file

## Expected Outcome
- Phase 1-2: Should reduce errors by ~40%
- Phase 3: Should reduce errors by ~30%
- Phase 4-5: Should eliminate remaining ~30%

## Success Criteria
- `pnpm type-check` returns 0 errors
- All imports from `@prisma/client`
- No duplicate type definitions
- All enum values UPPERCASE