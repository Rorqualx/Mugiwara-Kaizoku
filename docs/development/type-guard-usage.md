# Type Guard Usage Guide

*Canonical: Yes*
*Status: Active*
*Last Updated: 2025-11-08*
*Related: [ESLint Rules](../eslint/eslint-rules-reference.md), [TypeScript Patterns](../typescript/typescript-patterns-guide.md)*

## Overview

This guide documents how to use the type guard infrastructure to fix `no-unsafe-member-access` ESLint violations. The infrastructure provides safe alternatives to `as any` type assertions through type guards, Zod schemas, and safe JSON parsing utilities.

## Problem Statement

The codebase has 3,222 `no-unsafe-member-access` violations, primarily caused by:

1. **Unsafe type assertions**: `as any` to bypass TypeScript checks
2. **Unvalidated JSON parsing**: `JSON.parse(str) as MyType`
3. **External API responses**: Accessing properties without validation
4. **Dynamic object access**: Using bracket notation without type guards

## Solution Architecture

The infrastructure consists of four main components:

### 1. Type Guards (`@/lib/type-guards`)

Runtime type checking functions that narrow TypeScript types safely.

### 2. Zod Schemas (`@/lib/validation/common-schemas`)

Runtime validation schemas for external API responses.

### 3. Common Types (`@/types/external-apis`)

TypeScript type definitions for external data structures.

### 4. Safe JSON Utilities (`@/lib/safe-wrappers/json`)

Safe wrappers for JSON operations with built-in error handling.

## Usage Patterns

### Pattern 1: Replacing Simple Type Assertions

**Before (unsafe):**
```typescript
function processData(data: unknown) {
  const obj = data as any;
  console.log(obj.title); // ❌ no-unsafe-member-access
}
```

**After (safe):**
```typescript
import { hasProperty } from '@/lib/type-guards';

function processData(data: unknown): void {
  if (hasProperty(data, 'title') && typeof data.title === 'string') {
    console.log(data.title); // ✅ Type-safe
  }
}
```

### Pattern 2: Checking Multiple Properties

**Before (unsafe):**
```typescript
function getMangaInfo(data: unknown) {
  const manga = data as any;
  return {
    id: manga.id,
    title: manga.title,
    author: manga.author
  }; // ❌ Multiple violations
}
```

**After (safe):**
```typescript
import { hasProperties } from '@/lib/type-guards';

function getMangaInfo(data: unknown): { id: number; title: string; author: string } | null {
  if (
    hasProperties(data, ['id', 'title', 'author']) &&
    typeof data.id === 'number' &&
    typeof data.title === 'string' &&
    typeof data.author === 'string'
  ) {
    return {
      id: data.id,
      title: data.title,
      author: data.author,
    };
  }
  return null;
}
```

### Pattern 3: Validating Arrays

**Before (unsafe):**
```typescript
function processTags(tags: unknown) {
  const tagArray = tags as any[];
  return tagArray.map((t: any) => t.toUpperCase()); // ❌ Violations
}
```

**After (safe):**
```typescript
import { isStringArray } from '@/lib/type-guards';

function processTags(tags: unknown): string[] {
  if (isStringArray(tags)) {
    return tags.map((t) => t.toUpperCase()); // ✅ Type-safe
  }
  return [];
}
```

### Pattern 4: Error Handling

**Before (unsafe):**
```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  const err = error as any;
  logger.error(err.message); // ❌ no-unsafe-member-access
}
```

**After (safe):**
```typescript
import { getErrorMessage, getErrorStack } from '@/lib/type-guards';

try {
  await riskyOperation();
} catch (error: unknown) {
  logger.error(getErrorMessage(error)); // ✅ Type-safe
  const stack = getErrorStack(error);
  if (stack) {
    logger.debug(stack);
  }
}
```

### Pattern 5: JSON Parsing Without Validation

**Before (unsafe):**
```typescript
function loadConfig(jsonString: string) {
  const config = JSON.parse(jsonString) as Config;
  return config.apiKey; // ❌ no-unsafe-member-access
}
```

**After (safe):**
```typescript
import { safeJSONParse } from '@/lib/safe-wrappers/json';
import { hasProperty } from '@/lib/type-guards';

function loadConfig(jsonString: string): string | null {
  const result = safeJSONParse(jsonString);

  if (result.success && hasProperty(result.data, 'apiKey')) {
    if (typeof result.data.apiKey === 'string') {
      return result.data.apiKey; // ✅ Type-safe
    }
  }

  return null;
}
```

