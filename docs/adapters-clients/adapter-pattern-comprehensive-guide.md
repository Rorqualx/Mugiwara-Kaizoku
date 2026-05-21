# Adapter Pattern Comprehensive Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Adapter Pattern Comprehensive Guide

---
# Adapter Pattern Comprehensive Guide

## Table of Contents
1. [Overview](#overview)
2. [Pattern Architecture](#pattern-architecture)
3. [Base Classes and Interfaces](#base-classes-and-interfaces)
4. [AsyncResult Integration](#asyncresult-integration)
5. [Enhanced Error Handling](#enhanced-error-handling)
6. [Implementation Guidelines](#implementation-guidelines)
7. [Adapter Types](#adapter-types)
8. [Best Practices](#best-practices)
9. [Common Pitfalls](#common-pitfalls)
10. [Testing Adapters](#testing-adapters)
11. [Example Implementations](#example-implementations)
12. [Migration Guide](#migration-guide)
13. [Conclusion](#conclusion)

## Overview

The Adapter Pattern is a core architectural pattern in the Mugiwara-Kaizoku codebase that standardizes how we interact with external services and APIs. It provides a consistent interface for different external systems, enabling the application to switch between providers without changing the consuming code.

### Key Benefits

- **Standardized Interfaces**: Consistent methods across different providers
- **Type Safety**: Fully typed interfaces with TypeScript
- **Error Handling**: Consistent error handling with AsyncResult pattern
- **Provider Switching**: Easy to switch between providers without changing consumer code
- **Testability**: Adapters can be easily mocked for testing
- **Separation of Concerns**: Clean separation between integration logic and business logic
- **Extensibility**: New providers can be added without changing existing code

## Pattern Architecture

The adapter pattern in Mugiwara-Kaizoku follows a layered architecture:

1. **Client Layer**: HTTP clients for direct API communication
2. **Adapter Layer**: Adapters that transform external data to internal domain models
3. **Consumer Layer**: Application services that use adapters through interfaces

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Application Services (Consumers)                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Uses interfaces
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Adapter Interfaces        │ Interface Implementation         │
│                           │                                  │
│ IntegrationAdapter        │ ComicVineAdapter                 │
│ DownloadClientAdapter     │ AnilistAdapter                   │
│ etc.                      │ FandomAdapter                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Uses clients
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ API Clients                                                 │
│                                                             │
│ ComicVineClient, AnilistClient, FandomClient, etc.          │
└─────────────────────────────────────────────────────────────┘
```

## Base Classes and Interfaces

### BaseIntegrationAdapter

The `BaseIntegrationAdapter` is an abstract class that provides common functionality for all adapters:

```typescript
export abstract class BaseIntegrationAdapter<TConfig extends IntegrationConfig> {
  protected config: TConfig;
  protected createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(config: TConfig) {
    this.config = config;
    
    // Initialize contextual error creator
    this.createError = createContextualErrorCreator({
      service: this.constructor.name
    });
  }
  
  // Common methods for all adapters
  protected validateConfig(): void {
    if (!this.config) {
      throw this.createError(
        'Integration config is missing',
        'validateConfig'
      );
    }
    
    // Implement additional validation in derived classes
  }
  
  // Common utility methods
  protected formatError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      return this.createError(
        `Operation failed: ${error.message}`,
        operation
      );
    }
    
    return this.createError(
      `Operation failed: ${String(error)}`,
      operation
    );
  }
}
```

### IntegrationAdapter Interface

The `IntegrationAdapter` interface defines the contract that all adapters must implement:

```typescript
export interface IntegrationAdapter<TConfig extends IntegrationConfig = IntegrationConfig> {
  // Core methods
  getStatus(): Promise<IntegrationStatus>;
  getCapabilities(): IntegrationCapabilities;
  
  // Metadata methods
  searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]>;
  getMangaDetails(id: string): Promise<MangaEntity>;
  
  // AsyncResult versions (internal use)
  searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>>;
  getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>>;
}
```

### IntegrationConfig Interface

The `IntegrationConfig` interface defines the configuration shape for adapters:

```typescript
export interface IntegrationConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  enabled: boolean;
  // Additional configuration as needed
}
```

## AsyncResult Integration

Adapters use the AsyncResult pattern for internal operations, providing comprehensive error handling and state management:

### Pattern for Async Methods

```typescript
// Internal method using AsyncResult
async searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
  return withEnhancedErrorHandling(async () => {
    // Implementation details...
    return results;
  }, {
    operation: 'searchManga',
    service: this.constructor.name,
    resourceType: 'manga'
  });
}

// Public interface method unwrapping AsyncResult
async searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {
  const result = await this.searchMangaAsync(query, options);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  throw new Error(`Unknown state in searchManga for query "${query}"`);
}
```

## Enhanced Error Handling

Adapters leverage enhanced error handling to provide detailed error information:

### Contextual Error Creator

```typescript
protected createError: ReturnType<typeof createContextualErrorCreator>;

constructor(config: TConfig) {
  // Initialize error creator with adapter context
  this.createError = createContextualErrorCreator({
    service: this.constructor.name,
    resourceType: 'manga'
  });
}
```

### Using withEnhancedErrorHandling

```typescript
async getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!id) {
      throw this.createError('Manga ID is required', 'getMangaDetails');
    }
    
    // Implementation...
    return mangaEntity;
  }, {
    operation: 'getMangaDetails',
    service: this.constructor.name,
    resourceType: 'manga',
    resourceId: id
  });
}
```

## Implementation Guidelines

### Template Method Pattern

The adapter implementation follows the template method pattern, where base classes define the structure and derived classes provide specific implementations:

```typescript
export abstract class BaseDownloadClientAdapter<TConfig extends IntegrationConfig> 
  extends BaseIntegrationAdapter<TConfig>
  implements DownloadClientAdapter<TConfig> {
  
  // Template method defining the structure
  async getDownloadsAsync(): Promise<AsyncResult<DownloadItem[], Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate configuration
      this.validateConfig();
      
      // Call abstract method to be implemented by subclasses
      return await this.fetchDownloads();
    }, {
      operation: 'getDownloads',
      service: this.constructor.name
    });
  }
  
  // Abstract method to be implemented by derived classes
  protected abstract fetchDownloads(): Promise<DownloadItem[]>;
  
  // Public interface method
  async getDownloads(): Promise<DownloadItem[]> {
    const result = await this.getDownloadsAsync();
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error('Unknown state in getDownloads');
  }
}
```

### Factory Method Pattern

Adapters are typically created using factory functions to ensure proper initialization:

```typescript
export function createMangadexAdapter(config: MangadexConfig): MangadexAdapter {
  // Validate config
  if (!config.baseUrl) {
    throw new Error('MangaDex base URL is required');
  }
  
  // Create client
  const client = new MangadexClient(config);
  
  // Create and return adapter
  return new MangadexAdapter(config, client);
}
```

## Adapter Types

The Mugiwara-Kaizoku project uses several types of adapters:

### 1. Metadata Provider Adapters

```typescript
export interface MetadataProviderAdapter<TConfig extends IntegrationConfig = IntegrationConfig> 
  extends IntegrationAdapter<TConfig> {
  
  // Metadata-specific methods
  searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]>;
  getMangaDetails(id: string): Promise<MangaEntity>;
  getChapters(mangaId: string): Promise<ChapterEntity[]>;
  
  // AsyncResult versions
  searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>>;
  getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>>;
  getChaptersAsync(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>>;
}
```

### 2. Download Client Adapters

```typescript
export interface DownloadClientAdapter<TConfig extends IntegrationConfig = IntegrationConfig> 
  extends IntegrationAdapter<TConfig> {
  
  // Download-specific methods
  getDownloads(): Promise<DownloadItem[]>;
  addDownload(downloadInfo: AddDownloadOptions): Promise<string>;
  pauseDownload(id: string): Promise<boolean>;
  resumeDownload(id: string): Promise<boolean>;
  removeDownload(id: string): Promise<boolean>;
  
  // AsyncResult versions
  getDownloadsAsync(): Promise<AsyncResult<DownloadItem[], Error>>;
  addDownloadAsync(downloadInfo: AddDownloadOptions): Promise<AsyncResult<string, Error>>;
  pauseDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>>;
  resumeDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>>;
  removeDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>>;
}
```

### 3. Authentication Adapters

```typescript
export interface AuthenticationAdapter<TConfig extends IntegrationConfig = IntegrationConfig> 
  extends IntegrationAdapter<TConfig> {
  
  // Authentication methods
  login(credentials: Credentials): Promise<UserSession>;
  logout(): Promise<boolean>;
  refreshToken(): Promise<string>;
  
  // AsyncResult versions
  loginAsync(credentials: Credentials): Promise<AsyncResult<UserSession, Error>>;
  logoutAsync(): Promise<AsyncResult<boolean, Error>>;
  refreshTokenAsync(): Promise<AsyncResult<string, Error>>;
}
```

## Best Practices

### 1. Use AsyncResult for Internal Methods

```typescript
// Internal method with AsyncResult
async searchMangaAsync(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
  // Implementation with enhanced error handling
}

// Public method without AsyncResult
async searchManga(query: string): Promise<MangaSearchResult[]> {
  const result = await this.searchMangaAsync(query);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  throw new Error('Unknown state');
}
```

### 2. Validate Input Parameters

```typescript
async getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!id) {
      throw this.createError('Manga ID is required', 'getMangaDetails');
    }
    
    // Implementation...
  }, { /* context */ });
}
```

### 3. Use Type Guards for External Data

```typescript
// Type guard for API response
function isValidMangaResponse(data: unknown): data is MangadexMangaResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const response = data as Record<string, unknown>;
  
  return (
    'data' in response &&
    Array.isArray(response.data) &&
    response.data.length > 0 &&
    response.data.every(item => 
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'attributes' in item
    )
  );
}

