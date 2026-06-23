# Download Clients Integration Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*
*Last Updated: August 2025*

## Overview

Comprehensive guide for the download clients integrated by the app: Transmission, Deluge, NZBGet, and SABnzbd.

## Cleanup Record (August 2025)

### Files Removed (Legacy/Duplicates)
- **transmission.ts** (166 lines) - Legacy implementation, replaced by transmissionClient.ts
- **transmissionProxy.ts** (238 lines) - Legacy proxy-specific implementation, functionality merged into transmissionClient.ts  
- **sabnzbd.ts** (199 lines) - Legacy implementation, replaced by sabnzbdClient.ts

### Current Canonical Files
- **transmissionClient.ts** (1444 lines) - Modern consolidated Transmission client with full features
- **sabnzbdClient.ts** (697 lines) - Modern consolidated SABnzbd client
- **delugeClient.ts** (1310 lines) - Modern Deluge client implementation
- **nzbgetClient.ts** (745 lines) - Modern NZBGet client implementation
- **types.ts** - Shared type definitions
- **index.ts** - Client factory and exports

## Table of Contents

1. [Supported Clients](#supported-clients)
2. [Common Integration Pattern](#common-integration-pattern)
3. [Client-Specific Configuration](#client-specific-configuration)
4. [Error Handling](#error-handling)
5. [Testing & Troubleshooting](#testing--troubleshooting)

## Supported Clients

### BitTorrent Clients
- Transmission
- Deluge

### Usenet Clients
- NZBGet
- SABnzbd

### Indexer Integration
- Prowlarr
- Jackett


---
### Source: download-clients-evaluation.md

- [x] Uses the standardized HTTP client
- [x] Implements proper error handling
- [x] Has proper rate limiting (not applicable for these clients)
- [x] Uses StandardClient pattern with proper inheritance
- [x] Has proper type safety

## Analysis

### TransmissionClient
**Comparing `transmissionClient.ts` vs `transmissionClient.fixed.ts`**

Both files are nearly identical with only a few minor differences:

1. In `transmissionClient.ts` (current version):
   - ✅ Has better type checking in the `extractResponseData` utility function
   - ✅ Has better null/undefined checking
   - ✅ Uses more specific type checks (e.g., checking `response === null || typeof response !== 'object'`)
   - ✅ Has proper error handling with detailed error messages
   - ✅ Properly extends DownloadClient

2. In `transmissionClient.fixed.ts`:
   - ✅ Has the same core functionality as the current version
   - ❌ Uses `any` in the `extractResponseData` utility function
   - ❌ Less defensive checking for null/undefined values

The differences are minor and mostly related to type safety. The current version (`transmissionClient.ts`) is slightly better in terms of type safety and error handling.

### NZBGetClient
**Comparing `nzbgetClient.ts` vs `nzbgetClient.fixed.ts`**

The files are nearly identical with no significant differences:

1. Both files:
   - ✅ Properly extend DownloadClient
   - ✅ Use strong typing throughout the codebase
   - ✅ Have comprehensive error handling
   - ✅ Include the same type guards and utility functions
   - ✅ Have proper conversion between provider-specific types and domain types
   - ✅ Include factory functions for creation

There appear to be no meaningful differences between the two versions. They implement the same functionality with the same level of type safety and error handling.

## Recommendation

### TransmissionClient
Based on the evaluation, `transmissionClient.ts` (the current version without suffix) is the most aligned with the project's architectural patterns because:

1. It has better type safety in utility functions
2. It has more comprehensive null/undefined checking
3. It has the same core functionality as the fixed version
4. It properly extends DownloadClient and follows the architectural pattern

**Implementation Decision:**
- Keep: `transmissionClient.ts` (already the canonical version)
- Delete: `transmissionClient.fixed.ts`

### NZBGetClient
Since both files are nearly identical, we can keep the current version (`nzbgetClient.ts`) as the canonical version:

1. It properly extends DownloadClient
2. It has comprehensive error handling
3. It has strong typing throughout
4. It has proper conversion between provider-specific types and domain types

**Implementation Decision:**
- Keep: `nzbgetClient.ts` (already the canonical version)
- Delete: `nzbgetClient.fixed.ts`

No renaming is required for either client since the best versions are already the canonical versions without suffixes.
---
### Source: download-client-test-user-guide.md

### 2. Configure Your Client
For each download client you want to use:
- **Enable** the client using the toggle switch
- Enter your actual server URL (e.g., `http://192.168.1.100:8112` for Deluge)
- Enter authentication details (password or API key)
- Set the category/label for manga downloads

### 3. Test the Connection
- Click the **"Test Connection"** button for that specific client
- The test will use your configured URL and credentials
- You'll see either "Connection successful!" or an error message

### 4. Save Your Settings
Once the test passes, click **"Save Settings"** to persist your configuration.

## Important Notes

- The test uses your actual configured URLs, not localhost
- Make sure your download client is running and accessible from the Kaizoku server
- Check firewall rules if the connection fails
- Each client has its own test button - test them individually

## Common Issues

### Connection Failed
- Verify the URL is correct and includes the port number
- Check that the download client service is running
- Ensure the server is accessible from where Kaizoku is hosted
- Verify firewall allows the connection

### Authentication Failed
- Double-check your password or API key
- For Deluge: Default password is often "deluge"
- For NZBGet: Default username/password is "nzbget"/"tegbzn6789"
- For SABnzbd/Transmission: Check the API key in the client's settings

### Wrong URL Format
- Include the protocol: `http://` or `https://`
- Include the port: `:8112` for Deluge, `:9091` for Transmission, etc.
- Don't include trailing slashes or API paths

---
### Source: nzbget-client-implementation.md

- Test endpoint: `/src/pages/api/download-clients/nzbget/test.ts`

## Features
- Full JSON-RPC API support
- Authentication with username/password
- Download management (add, pause, resume, remove)
- Status tracking
- Error handling with clear messages

## Configuration
The client requires:
- `baseURL`: NZBGet server URL (default: http://localhost:6789)
- `username`: NZBGet username
- `password`: NZBGet password
- `category`: Optional category for downloads (default: manga)

## Common Issues

### Authentication Failed (401 Unauthorized)
This is the most common issue. To resolve:
1. Check your NZBGet configuration file for the correct credentials
2. Default credentials are often: username `nzbget`, password `tegbzn6789`
3. Verify credentials work by accessing the NZBGet web interface

### Connection Refused
Ensure NZBGet is running and accessible on the specified port.

## API Methods
- `append`: Add download by URL (not `appendurl`)
- `listgroups`: Get active downloads
- `history`: Get completed downloads
- `editqueue`: Manage downloads (pause, resume, delete)
- `status`: Get server status

## Implementation Details
- Uses correct JSON-RPC method names per official API
- Parameters must be in exact order (positional parameters)
- Handles authentication via HTTP Basic Auth
- Proper error detection for auth failures (401 responses)

---
### Source: download-clients-error-handling-plan.md


1. **DelugeClient**: Not yet updated with enhanced error handling
2. **TransmissionClient**: Not yet updated with enhanced error handling
3. **NZBgetClient**: Not yet updated with enhanced error handling

## Implementation Plan

For each download client, we'll implement the following enhanced error handling patterns:

### 1. Add Required Imports

```typescript
import { 
  withEnhancedErrorHandling,
  createContextualErrorCreator,
  ContextualError,
  ContextualErrorCreator
} from '../../api/utils/errorHandling';
```

### 2. Add Class-Level Contextual Error Creator

```typescript
private createContextualError: ContextualErrorCreator;

constructor(config: Partial<TransmissionClientConfig> = {}) {
  // Existing initialization code...
  
  // Initialize contextual error creator
  this.createContextualError = createContextualErrorCreator({
    service: 'TransmissionClient',
    resourceType: 'download'
  });
}
```

### 3. Update Return Types to Use ContextualError

Update method signatures to use `ContextualError` instead of `Error`:

```typescript
// Before
public async getDownloads(): Promise<AsyncResult<DownloadItem[], Error>> {
  // Implementation...
}

// After
public async getDownloads(): Promise<AsyncResult<DownloadItem[], ContextualError>> {
  // Implementation...
}
```

### 4. Implement Enhanced Error Handling with withEnhancedErrorHandling

Replace existing try/catch blocks with `withEnhancedErrorHandling`:

```typescript
// Before
public async getDownloads(): Promise<AsyncResult<DownloadItem[], Error>> {
  try {
    const response = await this.httpClient.get('/transmission/rpc');
    // Process response...
    return createSuccessResult(downloads);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Failed to get downloads: ${String(error)}`)
    );
  }
}

// After
public async getDownloads(): Promise<AsyncResult<DownloadItem[], ContextualError>> {
  const asyncResult = await withEnhancedErrorHandling<DownloadItem[]>(async () => {
    const response = await this.httpClient.get('/transmission/rpc');
    // Process response...
    
    if (!response.ok) {
      throw this.createContextualError(
        `API returned status ${response.status}`,
        'getDownloads'
      );
    }
    
    // Process data with proper type checks
    return downloads;
  }, {
    operation: 'getDownloads',
    service: 'TransmissionClient',
    resourceType: 'download'
  });
  
  return asyncResult;
}
```

### 5. Add Timeout Protection for Network Operations

```typescript
private async fetchWithTimeout<T>(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(this.createContextualError(
      `Request timed out after ${timeoutMs}ms`,
      'fetchWithTimeout'
    )), timeoutMs);
  });
  
  // Race between the fetch and the timeout
  return Promise.race([
    fetch(url, options),
    timeoutPromise
  ]) as Promise<Response>;
}
```

### 6. Update Wrapper Methods That Convert AsyncResult to Direct Returns

```typescript
// Before
public async getDownloadsDirectly(): Promise<DownloadItem[]> {
  const result = await this.getDownloads();
  if (result.status === 'success') {
    return result.data;
  }
  throw result.error;
}

