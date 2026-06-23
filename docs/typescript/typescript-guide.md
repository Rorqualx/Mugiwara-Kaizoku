# TypeScript Guide

This guide consolidates all TypeScript-related documentation for the Mugiwara-Kaizoku project, including configuration, patterns, best practices, and migration strategies.

## Table of Contents

1. [Configuration](#configuration)
2. [Type System Architecture](#type-system-architecture)
3. [Best Practices](#best-practices)
4. [Common Patterns](#common-patterns)
5. [Error Resolution](#error-resolution)
6. [Migration Strategy](#migration-strategy)
7. [Testing](#testing)
8. [Resources](#resources)

## Configuration

### Main Configuration (tsconfig.json)

The project uses TypeScript with strict type checking enabled:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "types": ["bun-types", "node", "jest"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "skipLibCheck": true
  }
}
```

### Key Configuration Features

- **Strict Mode**: All strict checks are enabled for maximum type safety
- **Path Aliases**: Use `@/*` to import from `src/*`
- **ES2022 Target**: Modern JavaScript features support
- **JSX Support**: React JSX transform enabled
- **Decorator Support**: For libraries that require decorators

## Type System Architecture

### Standardized Type Organization

```
src/types/
├── domain/           # Domain entities
│   ├── manga-types.ts
│   ├── chapter-types.ts
│   └── user-types.ts
├── api/              # API request/response types
│   ├── request-types.ts
│   └── response-types.ts
├── adapters/         # Adapter interfaces
│   ├── base.ts
│   └── provider-specific/
└── shared/           # Shared utility types
    ├── async-types.ts
    └── utility-types.ts
```

### Core Domain Types

```typescript
// Domain entities use clear, specific types
export interface MangaEntity {
  id: string;
  title: string;
  description?: string;
  status: MangaStatus;
  chapters: ChapterEntity[];
  metadata: MangaMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export enum MangaStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  HIATUS = 'HIATUS',
  UNKNOWN = 'UNKNOWN'
}
```

## Best Practices

### 1. Type Safety First

```typescript
// ❌ Avoid type assertions
const result = data as ComplexType;

// ✅ Use type guards
if (isComplexType(data)) {
  // TypeScript knows data is ComplexType here
  processData(data);
}
```

### 2. Null Safety

```typescript
// ❌ Avoid non-null assertions
const title = manga!.metadata!.title!;

// ✅ Use optional chaining and nullish coalescing
const title = manga?.metadata?.title ?? 'Unknown';
```

### 3. Discriminated Unions

```typescript
// Use discriminated unions for type-safe state handling
type AsyncResult<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

// TypeScript automatically narrows types
function handleResult<T>(result: AsyncResult<T>) {
  switch (result.status) {
    case 'success':
      // result.data is available here
      return processData(result.data);
    case 'error':
      // result.error is available here
      return handleError(result.error);
    // ...
  }
}
```

### 4. Generic Constraints

```typescript
// Use generic constraints for type safety
function processAdapter<T extends BaseIntegrationConfig>(
  adapter: IntegrationAdapter<T>
): void {
  // Adapter is guaranteed to have BaseIntegrationConfig properties
  if (adapter.isEnabled()) {
    adapter.search('query');
  }
}
```

### 5. Type Guards

```typescript
// Create comprehensive type guards
export function isMangaEntity(value: unknown): value is MangaEntity {
  if (!isObject(value)) return false;
  
  return (
    isString(value.id) &&
    isString(value.title) &&
    isValidMangaStatus(value.status) &&
    isArray(value.chapters) &&
    value.chapters.every(isChapterEntity)
  );
}
```

## Common Patterns

### AsyncResult Pattern

The AsyncResult pattern is used throughout the codebase for handling asynchronous operations:

```typescript
// In hooks
export function useManga(mangaId: string) {
  const [mangaState, setMangaState] = useState<AsyncResult<Manga>>(
    createIdleResult()
  );
  
  const fetchManga = async () => {
    setMangaState(createLoadingResult());
    
    const result = await fromPromiseCatch(
      api.getManga(mangaId),
      error => new Error(`Failed to fetch manga: ${error.message}`)
    );
    
    setMangaState(result);
  };
  
  // Safe data extraction
  const manga = isSuccess(mangaState) ? mangaState.data : undefined;
  
  return { manga, mangaState, fetchManga };
}
```

### Adapter Pattern

All external integrations follow the standardized adapter pattern:

```typescript
export class ProviderAdapter extends BaseIntegrationAdapter<ProviderConfig>
  implements IntegrationAdapter<ProviderConfig> {
  
  async search(query: string): Promise<MangaSearchResult[]> {
    try {
      const results = await this.client.search(query);
      return results.map(this.mapToSearchResult);
    } catch (error) {
      this.log('Search failed', error);
      throw this.createError('Search failed', error);
    }
  }
}
```

## Error Resolution

### Common TypeScript Errors and Solutions

#### 1. Property Does Not Exist

```typescript
// Error: Property 'data' does not exist on type 'AsyncResult<T>'
const data = result.data; // ❌

// Solution: Use type guards
if (isSuccess(result)) {
  const data = result.data; // ✅
}
```

#### 2. Type Compatibility Issues

```typescript
// Error: Type 'string | undefined' is not assignable to type 'string'
const title: string = manga.title; // ❌ if title is optional

// Solution: Provide default or check for undefined
const title: string = manga.title ?? 'Unknown'; // ✅
```

#### 3. Generic Type Inference

```typescript
// Error: Generic type requires 1 type argument
const adapter: IntegrationAdapter = new MyAdapter(); // ❌

// Solution: Provide type argument
const adapter: IntegrationAdapter<MyConfig> = new MyAdapter(); // ✅
```

### Type Error Prevention

1. **Enable Strict Mode**: Catches most type issues at compile time
2. **Use Type Guards**: Validate data at runtime boundaries
3. **Avoid `any`**: Use `unknown` and validate when type is unclear
4. **Leverage Type Inference**: Let TypeScript infer types when possible
5. **Document Complex Types**: Add JSDoc comments for clarity

## Migration Strategy

### Phase-Based Migration Approach

The project follows a systematic migration approach:

1. **Phase 1**: Core type definitions and utilities
2. **Phase 2**: API clients and adapters
3. **Phase 3**: React components and hooks
4. **Phase 4**: Test files and utilities
5. **Phase 5**: Scripts and tooling

### Migration Checklist

- [ ] Replace `any` with specific types or `unknown`
- [ ] Add proper return types to all functions
- [ ] Implement type guards for external data
- [ ] Use discriminated unions for state management
- [ ] Enable strict null checks progressively
- [ ] Add generic constraints where applicable
- [ ] Document complex type relationships

## Testing

### Type Testing Patterns

```typescript
// Test type guards
describe('Type Guards', () => {
  test('isMangaEntity validates correct structure', () => {
    const validManga = {
      id: '1',
      title: 'Test Manga',
      status: MangaStatus.ONGOING,
      chapters: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    expect(isMangaEntity(validManga)).toBe(true);
  });
  
  test('isMangaEntity rejects invalid structure', () => {
    expect(isMangaEntity(null)).toBe(false);
    expect(isMangaEntity({ id: 1 })).toBe(false); // id should be string
  });
});
```

### Testing Async Operations

```typescript
// Test AsyncResult patterns
describe('Async Operations', () => {
  test('handles success case', async () => {
    const result = await fromPromise(Promise.resolve('data'));
    
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data).toBe('data');
    }
  });
  
  test('handles error case', async () => {
    const error = new Error('Test error');
    const result = await fromPromise(Promise.reject(error));
    
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBe(error);
    }
  });
});
```

## Resources

### Internal Documentation

- Master Architecture Document - Overall system architecture
- AsyncResult Pattern Guide - Detailed async handling patterns
- Adapter Implementation Guide - Creating new adapters

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Type Utilities

The project includes several type utility functions:

```typescript
// Type checking utilities
export const isString = (value: unknown): value is string => 
  typeof value === 'string';

export const isNumber = (value: unknown): value is number => 
  typeof value === 'number' && !isNaN(value);

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Safe parsing utilities
export function safeParseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
```

## Conclusion

This guide represents the consolidated TypeScript knowledge for the project. Follow these patterns and practices to maintain type safety and code quality throughout the codebase. When in doubt, prioritize type safety and explicit typing over convenience.
