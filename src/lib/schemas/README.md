# External API Schemas & Type-Safe Client

This directory contains Zod schemas and utilities for type-safe external API calls.

## 📚 Overview

When fetching data from external APIs (AniList, ComicVine, Fandom, etc.), we need **runtime validation** to ensure the data matches our expectations. This prevents crashes from:
- Missing fields
- Unexpected null values
- Type mismatches
- API changes

## 🏗️ Architecture

```
src/lib/
├── schemas/
│   ├── index.ts        # Main exports
│   ├── common.ts       # Reusable schema patterns
│   ├── anilist.ts      # AniList-specific schemas
│   └── README.md       # This file
└── api-client.ts       # Type-safe fetch utilities
```

## 🚀 Quick Start

### 1. Basic Usage

```typescript
import { fetchJSON } from '@/lib/api-client';
import { AniListMediaSchema } from '@/lib/schemas';

// Type-safe API call with validation
const manga = await fetchJSON({
  url: 'https://graphql.anilist.co',
  method: 'POST',
  body: {
    query: `query ($id: Int) { Media(id: $id) { id title { romaji } } }`,
    variables: { id: 123 },
  },
  schema: AniListMediaQueryResponseSchema,
});

// manga is now typed and validated!
// TypeScript knows all fields exist
console.log(manga.data?.Media?.title?.romaji);
```

### 2. GraphQL Helper

```typescript
import { fetchGraphQL } from '@/lib/api-client';
import { AniListMediaQueryResponseSchema } from '@/lib/schemas';

const response = await fetchGraphQL({
  url: 'https://graphql.anilist.co',
  query: `query ($id: Int) { Media(id: $id) { ... } }`,
  variables: { id: 123 },
  schema: AniListMediaQueryResponseSchema,
});
```

### 3. Lenient Validation

For non-critical data where you want graceful degradation:

```typescript
import { fetchJSONLenient } from '@/lib/api-client';
import { OptionalDataSchema } from '@/lib/schemas';

const data = await fetchJSONLenient({
  url: 'https://api.example.com/optional',
  schema: OptionalDataSchema,
});

if (data) {
  // Use data
} else {
  // Handle failure gracefully (validation failed)
}
```

## 📖 Creating Schemas

### Common Patterns

Use helper schemas from `common.ts`:

```typescript
import {
  NullableString,
  NullableNumber,
  createDefaultArraySchema,
  createLenientSchema,
} from '@/lib/schemas/common';

// Lenient object (allows extra fields)
const MySchema = createLenientSchema({
  id: z.number(),
  title: NullableString,           // string | null → string | undefined
  tags: createDefaultArraySchema(z.string()), // null → []
});
```

### Provider-Specific Schemas

Create a new file for each external API provider:

```typescript
// src/lib/schemas/comicvine.ts
import { z } from 'zod';
import { createLenientSchema, NullableString, IdSchema } from './common';

export const ComicVineVolumeSchema = createLenientSchema({
  id: IdSchema,
  name: NullableString,
  description: NullableString,
  // ... more fields
});

export type ComicVineVolume = z.infer<typeof ComicVineVolumeSchema>;
```

Then export from `index.ts`:

```typescript
// src/lib/schemas/index.ts
export * from './comicvine';
```

## 🔧 Migration Guide

### Before (Unsafe)

```typescript
// ❌ No validation - any field could be missing/wrong type
async function fetchManga(id: number): Promise<any> {
  const response = await fetch(`https://api.example.com/manga/${id}`);
  const data = await response.json(); // any type!
  return data;
}

// Runtime crash if data.title doesn't exist!
const manga = await fetchManga(123);
console.log(manga.title.toUpperCase());
```

### After (Safe)

```typescript
// ✅ Runtime validation + type safety
import { fetchJSON } from '@/lib/api-client';
import { MangaSchema } from '@/lib/schemas';

async function fetchManga(id: number): Promise<Manga> {
  return fetchJSON({
    url: `https://api.example.com/manga/${id}`,
    schema: MangaSchema,
  });
}

// TypeScript + Runtime guarantees title exists
const manga = await fetchManga(123);
console.log(manga.title.toUpperCase()); // Safe!
```

## 🎯 ESLint Violation Fixes

This infrastructure fixes **@typescript-eslint/no-unsafe-argument** violations:

### Pattern 1: Direct API Calls

```typescript
// ❌ BEFORE: Unvalidated external data
const response = await axios.post(url, body);
someFunction(response.data); // unsafe-argument violation!

// ✅ AFTER: Validated with schema
const data = await fetchJSON({ url, body, schema: MySchema });
someFunction(data); // Type-safe!
```

### Pattern 2: GraphQL Queries

```typescript
// ❌ BEFORE: Generic unknown type
const data = await client.query<{ Media: unknown }>(query);
processMedia(data.Media); // unsafe-argument violation!

// ✅ AFTER: Validated schema
const response = await fetchGraphQL({
  url,
  query,
  schema: AniListMediaQueryResponseSchema,
});
processMedia(response.data?.Media); // Type-safe!
```

## 📊 Impact

**Violations Fixed**: Targets 295/1,093 no-unsafe-argument violations (27%)

**Priority**: P0 - Critical Security (unvalidated external data)

**Benefits**:
- ✅ Runtime type safety for external APIs
- ✅ Clear error messages when validation fails
- ✅ TypeScript autocomplete for API responses
- ✅ Prevents crashes from missing/wrong fields
- ✅ Documents expected API structure

## 🔍 Debugging

### Validation Errors

When validation fails, check the logs:

```typescript
// Logs include:
// - URL that failed
// - Zod validation errors (which fields failed)
// - First 500 characters of raw response
```

### Disable Logging

For endpoints where failures are expected:

```typescript
const data = await fetchJSON({
  url,
  schema: MySchema,
  logValidationErrors: false, // Don't log validation failures
});
```

## 🚦 Next Steps

1. **Add More Providers**: Create schema files for:
   - ComicVine (`comicvine.ts`)
   - Fandom (`fandom.ts`)
   - Wikipedia (`wikipedia.ts`)
   - MyAnimeList (`myanimelist.ts`)

2. **Migrate Existing Code**: Replace unsafe API calls with typed versions

3. **Add Tests**: Write tests for schema validation

## 📝 Examples

See real-world examples in:
- `src/server/services/anilist/` - AniList integration (proof-of-concept)
- Future: `src/server/services/comicvine/` - ComicVine integration
- Future: `src/server/services/fandom/` - Fandom integration

## 🤝 Contributing

When adding schemas:
1. Use `createLenientSchema()` for external APIs (allows extra fields)
2. Use nullable helpers (`NullableString`, `NullableNumber`)
3. Use `createDefaultArraySchema()` for arrays that might be null
4. Export types: `export type MyType = z.infer<typeof MySchema>`
5. Add JSDoc comments for better DX

---

**Created**: 2025-11-09
**Status**: Active (Phase 2 - Foundation Complete)
**Related**: High-Impact ESLint Strategy - Phase 2 (External API Validation)