### Pattern 6: JSON Parsing With Zod Validation

**Before (unsafe):**
```typescript
function parseUserData(jsonString: string) {
  const user = JSON.parse(jsonString) as UserData;
  return user.email; // ❌ no-unsafe-member-access
}
```

**After (safe):**
```typescript
import { z } from 'zod';
import { safeJSONParseWithSchema } from '@/lib/safe-wrappers/json';

const UserDataSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  age: z.number().optional(),
});

type UserData = z.infer<typeof UserDataSchema>;

function parseUserData(jsonString: string): string | null {
  const result = safeJSONParseWithSchema(jsonString, UserDataSchema);

  if (result.success) {
    return result.data.email; // ✅ Validated and type-safe
  }

  logger.error('User data validation failed:', result.error);
  return null;
}
```

### Pattern 7: External API Responses

**Before (unsafe):**
```typescript
async function fetchMangaFromAniList(id: number) {
  const response = await fetch(`https://api.anilist.co/manga/${id}`);
  const data = await response.json() as any;
  return {
    title: data.title.romaji,
    coverImage: data.coverImage.large
  }; // ❌ Multiple violations
}
```

**After (safe):**
```typescript
import { AniListMediaSchema } from '@/lib/validation/common-schemas';
import { validateData } from '@/lib/validation/common-schemas';

async function fetchMangaFromAniList(id: number): Promise<{ title: string; coverImage?: string } | null> {
  const response = await fetch(`https://api.anilist.co/manga/${id}`);
  const json = await response.text();

  const result = safeJSONParseWithSchema(json, AniListMediaSchema);

  if (result.success) {
    return {
      title: result.data.title.romaji,
      coverImage: result.data.coverImage?.large ?? undefined,
    }; // ✅ Validated
  }

  return null;
}
```

### Pattern 8: Provider Raw Data

**Before (unsafe):**
```typescript
function extractVolumes(rawData: string) {
  const data = JSON.parse(rawData) as any;
  return data.volumes.map((v: any) => ({
    title: v.title,
    number: v.number
  })); // ❌ Multiple violations
}
```

**After (safe):**
```typescript
import { RawProviderDataSchema } from '@/lib/validation/common-schemas';
import { safeJSONParseWithSchema } from '@/lib/safe-wrappers/json';

function extractVolumes(rawData: string): { title: string; number?: number }[] {
  const result = safeJSONParseWithSchema(rawData, RawProviderDataSchema);

  if (result.success && result.data.volumes) {
    return result.data.volumes.map((v) => ({
      title: v.title,
      number: v.number,
    })); // ✅ Validated
  }

  return [];
}
```

### Pattern 9: Nested Object Access

**Before (unsafe):**
```typescript
function getCoverImage(manga: unknown) {
  const data = manga as any;
  return data.metadata?.coverImage || data.images?.cover; // ❌ Violations
}
```

**After (safe):**
```typescript
import { hasProperty, isRecord } from '@/lib/type-guards';

function getCoverImage(manga: unknown): string | null {
  if (!isRecord(manga)) {
    return null;
  }

  // Check metadata.coverImage
  if (hasProperty(manga, 'metadata') && isRecord(manga.metadata)) {
    if (hasProperty(manga.metadata, 'coverImage') &&
        typeof manga.metadata.coverImage === 'string') {
      return manga.metadata.coverImage;
    }
  }

  // Check images.cover
  if (hasProperty(manga, 'images') && isRecord(manga.images)) {
    if (hasProperty(manga.images, 'cover') &&
        typeof manga.images.cover === 'string') {
      return manga.images.cover;
    }
  }

  return null;
}
```

### Pattern 10: Array of Objects

**Before (unsafe):**
```typescript
function extractTitles(items: unknown) {
  const arr = items as any[];
  return arr.map((item: any) => item.title); // ❌ Violations
}
```

**After (safe):**
```typescript
import { isRecordArray, hasTitle } from '@/lib/type-guards';

function extractTitles(items: unknown): string[] {
  if (!isRecordArray(items)) {
    return [];
  }

  return items
    .filter(hasTitle)
    .map((item) => item.title); // ✅ Type-safe
}
```

## Decision Tree

Use this flowchart to choose the right approach:

```
Is the data from JSON.parse()?
├─ Yes → Use safeJSONParse or safeJSONParseWithSchema
│
└─ No → Is it from an external API?
    ├─ Yes → Use Zod schema from common-schemas
    │        (or create a new schema)
    │
    └─ No → Is it a simple property check?
        ├─ Yes → Use hasProperty or hasProperties
        │
        └─ No → Is it an array?
            ├─ Yes → Use isStringArray, isNumberArray, or isRecordArray
            │
            └─ No → Is it error handling?
                ├─ Yes → Use getErrorMessage, getErrorStack
                │
                └─ No → Use appropriate type guard from @/lib/type-guards
