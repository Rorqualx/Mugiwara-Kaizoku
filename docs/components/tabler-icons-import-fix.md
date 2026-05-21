# Tabler Icons Import Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Tabler Icons Import Fix

---
# Tabler Icons Import Fix

## Issue
The build was failing because multiple components were trying to import icons from a non-existent wrapper file:
```
Module not found: Can't resolve '../utils/tabler-icons-wrapper'
```

## Root Cause
Components were using deprecated wrapper imports instead of direct imports from `@tabler/icons-react`.

## Solution Applied

### Manual Fixes
Initially fixed 5 files manually that were causing the build to fail:
1. **src/components/addLibrary.tsx**
2. **src/components/addManga/CardAddMangaButton.tsx**
3. **src/components/addManga/form.tsx**
4. **src/components/addManga/index.tsx**
5. **src/components/addManga/steps/confirmationStep.tsx**

### Automated Fix
Created and ran a script (`scripts/fix-tabler-icons.sh`) that:
- Found and fixed 139 files with tabler-icons-wrapper imports
- Replaced all imports with direct imports from `@tabler/icons-react`
- Removed extra semicolons from import statements

### Example Changes
```typescript
// Before
import { IconCheck } from '../utils/tabler-icons-wrapper';

// After
import { IconCheck } from '@tabler/icons-react';
```

## Project Rules Applied
- ✅ No wrapper files created (per "No Wrappers Approach" rule)
- ✅ Modified original files directly
- ✅ Used standard imports from the actual package
- ✅ Automated the fix to handle all 139 affected files

## Files to Remove
The following files in `src/utils/` related to tabler-icons-wrapper can now be removed:
- `tabler-icons-wrapper.d.ts`
- `tabler-icons-wrapper.js.fallback`
- `tabler-icons-complete.js`
- `tabler-icons-empty.js`
- `tabler-icons-minimal.js`
- `build-tabler-icons.js`

## Next Steps
Run `pnpm build:clean` again - it should now complete successfully without icon import errors.

## Date
Fixed on: $(date)
