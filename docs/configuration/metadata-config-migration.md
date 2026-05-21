# Metadata Config Migration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Config Migration

---
# Metadata Configuration System Migration

## Overview

This document outlines the migration from the legacy metadata storage system to the new ConfigService-based approach. The goal of this migration is to standardize all application configuration within a single, centralized service.

## Background

Previously, metadata settings were stored in a complex JSON structure within the `settings` table's `metadata` field. This approach had several limitations:

1. **Inconsistent schema**: The metadata structure evolved over time, resulting in different formats being used across the application
2. **Limited type safety**: JSON storage limited type checking and validation
3. **Poor discoverability**: Nested fields were difficult to find and use
4. **No migration path**: Schema changes were difficult to manage
5. **Redundant storage**: Same settings were sometimes stored in multiple locations

## New Architecture

The new ConfigService provides a robust foundation for all application configuration:

- **Centralized configuration**: All settings stored in a dedicated `Config` table
- **Type-safe access**: Proper TypeScript types for all configuration values
- **Hierarchical structure**: Keys organized in a dot-notation hierarchy
- **Metadata support**: Each configuration has associated metadata (description, default value, etc.)
- **Multiple sources**: Configuration can come from database, environment, or file
- **Priority system**: Clear rules for which source takes precedence
- **Caching**: Performance optimization with on-demand refresh

## Migration Process

The migration involves several phases:

1. **Schema preparation**: Ensure the Config table is properly set up in Prisma schema
2. **Migration script**: Create a script to transfer settings from the old to new format
3. **Feature parity**: Implement ConfigService endpoints that match the existing API
4. **Client updates**: Modify React components to use the new ConfigService
5. **Legacy cleanup**: Mark old methods as deprecated and eventually remove them

## Implementation Details

### Configuration Keys

The new structure uses dot-notation hierarchical keys:

- `metadataProviders.defaultProvider`
- `metadataProviders.enableMultiProviderSearch`
- `metadataProviders.providers.anilist.enabled`
- `metadataProviders.providers.anilist.settings.apiKey`

### Value Types

Configuration values have explicit types, including:

- `STRING`
- `NUMBER`
- `BOOLEAN`
- `ARRAY`
- `OBJECT`
- `DATE`
- `JSON`

### React Integration

A new React hook `useConfigService` provides type-safe access to the configuration system:

```typescript
const { getConfig, setConfig, getAllConfig, isLoading, error } = useConfigService();

// Get a single value
const apiKey = await getConfig<string>('metadataProviders.providers.comicvine.settings.apiKey', '');

// Set a value
await setConfig('metadataProviders.providers.comicvine.enabled', true);

// Get all settings for a namespace
const comicvineSettings = await getAllConfig('metadataProviders.providers.comicvine');
```

## Usage Examples

### Accessing Provider Settings

**Old Approach**:
```typescript
const { data: metadataSettings } = trpc.settings.get.useQuery({ key: 'metadata' });
const normalizedMetadata = normalizeMetadataStructure(metadataSettings?.value || {});
const isEnabled = isProviderEnabled(normalizedMetadata, 'comicvine');
const settings = getProviderSettings(normalizedMetadata, 'comicvine');
```

**New Approach**:
```typescript
const { getConfig } = useConfigService();
const enabled = await getConfig<boolean>('metadataProviders.providers.comicvine.enabled', false);
const apiKey = await getConfig<string>('metadataProviders.providers.comicvine.settings.apiKey', '');
```

### Updating Settings

**Old Approach**:
```typescript
const currentMetadata = normalizeMetadataStructure(metadataSettings?.value || {});
const updatedMetadata = updateProviderSettings(
  currentMetadata,
  'comicvine',
  { apiKey: 'new-key' }
);
await updateSettingsMutation.mutateAsync({
  key: 'metadata',
  value: updatedMetadata
});
```

**New Approach**:
```typescript
const { setConfig } = useConfigService();
await setConfig('metadataProviders.providers.comicvine.settings.apiKey', 'new-key');
```

## Migration Plan

1. **Phase 1 - Infrastructure** (Completed)
   - Implement ConfigService
   - Create migration script
   - Add TRPC endpoints

2. **Phase 2 - Client Updates** (In Progress)
   - Create useConfigService hook
   - Update provider configuration hooks to use ConfigService
   - Remove old metadata format checks from system router

3. **Phase 3 - Testing & Validation** (Pending)
   - Verify migration with real data
   - Test client functionality
   - Ensure backward compatibility

4. **Phase 4 - Cleanup** (Pending)
   - Deprecate old metadata access methods
   - Remove duplicate code
   - Update documentation

## Backward Compatibility

During the migration period, both old and new systems will work in parallel. The migration script will:

1. Read metadata from the settings table
2. Convert it to the ConfigService format
3. Save to the Config table
4. Keep the original metadata field intact until migration is complete

## Benefits

This migration provides several key benefits:

1. **Improved developer experience**: Simpler, more intuitive API
2. **Better type safety**: TypeScript types for all configuration values
3. **Enhanced performance**: Proper caching and optimization
4. **Easier maintenance**: Centralized schema definition
5. **Better extensibility**: New configuration options can be added without schema changes
6. **Environment flexibility**: Configuration from multiple sources

## Future Work

After this migration is complete, additional improvements can be made:

1. **UI enhancements**: Better configuration editor experience
2. **Validation rules**: Schema-based validation for configuration values
3. **Default migrations**: Easier updates to default configuration
4. **Multi-tenancy**: Per-user configuration settings
5. **Change tracking**: History of configuration changes