// Usage
const response = await client.getManga(id);

if (!isValidMangaResponse(response)) {
  throw this.createError(
    'Invalid response format from API',
    'getMangaDetails',
    { id }
  );
}

// Now response is type-safe
```

### 4. Map External Data to Domain Models

```typescript
// Map API-specific format to domain model
const mangaEntity: MangaEntity = {
  id: apiManga.id,
  title: apiManga.attributes.title.en || Object.values(apiManga.attributes.title)[0] || 'Unknown',
  source: 'mangadex',
  sourceId: apiManga.id,
  url: `https://mangadex.org/title/${apiManga.id}`,
  description: apiManga.attributes.description?.en || '',
  coverUrl: this.getCoverUrl(apiManga),
  status: this.mapStatus(apiManga.attributes.status),
  genres: this.extractGenres(apiManga),
  authors: this.extractAuthors(apiManga.relationships),
  updatedAt: new Date(apiManga.attributes.updatedAt)
};
```

### 5. Use Factory Functions for Creation

```typescript
export function createMangadexAdapter(config: MangadexConfig): MangadexAdapter {
  // Validate config
  if (!config.baseUrl) {
    throw new Error('MangaDex base URL is required');
  }
  
  // Create client
  const client = new MangadexClient(config);
  
  // Create and return adapter
  return new MangadexAdapter(config, client);
}
```

### 6. Implement Adapter Registry for Selection

```typescript
export class AdapterRegistry {
  private adapters: Map<string, IntegrationAdapter> = new Map();
  
