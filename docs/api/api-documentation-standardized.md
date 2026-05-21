# Api Documentation Standardized

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Api Documentation Standardized

---
# API Documentation - Unified Guide

> **⚠️ CANONICAL DOCUMENTATION**: This is the authoritative guide for API development in the Mugiwara-Kaizoku project. It consolidates information from multiple conflicting documents.

## Overview

This document provides the unified and authoritative guidance for API development in the Mugiwara-Kaizoku project. It consolidates information from:
- api-client-improvements.md
- api-client-shared-utilities-spec.md  
- api-server-actions.md
- api-type-compatibility.md
- api-utils-fixes-summary.md

## API Architecture

### 1. API Client Hierarchy

```
ApiClient<TResource, TError> (abstract base)
├── DownloadClient (abstract for download services)
│   ├── DelugeClient
│   ├── TransmissionClient
│   └── NzbgetClient
├── MetadataProvider (abstract for metadata services)
│   ├── AniListClient (native implementation)
│   ├── ComicVineClient
│   └── FandomClient
└── IntegrationClient (abstract for integrations)
    └── SuwayomiClient
```

### 2. Method Patterns

All API clients MUST implement the dual-method pattern:

```typescript
// Traditional method (throws on error) - for backward compatibility
async getResource(id: string): Promise<Resource> {
  const result = await this.getResourceAsync(id);
  if (isError(result)) throw result.error;
  return result.data;
}

// AsyncResult method (returns AsyncResult) - for new code
async getResourceAsync(id: string): Promise<AsyncResult<Resource, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Implementation
    return createSuccessResult(resource);
  }, {
    operation: 'getResource',
    service: this.getServiceName(),
    resourceType: 'resource',
    resourceId: id
  });
}
```

## Core Utilities

### 1. HTTP Client

```typescript
// Usage
const http = createHttpClient({
  baseURL: config.baseURL,
  auth: {
    type: 'bearer',
    token: config.apiKey
  },
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  }
});

// Making requests
const result = await http.requestAsync<Data>({
  method: 'GET',
  path: '/resource/123'
});
```

### 2. Rate Limiter

```typescript
const rateLimiter = createRateLimiter({
  strategy: 'sliding',
  requestsPerMinute: 60,
  maxConcurrent: 5
});

// Before making a request
await rateLimiter.acquire();
// Make request
rateLimiter.updateFromResponse(response);
```

### 3. Caching

```typescript
const cache = createCache<ResourceData>({
  enabled: true,
  ttl: 300, // 5 minutes
  namespace: 'api_resources',
  invalidationPatterns: {
    'create': ['list*'],
    'update': ['list*', 'get:*'],
    'delete': ['list*', 'get:*']
  }
});

// Usage
const cached = cache.get(cacheKey);
if (!cached) {
  const data = await fetchData();
  cache.set(cacheKey, data);
}
```

### 4. Error Handling

```typescript
// Create error factory for your service
const errorFactory = createErrorFactory('MyService');

// Create contextual errors
this.createContextualError = createContextualErrorCreator({
  service: 'MyService',
  resourceType: 'resource'
});

// Use enhanced error handling
return withEnhancedErrorHandling(async () => {
  // Operation
}, {
  operation: 'operationName',
  service: 'MyService',
  resourceType: 'resource',
  resourceId: id
});
```

### 5. Authentication

```typescript
const authManager = createAuthManager({
  type: 'bearer',
  token: config.apiKey,
  storage: 'localStorage',
  storageKey: 'service_auth'
});

// Get auth headers
const headers = authManager.getAuthHeaders();

// Handle auth errors
const shouldRetry = await authManager.handleAuthError(error);
```

## API Development Standards

### 1. Type Safety

**✅ CORRECT: Use generic type parameters**
```typescript
export abstract class ApiClient<TResource = unknown, TError extends Error = ApiError> {
  // Implementation
}
```

**❌ INCORRECT: Use any types**
```typescript
export abstract class ApiClient {
  async get(id: any): Promise<any> { }
}
```

