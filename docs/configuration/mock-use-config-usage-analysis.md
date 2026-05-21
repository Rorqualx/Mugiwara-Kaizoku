# Mock Use Config Usage Analysis

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Mock Use Config Usage Analysis

---
# Mock useConfig Usage Analysis

## Summary
The mock `useConfig` hook is used in **24 files** across the codebase, affecting:
- Theme and UI settings
- All metadata provider configurations
- All download client configurations
- Notification settings
- File organization settings
- Integration settings
- And more...

## Affected Files and Categories

### 1. Theme/UI Components (3 files)
- `/src/styles/ColorSchemeProvider.tsx` - Line 24, 131
- `/src/components/settings/ThemeEditor.tsx` - Line 31, 225
- `/src/hooks/useCustomTheme.ts` - Line 3, 49

### 2. Settings Components (1 file)
- `/src/components/settings/BackupSettings.tsx` - Line 41, 130

### 3. Metadata Provider Hooks (4 files)
- `/src/hooks/useAnilistConfig.ts` - Line 15, 67
- `/src/hooks/useFandomConfig.ts` - Line 50, 102
- `/src/hooks/useMangadexConfig.ts` - Line 16, 74
- `/src/hooks/useProviderConfig.ts` - Line 59, 150 (generic provider config)

### 4. Download Client Hooks (6 files)
- `/src/hooks/useTransmissionConfig.ts` - Line 9, 53
- `/src/hooks/useDelugeConfig.ts` - Line 9, 55
- `/src/hooks/useNZBGetConfig.ts` - Line 9, 57
- `/src/hooks/useSABnzbdConfig.ts` - Line 9, 55
- `/src/hooks/useDownloadConfig.ts` - Line 9, 59
- `/src/hooks/useDownloadClientConfig.ts` - Line 62, 214

### 5. Other Configuration Hooks (6 files)
- `/src/hooks/useNotificationConfig.ts` - Line 59, 125
- `/src/hooks/useEventConfig.ts` - Line 52, 164
- `/src/hooks/useSuwayomiConfig.ts` - Line 10, 44
- `/src/hooks/useFileOrganizationConfig.ts` - Line 56, 139
- `/src/hooks/useIntegrationConfig.ts` - Line 11, 103

### 6. The Mock Implementation (1 file)
- `/src/hooks/useConfig.ts` - The mock implementation itself

## Impact Analysis

### Critical Issues
1. **No Persistence**: All settings using the mock are lost on page refresh
2. **Toggle Issues**: All toggles that use these hooks will switch off immediately
3. **Configuration Loss**: API keys, URLs, and other critical settings won't save

### Affected Features
- ❌ Theme customization
- ❌ All metadata providers (AniList, MangaDex, Fandom, ComicVine)
- ❌ All download clients (Transmission, Deluge, NZBGet, SABnzbd)
- ❌ Notification settings
- ❌ File organization settings
- ❌ Integration settings (Komga, Kavita, etc.)
- ❌ Suwayomi configuration
- ❌ Event configurations
- ❌ Backup settings

## Migration Strategy

### Option 1: Gradual Migration (Recommended)
1. Create a new `useConfigTRPC` hook that uses actual tRPC endpoints
2. Update hooks one by one, testing each change
3. Remove the mock after all migrations complete

### Option 2: Direct Replacement
1. Update the existing `useConfig` to use tRPC
2. All hooks continue working but with real persistence
3. Risk: May break if data structures don't match

### Option 3: Emergency Fix
1. Keep the mock but add localStorage persistence
2. Quick fix to prevent data loss
3. Migrate to tRPC later

## Recommended Next Steps

1. **DO NOT REMOVE THE MOCK YET** - It would break 24 files
2. Create a replacement that uses tRPC
3. Test with one hook first (e.g., ComicVine which is already done)
4. Create a migration plan for each category
5. Update files systematically
6. Remove mock only after all migrations complete

## Priority Order for Migration

1. **High Priority** (User-facing settings)
   - Metadata providers (affects manga metadata)
   - Download clients (affects downloads)
   - Theme settings (affects UI)

2. **Medium Priority**
   - Notification settings
   - Integration settings
   - File organization

3. **Low Priority**
   - Event configurations
   - Backup settings
   - Suwayomi settings