  registerAdapter(id: string, adapter: IntegrationAdapter): void {
    this.adapters.set(id, adapter);
  }
  
  getAdapter(id: string): IntegrationAdapter | undefined {
    return this.adapters.get(id);
  }
  
  getAdapters(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  // Get adapter by type
  getMetadataAdapter(id: string): MetadataProviderAdapter | undefined {
    const adapter = this.adapters.get(id);
    if (adapter && 'searchManga' in adapter) {
      return adapter as MetadataProviderAdapter;
    }
    return undefined;
  }
  
  getDownloadAdapter(id: string): DownloadClientAdapter | undefined {
    const adapter = this.adapters.get(id);
    if (adapter && 'getDownloads' in adapter) {
      return adapter as DownloadClientAdapter;
    }
    return undefined;
  }
}
```

## Common Pitfalls

### 1. Not Validating External Data

**❌ Incorrect:**
```typescript
// Assumes data structure without validation
const manga = await client.getManga(id);
return {
  id: manga.data.id,
  title: manga.data.attributes.title.en
  // Other properties...
};
```

**✅ Correct:**
```typescript
const response = await client.getManga(id);

// Validate response structure
if (!response || !response.data) {
  throw this.createError('Invalid API response', 'getMangaDetails');
}

// Additional validation of required fields
if (!response.data.id || !response.data.attributes || !response.data.attributes.title) {
  throw this.createError('Missing required fields in API response', 'getMangaDetails');
}

// Now we can safely access properties
return {
  id: response.data.id,
  title: response.data.attributes.title.en || Object.values(response.data.attributes.title)[0] || 'Unknown'
  // Other properties...
};
```

### 2. Exposing Provider-Specific Types

**❌ Incorrect:**
```typescript
// Returns provider-specific type
async getMangaDetails(id: string): Promise<MangadexManga> {
  const manga = await this.client.getManga(id);
  return manga;
}
```

**✅ Correct:**
```typescript
// Maps to domain model
async getMangaDetails(id: string): Promise<MangaEntity> {
  const result = await this.getMangaDetailsAsync(id);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  throw result.error;
}

async getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>> {
  return withEnhancedErrorHandling(async () => {
    const manga = await this.client.getManga(id);
    
    // Map to domain model
    return {
      id: manga.data.id,
      title: this.extractTitle(manga),
      // Other properties mapped to domain model
    };
  }, { /* context */ });
}
```

### 3. Inconsistent Error Handling

**❌ Incorrect:**
```typescript
// Inconsistent error handling
async searchManga(query: string): Promise<MangaSearchResult[]> {
  try {
    const results = await this.client.search(query);
    return results.map(this.mapToSearchResult);
  } catch (error) {
    console.error('Search failed:', error);
    return []; // Silently returns empty array
  }
}
```

**✅ Correct:**
```typescript
// Consistent error handling with AsyncResult
async searchMangaAsync(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
  return withEnhancedErrorHandling(async () => {
    const results = await this.client.search(query);
    return results.map(this.mapToSearchResult);
  }, {
    operation: 'searchManga',
    service: this.constructor.name,
    details: { query }
  });
}

// Public method propagates errors
async searchManga(query: string): Promise<MangaSearchResult[]> {
  const result = await this.searchMangaAsync(query);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  throw result.error;
}
```

### 4. Hard-Coding Dependencies

**❌ Incorrect:**
```typescript
// Hard-coded dependency
class MangadexAdapter implements MetadataProviderAdapter {
  private client = new MangadexClient(); // Hard-coded dependency
  
