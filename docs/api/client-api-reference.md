# API Client Reference

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Complete reference for API clients, HTTP clients, and external integrations.

## Table of Contents

1. [HTTP Client Configuration](#http-client-configuration)
2. [API Endpoints](#api-endpoints)
3. [Authentication](#authentication)
4. [tRPC Client](#trpc-client)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)


---
### Source: comprehensive-client-consolidation-plan.md


- **Multiple Implementations**: Many services have 2-4 different client implementations
- **Inconsistent Patterns**: Different error handling, parameter naming, and resource management
- **Code Duplication**: Significant duplication of core functionality like authentication and request handling
- **Varying Type Safety**: Inconsistent use of TypeScript interfaces and type safety approaches
- **Mixed Architecture**: Combination of direct clients, proxies, and service layers

## Consolidation Goals

1. **Unified Interface**: Consistent API for all integrations
2. **Type Safety**: Comprehensive TypeScript interfaces for all operations
3. **Resource Management**: Proper connection pooling and cleanup
4. **Error Handling**: Standardized error types and handling strategies
5. **Performance**: Optimized connection, caching, and rate limiting
6. **Developer Experience**: Clear patterns for using integrations

## Architecture Overview

The consolidated architecture will follow these core principles:

### 1. Client Structure

All API clients will follow a consistent structure:

```typescript
export class ServiceClient {
  // Configuration and state
  private config: ServiceConfig;
  private connectionStatus: ConnectionStatus;
  private disposed: boolean = false;
  
  // Core HTTP request method
  private async request<T>(
    endpoint: string, 
    options: RequestOptions
  ): Promise<T> {
    // Standard implementation with:
    // - Authentication handling
    // - Error transformation
    // - Rate limiting
    // - Retry logic
    // - Logging
  }
  
  // Service-specific methods
  public async methodOne(): Promise<ResultType> { /*...*/ }
  public async methodTwo(param: ParamType): Promise<ResultType> { /*...*/ }
  
  // Connection management
  public async testConnection(): Promise<boolean> { /*...*/ }
  
  // Resource cleanup
  public dispose(): void { /*...*/ }
}
```

### 2. Factory Functions

```typescript
export function createServiceClient(config?: ServiceConfig): ServiceClient {
  return new ServiceClient(config || {});
}
```

### 3. Configuration Interface

```typescript
export interface ServiceConfig {
  baseURL: string;
  authentication?: AuthConfig;
  timeout?: number;
  retryConfig?: RetryConfig;
  cacheConfig?: CacheConfig;
  rateLimitConfig?: RateLimitConfig;
  notifyOnError?: boolean;
}
```

### 4. Error Types

```typescript
export class ServiceError extends Error {
  constructor(message: string, public code?: number, public context?: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ServiceAuthError extends ServiceError { /*...*/ }
export class ServiceRateLimitError extends ServiceError { /*...*/ }
export class ServiceConnectionError extends ServiceError { /*...*/ }
export class ServiceResourceError extends ServiceError { /*...*/ }
```

## Shared Utilities

To minimize duplication, we'll create shared utilities:

### 1. HTTP Client Factory

```typescript
// src/api/utils/httpClient.ts
export function createHttpClient(config: HttpClientConfig) {
  // Create instance with standard interceptors
  // Handle authentication
  // Configure timeouts
  // Set up logging
  return instance;
}
```

### 2. Rate Limiting

```typescript
// src/api/utils/rateLimit.ts
export class RateLimiter {
  constructor(config: RateLimitConfig) { /*...*/ }
  
  async acquire(): Promise<void> { /*...*/ }
  release(): void { /*...*/ }
}
```

### 3. Caching

```typescript
// src/api/utils/caching.ts
export class Cache<T> {
  constructor(config: CacheConfig) { /*...*/ }
  
  get(key: string): T | undefined { /*...*/ }
  set(key: string, value: T, ttl?: number): void { /*...*/ }
  invalidate(pattern?: string): void { /*...*/ }
}
```

### 4. Error Handling

```typescript
// src/api/utils/errorHandling.ts
export function transformError(error: unknown, context?: any): ServiceError { /*...*/ }
export function createErrorFactory(serviceName: string): ErrorFactory { /*...*/ }
```

### 5. Authentication

```typescript
// src/api/utils/auth.ts
export class AuthManager {
  constructor(config: AuthConfig) { /*...*/ }
  
  getAuthHeaders(): Record<string, string> { /*...*/ }
  handleAuthError(error: unknown): Promise<boolean> { /*...*/ }
  refreshAuth(): Promise<void> { /*...*/ }
}
```

## Detailed Implementation Plan

### Phase 1: Shared Utilities (2 weeks)

1. Create base utility classes for:
   - HTTP client with standard features
   - Rate limiting with different strategies
   - Caching layer with TTL support
   - Error handling and transformation
   - Authentication management

2. Write comprehensive tests for each utility
3. Document usage patterns and examples

### Phase 2: Download Clients (3 weeks)

#### 2.1 Base Download Client Interface

Create a unified `DownloadClientBase` abstract class implementing common functionality:
- Standard error handling
- Request formatting
- Status mapping
- Resource management

#### 2.2 Transmission Client

1. Create new `transmissionClient.ts` using the standard pattern
2. Implement Transmission-specific methods
3. Update all components using the old client
4. Write comprehensive tests
5. Remove old implementations

#### 2.3 Deluge Client

1. Create new `delugeClient.ts` following the same pattern
2. Implement JSON-RPC communication
3. Update all components using the old client
4. Write comprehensive tests
5. Remove old implementations

#### 2.4 Other Download Clients

Apply the same process to SABnzbd and NZBGet clients

### Phase 3: Metadata Providers (4 weeks)

#### 3.1 Base Metadata Provider Interface

Create a unified `MetadataProviderBase` abstract class implementing common functionality:
- Standard error handling
- Rate limiting
- Caching
- Response transformation

#### 3.2 MangaDex Client

1. Create new `mangadexClient.ts` using the standard pattern
2. Implement MangaDex-specific methods
3. Update all components using the old client
4. Write comprehensive tests
5. Remove old implementations

#### 3.3 AniList Client

1. Create new `anilistClient.ts` following the same pattern
2. Implement GraphQL query handling
3. Update all components using the old client
4. Write comprehensive tests
5. Remove old implementations

#### 3.4 Other Metadata Providers

Apply the same process to ComicVine and Fandom clients

### Phase 4: Other Integrations (2 weeks)

Apply the consolidation pattern to other API integrations:
- Suwayomi client
- Any remaining integrations

### Phase 5: Component Updates (2 weeks)

Ensure all components are updated to use the new clients:
- Update UI components
- Update service layers
- Update hooks and context providers

### Phase 6: Cleanup and Documentation (1 week)

1. Remove all deprecated implementations
2. Update documentation
3. Create examples for developers
4. Add integration tests covering the full stack

## Implementation Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 1 | 2 weeks | Shared Utilities |
| 2 | 3 weeks | Download Clients |
| 3 | 4 weeks | Metadata Providers |
| 4 | 2 weeks | Other Integrations |
| 5 | 2 weeks | Component Updates |
| 6 | 1 week | Cleanup and Documentation |
| **Total** | **14 weeks** | |

## Implementation Priorities

To maximize impact while minimizing risk, we'll prioritize implementations:

### High Priority (Weeks 1-5)
- Shared utilities
- Transmission client (most used download client)
- MangaDex client (core metadata provider)

### Medium Priority (Weeks 6-10)
- Deluge client
- AniList client
- Component updates for high priority clients

### Lower Priority (Weeks 11-14)
- Other download clients
- Other metadata providers
- Final component updates
- Cleanup and documentation

## Client-Specific Considerations

### Download Clients

#### Transmission
- Session ID management
- RPC protocol specifics
- Torrent status mapping

#### Deluge
- Complex authentication flow
- JSON-RPC format requirements
- WebSocket consideration for live updates

#### SABnzbd/NZBGet
- Usenet protocol specifics
- Binary handling
- Queue management differences

### Metadata Providers

#### MangaDex
- Comprehensive rate limiting per API docs
- Cover image handling
- Chapter pagination

#### AniList
- GraphQL query handling
- OAuth flow management
- Media-specific transformations

#### ComicVine
- API key management
- Complex query parameters
- Media type differences

#### Fandom
- Web scraping considerations
- HTML parsing
- Caching for performance

## Migration Strategy

To ensure a smooth transition without disrupting existing functionality:

1. **Parallel Implementation**: Create new clients alongside existing ones
2. **Component-by-Component Migration**: Update one component at a time
3. **Comprehensive Testing**: Ensure full test coverage before removing old implementations
4. **Feature Parity**: Verify all functionality is maintained
5. **Performance Verification**: Ensure new implementations meet or exceed performance of old ones

## Success Metrics

We'll measure success by:

1. **Code Reduction**: Measure lines of code reduced by consolidation
2. **Type Coverage**: Ensure 100% type safety in new implementations
3. **Error Reduction**: Track API-related error rates before and after
4. **Performance Improvement**: Measure latency improvements
5. **Developer Feedback**: Survey developers on ease of use

## Conclusion

This comprehensive consolidation plan addresses all API client inconsistencies across the codebase. By implementing standard patterns, shared utilities, and consistent interfaces, we'll significantly improve code maintainability, reduce duplication, and enhance type safety throughout the application.

The phased approach allows us to make incremental improvements while maintaining application functionality, with the highest impact implementations prioritized first.
---
### Source: comicvine-client-error-handling.md

2. **Type-Safe Error Handling**: Implemented proper error type checks and handling.
3. **Standardized Error Recovery**: Enhanced all methods with consistent error recovery.
4. **Input Validation**: Added validation for input parameters with appropriate error types.
5. **Response Validation**: Added validation for API responses to catch malformed data.
6. **Error Context Enrichment**: Added operation-specific context to all errors.

## Implementation Details

### Error Handler Creation

Added a service-specific error handler with proper context information:

```typescript
private errorHandler = createContextualErrorCreator({
  service: "ComicVineClient",
  resourceType: "Manga"
});
```

### Method Implementation Pattern

All methods now follow this pattern:

```typescript
public async methodName(params): Promise<AsyncResult<ReturnType>> {
  return this.errorHandler.withAsyncResultErrorHandling(async () => {
    // Implementation
    // 1. Make API requests
    // 2. Validate responses
    // 3. Process data
    // 4. Return processed results
  }, 'methodName', { ...contextData });
}
```

### Enhanced Error Types

The implementation uses specialized error types for different scenarios:

- **ApiError**: For API communication issues
- **ValidationError**: For invalid input parameters
- **NotFoundError**: For resources that don't exist
- **AppError**: For general application errors

### Response Validation

Added thorough validation of API responses:

```typescript
// Validate the response structure
if (!response.data?.results || !Array.isArray(response.data.results)) {
  throw this.errorHandler.createError(
    'Invalid response format from ComicVine API',
    'methodName',
    { contextData }
  );
}
```

### Error Recovery Strategy

1. **AsyncResult Pattern**: All public methods return `AsyncResult<T, Error>` for uniform error handling.
2. **Type Guards**: Use `isSuccess`, `isError` helpers for type-safe state checking.
3. **Context Preservation**: All errors include context about the operation that failed.

## Benefits

1. **Consistent Error Handling**: All client methods follow the same error handling pattern.
2. **Detailed Error Information**: Errors include operation context for easier debugging.
3. **Type Safety**: Full TypeScript type safety for error handling.
4. **Input Validation**: Proper validation of input parameters with meaningful error messages.
5. **Response Validation**: Proper validation of API responses to prevent runtime errors.

## Example Usage

```typescript
const client = createComicVineClient({ apiKey: 'YOUR_API_KEY' });

// Using with AsyncResult pattern
const mangaResult = await client.getMangaById('123');
if (isSuccess(mangaResult)) {
  // Handle success case
  const manga = mangaResult.data;
  console.log(`Found manga: ${manga.title}`);
} else if (isError(mangaResult)) {
  // Handle error case with rich error information
  console.error(`Error: ${mangaResult.error.message}`);
  // Access error context
  console.error(`Context: ${JSON.stringify(mangaResult.error.context)}`);
}

// Using with try/catch
try {
  const connected = await client.testConnection();
  console.log(`Connected: ${connected}`);
} catch (error) {
  // Enhanced error with context
  if (error instanceof AppError) {
    console.error(`Error: ${error.message}`);
    console.error(`Context: ${JSON.stringify(error.context)}`);
  } else {
    console.error(`Unexpected error: ${error}`);
  }
}
```
---
### Source: http-client-fixes.md


1. **Axios Headers Type Compatibility**
   - Fixed type compatibility issues with AxiosRequestHeaders and AxiosHeaders
   - Updated header handling to use proper AxiosHeaders class instead of plain objects
   - Resolved type errors with header creation and manipulation

2. **Unknown Type Safety**
   - Replaced `any` types with `unknown` for improved type safety
   - Added proper type checking before accessing properties
   - Used generics consistently for better type inference

3. **Response Data Handling**
   - Improved type safety for response header processing
   - Added type guards for handling different response header formats
   - Enhanced null checking and type conversion for response data

4. **Parameter Type Specification**
   - Improved parameter typing in interfaces and method signatures
   - Used more specific types for configuration objects
   - Properly typed callback functions and event handlers

## Specific Changes

### Type Imports

```typescript
// Before
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// After
import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosResponseHeaders,
  ResponseType,
  AxiosHeaders,
  RawAxiosRequestHeaders
} from 'axios';
```

### Proper Headers Handling

```typescript
// Before
requestConfig.headers = {
  ...requestConfig.headers,
  ...authHeaders
};

// After
// Create a new AxiosHeaders instance with existing headers
const headers = new AxiosHeaders(requestConfig.headers);

// Add auth headers
Object.entries(authHeaders).forEach(([key, value]) => {
  headers.set(key, value);
});

// Set the updated headers
requestConfig.headers = headers;
```

### Request Configuration with Proper Types

```typescript
// Before
const requestConfig: AxiosRequestConfig = {
  method: options.method,
  url: options.path,
  params: options.params,
  data: options.data,
  headers: {
    ...this.defaultHeaders,
    ...options.headers
  },
  timeout: options.timeout || this.config.timeout,
  signal,
  responseType: options.responseType as any || this.config.responseType,
  validateStatus: options.validateStatus || this.config.validateStatus
};

// After
// Create headers
const headersObj = { ...this.defaultHeaders, ...options.headers };
const headers = new AxiosHeaders();

// Add all headers to the AxiosHeaders instance
Object.entries(headersObj).forEach(([key, value]) => {
  headers.set(key, value);
});

// Convert to axios request config
const requestConfig: AxiosRequestConfig = {
  method: options.method,
  url: options.path,
  params: options.params,
  data: options.data,
  headers,
  timeout: options.timeout || this.config.timeout,
  signal,
  responseType: options.responseType || this.config.responseType,
  validateStatus: options.validateStatus || this.config.validateStatus
};
```

### Response Headers Processing

```typescript
// Before
headers: response.headers as Record<string, string>,

// After
// Convert headers to Record<string, string>
const responseHeaders: Record<string, string> = {};

// Check if headers is an object and has keys
if (response.headers && typeof response.headers === 'object') {
  // Extract headers from response
  Object.entries(response.headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      responseHeaders[key] = value;
    } else if (Array.isArray(value)) {
      responseHeaders[key] = value.join(', ');
    } else if (value !== null && value !== undefined) {
      responseHeaders[key] = String(value);
    }
  });
}

// Use the processed headers
headers: responseHeaders,
```

### Interface Parameter Types

```typescript
// Before
export interface RequestOptions {
  method: string;
  path: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  validateStatus?: (status: number) => boolean;
  retries?: number;
  auth?: {
    username: string;
    password: string;
  };
}

// After
export interface RequestOptions {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  retries?: number; // Current retry count (for internal use)
  auth?: {
    username: string;
    password: string;
  };
}
```

## Benefits of These Changes

1. **Type Safety**: The code now provides better compile-time checks for HTTP request and response handling.

2. **Proper API Usage**: The fixed code correctly uses the Axios API, ensuring compatibility with the library's expected usage patterns.

3. **Improved Error Handling**: Better type checking ensures that errors are handled appropriately at compile time.

4. **More Robust Headers Management**: The changes properly handle HTTP headers using the correct types and methods.

5. **Better Maintainability**: Explicit types make the code easier to understand and maintain.

## Usage Example

```typescript
// Creating an HTTP client with proper configuration
const httpClient = createHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  }
});

// Making a GET request with proper typing
const response = await httpClient.get<UserData>('/users/123', {
  params: { include: 'profile' },
  headers: { 'X-Custom-Header': 'value' }
});

// Type-safe access to response data
const userData: UserData = response.data;
```

## Conclusion

The TypeScript fixes in the HTTP client module have significantly improved the type safety and robustness of HTTP requests throughout the application. By using proper Axios types, adding proper null checking, and improving header handling, the code is now more reliable and less prone to runtime errors.
---
### Source: client-settings-fixes-updated.md

### 1. Redundant React.ReactElement Return Type Annotations

**Problem**: The original code was using explicit return type annotations `:React.ReactElement` on React.FC components, which is redundant and can cause TypeScript errors.

**Example** (original):
```typescript
export const ClientSettingsForm: React.FC<ClientSettingsFormProps> = ({ 
  onSave, 
  initialConfig 
}): React.ReactElement => {
  // Component implementation
};
```

**Fix**:
```typescript
export const ClientSettingsForm: React.FC<ClientSettingsFormProps> = ({ 
  onSave, 
  initialConfig 
}) => {
  // Component implementation
};
```

**Explanation**: The `React.FC` type already includes the return type, so adding an explicit `:React.ReactElement` return type annotation is redundant and can cause TypeScript errors when the actual JSX element doesn't strictly match the `ReactElement` type.

### 2. Mantine UI Component Prop Name Changes

**Problem**: The code was using outdated prop names for Mantine UI components, particularly using `position` instead of `align` in the `Group` component.

**Example** (original):
```typescript
<Group position="apart" mb="md">
  <Text fw={700} size="xl" c="blue">Transmission Configuration</Text>
  <Switch 
    label={<Text fw={500}>Enabled</Text>}
    checked={transmission.enabled}
    onChange={(event) => handleToggleTransmission(event.currentTarget.checked)}
    size="md"
  />
</Group>
```

**Fix**:
```typescript
<Group align="apart" mb="md">
  <Text fw={700} size="xl" c="blue">Transmission Configuration</Text>
  <Switch 
    label={<Text fw={500}>Enabled</Text>}
    checked={transmission.enabled}
    onChange={(event) => handleToggleTransmission(event.currentTarget.checked)}
    size="md"
  />
</Group>
```

**Explanation**: The Mantine UI library updated its API to use `align` instead of `position` in the Group component. This change ensures compatibility with the current version of the library.

### 3. CSS Class-Based Layout vs. Component Props

**Problem**: Some Group components with `spacing` props were causing TypeScript errors due to API changes or prop type mismatches.

**Example** (original):
```typescript
<Group spacing="md">
  <Button
    variant={preferences.preferredTorrentClient === 'transmission' ? 'filled' : 'outline'}
    onClick={() => handlePreferredTorrentClientChange('transmission')}
    size="sm"
  >
    Transmission
  </Button>
  // Additional buttons...
</Group>
```

**Fix**:
```typescript
<div className="flex space-x-4">
  <Button
    variant={preferences.preferredTorrentClient === 'transmission' ? 'filled' : 'outline'}
    onClick={() => handlePreferredTorrentClientChange('transmission')}
    size="sm"
  >
    Transmission
  </Button>
  // Additional buttons...
</div>
```

**Explanation**: Instead of using the Mantine Group component with a spacing prop that was causing TypeScript errors, the fix uses a div with Tailwind CSS classes to achieve the same layout. This approach is more resilient to API changes in the UI component library.

### 4. Consistent Prop Ordering

**Problem**: Inconsistent ordering of props and potentially missing required props across similar components.

**Example** (original):
```typescript
<PasswordToggle
  label="API Key"
  description="Format: username:password (or :password for no username)"
  placeholder="Your Transmission API key"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  required
  size="md"
/>
```

**Fix**:
```typescript
<PasswordToggle
  label="API Key"
  description="Format: username:password (or :password for no username)"
  placeholder="Your Transmission API key"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  required
  mb="md"
  size="md"
/>
```

**Explanation**: Ensuring consistent prop ordering and including all required props (like `mb="md"`) helps TypeScript correctly validate the component usage and prevents prop-related type errors.

### 5. Import Path Issues

**Problem**: The file used absolute paths with the `@/` prefix, which TypeScript was unable to resolve correctly.

**Example** (original):
```typescript
import { PasswordToggle } from '@/components/common/PasswordToggle';
import { useIntegrationStore } from '@/store/integrationSlice';
import { trpc } from '@/utils/trpcClient';
```

**Fix**:
```typescript
import { PasswordToggle } from '../../../components/common/PasswordToggle';
import { useIntegrationStore } from '../../../store/integrationSlice';
import { trpc } from '../../../utils/trpcClient';
```

**Explanation**: TypeScript was unable to resolve the `@/` path alias correctly in this file. Changing to relative paths ensures that TypeScript can properly find and type-check the imported modules.

## Best Practices for Fixing Similar Errors

1. **Remove redundant type annotations**: When using typed component declarations like `React.FC`, avoid adding redundant return type annotations.

2. **Stay updated with library APIs**: Keep up with changes in UI component libraries and update prop names and usage patterns accordingly.

3. **Consider simpler alternatives**: When component props cause persistent TypeScript errors, consider using simpler HTML elements with CSS classes.

4. **Maintain consistent prop ordering**: Use a consistent order for props across similar components to make the code more maintainable and easier to type-check.

5. **Handle optional properties safely**: Always check for null or undefined values when accessing optional properties to prevent runtime errors.

6. **Use relative import paths**: Use relative import paths to ensure that TypeScript can properly resolve imports.

## Impact of Changes

These fixes have eliminated TypeScript errors in the ClientSettings.tsx file while maintaining the original functionality. The code is now more robust against future changes in the UI component library and provides better type safety.

The patterns identified in these fixes can be applied to other React components throughout the codebase, particularly those using the Mantine UI component library.

## Testing Considerations

When implementing this fix, consider the following testing steps:

1. Verify that all download client settings forms render correctly
2. Test the connection functionality for each client type
3. Verify that client preferences are saved and retrieved correctly
4. Ensure proper error handling and display of error messages
5. Confirm that the auto-select functionality works as expected
6. Test with actual download clients to verify end-to-end functionality

## Next Steps

After implementing these fixes:

1. Update any imports in other files that reference this file to use the new fixed version
2. Consider consolidating client creation logic to reduce code duplication
3. Consider adding more comprehensive type definitions for the client APIs
---
### Source: client-consolidation-type-safety.md


2. **Explicit Interfaces**: Define explicit interfaces for all API responses, configurations, and client methods.

3. **Generic Types**: Use generic types for methods that can work with different data types.

4. **Union Types**: Use union types instead of `any` when a value can be one of several types.

5. **Type Guards**: Use type guards to narrow types in a type-safe way.

6. **Enums**: Use enums for values that have a fixed set of options.

7. **Readonly Properties**: Use readonly for properties that should not be modified.

8. **Type Assertions**: Use type assertions only when necessary and with caution.

9. **Strict Null Checking**: Handle null and undefined values explicitly.

10. **Error Types**: Define specific error types for different error scenarios.

## 2. Interface Improvements

### 2.1 Base Classes

The base classes have been improved with proper TypeScript interfaces:

```typescript
// Before
abstract class DownloadClient {
  abstract addUrl(options: any): Promise<string>;
  abstract getStatus(): Promise<any>;
  // ...
}

// After
interface AddDownloadOptions {
  url: string;
  title?: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high';
  // ...
}

interface DownloadStatus {
  downloadSpeed: number;
  uploadSpeed: number;
  // ...
}

abstract class DownloadClient {
  abstract addUrl(options: AddDownloadOptions): Promise<string>;
  abstract getStatus(): Promise<DownloadStatus>;
  // ...
}
```

### 2.2 Client Configurations

Client configurations now use explicit interfaces:

```typescript
// Before
constructor(config: any) {
  this.baseURL = config.baseURL || 'https://default.url';
  this.apiKey = config.apiKey;
  // ...
}

// After
interface AniListConfig extends ApiClientConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  defaultLanguage?: 'english' | 'romaji' | 'native';
}

constructor(config: AniListConfig) {
  // Type-safe access to configuration properties
  const baseURL = config.baseURL || 'https://graphql.anilist.co';
  
  super({
    ...config,
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.headers
    },
    // ...
  });
  
  this.accessToken = config.accessToken || null;
  this.clientId = config.clientId;
  this.clientSecret = config.clientSecret;
  this.defaultLanguage = config.defaultLanguage || 'english';
  // ...
}
```

### 2.3 API Responses

API responses now use explicit interfaces:

```typescript
// Before
private async graphqlQuery(query: string, variables?: any): Promise<any> {
  // ...
}

// After
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code?: string;
    };
  }>;
}

interface AniListSearchResponse {
  Page: {
    media: AniListMedia[];
  };
}

private async graphqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  // ...
}

public async search(query: string, options?: SearchOptions): Promise<Manga[]> {
  // ...
  const response = await this.graphqlQuery<AniListSearchResponse>(searchQuery, variables);
  // ...
}
```

## 3. Adapter Pattern Type Safety

The adapter pattern has been improved with proper TypeScript interfaces:

```typescript
// Before
export class AniListAdapter {
  private client: any;
  
  constructor(config: any = {}) {
    this.client = createAniListClient({
      baseURL: config.apiEndpoint,
      accessToken: config.accessToken,
      // ...
    });
  }
  
  async searchManga(query: string): Promise<any[]> {
    // ...
  }
  
  // ...
}

// After
import { AniListConfig, AniListMedia } from '@/types/adapters/anilist';
import { IntegrationAdapter, MetadataSourceInfo } from '@/types/adapters/base';
import { MangaMetadata, MetadataDetails } from '@/types/common';

export interface AniListAdapterConfig extends AniListConfig {
  useConsolidated?: boolean;
}

export class AniListAdapter implements IntegrationAdapter<AniListAdapterConfig> {
  private client: ReturnType<typeof createAniListClient>;
  private readonly config: AniListAdapterConfig;
  
  constructor(config: AniListAdapterConfig = {}) {
    this.config = config;
    this.client = createAniListClient({
      baseURL: config.apiEndpoint,
      accessToken: config.accessToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      defaultLanguage: config.defaultLanguage || 'english'
    });
  }
  
  getSourceInfo(): MetadataSourceInfo {
    return {
      id: 'anilist',
      name: 'AniList',
      description: 'Anime and manga database with a modern API',
      website: 'https://anilist.co',
      // ...
    };
  }
  
  async searchManga(query: string): Promise<MangaMetadata[]> {
    // Type-safe implementation
    // ...
  }
  
  // ...
}
```

## 4. Factory Pattern Type Safety

The factory pattern has been improved with proper TypeScript interfaces:

```typescript
// Before
export function createMetadataProvider(config: any) {
  if (config.useConsolidated) {
    switch (config.type) {
      case 'anilist':
        return createAniListAdapter({
          apiEndpoint: config.baseURL,
          // ...
        });
      // ...
    }
  }
  // ...
}

// After
export interface MetadataProviderConfig {
  type: 'mangadex' | 'anilist' | 'comicvine' | 'fandom';
  baseURL?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  preferredLanguage?: string;
  defaultLanguage?: 'english' | 'romaji' | 'native';
  includeAdult?: boolean;
  coverQuality?: 'small' | 'medium' | 'large';
  useConsolidated?: boolean;
  defaultWikis?: string[];
  // Using Record for additional properties with unknown type for better type safety
  [key: string]: unknown;
}

export type MetadataProviderInterface =
  | MangaDexClient
  | AniListClient
  | ComicVineClient
  | FandomClient
  | AniListAdapter
  | ComicVineAdapter
  | FandomAdapter;

export function createMetadataProvider(config: MetadataProviderConfig): MetadataProviderInterface {
  if (config.useConsolidated) {
    switch (config.type) {
      case 'anilist':
        return createAniListAdapter({
          apiEndpoint: config.baseURL,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          accessToken: config.accessToken,
          useConsolidated: true
        });
      // ...
    }
  }
  // ...
}
```

## 5. Error Handling Type Safety

Error handling has been improved with proper TypeScript interfaces:

```typescript
// Before
try {
  // ...
} catch (error) {
  throw new Error(`Authentication failed: ${error}`);
}

// After
class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorFactoryInterface {
  authentication(message: string): ApiError;
  network(message: string): ApiError;
  request(message: string): ApiError;
  generic(message: string, code?: string): ApiError;
}

try {
  // ...
} catch (error: unknown) {
  if (error instanceof ApiError) {
    // Handle specific API error
    throw error;
  } else if (error instanceof Error) {
    // Handle generic Error
    throw this.errorFactory.authentication(`Authentication failed: ${error.message}`);
  } else {
    // Handle unknown error
    throw this.errorFactory.authentication(`Authentication failed: ${String(error)}`);
  }
}
```

## 6. Common Type Issues and Solutions

### 6.1 Using `unknown` Instead of `any`

```typescript
// Before
function processData(data: any) {
  return data.value;
}

// After
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: unknown }).value;
  }
  throw new Error('Invalid data format');
}
```

### 6.2 Type Guards for Narrowing Types

```typescript
// Before
function handleResponse(response: any) {
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data;
}

// After
interface ErrorResponse {
  error: string;
}

interface SuccessResponse<T> {
  data: T;
}

function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ErrorResponse).error === 'string'
  );
}

function isSuccessResponse<T>(response: unknown): response is SuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response
  );
}

function handleResponse<T>(response: unknown): T {
  if (isErrorResponse(response)) {
    throw new Error(response.error);
  }
  
  if (isSuccessResponse<T>(response)) {
    return response.data;
  }
  
  throw new Error('Invalid response format');
}
```

### 6.3 Enumerated Types Instead of String Literals

```typescript
// Before
type Status = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';

// After
enum MangaStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
  CANCELLED = 'cancelled',
  UNKNOWN = 'unknown'
}
```

### 6.4 Using Generics for Better Type Inference

```typescript
// Before
function createCache() {
  const cache = new Map();
  
  return {
    get(key: string) {
      return cache.get(key);
    },
    set(key: string, value: any) {
      cache.set(key, value);
    },
    clear() {
      cache.clear();
    }
  };
}

// After
class Cache<T> {
  private cache = new Map<string, T>();
  
  get(key: string): T | undefined {
    return this.cache.get(key);
  }
  
  set(key: string, value: T): void {
    this.cache.set(key, value);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

function createCache<T>() {
  return new Cache<T>();
}
```

## 7. Best Practices

### 7.1 Define Explicit Return Types

Always define explicit return types for functions and methods, especially for public APIs:

```typescript
// Good
public async search(query: string, options?: SearchOptions): Promise<Manga[]> {
  // ...
}

// Avoid
public async search(query: string, options?: SearchOptions) {
  // ...
}
```

### 7.2 Use Union Types for Nullable Values

```typescript
// Good
function getUser(id: string): User | null {
  // ...
}

// Avoid
function getUser(id: string): any {
  // ...
}
```

### 7.3 Use Type Predicates for Type Guards

```typescript
// Good
function isManga(obj: unknown): obj is Manga {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'title' in obj &&
    'id' in obj
  );
}

// Avoid
function isManga(obj: any): boolean {
  return obj && obj.title && obj.id;
}
```

### 7.4 Use Readonly for Immutable Properties

```typescript
// Good
interface Config {
  readonly apiKey: string;
  readonly baseURL: string;
  // ...
}

// Avoid
interface Config {
  apiKey: string;
  baseURL: string;
  // ...
}
```

### 7.5 Use Record<K, V> for Dictionary-Like Objects

```typescript
// Good
function processHeaders(headers: Record<string, string>): void {
  // ...
}

// Avoid
function processHeaders(headers: { [key: string]: string }): void {
  // ...
}
```

## 8. Additional Resources

For more information on TypeScript type safety, check out the following resources:

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [Type-Level TypeScript](https://type-level-typescript.com/)
- [Effective TypeScript: 62 Specific Ways to Improve Your TypeScript](https://effectivetypescript.com/)
---
### Source: trpc-client-resilience-improvements.md


1. **Silent Failures**: The previous implementation silently returned success states with empty data for missing endpoints
2. **Cascading Errors**: A single endpoint failure would prevent other data from loading
3. **Poor Error Reporting**: Errors were not properly reported or logged for debugging
4. **Inconsistent Import Paths**: Multiple import sources led to unpredictable behavior

## Solution Overview

### 1. Enhanced Import Strategy

We established two valid import paths for different use cases:

```typescript
// Standard import - for regular components
import { trpc } from '../utils/trpc-client/index';

// Resilient import - for critical infrastructure components
import { trpc } from '../utils/trpc-monkey-patch';
```

The `trpc-monkey-patch` version provides automatic fallbacks for missing endpoints while still indicating errors correctly.

### 2. Improved Error Handling in useCompatibleQuery

The `useCompatibleQuery` hook was enhanced to properly report errors when endpoints are missing:

```typescript
// Before:
return {
  data: null,
  isLoading: false,
  isError: false, // 👎 Error state not reflected
  error: null,    // 👎 No error information
  isSuccess: true, // 👎 Incorrectly reports success
  status: 'success',
  refetch: () => Promise.resolve(null),
};

// After:
return {
  data: null,
  isLoading: false,
  isError: true, // ✅ Correct error state
  error: new Error('tRPC query endpoint not available'), // ✅ Helpful error message
  isSuccess: false, // ✅ Correctly indicates failure
  status: 'error',
  refetch: () => Promise.resolve({ data: null }),
  isFetching: false
};
```

### 3. Partial Success Handling in RootStoreProvider

The `RootStoreProvider` was updated to continue functioning even if some data fails to load:

```typescript
// Track success/failure of each data load
const dataLoadStatus = {
  settings: false,
  library: false,
  manga: false
};

// Continue with other data loads despite errors
try {
  const settingsResult = await settingsQuery.refetch();
  dataLoadStatus.settings = true;
} catch (error) {
  // Log but don't abort all data loading
  console.error('Settings loading error:', error);
}

// Determine overall initialization success
const successCount = Object.values(dataLoadStatus).filter(Boolean).length;
const partialSuccess = successCount > 0;
const majorSuccess = successCount >= 2;

// Initialize app with partial data if possible
initialized.current = partialSuccess;
```

### 4. Enhanced Error Reporting

Detailed error logging was added to help diagnose issues:

```typescript
console.error('Initialization Error:', {
  message: errorMessage,
  stack: error instanceof Error ? error.stack : undefined,
  queries: {
    settings: {
      status: settingsQuery.status,
      error: settingsQuery.error?.message
    },
    library: {
      status: libraryQuery.status,
      error: libraryQuery.error?.message
    },
    manga: {
      status: mangaQuery.status,
      error: mangaQuery.error?.message
    }
  }
});
```

## Implementation Details

### Fixed Files

1. **RootStoreProvider.tsx**
   - Updated import path to use the resilient client
   - Improved error handling and reporting
   - Added partial success handling

2. **fix-use-query.ts**
   - Enhanced error state reporting
   - Added proper error messages for debugging
   - Improved typescript typing

### Before & After Comparison

#### Import Strategy

**Before:**
```typescript
// Inconsistent imports across the codebase
import { trpc } from '../utils/trpc-client/index';
import { trpc } from '../utils/trpc-monkey-patch';
import { trpc } from '../utils/trpcClient';
```

**After:**
```typescript
// Clear import strategy based on component needs
// Regular components:
import { trpc } from '../utils/trpc-client/index';

// Critical infrastructure components:
import { trpc } from '../utils/trpc-monkey-patch';
```

#### Error Handling

**Before:**
```typescript
// Data loading would abort completely on any error
try {
  const settingsResult = await settingsQuery.refetch();
  if (!settingsResult.data) {
    throw new Error('Failed to load settings');
  }
  // Continue with other data...
} catch (error) {
  // All loading stops here, app fails to initialize
  setError('settings-loading', errorMessage);
  throw error;
}
```

**After:**
```typescript
// Each data type loads independently
try {
  const settingsResult = await settingsQuery.refetch();
  if (!settingsResult?.data || settingsQuery.isError) {
    throw new Error(`Failed to load settings: ${settingsQuery.error?.message || 'No data returned'}`);
  }
  dataLoadStatus.settings = true;
} catch (error) {
  // Log error but continue with other data loads
  console.error('Settings loading error:', {
    message: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    query: settingsQuery.status
  });
  setError('settings-loading', errorMessage);
  // No throw here - continue with other data
}
```

## Benefits

1. **Improved Resilience**: Application continues functioning with partial data
2. **Better Debugging**: Detailed error logs with query states and stack traces
3. **User Experience**: Appropriate error messages based on failure severity
4. **Developer Experience**: Clear guidance on which import to use and when

## Future Improvements

1. **Server-Side Error Enrichment**: Add more context to server-side errors
2. **Query Retry Logic**: Implement smart retry strategies for transient failures
3. **Error Boundaries**: Add React error boundaries for tRPC-related failures
4. **Offline Support**: Cache successful responses for offline/degraded functionality

## Conclusion

These improvements significantly enhance the application's ability to handle tRPC errors gracefully. By implementing proper error states, partial success handling, and detailed error reporting, the application can now continue functioning even when some data sources are unavailable, providing a more robust user experience.
---
### Source: client-settings-fixes.updated.md


1. **Import Path Issues**: The file used absolute paths with the `@/` prefix, which TypeScript was unable to resolve correctly.

2. **Redundant Return Type Annotations**: Components had redundant return type annotations when React.FC was already used.

3. **Outdated Mantine UI Component Props**: The code used outdated Mantine UI component props that are no longer supported in newer versions.

4. **JSDoc Documentation Verbosity**: Overly verbose JSDoc documentation with redundant parameter descriptions.

A total of 12 TypeScript errors were identified, with hundreds of related type errors.

## Changes Made

### 1. Removed Redundant Return Type Annotations

Changed components to avoid redundant return type annotations:

```typescript
// Before
export const ClientSettingsForm: React.FC<ClientSettingsFormProps> = ({ 
  onSave, 
  initialConfig 
}): React.ReactElement => {
  // ...
};

// After
export const ClientSettingsForm: React.FC<ClientSettingsFormProps> = ({ 
  onSave, 
  initialConfig 
}) => {
  // ...
};
```

### 2. Updated Mantine UI Component Props

Updated Mantine UI component props to match the current API:

```typescript
// Before
<Group position="apart" mb="md">
  {/* ... */}
</Group>

// After
<Group justify="space-between" mb="md">
  {/* ... */}
</Group>
```

```typescript
// Before
<Group spacing="md">
  {/* ... */}
</Group>

// After
<Group gap="md">
  {/* ... */}
</Group>
```

### 3. Import Path Fixes

Changed all import paths from the `@/` prefix format to relative paths:

```typescript
// Before
import { PasswordToggle } from '@/components/common/PasswordToggle';
import { useIntegrationStore } from '@/store/integrationSlice';
import { trpc } from '@/utils/trpcClient';
import { createTransmissionClient } from '@/api/downloadClients/transmissionClient';
// ... and other similar imports

// After
import { PasswordToggle } from '../../../components/common/PasswordToggle';
import { useIntegrationStore } from '../../../store/integrationSlice';
import { trpc } from '../../../utils/trpcClient';
import { createTransmissionClient } from '../../../api/downloadClients/transmissionClient';
// ... and other similar imports
```

### 4. Dynamic Import Path Fixes

Fixed dynamic import paths in the client test fallback code:

```typescript
// Before
const { TransmissionProxyClient } = await import('@/api/downloadClients/transmissionProxy');

// After
const { TransmissionProxyClient } = await import('../../../api/downloadClients/transmissionProxy');
```

### 5. Simplified JSDoc Documentation

Streamlined JSDoc documentation while maintaining essential information:

```typescript
// Before
/**
 * Form component for configuring download clients
 * 
 * This component provides a form for adding or editing download client configurations.
 * It dynamically adjusts the form fields based on the selected client type.
 * 
 * @component
 * @param {ClientSettingsFormProps} props - Component props
 * @returns {React.ReactElement} Client settings form
 * 
 * @example
 * ```tsx
 * <ClientSettingsForm 
 *   onSave={(config) => saveClientConfig(config)}
 *   initialConfig={{
 *     name: 'My Transmission',
 *     type: 'transmission',
 *     url: 'http://localhost:9091',
 *     apiKey: 'username:password',
 *     isEnabled: true
 *   }}
 * />
 * ```
 */

// After
/**
 * Form component for configuring download clients
 * 
 * This component provides a form for adding or editing download client configurations.
 * It dynamically adjusts the form fields based on the selected client type.
 */
```

## Additional Improvements

### Type Definitions

Simplified interface definitions by removing redundant JSDoc parameter descriptions:

```typescript
// Before
/**
 * Props for the ClientSettingsForm component
 * 
 * @interface ClientSettingsFormProps
 * @property {Function} onSave - Callback function called when the form is submitted
 * @property {ClientConfig} [initialConfig] - Initial configuration values
 */
interface ClientSettingsFormProps {
  onSave: (config: ClientConfig) => void;
  initialConfig?: ClientConfig;
}

// After
/**
 * Props for the ClientSettingsForm component
 */
interface ClientSettingsFormProps {
  onSave: (config: ClientConfig) => void;
  initialConfig?: ClientConfig;
}
```

## Key Learnings

1. **React.FC with Return Types**: When using React.FC, the return type is already specified and should not be duplicated with an explicit return type annotation.

2. **Mantine UI Prop Updates**: 
   - `position="apart"` → `justify="space-between"` 
   - `spacing="md"` → `gap="md"`

3. **JSDoc Best Practices**: Keep JSDoc documentation concise and focused on providing essential information. Avoid redundancy, especially for obvious parameter types.

## Testing Considerations

When implementing this fix, consider the following testing steps:

1. Verify that all download client settings forms render correctly
2. Test the connection functionality for each client type
3. Verify that client preferences are saved and retrieved correctly
4. Ensure proper error handling and display of error messages
5. Confirm that the auto-select functionality works as expected
6. Test with actual download clients to verify end-to-end functionality

## Next Steps

After implementing these fixes:

1. Update any imports in other files that reference this file to use the new `.fixed.new.tsx` version
2. Consider consolidating client creation logic to reduce code duplication
3. Consider adding more comprehensive type definitions for the client APIs
---
### Source: client-consolidation-tests.md

  - Test initialization with various configurations
  - Test connection validation and error handling
  - Test add torrent functionality
  - Test get status functionality
  - Test pause and resume functionality
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the Transmission API
  - Test proxy mode operation
  - Test authentication and session handling
  - Test error recovery and retry logic

- **Component Tests**
  - Test TransmissionSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 1.2 SABnzbd Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test connection validation and error handling
  - Test add NZB functionality
  - Test get status functionality
  - Test pause and resume functionality
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the SABnzbd API
  - Test proxy mode operation
  - Test authentication and API key handling
  - Test error recovery and retry logic

- **Component Tests**
  - Test SABnzbdSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 1.3 Deluge Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test connection validation and error handling
  - Test add torrent functionality
  - Test get status functionality
  - Test pause and resume functionality
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the Deluge RPC API
  - Test proxy mode operation
  - Test authentication and session handling
  - Test error recovery and retry logic

- **Component Tests**
  - Test DelugeSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 1.4 NZBGet Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test connection validation and error handling
  - Test add NZB functionality
  - Test get status functionality
  - Test pause and resume functionality
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the NZBGet RPC API
  - Test proxy mode operation
  - Test authentication and session handling
  - Test error recovery and retry logic

- **Component Tests**
  - Test NZBGetSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

## 2. Testing Metadata Providers

### 2.1 AniList Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test search functionality
  - Test getManga functionality
  - Test getChapters functionality
  - Test caching mechanism
  - Test rate limiting
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the AniList GraphQL API
  - Test authentication and token handling
  - Test error recovery and retry logic
  - Test metadata mapping and conversion

- **Component Tests**
  - Test AnilistSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 2.2 ComicVine Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test search functionality
  - Test getManga functionality
  - Test getChapters functionality
  - Test caching mechanism
  - Test rate limiting
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the ComicVine API
  - Test API key handling
  - Test error recovery and retry logic
  - Test metadata mapping and conversion

- **Component Tests**
  - Test ComicVineSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 2.3 Fandom Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test search functionality
  - Test getManga functionality
  - Test getChapters functionality
  - Test HTML parsing
  - Test caching mechanism
  - Test rate limiting
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with Fandom wikis
  - Test wiki selection logic
  - Test error recovery and retry logic
  - Test metadata extraction and mapping

- **Component Tests**
  - Test FandomSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

### 2.4 MangaDex Client

- **Unit Tests**
  - Test initialization with various configurations
  - Test search functionality
  - Test getManga functionality
  - Test getChapters functionality
  - Test getChapterPages functionality
  - Test caching mechanism
  - Test rate limiting
  - Test resource cleanup

- **Integration Tests**
  - Test interaction with the MangaDex API
  - Test authentication and token handling
  - Test error recovery and retry logic
  - Test metadata mapping and conversion

- **Component Tests**
  - Test MangaDexSettings component with the consolidated client
  - Test the toggle functionality for enabling/disabling consolidated client
  - Test client factory with both legacy and consolidated modes

## 3. Adapter Testing

### 3.1 Download Client Adapters

- **Unit Tests**
  - Test that adapters correctly delegate to the consolidated clients
  - Test that adapters maintain backward compatibility
  - Test error handling and propagation

- **Integration Tests**
  - Test that adapters work with existing components
  - Test that adapters handle configuration changes

### 3.2 Metadata Provider Adapters

- **Unit Tests**
  - Test that adapters correctly delegate to the consolidated clients
  - Test that adapters maintain backward compatibility
  - Test error handling and propagation

- **Integration Tests**
  - Test that adapters work with existing components
  - Test that adapters handle configuration changes

## 4. Factory Testing

### 4.1 Download Client Factory

- **Unit Tests**
  - Test that the factory correctly creates consolidated clients when specified
  - Test that the factory falls back to legacy clients when appropriate
  - Test error handling for missing configurations

- **Integration Tests**
  - Test that the factory works with existing components
  - Test that the factory handles configuration changes

### 4.2 Metadata Provider Factory

- **Unit Tests**
  - Test that the factory correctly creates consolidated clients when specified
  - Test that the factory falls back to legacy clients when appropriate
  - Test error handling for missing configurations

- **Integration Tests**
  - Test that the factory works with existing components
  - Test that the factory handles configuration changes

## 5. End-to-End Testing

### 5.1 Download Client Workflow

- Test the entire download workflow with consolidated clients:
  - Configure client through UI
  - Connect to client
  - Add download
  - Monitor download progress
  - Pause and resume download
  - Complete download

### 5.2 Metadata Provider Workflow

- Test the entire metadata workflow with consolidated clients:
  - Configure provider through UI
  - Search for manga
  - View manga details
  - Update metadata
  - View chapters

## 6. Performance Testing

### 6.1 Download Clients

- Test performance of consolidated clients vs. legacy clients:
  - Connection time
  - Request latency
  - Memory usage
  - CPU usage
  - Error recovery time

### 6.2 Metadata Providers

- Test performance of consolidated clients vs. legacy clients:
  - Search time
  - Metadata retrieval time
  - Memory usage
  - CPU usage
  - Error recovery time

## 7. Load Testing

### 7.1 Download Clients

- Test behavior under load:
  - Multiple concurrent downloads
  - High volume of status updates
  - Rapid pause/resume operations

### 7.2 Metadata Providers

- Test behavior under load:
  - Multiple concurrent searches
  - High volume of metadata requests
  - Rapid API operations

## 8. Security Testing

### 8.1 Authentication

- Test secure handling of credentials:
  - API keys
  - Usernames and passwords
  - Access tokens
  - Session cookies

### 8.2 Data Handling

- Test secure handling of data:
  - URL sanitization
  - Input validation
  - Output escaping
  - Error message sanitization

## 9. Compatibility Testing

### 9.1 API Versions

- Test compatibility with different API versions:
  - Transmission API versions
  - SABnzbd API versions
  - Deluge RPC versions
  - NZBGet RPC versions
  - AniList GraphQL schema versions
  - ComicVine API versions
  - MangaDex API versions

### 9.2 Browser Compatibility

- Test components with different browsers:
  - Chrome
  - Firefox
  - Safari
  - Edge

## 10. Accessibility Testing

### 10.1 Settings Components

- Test accessibility of settings components:
  - Keyboard navigation
  - Screen reader compatibility
  - Color contrast
  - Focus management

## Implementation Plan

1. **Unit Tests (2 weeks)**
   - Implement unit tests for all consolidated clients
   - Implement unit tests for adapters
   - Implement unit tests for factories

2. **Integration Tests (2 weeks)**
   - Implement integration tests for clients
   - Implement integration tests for adapters
   - Implement integration tests for factories

3. **Component Tests (1 week)**
   - Implement tests for settings components
   - Implement tests for component interactions

4. **End-to-End Tests (1 week)**
   - Implement end-to-end workflows
   - Test complete user journeys

5. **Performance Testing (1 week)**
   - Implement performance benchmarks
   - Compare legacy vs. consolidated clients

6. **Bug Fixing and Refinement (1 week)**
   - Address issues found during testing
   - Refine implementations based on feedback
---
### Source: client-settings-fixes.md


1. **Import Path Issues**: The file used absolute paths with the `@/` prefix, which TypeScript was unable to resolve correctly.

2. **JSX Flag Errors**: The file contained JSX/TSX syntax but the TypeScript compiler wasn't configured to recognize it in this file, resulting in numerous `Cannot use JSX unless the '--jsx' flag is provided` errors.

A total of 10 TypeScript errors were identified, with hundreds of related JSX flag errors.

## Changes Made

### 1. Import Path Fixes

Changed all import paths from the `@/` prefix format to relative paths:

```typescript
// Before
import { PasswordToggle } from '@/components/common/PasswordToggle';
import { useIntegrationStore } from '@/store/integrationSlice';
import { trpc } from '@/utils/trpcClient';
import { createTransmissionClient } from '@/api/downloadClients/transmissionClient';
// ... and other similar imports

// After
import { PasswordToggle } from '../../../components/common/PasswordToggle';
import { useIntegrationStore } from '../../../store/integrationSlice';
import { trpc } from '../../../utils/trpcClient';
import { createTransmissionClient } from '../../../api/downloadClients/transmissionClient';
// ... and other similar imports
```

### 2. Dynamic Import Path Fixes

Fixed dynamic import paths in the client test fallback code:

```typescript
// Before
const { TransmissionProxyClient } = await import('@/api/downloadClients/transmissionProxy');

// After
const { TransmissionProxyClient } = await import('../../../api/downloadClients/transmissionProxy');
```

### 3. TypeScript JSX Handling

Created a new file with the `.tsx` extension to ensure the TypeScript compiler properly handles JSX syntax. The file was renamed from `ClientSettings.tsx` to `ClientSettings.fixed.tsx`.

## Additional Notes

1. The file contained well-documented React components with proper TypeScript interfaces and comprehensive JSDoc comments, which were preserved in the fixed version.

2. The overall structure and functionality of the components were maintained:
   - ClientSettingsForm: A generic form for configuring download clients
   - TransmissionSettings: Configuration component for Transmission
   - DelugeSettings: Configuration component for Deluge
   - SabnzbdSettings: Configuration component for SABnzbd
   - NzbgetSettings: Configuration component for NZBGet
   - DownloadClientPreferences: Component for managing global download client preferences

3. All dynamic client testing and error handling functionality was preserved, including:
   - URL normalization and validation
   - Client connection testing
   - Detailed error messages and troubleshooting tips
   - Fallback mechanisms for legacy clients

## Testing Considerations

When implementing this fix, consider the following testing steps:

1. Verify that all download client settings forms render correctly
2. Test the connection functionality for each client type
3. Verify that client preferences are saved and retrieved correctly
4. Ensure proper error handling and display of error messages
5. Confirm that the auto-select functionality works as expected
6. Test with actual download clients to verify end-to-end functionality

## Next Steps

After implementing these fixes:

1. Update any imports in other files that reference this file to use the new `.fixed.tsx` version
2. Consider consolidating client creation logic to reduce code duplication
3. Consider adding more comprehensive type definitions for the client APIs
---
### Source: client-consolidation-migration.md

- Ensures consistent error handling
- Provides uniform resource management
- Simplifies maintenance and future improvements
- Ensures type safety throughout the client implementations

## 2. Changes Made

### 2.1 Removed Feature Flags

We've removed all feature flags related to client consolidation:

- Removed `useConsolidated` from all client configurations
- Removed `useConsolidated` from all state stores
- Removed all UI toggles for switching between implementations
- Eliminated all conditional logic based on feature flags

### 2.2 Updated Factory Functions

Factory functions have been simplified to use only the consolidated implementations:

```typescript
// Before
export function createMetadataProvider(config: MetadataProviderConfig) {
  if (config.useConsolidated) {
    // Create consolidated client
  } else {
    // Create legacy client
  }
}

// After
export function createMetadataProvider(config: MetadataProviderConfig) {
  // Always create consolidated client
  switch (config.type) {
    case 'anilist':
      return createAniListClient(config);
    // ...other cases
  }
}
```

### 2.3 Removed Legacy Client Code

We've removed all legacy client code and dependencies:

- Removed legacy client implementations
- Removed adapter classes for backward compatibility
- Removed deprecated API usage
- Standardized on consolidated client interfaces

### 2.4 Updated Settings Components

Settings components have been updated to use the consolidated clients directly:

- Removed all UI toggles for enabling consolidated clients
- Removed all handlers for toggling client implementations
- Simplified the settings state
- Updated all API calls to use the new clients

### 2.5 Updated Integration Slice

The integration slice has been updated to remove all references to legacy clients:

- Removed `useConsolidated` from all client configurations
- Simplified the state structure
- Updated the initial state
- Removed conditional logic based on feature flags

## 3. Migration Process

To ensure a smooth migration, follow these steps:

1. **Run Migration Script**: Run `scripts/migrate-to-consolidated-clients.js` to update all settings in the database to use the consolidated clients.

2. **Update Code**: Deploy the updated code that uses the consolidated clients exclusively.

3. **Verify Functionality**: Test all client functionality to ensure everything works as expected.

4. **Monitor Performance**: Monitor the system for any performance issues or errors.

## 4. Benefits

### 4.1 Simplified Codebase

- Reduced complexity with a single implementation path
- Eliminated conditional logic based on feature flags
- Removed redundant adapter classes
- Standardized client interfaces

### 4.2 Improved Error Handling

- Consistent error handling across all clients
- Standardized error types
- Better error recovery mechanisms
- More detailed error information

### 4.3 Better Resource Management

- Consistent resource cleanup with `dispose()` pattern
- Proper HTTP client management
- Efficient memory usage
- Connection management for persistent clients

### 4.4 Enhanced Type Safety

- Eliminated `any` types
- Added proper interfaces for all API responses
- Used generic types for better type inference
- Added type guards for narrowing types

### 4.5 Performance Improvements

- Reduced overhead from feature flag checking
- Optimized caching strategies
- Efficient rate limiting
- Reduced code size

## 5. Troubleshooting

If you encounter issues after migration, check the following:

1. **Settings Migration**: Ensure the migration script ran successfully and updated all settings.

2. **Client Configuration**: Verify that all client configurations are properly set up.

3. **Error Handling**: Check for any errors related to client initialization or API requests.

4. **Resource Cleanup**: Ensure all clients are properly disposed after use.

## 6. Conclusion

The migration to consolidated API clients simplifies the codebase, improves error handling, and enhances type safety. By eliminating backward compatibility and standardizing on a single implementation, we've reduced complexity and made the code more maintainable.
---
### Source: trpc-client-migration-summary.md


## Solution
Replaced all references to the mock tRPC client with the real implementation.

### Changes Made:

1. **Updated trpc-monkey-patch.ts**
   - Changed import from `./trpcClient` to `./trpc-client/index`
   - Now uses the real tRPC client as the base for the proxy

2. **Replaced mock trpcClient.ts**
   - Converted to a backward compatibility shim
   - Now exports the real tRPC client from `./trpc-client/index`
   - Added deprecation notice

3. **Verified existing imports**
   - All active component files already use the correct import paths
   - No changes needed to component files

### Key Files:

- **Real tRPC Client**: `/src/utils/trpc-client/index.ts`
  - Configured with SuperJSON transformer
  - HTTP batch link for optimized requests
  - Proper TypeScript types from AppRouter

- **API Handler**: `/src/pages/api/trpc/[trpc].ts`
  - Handles all tRPC requests
  - Uses the appRouter from server implementation

- **Root Router**: `/src/server/trpc/root.ts`
  - Combines all sub-routers
  - Defines the complete API surface

### Benefits:

1. **Real API Calls**: The application now makes actual API calls to the server
2. **Type Safety**: Full TypeScript support with proper types from the server
3. **All Endpoints Available**: Access to all implemented server endpoints
4. **Better Error Handling**: Real error responses from the server

### Migration Notes:

- The mock client is kept as a backward compatibility shim
- New code should import from `../utils/trpc-client/index`
- The monkey-patch client is still available for components needing graceful degradation

## Testing

After these changes:
1. The library page should load correctly
2. All API calls should return real data from the database
3. TypeScript errors related to missing endpoints should be resolved

---
### Source: client-consolidation-architecture.md

2. **Metadata Providers** - AniList, ComicVine, Fandom, MangaDex

The architecture is designed to be:

- **Consistent**: All clients follow the same patterns
- **Robust**: Error handling, retry logic, and resource management are standardized
- **Efficient**: Caching and rate limiting are built in
- **Extensible**: New clients can be added easily
- **Backward Compatible**: Existing code continues to work during migration

## 2. Architecture Components

### 2.1 Base Classes

The architecture is built on abstract base classes that define the standard interfaces for all clients:

#### 2.1.1 DownloadClient

The `DownloadClient` abstract class (`src/api/base/DownloadClient.ts`) defines the interface for all download clients:

```typescript
abstract class DownloadClient {
  // Core methods
  abstract addUrl(options: AddDownloadOptions): Promise<string>;
  abstract getStatus(): Promise<DownloadStatus>;
  abstract getAllItems(): Promise<DownloadItem[]>;
  abstract getItem(id: string): Promise<DownloadItem | null>;
  abstract pauseItem(id: string): Promise<void>;
  abstract resumeItem(id: string): Promise<void>;
  abstract removeItem(id: string, deleteFiles?: boolean): Promise<void>;
  abstract pauseAll(): Promise<void>;
  abstract resumeAll(): Promise<void>;
  
  // Resource management
  public dispose(): void;
  
  // Utility methods
  protected abstract ping(): Promise<void>;
  public getDownloadSpeed(): Promise<number>;
  public getUploadSpeed(): Promise<number>;
  public isConnected(): boolean;
}
```

#### 2.1.2 MetadataProvider

The `MetadataProvider` abstract class (`src/api/base/MetadataProvider.ts`) defines the interface for all metadata providers:

```typescript
abstract class MetadataProvider {
  // Core methods
  abstract search(query: string, options?: SearchOptions): Promise<Manga[]>;
  abstract getManga(id: string): Promise<Manga>;
  abstract getChapters(mangaId: string, options?: ChapterOptions): Promise<Chapter[]>;
  abstract getChapter(id: string): Promise<Chapter>;
  abstract getChapterPages(chapterId: string): Promise<string[]>;
  abstract getTrending(options?: TrendingOptions): Promise<Manga[]>;
  abstract getRecentlyUpdated(options?: UpdatedOptions): Promise<Manga[]>;
  
  // Resource management
  public dispose(): void;
  
  // Utility methods
  protected abstract ping(): Promise<void>;
  abstract getProviderType(): string;
  protected abstract mapStatus(providerStatus: string): MangaStatus;
  protected abstract mapContentRating(providerRating: any): ContentRating;
}
```

### 2.2 Client Implementations

Each client extends the appropriate base class and implements the required methods. Clients also include:

- **Constructor**: Takes configuration options and initializes the client
- **HTTP Client**: An internal HTTP client for making API requests
- **Error Factory**: A factory for creating standardized errors
- **Cache**: An in-memory cache for optimizing requests
- **Rate Limiter**: A rate limiter to prevent API throttling
- **Connection Status**: A mechanism for tracking connection status

Example client structure:

```typescript
export class TransmissionClient extends DownloadClient {
  private http: HttpClient;
  private errorFactory: ErrorFactory;
  private cache: Cache;
  private rateLimiter: RateLimiter;
  private connectionStatus: ConnectionStatus;
  
  constructor(config: TransmissionConfig) {
    super();
    // Initialize client
  }
  
  // Implement abstract methods
  public async addUrl(options: AddDownloadOptions): Promise<string> {
    // Implementation
  }
  
  // ...other methods
  
  // Clean up resources
  public dispose(): void {
    // Clean up HTTP client and other resources
    super.dispose();
  }
}
```

### 2.3 Adapters

Adapters provide backward compatibility by implementing the legacy interface while using the new consolidated clients internally:

```typescript
export class TransmissionAdapter {
  private client: TransmissionClient;
  
  constructor(config: LegacyTransmissionConfig) {
    // Create consolidated client with legacy config
    this.client = new TransmissionClient({
      baseURL: config.host,
      username: config.username,
      password: config.password
    });
  }
  
  // Implement legacy methods
  public async addTorrent(url: string): Promise<string> {
    return this.client.addUrl({ url });
  }
  
  // ...other legacy methods
  
  // Clean up resources
  public dispose(): void {
    this.client.dispose();
  }
}
```

### 2.4 Factories

Factories create the appropriate client based on configuration:

```typescript
export function createDownloadClient(config: DownloadClientConfig) {
  if (config.useConsolidated) {
    // Create consolidated client
    switch (config.type) {
      case 'transmission':
        return new TransmissionClient(config);
      // ...other client types
    }
  } else {
    // Create legacy client via adapter
    switch (config.type) {
      case 'transmission':
        return new TransmissionAdapter(config);
      // ...other client types
    }
  }
}
```

### 2.5 Component Integration

Components are updated to use the factories and support both consolidated and legacy clients:

```typescript
function TransmissionSettings() {
  const [useConsolidated, setUseConsolidated] = useState(false);
  
  const handleTest = async () => {
    const client = createDownloadClient({
      type: 'transmission',
      baseURL: url,
      username,
      password,
      useConsolidated
    });
    
    try {
      await client.ping();
      // Success
    } catch (error) {
      // Error
    } finally {
      client.dispose();
    }
  };
  
  // ...rest of component
}
```

## 3. Key Features

### 3.1 Error Handling

All clients use a standardized error handling approach:

- **Error Factory**: Creates typed errors with consistent properties
- **Error Transformation**: Maps API-specific errors to standardized errors
- **Error Recovery**: Implements retry logic and fallbacks
- **Error Logging**: Logs errors with appropriate context

```typescript
try {
  const response = await this.http.get('/api/endpoint');
  return this.transformResponse(response);
} catch (error) {
  if (this.isRetryableError(error)) {
    return this.retryRequest(() => this.http.get('/api/endpoint'));
  } else {
    throw this.errorFactory.create('request', error.message, error);
  }
}
```

### 3.2 Resource Management

All clients implement proper resource management to prevent memory leaks:

- **Dispose Method**: Cleans up all resources when the client is no longer needed
- **Connection Cleanup**: Closes connections and cancels pending requests
- **Cache Cleanup**: Clears cached data
- **Token Revocation**: Revokes tokens when appropriate

```typescript
public dispose(): void {
  this.http.dispose();
  this.cache.clear();
  this.eventEmitter.removeAllListeners();
  this.clearAccessToken();
  super.dispose();
}
```

### 3.3 Caching

All clients implement efficient caching to reduce API calls:

- **In-Memory Cache**: Caches responses with TTL
- **Cache Invalidation**: Invalidates cache when data changes
- **Cache Optimization**: Optimizes cache size and eviction policy

```typescript
private async getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = this.cache.get<T>(key);
  if (cached) return cached;
  
  const result = await fetcher();
  this.cache.set(key, result, this.cacheTTL);
  return result;
}
```

### 3.4 Rate Limiting

All clients implement rate limiting to prevent API throttling:

- **Request Throttling**: Limits request rate
- **Concurrency Control**: Limits concurrent requests
- **Backoff Strategy**: Implements exponential backoff
- **Rate Monitoring**: Monitors rate limits and adjusts dynamically

```typescript
private async waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.minRequestInterval) {
    await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
  }
  
  this.lastRequestTime = Date.now();
}
```

## 4. Implementation Details

### 4.1 Download Clients

#### 4.1.1 Transmission Client

- **Protocol**: JSON-RPC over HTTP
- **Authentication**: Basic auth or session-based
- **Features**: Torrent management, status tracking, rate limiting

#### 4.1.2 Deluge Client

- **Protocol**: JSON-RPC over HTTP
- **Authentication**: Password-based with session
- **Features**: Torrent management, status tracking, daemon selection

#### 4.1.3 SABnzbd Client

- **Protocol**: RESTful API
- **Authentication**: API key
- **Features**: NZB management, status tracking, category support

#### 4.1.4 NZBGet Client

- **Protocol**: JSON-RPC over HTTP
- **Authentication**: Username/password
- **Features**: NZB management, status tracking, group support

### 4.2 Metadata Providers

#### 4.2.1 AniList Client

- **Protocol**: GraphQL
- **Authentication**: OAuth with token
- **Features**: Anime/manga search, detailed metadata, user lists

#### 4.2.2 ComicVine Client

- **Protocol**: RESTful API
- **Authentication**: API key
- **Features**: Comic search, detailed metadata, issue listings

#### 4.2.3 Fandom Client

- **Protocol**: HTTP with HTML parsing
- **Authentication**: None
- **Features**: Wiki search, page parsing, metadata extraction

#### 4.2.4 MangaDex Client

- **Protocol**: RESTful API
- **Authentication**: JWT-based
- **Features**: Manga search, chapter listings, page retrieval

## 5. Migration Strategy

The migration strategy is designed to enable gradual adoption of the new consolidated clients:

### 5.1 Phases

1. **Implementation Phase**:
   - Implement all consolidated clients
   - Implement adapters for backward compatibility
   - Implement factories for client creation

2. **Component Integration Phase**:
   - Update components to use factories
   - Add UI toggles for enabling consolidated clients
   - Implement feature flags in the store

3. **Testing Phase**:
   - Unit test all new implementations
   - Integration test with real APIs
   - Component tests for UI interaction

4. **Rollout Phase**:
   - Enable consolidated clients by default for new installations
   - Migrate existing installations gradually
   - Monitor for issues and roll back if needed

### 5.2 Backward Compatibility

Backward compatibility is maintained through several mechanisms:

- **Adapters**: Provide the legacy interface while using the new implementations
- **Feature Flags**: Allow enabling/disabling consolidated clients per provider
- **Fallbacks**: Fall back to legacy clients if new clients fail
- **Dual Update**: Update both new and legacy data structures

## 6. Future Enhancements

Future enhancements to the consolidated clients architecture:

- **More Providers**: Add support for more download clients and metadata providers
- **Performance Optimization**: Further optimize caching and request batching
- **Offline Support**: Add support for offline operation with local caching
- **Analytics**: Add usage analytics for monitoring and optimization
- **Multi-Account Support**: Add support for multiple accounts per provider
- **Plugin System**: Allow extending clients with plugins
- **Advanced Rate Limiting**: Implement more sophisticated rate limiting strategies
- **Improved Error Recovery**: Add more advanced error recovery strategies

## 7. Conclusion

The consolidated clients architecture provides a robust, consistent, and efficient way to interact with external APIs. It improves error handling, resource management, and performance while enabling gradual adoption. This architecture will serve as the foundation for all future API interactions in the application.
---
### Source: mangadex-client-fixes.md

- Retrieving manga details
- Fetching chapters and chapter pages
- Getting author information
- Trending and recently updated manga lists
- Authentication with MangaDex

## Issues Fixed

### 1. Import Path and Type Imports

**Issue**: Import paths used aliases (e.g., `@/utils`) instead of relative paths, and type-only imports weren't distinguished.

**Fix**:
- Changed import paths to use relative paths:
  ```typescript
  // Before
  import { NetworkError, RateLimitError, ResourceNotFoundError } from '../utils';
  
  // After
  import { NetworkError, RateLimitError, ResourceNotFoundError, errorFactory } from '../utils/errorHandling';
  ```
- Added proper type imports:
  ```typescript
  import type { RateLimiter, Cache } from '../base/ApiClient';
  ```

### 2. Type Definitions

**Issue**: Several type definitions used `any` or lacked proper type safety.

**Fix**:
- Replaced `any` with more specific types:
  ```typescript
  // Before
  attributes?: any;
  
  // After
  attributes?: Record<string, unknown>;
  ```
- Added index signatures with proper type annotations:
  ```typescript
  interface MangaDexSearchParams {
    // ...other properties
    [key: string]: unknown;
  }
  ```

### 3. Null/Undefined Handling

**Issue**: Many functions didn't check for null or undefined values, leading to potential runtime errors.

**Fix**:
- Added null checks to all API responses:
  ```typescript
  // Before
  const response = await this.get<MangaDexResponse<MangaDexManga[]>>('/manga', params);
  return Promise.all(response.data.map(manga => this.convertToManga(manga)));
  
  // After
  const response = await this.get<MangaDexResponse<MangaDexManga[]>>('/manga', params);
  if (!response || !response.data) {
    throw errorFactory.createError('EmptyResponseError', 'Empty response received from MangaDex API', {
      serviceName: this.getProviderType()
    });
  }
  return Promise.all(response.data.map(manga => this.convertToManga(manga)));
  ```
- Added null handling in utility functions:
  ```typescript
  // Before
  private getLocalizedString(localizedString: LocalizedString): string {
  
  // After
  private getLocalizedString(localizedString: LocalizedString | null | undefined): string {
    if (!localizedString) {
      return '';
    }
  ```

### 4. Method Overrides

**Issue**: Methods that override parent class methods weren't marked with the `override` keyword.

**Fix**:
- Added `override` keyword to methods that override parent class methods:
  ```typescript
  // Before
  public getProviderType(): string {
  
  // After
  public override getProviderType(): string {
  ```

### 5. Type Casting

**Issue**: Relationships and attributes were accessed without proper type casting.

**Fix**:
- Added proper type casting for relationships:
  ```typescript
  // Before
  const coverFilename = coverArt?.attributes?.fileName;
  
  // After
  const coverAttributes = coverArt?.attributes as MangaDexCoverAttributes | undefined;
  const coverFilename = coverAttributes?.fileName;
  ```
- Used type assertions to safely access nested properties:
  ```typescript
  // Before
  .map(author => ({
    id: author.id,
    name: author.attributes?.name || 'Unknown',
    role: 'author'
  }));
  
  // After
  .map(author => {
    const authorAttributes = author.attributes as MangaDexAuthorAttributes | undefined;
    return {
      id: author.id,
      name: authorAttributes?.name || 'Unknown',
      role: 'author'
    };
  });
  ```

### 6. Error Handling

**Issue**: Error handling was inconsistent and didn't follow the project's error factory pattern.

**Fix**:
- Used the error factory pattern for creating errors:
  ```typescript
  // Before
  throw new Error('Failed to authenticate with MangaDex. Please check your credentials.');
  
  // After
  throw errorFactory.createError('AuthenticationError', `Failed to authenticate with MangaDex: ${errorMessage}`, {
    serviceName: this.getProviderType()
  });
  ```
- Added specific error types for different error cases:
  ```typescript
  if (!response || !response.token) {
    throw errorFactory.createError('AuthenticationError', 'Failed to authenticate with MangaDex', {
      serviceName: this.getProviderType()
    });
  }
  ```

### 7. Async Error Handling

**Issue**: Some async methods didn't properly handle errors, potentially leading to unhandled promise rejections.

**Fix**:
- Added try/catch blocks to async methods:
  ```typescript
  // Before
  private async ensureTagsCached(): Promise<void> {
    if (this.tagsCache.length === 0) {
      await this.getTags();
    }
  }
  
  // After
  private async ensureTagsCached(): Promise<void> {
    if (this.tagsCache.length === 0) {
      try {
        await this.getTags();
      } catch (error) {
        // Log error but don't fail the operation
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to cache MangaDex tags: ${errorMessage}`);
      }
    }
  }
  ```

### 8. Resource Management

**Issue**: The class didn't have a method to free resources when it's no longer needed.

**Fix**:
- Added a `dispose` method to free resources:
  ```typescript
  /**
   * Disposes of resources
   */
  public dispose(): void {
    this.authTokens = null;
    this.tagsCache = [];
  }
  ```

### 9. Method Visibility

**Issue**: Some methods had inappropriate visibility modifiers.

**Fix**:
- Changed method visibility from `protected` to `private` where appropriate:
  ```typescript
  // Before
  protected mapStatus(status?: string): MangaStatus {
  
  // After
  private mapStatus(status?: string): MangaStatus {
  ```
- Kept methods that override parent class methods as `protected` or `public`:
  ```typescript
  protected override async ping(): Promise<void> {
  ```

## Benefits of These Fixes

1. **Improved Type Safety**: Better type definitions and null/undefined handling reduce the risk of runtime errors.

2. **Enhanced Maintainability**: Consistent patterns for error handling, type casting, and method visibility make the code easier to maintain.

3. **Better IDE Support**: Proper type annotations provide better autocomplete and type checking in IDEs.

4. **Resource Management**: The addition of the `dispose` method ensures proper cleanup of resources.

5. **Consistent Architecture**: Alignment with the project's architectural patterns and coding standards.

6. **Error Handling**: More specific error messages and consistent error handling patterns make debugging easier.

## Approach

The fixes applied to this file follow the systematic approach of:

1. **Import Fixes**: Ensuring proper import paths and type imports
2. **Type Definitions**: Improving type safety for interfaces and method signatures
3. **Null Safety**: Adding null/undefined checks to prevent runtime errors
4. **Error Handling**: Using consistent error handling patterns
5. **Interface Conformance**: Ensuring proper implementation of parent class methods
6. **Resource Management**: Adding disposal mechanisms for cleanup

This approach provides a consistent pattern that can be applied to other files in the codebase to improve overall type safety and maintainability.
---
### Source: integration-client-consolidation-plan.md

2. **Inconsistent Error Handling:** Different error handling strategies across implementations
3. **Redundant Code:** Significant code duplication between direct and proxy implementations
4. **Resource Management Gaps:** Inconsistent connection cleanup and resource disposal
5. **Type Definition Duplication:** Redundant type definitions across files
6. **Parameter Naming Inconsistency:** Different parameter names for the same concepts

## Consolidation Strategy

We'll follow the same successful approach used for the Prowlarr client consolidation:

### 1. Download Clients Consolidation

#### Transmission Client

Create a unified `src/api/downloadClients/transmissionClient.ts` that:
- Combines functionality from existing implementations
- Implements consistent error handling with typed errors
- Provides proper resource management with dispose pattern
- Supports both direct and proxied communication

#### Deluge Client

Create a unified `src/api/downloadClients/delugeClient.ts` that:
- Consolidates the three existing implementations
- Standardizes the JSON-RPC communication
- Implements connection pooling for better performance
- Provides proper resource cleanup

### 2. Metadata Providers Consolidation

#### AniList Client

Create a unified `src/api/metadataProviders/anilistClient.ts` that:
- Provides a single client implementation
- Handles rate limiting and caching consistently
- Implements proper OAuth flow management
- Standardizes error handling

#### MangaDex Client

Create a unified `src/api/metadataProviders/mangadexClient.ts` that:
- Consolidates functionality from multiple services
- Implements proper rate limiting per API docs
- Standardizes error handling and response mapping
- Provides resource cleanup mechanisms

#### ComicVine Client

Create a unified `src/api/metadataProviders/comicvineClient.ts` following the same pattern.

#### Fandom Client

Create a unified `src/api/metadataProviders/fandomClient.ts` following the same pattern.

### 3. Shared Integration Utilities

Create shared utilities for common functionality:

1. `src/api/utils/rateLimit.ts`: Standardized rate limiting implementation
2. `src/api/utils/caching.ts`: Consistent caching strategies
3. `src/api/utils/errorHandling.ts`: Standard error types and handling
4. `src/api/utils/resourceManagement.ts`: Connection pooling and cleanup

### 4. Migration Process

For each integration, follow this process:

1. Create the new consolidated client
2. Update all components that use the old clients
3. Verify functionality with integration tests
4. Remove the old client implementations

## Implementation Priorities

Based on usage and duplication severity:

1. **High Priority:**
   - Transmission Client (most used download client)
   - MangaDex Client (core metadata provider)

2. **Medium Priority:**
   - AniList Client
   - Deluge Client

3. **Lower Priority:**
   - ComicVine Client
   - Fandom Client

## Benefits

This consolidation will provide numerous benefits:

1. **Maintainability:** Single implementation per integration
2. **Consistency:** Standardized error handling and resource management
3. **Performance:** Optimized connection handling and caching
4. **Developer Experience:** Clear patterns for using integrations
5. **Type Safety:** Comprehensive type definitions in one place

## Example Pattern

```typescript
// Client creation
import { createTransmissionClient } from '@/api/downloadClients/transmissionClient';

const client = createTransmissionClient({
  baseURL: 'http://localhost:9091/transmission/rpc',
  username: 'admin',
  password: 'password',
  timeout: 5000,
  notifyOnError: false
});

// Resource management
try {
  const torrents = await client.getTorrents();
  // Do something with torrents
} finally {
  client.dispose();
}

// React component pattern
function TransmissionComponent() {
  const clientRef = useRef<TransmissionClient | null>(null);
  
  useEffect(() => {
    clientRef.current = createTransmissionClient(config);
    
    return () => {
      if (clientRef.current) {
        clientRef.current.dispose();
        clientRef.current = null;
      }
    };
  }, [config]);
  
  // Use clientRef.current for operations
}
```

## Migration Timeline

- **Phase 1 (1-2 weeks):** Create consolidated clients for high-priority integrations
- **Phase 2 (1-2 weeks):** Update components to use new clients, verify functionality
- **Phase 3 (1 week):** Remove old implementations after successful migration
- **Phase 4 (2-3 weeks):** Implement medium and lower priority consolidations

## Next Steps

1. Begin with Transmission client consolidation as proof of concept
2. Document design patterns and best practices based on that implementation
3. Create templates for other integrations to follow
4. Establish comprehensive test approach for integration clients
---
### Source: client-types-fixes.md


The original file was using absolute import paths with the `@/` prefix, which TypeScript could not resolve correctly:

```typescript
// Original (incorrect)
import {
  MangaEntity,
  ChapterEntity,
  ChapterStatus,
  MangaWithRelations,
  LibraryEntity,
  MangaMetadata
} from '@/types/domain/manga-types';

import {
  TaskEntity,
  TaskStatus,
  TaskType
} from '@/types/domain/task-types';

import { SyncStatus } from '@/types/prismaTypes';
```

These import paths were updated to use relative paths:

```typescript
import {
  MangaEntity,
  MangaWithRelations,
  MangaMetadata
} from './domain/manga-types';

import {
  ChapterEntity,
  ChapterStatus
} from './domain/chapter-types';

import { LibraryEntity } from './domain/library-types';

import {
  TaskEntity,
  TaskStatus,
  TaskType
} from './domain/task-types';

import { SyncStatus } from './prismaTypes';
```

### 2. Incorrect Import Sources

The original file was importing all types from `manga-types.ts`, but some of those types were actually defined in other files:

- `ChapterEntity` and `ChapterStatus` were actually from `chapter-types.ts`
- `LibraryEntity` was from `library-types.ts`

The fixed version imports each type from its correct source file.

### 3. Redundant Re-exports

The file was re-exporting types that were already imported:

```typescript
// Original (redundant)
export { ChapterStatus } from '@/types/domain/chapter-types';
export { TaskStatus, TaskType } from '@/types/domain/task-types';
export { SyncStatus } from '@/types/prismaTypes';
```

These redundant re-exports were removed since the types are already available in the module scope from the imports.

## Changes Made

1. **Updated Import Paths**:
   - Changed absolute paths with `@/` prefix to relative paths starting with `./`
   - This makes TypeScript compilation more reliable across different environments

2. **Corrected Import Sources**:
   - Reorganized imports to get each type from its proper source file
   - Improved code organization and reduced the risk of circular dependencies

3. **Removed Redundant Re-exports**:
   - Simplified the file by removing unnecessary re-export statements
   - Reduced the risk of inconsistencies between imported and re-exported types

## Benefits

1. **Improved TypeScript Compatibility**: The file now compiles without errors, making it compatible with the project's TypeScript configuration.

2. **Better Code Organization**: Each type is now imported from its canonical source, making the code more maintainable and easier to understand.

3. **Reduced Type Errors**: By importing types from their correct sources, we eliminate the risk of type mismatches or missing type exports.

4. **Simplified Module Structure**: Removing redundant re-exports makes the module structure clearer and reduces the risk of circular dependencies.

## Affected Components

These fixes impact any component that imports types from `clientTypes.fixed.ts`. Since this file serves as a centralized type definition for client-side code, it's likely used by many React components and utility functions throughout the application.

The changes maintain backward compatibility with existing code while fixing the TypeScript errors.
---
### Source: fandom-client-fixes-update.md


1. **Interface Implementation**: The `RequestCache` and `CustomRateLimiter` classes didn't properly implement the required interfaces from the base classes.

2. **RateLimiter.remaining Implementation**: The `limiter.remaining` property in the `RateLimiter` class was incorrectly implemented as a value instead of a function.

3. **Null Safety Handling**: Missing null checks in similarity comparison and sorting functions.

4. **Optional Parameter Handling**: Missing default values and proper handling for optional parameters.

5. **Header Handling**: Inadequate handling of potentially undefined header objects.

6. **Type Safety for providerSpecific**: Missing proper type assertions for provider-specific data.

7. **Method Access Modifiers**: Inconsistent method protection levels compared to the base class.

8. **Error Handling**: Inconsistent error handling patterns across the implementation.

9. **Missing Interface Methods**: Several required methods from base interfaces were not implemented.

## Changes Made

### 1. Interface Implementation

Added proper interface implementations for `RequestCache` and renamed `CustomRateLimiter` to `RateLimiter`:

```typescript
// Before
class RequestCache {
  // ...
}

// After
class RequestCache implements Cache<unknown> {
  // Added missing interface methods
  has(key: string): boolean { /* ... */ }
  invalidate(key: string): void { /* ... */ }
  invalidateRelated(pattern: string): void { /* ... */ }
  invalidateAll(): void { /* ... */ }
  invalidateByTags(tags: string[]): void { /* ... */ }
  setWithTags<T>(key: string, data: T, tags: string[]): void { /* ... */ }
}
```

### 2. RateLimiter Interface Implementation

Fixed the `limiter.remaining` property to be a function as required by the interface:

```typescript
// Before
limiter = {
  points: this.maxRequestsPerMinute,
  duration: 60,
  remaining: this.maxRequestsPerMinute - this.requestTimestamps.length
};

// After
limiter = {
  points: this.maxRequestsPerMinute,
  duration: 60,
  remaining: () => this.maxRequestsPerMinute - this.requestTimestamps.length
};
```

### 3. Null Safety in Sorting Functions

Added proper null checking for similarity values in sorting functions:

```typescript
// Before
.sort((a, b) => (b.similarity - a.similarity));

// After
.sort((a, b) => ((b.similarity !== undefined ? b.similarity : 0) - (a.similarity !== undefined ? a.similarity : 0)));
```

### 4. Optional Parameter Handling

Added default parameter values and proper checks:

```typescript
// Before
private async apiRequest<T>(path: string, params: Record<string, string>, wikiDomain: string): Promise<T>

// After
private async apiRequest<T>(path: string, params: Record<string, string> = {}, wikiDomain: string = this.primaryWikiDomain): Promise<T>
```

### 5. Header Handling

Improved handling of potentially undefined header objects:

```typescript
// Before
headers: {
  'User-Agent': 'MangaManager/1.0',
  'Accept': 'application/json',
  ...config.headers
}

// After
headers: {
  'User-Agent': 'MangaManager/1.0',
  'Accept': 'application/json',
  ...(config.headers || {})
}
```

### 6. Type Safety for providerSpecific

Enhanced type safety for provider-specific data:

```typescript
// Before
providerSpecific: {
  volumes: info.volumes,
  chapterCount: info.totalChapters
}

// After
providerSpecific: {
  // Fandom-specific data
  volumes: info.volumes,
  publishDate: info.publishDate,
  chapters: info.chapters,
  totalChapters: info.totalChapters
}
```

### 7. Method Access Modifiers

Fixed method protection levels to align with base class requirements:

```typescript
// Before
public mapStatus(status: unknown): MangaStatus {
  // Implementation
}

// After
protected mapStatus(providerStatus: unknown): MangaStatus {
  // Implementation
}
```

### 8. Improved Error Handling

Updated error handling to use the errorFactory pattern consistently:

```typescript
// Before
throw new Error(`Failed to get manga: ${error instanceof Error ? error.message : String(error)}`);

// After
throw this.errorFactory.generic(
  `Fandom API error: ${error instanceof Error ? error.message : String(error)}`,
  { path, params, wikiDomain }
);
```

### 9. Added Missing Interface Methods

Implemented required methods from base interfaces:

```typescript
// Added new methods
public async ping(): Promise<void> {
  try {
    // Implementation
  } catch (error: unknown) {
    // Error handling
  }
}

protected mapContentRating(providerRating: unknown): ContentRating {
  // Implementation
}

public dispose(): void {
  this.fandomCache.clear();
  super.dispose();
}
```

## Testing Considerations

After implementing these fixes, the following tests should be performed:

1. Verify that manga search functionality works correctly with proper rate limiting
2. Test manga details retrieval from different Fandom wikis with proper error handling
3. Verify that similarity sorting works correctly with null/undefined values
4. Ensure API requests properly handle default parameters
5. Test that caching works correctly with the fixed interface implementation
6. Confirm that error handling works properly in edge cases
7. Verify that the client successfully implements all required interface methods

## Refactoring Improvements

Besides fixing TypeScript errors, the following improvements were made:

1. **Code Organization**: Added helper methods to improve readability and maintainability
2. **Documentation**: Enhanced JSDoc comments for better code understanding
3. **Consistent Patterns**: Aligned implementation with patterns used in other adapter files
4. **Error Context**: Added more context to error messages for better debugging
5. **Type Imports**: Ensured proper imports from base classes

## Next Steps

Future improvements for this file could include:

1. Implement more robust error handling with specific error types for different failure scenarios
2. Add unit tests specifically for edge cases in the sorting and filtering logic
3. Enhance the rate limiter to support dynamic adjustment based on API response headers
4. Improve the caching mechanism to support tag-based invalidation more effectively
5. Add telemetry to track API usage and performance metrics
---
### Source: fandom-client-fixes.md


1. **Import Issues**: The file used the default import for cheerio, which doesn't have a default export.

2. **TypeScript Compatibility**: The code used Set iteration which requires downlevelIteration or a higher target than ES5.

3. **Interface Implementation**: The custom `RequestCache` and `RateLimiter` classes didn't properly implement the interfaces from the base `MetadataProvider` class.

4. **Property Type Errors**: 
   - The `errorFactory.request` method didn't exist
   - The `chapters` property in the Manga type was incorrectly assigned a number instead of an array
   - The `volume` property was incorrectly used in the Chapter type when it doesn't exist in the interface

## Changes Made

### 1. Import Fixes

Changed the cheerio import from default to namespace import:

```typescript
// Before
import cheerio from 'cheerio';

// After
import * as cheerio from 'cheerio';
```

### 2. Set Iteration Compatibility

Changed the Set iteration to use Array.from for better compatibility:

```typescript
// Before
return [...new Set(wikis)];

// After
return Array.from(new Set(wikis));
```

### 3. Interface Implementation

Added proper interface implementations for both custom classes:

```typescript
// Before
class RequestCache {
  // ...methods but no interface implementation
}

// After
class RequestCache implements Cache<unknown> {
  // Original methods plus new required methods
  config = { enabled: true, ttl: this.ttl, namespace: 'fandom' };
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateRelated(pattern: string): void {
    // No-op for simple implementation
  }

  // ... other required methods
}
```

```typescript
// Before
class RateLimiter {
  // ...methods but no interface implementation
}

// After
class RateLimiter implements BaseRateLimiter {
  // Original methods plus new required methods
  limiter = {
    points: this.maxRequestsPerMinute,
    duration: 60,
    remaining: this.maxRequestsPerMinute - this.requestTimestamps.length
  };

  async acquire(): Promise<void> {
    return this.waitForNextRequest();
  }

  // ... other required methods
}
```

### 4. Property and Type Fixes

Fixed the error handling to use the correct error method:

```typescript
// Before
throw this.errorFactory.request(
  `Fandom API error: ${error instanceof Error ? error.message : String(error)}`,
  { path, params, wikiDomain }
);

// After
throw this.errorFactory.generic(
  `Fandom API error: ${error instanceof Error ? error.message : String(error)}`,
  { path, params, wikiDomain }
);
```

Fixed the chapter property assignment in the Manga type:

```typescript
// Before
chapters: info.totalChapters,  // This is a number, not Chapter[]

// After
chapters: [],  // Empty array instead of info.totalChapters
```

Fixed the volume property in the Chapter interface:

```typescript
// Before
return {
  id: `${chapter.number}`,
  title: chapter.title,
  chapterNumber: chapter.number.toString(),
  volume: chapter.volume,  // volume is not in the Chapter type
  sourceUrl: chapter.url,
  // ...
};

// After
return {
  id: `${chapter.number}`,
  title: chapter.title,
  chapterNumber: chapter.number.toString(),
  sourceUrl: chapter.url,
  providerSpecific: {
    description: chapter.description,
    coverImage: chapter.coverImage,
    volume: chapter.volume  // Moved to providerSpecific
  } as Record<string, unknown>
};
```

### 5. Property Naming

Renamed internal properties to avoid conflicts with inherited properties:

```typescript
// Before
private cache: RequestCache;
private rateLimiter: RateLimiter;

// After
private fandomCache: RequestCache;
private fandomRateLimiter: RateLimiter;
```

### 6. Import Additional Types

Added imports for the required interface types:

```typescript
// Added to imports
import { Cache } from '../base';
import { RateLimiter as BaseRateLimiter } from '../base/ApiClient';
```

## Additional Notes

1. The `RequestCache` and `RateLimiter` classes were extended to implement the required interfaces from the parent class while maintaining their original functionality.

2. We renamed the internal cache and rate limiter properties to avoid naming conflicts with parent class properties.

3. We preserved all the original functionality while making the code type-safe.

4. The fandom client correctly processes manga information from Fandom wikis, extracts chapters, and normalizes the data to the application's standard formats.

## Testing Considerations

After implementing these fixes, the following tests should be performed:

1. Verify that manga search functionality works correctly
2. Test manga details retrieval from different Fandom wikis
3. Verify chapter list extraction from various manga pages
4. Check that image URLs are correctly extracted
5. Ensure caching and rate limiting function as expected

## Next Steps

Future improvements for this file could include:

1. Enhanced error handling with more specific error types
2. Better fallback mechanisms for missing data
3. Improved wiki selection algorithm based on search relevance
4. Potential optimization of HTML parsing for chapter information
5. Add support for additional Fandom wikis beyond the default list
---

## Document History

- **Created**: $(date +"%Y-%m-%d") - Consolidated from multiple client documentation files
- **Status**: Active
- **Maintainer**: Documentation Team

## Related Documentation

- [Download Clients Guide](./download-clients-guide.md) - BitTorrent & Usenet clients
- [API Client Reference](./api-client-reference.md) - HTTP & API integration
- [UI Client Guide](./ui-client-guide.md) - Frontend & navigation

