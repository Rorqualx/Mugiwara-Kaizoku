# TypeScript Implementation Guide

This guide provides practical instructions for implementing the fixes outlined in the TypeScript Error Correction Plan. It includes step-by-step processes, examples, and code snippets for developers to follow.

## Getting Started

### Prerequisites

1. Ensure you have the latest repository code
2. Install required dependencies: `bun install`
3. Familiarize yourself with the TypeScript error correction plan
4. Read the TypeScript error patterns document

### Development Environment Setup

1. Use VSCode with the following extensions:
   - ESLint
   - TypeScript Error Translator
   - TypeScript Hero
   - Error Lens

2. Configure TypeScript settings in VSCode:
   ```json
   {
     "typescript.tsdk": "node_modules/typescript/lib",
     "typescript.enablePromptUseWorkspaceTsdk": true,
     "typescript.updateImportsOnFileMove.enabled": "always",
     "typescript.preferences.importModuleSpecifier": "non-relative",
     "typescript.preferences.quoteStyle": "single",
     "typescript.suggest.completeFunctionCalls": true,
     "typescript.tsserver.experimental.enableProjectDiagnostics": true
   }
   ```

3. Run the type checking command to see current errors:
   ```bash
   bun run typecheck
   ```

## Implementation Process

### Phase 1: Core Type Definitions

#### Step 1: Standardize Domain Types

1. Review existing domain types in `src/types/domain/`
2. Ensure consistent naming conventions
3. Implement proper type exports in index files

Example consolidation:

```typescript
// src/types/domain/index.ts

/**
 * Domain Types Index
 * 
 * This file exports all domain type definitions from a central location
 * to provide a clean import pattern and avoid circular dependencies.
 */

// Re-export all domain types
export * from './manga-types';
export * from './chapter-types';
export * from './library-types';
export * from './user-types';
export * from './provider-types';
export * from './task-types';

// Export type-only namespaces for organizing imports
export namespace Domain {
  export * from './manga-types';
  export * from './chapter-types';
  export * from './library-types';
  export * from './user-types';
  export * from './provider-types';
  export * from './task-types';
}
```

#### Step 2: Create Mapping Functions

For each enum or type that has multiple representations:

1. Create a dedicated mapping file in `src/utils/mapping/`
2. Implement bidirectional mapping functions
3. Add type guards and validation

Example for MangaStatus:

```typescript
// src/utils/mapping/status-mapping.ts

import { MangaStatus } from '@/types/domain/manga-types';
import { MangaStatus as PrismaMangaStatus } from '@prisma/client';

/**
 * Maps Prisma schema status to domain model status
 */
export function mapPrismaToDomainStatus(status: PrismaMangaStatus): MangaStatus {
  switch (status) {
    case 'ONGOING': return MangaStatus.ONGOING;
    case 'COMPLETED': return MangaStatus.COMPLETED;
    case 'CANCELLED': return MangaStatus.CANCELLED;
    case 'HIATUS': return MangaStatus.HIATUS;
    default: return MangaStatus.UNKNOWN;
  }
}

/**
 * Maps domain model status to Prisma schema status
 */
export function mapDomainToPrismaStatus(status: MangaStatus): PrismaMangaStatus {
  switch (status) {
    case MangaStatus.ONGOING: return 'ONGOING';
    case MangaStatus.COMPLETED: return 'COMPLETED';
    case MangaStatus.CANCELLED: return 'CANCELLED';
    case MangaStatus.HIATUS: return 'HIATUS';
    default: return 'UNKNOWN';
  }
}

/**
 * Maps any string status to domain model status
 */
export function stringToDomainStatus(status: string): MangaStatus {
  const normalized = status.toLowerCase();
  
  switch (normalized) {
    case 'ongoing':
    case 'publishing':
    case 'serialization':
    case 'active':
      return MangaStatus.ONGOING;
      
    case 'completed':
    case 'finished':
    case 'ended':
      return MangaStatus.COMPLETED;
      
    case 'cancelled':
    case 'canceled':
    case 'discontinued':
      return MangaStatus.CANCELLED;
      
    case 'hiatus':
    case 'on hold':
    case 'paused':
      return MangaStatus.HIATUS;
      
    default:
      return MangaStatus.UNKNOWN;
  }
}

/**
 * Type guard for MangaStatus
 */
export function isMangaStatus(value: unknown): value is MangaStatus {
  return typeof value === 'string' && Object.values(MangaStatus).includes(value as MangaStatus);
}
```

