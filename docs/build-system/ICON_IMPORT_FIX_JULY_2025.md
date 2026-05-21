# ICON_IMPORT_FIX_JULY_2025

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for ICON_IMPORT_FIX_JULY_2025

---
# Icon Import Fixes - July 2025

## Issue
TypeScript errors due to non-existent icons being imported from @tabler/icons-react:
- `IconSparkles` - Does not exist in the library
- `IconBrain` - Does not exist in the library

## Solution
Replaced with suitable alternatives that exist in the library:
- `IconSparkles` → `IconStar` - Used for highlighting latest updates and special features
- `IconBrain` → `IconCpu` - Used for AI-powered features section (IconRobot also didn't exist)

## Files Modified
- `/src/pages/system/updates.tsx`

## Icon Usage Locations
1. **IconStar** (replacing IconSparkles):
   - Latest Updates tab icon
   - New Features section icon
   - Recommendation Engine feature icon

2. **IconCpu** (replacing IconBrain):
   - AI-Powered Features section icon

## Verification
Run `tsc --noEmit` to verify no more TypeScript errors related to these icons.

## Note
This follows the pattern established in CLAUDE.md where other renamed/missing icons were documented:
- `IconFolderOpened` → `IconFolderOpen`
- `IconBrandAnilist` → Commented out (doesn't exist)

## Icon Selection Rationale
- `IconStar` - Commonly used to highlight featured or new content
- `IconCpu` - Represents computing/processing power, appropriate for AI features
