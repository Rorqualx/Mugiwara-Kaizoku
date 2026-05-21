# Settings Ui Implementation Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Settings Ui Implementation Guide

---
# Settings UI Implementation Guide

## Overview
This guide provides instructions for completing the remaining Settings UI fixes and maintaining the implemented solutions.

## Completed Implementation ✅

### Phase 1: Critical Navigation & Functionality Issues
1. **Navigation Lock Fix**
   - ErrorBoundary component prevents crashes
   - Proper useEffect cleanup prevents memory leaks
   - Navigation now works correctly from all settings pages

2. **Toggle/Switch Functionality**
   - Configuration hooks provide proper state persistence
   - EnhancedSwitch component provides consistent UI
   - Transmission settings now save correctly

3. **Integrations Page Structure**
   - Proper layout wrapper ensures navigation appears
   - Settings tabs work consistently across all pages

### Phase 3: UI Enhancements
1. **File Naming Template Preview**
   - Real-time preview shows exactly how files will be named
   - Updates dynamically as user types
   - Shows folder structure, file name, and full path

2. **Switch Indicator Consistency**
   - EnhancedSwitch provides visual feedback
   - Status icons and animated indicators
   - Theme-aware colors

## Remaining Tasks 🚧

### Phase 1.2: Complete Toggle/Switch Fixes
Create configuration hooks for remaining download clients:

```typescript
// Create these files following the pattern in useTransmissionConfig.ts:
src/hooks/useDelugeConfig.ts
src/hooks/useSabnzbdConfig.ts
src/hooks/useNzbgetConfig.ts

// Create fixed components following TransmissionSettingsFixed.tsx pattern:
src/components/settings/downloadClients/DelugeSettingsFixed.tsx
src/components/settings/downloadClients/SabnzbdSettingsFixed.tsx
src/components/settings/downloadClients/NzbgetSettingsFixed.tsx
```

### Phase 2.2: Remove Duplicate Configurations
1. Check media-management page for duplicate download client settings
2. Check preferences page for duplicate download client settings
3. Remove any duplicates found
4. Ensure download client settings only appear in download-clients page

### Phase 2.3: Fix Integration Grouping
1. Update integration categorization in integrations page
2. Move Prowlarr to "Indexers" category
3. Move Anilist to "Metadata Providers" category
4. Ensure proper grouping logic

## Key Patterns to Follow

### Configuration Hook Pattern
```typescript
export function use[Feature]Config() {
  const { get, set } = useConfig();
  
  // Load configuration
  const loadConfig = useCallback(async () => {
    const value = await get<Type>('feature.setting');
    // Update state
  }, [get]);
  
  // Update settings
  const updateSetting = useCallback(async (key, value) => {
    await set(`feature.${key}`, value);
    // Show notification
  }, [set]);
  
  return { config, isLoading, updateSetting };
}
```

### Fixed Component Pattern
```typescript
export function [Component]Fixed() {
  const { config, updateSetting } = use[Feature]Config();
  
  return (
    <Box>
      <EnhancedSwitch
        checked={config.enabled}
        onChange={(e) => updateSetting('enabled', e.currentTarget.checked)}
      />
      {/* Other settings */}
    </Box>
  );
}
```

## Testing Checklist
- [ ] All settings pages navigate correctly
- [ ] Toggles/switches persist state after reload
- [ ] File naming preview updates in real-time
- [ ] No duplicate configurations appear
- [ ] Error boundaries prevent crashes
- [ ] All TypeScript checks pass

## Maintenance Guidelines
1. Always use configuration hooks for settings persistence
2. Use EnhancedSwitch for consistent toggle UI
3. Wrap components in ErrorBoundary for stability
4. Test navigation between all settings pages
5. Run type-check before committing changes

## Code Quality Standards
- No .fixed.ts temporary files
- Modify original files directly
- Use relative imports
- Follow established patterns
- Add proper TypeScript types
- Include error handling