// After
public async getDownloadsDirectly(): Promise<DownloadItem[]> {
  const result = await this.getDownloads();
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  throw this.createContextualError(
    'Unknown state in getDownloadsDirectly',
    'getDownloadsDirectly'
  );
}
```

## Implementation Priority

The download clients should be updated in the following order:

1. **TransmissionClient**: Most commonly used client, prioritize this first
2. **NZBgetClient**: Second priority based on usage
3. **DelugeClient**: Third priority based on usage

## Testing Strategy

After implementing enhanced error handling, test each client with:

1. **Normal operation**: Verify that successful operations continue to work
2. **Connection failures**: Test with unavailable services to verify error handling
3. **Timeout handling**: Test with slow responses to verify timeout protection
4. **Invalid data handling**: Test with unexpected response formats to verify type safety

## Success Criteria

The implementation will be considered successful when:

1. All download clients use the enhanced error handling pattern
2. Error messages include contextual information about the operation, service, and resource
3. Error handling is consistent across all clients
4. All client methods properly handle different AsyncResult states
5. All methods have proper timeout protection for network operations
6. TypeScript verification passes with zero errors

## Documentation

After implementation, update the following documentation:

1. Create a download client error handling guide
2. Update the adapter pattern documentation with download client examples
3. Add examples of timeout protection implementation

## Conclusion

By implementing these enhanced error handling patterns in download clients, we will improve reliability, debuggability, and maintainability of the download functionality. This implementation aligns with the broader error handling standardization across the codebase and completes Phase 4 of the adapter error handling and type system finalization project.
---
### Source: deluge-client-asyncresult-pattern.md


To resolve this incompatibility while preserving the benefits of the AsyncResult pattern, we implemented a wrapper pattern:

1. Public methods that match the DownloadClient interface return direct values (string, boolean, DownloadItem, etc.)
2. Private methods with names prefixed with underscore (e.g., `_addUrl`) implement the actual logic and return AsyncResult types
3. Public methods call their private counterparts and unwrap the result or throw the error

## Code Example

```typescript
// Public method that matches the DownloadClient interface
public async addUrl(options: AddDownloadOptions): Promise<string> {
  const result = await this._addUrl(options);
  if (isError(result)) {
    throw result.error;
  }
  return result.data;
}

// Private method that implements the actual logic with AsyncResult pattern
private async _addUrl(options: AddDownloadOptions): Promise<AsyncResult<string, Error>> {
  try {
    // Implementation with detailed error handling
    const authResult = await this.ensureAuthenticated();
    if (isError(authResult)) {
      return authResult;
    }
    
    // ... Rest of the implementation
    
    return createSuccessResult(result.data);
  } catch (error) {
    return createErrorResult(
      error instanceof Error 
        ? error 
        : this.errorFactory.generic(`Failed to add download: ${String(error)}`, 'ADD_FAILED')
    );
  }
}
```

## Benefits of This Approach

1. **Interface Compliance**: The public methods comply with the DownloadClient interface, eliminating TypeScript errors.
2. **Error Propagation**: Error details are preserved and properly propagated to the caller.
3. **Type Safety**: The AsyncResult pattern provides better type safety and error handling internally.
4. **Code Reuse**: The existing AsyncResult-based implementation is preserved and reused.
5. **Maintainability**: Changes to error handling can be made in one place without affecting the public interface.

## Methods Modified

The following methods were updated to use this pattern:

1. `addUrl`: Adds a download from a URL
2. `getStatus`: Gets the status of a download
3. `getAllItems`: Gets all downloads
4. `pauseItem`: Pauses a download
5. `resumeItem`: Resumes a download
6. `removeItem`: Removes a download

## Special Case: overridden methods

Methods overridden from the base class (`getDownloadSpeed`, `getUploadSpeed`, `pauseAll`, `resumeAll`, `getStats`) were updated to use the private AsyncResult methods directly, preserving their error handling capabilities without changing their return types.

## Testing Considerations

When testing the DelugeClient class, it's important to consider both the public API (which throws errors) and the internal AsyncResult-based implementation. Tests should verify that:

1. Successful operations return the expected values
2. Error conditions throw appropriate errors
3. Error details are preserved in the thrown errors
---
### Source: deluge-client-fix.md

Moved the following redundant files to archive:
- `src/api/downloadClients/deluge.ts` → `archive/deluge.ts.backup`
- `src/api/downloadClients/delugeJsonRpcClient.ts` → `archive/delugeJsonRpcClient.ts.backup`
- `src/api/downloadClients/delugeProxy.ts` → `archive/delugeProxy.ts.backup`
- `src/hooks/useDelugeConfig.ts` → `archive/useDelugeConfig.ts.backup`

### 2. Fixed Authentication Flow

The proper Deluge authentication flow is now implemented:

1. **auth.login** - Authenticate with password
2. **web.get_hosts** - Get available Deluge daemons
3. **web.connect** - Connect to a specific daemon

The client now tracks both authentication state (`authenticated`) and connection state (`connected`) separately.

### 3. Improved Session Management

- Session cookies are properly extracted and stored
- Cookie handling supports both `_session_id` and `session_id` formats
- Session state is reset on authentication failures
- Automatic re-authentication on session expiry

### 4. Enhanced Error Handling

- Better error messages for common issues
- Proper handling of different Deluge error codes
- Retry logic for session-related errors
- Detailed logging for debugging

## Authentication Flow Details

```typescript
// Step 1: Login with password
const loginResult = await rpcRequest('auth.login', [password], true);

// Step 2: Get available hosts
const hostsResult = await rpcRequest('web.get_hosts', [], false);

// Step 3: Connect to first available host
const hostId = extractHostId(hosts[0]);
const connectResult = await rpcRequest('web.connect', [hostId], false);
```

## Testing

Use the test script to verify the implementation:

```bash
# Set environment variables
export DELUGE_URL="http://localhost:8112"
export DELUGE_PASSWORD="your-password"

# Run the test
node scripts/test-deluge/test-deluge-client.js

# To test adding a torrent
export TEST_ADD_TORRENT=true
node scripts/test-deluge/test-deluge-client.js
```

## Usage Example

```typescript
import { createDelugeClient } from './api/downloadClients/delugeClient';

// Create client
const client = createDelugeClient({
  baseURL: 'http://localhost:8112',
  password: 'deluge',
  proxyMode: false // or true for proxy mode
});

// Test connection
const isConnected = await client.testConnection();

// Add a torrent
const torrentId = await client.addUrl({
  url: 'magnet:?xt=urn:btih:...',
  paused: false,
  destination: '/downloads/manga'
});

// Get status
const status = await client.getStatus(torrentId);

// Get all torrents
const allTorrents = await client.getAllItems();

// Clean up
client.dispose();
```

## Proxy Mode

When `proxyMode` is enabled, requests go through `/api/proxy/deluge` to avoid CORS issues. The proxy endpoint handles:
- Session cookie forwarding
- CORS headers
- Error translation
- Connection testing

## Common Issues and Solutions

### Issue: "No Deluge daemons available"
**Solution**: Ensure the Deluge daemon is running. Start it with:
```bash
deluged
```

### Issue: "Invalid password"
**Solution**: Check the Deluge WebUI configuration for the correct password.

### Issue: "Connection refused"
**Solution**: Verify the Deluge WebUI is running on the specified port:
```bash
deluge-web --port 8112
```

### Issue: Session expires frequently
**Solution**: The client now automatically re-authenticates when sessions expire.

## Architecture Compliance

The implementation follows the project's architectural patterns:
- ✅ Extends `DownloadClient` base class
- ✅ Uses `AsyncResult` pattern for error handling
- ✅ Implements contextual error handling
- ✅ Follows factory pattern with `createDelugeClient`
- ✅ Proper TypeScript typing throughout
- ✅ No use of `.fixed` file naming

---
### Source: download-clients-property-access-fixes.md


In `nzbgetClient.ts`, TypeScript errors occurred because of property access on the `HttpClientResponse<NzbgetResponse<T>>` type:

- "Property 'error' does not exist on type 'HttpClientResponse<NzbgetResponse<T>>'"
- Missing type guards for HTTP response objects
- Lack of proper validation before accessing nested properties

### 2. TransmissionClient Property Access Errors

In `transmissionClient.ts`, similar errors occurred:

- "Property 'result' does not exist on type 'HttpClientResponse<TransmissionResponse<T>>'"
- Inconsistent handling of response objects
- Lack of proper type narrowing

## Implementation Strategy

### 1. Enhanced Type Guards

We implemented robust type guards to validate the structure of response objects before accessing their properties:

```typescript
/**
 * Type guard to check if an object has the structure of a NzbgetResponse
 */
