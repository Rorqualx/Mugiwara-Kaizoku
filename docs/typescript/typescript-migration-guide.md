# Typescript Migration Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Migration Guide

---
# TypeScript Migration Guide

This guide outlines the process for migrating from legacy compatibility layers to the new standardized type system in the Mugiwara-Kaizoku application.

## Overview

We're transitioning from a compatibility-layer approach with multiple type assertion utilities to a more direct, standardized type system. This migration will:

1. Reduce unnecessary abstractions
2. Improve type safety
3. Make the codebase more maintainable
4. Simplify onboarding for new developers
5. Provide better IDE support and autocomplete

## New Type System Architecture

The new type system is organized into distinct categories:

### 1. Domain Types (`src/types/domain/`)

Domain types represent core business entities and concepts. They are organized by domain area:

- `manga-types.ts`: Core manga entity types
- `chapter-types.ts`: Chapter and volume types
- `library-types.ts`: Library and collection types
- `user-types.ts`: User and authentication types
- `provider-types.ts`: Metadata provider types
- `task-types.ts`: Background task types

### 2. API Types (`src/types/api/`)

API types represent request and response structures:

- `requests.ts`: Type definitions for API request payloads
- `responses.ts`: Type definitions for API response structures
- `error-types.ts`: Standardized error response types

### 3. Shared Types (`src/types/shared-types.ts`)

Common utility types used across the application:

- Base interfaces (BaseEntity, Timestamps)
- Common enums (Status, Priority, ErrorType)
- Utility types (Optional, Required, PickProps, etc.)
- Pagination and filtering structures

### 4. Validation Utilities (`src/utils/validation/`)

Direct validation utilities that replace the compatibility layers:

- `type-guards.ts`: Runtime type checking functions
- `schema-validation.ts`: Schema-based validation
- `data-validators.ts`: Domain-specific validators
- `safe-json.ts`: Safe JSON parsing with validation

## Recent Migration Updates

We've made significant progress in migrating several key components to use our new domain types directly:

### Updated Components

1. `chaptersTable.tsx`: Now uses `ChapterEntity` from domain types
2. `volumeChaptersTable.tsx`: Completely refactored to use `ChapterEntity` and handle the new structure
3. `virtualizedVolumeList.tsx`: Updated to use `ChapterEntity` for efficient volume rendering

### Updated Hooks

1. `useLibrary.ts`: Now uses `LibraryEntity` from domain types

### Updated Store and Type Definitions

1. `store-types.ts`: All store types now use domain entities directly
2. `clientTypes.ts`: Updated to import and re-export domain types, with legacy aliases for backward compatibility

### Key Changes in Component Structure

When migrating components, note these important structural differences:

**Chapter Structure Changes:**
- Legacy: `chapter.fileName`, `chapter.size`
- New: `chapter.file?.fileName`, `chapter.file?.size`

**Status Enums:**
- Legacy: String constants like `'COMPLETED'`
- New: Use the appropriate enum from domain types, e.g., `ChapterStatus.DOWNLOADED`

## Migration Steps

### 1. Replace Compatibility Layer Imports

**Before:**

```typescript
import { typeCheck, assertType } from '../utils/type-guards';
import { compatValidate } from '../utils/runtime-validation';
import { transformData } from '../utils/legacy-compatibility';
```

**After:**

```typescript
import { Domain, API } from '../types';
import { TypeGuards, SchemaValidation } from '../utils/validation';
```

### 2. Use Direct Type Definitions

**Before:**

```typescript
import { MangaType } from '../utils/legacy-compatibility';

function updateManga(manga: MangaType) {
  // ...
}
```

**After:**

```typescript
import { Domain } from '../types';

function updateManga(manga: Domain.MangaEntity) {
  // ...
}
```

### 3. Replace Type Assertions with Type Guards

**Before:**

```typescript
const data = await fetchData();
const manga = assertType<MangaType>(data);
```

**After:**

```typescript
import { DataValidators } from '../utils/validation';

const data = await fetchData();
if (DataValidators.isMangaEntity(data)) {
  // data is now typed as Domain.MangaEntity
  processManga(data);
} else {
  handleInvalidData();
}
```

