# METADATA_SYSTEM_MIGRATION_PLAN

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for METADATA_SYSTEM_MIGRATION_PLAN

---
# Metadata System Migration Plan

## Overview
This document outlines the plan to deprecate the old metadata storage system (using `settings.metadata` field) and fully migrate to the new ConfigService system.

## Current State

### Old System (To Be Deprecated)
- **Storage**: JSON blob in `settings.metadata` column
- **Format**: Either nested under `providers` key or at root level
- **Access**: Direct database queries or through settings router
- **Issues**: 
  - Monolithic storage
  - Hard to query individual settings
  - Version conflicts between formats

### New System (Target)
- **Storage**: Individual entries in `Config` table
- **Format**: Key-value pairs with namespaced keys
- **Access**: Through ConfigService API
- **Benefits**:
  - Granular control
  - Type safety
  - Easy querying
  - Atomic updates

## Migration Strategy

### Phase 1: Data Migration

1. **Create migration script** to:
   - Read all existing `settings.metadata` entries
   - Parse and validate the JSON
   - Convert to ConfigService entries
   - Store in Config table

2. **Key mapping**:
   ```
   Old: metadata.providers.anilist.enabled
   New: metadataProviders.providers.anilist.enabled
   
   Old: metadata.providers.comicvine.settings.apiKey
   New: metadataProviders.providers.comicvine.settings.apiKey
   ```

### Phase 2: Code Updates

1. **Update all hooks** to use ConfigService:
   - `useComicvineConfig` ✓ (already migrated)
   - `useAnilistConfig`
   - `useMangadexConfig`
   - `useFandomConfig`

2. **Update settings routers**:
   - Remove `metadata` field from settings table
   - Update `settings.ts` router to use ConfigService only
   - Remove migration endpoints

3. **Update UI components**:
   - `MetadataProvidersGrid`
   - `DefaultMetadataProvider`
   - Individual provider settings components

### Phase 3: Cleanup

1. **Remove legacy code**:
   - Old metadata utilities
   - Migration functions
   - Backward compatibility checks

2. **Update system status**:
   - Remove old format checks
   - Use only ConfigService

3. **Database cleanup**:
   - Drop `metadata` column from settings table
   - Add indexes to Config table for performance

## Implementation Steps

### Step 1: Create Migration Script
```typescript
// src/server/migrations/migrateMetadataToConfig.ts
export async function migrateMetadataToConfig() {
  // 1. Read all settings with metadata
  // 2. Parse and validate
  // 3. Convert to Config entries
  // 4. Save to Config table
  // 5. Clear old metadata field
}
```

### Step 2: Update Provider Hooks
```typescript
// Example: useAnilistConfig.ts
export function useAnilistConfig() {
  const { data, isLoading } = trpc.config.getByNamespace.useQuery({
    namespace: 'metadataProviders.providers.anilist'
  });
  
  // ... rest of implementation
}
```

### Step 3: Update Settings Router
```typescript
// Remove metadata handling from settings router
// Use only ConfigService for metadata operations
```

### Step 4: Update UI Components
```typescript
// Update to use new config endpoints
const { data: config } = trpc.config.get.useQuery({
  key: 'metadataProviders.providers.anilist.enabled'
});
```

## Benefits of Migration

1. **Performance**: Individual settings can be queried without loading entire JSON blob
2. **Type Safety**: Each config entry has defined type
3. **Atomicity**: Individual settings can be updated without affecting others
4. **Scalability**: Easy to add new providers and settings
5. **Consistency**: Single source of truth for all configuration

## Rollback Plan

1. Keep backup of settings table before migration
2. Migration script should be idempotent
3. Feature flag to switch between old/new system during transition

## Success Criteria

1. All metadata settings migrated to Config table
2. All UI components using new system
3. No references to `settings.metadata` in codebase
4. System status page working correctly
5. All provider configurations functional

## Timeline

- **Week 1**: Migration script and testing
- **Week 2**: Update hooks and routers
- **Week 3**: Update UI components
- **Week 4**: Cleanup and testing
- **Week 5**: Production deployment

## Next Steps

1. Review and approve migration plan
2. Create migration script
3. Test in development environment
4. Gradual rollout with feature flags
5. Complete migration and cleanup