```

## Common Type Guards Reference

### Object Checks

| Type Guard | Use Case | Example |
|------------|----------|---------|
| `hasProperty(obj, 'key')` | Single property | Check if object has `title` |
| `hasProperties(obj, ['id', 'name'])` | Multiple properties | Check if object has `id` and `name` |
| `isRecord(obj)` | Plain object | Verify object is not null/array |
| `isStringRecord(obj)` | String values | HTTP headers |
| `isNumberRecord(obj)` | Number values | Statistics object |

### Array Checks

| Type Guard | Use Case | Example |
|------------|----------|---------|
| `isStringArray(arr)` | String array | Tags, genres |
| `isNumberArray(arr)` | Number array | IDs, scores |
| `isRecordArray(arr)` | Object array | List of items |

### Common Structures

| Type Guard | Use Case | Example |
|------------|----------|---------|
| `hasTitle(obj)` | Has title property | Manga, chapter |
| `hasId(obj)` | Has id property | Database entity |
| `hasIdAndTitle(obj)` | Has both | Search result |

### Primitives

| Type Guard | Use Case | Example |
|------------|----------|---------|
| `isNonEmptyString(str)` | Non-empty string | User input |
| `isPositiveNumber(num)` | Positive number | Count, ID |
| `isValidUrl(url)` | URL validation | Cover image |

### Error Handling

| Function | Use Case | Example |
|----------|----------|---------|
| `isError(err)` | Check if Error | Catch block |
| `getErrorMessage(err)` | Extract message | Logging |
| `getErrorStack(err)` | Extract stack | Debugging |

## Common Zod Schemas Reference

### Provider Data

| Schema | Use Case |
|--------|----------|
| `RawProviderDataSchema` | Raw metadata from providers |
| `RawVolumeDataSchema` | Volume information |
| `RawChapterDataSchema` | Chapter information |

### External APIs

| Schema | Provider | Use Case |
|--------|----------|----------|
| `AniListMediaSchema` | AniList | Manga metadata |
| `ComicVineVolumeSchema` | ComicVine | Comic information |
| `MangaDexMangaSchema` | MangaDex | Manga data |

### Generic

| Schema | Use Case |
|--------|----------|
| `MetadataResponseSchema` | Generic metadata |
| `SearchResultSchema` | Search results |
| `PaginatedSearchResultsSchema` | Paginated results |

## Safe JSON Functions Reference

### Basic Parsing

| Function | Returns | Use Case |
|----------|---------|----------|
| `safeJSONParse(json)` | `ParseResult<T>` | Simple JSON parse |
| `safeJSONParseWithSchema(json, schema)` | `ParseResult<T>` | Parse + validate |
| `parseJSONOrNull(json)` | `T \| null` | Optional data |
| `parseJSONOrDefault(json, default)` | `T` | With fallback |

### Stringification

| Function | Returns | Use Case |
|----------|---------|----------|
| `safeStringify(value)` | `string` | Safe stringify |
| `safeStringifyWithResult(value)` | `ParseResult<string>` | With error info |

## Creating Custom Type Guards

When the built-in type guards don't fit your needs:

```typescript
// Define the expected structure
interface MangaMetadata {
  providerId: string;
  totalVolumes: number;
  status: string;
}

// Create a type guard
function isMangaMetadata(obj: unknown): obj is MangaMetadata {
  return (
    hasProperties(obj, ['providerId', 'totalVolumes', 'status']) &&
    typeof obj.providerId === 'string' &&
    typeof obj.totalVolumes === 'number' &&
    typeof obj.status === 'string'
  );
}

// Use it
function processMetadata(data: unknown): MangaMetadata | null {
  if (isMangaMetadata(data)) {
    return data; // ✅ Type-safe
  }
  return null;
}
```

## Creating Custom Zod Schemas

For complex or frequently-used structures:

```typescript
import { z } from 'zod';

// Define the schema
const MangaUpdateSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  status: z.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED']),
  lastChapter: z.number().optional(),
  metadata: z.object({
    coverImage: z.string().url().optional(),
    description: z.string().optional(),
  }).optional(),
});