### 2. Error Handling

**✅ CORRECT: Use AsyncResult pattern with enhanced errors**
```typescript
async fetchDataAsync(id: string): Promise<AsyncResult<Data, Error>> {
  return withEnhancedErrorHandling(async () => {
    const response = await this.http.get(`/data/${id}`);
    return createSuccessResult(response.data);
  }, {
    operation: 'fetchData',
    service: 'DataService',
    resourceType: 'data',
    resourceId: id
  });
}
```

**❌ INCORRECT: Throw errors without context**
```typescript
async fetchData(id: string): Promise<Data> {
  const response = await fetch(`/data/${id}`);
  if (!response.ok) throw new Error('Failed');
  return response.json();
}
```

### 3. API Response Transformation

**✅ CORRECT: Use type guards and safe conversions**
```typescript
private transformResponse(data: unknown): Resource {
  if (!isValidResourceData(data)) {
    throw this.createContextualError(
      'Invalid response data',
      'transformResponse'
    );
  }
  
  return {
    id: data.id,
    name: data.name ?? 'Unknown',
    status: this.mapStatus(data.status)
  };
}

private isValidResourceData(data: unknown): data is ResourceData {
  return typeof data === 'object' && 
         data !== null &&
         'id' in data &&
         'name' in data;
}
```

**❌ INCORRECT: Direct type assertions**
```typescript
private transformResponse(data: any): Resource {
  return data as Resource;
}
```

### 4. Enum Usage

**✅ CORRECT: Import from domain types**
```typescript
import { MangaStatus } from '@/types/enums';

// Use domain enums
const status = MangaStatus.ONGOING;
```

**❌ INCORRECT: Define duplicate enums**
```typescript
// Don't define your own enums
enum MyMangaStatus {
  ongoing = 'ongoing',
  completed = 'completed'
}
```

## API Routes vs Server Actions

### Important: Separation of Concerns

**Server Actions** (`"use server"` directive):
- Called directly from client components
- Use Next.js-specific features (cookies, redirect)
- Located in `lib/auth/actions.ts`

**API Handlers** (no `"use server"` directive):
- Used by API routes
- Standard request/response patterns
- Located in `lib/auth/api-handlers.ts`

**API Routes**:
- Standard Next.js API routes
- Import API handlers, NOT server actions
- Handle HTTP concerns (status codes, headers)

### Example Pattern

```typescript
// lib/auth/api-handlers.ts
export async function apiCreateUser(data: FormData): Promise<ActionResponse<User>> {
  // Implementation without "use server"
}

// pages/api/auth/create-user.ts
import { apiCreateUser } from '@/lib/auth/api-handlers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const result = await apiCreateUser(formData);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(200).json(result.data);
}
```

## Common Patterns

### 1. Resource Fetching with Caching

```typescript
async getResourceAsync(id: string): Promise<AsyncResult<Resource, Error>> {
  const cacheKey = `resource:${id}`;
  const cached = this.cache.get(cacheKey);
  
  if (cached) {
    return createSuccessResult(cached);
  }
  
  return withEnhancedErrorHandling(async () => {
    await this.rateLimiter.acquire();
    
    const response = await this.http.getAsync<Resource>(`/resources/${id}`);
    if (isError(response)) return response;
    
    const resource = this.transformResource(response.data.data);
    this.cache.set(cacheKey, resource);
    
    return createSuccessResult(resource);
  }, {
    operation: 'getResource',
    service: this.getServiceName(),
    resourceType: 'resource',
    resourceId: id
  });
}
```

### 2. Batch Operations

```typescript
async batchUpdateAsync(updates: Update[]): Promise<AsyncResult<UpdateResult[], Error>> {
  return withEnhancedErrorHandling(async () => {
    const results = await Promise.all(
      updates.map(update => this.updateResourceAsync(update.id, update.data))
    );
    
    const errors = results.filter(isError);
    if (errors.length > 0) {
      throw this.createContextualError(
        `Failed to update ${errors.length} resources`,
        'batchUpdate',
        { 
          failedIds: errors.map(e => e.error.context?.resourceId),
          totalUpdates: updates.length
        }
      );
    }
    
    return createSuccessResult(
      results.filter(isSuccess).map(r => r.data)
    );
  }, {
    operation: 'batchUpdate',
    service: this.getServiceName(),
    details: { count: updates.length }
  });
}
```