  // Implementation...
}
```

**✅ Correct:**
```typescript
// Dependency injection
class MangadexAdapter implements MetadataProviderAdapter {
  private client: MangadexClient;
  
  constructor(config: MangadexConfig, client?: MangadexClient) {
    // Use provided client or create a new one
    this.client = client || new MangadexClient(config);
  }
  
  // Implementation...
}
```

### 5. Not Handling Provider-Specific Edge Cases

**❌ Incorrect:**
```typescript
// Assumes all providers work the same way
async getChapters(mangaId: string): Promise<ChapterEntity[]> {
  const response = await this.client.getChapters(mangaId);
  return response.map(this.mapToChapterEntity);
}
```

**✅ Correct:**
```typescript
// Handles provider-specific edge cases
async getChaptersAsync(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>> {
  return withEnhancedErrorHandling(async () => {
    // Handle provider-specific behavior
    if (this.config.id === 'mangadex') {
      // MangaDex requires pagination
      return await this.getChaptersPaginated(mangaId);
    } else if (this.config.id === 'comicvine') {
      // ComicVine needs different parameters
      return await this.getComicVineIssues(mangaId);
    } else {
      // Generic implementation
      const response = await this.client.getChapters(mangaId);
      return response.map(this.mapToChapterEntity);
    }
  }, { /* context */ });
}
```

## Testing Adapters

Adapters should be thoroughly tested to ensure they work correctly:

### 1. Unit Tests with Mocked Clients

```typescript
describe('MangadexAdapter', () => {
  let adapter: MangadexAdapter;
  let mockClient: jest.Mocked<MangadexClient>;
  
  beforeEach(() => {
    // Create mock client
    mockClient = {
      search: jest.fn(),
      getManga: jest.fn(),
      getChapters: jest.fn()
    } as unknown as jest.Mocked<MangadexClient>;
    
    // Create adapter with mock client
    adapter = new MangadexAdapter({
      id: 'mangadex',
      name: 'MangaDex',
      baseUrl: 'https://api.mangadex.org',
      enabled: true
    }, mockClient);
  });
  
  describe('searchManga', () => {
    it('should return manga search results when search is successful', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: '1',
            attributes: {
              title: { en: 'Test Manga' },
              description: { en: 'Test Description' },
              status: 'ongoing'
            },
            relationships: []
          }
        ]
      };
      
      mockClient.search.mockResolvedValue(mockResponse);
      
      // Act
      const result = await adapter.searchManga('test');
      
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('Test Manga');
    });
    
    it('should throw error when search fails', async () => {
      // Arrange
      mockClient.search.mockRejectedValue(new Error('API error'));
      
      // Act & Assert
      await expect(adapter.searchManga('test')).rejects.toThrow('API error');
    });
  });
  
  // More tests...
});
```

### 2. Integration Tests with Real APIs

```typescript
describe('MangadexAdapter Integration Tests', () => {
  let adapter: MangadexAdapter;
  
  beforeEach(() => {
    // Create real adapter (only run in CI with proper credentials)
    adapter = createMangadexAdapter({
      id: 'mangadex',
      name: 'MangaDex',
      baseUrl: 'https://api.mangadex.org',
      enabled: true
    });
  });
  
  // Skip these tests in local development
  const itif = process.env.RUN_INTEGRATION_TESTS ? it : it.skip;
  
  itif('should search for manga with real API', async () => {
    // Act
    const results = await adapter.searchManga('one piece');
    
    // Assert
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain('one piece');
  });
  
  // More integration tests...
});
```

### 3. Mock Adapter Factory for Tests

```typescript
export function createMockAdapter(): MetadataProviderAdapter {
  return {
    getStatus: jest.fn().mockResolvedValue({ status: 'ok' }),
    getCapabilities: jest.fn().mockReturnValue({ 
      canSearch: true,
      canGetDetails: true 
    }),
    searchManga: jest.fn().mockResolvedValue([
      {
        id: '1',
        title: 'Mock Manga',
        source: 'mock',
        sourceId: '1',
        coverUrl: 'https://example.com/cover.jpg'
      }
    ]),
    getMangaDetails: jest.fn().mockResolvedValue({
      id: '1',
      title: 'Mock Manga',
      source: 'mock',
      sourceId: '1',
      coverUrl: 'https://example.com/cover.jpg',
      description: 'Mock description',
      status: 'ongoing',
      genres: ['Action', 'Adventure']
    }),
    // AsyncResult versions
    searchMangaAsync: jest.fn().mockResolvedValue(createSuccessResult([
      {
        id: '1',
        title: 'Mock Manga',
        source: 'mock',
        sourceId: '1',
        coverUrl: 'https://example.com/cover.jpg'
      }
    ])),
    getMangaDetailsAsync: jest.fn().mockResolvedValue(createSuccessResult({
      id: '1',
      title: 'Mock Manga',
      source: 'mock',
      sourceId: '1',
      coverUrl: 'https://example.com/cover.jpg',
      description: 'Mock description',
      status: 'ongoing',
      genres: ['Action', 'Adventure']
    }))
  };
}
```

## Example Implementations

### 1. MangadexAdapter Implementation

```typescript
export class MangadexAdapter extends BaseIntegrationAdapter<MangadexConfig> implements MetadataProviderAdapter<MangadexConfig> {
  private client: MangadexClient;
  
