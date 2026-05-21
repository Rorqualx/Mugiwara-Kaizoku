# Tabler Icons Wrapper Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Tabler Icons Wrapper Fix

---
# Tabler Icons Wrapper Fix

## Issue
The build was failing with multiple "Module not found" errors because several components were trying to import icons from a non-existent `tabler-icons-wrapper` file:
- `../../utils/tabler-icons-wrapper`
- `../../utils/tabler-icons-wrapper.js`

## Project Rule Violation
According to CLAUDE.md, the project follows a "No Wrappers Approach":
- When fixing files, always edit the original source files directly
- Do not create wrapper files or temporary implementations
- For dynamic component needs, use proxies and factories within the original files

## Solution Applied
Fixed all imports to use the actual `@tabler/icons-react` package directly instead of the wrapper.

## Files Modified
1. `src/components/events/EventsDashboard.tsx`
2. `src/components/events/SafeEventsDashboard.tsx`
3. `src/components/events/EventNotifications.tsx`
4. `src/components/manga/SyncStatusCard.tsx`
5. `src/components/system/SystemNavigation.tsx`
6. `src/components/wanted/WantedNavigation.tsx`

## Files That Should Be Removed
The following files violate the "No Wrappers Approach" and should be removed:
1. `src/utils/tabler-icons-wrapper.d.ts`
2. `src/utils/tabler-icons-wrapper.js.fallback`
3. `src/utils/tabler-icons-complete.js`
4. `src/utils/tabler-icons-empty.js`
5. `src/utils/tabler-icons-minimal.js`
6. `src/utils/build-tabler-icons.js`

## Changes Made
Replaced all imports from:
```typescript
import { IconName } from '../../utils/tabler-icons-wrapper';
```

To:
```typescript
import { IconName } from '@tabler/icons-react';
```

## Result
All module not found errors related to tabler-icons-wrapper have been resolved, complying with project standards of not using wrapper files.

## Date
Fixed on: $(date)