function isNzbgetResponse<T>(obj: unknown): obj is NzbgetResponse<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'jsonrpc' in obj &&
    typeof (obj as { jsonrpc: unknown }).jsonrpc === 'string' &&
    'id' in obj &&
    typeof (obj as { id: unknown }).id === 'number'
  );
}

/**
 * Type guard to check if an HTTP response contains a NzbgetResponse
 */
function isHttpClientResponseWithNzbgetResponse<T>(
  obj: unknown
): obj is HttpClientResponse<NzbgetResponse<T>> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'data' in obj &&
    isNzbgetResponse<T>((obj as { data: unknown }).data)
  );
}
```

### 2. Safe Property Access Pattern

We implemented a safe property access pattern using type guards:

```typescript
// Before (causing TypeScript error):
if (response.data.error !== undefined) {
  // Handle error
}

// After (with proper type safety):
if (
  isHttpClientResponseWithNzbgetResponse<T>(response) && 
  response.data.error !== undefined
) {
  // Handle error
}
```

### 3. Response Processing Improvements

We enhanced response processing to handle all possible states:

1. Check if the response object exists
2. Validate the response has the expected structure using type guards
3. Only access properties after validation
4. Provide meaningful error messages for each potential issue

## Benefits of the Fix

1. **Improved Type Safety**: The compiler can now verify property access is safe
2. **Better Error Handling**: More specific error messages based on what went wrong
3. **Consistent Pattern**: The same pattern is applied across all download clients
4. **Reduced Runtime Errors**: Prevents accessing properties on undefined objects
5. **Self-Documenting Code**: Type guards clarify expected response structure

## Implementation Notes

When implementing these fixes, we followed the established AsyncResult pattern consistently and ensured that all error cases return proper AsyncResult objects with meaningful error messages. This maintains compatibility with the existing error handling infrastructure.

The implementation also includes comments explaining the purpose of type guards and validation steps to make the code more maintainable.
---
### Source: transmission-client-fixes.md


This error occurred in the `directRequest` method of the `TransmissionClient` class:

```typescript
private async directRequest<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  // ...
  
  // Make the request
  const response = await this.http.post<TransmissionResponse<T>>(
    '',
    { method, arguments: params },
    { headers }
  );
  
  if (response.result !== 'success') {
    throw this.errorFactory.generic(
      `Transmission API error: ${response.result}`,
      'TRANSMISSION_API_ERROR'
    );
  }
  
  return response.arguments; // Error: Type 'unknown' is not assignable to type 'T'
}
```

### Root Cause

The error occurred because TypeScript couldn't guarantee that `response.arguments` was of type `T`. The issue is similar to the one we fixed in the nzbgetClient.ts file - TypeScript sees the value as `unknown` and doesn't allow it to be returned as a generic type `T` without proper type checking or assertions.

### Solution

Our solution focused on two improvements:

1. **Added Result Validation**: We added a check to ensure `response.arguments` is not undefined before returning it.
2. **Added Type Assertion**: We explicitly cast `response.arguments` to type `T` to assure TypeScript that the type is correct.

### Changes Made

```typescript
// Before
return response.arguments;

// After
// Safe type assertion for the result
if (response.arguments === undefined) {
  throw this.errorFactory.generic(
    'Transmission API error: Missing result arguments',
    'TRANSMISSION_API_ERROR_NO_RESULT'
  );
}

return response.arguments as T;
```

### Benefits of the Solution

1. **Improved Type Safety**: By explicitly casting to type `T`, we ensure type compatibility while maintaining TypeScript's type checking benefits.
2. **Enhanced Error Handling**: By checking for undefined results, we catch potential API errors earlier with a more descriptive error message.
3. **Consistent API Error Handling**: The solution aligns with the error handling pattern established in other client implementations.

### Testing Considerations

1. The changes maintain backward compatibility with existing code.
2. Error handling is improved with a more specific error case for missing arguments.
3. The change doesn't introduce any new runtime overhead, as the check for undefined is a simple conditional.

### Pattern Application

This fix demonstrates a common TypeScript pattern for handling API responses:

1. **Type Validation**: Check that the response has the expected structure before using it.
2. **Explicit Type Assertions**: Use type assertions only after validation to ensure type safety.
3. **Descriptive Error Messages**: Provide clear error messages for unexpected API responses.

This pattern can be applied to other client implementations in the codebase to ensure type safety when working with external APIs or unknown data structures.
---
### Source: transmission-client-consolidation.md

   - Basic error handling
   - Limited retry logic

2. **Proxy Client** (`/src/api/downloadClients/transmissionProxy.ts`)
   - Communicates through internal API proxy
   - Duplicate session handling logic
   - Inconsistent error mapping
   - No resource cleanup

### Key Issues

1. **Duplicated Logic:**
   - Both implementations contain nearly identical RPC request logic
   - Authentication flows are duplicated
   - Error handling patterns are reimplemented

2. **Inconsistent Parameters:**
   - Direct client uses different parameter naming than proxy client
   - Configuration options are inconsistent between implementations

3. **Resource Management:**
   - No proper cleanup mechanisms
   - Potential for leaked connections
   - Missing timeout handling

4. **Error Handling:**
   - Different error types between implementations
   - Inconsistent error messages
   - Missing retry logic for transient errors

## Consolidated Client Design

### New Class Structure

```typescript
// transmissionClient.ts
export class TransmissionClient {
  private baseURL: string;
  private sessionId: string | null = null;
  private auth: { username: string; password: string } | null = null;
  private proxyMode: boolean;
  private connectionStatus: ConnectionStatus = { connected: false };
  private notifyOnError: boolean;
  private disposed: boolean = false;
  
  constructor(config: TransmissionConfig) {
    // Initialize client
  }
  
  // Core RPC method
  private async makeRequest<T>(method: string, params: any = {}): Promise<T> {
    // Implement with retry logic, error handling, session management
  }
  
  // Transmission API methods
  public async getTorrents(): Promise<Torrent[]> { /*...*/ }
  public async addTorrent(torrent: AddTorrentOptions): Promise<Torrent> { /*...*/ }
  public async removeTorrent(id: number, deleteData: boolean): Promise<void> { /*...*/ }
  public async pauseTorrent(id: number): Promise<void> { /*...*/ }
  public async resumeTorrent(id: number): Promise<void> { /*...*/ }
  public async getTorrentDetails(id: number): Promise<TorrentDetails> { /*...*/ }
  
  // Connection management
  public async testConnection(): Promise<boolean> { /*...*/ }
  
  // Resource management
  public dispose(): void {
    // Clean up resources
    this.disposed = true;
  }
}
```

### Factory Function

```typescript
export function createTransmissionClient(config: TransmissionConfig): TransmissionClient {
  return new TransmissionClient(config);
}
```

### Configuration Interface

```typescript
export interface TransmissionConfig {
  baseURL: string;
  username?: string;
  password?: string;
  timeout?: number;
  proxyMode?: boolean;
  notifyOnError?: boolean;
  retryCount?: number;
}
```

### Error Types

```typescript
export class TransmissionError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'TransmissionError';
  }
}

export class TransmissionAuthError extends TransmissionError {
  constructor(message: string) {
    super(message);
    this.name = 'TransmissionAuthError';
  }
}

