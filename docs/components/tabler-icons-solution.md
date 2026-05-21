# Tabler Icons Solution

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Tabler Icons Solution

---
# Tabler Icons Solution

## Overview

This document explains the solution implemented to fix issues with missing Tabler icons in the Mugiwara-Kaizoku project.

## The Problem

The project was encountering TypeScript errors during build due to references to Tabler icons that were:

1. Missing from the installed `@tabler/icons-react` package
2. Using slightly different names than what's available in the latest version
3. Not properly imported or exported in the wrapper file

For example, errors like these were occurring:

```
error TS2305: Module '"../utils/tabler-icons-wrapper"' has no exported member 'IconArrowsSort'.
error TS2724: '"../utils/tabler-icons-wrapper"' has no exported member named 'IconEyeCheck'. Did you mean 'IconCheck'?
```

## The Solution

The solution consists of three parts:

1. **Package Installation**: Installing the latest version of `@tabler/icons-react`
2. **Wrapper File**: Creating a comprehensive wrapper file that includes all needed icons
3. **TypeScript Definitions**: Adding type definitions for both original and alias icons
4. **Automatic Detection**: Creating a script to automatically detect and fix missing icons

### 1. Package Installation

```bash
pnpm add @tabler/icons-react@latest
```

This ensures we have the most recent version of the icons package.

### 2. Wrapper File Implementation

The wrapper file (`src/utils/tabler-icons-wrapper.ts`) now:

1. Re-exports all standard icons from `@tabler/icons-react`
2. Explicitly imports commonly used icons to ensure they're available
3. Creates alias exports for icons that are referenced but don't exist, mapping them to visually similar icons

For example:
```typescript
// Map non-existent icons to similar existing ones
export const IconBooks = IconBook;
export const IconArrowsSort = IconRefresh;
export const IconEyeCheck = IconEye;
```

### 3. TypeScript Type Definitions

A dedicated type definition file (`src/types/tabler-icons.d.ts`) was created to:

1. Declare proper TypeScript types for all Tabler icons
2. Include type definitions for both original and alias icons
3. Ensure TypeScript properly recognizes all icons when imported

### 4. Automatic Detection and Fixing

A new script (`scripts/fix-tabler-icons-auto.sh`) has been created that:

1. Automatically detects missing icons by analyzing TypeScript errors
2. Intelligently maps missing icons to appropriate existing ones
3. Updates both the wrapper file and type definitions
4. Verifies the fixes by running TypeScript checks again

## Scripts

Two scripts are available for fixing Tabler icon issues:

1. **Basic Setup**: `scripts/fix-tabler-icons.sh`
   - Installs the latest Tabler icons package
   - Creates the wrapper file with common icon mappings
   - Sets up proper TypeScript definitions

2. **Automatic Fix**: `scripts/fix-tabler-icons-auto.sh`
   - Automatically detects missing icons from TypeScript errors
   - Adds intelligent mappings for missing icons
   - Updates both files without overwriting existing customizations
   - Verifies the fixes are working

You can run these scripts when you encounter icon-related issues:

```bash
# For initial setup or complete refresh
./scripts/fix-tabler-icons.sh

# For automatic detection and fixing of missing icons
./scripts/fix-tabler-icons-auto.sh
```

## Current Icon Mappings

The following alias mappings have been implemented:

| Missing Icon | Mapped To |
|--------------|-----------|
| IconBooks | IconBook |
| IconBook2 | IconBook |
| IconClockPlay | IconClock |
| IconActivity | IconInfoCircle |
| IconExclamationCircle | IconAlertCircle |
| IconApi | IconCode |
| IconHammer | IconSettings |
| IconFileText | IconFile |
| IconRuler | IconSettings |
| IconCalendarOff | IconCalendar |
| IconAspectRatio | IconLayoutGrid |
| IconBookmarkOff | IconBookmark |
| IconTrophy | IconStar |
| IconLink | IconExternalLink |
| IconTools | IconSettings |
| IconPalette | IconSettings |
| IconTerminal | IconCode |
| IconTerminal2 | IconCode |
| IconBrandDocker | IconContainer |
| IconChevronsDown | IconChevronDown |
| IconChevronsUp | IconChevronUp |
| IconArrowsExchange | IconRefresh |
| IconNetwork | IconWifi |
| IconCpu | IconServer |
| IconSourceCode | IconCode |
| IconArrowsSort | IconRefresh |
| IconTable | IconLayoutList |
| IconEyeCheck | IconEye |
| IconFileCheck | IconFile |
| IconAdjustmentsAlt | IconAdjustments |
| IconFlag | IconExternalLink |
| IconStarHalf | IconStar |
| IconCalendarStats | IconCalendar |
| IconUpload | IconCloudUpload |
| IconExclamationMark | IconAlertCircle |
| IconCrown | IconStar |
| IconPlugConnected | IconWifi |
| IconPlugConnectedX | IconWifiOff |
| IconColorPicker | IconPalette |
| IconWorldWww | IconWorld |
| IconDotsVertical | IconDots |
| IconTestPipe | IconCode |

## Adding New Icons Manually

If you need to use a new icon that isn't included in the current mappings:

1. First, run the automatic fix script to see if it can resolve the issue:
   ```bash
   ./scripts/fix-tabler-icons-auto.sh
   ```

2. If you need to manually add an icon:
   - In `src/utils/tabler-icons-wrapper.ts`, add:
     ```typescript
     export const IconNewName = IconSimilarExisting;
     ```
   - In `src/types/tabler-icons.d.ts`, add:
     ```typescript
     export const IconNewName: TablerIcon;
     ```

3. Run `npm run type-check` to verify your fix works

## Troubleshooting

If you encounter icon-related errors:

1. Run the automatic fix script first:
   ```bash
   ./scripts/fix-tabler-icons-auto.sh
   ```

2. If issues persist:
   - Check if the icon name is correctly spelled
   - Look for the icon in the [Tabler Icons documentation](https://tabler-icons.io/)
   - Verify that all imports are from the wrapper file, not directly from `@tabler/icons-react`
   - Add a suitable alias manually if needed

## Future Maintenance

When upgrading the `@tabler/icons-react` package:

1. Run the automatic fix script to detect and fix any new issues
2. Check for newly available icons that could replace our aliases
3. Update the wrapper file with any new icon mappings
4. Update the TypeScript definitions to include new icons
5. Test the application to ensure all icons render correctly

By maintaining this approach, we ensure consistent icon usage throughout the application while handling missing or renamed icons gracefully.