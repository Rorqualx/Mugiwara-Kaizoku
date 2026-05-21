# Test Folder Cleanup Plan

## Analysis Summary

After reviewing the `/src/test` folder, I've identified several areas of duplication and legacy code that need cleanup:

## Issues Found

### 1. **Duplicate Manga Factory Functions**
- **Files affected:**
  - `/src/test/mocks.ts` - has `createMockManga()`
  - `/src/test/utils/factories.ts` - has `createTestManga()`  
  - `/src/test/factories/manga.factory.ts` - has `createManga()`
- **Problem:** Three different functions creating manga test data
- **Recommendation:** Keep only `/src/test/factories/manga.factory.ts` as the canonical factory

### 2. **Duplicate Test Render Functions**
- **Files affected:**
  - `/src/test/utils/testHelpers.tsx` - has `render()` function
  - `/src/test/utils/testUtils.tsx` - has `customRender()` function
- **Problem:** Two competing render utilities with similar functionality
- **Recommendation:** Consolidate into single `testUtils.tsx` with all providers

### 3. **Duplicate Mantine Notification Mocks**
- **Files affected:**
  - `/src/test/mocks/mantineNotifications.js` (CommonJS)
  - `/src/test/mocks/mantineNotifications.ts` (TypeScript)
- **Problem:** Same mock in both JS and TS versions
- **Recommendation:** Keep only TypeScript version, remove JS version

### 4. **Temporary/Backup Files**
- **Files to remove:**
  - `/src/test/factories/manga.factory.ts.tmp`
  - `/src/test/mocks/handlers.ts.tmp`
  - `/src/test/utils/testUtils.tsx.tmp`
- **Problem:** Temporary files left from previous edits
- **Recommendation:** Delete all .tmp files

### 5. **Legacy/Outdated Patterns**
- **Issues found:**
  - No enzyme usage (good - already migrated to React Testing Library)
  - No @testing-library/react-hooks (good - using built-in RTL)
  - Multiple mock implementations for same libraries

## Recommended Actions

### Phase 1: Remove Temporary Files
```bash
rm /src/test/factories/manga.factory.ts.tmp
rm /src/test/mocks/handlers.ts.tmp
rm /src/test/utils/testUtils.tsx.tmp
```

### Phase 2: Consolidate Factory Functions
1. **Update all imports** from `createMockManga` and `createTestManga` to use `createManga` from `/src/test/factories/manga.factory.ts`
2. **Remove duplicate factories** from:
   - `/src/test/mocks.ts` (remove `createMockManga`)
   - `/src/test/utils/factories.ts` (remove entire file if only contains duplicates)

### Phase 3: Consolidate Test Utilities
1. **Merge render functions** into single `/src/test/utils/testUtils.tsx`:
   - Combine providers from both files
   - Keep the more comprehensive implementation
   - Remove `/src/test/utils/testHelpers.tsx` after merging

### Phase 4: Clean Mock Duplicates
1. **Remove CommonJS mocks** that have TypeScript equivalents:
   - Delete `/src/test/mocks/mantineNotifications.js`
   - Keep `/src/test/mocks/mantineNotifications.ts`

### Phase 5: Organize Structure
```
/src/test/
├── factories/          # All data factories (canonical)
│   ├── index.ts       # Re-exports all factories
│   ├── manga.factory.ts
│   ├── chapter.factory.ts
│   └── ...
├── mocks/             # All mock implementations
│   ├── handlers.ts    # MSW handlers
│   ├── server.ts      # MSW server setup
│   └── mantine/       # Group Mantine mocks
│       ├── notifications.ts
│       ├── core.ts
│       └── hooks.ts
├── utils/             # Test utilities
│   ├── testUtils.tsx  # Single render utility with all providers
│   ├── testPatterns.ts # Common test patterns
│   └── setup.ts       # Jest setup
├── setup.ts           # Global test setup
└── README.md          # Documentation

```

## Benefits After Cleanup

1. **Single source of truth** for each test utility
2. **Consistent naming** across test files
3. **Reduced confusion** for developers
4. **Easier maintenance** with clear organization
5. **Better TypeScript support** by removing JS duplicates
6. **Smaller bundle size** for tests

## Migration Guide for Developers

### Before:
```typescript
import { createMockManga } from '@/test/mocks';
import { createTestManga } from '@/test/utils/factories';
import { render } from '@/test/utils/testHelpers';
```

### After:
```typescript
import { createManga } from '@/test/factories';
import { render } from '@/test/utils/testUtils';
```

## Estimated Impact

- **Files to update:** ~20-30 test files with imports
- **Lines to change:** ~100-150 import statements
- **Risk level:** Low (only affects tests, not production code)
- **Time estimate:** 2-3 hours

## Next Steps

1. Review and approve this plan
2. Create backup of current test folder
3. Execute cleanup phases in order
4. Run all tests to ensure nothing breaks
5. Update test documentation