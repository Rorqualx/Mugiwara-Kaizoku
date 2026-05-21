# Tabler Icons Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Tabler Icons Fix

---
# Tabler Icons Fix Summary

## Issue
The build was failing due to missing/renamed icons from `@tabler/icons-react` v3.34.0:
- `IconFolderOpened` - renamed to `IconFolderOpen`
- `IconBrandAnilist` - doesn't exist in the library
- `IconSparkles` - doesn't exist in the library (July 2025)
- `IconBrain` - doesn't exist in the library (July 2025)

## Files Fixed
1. `/src/components/settings/DownloadSettings.tsx`
   - Changed `IconFolderOpened` to `IconFolderOpen` (2 occurrences)

2. `/src/components/settings/FileOrganizationSettings.tsx`
   - Changed `IconFolderOpened` to `IconFolderOpen` (2 occurrences)

3. `/src/pages/manga/[id].tsx`
   - Commented out `IconBrandAnilist` import as it doesn't exist

4. `/src/pages/system/updates.tsx` (July 2025)
   - Changed `IconSparkles` to `IconStar` (3 occurrences)
   - Changed `IconBrain` to `IconCpu` (1 occurrence)

## Solution Applied
- Used the correct icon names for the current version of @tabler/icons-react
- For missing icons like `IconBrandAnilist`, the import was commented out
- For non-existent icons, replaced with semantically appropriate alternatives:
  - `IconSparkles` → `IconStar` (commonly used for featured content)
  - `IconBrain` → `IconCpu` (represents computing/AI processing)
- If these icons are actually used in components, they should be replaced with appropriate alternatives

## Next Steps
Run `pnpm build:clean` to complete the build.

## Date
Fixed on: January 2025, Updated July 2025
