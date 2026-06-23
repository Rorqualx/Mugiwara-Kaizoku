# Anilist Issues

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Anilist Issues

---
# AniList Troubleshooting Guide

> **Status**: Approved  
> **Version**: 1.0.0  
> **Last Updated**: January 2025  
> **Canonical**: Yes

## Overview

This guide consolidates all AniList-related troubleshooting information, fixes, and solutions from across the documentation.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Cover Art Problems](#cover-art-problems)
3. [Save Button Issues](#save-button-issues)
4. [Authentication Problems](#authentication-problems)
5. [Rate Limiting](#rate-limiting)
6. [Integration Issues](#integration-issues)
7. [Performance Problems](#performance-problems)

## Common Issues

### Issue: AniList search returns no results
**Symptoms**: Search queries return empty results even for known manga titles

**Solutions**:
1. Check if the AniList API is accessible
2. Verify rate limiting hasn't been triggered
3. Ensure proper error handling is in place

### Issue: Metadata not updating
**Symptoms**: Manga metadata remains stale despite refresh attempts

**Solutions**:
1. Clear the metadata cache
2. Check for API authentication issues
3. Verify the manga ID mapping is correct

## Key Issues Fixed

1. **Logger Interface Compatibility**
   - Added proper logger initialization using `protected override log = logger.child({ module: 'AniListAdapter' })`
   - Ensures type compatibility with logger interface

2. **Status Mapping**
   - Enhanced status mapping using the standardized `anilistToDomainStatus` function
   - Added explicit type checking for status values
   - Added an override of the `mapStatus` method to use our custom mapping

3. **Return Type Consistency**
   - Fixed the `searchManga` method return type to match the interface (from `MangaEntity[]` to `IntegrationMangaData[]`)
   - Updated returned objects to match the expected interface type

4. **Null Safety**
   - Replaced null checks with nullish coalescing operators (`??`)
   - Added safe property access for optional fields

5. **Type Narrowing**
   - Added explicit type narrowing with checks like `typeof status === 'string'`
   - Enhanced validation of external data

## Implementation Pattern

1. **Logger Initialization**:
   ```typescript
   protected override log = logger.child({ module: 'AniListAdapter' });
   ```

2. **Safe Status Mapping**:
   ```typescript
   const status = mangaData.status 
     ? (typeof mangaData.status === 'string' 
       ? anilistToDomainStatus(mangaData.status) 
       : mangaData.status)
     : MangaStatus.UNKNOWN;
   ```

3. **Proper Return Type Handling**:
   ```typescript
   public async searchManga(query: string, options?: SearchOptions): Promise<IntegrationMangaData[]> {
     // Implementation that returns IntegrationMangaData[] instead of MangaEntity[]
   }
   ```

4. **Null Safety**:
   ```typescript
   cover: mangaData.coverUrl ?? '/cover-not-found.jpg',
   summary: mangaData.description ?? null,
   genres: mangaData.genres ?? [],
   ```

5. **Custom Status Mapping Method**:
   ```typescript
   protected override mapStatus(providerStatus: unknown): MangaStatus {
     if (!providerStatus) return MangaStatus.UNKNOWN;
     return anilistToDomainStatus(String(providerStatus));
   }
   ```

## Migration Strategy

For other adapters, the following pattern should be applied:

1. Use standardized logger with child creation
2. Use provider-specific status mapping functions
3. Ensure return types match interface requirements
4. Add null safety with nullish coalescing
5. Override base methods that need customization
6. Add explicit type checking for external data

## Overview

This document summarizes the final implementation fixes made to the AniListAdapter class to resolve all TypeScript errors. The changes address interface compliance, error handling, and proper usage of the AsyncResult pattern while maintaining compatibility with the existing codebase.

## Key Fixes

### 1. Imports and Type Definitions

- Fixed import for `AniListMangaDetail` and `AniListMangaSearchResult` from standardized client
- Ensured proper type imports from domain modules
- Used explicit types for parameters and return values

### 2. Client Method Compatibility

- Resolved issues with nonexistent client methods:
  - Used standard `search` method instead of missing `searchAsync`
  - Used standard `getManga` method instead of missing `getMangaAsync`
  - Created implementation for `getMangaByTitle` using search with a limit of 1
  - Replaced protected `ping` method call with a search request

### 3. AsyncResult Pattern Implementation

- Implemented consistent AsyncResult pattern usage throughout:
  - Properly wrapped standard client method results in AsyncResult
  - Used `createSuccessResult` and `createErrorResult` consistently
  - Added proper type checks with `isSuccess` and `isError` guard functions
  - Ensured all error types use Error instead of unknown

### 4. Type Safety Improvements

- Fixed type mapping for complex objects:
  - Properly extracted author names from Author objects
  - Converted dates to proper Date objects
  - Handled optional properties with null checks and default values
  - Added proper MangaStatus type handling

### 5. Status Handling

- Added dedicated status mapping method:
  - Created `mapStatusToAniList` method to convert domain status to AniList status
  - Used consistent status mapping in search and other methods
  - Fixed parameter compatibility issues with MangaStatus

## Implementation Details

### Search Method Fix

The search method was fixed to use the client's standard `search` method, properly wrapping the results in AsyncResult pattern:

```typescript
public async searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<IntegrationMangaData[], Error>> {
  try {
    // Use client's search method directly
    const searchResults = await this.client.search(query, {
      limit: options?.limit || 20,
      genres: options?.genres,
      status: options?.status?.map(status => status as unknown as MangaStatus)
    });
    
    // Transform the search results into IntegrationMangaData objects
    const mangaList = searchResults.map(result => {
      // Create a properly typed IntegrationMangaData object
      const mangaData: IntegrationMangaData = {
        id: result.id,
        title: result.title || 'Unknown',
        description: result.description,
        coverUrl: result.coverImage,
        status: this.mapStatus(result.status),
        genres: result.genres || [],
        tags: result.tags || [],
        authors: result.authors?.map(author => author.name) || []
      };
      
      return mangaData;
    });
    
    return createSuccessResult(mangaList);
  } catch (error) {
    this.log('AniList search manga failed', error);
    return createErrorResult(
      this.createError(`Failed to search manga on AniList: ${error instanceof Error ? error.message : String(error)}`, error)
    );
  }
}
```

### Status Mapping

A new method was added to handle status mapping correctly:

```typescript
protected mapStatusToAniList(status: string): string {
  switch (status) {
    case MangaStatus.COMPLETED:
      return 'FINISHED';
    case MangaStatus.ONGOING:
      return 'RELEASING';
    case MangaStatus.HIATUS:
      return 'HIATUS';
    case MangaStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'RELEASING';
  }
}
```

### Date Handling

Date handling was improved to handle different formats correctly:

```typescript
startDate: manga.year ? new Date(manga.year, 0, 1) : undefined,
endDate: undefined
```

### Status Check Fix

Fixed the status check method to use an available client method instead of protected ping:

```typescript
public async getStatusAsync(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
  try {
    // Check if the service is available by making a simple search request
    await this.client.search("test", { limit: 1 });
    
    return createSuccessResult({ status: 'ok' });
  } catch (error) {
    return createSuccessResult({ 
      status: 'error', 
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
```

## Benefits

1. **Complete Type Safety**: All TypeScript errors have been resolved while maintaining proper type safety.
2. **Consistent Patterns**: The implementation now consistently follows the project's AsyncResult pattern.
3. **Robust Error Handling**: Errors are properly propagated with context and type information.
4. **Maintainable Implementation**: The code is now more maintainable with proper null checks and type guards.
5. **Compatible Interface**: The adapter still implements the same interface, ensuring compatibility with the rest of the codebase.

## Verification

All type errors have been verified as fixed using `npm run type-check`. The adapter now passes TypeScript validation and continues to follow the project's established patterns and guidelines.

## Overview

The AniList adapter implementation was enhanced to use the standardized AsyncResult pattern and improve type safety throughout the codebase. The main goal was to fix TypeScript errors and ensure consistent error handling patterns.

## Key Implementations

1. **Standardized AniList Client**
   - Created a new `anilistClient.standardized.ts` file implementing the AsyncResult pattern
   - Added proper type definitions for all API responses
   - Implemented consistent error handling for all operations
   - Provided proper type conversions for external data

2. **AniList Adapter Improvements**
   - Updated to use the standardized client implementation
   - Fixed import paths and type references
   - Improved handling of manga metadata with proper type conversions
   - Enhanced error handling and propagation

3. **AsyncResult Pattern Implementation**
   - Implemented proper state handling (idle, loading, success, error)
   - Added type-safe result unwrapping
   - Ensured consistent error propagation
   - Added comprehensive type guards

4. **Type Safety Enhancements**
   - Added proper interfaces for manga data
   - Fixed type compatibility issues between different interfaces
   - Enhanced type narrowing and assertions
   - Implemented proper type conversion for domain entities

## Testing

Unit tests were implemented to verify:
- AsyncResult pattern implementation
- Error handling and propagation
- Type conversion correctness
- State handling

## Documentation

The implementation was documented in:
- `/docs/anilist-adapter-implementation.md`
- Test files with comprehensive examples

## Remaining Issues

Some system-level TypeScript errors remain that are outside the scope of this implementation:
- The `tough-cookie` dependency has a type definition mismatch
- The `caching.ts` utility has iterator compatibility issues

These issues should be addressed in a separate fix focused on dependencies and system-level TypeScript configuration.

## Benefits

This implementation provides several benefits:
1. **Consistency**: All adapters now follow the same pattern
2. **Type Safety**: Proper TypeScript interfaces prevent type errors
3. **Error Handling**: Consistent error handling improves reliability
4. **Maintainability**: Standardized pattern makes code easier to understand
5. **Testability**: AsyncResult pattern makes testing easier

## Next Steps

1. Apply the same standardized client pattern to other adapters (ComicVine, Fandom, etc.)
2. Enhance test coverage for all adapters
3. Refactor client code to use the AsyncResult pattern consistently
4. Document the pattern for future development

## Overview

This document details additional TypeScript fixes implemented in the `AniListAdapter` class. These updates focus on enhancing the logger implementation, adding proper method overrides, and improving constructor dependency injection.

## Key Issues

1. **Logger Implementation**:
   - Missing explicit logger property override
   - Inconsistent logging patterns

2. **Constructor Improvements**:
   - Missing support for optional PrismaClient injection
   - Needed better initialization pattern for dependency injection

3. **Method Implementation**:
   - Added missing `mapStatus` method override to properly extend the base adapter class

## Fixed Implementation

### Logger Handling

```typescript
// Added explicit logger override
protected override log = logger.child({ module: 'AniListAdapter' });
```

By adding the explicit logger property with the `override` keyword, we ensure proper TypeScript inheritance and maintain consistent logging behavior with other adapters.

### Constructor Dependency Injection

```typescript
// Original
constructor(config: AniListAdapterConfig = {}) {
  // ...
  this.prisma = new PrismaClient();
  // ...
}

// Fixed
constructor(config: AniListAdapterConfig = {}, prisma?: PrismaClient) {
  // ...
  this.prisma = prisma || new PrismaClient();
  // ...
}
```

This change allows for easier testing by making the PrismaClient injectable. It also follows better dependency injection patterns, making the code more modular and testable.

### Status Mapping Method

```typescript
// Added required method override
protected override mapStatus(providerStatus: unknown): MangaStatus {
  if (!providerStatus) return MangaStatus.UNKNOWN;
  
  return anilistToDomainStatus(String(providerStatus));
}
```

This implementation properly overrides the base class method, ensuring consistent status mapping behavior and proper TypeScript inheritance.

## Implementation Notes

1. **Code Consistency**:
   - Maintained consistent patterns with other adapter implementations
   - Ensured proper error handling and logging throughout

2. **Backward Compatibility**:
   - Changes maintain full backward compatibility with existing code
   - No functional changes to the core business logic

3. **Testing Implications**:
   - Improved testability through constructor injection
   - Maintained same error handling behavior

## Combined with Previous Fixes

These updates complement the previously fixed type issues:

1. **Previous Fixes**:
   - Type assertions for search options
   - Proper status mapping type safety
   - Improved metadata handling

2. **Current Fixes**:
   - Explicit logger override
   - Constructor dependency injection
   - Method override implementation

Together, these changes ensure that the `AniListAdapter` is fully compliant with TypeScript's type system while maintaining clean architecture principles.

## Testing Considerations

The updates should be tested to ensure:

1. Logging behavior is consistent with other adapters
2. Constructor injection works correctly with both default and injected dependencies
3. Status mapping produces the same results as before
4. All functionality continues to work as expected

## File: src/api/metadataProviders/adapters/anilistAdapter.ts

### Issues Fixed

The AniListAdapter component had several TypeScript errors that have been fixed. The key error categories and their solutions are detailed below:

1. **Type Safety Issues**:
   - Incorrect handling of status type conversions
   - Missing type guards for optional properties
   - Improper handling of null/undefined values

2. **Return Type Compatibility Issues**:
   - Incompatible return types between interface and implementation
   - Type mismatch in searchManga method
   - Inconsistent use of optional properties

3. **Method Override Issues**:
   - Missing `override` keyword for overridden methods
   - Inconsistent method implementations compared to base class

4. **Nullish Handling Issues**:
   - Using logical OR (`||`) instead of nullish coalescing (`??`)
   - Missing fallbacks for potentially undefined values

5. **Logger Configuration Issues**:
   - Missing proper typing for the logger instance
   - Inconsistent logger initialization

### Implementation Details

#### 1. Type Safety for Status Conversion

```typescript
// Before
const status = mangaData.status 
  ? anilistToDomainStatus(mangaData.status as string)
  : MangaStatus.UNKNOWN;

// After
const status = mangaData.status 
  ? (typeof mangaData.status === 'string' 
    ? anilistToDomainStatus(mangaData.status) 
    : mangaData.status)
  : MangaStatus.UNKNOWN;
```

- Added proper type checking before conversion
- Avoided unnecessary type casting when status is already a MangaStatus

#### 2. Return Type Compatibility Fix

```typescript
// Before
public async searchManga(query: string, options?: SearchOptions): Promise<MangaEntity[]> {
  // ...
}

// After
public async searchManga(query: string, options?: SearchOptions): Promise<IntegrationMangaData[]> {
  // ...
}
```

- Fixed return type to match the interface definition
- Ensured type compatibility across the inheritance hierarchy

#### 3. Method Override Improvements

```typescript
// Added new method to properly override the base implementation
protected override mapStatus(providerStatus: unknown): MangaStatus {
  if (!providerStatus) return MangaStatus.UNKNOWN;
  
  return anilistToDomainStatus(String(providerStatus));
}
```

- Added the `override` keyword for clarity and type safety
- Implemented proper type conversion for status values

#### 4. Nullish Handling Improvements

```typescript
// Before
cover: mangaData.coverUrl || '/cover-not-found.jpg',
summary: mangaData.description,
genres: mangaData.genres || [],

// After
cover: mangaData.coverUrl ?? '/cover-not-found.jpg',
summary: mangaData.description ?? null,
genres: mangaData.genres ?? [],
```

- Used nullish coalescing (`??`) instead of logical OR (`||`)
- Added explicit null for undefined description
- Consistent handling of empty arrays

#### 5. Logger Configuration

```typescript
// Added proper logger configuration
protected override log = logger.child({ module: 'AniListAdapter' });
```

- Properly typed logger with module name
- Used override keyword for base class property

### Benefits

1. **Type Safety**: Improved type checking throughout the adapter, preventing potential runtime errors.

2. **Interface Compliance**: Ensured that the implementation properly follows the interface contract.

3. **Null Safety**: Added proper null checks to prevent runtime errors from undefined values.

4. **Code Quality**: Improved error handling and logging for better debugging.

5. **Testability**: Made the code more testable by adding dependency injection for the Prisma client.

### Continued Improvements from Previous Fixes

Building on previous fixes documented in anilist-adapter-fixes.md, this update includes:

1. **Enhanced Type Assertions**:
   - Replaced simple `as` assertions with proper type checking using `typeof` and type guards
   - Added more comprehensive null checking throughout the code

2. **Return Type Consistency**:
   - Fixed return type mismatches between interface declarations and implementations
   - Ensured consistent return types across all methods

3. **Modern JavaScript Features**:
   - Replaced `||` with `??` for nullish handling
   - Used proper optional chaining with nullish coalescing

4. **Method Overriding**:
   - Added explicit `override` keyword for all overridden methods
   - Implemented proper overrides with consistent signatures

### Testing Notes

The fixed adapter was tested to ensure:

1. All API calls work correctly with proper type handling
2. Error handling works correctly for API failures
3. Status conversion handles all possible input types
4. Null/undefined values are handled properly
5. Logger configuration works correctly

All TypeScript errors have been resolved while maintaining the original functionality of the adapter.

## Problem

When adding manga using AniList as the metadata provider, the cover art was not being displayed on the library page. This was due to a mismatch between how cover art URLs were handled in different parts of the application:

1. When adding manga using AniList, the cover URL was passed as `cover` in the metadata object
2. However, the `MangaCard` component looks for `coverLarge`, `coverMedium`, or `coverSmall` fields
3. This mismatch caused the cover art to not display properly on the library page

## Solution

The solution involved creating a consistent way to map cover URLs from any provider to the database fields:

1. Added a new helper function `createCoverDataFromUrl` that takes a single cover URL and maps it to the database fields:
   ```typescript
   function createCoverDataFromUrl(coverUrl: string | null | undefined): {
     coverLarge: string | null;
     coverMedium: string | null;
     coverSmall: string | null;
   } {
     if (!coverUrl) {
       return {
         coverLarge: null,
         coverMedium: null,
         coverSmall: null,
       };
     }

     // Use the same URL for all sizes if we only have one URL
     return {
       coverLarge: coverUrl,
       coverMedium: coverUrl,
       coverSmall: coverUrl,
     };
   }
   ```

2. Updated the `manga.add` mutation to use this helper function for all providers:
   ```typescript
   // Get the best cover URL from the metadata
   const coverUrl = detailedMetadata.cover || 
                   detailedMetadata.coverImage || 
                   inputMetadata?.cover || 
                   '/cover-not-found.jpg';
   
   // Create standardized cover data
   mangaCoverData = createCoverDataFromUrl(coverUrl);
   ```

3. Also updated the `refreshMetaData` mutation to use the same helper function for consistency

## Testing

A test script has been created to verify that the cover art is being properly retrieved when using AniList to add manga:

```bash
node scripts/test-anilist-cover-art.js "Manga Title"
```

This script:
1. Searches for a manga using the AniList provider
2. Gets the detailed metadata for the first result
3. Displays the cover information
4. Creates standardized cover data
5. Simulates how the MangaCard component would display the cover

## Results

With this fix, cover art is now consistently displayed on the library page regardless of which metadata provider is used. The solution ensures that:

1. Cover URLs are consistently mapped to the database fields
2. The MangaCard component can always find a cover URL to display
3. The user experience is improved with proper visual representation of manga in the library

## Problems

The AniList Native integration settings page had two issues with the save button:

1. **Object vs String Type Mismatch**:
   The first error was:
   ```
   Expected string, received object
   ```
   This occurred because the server's Zod validation expected a string, boolean, number, or array of strings, but we were trying to save a complex JavaScript object to the metadata field.

2. **Invalid Field Name with Dot Notation**:
   The second error was:
   ```
   Unknown argument `metadata.anilist.settings.useNativeProvider`. Available options are marked with ?.
   ```
   This occurred because Prisma doesn't support dot notation for field names. We were trying to directly update a nested field in the database using a field name with dots.

## Changes Made

1. **Added Proper TypeScript Interface**
   - Created a `MetadataStructure` interface to properly type the metadata object
   - This ensures TypeScript can validate the nested structure properly

2. **Improved Metadata Handling**
   - Added a dedicated `handleMetadataSetting` function to handle the complex nested metadata structure
   - Properly checks and creates the nested structure if it doesn't exist
   - Sets additional compatibility flags to ensure backward compatibility
   - **Added JSON stringification** for the metadata object to match the server's expectations
   - Modified update handlers to defer metadata updates to the save button

3. **Fixed Dot Notation Issue**
   - Modified `handleSwitchUpdate` and `handleTextUpdate` to handle metadata fields differently
   - Instead of trying to update nested fields directly with dot notation, we now:
     - Store the values in the form state
     - Only update them when the save button is clicked
     - Update the entire metadata object at once

3. **Enhanced Error Handling**
   - Added individual try/catch blocks for each setting
   - Tracks success and failure counts
   - Collects detailed error messages for debugging
   - Provides more informative error notifications

4. **Added Validation**
   - Added validation to skip empty or undefined values
   - Properly handles different types of settings (regular vs. metadata)

5. **Improved User Feedback**
   - Added success count to success notifications
   - Added partial success notifications when some settings succeed but others fail
   - Truncates long error messages to keep notifications readable

## Technical Implementation

The key improvements are:

1. **Metadata Structure Handling with JSON Stringification**:
```typescript
// Define a type for the metadata structure
interface MetadataStructure {
  anilist?: {
    settings?: {
      useNativeProvider?: boolean;
    };
    enabled?: boolean;
  };
  anilistUseNativeProvider?: boolean;
  defaultProvider?: string;
  [key: string]: any;
}

// Helper function to handle metadata settings
const handleMetadataSetting = async (key: string, value: any) => {
  // Special handling for nested metadata structure
  if (key === 'metadata.anilist.settings.useNativeProvider') {
    // Ensure the nested structure exists
    if (!metadata.anilist) metadata.anilist = {};
    if (!metadata.anilist.settings) metadata.anilist.settings = {};
    
    // Update the value
    metadata.anilist.settings.useNativeProvider = value;
    
    // Also set the alternative flags for backward compatibility
    metadata.anilistUseNativeProvider = value;
    metadata.defaultProvider = value ? 'anilist-native' : metadata.defaultProvider;
    
    // Save the entire metadata object as a JSON string
    return updateMutation.mutateAsync({
      configKey: 'metadata',
      value: JSON.stringify(metadata),
    } as any);
  }
}
```

2. **Improved Save Function**:
```typescript
const handleSaveAll = async () => {
  setIsSaving(true);
  let successCount = 0;
  let errorCount = 0;
  let errorMessages: string[] = [];
  
  try {
    // Process settings one by one to better handle errors
    for (const [key, value] of Object.entries(formValues)) {
      // Skip empty or undefined values
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      try {
        // Use the helper function for metadata settings
        if (key.startsWith('metadata.')) {
          await handleMetadataSetting(key, value);
        } else {
          await updateMutation.mutateAsync({
            configKey: key,
            value,
          } as any);
        }
        successCount++;
      } catch (err) {
        errorCount++;
        errorMessages.push(`Failed to save ${key}: ${errorMessage}`);
      }
    }
    
    // Show appropriate notification based on results
    if (errorCount === 0) {
      // Success notification
    } else if (successCount > 0) {
      // Partial success notification
    } else {
      // Error notification
    }
  } catch (error) {
    // Show detailed error notification
  } finally {
    setIsSaving(false);
  }
};
```

## Benefits

1. **More Reliable Saving**
   - The save button now properly handles the nested metadata structure
   - Individual settings are saved one by one, so a failure in one doesn't affect others
   - Metadata is properly stringified to match the server's expectations

2. **Better Error Reporting**
   - Users now see more detailed error messages
   - Partial successes are reported correctly
   - Developers can see detailed error logs in the console

3. **Improved User Experience**
   - The save button now provides clear feedback on what happened
   - Loading state is properly managed
   - Success notifications show how many settings were saved

## Future Improvements

Potential future improvements could include:

1. Adding a reset button to revert changes
2. Adding validation for specific fields (e.g., ensuring Client ID is in the correct format)
3. Adding a confirmation dialog for sensitive settings
4. Adding a way to test the AniList connection with the provided credentials
5. Updating the server's Zod schema to directly accept complex objects for more flexibility

## Overview

Kaizoku supports integration with AniList for manga metadata. There are two ways this integration can work:

1. **AniList Native Provider**: Direct integration with the AniList GraphQL API
2. **Mangal-based Provider**: Integration through the Mangal CLI (deprecated)

The recommended approach is to use the AniList Native Provider, which provides better reliability and more features.

## Common Issues

### "AniList is not properly configured for metadata"

This error occurs when trying to add a manga and the AniList integration is not properly configured. The error message might look like:

```
Failed to add manga: Failed to get anilist-native metadata: Failed to get metadata: Failed to get AniList metadata: AniList is not properly configured for metadata. Please check your AniList settings.
```

#### Causes:

1. AniList integration is disabled
2. AniList is not set to be used for metadata
3. AniList client ID or client secret is missing
4. AniList native provider is not enabled
5. Default metadata provider is not set to 'anilist-native'

#### Solution:

1. Go to Settings > Metadata > AniList
2. Ensure "Enable AniList" is turned on
3. Ensure "Use for Metadata" is turned on
4. Enter your AniList client ID and client secret
5. Ensure "Use Native Provider" is turned on
6. Save the settings

Alternatively, you can run the `update-anilist-settings.js` script to automatically fix these issues:

```bash
node scripts/update-anilist-settings.js [clientId] [clientSecret]
```

Replace `[clientId]` and `[clientSecret]` with your actual AniList API credentials. If you don't provide these, the script will use dummy values or existing values if available.

### "Manga not found in anilist-native"

This error occurs when the AniList API cannot find the manga you're trying to add. The error message might look like:

```
Failed to add manga: Manga not found in anilist-native
```

#### Causes:

1. The manga title might be misspelled
2. The manga might not exist in the AniList database
3. The AniList API might be temporarily unavailable

#### Solution:

1. Double-check the spelling of the manga title
2. Try searching for a more popular manga (e.g., "One Piece" or "Naruto")
3. Try again later if the AniList API might be temporarily unavailable

### Settings Not Persisting

If you enable AniList settings in the UI and click the save button, but the page reloads with the switches turned off, this indicates an issue with how the settings are being saved and retrieved.

#### Solution:

1. Use the `update-anilist-settings.js` script to ensure the settings are properly saved
2. Restart the server to apply the changes
3. Verify the settings are correctly saved by running the `test-anilist-metadata.js` script

## Testing AniList Integration

You can test the AniList integration by running the `test-anilist-metadata.js` script:

```bash
node scripts/test-anilist-metadata.js
```

This script will:

1. Check if AniList is properly configured in the settings
2. Attempt to initialize the AniList client
3. Test the AniList search functionality
4. Test the AniList native provider by fetching metadata for popular manga

## Getting AniList API Credentials

To use the AniList integration, you need to create an AniList API client:

1. Go to [AniList Developer Settings](https://anilist.co/settings/developer)
2. Create a new client
3. Set the redirect URL to `http://localhost` (this is not used but required)
4. Copy the client ID and client secret
5. Enter these credentials in the AniList settings or use the `update-anilist-settings.js` script

## Troubleshooting Steps

If you're still experiencing issues with the AniList integration, try the following steps:

1. Run the `update-anilist-settings.js` script to ensure the settings are properly configured
2. Run the `test-anilist-metadata.js` script to verify the integration is working
3. Restart the server to apply any changes
4. Try adding a popular manga like "One Piece" or "Naruto"
5. Check the server logs for any error messages

If these steps don't resolve the issue, please report the problem with the error message and server logs.


---

## Document History

- **Created**: $(date +"%Y-%m-%d") - Consolidated from multiple AniList documentation files
- **Status**: Active
- **Maintainer**: Documentation Team

## See Also

- AniList User Guide
- AniList Implementation Reference
- AniList Troubleshooting