export class TransmissionConnectionError extends TransmissionError {
  constructor(message: string) {
    super(message);
    this.name = 'TransmissionConnectionError';
  }
}
```

## Implementation Details

### Session Management

- Automatic session ID tracking
- Handles 409 responses with session ID renewal
- Caches session ID for better performance
- Properly cleans up session on dispose

### Authentication

- Supports both basic auth and session-based auth
- Automatically handles auth failures
- Secure credential management

### Error Handling

- Typed errors for different failure scenarios
- Detailed error messages with context
- Automatic retry for transient failures
- Exponential backoff for rate limiting

### Proxy Support

- Seamless support for both direct and proxied communication
- Automatic detection of required proxy parameters
- Consistent interface regardless of connection mode

### Resource Management

- Proper connection disposal
- Timeout handling to prevent hanging requests
- Request abortion for long-running operations

## Migration Plan

### Phase 1: Implement Consolidated Client

1. Create new `transmissionClient.ts` file
2. Implement core functionality based on best parts of both implementations
3. Add comprehensive error handling and resource management
4. Write unit tests for the new client

### Phase 2: Update Components

1. Identify all components using either implementation:
   - `src/components/settings/downloadClients/TransmissionSettings.tsx`
   - `src/components/downloads/TransmissionDownloadManager.tsx`
   - `src/pages/api/proxy/transmission.ts`
   - `src/hooks/useDownload.ts`

2. Update each component to use the new client
3. Verify functionality with integration tests

### Phase 3: Cleanup

1. After successful migration, remove old implementations
2. Update documentation to reference only the new client
3. Add examples to developer documentation

## Benefits

1. **Unified Implementation:** Single source of truth for Transmission communication
2. **Better Error Handling:** Consistent, typed errors with retry logic
3. **Resource Management:** Proper cleanup to prevent leaks
4. **Performance:** Optimized session handling and connection pooling
5. **Developer Experience:** Clear, consistent API for Transmission operations
---
### Source: prowlarr-client-migration.md


- `ProwlarrApi` in `src/api/prowlarrApi.ts`
- `ProwlarrApiClient` in `src/api/prowlarrApiClient.ts`
- Direct fetch calls in `src/contexts/ProwlarrContext.tsx`
- Helper functions in `src/utils/prowlarr-utils.ts`
- `ProwlarrApiProxy` in `src/api/prowlarrApiProxy.ts`

This led to inconsistent error handling, parameter naming confusion ('path' vs 'endpoint'), and different approaches to resource management.

## Consolidated Implementation

We have created a new unified client implementation:

- **Location**: `src/api/prowlarrClient.ts`
- **Class**: `ProwlarrClient`
- **Factory Function**: `createProwlarrClient(config)`

### Key Features

1. **Robust Error Handling**:
   - Custom error types with clear messages
   - Consistent error format across components
   - Proper error forwarding with context preservation

2. **Resource Management**:
   - Proper cleanup via `dispose()` method
   - Prevents memory leaks with timeout and request cancellation
   - Automatic resource cleanup for single-use operations

3. **Connection Monitoring**:
   - Real-time connection status tracking
   - Automatic reconnection capabilities
   - Connection status event propagation

4. **Retry Logic**:
   - Exponential backoff for transient errors
   - Configurable retry counts and timeouts
   - Detailed retry attempt logging

5. **Comprehensive API Methods**:
   - Complete coverage of all Prowlarr API endpoints
   - Consistent parameter naming and structure
   - Type-safe return values

## Migration Guide

### Using the New Client

```typescript
import { createProwlarrClient } from '@/api/prowlarrClient';

// Create client instance
const client = createProwlarrClient({
  baseURL: 'http://your-prowlarr-instance:9696',
  apiKey: 'your-api-key',
  notifyOnError: false // Set to true to show notifications on errors
});

// Use the client
try {
  // Test connection
  const isConnected = await client.testConnection();
  
  // Get indexers
  const indexers = await client.getIndexers();
  
  // Search using specific categories
  const results = await client.search('manga title', [categoryId1, categoryId2]);
  
  // Always clean up when done
  client.dispose();
} catch (error) {
  console.error('Prowlarr API error:', error);
}
```

### Resource Management

Always dispose of the client when finished:

```typescript
// Good practice: Create, use, and dispose in the same block
const client = createProwlarrClient(config);
try {
  await client.someOperation();
} finally {
  client.dispose();
}
```

For components, use useRef and useEffect:

```typescript
function MyComponent() {
  const clientRef = useRef<ProwlarrClient | null>(null);
  
  useEffect(() => {
    // Initialize client
    clientRef.current = createProwlarrClient(config);
    
    // Clean up on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.dispose();
        clientRef.current = null;
      }
    };
  }, []);
}
```

## Complete Migration

To ensure consistency and maintainability, we've completely removed the legacy implementations:

- `src/api/prowlarrApi.ts` (removed)
- `src/api/prowlarrApiClient.ts` (removed)
- `src/utils/prowlarr-utils.ts` (removed)
- `src/api/prowlarrApiProxy.ts` (removed)

All components now use the new consolidated client directly. This eliminates any confusion about which implementation to use and ensures consistent behavior across the application.

## Components Updated

The following components have been updated to use the new consolidated client:

- `ProwlarrContext.tsx`
- `ProwlarrTest.tsx`
- `ProwlarrStatus.tsx` 
- `ProwlarrConfig.tsx`
- `ProwlarrIntegration.tsx`
- `IndexerList.tsx`
- `ProwlarrIndexerList.tsx`
- `ProwlarrSearchProvider.ts`

## Benefits of Migration

1. **Consistency**: All components now use the same parameter names and error handling patterns
2. **Maintainability**: Single implementation to update when Prowlarr API changes
3. **Reliability**: Improved error handling and automatic retries
4. **Performance**: Better resource management prevents memory leaks
5. **Type Safety**: Consistent TypeScript interfaces across the application

## Recommendations

1. Use `createProwlarrClient()` for all Prowlarr API interactions
2. Always call `client.dispose()` when finished with the client
3. Handle errors explicitly using try/catch blocks
4. For React components, store clients in refs and clean up in useEffect
5. Use the client's built-in status monitoring for connection display

## Next Steps

1. Add comprehensive tests for the consolidated client
2. Consider similar consolidation for other API clients in the application
3. Add more detailed error handling documentation for common error cases
4. Consider adding logging for API interactions for debugging purposes
---
### Source: download-client-settings-fix.md


**Solution**: Updated the migration method to include all download client settings:
- Transmission: enabled, baseURL, apiKey
- Deluge: enabled, baseURL, password
- SABnzbd: enabled, baseURL, apiKey
- NZBGet: enabled, baseURL, username, password
- Download preferences: preferredTorrentClient, preferredUsenetClient, autoSelectClient

### 2. ✅ **Key Naming Mismatch** (HIGH PRIORITY)
**Problem**: Different parts of the application used inconsistent key naming conventions:
- Settings Model: `transmissionEnabled`
- Config Service: `download.transmission.enabled`
- Hooks: `transmission.enabled`

**Solution**: Standardized all hooks to use the correct namespace `download.` prefix:
- Updated `useTransmissionConfig.ts` to use `download.transmission.*` keys
- Replaced localStorage-based `useDelugeConfig.ts` with config service implementation using `download.deluge.*` keys
- Created new hooks for SABnzbd and NZBGet using consistent key patterns

### 3. ✅ **Missing Default Values** (MEDIUM PRIORITY)
**Problem**: Download client defaults weren't set in the main config service's `setupDefaultConfig()` method.

**Solution**: Added comprehensive default configurations for all download clients in `configService.ts`:
- All download client enabled/disabled states
- Default URLs for each service
- Empty strings for credentials
- Default categories/labels for organization

### 4. ✅ **Authentication Handling & Category Support** (LOW PRIORITY)
**Problems**: 
- Transmission didn't support username field for basic auth
- Missing category/label fields for organizing downloads

**Solution**: Enhanced configuration interfaces and implementations:
- Added `username` field to `TransmissionConfig`
- Added `label` field to `DelugeConfig`
- Added `category` fields to `SabnzbdConfig` and `NzbgetConfig`
- Updated all related services, hooks, and default configurations
- Set default categories/labels to "manga" for consistency

## Files Modified

### Server-Side:
1. `/src/server/services/config/configService.ts`
   - Added download client migration logic
   - Added default configurations for all download clients
   - Added category/label defaults in migration

2. `/src/server/services/downloadClient/configService.ts`
   - Enhanced interfaces with username and category fields
   - Updated default configurations
   - Added support for new fields in load and update methods

### Client-Side Hooks:
1. `/src/hooks/useTransmissionConfig.ts`
   - Fixed key namespace to use `download.transmission.*`
   - Added username field support

2. `/src/hooks/useDelugeConfig.ts`
   - Replaced localStorage implementation with config service
   - Fixed key namespace to use `download.deluge.*`
   - Added label field support

3. `/src/hooks/useSabnzbdConfig.ts` (NEW)
   - Created new hook for SABnzbd configuration
   - Uses correct `download.sabnzbd.*` namespace
   - Includes category field support

4. `/src/hooks/useNzbgetConfig.ts` (NEW)
   - Created new hook for NZBGet configuration
   - Uses correct `download.nzbget.*` namespace
   - Includes category field support

## Configuration Key Reference

### Transmission
- `download.transmission.enabled` (boolean)
- `download.transmission.baseURL` (string)
- `download.transmission.apiKey` (string)
- `download.transmission.username` (string)

### Deluge
- `download.deluge.enabled` (boolean)
- `download.deluge.baseURL` (string)
- `download.deluge.password` (string)
- `download.deluge.label` (string)

### SABnzbd
- `download.sabnzbd.enabled` (boolean)
- `download.sabnzbd.baseURL` (string)
- `download.sabnzbd.apiKey` (string)
- `download.sabnzbd.category` (string)

### NZBGet
- `download.nzbget.enabled` (boolean)
- `download.nzbget.baseURL` (string)
- `download.nzbget.username` (string)
- `download.nzbget.password` (string)
- `download.nzbget.category` (string)

### Preferences
- `download.preferences.preferredTorrentClient` (string)
- `download.preferences.preferredUsenetClient` (string)
- `download.preferences.autoSelectClient` (boolean)

## Testing Recommendations

1. **Migration Testing**:
   - Create a database with legacy Settings data
   - Run the application and verify all download client settings migrate correctly
   - Check that the Config table contains all expected entries

2. **UI Testing**:
   - Test each download client configuration form
   - Verify that settings save and load correctly
   - Check that category/label fields appear and function properly

3. **Integration Testing**:
   - Test that download clients can connect with the configured settings
   - Verify that categories/labels are properly applied to downloads

## Future Enhancements

1. **Connection Testing**: Add "Test Connection" buttons for each download client
2. **Advanced Authentication**: Support for more authentication methods (OAuth, certificates)
3. **Profile Management**: Allow multiple configurations per download client
4. **Import/Export**: Add ability to export/import download client configurations

## Conclusion

All critical issues identified in the audit report have been successfully addressed. The download client configuration system now properly migrates legacy settings, uses consistent key naming, includes all necessary default values, and supports enhanced authentication and organization features.

---
### Source: download-client-troubleshooting.md

   - Default Deluge WebUI password is `deluge`
   - Check if you've changed it in Deluge preferences
   - Try resetting to default by editing `~/.config/deluge/web.conf`

2. **WebUI Not Enabled**
   - Make sure Deluge WebUI is running
   - Default port is 8112
   - Check with: `curl http://your-server:8112` - should return HTML

