# Comicvine Config Migration Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Comicvine Config Migration Plan

---
# ComicVine Configuration Migration Plan

## Overview
This document outlines the migration from the mock configuration system to the actual tRPC endpoints for ComicVine settings management.

## Problem Statement
The current implementation has a conflict between two configuration systems:
1. `MetadataProviderCard` uses tRPC endpoints (`settings.get/set`)
2. `ComicVineSettings` uses a mock `useConfig` hook that doesn't persist data

This causes the ComicVine toggle to immediately switch off after being enabled.

## Migration Strategy

### Phase 1: Create New Hook (COMPLETED)
✅ Created `useComicvineConfigTRPC.ts` that:
- Uses tRPC `settings.get` and `settings.set` endpoints
- Maintains the same API interface as the original hook
- Properly integrates with the metadata structure
- Handles loading, saving, and error states

### Phase 2: Update Existing Hook (NEXT)
Replace the current `useComicvineConfig.ts` implementation with the tRPC version:

```typescript
// In useComicvineConfig.ts
export * from './useComicvineConfigTRPC';
```

### Phase 3: Testing & Validation
1. Test the ComicVine toggle functionality
2. Verify API key saving works correctly
3. Ensure settings persist across page refreshes
4. Check that rate limit and priority settings work

### Phase 4: Clean Up
1. Remove the old mock implementation
2. Delete `useComicvineConfigTRPC.ts` after migration
3. Update any documentation

## Technical Details

### Data Structure
ComicVine settings are stored within the metadata structure:
```typescript
{
  providers: {
    comicvine: {
      enabled: boolean,
      settings: {
        apiKey: string,
        priority: number,
        rateLimit: number
      }
    }
  }
}
```

### Key Changes
1. **Data Source**: From in-memory mock to database via tRPC
2. **State Management**: From local state to tRPC query cache
3. **Persistence**: Settings now persist across sessions
4. **Error Handling**: Proper error notifications via Mantine

### Benefits
1. **Consistency**: All components use the same data source
2. **Persistence**: Settings are saved to database
3. **Reliability**: No more toggle switching issues
4. **Type Safety**: Full TypeScript support with tRPC

## Implementation Notes

### Hook Usage
The new hook maintains the same interface:
```typescript
const {
  config,      // ComicVine configuration object
  isLoading,   // Loading state from tRPC
  saving,      // Which field is currently saving
  error,       // Error state
  updateSetting,  // Update single setting
  updateConfig,   // Update multiple settings
  refresh      // Refresh configuration
} = useComicvineConfig();
```

### Integration Points
1. **MetadataProviderCard**: No changes needed, continues using tRPC
2. **ComicVineSettings**: No changes needed, uses same hook interface
3. **IntegrationStatusContext**: Already syncs with system status

## Rollback Plan
If issues arise:
1. Rename `useComicvineConfigTRPC.ts` back to original
2. Restore original `useComicvineConfig.ts` from backup
3. Investigate and fix any data inconsistencies

## Success Criteria
- [ ] ComicVine toggle stays enabled after clicking
- [ ] API key saves and persists
- [ ] Settings survive page refresh
- [ ] No console errors
- [ ] Loading states work correctly
- [ ] Error notifications display properly
