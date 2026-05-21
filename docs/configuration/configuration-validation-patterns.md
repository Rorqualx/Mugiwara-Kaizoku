# Configuration Validation Patterns

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Configuration Validation Patterns

---
# Configuration Validation Patterns

This document outlines standardized patterns for handling and validating configuration in adapter implementations.

## Overview

Configuration management is a critical aspect of adapter implementation, ensuring that adapters are properly initialized with valid configuration values. The patterns described here provide a consistent approach to configuration validation, defaulting, and management across all adapters.

## Key Components

### 1. Configuration Interfaces

Each adapter should define a strongly typed configuration interface that extends `BaseIntegrationConfig`:

```typescript
export interface AniListAdapterConfig extends BaseIntegrationConfig {
  enabled: boolean;
  apiEndpoint: string;
  accessToken?: string;
  // Additional configuration properties...
}
```

### 2. Default Configuration

Define default configuration values for each adapter:

```typescript
export const DEFAULT_ANILIST_CONFIG: Partial<AniListAdapterConfig> = {
  enabled: true,
  apiEndpoint: 'https://graphql.anilist.co',
  throttleMs: 500
};
```

### 3. Required Fields

Specify which configuration fields are required:

```typescript
export const REQUIRED_ANILIST_CONFIG_FIELDS: (keyof AniListAdapterConfig)[] = [
  'enabled', 
  'apiEndpoint'
];
```

### 4. Configuration Factory

Create a type-safe configuration factory function:

```typescript
export const createAniListAdapterConfig = createConfigFactory<AniListAdapterConfig>(
  DEFAULT_ANILIST_CONFIG,
  REQUIRED_ANILIST_CONFIG_FIELDS
);
```

## Implementation Pattern

### Configuration Validation Utility

The `validateConfig` utility ensures that configuration objects have all required fields:

```typescript
export function validateConfig<T extends BaseIntegrationConfig>(
  config: Partial<T>,
  requiredFields: (keyof T)[],
  defaults: Partial<T>
): T {
  // Merge defaults with provided config
  const mergedConfig = { ...defaults, ...config } as T;
  
  // Check required fields
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (mergedConfig[field] === undefined) {
      missingFields.push(field as string);
    }
  }
  
  // Throw error if required fields are missing
  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
  
  return mergedConfig;
}
```

### Configuration Factory Function

The `createConfigFactory` utility creates a factory function for generating validated configurations:

```typescript
export function createConfigFactory<T extends BaseIntegrationConfig>(
  defaults: Partial<T>,
  requiredFields: (keyof T)[] = []
): (config?: Partial<T>) => T {
  return (config: Partial<T> = {}) => validateConfig<T>(config, requiredFields, defaults);
}
```

## Usage in Adapters

### Constructor

In the adapter constructor, validate the configuration and apply defaults:

```typescript
constructor(config: Partial<AniListAdapterConfig> = {}, prisma?: PrismaClient) {
  // Validate and apply default configuration
  const validatedConfig = createAniListAdapterConfig(config);
  
  // Initialize base adapter with configuration and source name
  super(validatedConfig, 'anilist');
  
  // Initialize other components
  // ...
}
```

### Configure Method

When updating configuration, validate the new configuration:

```typescript
public configure(config: Partial<AniListAdapterConfig>): void {
  // Validate new configuration
  const newConfig = validateConfig<AniListAdapterConfig>(
    { ...this.config, ...config },
    REQUIRED_ANILIST_CONFIG_FIELDS,
    DEFAULT_ANILIST_CONFIG
  );
  
  this.config = newConfig;
  
  // Update other components based on new configuration
  // ...
}
```

## Benefits

This configuration validation pattern provides several benefits:

1. **Type Safety**: Configuration objects are strongly typed
2. **Validation**: Required fields are checked at runtime
3. **Defaults**: Default values are applied for missing optional fields
4. **Consistency**: All adapters use the same validation approach
5. **Documentation**: Configuration requirements are self-documenting

## Best Practices

1. Make all required fields non-optional in the interface
2. Provide sensible defaults for optional fields
3. Document each configuration property with JSDoc comments
4. Use explicit types rather than `any` for configuration objects
5. Validate configuration when initializing and when updating

## Example Implementations

See the following adapters for example implementations:

- `src/api/metadataProviders/adapters/anilistAdapter.fixed.ts`
- `src/api/metadataProviders/adapters/comicvineAdapter.fixed.ts`
- `src/api/metadataProviders/adapters/fandomAdapter.fixed.ts`
- `src/api/metadataProviders/adapters/mangadexAdapter.fixed.ts`