3. **Remote Connection Issues**
   - By default, Deluge WebUI only accepts localhost connections
   - To enable remote access:
     ```bash
     # Stop deluge
     sudo systemctl stop deluged deluge-web
     
     # Edit config
     nano ~/.config/deluge/web.conf
     
     # Find and change:
     "https": false,
     "interface": "0.0.0.0",  # Change from 127.0.0.1
     
     # Restart
     sudo systemctl start deluged deluge-web
     ```

4. **Firewall Blocking**
   - Ensure port 8112 is open
   ```bash
   sudo ufw allow 8112/tcp
   ```

### Testing Deluge Connection

Test directly with curl:
```bash
# Test basic connectivity
curl -I http://your-server:8112

# Test JSON-RPC endpoint
curl -X POST http://your-server:8112/json \
  -H "Content-Type: application/json" \
  -d '{"method":"auth.login","params":["deluge"],"id":1}'
```

## NZBGet Response Format Error

**Error**: `[NzbgetClient] Error during proxyRequest: Invalid response format: expected an object`

### Common Causes and Solutions:

1. **Incorrect URL Format**
   - Make sure URL does NOT include `/jsonrpc`
   - Correct: `http://your-server:6789`
   - Wrong: `http://your-server:6789/jsonrpc`

2. **Wrong Port or Service**
   - Default NZBGet port is 6789
   - Verify NZBGet is running: `sudo systemctl status nzbget`

3. **Authentication Issues**
   - Default credentials: username `nzbget`, password `tegbzn6789`
   - Check `nzbget.conf` for custom credentials

4. **Web Interface vs API**
   - The error suggests you might be hitting the web interface instead of the API
   - Test the API endpoint:
     ```bash
     curl -u nzbget:tegbzn6789 \
       -X POST http://your-server:6789/jsonrpc \
       -H "Content-Type: application/json" \
       -d '{"method":"status","params":[],"id":1}'
     ```

### Testing NZBGet Connection

```bash
# Test basic connectivity
curl -I http://your-server:6789

# Test JSON-RPC with authentication
curl -u nzbget:tegbzn6789 \
  -X POST http://your-server:6789/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"method":"version","params":[],"id":1}'
```

## General Troubleshooting Steps

1. **Verify Services Are Running**
   ```bash
   # Deluge
   sudo systemctl status deluged deluge-web
   
   # NZBGet
   sudo systemctl status nzbget
   ```

2. **Check Logs**
   ```bash
   # Deluge logs
   journalctl -u deluge-web -f
   
   # NZBGet logs
   tail -f /var/log/nzbget.log
   # or
   journalctl -u nzbget -f
   ```

3. **Network Connectivity**
   ```bash
   # From Kaizoku server to download client
   ping your-download-server
   telnet your-download-server 8112  # Deluge
   telnet your-download-server 6789  # NZBGet
   ```

4. **Firewall Rules**
   ```bash
   # Check if ports are open
   sudo ufw status
   
   # Open ports if needed
   sudo ufw allow 8112/tcp  # Deluge
   sudo ufw allow 6789/tcp  # NZBGet
   ```

## Configuration Tips

### Deluge Configuration
1. Enable "Allow Remote Connections" in Preferences → Interface
2. Set a strong password in Preferences → Interface → Password
3. Consider using a reverse proxy for HTTPS

### NZBGet Configuration
1. Edit `/etc/nzbget.conf` or `~/.nzbget`
2. Set `ControlIP=0.0.0.0` to allow remote connections
3. Change default username/password for security

## Still Having Issues?

1. **Enable Debug Logging**
   - In Kaizoku logs, check for detailed error messages
   - Enable verbose logging in download clients

2. **Test From Command Line First**
   - Use the curl commands above to verify basic connectivity
   - If curl works but Kaizoku doesn't, it's a configuration issue

3. **Check Docker Networking**
   - If using Docker, ensure containers can communicate
   - Use container names instead of localhost
   - Example: `http://deluge:8112` instead of `http://localhost:8112`

---
### Source: download-clients-adapter-fixes.md


The following interfaces were moved from inside the class to outside the class:

- `RpcRequestParams`: Basic parameters type for RPC requests
- `TransmissionAddParams`: Parameters for adding torrents 
- `RpcRequestPayload`: Structure for RPC request payloads
- `ProxyRequestConfig`: Configuration for proxy requests

### 1.2 Type Safety Improvements

- Added `extends Record<string, unknown>` to `ProxyRequestConfig` to fix type compatibility with expected parameters type
- Added explicit type assertion for response arguments: `return response.arguments as T` to fix type safety error

## 2. AnilistAdapter.ts Fixes

### 2.1 Property Assignment Error

Fixed the "Object literal may only specify known properties" error by removing the non-compliant property:

- Removed `anilistSource: manga.source` from the MangaSearchResult object since that property doesn't exist in the interface

## 3. AnilistClient.ts Fixes

### 3.1 Import Corrections

- Fixed incorrect import path for utility functions:
  ```typescript
  // Before
  import { createCache, Cache, createRateLimiter, RateLimiter } from '../../../types/shared-types';
  
  // After
  import { createCache } from '../utils/caching';
  import { createRateLimiter } from '../utils/rateLimit';
  import type { Cache } from '../utils/caching';
  import type { RateLimiter } from '../utils/rateLimit';
  ```

### 3.2 Type Parameter Usage

- Fixed incorrect type parameter usage on the Cache.get method:
  ```typescript
  // Before
  const cachedData = this.graphqlCache.get<T>(cacheKey);
  
  // After
  const cachedData = this.graphqlCache.get(cacheKey) as T | undefined;
  ```

## Summary of Benefits

These fixes improve the code in several ways:

1. **Better Type Safety**: Ensuring proper type assertions and interface usage helps catch potential runtime errors at compile time
2. **Improved Code Organization**: Moving interfaces outside classes follows best practices for TypeScript organization
3. **Proper Module Dependencies**: Correcting import paths ensures the code is using the right dependencies
4. **API Compliance**: Ensuring objects only contain properties defined in their interfaces maintains consistency

The remaining TypeScript errors are related to dependencies and configuration issues not directly related to the core application code:
- Third-party type definition issues in node_modules (`@types/request` package)
- TypeScript configuration related to Map iterators (would require target ES2015+ or downlevelIteration)
---
### Source: download-clients-consolidation.md

   - `/src/api/downloadClients/nzbgetClient.ts`
   - `/src/api/downloadClients/nzbgetClient.fixed.ts`
   - `/src/api/downloadClients/nzbgetClient.updated.ts`
   - `/src/api/downloadClients/transmissionClient.ts`
   - `/src/api/downloadClients/transmissionClient.fixed.ts`

2. Compared implementations for:
   - AsyncResult pattern implementation
   - Error handling
   - Type safety
   - Documentation
   - Adherence to project patterns and conventions

## NzbgetClient Analysis

### nzbgetClient.ts
- Implements AsyncResult pattern consistently throughout the code
- Uses the AsyncResult wrapper pattern (private `_methodName` methods with public unwrapping methods)
- Has comprehensive error handling with proper type guards
- Contains detailed JSDoc documentation
- Includes proper null/undefined checks
- Uses nullish coalescing (`??`) properly for defaults

### nzbgetClient.fixed.ts
- Also implements AsyncResult pattern, but has some inconsistencies
- Uses `rpcRequest` function that doesn't fully implement AsyncResult pattern
- Error handling is mostly consistent but less comprehensive in some places
- Documentation is equivalent to the non-fixed version
- Missing some of the more robust error handling in specific methods

