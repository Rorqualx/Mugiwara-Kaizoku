# Prisma Enum Import Fix Plan

## Overview
Fix all Prisma enum imports to use `import type` to prevent runtime issues and reduce bundle size.

## Current State
- **268 import violations** found across **251 files**
- These are importing Prisma enums without using `import type`
- This violates TypeScript best practices and can increase bundle size

## Why This Matters

### 1. Bundle Size
Prisma enums are compile-time only constructs. Importing them as runtime values unnecessarily includes them in the JavaScript bundle.

### 2. TypeScript Compliance
When `isolatedModules` is enabled (required for tools like SWC, esbuild), TypeScript requires type-only imports for types/enums.

### 3. Performance
Type imports are completely removed during compilation, resulting in cleaner and faster runtime code.

## Affected Patterns

### Common Violations Found:
```typescript
// ❌ WRONG - Runtime import
import { TaskStatus, TaskType } from '@prisma/client';

// ✅ CORRECT - Type import
import type { TaskStatus, TaskType } from '@prisma/client';
```

### Mixed Imports Need Separation:
```typescript
// ❌ WRONG - Mixed runtime and types
import { Prisma, TaskStatus, Manga } from '@prisma/client';

// ✅ CORRECT - Separated
import { Prisma } from '@prisma/client';
import type { TaskStatus, Manga } from '@prisma/client';
```

## Implementation Steps

### Phase 1: Automated Fix (Immediate)
1. ✅ Created `scripts/fix-prisma-imports.ts` script
2. ⏳ Run script to fix all 268 violations
3. ⏳ Verify TypeScript compilation

### Phase 2: Verification (30 minutes)
1. Run `npx tsc --noEmit` to check for compilation errors
2. Run existing tests to ensure no runtime issues
3. Check bundle size reduction (if measurable)

### Phase 3: Prevention (1 hour)
1. Add ESLint rule to catch future violations
2. Update developer documentation
3. Add pre-commit hook if needed

## Execution Plan

### Step 1: Apply Fixes
```bash
# Apply all fixes
npx tsx scripts/fix-prisma-imports.ts

# Verify compilation
npx tsc --noEmit
```

### Step 2: Test Impact
```bash
# Run tests
npm test

# Check specific affected areas
npm run test:unit -- --testPathPattern="task|status|enum"
```

### Step 3: Add Linting Rule
Add to `.eslintrc.js`:
```javascript
rules: {
  '@typescript-eslint/consistent-type-imports': ['error', {
    prefer: 'type-imports',
    disallowTypeAnnotations: true,
    fixStyle: 'separate-type-imports'
  }]
}
```

## Files Most Affected

### Top Directories:
1. `/src/store/` - 15 files
2. `/src/server/trpc/routers/` - 30+ files
3. `/src/server/services/` - 40+ files
4. `/src/components/` - 50+ files
5. `/src/utils/` - 20+ files

### Critical Files:
- `src/store/taskSlice.ts`
- `src/store/downloadQueueSlice.ts`
- `src/store/useStoreSelectors.ts`
- `src/lib/prisma.ts`
- All tRPC routers

## Risk Assessment

### Low Risk ✅
- Type imports are compile-time only
- No runtime behavior changes
- Automated script handles the conversion
- Easy to revert if needed

### Potential Issues:
1. **Mixed imports** - Some files import both runtime values and types
   - **Mitigation**: Script separates these automatically
2. **Aliased imports** - Some use `as` aliasing
   - **Mitigation**: Script preserves aliases
3. **Test files** - May have different requirements
   - **Mitigation**: Can exclude test files if needed

## Success Metrics

1. **Zero TypeScript errors** after applying fixes
2. **All tests passing** without modifications
3. **Reduced bundle size** (expected ~5-10KB reduction)
4. **No runtime errors** in development or production

## Rollback Plan

If issues arise:
```bash
# Revert all changes
git checkout -- src/

# Or revert specific commit
git revert HEAD
```

## Timeline

- **Immediate (5 min)**: Apply automated fixes
- **30 minutes**: Verification and testing
- **1 hour**: Add prevention measures
- **Total**: ~1.5 hours

## Next Steps

1. Review this plan
2. Create git branch: `fix/prisma-type-imports`
3. Run the fix script
4. Test thoroughly
5. Create PR with changes
6. Update linting rules

## Long-term Benefits

1. **Cleaner builds** - No unnecessary enum code in bundles
2. **Faster compilation** - TypeScript can skip more work
3. **Better IDE performance** - Type checking is faster
4. **Standards compliance** - Follows TypeScript best practices
5. **Future-proof** - Ready for stricter TypeScript configs