// Infer the type
type MangaUpdate = z.infer<typeof MangaUpdateSchema>;

// Use it
function validateMangaUpdate(data: unknown): MangaUpdate | null {
  const result = MangaUpdateSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

## Performance Considerations

### Type Guards

- **Minimal overhead**: Type guards are simple runtime checks
- **Use early returns**: Check most likely failures first
- **Cache results**: Don't recheck the same data multiple times

```typescript
// ✅ Good - early return
function processItem(item: unknown): string | null {
  if (!hasTitle(item)) return null; // Fast fail
  // Continue with validated item
  return item.title;
}

// ❌ Bad - unnecessary nesting
function processItem(item: unknown): string | null {
  if (hasTitle(item)) {
    if (item.title) {
      return item.title;
    }
  }
  return null;
}
```

### Zod Schemas

- **Reuse schemas**: Don't create new schemas for each validation
- **Use `.safeParse()`**: Prevents throwing errors
- **Consider `.passthrough()`**: For partially-known objects

```typescript
// ✅ Good - reuse schema
const schema = UserSchema; // Defined once
const result1 = schema.safeParse(data1);
const result2 = schema.safeParse(data2);

// ❌ Bad - recreate schema
const result1 = z.object({ name: z.string() }).safeParse(data1);
const result2 = z.object({ name: z.string() }).safeParse(data2);
```

## Testing

Always test your type guards and schemas:

```typescript
import { describe, it, expect } from '@jest/globals';
import { hasTitle, isStringArray } from '@/lib/type-guards';

describe('hasTitle', () => {
  it('should return true for object with string title', () => {
    expect(hasTitle({ title: 'Test' })).toBe(true);
  });

  it('should return false for object with non-string title', () => {
    expect(hasTitle({ title: 123 })).toBe(false);
  });

  it('should return false for object without title', () => {
    expect(hasTitle({ name: 'Test' })).toBe(false);
  });
});
```

## Migration Checklist

When fixing a `no-unsafe-member-access` violation:

- [ ] Identify the source of the unknown data
- [ ] Choose appropriate solution (type guard vs Zod schema)
- [ ] Implement the fix with proper error handling
- [ ] Remove the `as any` assertion
- [ ] Test the fix with valid and invalid data
- [ ] Update related code if needed
- [ ] Verify ESLint violation is resolved

## Common Pitfalls

### ❌ Don't Skip Validation

```typescript
// ❌ Bad - assumes data is valid
function getTitle(data: unknown): string {
  return (data as any).title; // Still unsafe!
}

// ✅ Good - validates first
function getTitle(data: unknown): string | null {
  if (hasTitle(data)) {
    return data.title;
  }
  return null;
}
```

### ❌ Don't Use Loose Checks

```typescript
// ❌ Bad - doesn't verify type
if (hasProperty(obj, 'count')) {
  const count: number = obj.count; // Might not be number!
}

// ✅ Good - verify type
if (hasProperty(obj, 'count') && typeof obj.count === 'number') {
  const count: number = obj.count; // Safe
}
```

### ❌ Don't Ignore Parse Failures

```typescript
// ❌ Bad - ignores errors
const result = safeJSONParse(jsonString);
if (result.success) {
  return result.data;
}
// What happens if it fails?

// ✅ Good - handles errors
const result = safeJSONParse(jsonString);
if (result.success) {
  return result.data;
}
logger.error('JSON parse failed:', result.error);
return null;
```

## Related Documentation

- [ESLint Rules Reference](../eslint/eslint-rules-reference.md) - All ESLint rules
- [TypeScript Patterns Guide](../typescript/typescript-patterns-guide.md) - Advanced TypeScript
- [Error Handling Guide](../user-guides/error-handling-comprehensive-guide.md) - Error patterns
- [AsyncResult Pattern](../user-guides/asyncresult-pattern-complete-guide.md) - Result types
- [Security Guide](./security-guide.md) - Input validation

## Examples in Codebase

Search for existing usage:

```bash
# Find type guard usage
ast-grep --pattern 'hasProperty($OBJ, $KEY)' src/

# Find Zod schema usage
ast-grep --pattern 'safeJSONParseWithSchema($$$)' src/

# Find safe JSON parsing
ast-grep --pattern 'safeJSONParse($$$)' src/
```

## Questions?

- Check existing examples in the codebase
- Review the test files for usage patterns
- Consult [TypeScript Patterns Guide](../typescript/typescript-patterns-guide.md)
- See [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) for strict rules

---

*This is a living document. Update it as new patterns emerge.*