  constructor(config: MangadexConfig, client?: MangadexClient) {
    super(config);
    
    // Use provided client or create a new one
    this.client = client || new MangadexClient(config);
  }
  
  /**
   * Get adapter status
   */
  async getStatus(): Promise<IntegrationStatus> {
    const result = await this.getStatusAsync();
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      return {
        status: 'error',
        message: result.error.message
      };
    }
    
    return { status: 'unknown' };
  }
  
  /**
   * Get adapter status with AsyncResult
   */
  async getStatusAsync(): Promise<AsyncResult<IntegrationStatus, Error>> {
    return withEnhancedErrorHandling(async () => {
      try {
        await this.client.ping();
        return { status: 'ok' };
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }, {
      operation: 'getStatus',
      service: 'MangadexAdapter'
    });
  }
  
  /**
   * Get adapter capabilities
   */
  getCapabilities(): IntegrationCapabilities {
    return {
      canSearch: true,
      canGetDetails: true,
      canGetChapters: true,
      requiresAuthentication: false
    };
  }
  
  /**
   * Search for manga
   */
  async searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {
    const result = await this.searchMangaAsync(query, options);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Unknown state in searchManga for query "${query}"`);
  }
  
  /**
   * Search for manga with AsyncResult
   */
  async searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw this.createError('Search query cannot be empty', 'searchManga');
      }
      
      // Prepare search parameters
      const params: Record<string, string> = {
        title: query,
        limit: String(options?.limit || 20),
        offset: String(options?.offset || 0)
      };
      
      // Make API request
      const response = await this.client.search(params);
      
      // Validate response
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw this.createError(
          'Invalid response format from MangaDex API',
          'searchManga',
          { query }
        );
      }
      
      // Map response to domain model
      return response.data.map(manga => ({
        id: manga.id,
        title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown',
        source: 'mangadex',
        sourceId: manga.id,
        coverUrl: this.getCoverUrl(manga),
        description: manga.attributes.description?.en,
        status: this.mapStatus(manga.attributes.status),
        genres: this.extractGenres(manga)
      }));
    }, {
      operation: 'searchManga',
      service: 'MangadexAdapter',
      resourceType: 'manga',
      details: { query, options }
    });
  }
  
  /**
   * Get manga details
   */
  async getMangaDetails(id: string): Promise<MangaEntity> {
    const result = await this.getMangaDetailsAsync(id);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Unknown state in getMangaDetails for ID "${id}"`);
  }
  
  /**
   * Get manga details with AsyncResult
   */
  async getMangaDetailsAsync(id: string): Promise<AsyncResult<MangaEntity, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!id) {
        throw this.createError('Manga ID is required', 'getMangaDetails');
      }
      
      // Make API request
      const response = await this.client.getManga(id);
      
      // Validate response
      if (!response || !response.data) {
        throw this.createError(
          'Invalid response format from MangaDex API',
          'getMangaDetails',
          { id }
        );
      }
      
      const manga = response.data;
      
      // Map to domain model
      return {
        id: manga.id,
        title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown',
        source: 'mangadex',
        sourceId: manga.id,
        url: `https://mangadex.org/title/${manga.id}`,
        description: manga.attributes.description?.en || '',
        coverUrl: this.getCoverUrl(manga),
        status: this.mapStatus(manga.attributes.status),
        genres: this.extractGenres(manga),
        authors: this.extractAuthors(manga.relationships),
        updatedAt: new Date(manga.attributes.updatedAt)
      };
    }, {
      operation: 'getMangaDetails',
      service: 'MangadexAdapter',
      resourceType: 'manga',
      resourceId: id
    });
  }
  
  /**
   * Get chapters for manga
   */
  async getChapters(mangaId: string): Promise<ChapterEntity[]> {
    const result = await this.getChaptersAsync(mangaId);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Unknown state in getChapters for manga ID "${mangaId}"`);
  }
  
  /**
   * Get chapters for manga with AsyncResult
   */
  async getChaptersAsync(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!mangaId) {
        throw this.createError('Manga ID is required', 'getChapters');
      }
      
      // Get all chapters with pagination
      const chapters = await this.getAllChapters(mangaId);
      
      // Map to domain model
      return chapters.map(chapter => ({
        id: chapter.id,
        mangaId,
        title: this.formatChapterTitle(chapter),
        number: this.parseChapterNumber(chapter),
        volume: chapter.attributes.volume,
        language: chapter.attributes.translatedLanguage,
        source: 'mangadex',
        sourceId: chapter.id,
        url: `https://mangadex.org/chapter/${chapter.id}`,
        pages: chapter.attributes.pages || 0,
        publishedAt: new Date(chapter.attributes.publishAt)
      }));
    }, {
      operation: 'getChapters',
      service: 'MangadexAdapter',
      resourceType: 'chapter',
      resourceId: mangaId
    });
  }
  
  /**
   * Helper method to get all chapters with pagination
   */
  private async getAllChapters(mangaId: string): Promise<MangadexChapter[]> {
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    const allChapters: MangadexChapter[] = [];
    
    while (hasMore) {
      const response = await this.client.getChapters(mangaId, {
        limit,
        offset
      });
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw this.createError(
          'Invalid response format from MangaDex API',
          'getAllChapters',
          { mangaId, offset, limit }
        );
      }
      
      allChapters.push(...response.data);
      
      // Check if we need to fetch more chapters
      if (response.data.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
    
    return allChapters;
  }
  
  /**
   * Helper method to get cover URL
   */
  private getCoverUrl(manga: MangadexManga): string {
    // Find cover art relationship
    const coverArt = manga.relationships?.find(rel => rel.type === 'cover_art');
    
    if (!coverArt || !coverArt.attributes || !coverArt.attributes.fileName) {
      return '';
    }
    
    return `https://uploads.mangadex.org/covers/${manga.id}/${coverArt.attributes.fileName}`;
  }
  
  /**
   * Helper method to map status
   */
  private mapStatus(status: string): string {
    switch (status) {
      case 'ongoing': return 'ongoing';
      case 'completed': return 'completed';
      case 'hiatus': return 'hiatus';
      case 'cancelled': return 'cancelled';
      default: return 'unknown';
    }
  }
  
  /**
   * Helper method to extract genres
   */
  private extractGenres(manga: MangadexManga): string[] {
    if (!manga.attributes.tags || !Array.isArray(manga.attributes.tags)) {
      return [];
    }
    
    return manga.attributes.tags
      .filter(tag => tag.attributes?.group === 'genre')
      .map(tag => tag.attributes.name.en || Object.values(tag.attributes.name)[0] || '')
      .filter(Boolean);
  }
  
  /**
   * Helper method to extract authors
   */
  private extractAuthors(relationships: MangadexRelationship[]): string[] {
    if (!relationships || !Array.isArray(relationships)) {
      return [];
    }
    
    return relationships
      .filter(rel => rel.type === 'author' || rel.type === 'artist')
      .map(rel => rel.attributes?.name || '')
      .filter(Boolean);
  }
  
  /**
   * Helper method to format chapter title
   */
  private formatChapterTitle(chapter: MangadexChapter): string {
    const { title, chapter: chapterNum, volume } = chapter.attributes;
    
    if (title) {
      return title;
    }
    
    let formattedTitle = '';
    
    if (volume) {
      formattedTitle += `Vol. ${volume} `;
    }
    
    if (chapterNum) {
      formattedTitle += `Ch. ${chapterNum}`;
    }
    
    return formattedTitle || 'Untitled';
  }
  
  /**
   * Helper method to parse chapter number
   */
  private parseChapterNumber(chapter: MangadexChapter): number {
    const chapterNum = chapter.attributes.chapter;
    
    if (!chapterNum) {
      return 0;
    }
    
    const parsed = parseFloat(chapterNum);
    return isNaN(parsed) ? 0 : parsed;
  }
}
```

### 2. TransmissionAdapter Implementation

```typescript
export class TransmissionAdapter extends BaseDownloadClientAdapter<TransmissionConfig> {
  private client: TransmissionClient;
  
