# Comprehensive Metadata Provider Configuration Migration Plan

## Overview
This document outlines the complete migration of all metadata provider configuration hooks from the mock configuration system to actual tRPC endpoints.

## Affected Components
All metadata providers are affected by this issue:
- ✅ **ComicVine** - Migration completed
- ⚠️ **AniList** - Uses mock `useConfig`
- ⚠️ **MangaDex** - Needs investigation
- ⚠️ **Fandom** - Needs investigation

## Root Cause
All provider configuration hooks use the mock `useConfig` hook which:
- Stores data in memory only (not persisted)
- Doesn't sync with the database
- Causes toggles to switch off immediately

## Migration Strategy

### Phase 1: Create Base Hook for All Providers
Create a generic `useMetadataProviderConfig` hook that:
1. Uses tRPC for all operations
2. Works with the normalized metadata structure
3. Can be configured for any provider

### Phase 2: Update Individual Provider Hooks
Update each provider's configuration hook to use the new base:
- `useAnilistConfig`
- `useMangadexConfig` (if exists)
- `useFandomConfig` (if exists)

### Phase 3: Remove Mock Configuration System
1. Delete the mock `useConfig` hook
2. Update any remaining references

## Implementation Plan

### 1. Generic Provider Configuration Hook
```typescript
// useMetadataProviderConfig.ts
export function useMetadataProviderConfig(
  providerId: string,
  defaultConfig: ProviderConfig
): UseProviderConfigResult {
  // Uses tRPC settings.get and settings.set
  // Works with normalized metadata structure
  // Handles all provider settings
}
```

### 2. Provider-Specific Hooks
Each provider hook becomes a thin wrapper:
```typescript
// useAnilistConfig.ts
export function useAnilistConfig() {
  return useMetadataProviderConfig('anilist', defaultAnilistConfig);
}
```

### 3. Data Structure
All providers follow the same structure:
```typescript
{
  providers: {
    [providerId]: {
      enabled: boolean,
      settings: {
        // Provider-specific settings
      }
    }
  }
}
```

## Benefits
1. **Consistency**: All providers use the same system
2. **Persistence**: Settings saved to database
3. **Maintainability**: Single source of truth
4. **Reliability**: No more toggle issues
5. **Code Reuse**: Generic base hook for all providers

## Testing Checklist
- [ ] All provider toggles stay enabled
- [ ] Settings persist across refreshes
- [ ] API credentials save correctly
- [ ] No console errors
- [ ] Loading states work
- [ ] Error notifications display

## Migration Status
- [x] ComicVine - Completed
- [ ] AniList - Pending
- [ ] MangaDex - Pending
- [ ] Fandom - Pending
- [ ] Remove mock useConfig - Pending

## Next Steps
1. Create generic `useMetadataProviderConfig` hook
2. Migrate AniList to use new system
3. Check and migrate remaining providers
4. Remove mock configuration system
5. Update documentation
