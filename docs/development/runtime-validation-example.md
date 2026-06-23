# Runtime Validation Examples

This document provides examples of using the runtime validation utilities to ensure type safety between compile time and runtime.

## Example: MangaDex API Response Validation

### Before: Type Assertion Without Validation

```typescript
// src/server/services/mangadex/manga.service.ts

async function searchManga(query: string, limit: number, offset: number): Promise<MangaSearch[]> {
  try {
    const response = await axios.get(`${MANGADEX_API_URL}/manga`, {
      params: { title: query, limit, offset }
    });
    
    // Unsafe: No validation before type assertion
    const results = response.data.data as MangaSearch[];
    return results;
  } catch (error) {
    logger.error(`MangaDex search error: ${error}`);
    return [];
  }
}
```

### After: Type Assertion With Validation

```typescript
// src/server/services/mangadex/manga.service.ts
import {
  isArray,
  isObject,
  hasProperty,
  isString
} from '@/utils/validation';

async function searchManga(query: string, limit: number, offset: number): Promise<MangaSearch[]> {
  try {
    const response = await axios.get(`${MANGADEX_API_URL}/manga`, {
      params: { title: query, limit, offset }
    });
    
    // Safe: validate the top-level response structure with the guard helpers
    // before using it (no `transformApiResponse` helper exists — validate inline).
    if (
      !isObject(response.data) ||
      !hasProperty(response.data, 'data') ||
      !isArray(response.data.data)
    ) {
      return []; // Fallback value if validation fails
    }

    // Further validate and transform each manga item
    return response.data.data
      .filter((item): item is Record<string, unknown> =>
        isObject(item) &&
        hasProperty(item, 'id') && isString(item.id) &&
        hasProperty(item, 'attributes') && isObject(item.attributes)
      )
      .map(item => {
        const attributes = item.attributes as Record<string, unknown>;

        // Transform to our internal MangaSearch type
        return {
          id: item.id as string,
          title: hasProperty(attributes, 'title') && isObject(attributes.title)
            ? extractTitle(attributes.title)
            : 'Unknown Title',
          // ... other fields with validation
        };
      });
  } catch (error) {
    logger.error(`MangaDex search error: ${error}`);
    return [];
  }
}

// Helper function to extract title from complex title object
function extractTitle(titleObj: Record<string, unknown>): string {
  // Try to get English title first, then fall back to other languages
  if (hasProperty(titleObj, 'en') && isString(titleObj.en)) {
    return titleObj.en;
  }
  
  // Look for any available title
  const titles = Object.values(titleObj).filter(isString);
  return titles.length > 0 ? titles[0] : 'Unknown Title';
}
```

## Example: Schema-based Validation

For more complex objects, we can define schemas:

```typescript
import { validateSchema, isString, isNumber, isArray, isBoolean } from '@/utils/validation';

// Define the schema for a manga object
const mangaSchema = {
  id: isString,
  title: isString,
  description: (val: unknown) => val === null || isString(val),
  status: isString,
  year: (val: unknown) => val === null || isNumber(val),
  contentRating: isString,
  tags: isArray,
  version: isNumber,
  isLocked: isBoolean
};

// Use the schema to validate an API response
function processMangaData(data: unknown): void {
  if (validateSchema(data, mangaSchema)) {
    // TypeScript now knows the shape of data matches the schema
    console.log(`Processing manga: ${data.title} (${data.id})`);
    
    // Safe to access all properties defined in the schema
    if (data.contentRating === 'safe') {
      // ...
    }
  } else {
    console.error('Invalid manga data received', data);
  }
}
```

## Example: Validating Nested Structures

For complex nested structures, we can compose validators:

```typescript
import { 
  isObject, 
  hasProperty, 
  isArray, 
  isString, 
  isNumber,
  validateProperties
} from '@/utils/validation';

// Validate a chapter response with nested relationships
function validateChapterResponse(data: unknown): boolean {
  // Check basic structure
  if (!isObject(data) || 
      !hasProperty(data, 'data') || 
      !isArray(data.data)) {
    return false;
  }
  
  // Check each chapter item
  for (const item of data.data) {
    // Check chapter structure
    if (!isObject(item) || 
        !hasProperty(item, 'id') || 
        !isString(item.id) || 
        !hasProperty(item, 'attributes') || 
        !isObject(item.attributes)) {
      return false;
    }
    
    // Check attributes
    const attrs = item.attributes;
    if (!validateProperties(attrs, ['volume', 'chapter', 'title', 'pages'])) {
      return false;
    }
    
    // Check relationships
    if (hasProperty(item, 'relationships') && isArray(item.relationships)) {
      for (const rel of item.relationships) {
        if (!isObject(rel) || 
            !hasProperty(rel, 'type') || 
            !isString(rel.type) ||
            !hasProperty(rel, 'id') || 
            !isString(rel.id)) {
          return false;
        }
      }
    }
  }
  
  return true;
}
```

## Benefits of Runtime Validation

1. **Bridges the Gap**: Ensures type safety between compile-time checks and runtime data
2. **Defensive Programming**: Protects against unexpected API changes or malformed data
3. **Self-Documenting**: Validation code clearly defines expected data structures
4. **Better Error Handling**: Provides specific validation failures for debugging
5. **Safe Transformation**: Ensures data is properly shaped before using it in the application

## Best Practices

1. Validate data as close to the source as possible (API boundaries)
2. Use fallback values for non-critical operations
3. Log validation failures with details for debugging
4. Create reusable schemas for common data structures
5. Combine compile-time TypeScript types with runtime validation