  constructor(config: TransmissionConfig, client?: TransmissionClient) {
    super(config);
    
    // Use provided client or create a new one
    this.client = client || new TransmissionClient(config);
  }
  
  /**
   * Get download client status
   */
  async getStatusAsync(): Promise<AsyncResult<IntegrationStatus, Error>> {
    return withEnhancedErrorHandling(async () => {
      try {
        await this.client.getSessionStats();
        return { status: 'ok' };
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }, {
      operation: 'getStatus',
      service: 'TransmissionAdapter'
    });
  }
  
  /**
   * Get download client capabilities
   */
  getCapabilities(): IntegrationCapabilities {
    return {
      canGetDownloads: true,
      canAddDownload: true,
      canPauseDownload: true,
      canResumeDownload: true,
      canRemoveDownload: true,
      requiresAuthentication: true
    };
  }
  
  /**
   * Implementation of abstract method to fetch downloads
   */
  protected async fetchDownloads(): Promise<DownloadItem[]> {
    const response = await this.client.getTorrents();
    
    if (!response || !Array.isArray(response.torrents)) {
      throw this.createError(
        'Invalid response format from Transmission API',
        'fetchDownloads'
      );
    }
    
    return response.torrents.map(torrent => ({
      id: torrent.id.toString(),
      name: torrent.name,
      status: this.mapStatus(torrent.status),
      progress: torrent.percentDone * 100,
      size: torrent.totalSize,
      downloadSpeed: torrent.rateDownload,
      uploadSpeed: torrent.rateUpload,
      eta: torrent.eta,
      dateAdded: new Date(torrent.addedDate * 1000)
    }));
  }
  
  /**
   * Add download to client
   */
  async addDownloadAsync(options: AddDownloadOptions): Promise<AsyncResult<string, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!options.url && !options.torrentFile) {
        throw this.createError(
          'Either URL or torrent file is required',
          'addDownload'
        );
      }
      
