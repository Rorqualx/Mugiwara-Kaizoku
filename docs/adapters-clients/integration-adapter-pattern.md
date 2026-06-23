# Integration Adapter Pattern

> ⚠️ **Note**: This document references the standardized adapter pattern.
> For the canonical implementation guide, see [adapter-pattern-comprehensive-guide.md](./adapter-pattern-comprehensive-guide.md)

This document outlines the Integration Adapter Pattern implemented in the Mugiwara-Kaizoku project for managing external API integrations consistently and with proper type safety.

## Overview

The Integration Adapter Pattern provides a standardized interface for interacting with various external metadata providers (AniList, MangaDex, ComicVine, etc.). It ensures consistent error handling, type-safe operations, and a uniform approach to integrations across the application.

> **Important**: The implementation follows the dual-method pattern documented in the [Unified Adapter Pattern Guide](./adapter-pattern-comprehensive-guide.md), which includes:
> - Private AsyncResult methods for internal use
> - Public throwing methods for external API

## Recent Improvements (June 2025)

We've made several significant improvements to the Integration Adapter Pattern:

1. **Standardized Interface**: Redesigned the `IntegrationAdapter<T>` interface for better type safety
2. **Eliminated `any` Types**: Replaced all `any` types with proper interfaces and type constraints
3. **Consistent Return Types**: Ensured all methods return standardized data structures
4. **Enhanced Base Class**: Improved the base adapter class with better error handling and common functionality
5. **Factory Functions**: Added factory functions for simpler adapter creation and better encapsulation

## Key Components

### 1. Base Integration Adapter

The core of the pattern is the `BaseIntegrationAdapter<TConfig>` abstract class that all integrations extend:

```typescript
export abstract class BaseIntegrationAdapter<TConfig extends BaseIntegrationConfig> 
  implements IntegrationAdapter<TConfig> {
  // Common implementation
  // Abstract methods that specific integrations must implement
}
```

### 2. Integration Adapter Interface

The updated `IntegrationAdapter` interface defines the standard methods all integrations must implement:

```typescript
export interface IntegrationAdapter<T extends BaseIntegrationConfig> {
  isEnabled(): boolean;
  search(query: string, options?: SearchOptions): Promise<MangaSearchResult[]>;
  getMangaById(id: string): Promise<IntegrationMangaData>;
  getMangaByTitle(title: string): Promise<IntegrationMangaData>;
  getStatus(): Promise<{ status: 'ok' | 'error'; message?: string }>;
  getSourceInfo(): MetadataSourceInfo;
  updateMangaMetadata?(mangaId: number): Promise<void>;
  updateAllMangaMetadata?(limit?: number): Promise<number>;
  dispose(): void;
}
```

Key improvements:
- Standardized method names and signatures for consistency
- Stronger type constraints using generics
- Standardized return types for better interoperability
- Added resource cleanup with `dispose()` method
- Made implementation-specific methods optional

### 3. Standardized Configuration

All integrations use a configuration that extends the simplified `BaseIntegrationConfig`:

```typescript
export interface BaseIntegrationConfig {
  enabled: boolean;
  name?: string;
  id?: string;
  priority?: number;
  timeout?: number;
}
```

Service-specific configurations extend this base:

```typescript
export interface AnilistAdapterConfig extends BaseIntegrationConfig {
  apiEndpoint?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  rateLimit?: number;
  throttleMs?: number;
}

export interface FandomAdapterConfig extends BaseIntegrationConfig {
  wikiDomain: string;
  defaultWikis?: string[];
  rateLimit?: number | RateLimitConfig;
  apiEndpoint?: string;
  logger?: (message: string, error?: unknown) => void;
}
```

### 4. Uniform Error Handling

The pattern includes standardized error handling with proper type checking, as detailed in the [Unified Adapter Pattern Guide](./adapter-pattern-comprehensive-guide.md):

```typescript
// Base adapter provides error creation method
protected createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause && cause instanceof Error) {
    (error as unknown as { cause: Error }).cause = cause;
  }
  return error;
}

// Example usage in an adapter
try {
  // API call
} catch (error) {
  this.log('Operation failed', error);
  throw this.createError(`Operation failed: ${error instanceof Error ? error.message : String(error)}`, error);
}
```

This approach:
- Preserves error cause chains for better debugging
- Uses type guards to safely handle unknown error types
- Provides consistent error messages across adapters
- Ensures service name is included in error context

## Implementation Details

### How to Implement a New Integration

> **Note**: For complete implementation details, refer to the [Unified Adapter Pattern Guide](./adapter-pattern-comprehensive-guide.md)

1. Create a new file in `src/server/adapters/` named after the integration
2. Define a config interface extending `BaseIntegrationConfig`
3. Create a class extending `BaseIntegrationAdapter<YourConfig>` and implementing `IntegrationAdapter<YourConfig>`
4. Implement all required methods
5. Create a factory function for instantiating the adapter
6. Add the adapter to the appropriate registry

### Example Implementation

For a complete implementation example following the standardized pattern, see the [Unified Adapter Pattern Guide](./adapter-pattern-comprehensive-guide.md).

## Type Safety Benefits

Our updated pattern provides significant type safety improvements:

1. **Consistent Method Signatures**: All adapters implement the same interface with standardized method signatures
2. **Generic Type Parameters**: Proper use of generic type parameters with constraints
3. **Standardized Return Types**: All methods return consistent data structures
4. **Type Guards**: Proper type guards for error handling and data validation
5. **No `any` Types**: Elimination of `any` types in favor of proper interfaces
6. **Type-Safe Transformations**: Type-safe transformations from API-specific to standardized formats
7. **IDE Support**: Better IDE support with proper type inference and autocompletion