### nzbgetClient.updated.ts
- Nearly identical to nzbgetClient.fixed.ts
- Contains a few minor improvements in error handling
- Uses better type safety in some of the AsyncResult type conversions
- Has all the same methods and patterns as nzbgetClient.fixed.ts

## TransmissionClient Analysis

### transmissionClient.ts
- Implements AsyncResult pattern consistently throughout the code
- Uses the AsyncResult wrapper pattern (private `_methodName` methods with public unwrapping methods)
- Has comprehensive error handling with proper type guards
- Contains detailed JSDoc documentation
- Properly handles the Transmission session ID workflow
- Uses type-safe error handling with proper error factories

### transmissionClient.fixed.ts
- Only partially implements AsyncResult pattern
- Uses direct calls (no AsyncResult wrapper) for most public methods
- Has less robust error handling in places
- Missing private methods that return AsyncResult types
- Contains most of the same functionality but with less type safety

## Findings and Recommendations

### NzbgetClient
- **Canonical version**: `nzbgetClient.ts`
- **Reason**: It most consistently implements the AsyncResult pattern, has the most comprehensive error handling, and has the best type safety.

### TransmissionClient
- **Canonical version**: `transmissionClient.ts`
- **Reason**: It fully implements the AsyncResult pattern with proper wrapper methods, has better error handling than the fixed version, and follows the project's architectural patterns.

## Implementation Plan

1. Keep `nzbgetClient.ts` as the canonical version
2. Keep `transmissionClient.ts` as the canonical version
3. Remove the duplicate files:
   - `nzbgetClient.fixed.ts`
   - `nzbgetClient.updated.ts`
   - `transmissionClient.fixed.ts`
4. Document the consolidation process

## Conclusion

Both canonical versions fully implement the AsyncResult pattern, have proper error handling, and follow the project's architectural guidelines. The "fixed" versions appear to be intermediate steps in the development process that don't fully implement the desired patterns.
---
### Source: download-clients-integration-summary.md


#### Test Endpoints (Created)
- `/api/download-clients/transmission/test.ts` - Tests Transmission connections
- `/api/download-clients/deluge/test.ts` - Tests Deluge connections  
- `/api/download-clients/nzbget/test.ts` - Tests NZBGet connections
- `/api/download-clients/sabnzbd/test.ts` - Tests SABnzbd connections
- `/api/download-clients/test.ts` - Unified test endpoint for all clients

#### Proxy Endpoints (Created/Existing)
- `/api/proxy/transmission.ts` - Existing Transmission RPC proxy
- `/api/proxy/deluge.ts` - Existing Deluge JSON-RPC proxy
- `/api/proxy/nzbget.ts` - Created NZBGet JSON-RPC proxy
- `/api/proxy/sabnzbd.ts` - Created SABnzbd API proxy
- `/api/proxy/download-client.ts` - Existing generic proxy (legacy)

### 2. Frontend Components

#### Updated Components
- `DownloadDashboard.tsx` - Updated to use `proxyMode: true` when creating clients
- `ClientSettings.tsx` - Existing settings components now work with new endpoints

#### New Components
- `DownloadClientTester.tsx` - Comprehensive testing component for all clients
- `/pages/settings/download-clients-test.tsx` - Test page for easy debugging

### 3. Client Factory Updates
- `src/api/downloadClients/index.ts` - Updated `createClient` function to accept `proxyMode` parameter

## How It Works

### Connection Testing Flow
1. Frontend component makes POST request to `/api/download-clients/[client]/test`
2. Test endpoint creates a download client instance with `proxyMode: true`
3. Client's `testConnection()` method is called
4. Connection status is returned to frontend
5. Client instance is properly disposed

### Proxy Communication Flow
1. Download client classes check for `proxyMode` flag
2. When `proxyMode: true`, requests go through `/api/proxy/[client]` endpoints
3. Proxy endpoints handle authentication, session management, and CORS
4. Results are passed back through the proxy to the client

## Key Features

### Security
- All credentials are passed through request body, not stored in code
- Proxy endpoints handle authentication securely
- Session management for Deluge
- API key validation for SABnzbd and Transmission

### Error Handling
- User-friendly error messages
- Connection timeout protection (10 seconds)
- Detailed logging for debugging
- Standardized error response format

### Resource Management
- Client instances are properly disposed after use
- No memory leaks from hanging connections
- Efficient session reuse for Deluge

## Testing

### Manual Testing
1. Navigate to `/settings/download-clients-test`
2. Click "Run All Tests" to test all endpoints
3. Review detailed results for each test

### Expected Results
- Connection tests should return success/failure with details
- Proxy RPC calls should return valid responses
- All clients should work through their respective proxy endpoints

## Configuration Examples

### Transmission
```json
{
  "baseURL": "http://localhost:9091",
  "apiKey": "username:password"
}
```

### Deluge
```json
{
  "baseURL": "http://localhost:8112",
  "password": "deluge"
}
```

### NZBGet
```json
{
  "baseURL": "http://localhost:6789",
  "username": "nzbget",
  "password": "tegbzn6789"
}
```

### SABnzbd
```json
{
  "baseURL": "http://localhost:8080",
  "apiKey": "your-api-key"
}
```

## Troubleshooting

### Connection Refused
- Verify the download client is running
- Check the base URL is correct
- Ensure the port is accessible

### Authentication Failed
- Verify credentials are correct
- For Transmission: use "username:password" format
- For SABnzbd: check API key in client settings

### Timeout Errors
- Check network connectivity
- Verify firewall settings
- Ensure client is responsive

## Next Steps

1. **Integration with Download Queue**: Connect the download queue store with actual download operations
2. **Progress Tracking**: Implement real-time progress updates
3. **Error Recovery**: Add retry logic for failed downloads
4. **Batch Operations**: Support multiple simultaneous downloads
5. **Statistics**: Add download statistics and history tracking

## Code Quality

- All endpoints include TypeScript types
- Comprehensive error handling
- Resource cleanup implemented
- Follows project architectural patterns
- Uses AsyncResult pattern consistently
- Proper logging for debugging

The download client integration is now fully functional and ready for use!

---
### Source: download-clients-fixes-next-steps.md

   - Implemented AsyncResult Wrapper Pattern
   - Fixed abstract method implementation mismatches
   - Created documentation in deluge-client-fixes.md

2. ❌ **TransmissionClient** (src/api/downloadClients/transmissionClient.ts)
   - Needs AsyncResult Wrapper Pattern implementation
   - Needs to fix abstract method implementation mismatches

3. ❌ **NzbgetClient** (src/api/downloadClients/nzbgetClient.ts)
   - Needs AsyncResult Wrapper Pattern implementation
   - Needs to fix abstract method implementation mismatches

## Implementation Plan

### 1. TransmissionClient Fixes

1. **Method Signature Fixes**:
   - Check for methods that should return direct values but are returning AsyncResult
   - Apply AsyncResult Wrapper Pattern to each
   - Focus on abstract methods from DownloadClient: 
     - addUrl
     - getStatus
     - getAllItems
     - pauseItem
     - resumeItem
     - removeItem
     - testConnection
     - ping

2. **Implementation Approach**:
   - Create private `_methodName` methods that return AsyncResult types
   - Implement public methods that unwrap results or throw errors
   - Use type guards (isSuccess, isError) for result handling

### 2. NzbgetClient Fixes

1. **Method Signature Fixes**:
   - Similar to TransmissionClient
   - Check each abstract method implementation for return type compatibility

2. **Implementation Approach**:
   - Apply AsyncResult Wrapper Pattern consistently
   - Ensure error propagation is handled correctly
   - Fix any type issues in API response handling

## Common Fixes Across All Clients

1. **Type Narrowing**:
   - Use explicit type guards for all unknown types
   - Add proper type assertions with intermediate unknown steps

2. **Error Handling**:
   - Ensure consistent error transformation
   - Use instanceof checks for Error types
   - Provide clear error messages with context

3. **Interface Types**:
   - Add index signatures to interfaces where needed
   - Use specific types instead of any
   - Make sure array operations have proper type guards

## Testing Approach

1. **Type Checking**:
   - Run npm run type-check after each file fix
   - Ensure no new errors are introduced

2. **Integration Testing**:
   - If possible, test with actual download clients
   - Verify operations still work as expected

## Success Criteria

1. All TypeScript errors in download client files are resolved
2. No implementation or runtime behavior changes
3. Proper interface compliance with abstract DownloadClient class
4. Consistent implementation pattern across all clients
5. Comprehensive documentation of fixes and patterns used

## Timeline

1. TransmissionClient: Target completion by [date]
2. NzbgetClient: Target completion by [date]
3. Documentation & final testing: Target completion by [date]
---
### Source: download-clients-fixes.md

2. **TransmissionClient** (`src/api/downloadClients/transmissionClient.ts`)

## AsyncResult Pattern Implementation

The primary goal of these changes was to implement the AsyncResult pattern consistently across both clients. This pattern helps ensure robust error handling and provides better type safety.