#### Step 3: Implement Type Guards

Create comprehensive type guards for core entities:

```typescript
// src/utils/type-guards/manga-guards.ts

import { MangaEntity, MangaMetadata } from '@/types/domain/manga-types';
import { isObject, hasProperty, isString, isNumber, isArray } from '@/utils/type-guards/basic-guards';

/**
 * Type guard for MangaMetadata
 */
export function isMangaMetadata(value: unknown): value is MangaMetadata {
  return (
    isObject(value) &&
    hasProperty(value, 'title', isString) &&
    (!hasProperty(value, 'alternativeTitles') || isArray(value.alternativeTitles, isString)) &&
    (!hasProperty(value, 'description') || isString(value.description)) &&
    (!hasProperty(value, 'coverUrl') || isString(value.coverUrl)) &&
    (!hasProperty(value, 'chapters') || isNumber(value.chapters))
  );
}

/**
 * Type guard for MangaEntity
 */
export function isMangaEntity(value: unknown): value is MangaEntity {
  return (
    isObject(value) &&
    hasProperty(value, 'id') &&
    hasProperty(value, 'title', isString) &&
    hasProperty(value, 'status') &&
    hasProperty(value, 'libraryId', isNumber) &&
    hasProperty(value, 'metadata', isMangaMetadata)
  );
}
```

### Phase 2: API and Service Layer

#### Step 1: Fix API Client Implementations

For each API client:

1. Define proper interfaces for all responses
2. Implement proper error handling
3. Replace type assertions with mapping functions

Example:

```typescript
// BEFORE
async getManga(id: string): Promise<Manga> {
  const response = await this.get<any>(`/manga/${id}`);
  return {
    id: response.id,
    title: response.title,
    status: response.status as MangaStatus,
    // other properties
  };
}

// AFTER
interface MangaResponse {
  id: string;
  title: string;
  status: string;
  // other properties
}

async getManga(id: string): Promise<Manga> {
  const response = await this.get<MangaResponse>(`/manga/${id}`);
  return {
    id: response.id,
    title: response.title,
    status: stringToDomainStatus(response.status),
    // other properties with proper conversion
  };
}
```

#### Step 2: Fix Configuration Services

For each configuration service:

1. Create proper interfaces for configuration data
2. Add safe property access patterns
3. Implement proper type narrowing

Example:

```typescript
// BEFORE
const metadata = typeof settings.metadata === 'string'
  ? JSON.parse(settings.metadata)
  : settings.metadata;

const useEnhancedProvider = metadata.providers.anilist.useEnhancedProvider === true;

// AFTER
interface ConfigMetadata {
  providers?: {
    anilist?: {
      useEnhancedProvider?: boolean;
    };
  };
}

let metadata: ConfigMetadata | undefined;

try {
  metadata = typeof settings?.metadata === 'string'
    ? JSON.parse(settings.metadata) as ConfigMetadata
    : settings?.metadata as ConfigMetadata | undefined;
} catch (error) {
  logger.error(`Error parsing metadata JSON: ${error}`);
}

const useEnhancedProvider = metadata?.providers?.anilist?.useEnhancedProvider === true;
```

### Phase 3: Component and UI Layer

#### Step 1: Fix Component Props

For each component:

1. Define proper prop interfaces
2. Add default props where appropriate
3. Use proper React types

Example:

```typescript
// BEFORE
function MangaCard(props: any) {
  const { manga, onClick } = props;
  // implementation
}

// AFTER
interface MangaCardProps {
  manga: MangaEntity;
  onClick?: (manga: MangaEntity) => void;
  isSelected?: boolean;
  className?: string;
}

function MangaCard({ 
  manga, 
  onClick, 
  isSelected = false, 
  className = '' 
}: MangaCardProps) {
  // implementation
}
```

#### Step 2: Fix Hook Implementations

For each hook:

1. Define proper return types
2. Implement proper state typing
3. Fix AsyncResult usage

Example:

```typescript
// BEFORE
export function useLibrary(libraryId: number) {
  const [library, setLibrary] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  
  // implementation
  
  return { library, loading, error };
}

// AFTER
interface UseLibraryResult {
  library: LibraryWithManga | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useLibrary(libraryId: number): UseLibraryResult {
  const [library, setLibrary] = useState<LibraryWithManga | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // implementation
  
  return { library, loading, error, reload };
}
```

### Phase 4: System-wide Cleanup

#### Step 1: Eliminate Remaining `any` Usage

For each remaining `any` usage:

1. Replace with appropriate types
2. Use `unknown` with type guards where needed
3. Implement proper validation

Example:

```typescript
// BEFORE
function processData(data: any) {
  return data.result;
}

// AFTER
interface DataWithResult {
  result: string;
  [key: string]: unknown;
}

function processData(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data provided');
  }
  
  const typedData = data as Record<string, unknown>;
  
  if (!('result' in typedData) || typeof typedData.result !== 'string') {
    throw new Error('Data missing result property');
  }
  
  return typedData.result;
}
```

#### Step 2: Address Non-null Assertions

For each non-null assertion:

1. Add proper null checking
2. Use optional chaining where appropriate
3. Add fallback values where needed

Example:

```typescript
// BEFORE
function getUserName(user: User | null): string {
  return user!.name;
}

// AFTER
function getUserName(user: User | null): string {
  if (!user) {
    throw new Error('User is null');
  }
  return user.name;
}

// OR with default value
function getUserName(user: User | null): string {
  return user?.name ?? 'Unknown User';
}
```

## Testing Your Changes

After implementing fixes:

1. Run type checking:
   ```bash
   bun run typecheck
   ```

2. Run unit tests:
   ```bash
   bun run test
   ```

3. Run the application locally:
   ```bash
   bun run dev
   ```

4. Verify no regressions in functionality

## Pull Request Guidelines

When submitting pull requests for type fixes:

1. Focus on a single module or related files
2. Include detailed descriptions of changes
3. Reference the specific error patterns addressed
4. Add tests for critical type fixes
5. Update documentation if needed

Example PR description:

```
Fix TypeScript errors in API client implementations

This PR addresses TypeScript errors in the following files:
- src/api/metadataProviders/comicvineClient.ts
- src/api/metadataProviders/fandomClient.ts

Changes include:
- Added proper type interfaces for API responses
- Replaced unsafe type assertions with mapping functions
- Implemented type guards for validation
- Added proper error handling with typed errors

These changes address the "Type Assertions Without Validation" pattern
identified in the TypeScript Error Patterns document.

Tests have been updated to ensure compatibility with the new types.
```

## Common Pitfalls to Avoid

1. **Over-restrictive Types**  
   Don't make types too restrictive when working with external APIs or libraries.

2. **Excessive Type Assertions**  
   Avoid replacing one type assertion with another; use proper validation.

3. **Ignoring Edge Cases**  
   Consider all possible states, especially for nullable or optional values.

4. **Breaking API Compatibility**  
   Ensure changes maintain compatibility with existing code.

5. **Forgetting Documentation**  
   Update comments and documentation when changing types.

## Conclusion

By following this implementation guide, you'll be able to systematically address TypeScript errors in the codebase. Remember to focus on one module at a time, validate your changes thoroughly, and maintain consistency with the established patterns.