      // Prepare request parameters
      const args: Record<string, any> = {
        paused: options.paused || false
      };
      
      if (options.url) {
        args.filename = options.url;
      } else if (options.torrentFile) {
        args.metainfo = options.torrentFile;
      }
      
      if (options.downloadPath) {
        args['download-dir'] = options.downloadPath;
      }
      
      // Make API request
      const response = await this.client.addTorrent(args);
      
      if (!response || !response.id) {
        throw this.createError(
          'Failed to add download',
          'addDownload',
          { options }
        );
      }
      
      return response.id.toString();
    }, {
      operation: 'addDownload',
      service: 'TransmissionAdapter',
      resourceType: 'download'
    });
  }
  
  /**
   * Pause download
   */
  async pauseDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!id) {
        throw this.createError('Download ID is required', 'pauseDownload');
      }
      
      // Make API request
      await this.client.stopTorrent([Number(id)]);
      return true;
    }, {
      operation: 'pauseDownload',
      service: 'TransmissionAdapter',
      resourceType: 'download',
      resourceId: id
    });
  }
  
  /**
   * Resume download
   */
  async resumeDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!id) {
        throw this.createError('Download ID is required', 'resumeDownload');
      }
      
      // Make API request
      await this.client.startTorrent([Number(id)]);
      return true;
    }, {
      operation: 'resumeDownload',
      service: 'TransmissionAdapter',
      resourceType: 'download',
      resourceId: id
    });
  }
  
  /**
   * Remove download
   */
  async removeDownloadAsync(id: string): Promise<AsyncResult<boolean, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!id) {
        throw this.createError('Download ID is required', 'removeDownload');
      }
      
      // Make API request
      await this.client.removeTorrent([Number(id)], false);
      return true;
    }, {
      operation: 'removeDownload',
      service: 'TransmissionAdapter',
      resourceType: 'download',
      resourceId: id
    });
  }
  
  /**
   * Helper method to map status
   */
  private mapStatus(status: number): DownloadStatus {
    switch (status) {
      case 0: return 'stopped';
      case 1: return 'queued';
      case 2: return 'checking';
      case 3: return 'downloading';
      case 4: return 'seeding';
      case 5: return 'checking';
      case 6: return 'queued';
      default: return 'unknown';
    }
  }
}
```

## Migration Guide

When migrating existing code to use the Adapter pattern, follow these steps:

### Step 1: Identify Integration Points

Look for places in the codebase where:
- API calls are made directly
- Different providers are used with provider-specific code
- Error handling is inconsistent

### Step 2: Define Interfaces

Define clear interfaces for each type of integration:

```typescript
// Create base interface
export interface IntegrationAdapter<TConfig = any> {
  getStatus(): Promise<IntegrationStatus>;
  getCapabilities(): IntegrationCapabilities;
}

