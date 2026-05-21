# Icon Import Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Icon Import Fixes

---
# Icon Import Fixes

## Issue
The build was failing due to missing icon imports from `@tabler/icons-react`:
- `IconFolderOpen` - Used in `DownloadSettings.tsx` and `FileOrganizationSettings.tsx`
- `IconBrandAnilist` - Used in `manga/[id].tsx`

## Solution Applied

### IconFolderOpen
- This icon doesn't exist in the current `@tabler/icons-react` package
- Replaced all occurrences with `IconFolder` which serves the same purpose
- Files modified:
  - `src/components/settings/DownloadSettings.tsx`
  - `src/components/settings/FileOrganizationSettings.tsx`

### IconBrandAnilist
- Added the type definition to `src/types/tabler-icons.d.ts`
- Added the import statement to `src/pages/manga/[id].tsx`

## Changes Made
1. Replaced `IconFolderOpen` with `IconFolder` in two component files
2. Added `IconBrandAnilist` to the type definitions
3. Added the missing import for `IconBrandAnilist`

## Result
All icon import errors have been resolved, allowing the build to proceed.

## Date
Fixed on: $(date)
