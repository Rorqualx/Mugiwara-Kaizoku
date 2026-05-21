# Module Specific Strategies

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Module Specific Strategies

---
# Module-Specific Type Fix Strategies

This document outlines specific strategies for fixing TypeScript errors in each major module of the Mugiwara-Kaizoku codebase. Each module has unique patterns and challenges that require tailored approaches.

## Table of Contents

1. [Server Module](#server-module-537-errors)
2. [Components Module](#components-module-190-errors)
3. [Hooks Module](#hooks-module-168-errors)
4. [Utils Module](#utils-module-154-errors)
5. [API Module](#api-module-87-errors)
6. [Types Module](#types-module-53-errors)
7. [Implementation Approach](#implementation-approach)

## Server Module (537 errors)

### Configuration Services

**Key Files:**
- `src/server/services/downloadClient/configService.ts` (47 errors)
- `src/server/services/config/themeMigration.ts` (31 errors)
- `src/server/services/config/integrationMigration.ts` (30 errors)

**Common Patterns:**
1. Unsafe JSON parsing
2. Untyped database interactions
3. Missing interfaces for configuration objects
4. Type assertions when setting values

**Strategy:**

1. **Create Configuration Type Hierarchy:**
```typescript
// Base configuration interface
interface BaseConfig {
  id: string;
  scope: ConfigScope;
  valueType: ConfigValueType;
  metadata?: ConfigMetadata;
}

// Specialized config interfaces
interface ThemeConfig extends BaseConfig {
  // Theme-specific properties
}

interface IntegrationConfig extends BaseConfig {
  // Integration-specific properties
}
```

2. **Safe JSON Handling:**
```typescript
function safeParseJSON<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error(`Error parsing JSON: ${error}`);
    return fallback;
  }
}

// Usage
const metadata = safeParseJSON<ConfigMetadata>(settings?.metadata, {});
```

3. **Type Guards for Configuration Objects:**
```typescript
function isThemeConfig(config: unknown): config is ThemeConfig {
  return (
    isObject(config) &&
    hasProperty(config, 'id') &&
    hasProperty(config, 'scope') &&
    config.scope === ConfigScope.THEME
  );
}
```

4. **Structured Migration Functions:**
```typescript
async function migrateThemeConfig(
  configService: ConfigService,
  source: Record<string, unknown>
): Promise<void> {
  // Type-safe property access with proper defaults
  const primaryColor = getStringProperty(source, 'primaryColor', '#000000');
  const isDarkMode = getBooleanProperty(source, 'darkMode', false);
  
  // Type-safe setting of values
  await configService.set('theme.primaryColor', primaryColor, {
    scope: ConfigScope.THEME,
    valueType: ConfigValueType.STRING,
    metadata: {
      displayName: 'Primary Color',
      description: 'Main accent color for the application',
      group: 'Theme',
      order: 1
    }
  });
}
```

### Metadata Services

**Key Files:**
- `src/server/services/metadata/metadataService.standardized.ts` (12 errors)
- `src/server/services/metadata/metadataServiceProvider.ts` (4 errors)

**Common Patterns:**
1. Type mismatches between DB models and domain models
2. Unsafe casting of DB entity fields
3. Missing proper typing for joins and relations

**Strategy:**

1. **Type-Safe Prisma Interactions**:
```typescript
// Create proper interfaces for database models with relations
interface MangaWithRelations {
  id: number;
  title: string;
  status: string;
  chapters: {
    id: number;
    number: string;
    title: string | null;
  }[];
}

// Use type guards and mapping functions
async function getMangaWithRelations(id: number): Promise<MangaEntity> {
  const dbManga = await prisma.manga.findUnique({
    where: { id },
    include: { chapters: true }
  });
  
  if (!dbManga) {
    throw new Error(`Manga with id ${id} not found`);
  }
  
  // Convert to domain entity
  return {
    id: dbManga.id,
    title: dbManga.title,
    status: mapDbToDomainStatus(dbManga.status),
    chapters: dbManga.chapters.map(ch => ({
      id: ch.id,
      number: ch.number,
      title: ch.title || `Chapter ${ch.number}`
    }))
  };
}
```

## Components Module (190 errors)

**Key Files:**
- `src/components/manga/MangaDetailView.tsx` (23 errors)
- `src/components/settings/BackupSettings.tsx` (14 errors)
- `src/components/updateManga/ProviderSelectionForm.tsx` (14 errors)

**Common Patterns:**
1. Untyped component props
2. Unsafe access to optional properties
3. Event handlers with implicit any
4. Missing types for form state

**Strategy:**

1. **Proper Prop Typing:**
```typescript
interface MangaDetailViewProps {
  mangaId: number;
  showTabs?: boolean;
  defaultTab?: 'info' | 'chapters' | 'volumes';
  onUpdate?: (manga: MangaEntity) => void;
}

function MangaDetailView({
  mangaId,
  showTabs = true,
  defaultTab = 'info',
  onUpdate
}: MangaDetailViewProps) {
  // Implementation
}
```

2. **Type-Safe Event Handlers:**
```typescript
// Before
const handleChange = (e) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};

// After
const handleChange: React.ChangeEvent<HTMLInputElement> = (e) => {
  setFormData(prev => ({ 
    ...prev, 
    [e.target.name]: e.target.value 
  }));
};
```

3. **Form State Typing:**
```typescript
interface BackupFormState {
  location: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  includeMetadata: boolean;
  includeCovers: boolean;
  maxBackups?: number;
}

const [formData, setFormData] = useState<BackupFormState>({
  location: '',
  frequency: 'weekly',
  includeMetadata: true,
  includeCovers: true
});
```

4. **Safe Property Access:**
```typescript
// Before
const coverUrl = manga.metadata.coverUrl;

// After
const coverUrl = manga?.metadata?.coverUrl ?? '/default-cover.jpg';
```

## Hooks Module (168 errors)

**Key Files:**
- `src/hooks/useNotificationConfig.ts` (26 errors)
- `src/hooks/useFandomConfig.ts` (20 errors)
- `src/hooks/useProviderConfig.ts` (20 errors)

**Common Patterns:**
1. Inconsistent AsyncResult usage
2. Type assertions in query results
3. Untyped state initialization
4. Missing return type definitions

**Strategy:**

1. **Consistent AsyncResult Pattern:**
```typescript
interface UseConfigResult<T> {
  config: T | null;
  isLoading: boolean;
  error: Error | null;
  updateConfig: (updates: Partial<T>) => Promise<void>;
  resetConfig: () => Promise<void>;
}

export function useNotificationConfig(): UseConfigResult<NotificationConfig> {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Implementation
  
  return {
    config,
    isLoading,
    error,
    updateConfig,
    resetConfig
  };
}
```

2. **Type-Safe Query Handling:**
```typescript
// Before
const result = await configQuery.data as any;

// After
interface ConfigQueryResult {
  success: boolean;
  data?: NotificationConfig;
  error?: string;
}

const result = configQuery.data as ConfigQueryResult;
if (result?.success && result.data) {
  setConfig(result.data);
} else if (result?.error) {
  setError(new Error(result.error));
}
```

3. **Function Typing:**
```typescript
// Before
const updateConfig = async (updates) => {
  // Implementation
};

// After
const updateConfig = async (updates: Partial<NotificationConfig>): Promise<void> => {
  try {
    // Implementation
  } catch (err) {
    setError(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
};
```

4. **tRPC Client Type Safety**:
```typescript
// Before
const result = trpc.config.getNotificationConfig.useQuery();

// After
const result = trpc.config.getNotificationConfig.useQuery(undefined, {
  onSuccess: (data) => {
    setConfig(data as NotificationConfig);
    setIsLoading(false);
  },
  onError: (error) => {
    setError(error instanceof Error ? error : new Error(String(error)));
    setIsLoading(false);
  }
});
```

## Utils Module (154 errors)

**Key Files:**
- `src/utils/converters/ChapterConverter.ts` (28 errors)
- `src/utils/converters/MetadataConverter.ts` (26 errors)
- `src/utils/converters/examples/integration-example.ts` (21 errors)

**Common Patterns:**
1. Complex generic type misuse
2. Unsafe type assertions
3. Missing interface implementations
4. Nullable handling issues

**Strategy:**

1. **Proper Generic Constraints:**
```typescript
// Before
export class ChapterConverter<T, U> extends BaseConverter<T, U> {
  // Implementation
}

// After
export class ChapterConverter<
  TSource extends Record<string, unknown>,
  TTarget extends ChapterEntity
> extends BaseConverter<TSource, TTarget> {
  // Implementation with proper constraints
}
```

2. **Type Guards Instead of Assertions:**
```typescript
// Before
return source.releaseDate as Date;

// After
return isDate(source.releaseDate) 
  ? source.releaseDate 
  : isString(source.releaseDate) 
    ? new Date(source.releaseDate) 
    : null;
```

3. **Safe Property Access:**
```typescript
// Before
convert(source: TSource): TTarget {
  return {
    id: source.id,
    title: source.title,
    // Other properties
  } as TTarget;
}

// After
convert(source: TSource): TTarget {
  const target = {
    id: getProperty(source, 'id', ''),
    title: getProperty(source, 'title', ''),
    // Type-safe property access
  } as Partial<TTarget>;
  
  return this.validateTarget(target);
}

private validateTarget(target: Partial<TTarget>): TTarget {
  // Ensure all required properties exist
  if (!target.id) {
    throw new Error('Invalid target: missing id');
  }
  
  return target as TTarget;
}
```

4. **Utility Functions for Common Operations**:
```typescript
// Define reusable utility functions
export function getProperty<T extends Record<string, unknown>, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  return obj?.[key] ?? defaultValue;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}
```

## API Module (87 errors)

**Key Files:**
- `src/api/metadataProviders/fandomClient.standardized.ts` (17 errors)
- `src/api/utils/errorHandling.ts` (16 errors)
- `src/api/metadataProviders/fandomClient.ts` (14 errors)

**Common Patterns:**
1. Untyped API responses
2. Missing error type definitions
3. Type assertions in client methods
4. Inconsistent return types

**Strategy:**

1. **Strong Response Typing:**
```typescript
interface FandomSearchResponse {
  batchcomplete: string;
  query: {
    search: Array<{
      id: number;
      title: string;
      size: number;
      wordcount: number;
      timestamp: string;
      snippet: string;
      matchtext: string;
      url: string;
    }>;
  };
}

async search(query: string): Promise<Manga[]> {
  const response = await this.get<FandomSearchResponse>('/api.php', {
    action: 'query',
    list: 'search',
    srsearch: query,
    format: 'json'
  });
  
  return response.query.search.map(result => this.convertSearchResultToManga(result));
}
```

2. **Error Hierarchy:**
```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ConnectionError extends ApiError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONNECTION_ERROR', context);
    this.name = 'ConnectionError';
  }
}

// Usage
throw new ConnectionError('Failed to connect to Fandom API', { url, timeout });
```

3. **Client Method Typing:**
```typescript
// Before
async get(path: string, params?: any): Promise<any> {
  // Implementation
}

// After
async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  // Implementation with proper typing
}
```

4. **Type-Safe Response Mapping**:
```typescript
private convertSearchResultToManga(result: FandomSearchResponse['query']['search'][0]): MangaSearchResult {
  return {
    id: result.id.toString(),
    title: result.title,
    description: result.snippet,
    source: 'fandom',
    sourceId: result.id.toString(),
    metadata: {
      url: result.url,
      wordCount: result.wordcount,
      timestamp: result.timestamp,
      status: MangaStatus.UNKNOWN
    }
  };
}
```

## Types Module (53 errors)

**Key Files:**
- `src/types/domain-types.ts` (24 errors)
- `src/types/prismaTypes.ts` (7 errors)
- `src/types/domain/index.ts` (6 errors)

**Common Patterns:**
1. Circular references
2. Inconsistent exports
3. Re-exporting external types
4. Namespace collision issues

**Strategy:**

1. **Organized Type Exports:**
```typescript
// Before (mixed direct exports and namespace)
export type { Manga, Chapter };
export namespace DomainTypes {
  export type { Manga, Chapter };
}

// After (consistent pattern with namespaces)
export * from './manga-types';
export * from './chapter-types';

// Type-only namespace for organizing imports
export namespace Domain {
  export * from './manga-types';
  export * from './chapter-types';
}
```

2. **Interface Segregation:**
```typescript
// Before (large monolithic interface)
export interface MangaEntity {
  // Many properties
}

// After (composed interfaces)
export interface MangaBase {
  id: ID;
  title: string;
  status: MangaStatus;
}

export interface MangaMetadata {
  description?: string;
  coverUrl?: string;
  genres?: string[];
  // Other metadata properties
}

export interface MangaEntity extends MangaBase {
  metadata: MangaMetadata;
  libraryId: number;
  // Additional properties
}
```

3. **Type Mapping for External Types:**
```typescript
// Explicitly map external types to internal types
import { Manga as PrismaManga } from '@prisma/client';

// Map Prisma types to domain types
export type PrismaToDomain<T> = T extends PrismaManga 
  ? MangaEntity 
  : never;

// Map domain types to Prisma types
export type DomainToPrisma<T> = T extends MangaEntity 
  ? PrismaManga 
  : never;
```

## Implementation Approach

### Phase 1: Foundation First

1. Start by fixing the `Types` module to establish a solid foundation
2. Fix core interfaces in `src/types/domain/*` files
3. Implement mapping functions between different representation layers
4. Create comprehensive type guards for validation

### Phase 2: Utilities and Converters

1. Fix the `Utils` module, particularly converter classes
2. Implement safe property access utilities
3. Add proper generic constraints
4. Update example and test files

### Phase 3: API and Integration Layer

1. Fix API clients and adapters
2. Implement proper error handling
3. Add response type definitions
4. Update factory methods

### Phase 4: Server Services

1. Fix configuration services and migrations
2. Update metadata services
3. Implement proper transaction handling
4. Fix tRPC router implementations

### Phase 5: React Hooks

1. Standardize AsyncResult pattern
2. Fix tRPC client usage
3. Implement consistent error handling
4. Add proper return type definitions

### Phase 6: React Components

1. Fix component props
2. Update event handlers
3. Fix property access patterns
4. Update component exports

### Tools and Utilities

Create helper utilities for common tasks:

```typescript
// src/utils/validation/type-guards.ts

/**
 * Type guard for checking if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * Type guard for checking if an object has a property of a specific type
 */
export function hasProperty<T extends Record<string, unknown>, K extends string>(
  obj: T,
  key: K,
  typeGuard?: (value: unknown) => boolean
): obj is T & Record<K, unknown> {
  return (
    key in obj &&
    (typeGuard ? typeGuard(obj[key]) : true)
  );
}

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
```

## Conclusion

These module-specific strategies provide a tailored approach to fixing TypeScript errors in each area of the codebase. By applying these patterns consistently, we can systematically eliminate type errors while improving the overall type safety of the application.

The strategies focus on:

1. **Creating proper type hierarchies**
2. **Implementing safe property access**
3. **Using type guards instead of assertions**
4. **Ensuring consistent return types**
5. **Adding proper error handling**

For each module, the implementation should follow the patterns established in these strategies while adapting to the specific needs of the code in question.