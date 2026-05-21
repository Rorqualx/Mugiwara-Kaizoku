# Settings Router Cleanup Report

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Settings Router Cleanup Report

---
# Settings Router Cleanup Report

## Date: January 2, 2025

### What Was Cleaned Up

1. **Removed Deprecated Router**:
   - Moved `/src/server/trpc/routers/settings.ts` to `settings.deprecated.backup.ts`
   - This was the old router that used direct Prisma calls with `query`/`update` methods

2. **Updated settingsV2.ts**:
   - Updated to properly re-export from the correct router location
   - Added clear documentation about the re-export

3. **Verified Correct Router Usage**:
   - The app is using `/src/server/trpc/router/settings.ts` (the correct one)
   - This router uses ConfigService pattern with `get`/`set` methods
   - All client code is already using the correct API

### Current State

#### Correct Settings Router (`/router/settings.ts`)
- Uses ConfigService for centralized configuration
- Provides modern `get`/`set` API:
  ```typescript
  trpc.settings.get({ key: 'metadata' })
  trpc.settings.set({ key: 'metadata', value: {...} })
  ```
- Includes sub-routers for:
  - `settings.metadata` - Metadata provider configuration
  - `settings.providers` - Provider list
  - `settings.search` - Search provider settings

#### Deprecated Router (Backed Up)
- Used direct Prisma calls
- Had `query`/`update` methods
- No longer imported or used

### Files That Still Need Updates

Some server-side files are still using direct Prisma updates instead of ConfigService:
- `/src/server/trpc/router/system.ts` - Uses `prisma.settings.update`
- `/src/server/trpc/router.ts` - Uses `prisma.settings.update`
- `/src/server/services/suwayomi/configService.ts` - Uses `prisma.settings.update`

These should be updated to use the ConfigService pattern in the future.

### Impact on useConfig Migration

The useConfig tRPC migration is **not affected** by this cleanup:
- It's already using the correct `settings.get`/`settings.set` endpoints
- These endpoints are provided by the active settings router
- All functionality remains the same

### Next Steps

1. ✅ Consider removing `settingsV2.ts` entirely (it's just a re-export)
2. ⚠️ Update server-side code that uses direct Prisma updates
3. ✅ The client-side code is already using the correct API

### Rollback Instructions

If needed, the deprecated router can be restored:
```bash
mv src/server/trpc/routers/settings.deprecated.backup.ts src/server/trpc/routers/settings.ts
```

But this should not be necessary as nothing is using it.