// Create specialized interfaces
export interface MetadataProviderAdapter extends IntegrationAdapter {
  searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]>;
  getMangaDetails(id: string): Promise<MangaEntity>;
  // Other methods...
}

export interface DownloadClientAdapter extends IntegrationAdapter {
  getDownloads(): Promise<DownloadItem[]>;
  addDownload(options: AddDownloadOptions): Promise<string>;
  // Other methods...
}
```

### Step 3: Create Base Classes

Create base classes that implement common functionality:

```typescript
export abstract class BaseIntegrationAdapter<TConfig extends IntegrationConfig> {
  protected config: TConfig;
  protected createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(config: TConfig) {
    this.config = config;
    
    // Initialize contextual error creator
    this.createError = createContextualErrorCreator({
      service: this.constructor.name
    });
  }
  
  // Common methods...
}

export abstract class BaseMetadataProviderAdapter<TConfig extends IntegrationConfig> 
  extends BaseIntegrationAdapter<TConfig>
  implements MetadataProviderAdapter {
  
  // Common implementation for metadata providers...
}
```

### Step 4: Implement Concrete Adapters

Create concrete adapter implementations for each provider:

```typescript
export class MangadexAdapter extends BaseMetadataProviderAdapter<MangadexConfig> {
  private client: MangadexClient;
  
  constructor(config: MangadexConfig, client?: MangadexClient) {
    super(config);
    this.client = client || new MangadexClient(config);
  }
  
  // Implement required methods...
}
```

### Step 5: Create Factory Functions

Create factory functions for each adapter:

```typescript
export function createMangadexAdapter(config: MangadexConfig): MangadexAdapter {
  // Validate config
  if (!config.baseUrl) {
    throw new Error('MangaDex base URL is required');
  }
  
  // Create client
  const client = new MangadexClient(config);
  
  // Create and return adapter
  return new MangadexAdapter(config, client);
}
```

### Step 6: Create Adapter Registry

Create a registry to manage adapters:

```typescript
export class AdapterRegistry {
  private metadataAdapters: Map<string, MetadataProviderAdapter> = new Map();
  private downloadAdapters: Map<string, DownloadClientAdapter> = new Map();
  
  registerMetadataAdapter(id: string, adapter: MetadataProviderAdapter): void {
    this.metadataAdapters.set(id, adapter);
  }
  
  getMetadataAdapter(id: string): MetadataProviderAdapter | undefined {
    return this.metadataAdapters.get(id);
  }
  
  // Other registry methods...
}
```

### Step 7: Update Consumer Code

Update consumer code to use adapters through interfaces:

```typescript
// Before
async function searchManga(query: string): Promise<MangaSearchResult[]> {
  // Provider-specific implementation
  if (provider === 'mangadex') {
    return await searchMangadex(query);
  } else if (provider === 'anilist') {
    return await searchAnilist(query);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// After
async function searchManga(query: string, providerId: string): Promise<MangaSearchResult[]> {
  // Get adapter from registry
  const adapter = adapterRegistry.getMetadataAdapter(providerId);
  
  if (!adapter) {
    throw new Error(`Provider not found: ${providerId}`);
  }
  
  // Use adapter through interface
  return await adapter.searchManga(query);
}
```

### Step 8: Add AsyncResult Versions

Add AsyncResult versions of methods for internal use:

```typescript
// Public interface method
async searchManga(query: string): Promise<MangaSearchResult[]> {
  const result = await this.searchMangaAsync(query);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  throw new Error(`Unknown state in searchManga`);
}

// Internal AsyncResult method
async searchMangaAsync(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
  return withEnhancedErrorHandling(async () => {
    // Implementation...
  }, { /* context */ });
}
```

## Conclusion

The Adapter Pattern is a powerful architectural pattern that provides a consistent interface for different external systems. By implementing adapters with AsyncResult integration and enhanced error handling, we create a robust, type-safe way to interact with external services.

Key advantages of this pattern include:

1. **Standardized Interfaces**: Consistent methods across different providers
2. **Type Safety**: Fully typed interfaces with TypeScript
3. **Error Handling**: Consistent error handling with AsyncResult pattern
4. **Provider Switching**: Easy to switch between providers without changing consumer code
5. **Testability**: Adapters can be easily mocked for testing
6. **Separation of Concerns**: Clean separation between integration logic and business logic
7. **Extensibility**: New providers can be added without changing existing code

By following the guidelines in this document, you can create adapters that are robust, maintainable, and provide a great developer experience.