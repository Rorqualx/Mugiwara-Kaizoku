# Search Configuration System

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Search Configuration System

---
# Search Configuration System

This document describes the search configuration system in the Mugiwara-Kaizoku application. The system is designed to provide a centralized, type-safe way to manage search provider settings and configuration.

## Overview

The search configuration system is part of the broader configuration management system and follows the same patterns. It provides:

1. **Centralized Configuration**: All search-related settings are managed through a single service.
2. **Type Safety**: Strong TypeScript types for all configuration values.
3. **Default Values**: Sensible defaults for all configuration options.
4. **Migration Support**: Tools to migrate from legacy settings to the new system.
5. **Provider-Specific Settings**: Support for provider-specific settings and configurations.

## Components

### SearchConfigService

The `SearchConfigService` is the main entry point for interacting with search configuration. It provides methods to:

- Load and save configuration
- Get and set default provider
- Check if providers are enabled
- Get Prowlarr-specific configuration

```typescript
// Example usage
const config = await searchConfigService.loadConfig();
const defaultProvider = await searchConfigService.getDefaultProvider();
const isEnabled = await searchConfigService.isProviderEnabled('anilist');
const prowlarrConfig = await searchConfigService.getProwlarrConfig();
```

### SearchConfigMigration

The `SearchConfigMigration` handles migrating search provider settings from the legacy Settings table to the new configuration system. It is run automatically during server initialization.

### Types

The system uses several TypeScript interfaces to ensure type safety:

```typescript
// Provider settings interface
export interface ProviderSettings {
  enabled: boolean;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

// Prowlarr configuration interface
export interface ProwlarrConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

// Search provider configuration interface
export interface SearchProviderConfig {
  // General settings
  defaultProvider: string;
  searchAllByDefault: boolean;
  
  // Provider-specific settings
  providers: Record<string, ProviderSettings>;
  
  // Prowlarr-specific settings
  prowlarrEnabled: boolean;
  prowlarrBaseURL: string;
  prowlarrApiKey: string;
}
```

## TRPC Router

The system provides a TRPC router (`settingsV2.search`) for interacting with search configuration from the frontend. It includes procedures for:

- Listing search providers
- Getting and updating search configuration
- Setting the default provider
- Toggling provider enabled status
- Managing Prowlarr-specific settings

```typescript
// Example usage from client code
const { data } = await trpc.settingsV2.search.getConfig.useQuery();
const { mutate } = trpc.settingsV2.search.setDefaultProvider.useMutation();
mutate({ providerId: 'anilist' });
```

## Usage Patterns

### Adding a New Provider

To add a new search provider to the system:

1. Update the `searchProviders` array in `settingsV2.ts`
2. Add default settings to the `defaultConfig` in `SearchConfigService`
3. Implement the provider in `src/server/services/search/providers/`

### Provider-Specific Settings

Provider-specific settings can be stored in the `providers[providerId].settings` object. For example:

```typescript
// Set ComicVine API key
await searchConfigService.saveConfig({
  providers: {
    comicvine: {
      enabled: true,
      settings: {
        apiKey: 'your-api-key'
      }
    }
  }
});
```

### Prowlarr Integration

Prowlarr has dedicated settings in the configuration system:

```typescript
// Configure Prowlarr
await searchConfigService.saveConfig({
  prowlarrEnabled: true,
  prowlarrBaseURL: 'http://localhost:9696',
  prowlarrApiKey: 'your-api-key'
});
```

## Migration from Legacy Settings

The migration from legacy settings is handled automatically by the `SearchConfigMigration`. It:

1. Extracts provider settings from the metadata JSON field
2. Migrates the default provider setting
3. Migrates provider-specific settings
4. Migrates Prowlarr-specific settings

## Implementation Notes

### Avoiding Direct Database Access

All components that need search configuration should use the `SearchConfigService` instead of directly accessing the database. This includes:

- ProviderRegistry
- BaseSearchProvider
- ProwlarrProvider
- TRPC routers

### Type Safety

The system uses TypeScript interfaces and Zod schemas to ensure type safety:

- `ProviderSettings` interface for provider settings
- `ProwlarrConfig` interface for Prowlarr configuration
- `SearchProviderConfig` interface for the overall configuration
- Zod schemas for TRPC input validation

### Default Values

Default values are provided for all configuration options to ensure the system works even if no configuration has been set:

- Default provider: AniList
- Search all by default: true
- All providers enabled by default (except Prowlarr)
- Empty values for Prowlarr settings