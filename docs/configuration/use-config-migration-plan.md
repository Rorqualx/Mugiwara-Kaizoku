# Use Config Migration Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Config Migration Plan

---
# Comprehensive useConfig Migration Plan

## Executive Summary
The mock `useConfig` hook is causing critical data persistence issues across 24+ files in the application. All configuration data is stored in memory and lost on page refresh, causing toggles to switch off and settings to disappear.

## Migration Strategy

### Phase 1: Infrastructure (COMPLETED ✅)
1. ✅ Created backup of mock implementation (`useConfig.backup.ts`)
2. ✅ Added warning comments to mock implementation
3. ✅ Created tRPC-based replacement (`useConfigTRPC.ts`)
4. ✅ Documented all affected files

### Phase 2: Test & Validate
1. Test the tRPC implementation with one component
2. Verify data persistence works correctly
3. Ensure backward compatibility

### Phase 3: Gradual Migration

#### Option A: Direct Replacement (Recommended)
Replace the mock implementation with tRPC version:
```typescript
// In useConfig.ts
export * from './useConfigTRPC';
```

Benefits:
- All 24 files fixed at once
- No need to update imports
- Immediate data persistence

Risks:
- May reveal data structure mismatches
- Could break if tRPC endpoints fail

#### Option B: File-by-File Migration
Update each hook individually to use tRPC directly:
1. Update metadata provider hooks first (high priority)
2. Then download client hooks
3. Finally UI/theme hooks

Benefits:
- Controlled migration
- Easy to rollback individual changes
- Can fix issues as they arise

Risks:
- Time consuming
- Inconsistent state during migration

### Phase 4: Cleanup
1. Remove mock implementation
2. Delete backup files
3. Update documentation

## Implementation Guide

### For Direct Replacement (Option A)

1. **Update useConfig.ts**:
```typescript
// Replace entire file content with:
export * from './useConfigTRPC';
```

2. **Test Key Features**:
- [ ] ComicVine toggle persists
- [ ] AniList settings save
- [ ] Theme changes persist
- [ ] Download client configs save

3. **Monitor for Issues**:
- Check browser console for errors
- Verify data saves to database
- Test page refresh behavior

### For File-by-File Migration (Option B)

1. **Update Each Hook**:
```typescript
// Replace:
import { useConfig } from './useConfig';

// With:
import { useConfig } from './useConfigTRPC';
```

2. **Migration Order** (by priority):

**Batch 1 - Metadata Providers** (Critical)
- [ ] useAnilistConfig.ts
- [ ] useFandomConfig.ts  
- [ ] useMangadexConfig.ts
- [ ] useProviderConfig.ts

**Batch 2 - Download Clients** (High)
- [ ] useTransmissionConfig.ts
- [ ] useDelugeConfig.ts
- [ ] useNZBGetConfig.ts
- [ ] useSABnzbdConfig.ts
- [ ] useDownloadConfig.ts
- [ ] useDownloadClientConfig.ts

**Batch 3 - Core Settings** (Medium)
- [ ] useNotificationConfig.ts
- [ ] useIntegrationConfig.ts
- [ ] useFileOrganizationConfig.ts
- [ ] BackupSettings.tsx

**Batch 4 - UI/Theme** (Low)
- [ ] ColorSchemeProvider.tsx
- [ ] ThemeEditor.tsx
- [ ] useCustomTheme.ts

**Batch 5 - Other** (Low)
- [ ] useEventConfig.ts
- [ ] useSuwayomiConfig.ts

## Data Structure Mapping

The tRPC implementation uses a key-value store pattern:

### Metadata Providers
```typescript
// Key format: providerId.setting
'anilist.enabled' -> true/false
'anilist.clientId' -> string
'comicvine.apiKey' -> string
```

### Download Clients
```typescript
// Key format: client.setting
'transmission.host' -> string
'transmission.port' -> number
'transmission.enabled' -> boolean
```

### UI/Theme
```typescript
// Key format: theme.setting
'theme.colorScheme' -> 'light' | 'dark'
'theme.primaryColor' -> string
```

## Testing Checklist

### Before Migration
- [ ] Backup database
- [ ] Note current settings
- [ ] Test in development first

### After Migration
- [ ] All toggles stay enabled
- [ ] Settings persist after refresh
- [ ] No console errors
- [ ] Database shows saved values
- [ ] Page navigation works
- [ ] Form submissions work

### Rollback Plan
1. Restore from backup:
   ```bash
   cp src/hooks/useConfig.backup.ts src/hooks/useConfig.ts
   ```
2. Clear browser cache
3. Restart development server

## Known Issues & Solutions

### Issue 1: Key Naming Conflicts
**Problem**: Different hooks might use same keys
**Solution**: Use namespaced keys (e.g., `anilist.enabled` not just `enabled`)

### Issue 2: Type Mismatches
**Problem**: tRPC returns different types than expected
**Solution**: Add type guards and default values

### Issue 3: Performance
**Problem**: Too many tRPC calls
**Solution**: Implement caching in useConfigTRPC

## Success Metrics
- [ ] Zero data loss on refresh
- [ ] All settings persist correctly
- [ ] No performance degradation
- [ ] No new TypeScript errors
- [ ] User experience improved

## Timeline
- Phase 1: ✅ Complete
- Phase 2: 1 day (testing)
- Phase 3: 2-3 days (migration)
- Phase 4: 1 day (cleanup)

Total: ~1 week for complete migration

## Next Steps
1. Choose migration approach (A or B)
2. Test tRPC implementation thoroughly
3. Begin migration based on priority
4. Monitor for issues
5. Document any problems/solutions
