# Configuration System

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Configuration System

---
# Configuration Management System

## Overview

The Configuration Management System is a centralized approach to managing application settings in Mugiwara-Kaizoku. It replaces direct database access with a type-safe, structured API for reading and writing configuration values.

## Key Features

- **Centralized Configuration**: All application settings managed through a single system
- **Type Safety**: TypeScript interfaces for all configuration objects
- **Scoped Settings**: Settings organized by scope (SYSTEM, USER, INTEGRATION)
- **Domain-Specific Services**: Specialized configuration services for each application domain
- **Default Values**: Sensible defaults for all configuration options
- **Migration System**: Tools for migrating from legacy settings to the new system

## Architecture

The configuration system consists of the following components:

### Core Configuration Service

The `ConfigService` is the foundation of the system, providing low-level access to configuration values:

```typescript
// Basic usage
const value = await configService.get('key', defaultValue);
await configService.set('key', value, { scope: ConfigScope.SYSTEM });
```

### Domain-Specific Configuration Services

Specialized services provide typed access to specific domains of configuration:

- `GeneralConfigService`: Application-wide settings
- `MetadataConfigService`: Metadata provider settings
- `IntegrationConfigService`: External integration settings
- `ProviderConfigService`: Search provider settings
- `SuwayomiConfigService`: Suwayomi manga server settings
- `EventConfigService`: Event logging settings
- `DownloadClientConfigService`: Download client settings

### Global Configuration Access

The `globalConfigService` provides a convenient way to access all configuration services:

```typescript
// Get all configuration services
const { 
  config,    // Core ConfigService
  general,   // GeneralConfigService
  metadata,  // MetadataConfigService
  integration // IntegrationConfigService
} = getAllConfigServices();

// Use domain-specific methods
const theme = await general.getTheme();
const isProviderEnabled = await metadata.isProviderEnabled('anilist');
```

## Configuration Structure

Settings are organized hierarchically with dot notation:

- `general.theme`: Application theme
- `general.fileOrganization.folderStructure`: File organization structure
- `metadata.enrichOnImport`: Metadata enrichment setting
- `integration.komga.enabled`: Komga integration toggle

## Migration System

Legacy settings are migrated to the new system using migration scripts:

1. `allMigrations.ts`: Orchestrates all migrations
2. Domain-specific migrations:
   - `generalMigration.ts`
   - `metadataMigration.ts`
   - `integrationMigration.ts`
   - etc.

## Development Guidelines

### Using Configuration in Services

When creating or updating a service that needs configuration:

1. Accept a `ConfigService` parameter in the constructor or initialization method
2. Use the appropriate domain-specific configuration service
3. Provide sensible defaults for all configuration values

Example:

```typescript
class MyService {
  private configService: MyDomainConfigService;
  
  constructor(configService?: ConfigService) {
    if (configService) {
      this.configService = getMyDomainConfigService(configService);
    }
  }
  
  async initialize(configService?: ConfigService) {
    if (configService && !this.configService) {
      this.configService = getMyDomainConfigService(configService);
    }
    
    // Use configuration
    const settings = await this.configService.getSettings();
    // ...
  }
}
```

### Creating a New Configuration Domain

To add a new domain of configuration:

1. Create a configuration interface in a `.ts` file
2. Create a domain-specific configuration service
3. Create a migration script for the domain
4. Add the migration to `allMigrations.ts`
5. Update the `globalConfigService.ts` file to include your new service

### UI Integration

UI components should use React hooks to access configuration:

```typescript
// Example hook for a specific domain
export function useMyDomainSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(['my-domain-settings'], 
    async () => {
      // Fetch settings from the API
      const response = await axios.get('/api/settings/my-domain');
      return response.data;
    }
  );
  
  const mutation = useMutation(
    async (newSettings) => {
      // Update settings via the API
      const response = await axios.post('/api/settings/my-domain', newSettings);
      return response.data;
    },
    {
      onSuccess: () => {
        // Invalidate the cache to trigger a refetch
        queryClient.invalidateQueries(['my-domain-settings']);
      }
    }
  );
  
  return {
    settings: data || defaultSettings,
    isLoading,
    updateSettings: mutation.mutate
  };
}
```

## API Endpoints

Settings are exposed through the tRPC router:

- `settingsV2.get`: Get a configuration value
- `settingsV2.set`: Set a configuration value
- `settingsV2.delete`: Delete a configuration value
- `settingsV2.getScope`: Get all configuration values in a scope

Domain-specific endpoints are also available:

- `metadata.getProviders`: Get all metadata providers
- `integration.getStatus`: Get integration status

## Migration Verification

To verify that all settings have been migrated correctly:

```bash
node scripts/verify-config-migration.js
```

This script compares values in the legacy Settings table with corresponding values in the ConfigValue table and generates a report of matched, mismatched, and missing settings.

## Removing Legacy Settings

Once all settings have been migrated and verified, the legacy Settings table can be removed:

```bash
npx prisma db execute --file ./prisma/migrations/remove_legacy_settings/migration.sql
```

> **WARNING**: Make a database backup before removing the legacy Settings table!