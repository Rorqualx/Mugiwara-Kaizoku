# Utils

This directory contains utility functions and helpers used throughout the Mugiwara-Kaizoku manga management application. These utilities provide common functionality, type-safety helpers, and standardized patterns.

## Purpose

The utils directory serves several purposes:

1. Provide reusable helper functions for common operations
2. Implement core application patterns like AsyncResult
3. Create shared validation utilities
4. Offer type conversion and manipulation tools
5. Standardize error handling and logging

## Directory Structure

The utilities are organized into functional categories:

- `/adapters` - Common adapter patterns and utilities
- `/converters` - Type conversion utilities
- `/logging` - Logging infrastructure
- `/validation` - Type validation utilities
- `/client` - Client-side specific utilities
- `/server` - Server-side specific utilities
- `/websocket` - WebSocket management utilities
- `/deprecated` - Deprecated utilities kept for backward compatibility

## Key Files

### Core Utilities
- `async-result.ts` - AsyncResult pattern implementation
- `async-result-helpers.ts` - Helper functions for AsyncResult
- `integration-adapter.ts` - Base adapter pattern implementation
- `error-handling.ts` - Standardized error handling utilities
- `type-guards.ts` - Type guard functions

### Type Handling
- `type-conversion.ts` - Type conversion utilities
- `type-safety-utils.ts` - Utilities for improved type safety
- `type-narrowing.ts` - Type narrowing utilities
- `id-conversion.ts` - ID type conversion helpers

### Domain Utilities
- `manga.ts` - Manga-specific utilities
- `chapter.ts` - Chapter-specific utilities

### Infrastructure
- `logging.ts` - Logging utilities
- `clientLogger.ts` - Client-side logging
- `serverLogger.ts` - Server-side logging

## Key Patterns

### AsyncResult Pattern

The AsyncResult pattern provides a type-safe way to handle asynchronous operations:

```typescript
import { 
  AsyncResult, 
  createSuccessResult, 
  createErrorResult,
  isSuccess,
  isError 
} from '../utils/async-result';

async function fetchData(): Promise<AsyncResult<Data, Error>> {
  try {
    const data = await api.getData();
    return createSuccessResult(data);
  } catch (error) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

// Usage
const result = await fetchData();
if (isSuccess(result)) {
  // Handle success with result.data
} else if (isError(result)) {
  // Handle error with result.error
}
```

### Type Guards

Type guards provide type-safe handling of potentially unsafe data:

```typescript
import { isObject, isArray, isNumber } from '../utils/validation/type-guards';

function processData(data: unknown) {
  if (!isObject(data)) {
    throw new Error('Expected an object');
  }
  
  if (isArray(data.items)) {
    // data.items is now typed as an array
    data.items.forEach(item => {
      // Process each item
    });
  }
  
  if ('count' in data && isNumber(data.count)) {
    // data.count is now typed as a number
    const doubledCount = data.count * 2;
  }
}
```

### Enhanced Error Handling

Enhanced error handling provides context-rich errors:

```typescript
import { createContextualError, withEnhancedErrorHandling } from '../utils/async-result';

const result = await withEnhancedErrorHandling(
  async () => {
    try {
      // Operation logic
      return createSuccessResult(data);
    } catch (error) {
      throw createContextualError(
        'Failed to perform operation',
        'OPERATION_ERROR',
        { resourceId: id, details: { param1, param2 } },
        error instanceof Error ? error : undefined
      );
    }
  },
  { operation: 'fetchResource', resourceType: 'manga' }
);
```

## Converter Utilities

The `/converters` directory contains specialized utilities for type conversion, particularly between API, domain, and database models:

- `BaseConverter.ts` - Base converter class
- `MangaConverter.ts` - Manga-specific conversions
- `ChapterConverter.ts` - Chapter-specific conversions
- `MetadataConverter.ts` - Metadata-specific conversions

## Validation Utilities

The `/validation` directory contains comprehensive validation utilities:

- `domain-guards.ts` - Type guards for domain entities
- `data-validators.ts` - Data validation functions
- `schema-validation.ts` - Schema-based validation
- `enhanced-type-guards.ts` - Enhanced type guards with error messages

## Usage Examples

```typescript
// AsyncResult helpers
import { mapAsyncResult, filterAsyncResult } from '../utils/async-result';

const mappedResult = mapAsyncResult(originalResult, data => data.map(transformItem));
const filteredResult = filterAsyncResult(originalResult, item => item.isActive);

// Type conversion
import { convertToMangaEntity } from '../utils/converters';

const mangaEntity = convertToMangaEntity(apiResponse);

// Safe JSON parsing
import { safeJsonParse } from '../utils/validation/safe-json';

const result = safeJsonParse(jsonString, defaultValue);

// Domain validation
import { isValidMangaEntity } from '../utils/validation/domain-guards';

if (isValidMangaEntity(data)) {
  // data is now typed as MangaEntity
}
```

## Testing

Test utilities using:

```bash
npm run test -- --testPathPattern=utils
```