### 4. Replace Schema Validation

**Before:**

```typescript
import { validateSchema } from '../utils/runtime-validation';

const schema = {
  // ...complex schema definition
};

const isValid = validateSchema(data, schema);
```

**After:**

```typescript
import { SchemaValidation } from '../utils/validation';

const schema: SchemaValidation.ValidationSchema = {
  title: SchemaValidation.string({ required: true }),
  chapters: SchemaValidation.number({ integer: true, min: 0 })
  // ...
};

const result = SchemaValidation.validateSchema(data, schema);
if (result.valid) {
  // Process valid data
} else {
  // Handle validation errors
  console.error(result.errors);
}
```

### 5. Replace JSON Parsing

**Before:**

```typescript
import { safeParseJSON } from '../utils/safe-json';

const result = safeParseJSON(jsonString);
if (result.success) {
  processData(result.value);
}
```

**After:**

```typescript
import { SafeJson } from '../utils/validation';

const result = SafeJson.safeParseJson(jsonString);
if (result.success) {
  processData(result.data);
}
```

### 6. Update API Client Code

#### Basic Type Imports

**Before:**

```typescript
import { ApiResponse } from '../utils/legacy-compatibility';

async function fetchManga(id: number): Promise<ApiResponse<MangaType>> {
  // ...
}
```

**After:**

```typescript
import { API, Domain } from '../types';

async function fetchManga(id: number): Promise<API.MangaResponses.Single> {
  // ...
}
```

#### AsyncResult Pattern

The new standardized type system introduces the AsyncResult pattern for better error handling and type safety in asynchronous operations:

**Before:**

```typescript
async function fetchManga(id: number): Promise<Manga> {
  try {
    const response = await apiClient.get(`/manga/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching manga: ${error.message}`);
    throw error;
  }
}
```

**After:**

```typescript
import { AsyncResult } from '@/types/shared-types';
import { MangaEntity } from '@/types/domain';

async function fetchManga(id: number): Promise<AsyncResult<MangaEntity>> {
  try {
    const response = await apiClient.get(`/manga/${id}`);
    return { 
      success: true, 
      data: response.data 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      success: false, 
      error: new Error(`Error fetching manga: ${errorMessage}`),
      data: null // Optional fallback data
    };
  }
}
```

This pattern provides several benefits:
- No exceptions to handle in calling code
- Clear success/failure status
- Type-safe error objects
- Optional fallback data
- Better composability in async operations

## Migration Examples

### Chapter Table Component Migration

**Before:**

```typescript
import type { Chapter } from "@/types/prismaTypes";

interface ChaptersTableProps {
  manga: {
    chapters: Chapter[];
  };
}

export function ChaptersTable({ manga }: ChaptersTableProps) {
  return (
    <DataTable
      records={manga.chapters}
      columns={[
        {
          accessor: "fileName",
          render: (record: Chapter) => (
            <span>{record.fileName}</span>
          ),
        },
        {
          accessor: "size",
          render: (record: Chapter) => (
            <span>{prettyBytes(record.size)}</span>
          ),
        }
      ]}
    />
  );
}
```

**After:**

```typescript
import type { ChapterEntity } from "@/types/domain";

interface ChaptersTableProps {
  manga: {
    chapters: ChapterEntity[];
  };
}

export function ChaptersTable({ manga }: ChaptersTableProps) {
  return (
    <DataTable
      records={manga.chapters}
      columns={[
        {
          accessor: "fileName",
          render: (record: ChapterEntity) => (
            <span>{record.file?.fileName}</span>
          ),
        },
        {
          accessor: "size",
          render: (record: ChapterEntity) => (
            <span>{prettyBytes(record.file?.size || 0)}</span>
          ),
        }
      ]}
    />
  );
}
```

### Library Hook Migration

**Before:**

```typescript
import type { Library } from '../types/prismaTypes';

export function useLibrary(): {
  libraries: Library[];
  createLibrary: (path: string) => Promise<Library>;
} {
  // Implementation...
}
```

**After:**

```typescript
import type { LibraryEntity } from '@/types/domain';

export function useLibrary(): {
  libraries: LibraryEntity[];
  createLibrary: (path: string) => Promise<LibraryEntity>;
} {
  // Implementation...
}
```