### 3. Authenticated Requests

```typescript
private async makeAuthenticatedRequest<T>(
  method: string,
  path: string,
  data?: unknown
): Promise<AsyncResult<T, Error>> {
  const headers = this.authManager.getAuthHeaders();
  
  const result = await this.http.requestAsync<T>({
    method,
    path,
    data,
    headers
  });
  
  if (isError(result) && result.error.code === 'AUTHENTICATION_ERROR') {
    const shouldRetry = await this.authManager.handleAuthError(result.error);
    if (shouldRetry) {
      // Retry with refreshed credentials
      return this.makeAuthenticatedRequest<T>(method, path, data);
    }
  }
  
  return result;
}
```

## Migration Guide

### From Old Patterns to New Standards

1. **Replace any with unknown/generics**
   ```typescript
   // Old
   getData(): Promise<any>
   
   // New
   getData<T = unknown>(): Promise<T>
   ```

2. **Add AsyncResult methods**
   ```typescript
   // Old
   async getData(): Promise<Data> {
     try {
       return await fetch();
     } catch (error) {
       throw error;
     }
   }
   
   // New (keep old for compatibility, add new)
   async getDataAsync(): Promise<AsyncResult<Data, Error>> {
     return withEnhancedErrorHandling(async () => {
       const data = await fetch();
       return createSuccessResult(data);
     }, { operation: 'getData', service: 'Service' });
   }
   ```

3. **Use domain enums**
   ```typescript
   // Old
   enum Status { ACTIVE = 'active' }
   
   // New
   import { Status } from '@/types/enums';
   ```

4. **Add error context**
   ```typescript
   // Old
   throw new Error('Failed');
   
   // New
   throw this.createContextualError('Failed', 'operation', { resourceId });
   ```

## Testing

### Unit Testing API Clients

```typescript
describe('MyApiClient', () => {
  let client: MyApiClient;
  let mockHttp: jest.Mocked<HttpClient>;
  
  beforeEach(() => {
    mockHttp = createMockHttpClient();
    client = new MyApiClient({ http: mockHttp });
  });
  
  it('should handle successful responses', async () => {
    mockHttp.getAsync.mockResolvedValue(
      createSuccessResult({ data: mockData })
    );
    
    const result = await client.getResourceAsync('123');
    
    expect(isSuccess(result)).toBe(true);
    expect(result.data).toEqual(expectedResource);
  });
  
  it('should handle errors with context', async () => {
    mockHttp.getAsync.mockResolvedValue(
      createErrorResult(new Error('Network error'))
    );
    
    const result = await client.getResourceAsync('123');
    
    expect(isError(result)).toBe(true);
    expect(result.error.message).toContain('[MyService]');
    expect(result.error.message).toContain('resource:123');
  });
});
```

## Checklist for API Development

- [ ] Extend appropriate base class (ApiClient, DownloadClient, MetadataProvider)
- [ ] Use generic type parameters for resources and errors
- [ ] Implement both traditional and AsyncResult methods
- [ ] Use withEnhancedErrorHandling for all operations
- [ ] Import enums from domain types, never define duplicates
- [ ] Transform API responses with type guards
- [ ] Implement caching where appropriate
- [ ] Add rate limiting for external APIs
- [ ] Use authentication manager for secure endpoints
- [ ] Write comprehensive tests with error scenarios
- [ ] Document API-specific configuration options
- [ ] Follow the separation between server actions and API handlers

## References

- [AsyncResult Pattern](./async-result-standardization.md)
- [Error Handling Guide](./error-handling-standardized.md)
- [Type System Architecture](./type-system-architecture-standardization.md)
- [Component Patterns](./component-pattern-unified.md)