### Key Changes

1. **Private Implementation Methods**
   - Added private methods prefixed with `_` that return `AsyncResult<T, Error>` types
   - These methods handle error cases and create proper `AsyncResult` objects
   - Example: `_addUrl()`, `_getStatus()`, `_rpcRequest()`

2. **Public Interface Methods**
   - Public methods now unwrap AsyncResult objects returned from private methods
   - They handle all possible states: success, error, and unknown
   - Example pattern:
     ```typescript
     public async method(): Promise<ReturnType> {
       const result = await this._method();
       if (isError(result)) {
         throw result.error;
       }
       if (isSuccess(result)) {
         return result.data;
       }
       throw new Error('Failed to execute method');
     }
     ```

3. **Error Handling Improvements**
   - Added proper type guards for all error cases
   - Improved error messages with context about the failing operation
   - Used type narrowing to ensure error objects are properly handled

4. **Type Safety Enhancements**
   - Added explicit type annotations for all method parameters and return types
   - Implemented proper nullish coalescing (`??`) for defaults instead of logical OR (`||`)
   - Added type guards for handling API responses

## NzbgetClient Specific Changes

The NzbgetClient class was updated to:

1. Use the AsyncResult pattern for all API methods
2. Implement proper error handling with type guards
3. Return typed AsyncResult objects from private methods
4. Safely handle null/undefined values

Example implementation:

```typescript
/**
 * Adds a download from a URL
 * 
 * @param options - Download options
 * @returns Promise that resolves to the download ID
 */
public async addUrl(options: AddDownloadOptions): Promise<string> {
  const result = await this._addUrl(options);
  if (isError(result)) {
    throw result.error;
  }
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error('Failed to add URL to NZBGet');
}

/**
 * Private implementation of addUrl using AsyncResult pattern
 * 
 * @param options - Download options
 * @returns Promise that resolves to AsyncResult with download ID
 */
private async _addUrl(options: AddDownloadOptions): Promise<AsyncResult<string, Error>> {
  try {
    // Implementation...
    return createSuccessResult(result.toString());
  } catch (error) {
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to add download: ${String(error)}`)
    );
  }
}
```

## TransmissionClient Specific Changes

The TransmissionClient class was updated to:

1. Use the AsyncResult pattern for all API methods
2. Implement proper session ID handling with error retry logic
3. Improve error handling for both direct and proxy API requests
4. Add type safety for response processing

Example implementation:

```typescript
/**
 * Gets the status of a download
 * 
 * @param id - Download ID
 * @param options - Status options
 * @returns Promise that resolves to the download item
 */
public async getStatus(id: string, options?: GetStatusOptions): Promise<DownloadItem> {
  const result = await this._getStatus(id, options);
  if (isError(result)) {
    throw result.error;
  }
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`Failed to get status for torrent with ID ${id}`);
}

/**
 * Private implementation of getStatus using AsyncResult pattern
 * 
 * @param id - Download ID
 * @param options - Status options
 * @returns Promise that resolves to AsyncResult with download item
 */