## Common Migration Patterns

### 1. Type Casting → Type Guards

Replace:

```typescript
const metadata = data as MangaMetadata;
```

With:

```typescript
import { TypeGuards } from '../utils/validation';

if (TypeGuards.isObject(data) && TypeGuards.hasProperty(data, 'title')) {
  const metadata = data as Domain.MangaMetadata;
  // ...
}
```

### 2. Any → Specific Types

Replace:

```typescript
function processManga(data: any) {
  // ...
}
```

With:

```typescript
function processManga(data: Domain.MangaEntity) {
  // ...
}
```

### 3. Manual Validation → Schema Validation

Replace:

```typescript
function isValidManga(manga: unknown): boolean {
  if (typeof manga !== 'object' || manga === null) return false;
  if (!('title' in manga)) return false;
  if (typeof manga.title !== 'string') return false;
  // ...more checks
  return true;
}
```

With:

```typescript
import { DataValidators } from '../utils/validation';

function isValidManga(manga: unknown): boolean {
  return DataValidators.isMangaEntity(manga);
}
```

## Migration Strategy

1. **Start with Domain Entities**: Update core domain entities first
2. **Update API Layer**: Implement the new types in API clients and endpoints
3. **Update Component Props**: Update React component prop types
4. **Address Type Assertions**: Replace type assertions with proper validation
5. **Update Utility Functions**: Migrate utility functions to use the new type system
6. **Remove Legacy Imports**: Remove all imports from legacy compatibility files

## Testing During Migration

1. Run TypeScript type checking (`npm run typecheck`) frequently
2. Add unit tests for type guards and validators
3. Test both success and failure cases for validation
4. Verify API responses match the expected types

## Detecting Deprecated Imports

We've added ESLint rules to identify deprecated imports:

```bash
# Run ESLint with the deprecated imports configuration
npx eslint . --config .eslintrc.deprecated.js --ext .ts,.tsx
```

This will warn about usage of deprecated utilities and suggest alternatives. We also have a GitHub Actions workflow that automatically generates a report of deprecated imports in pull requests.

If you see warnings about deprecated imports, please update your code to use the new standardized utilities.

## Recommended Tools

- TypeScript Language Server: Provides immediate feedback on type issues
- ESLint with TypeScript rules: Enforces type safety practices
- Jest for testing validators

## Best Practices

1. **Explicit Types**: Use explicit type annotations for function parameters and return types
2. **Validation at Boundaries**: Always validate data at system boundaries (API, file I/O)
3. **Avoid Type Assertions**: Use type guards instead of type assertions (`as`)
4. **Centralized Types**: Import types from the centralized type system
5. **Error Handling**: Use the standardized error handling system
6. **Documentation**: Add JSDoc comments to types and functions

## Need Help?

If you have questions or encounter issues during migration, please:

1. Check the architecture documentation in `docs/standardized-type-system.md`
2. Review the type definitions in `src/types/`
3. Look at validation examples in `src/utils/validation/`
4. Reach out to the development team on Slack

## Frequently Asked Questions

### Why are we moving away from compatibility layers?

Compatibility layers added unnecessary complexity and indirection. The new approach provides more direct, explicit typing that's easier to understand and maintain.

### Do I need to migrate all code at once?

No, the migration can be gradual. Focus on new code and critical areas first, then progressively update existing code.

### What if I need to handle dynamic data that doesn't fit the type system?

Use type guards and schema validation to safely narrow dynamic data to the appropriate types. If needed, create utility functions for specific transformation needs.

### How do I create a new type that doesn't exist in the domain models?

First, check if the type should be added to the domain models. If it's a temporary or very specific type, create a local type definition in your module. Avoid creating new parallel type systems.

### How do I handle the new ChapterEntity structure?

Note that ChapterEntity has a more structured approach compared to the legacy Chapter type:
- File properties are now in a `file` object: `chapter.file?.fileName` instead of `chapter.fileName`
- Status values use enums instead of strings: `ChapterStatus.DOWNLOADED` instead of `'COMPLETED'`
- Always check if properties exist before accessing them, especially for optional fields