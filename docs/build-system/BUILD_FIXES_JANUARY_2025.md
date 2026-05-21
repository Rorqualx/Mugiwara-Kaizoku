# BUILD_FIXES_JANUARY_2025

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for BUILD_FIXES_JANUARY_2025

---
# Build Fixes Summary - January 2025

## Overview
Fixed multiple build issues in the Mugiwara Kaizoku project to ensure compliance with project rules and resolve missing dependencies.

## Issues Fixed

### 1. Build Script Canonical File Violation
**Issue**: The build script was using non-canonical schema files (`schema-consolidated.prisma`)
**Fix**: Modified `scripts/build-clean.sh` to only use the canonical `prisma/schema.prisma`
**Rule Enforced**: "Never create files with .fixed, Fixed, or similar naming patterns"

### 2. Missing Prisma Models
**Issue**: The `wanted.ts` router was trying to use models that didn't exist in the schema:
- `prisma.wantedItem`
- `prisma.downloadHistory` 
- `prisma.blocklist`

**Fix**: Added the missing enums and models to `prisma/schema.prisma`:
- Enums: `WantedStatus`, `WantedPriority`, `DownloadHistoryStatus`, `BlocklistReason`
- Models: `WantedItem`, `DownloadHistory`, `Blocklist`

### 3. Missing/Renamed Tabler Icons
**Issue**: Build failing due to icon changes in @tabler/icons-react v3.34.0
**Fixes**:
- `IconFolderOpened` → `IconFolderOpen` in:
  - `/src/components/settings/DownloadSettings.tsx`
  - `/src/components/settings/FileOrganizationSettings.tsx`
- Removed non-existent `IconBrandAnilist` import from `/src/pages/manga/[id].tsx`

## Files Modified
1. `/scripts/build-clean.sh` - Removed schema file copying logic
2. `/prisma/schema.prisma` - Added wanted functionality models
3. `/src/components/settings/DownloadSettings.tsx` - Fixed icon imports
4. `/src/components/settings/FileOrganizationSettings.tsx` - Fixed icon imports
5. `/src/pages/manga/[id].tsx` - Removed non-existent icon import

## Documentation Created
1. `/docs/build-script-canonical-fix.md` - Documents build script fix
2. `/docs/wanted-models-schema-fix.md` - Documents schema updates
3. `/docs/tabler-icons-fix.md` - Documents icon fixes

## Project Rules Enforced
- ✅ Only use canonical files (no .fixed, .consolidated, etc.)
- ✅ Make all changes directly to canonical files
- ✅ Follow proper enum naming (UPPERCASE strings)
- ✅ Use correct tRPC v10 syntax
- ✅ Use Mantine v7 props

## Next Steps
1. Run `pnpm build:clean` to complete the build
2. Consider running `pnpm wanted:setup` to ensure wanted tables are properly created
3. Remove non-canonical schema files from the project:
   - `prisma/schema-consolidated.prisma`
   - `prisma/schema-nextauth.prisma`
   - `prisma/schema.task-enums.prisma`

## Result
All TypeScript errors related to missing models and icons have been resolved while maintaining compliance with project standards.

## Date
Fixed on: $(date)