private async _getStatus(id: string, options?: GetStatusOptions): Promise<AsyncResult<DownloadItem, Error>> {
  try {
    // Implementation...
    return createSuccessResult(this.convertTorrentToDownloadItem(torrent));
  } catch (error) {
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to get torrent status: ${String(error)}`)
    );
  }
}
```

## Benefits of These Changes

1. **Type Safety**: All async operations now have proper type definitions
2. **Error Handling**: Consistent error handling pattern throughout the code
3. **Maintainability**: Clear distinction between implementation and interface methods
4. **Reliability**: Better handling of edge cases and error states
5. **Consistency**: Common approach across both download client implementations

## Future Work

For further improvements, the following could be considered:

1. Apply the same pattern to other client implementations in the codebase
2. Add unit tests to verify error handling and edge cases
3. Consider extracting common patterns into utility functions
4. Update documentation to reflect the new error handling patterns
---
### Source: deluge-client-fix-plan.md


1. **Method Signature Mismatches**:
   - `testConnection` and `ping` methods have return type mismatches with the base class
   - Missing override modifiers on methods that override base class methods

2. **Property Access on AsyncResult**:
   - Accessing `.data` on AsyncResult objects without proper type narrowing
   - Example: `Property 'data' does not exist on type '{ status: "idle"; }'`

3. **Type Conversions**:
   - Improper type handling when converting between different data structures
   - Example: `Argument of type 'unknown' is not assignable to parameter of type 'DelugeTorrentStatus'`

## Fixing Strategy

We'll address these errors using the same AsyncResult wrapper pattern that has been successfully applied to other parts of the codebase:

### 1. Method Signature Fixes

For methods with signature mismatches:

```typescript
// Before (error)
public testConnection(): Promise<AsyncResult<boolean, Error>> {
  // Implementation
}

// After
public override testConnection(): Promise<boolean> {
  const result = await this._testConnection();
  if (isSuccess(result)) {
    return result.data;
  }
  throw result.error || new Error('Unknown error in testConnection');
}

// Private AsyncResult implementation
private async _testConnection(): Promise<AsyncResult<boolean, Error>> {
  // Implementation with robust error handling
}
```

### 2. Property Access Fixes

For AsyncResult property access issues:

```typescript
// Before (error)
const status = result.data;  // Error if result is idle/loading

// After
if (isSuccess(result)) {
  const status = result.data;  // Type-safe access
} else if (isError(result)) {
  throw result.error;
} else {
  throw new Error('Operation not completed');
}
```

### 3. Type Conversion Fixes

For type conversion issues:

```typescript
// Before (error)
const torrentStatus = torrentStatuses[torrentId] as unknown;

// After
if (typeof torrentStatuses[torrentId] === 'object' && 
    torrentStatuses[torrentId] !== null) {
  const torrentStatus = torrentStatuses[torrentId] as DelugeTorrentStatus;
}
```

## Implementation Plan

1. **Add Missing Imports**:
   - Ensure all AsyncResult type guards are imported: `isSuccess`, `isError`, `isLoading`, `isIdle`

2. **Implement Wrapper Pattern**:
   - Create private `_methodName` versions of all methods returning AsyncResult
   - Implement public wrapper methods that match the interface requirements

3. **Fix testConnection and ping Methods**:
   - Implement the AsyncResult wrapper pattern for these methods
   - Add proper override modifiers

4. **Fix Property Access**:
   - Add proper type narrowing with isSuccess/isError checks before accessing .data
   - Add fallback error handling for non-success states

5. **Fix Type Conversions**:
   - Implement proper type guards for DelugeTorrentStatus and other complex types
   - Use type-safe assertions with proper runtime checks

6. **Documentation**:
   - Add explanatory comments for the wrapper pattern
   - Document error handling approach

## Expected Outcome

After implementing these fixes, the delugeClient.ts file should:

1. Have no TypeScript errors
2. Maintain compatibility with the DownloadClient abstract class
3. Preserve the robust error handling of the original implementation
4. Provide type safety for all operations
5. Follow the established AsyncResult wrapper pattern

## Benefits

1. **Type Safety**: Eliminate runtime errors from improper property access
2. **Consistency**: Follow the same patterns used throughout the codebase
3. **Maintainability**: Make the code easier to understand and modify
4. **Error Handling**: Provide clear, consistent error messages
5. **Interface Compliance**: Ensure proper implementation of the abstract base class

This approach ensures we can fix the TypeScript errors while preserving the existing functionality and improving the overall quality of the code.
---
### Source: download-client-test-fix.md


### 1. Removed Duplicate Test Page
- Moved `/src/pages/settings/download-clients-test.tsx` to `.archive/removed-duplicate-pages/`
- Moved `/src/components/settings/downloadClients/DownloadClientTester.tsx` to `.archive/removed-duplicate-pages/`
- These components were using hardcoded localhost values and duplicated existing functionality

### 2. Updated Main Download Clients Page
- Removed the alert box linking to the duplicate test page
- Updated help text to mention that each client has its own test button
- Removed unused `Alert` import

### 3. Existing Test Implementation Works Correctly
The test connection buttons in the individual client settings (Transmission, Deluge, NZBGet, SABnzbd) are working correctly:
- They use the actual configured values from the database via hooks (useDelugeConfig, useNZBGetConfig, etc.)
- They send these values to the test endpoints at `/api/download-clients/[client]/test`
- The test endpoints use the passed configuration, not hardcoded values

## How Test Connection Works Now

1. User enters their download client settings (URL, password/API key, etc.)
2. User clicks "Test Connection" button for that specific client
3. The component sends the entered values to the test endpoint
4. The test endpoint creates a client instance with those values and tests the connection
5. Result is displayed to the user

## No Code Changes Needed for Host Configuration
The test connections already use the URLs configured by the user, not localhost. The hooks (useDelugeConfig, etc.) pull the actual configuration from the database, so if you've configured your download clients with your remote server URLs, those are what will be tested.

## Example Configuration
If you have Deluge on a remote server:
- Set Deluge URL to: `http://your-server-ip:8112`
- Enter your password
- Click "Test Connection" - it will test against your actual server, not localhost

The hardcoded localhost values were only in the duplicate test page that has been removed.

## Build Error Fixed
Fixed a TypeScript build error where the removed DownloadClientTester component was still being exported from the index.ts file. The export has been removed and the build now completes successfully.

---
### Source: transmission-client-asyncresult-pattern.md

2. The private method returns an AsyncResult type that explicitly captures both success and error states.
3. The public method calls the private method and unwraps the AsyncResult, throwing an error if needed to maintain the interface contract.

## Implementation Details

### AsyncResult Pattern

The AsyncResult pattern uses a discriminated union type:

```typescript
type AsyncResult<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };
```

With helper type guards:

```typescript
function isSuccess<T, E>(result: AsyncResult<T, E>): result is { status: 'success'; data: T } {
  return result.status === 'success';
}

function isError<T, E>(result: AsyncResult<T, E>): result is { status: 'error'; error: E } {
  return result.status === 'error';
}
```

### Method Pair Example

For each public method defined in the abstract DownloadClient class, we've created a private implementation that returns an AsyncResult:

```typescript
// Public method that matches the abstract class signature
public async addUrl(options: AddDownloadOptions): Promise<string> {
  const result = await this._addUrl(options);
  if (isError(result)) {
    throw result.error;
  }
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error('Failed to add URL to Transmission');
}

// Private method with AsyncResult return type for robust error handling
private async _addUrl(options: AddDownloadOptions): Promise<AsyncResult<string, Error>> {
  try {
    // Implementation details...
    return createSuccessResult("success-id");
  } catch (error) {
    return createErrorResult(
      error instanceof Error 
        ? error 
        : new Error(`Unknown error: ${String(error)}`)
    );
  }
}
```

### Benefits of the Pattern

1. **Type Safety**: The AsyncResult type clearly documents possible outcomes and their associated data.
2. **Error Handling**: Errors are captured in a structured way with proper type information.
3. **Interface Compliance**: The public methods maintain compliance with the abstract class interface.
4. **Implementation Details**: The private methods can use a more expressive type system without breaking the interface contract.

### Implementation in TransmissionClient

The TransmissionClient implementation now includes AsyncResult-wrapped versions of:

1. `_addUrl()`
2. `_getStatus()`
3. `_getAllItems()`
4. `_pauseItem()`
5. `_resumeItem()`
6. `_removeItem()`
7. `_ping()`
8. `_testConnection()`

Each with a corresponding public method that unwraps the AsyncResult to maintain interface compliance.

## Testing Considerations

When testing the TransmissionClient:

1. Public methods should be tested for correct handling of success and error states.
2. Private AsyncResult methods can be tested directly to verify detailed error handling.
3. Edge cases should focus on testing the proper transformation between AsyncResult and direct return types.

## Conclusion

The AsyncResult wrapper pattern provides a robust approach to handling asynchronous operations with proper type safety. By maintaining both backward compatibility and improving error handling, the pattern enhances the overall reliability of the client implementation.
---
### Source: deluge-client-fixes.md


The main fixes implemented today focused on the abstract method implementation mismatch and proper AsyncResult handling.

## Latest Fixes (June 17, 2025)

### Abstract Method Implementation Mismatch

We fixed the method signature mismatch between the DelugeClient implementation and the abstract DownloadClient class it extends:

1. **testConnection Method**:
   - Changed return type from `Promise<AsyncResult<boolean, Error>>` to `Promise<boolean>` as required by the base class
   - Created a private `_testConnection` method that maintains the AsyncResult pattern internally
   - Updated implementation to use try/catch and return a boolean

2. **ping Method**:
   - Changed return type from `Promise<AsyncResult<void, Error>>` to `Promise<void>` as required by the base class
   - Created a private `_ping` method that maintains the AsyncResult pattern internally
   - Updated references to ping() in other methods to use the correct version

### Implementation Approach: AsyncResult Wrapper Pattern

To address the abstract method implementation mismatch while preserving the benefits of the AsyncResult pattern, we implemented a wrapper pattern:

```typescript
// Public method matches abstract interface (direct return type)
public async ping(): Promise<void> {
  const result = await this._ping();
  if (isError(result)) {
    throw result.error;
  }
  return;
}

// Private method preserves AsyncResult pattern
private async _ping(): Promise<AsyncResult<void, Error>> {
  try {
    // Implementation with robust error handling
    // ...
    return createSuccessResult(undefined);
  } catch (error) {
    return createErrorResult(
      error instanceof Error 
        ? error 
        : new Error(`Unknown error: ${String(error)}`)
    );
  }
}
```

This pattern allows us to:
1. Maintain interface compliance with the abstract class
2. Preserve detailed error handling internally
3. Simplify error propagation
4. Keep the codebase consistent

## Issues Fixed

1. **Missing Index Signatures in Interfaces**
   - Added index signatures (`[key: string]: unknown`) to `DelugeTorrentStatus`, `DelugeFile`, and `DelugeDaemonInfo` interfaces to make them compatible with `Record<string, unknown>` when used in the code.

2. **Property Conflict with Base Class**
   - Renamed class properties `cache` to `requestCache` and `rateLimiter` to `delugeRateLimiter` to avoid conflicts with the protected properties in the base `ApiClient` class.

3. **Missing Cache and RateLimiter Interfaces**
   - Added a custom `RequestCache` interface that matches the expected cache API used in the class.
   - Created a custom `DelugeRateLimiter` class instead of trying to access the base class's rate limiter.

4. **Missing RateLimitError Import**
   - Added explicit import for `RateLimitError` from `../utils/errorHandling` to be used in error handling.

5. **Rate Limiter Implementation**
   - Implemented custom rate limiting functionality via the `DelugeRateLimiter` class to avoid accessing protected members of the base class.

6. **Cache Handling**
   - Updated cache access to use the newly defined `requestCache` property and properly cast it from the base class's `cache` property.

## Changes Made

### Interface Updates

Added index signatures to interfaces to make them compatible with `Record<string, unknown>`:

```typescript
interface DelugeTorrentStatus {
  // ... existing properties
  [key: string]: unknown;
}

interface DelugeFile {
  // ... existing properties
  [key: string]: unknown;
}

interface DelugeDaemonInfo {
  // ... existing properties
  [key: string]: unknown;
}
```

### Custom Rate Limiter

Added a custom rate limiter class specific to Deluge:

```typescript
class DelugeRateLimiter {
  private lastRequest: number = 0;
  private minRequestInterval: number;

  constructor(requestsPerSecond: number) {
    this.minRequestInterval = 1000 / requestsPerSecond;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
}
```

### Property Renames

Renamed properties to avoid conflicts with base class:

```typescript
export class DelugeClient extends DownloadClient {
  // Renamed from 'cache' to avoid conflict
  private requestCache: RequestCache | null = null;
  
  // Renamed from 'rateLimiter' to avoid conflict
  private delugeRateLimiter: DelugeRateLimiter;
  
  // ... rest of the class
}
```

### Cache and Rate Limiter Initialization

Updated initialization in the constructor:

```typescript
constructor(config: DelugeConfig) {
  // ... super call
  
  // Create rate limiter
  this.delugeRateLimiter = new DelugeRateLimiter(10); // 10 requests per second
  
  // Access cache from super (if available)
  this.requestCache = this.cache;
}
```

### Rate Limiting in Request Methods

Applied rate limiting in both request methods:

```typescript
private async directRequest<T>(method: string, params: any[] = []): Promise<T> {
  // Apply rate limiting
  await this.delugeRateLimiter.acquire();
  
  // ... rest of the method
}

private async proxyRequest<T>(method: string, params: any[] = []): Promise<T> {
  // Apply rate limiting
  await this.delugeRateLimiter.acquire();
  
  // ... rest of the method
}
```

## Benefits

1. **Type Safety**: The interfaces now correctly represent the shape of objects used in the application, improving type checking.

2. **Proper Inheritance**: The class now properly extends the base class without accessing protected members directly.

3. **Clear Error Handling**: Improved error handling with explicit imports for error types.

4. **Custom Rate Limiting**: Implemented custom rate limiting that doesn't rely on protected base class functionality.

5. **Comprehensive AsyncResult Handling**: Implemented robust AsyncResult state checking with `isSuccess` and `isError` type guards.

6. **Interface Compliance**: Ensured all methods properly implement abstract class requirements while maintaining internal type safety.

## Notes

These changes maintain the existing functionality while improving type safety and adherence to TypeScript best practices. The DelugeClient now properly implements the required interfaces and methods from its parent classes without type errors.
---

## Document History

- **Created**: $(date +"%Y-%m-%d") - Consolidated from multiple client documentation files
- **Status**: Active
- **Maintainer**: Documentation Team

## Related Documentation

- Download Clients Guide - BitTorrent & Usenet clients
- API Client Reference - HTTP & API integration
- UI Client Guide - Frontend & navigation