## Standardized Data Types

### MangaSearchResult

All adapters return search results in the standardized `MangaSearchResult` format:

```typescript
export interface MangaSearchResult {
  id?: string;
  title: string;
  coverUrl?: string;
  source: string;
  sourceId: string;
  metadata?: Partial<MangaMetadata>;
  url?: string;
}
```

### IntegrationMangaData

When getting manga by ID or title, adapters return data in the standardized `IntegrationMangaData` format:

```typescript
export interface IntegrationMangaData {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  genres?: string[];
  tags?: string[];
  authors?: string[];
  [key: string]: unknown;
}
```

### MangaMetadata

The domain model for manga metadata is defined as:

```typescript
export interface MangaMetadata {
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverUrl?: string;
  coverThumbnail?: string;
  status?: MangaStatus;
  chapters?: number;
  volumes?: number;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  releaseYear?: number;
  publisher?: string;
  language?: string;
  links?: ExternalLink[];
  rating?: number;
  isNsfw?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  lastUpdated?: Date | string;
}
```

## Obtaining adapters: `AdapterFactory`

Adapters are created and cached by the `AdapterFactory` singleton
(`src/server/adapters/AdapterFactory.ts`). There is **no** `IntegrationManager`
adapter facade — the class named `IntegrationManager` (in `src/server/queue/`) is a
queue runner, unrelated to adapter lookup.

```typescript
import { MetadataProvider } from '@prisma/client';
import { AdapterFactory } from '@/server/adapters/AdapterFactory';

const factory = AdapterFactory.getInstance();

// Get an adapter for a provider
const anilist = factory.createByProvider(MetadataProvider.ANILIST);

// Enumerate enabled adapters (e.g. to search across all sources)
const enabled = factory.getEnabledAdapters();
```

## Best Practices

When implementing or using the Integration Adapter Pattern:

1. **Error Handling**: Follow the AsyncResult approach in the [Adapter Pattern Comprehensive Guide](./adapter-pattern-comprehensive-guide.md)
2. **Throttling**: Respect rate limits by using the provided throttling mechanism
3. **Configuration**: Don't hardcode API URLs or keys, use the configuration system
4. **Type Guards**: Implement proper type guards when processing unknown data
5. **Testing**: Mock API responses using the adapter pattern for isolated testing

## Extended Capabilities

The adapter pattern also supports:

1. **Batch Operations**: Process multiple items with proper error boundaries
2. **Retry Logic**: Implement exponential backoff for retrying failed operations
3. **Caching**: Add optional caching within the adapter implementation
4. **Metrics**: Track API calls and performance metrics

## Complete Migration to Domain Types

As of June 2025, we have completed the migration to domain-specific types:

1. **Legacy Adapters Removed**: All legacy adapter implementations have been removed
2. **Compatibility Layers Eliminated**: All compatibility layers and transitional utilities have been removed
3. **Standardized Type System**: The entire codebase now uses a consistent type system based on domain-specific types
4. **Enhanced Type Safety**: The removal of legacy compatibility layers has improved type checking coverage and eliminated runtime type errors

### Migration Benefits

1. **Improved Developer Experience**: Consistent type patterns across the codebase
2. **Better Type Inference**: TypeScript can now correctly infer types without compatibility layers
3. **Reduced Bundle Size**: Removal of compatibility code has reduced bundle size
4. **Enhanced Maintainability**: Simplified code with fewer abstractions and compatibility layers
5. **Improved Performance**: Direct use of domain types eliminates transformation overhead

## Type Safety Enforcement

The project now enforces proper type usage through:

1. **ESLint Rules**: Prevents importing from legacy type files or compatibility layers
2. **Strict TypeScript Configuration**: Enables strict type checking throughout the codebase
3. **Runtime Validation**: Critical data is validated at runtime using type guards and schemas
4. **Comprehensive Test Coverage**: Tests verify type compatibility and proper data flow

## Conclusion

The Integration Adapter Pattern provides a robust framework for managing external API integrations in a type-safe, maintainable way. Our recent improvements have significantly enhanced type safety and consistency across adapters.

### Key Benefits of the Updated Pattern

1. **Improved Type Safety**: Complete elimination of `any` types in favor of proper interfaces
2. **Better Developer Experience**: Consistent interface with standardized method signatures
3. **Reduced Runtime Errors**: Type guards and validation prevent common runtime issues
4. **Simplified Implementation**: Clear interface and base class make adapters easier to implement
5. **Resource Management**: Explicit resource cleanup with dispose() method
6. **Factory Pattern**: Simplified instantiation with factory functions
7. **Enhanced Maintainability**: Standardized error handling and data transformations

### Next Steps

1. **Complete Adapter Migration**: Update all remaining adapters to follow the [Unified Adapter Pattern](./adapter-pattern-comprehensive-guide.md)
2. **Integration Registry**: Create a registry for dynamic adapter discovery and instantiation
3. **Unit Tests**: Add comprehensive tests for all adapters
4. **Documentation**: Add more examples and usage patterns to the documentation

By consistently applying this pattern, we've reduced duplication, improved error handling, and ensured consistent behavior across different data sources. The resulting codebase is more maintainable, robust, and easier to extend with new integrations.