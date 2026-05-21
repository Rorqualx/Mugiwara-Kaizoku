# Data Model Conversion Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Data Model Conversion Plan

---
# Data Model Conversion Utilities Improvement Plan

## Current State Analysis

After analyzing the codebase, we've identified several key areas related to data model conversion:

### Key Conversion Patterns

1. **Database to Application Model Conversion**
   - `mangaConverter.ts`: Converts Prisma database models to application-specific types
   - Heavy use of explicit type assertions and manual property mapping
   - Complex circular reference handling between manga and related entities

2. **Provider-Specific to Standardized Format Conversion**
   - `adapter.ts`: Abstract adapter pattern for normalizing provider-specific data
   - `metadataMerger.ts`: Complex merging of metadata from multiple sources
   - `mangadex/utils.ts`: Specialized utilities for MangaDex API responses

3. **Metadata Validation and Repair**
   - `metadataValidator.ts`: Validates and repairs manga metadata
   - Ensures required fields have valid values
   - Handles source-specific edge cases

### Pain Points

1. **Type Safety Issues**
   - Frequent use of type assertions (as any, as Record<string, unknown>)
   - Complex type relationships requiring explicit handling
   - Inconsistent type definitions across different parts of the application

2. **Circular Reference Complexity**
   - Manual linking of related entities (manga -> chapters -> outOfSyncChapters)
   - Complex bidirectional relationship management

3. **Provider-Specific Logic Fragmentation**
   - Provider-specific logic spread across multiple files
   - Redundant conversion logic for similar data structures

4. **Fallback Handling Inconsistency**
   - Inconsistent approaches to handling missing or invalid data
   - Different default values in different conversion functions

5. **Complex Merging Logic**
   - Intricate logic for merging metadata from multiple sources
   - Difficult-to-maintain field prioritization rules

## Improvement Goals

1. **Standardize Conversion Patterns**
   - Create consistent patterns for all data model conversions
   - Reduce duplication and inconsistency

2. **Enhance Type Safety**
   - Minimize type assertions and manual type conversions
   - Leverage TypeScript's type system for more reliable conversions

3. **Simplify Circular Reference Handling**
   - Create utilities to handle circular references more elegantly
   - Ensure consistent handling of bidirectional relationships

4. **Unify Provider-Specific Logic**
   - Consolidate provider-specific conversion logic
   - Create a standardized approach to provider integration

5. **Consistent Fallback Handling**
   - Implement a consistent approach to default values and fallbacks
   - Create utilities for safe property access with fallbacks

6. **Improve Metadata Merging**
   - Simplify the logic for merging metadata from multiple sources
   - Make field prioritization more configurable and maintainable

## Implementation Plan

### 1. Create Core Conversion Utilities

Create a central `src/utils/converters` directory with:

#### 1.1 Base Converter Utilities

- `BaseConverter.ts`: Abstract base class for all converters
- `SafeAccess.ts`: Utilities for safe property access with fallbacks
- `CircularReferenceHandler.ts`: Utilities for handling circular references
- `TypeGuards.ts`: Type guards for common data structures

#### 1.2 Database Model Converters

- `PrismaConverter.ts`: Base class for Prisma model converters
- `MangaConverter.ts`: Specialized converter for manga models
- `ChapterConverter.ts`: Specialized converter for chapter models
- `MetadataConverter.ts`: Specialized converter for metadata models

#### 1.3 Provider Model Converters

- `ProviderConverter.ts`: Base class for provider-specific converters
- `AnilistConverter.ts`: Converter for Anilist data
- `MangadexConverter.ts`: Converter for MangaDex data
- `ComicVineConverter.ts`: Converter for ComicVine data
- `FandomConverter.ts`: Converter for Fandom data

#### 1.4 Metadata Merging Utilities

- `MetadataMerger.ts`: Enhanced metadata merging logic
- `FieldPrioritizer.ts`: Configurable field prioritization
- `ProviderPreferences.ts`: User preference handling for providers

### 2. Implement Core Type Definitions

- Define clear interface hierarchies for all data models
- Create consistent property naming across all models
- Implement discriminated unions for provider-specific data

```typescript
// Example type hierarchy
interface BaseModel {
  id: number | string;
  createdAt: Date;
  updatedAt: Date | null;
}

interface MangaBase extends BaseModel {
  title: string;
  source: string;
  // Common manga properties
}

interface MangaWithRelations extends MangaBase {
  library: Library | null;
  metadata: Metadata | null;
  chapters: Chapter[];
  outOfSyncChapters: OutOfSyncChapter[];
}

// Provider-specific metadata
type ProviderMetadata =
  | { provider: 'anilist'; data: AnilistMetadata }
  | { provider: 'mangadex'; data: MangadexMetadata }
  | { provider: 'comicvine'; data: ComicVineMetadata }
  | { provider: 'fandom'; data: FandomMetadata };
```

### 3. Implement Safe Property Access Utilities

Create a utility module for safe property access with fallbacks:

```typescript
// Example implementation
export function getProperty<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  if (!obj) return defaultValue;
  return obj[key] === undefined ? defaultValue : obj[key];
}

export function getNestedProperty<T>(
  obj: Record<string, any> | null | undefined,
  path: string,
  defaultValue: T
): T {
  if (!obj) return defaultValue;
  
  const parts = path.split('.');
  let current: any = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[part];
  }
  
  return current === undefined ? defaultValue : current;
}
```

### 4. Implement Circular Reference Handler

Create a utility to handle circular references more elegantly:

```typescript
// Example implementation
export class CircularReferenceHandler<T extends { id: number | string }> {
  private items = new Map<string | number, T>();
  
  add(item: T): T {
    this.items.set(item.id, item);
    return item;
  }
  
  get(id: string | number): T | undefined {
    return this.items.get(id);
  }
  
  getOrCreate(id: string | number, createFn: () => T): T {
    if (this.items.has(id)) {
      return this.items.get(id)!;
    }
    
    const item = createFn();
    this.items.set(id, item);
    return item;
  }
  
  getAll(): T[] {
    return Array.from(this.items.values());
  }
}
```

### 5. Implement Metadata Merger Improvements

Create an improved metadata merger with cleaner prioritization logic:

```typescript
// Example implementation
export class MetadataMerger {
  private priorityMap: Record<string, string[]> = {
    // Field -> Provider priority order
    'summary': ['fandom', 'anilist', 'mangadex', 'comicvine'],
    'genres': ['anilist', 'mangadex', 'comicvine', 'fandom'],
    // Other fields...
  };
  
  // Allow overriding default priorities
  setPriority(field: string, providers: string[]): void {
    this.priorityMap[field] = [...providers];
  }
  
  // Merge metadata from multiple sources with clean prioritization
  merge(baseMetadata: Partial<Metadata>, providerData: Record<string, ProviderResult>): Metadata {
    const result = { ...baseMetadata } as Metadata;
    
    // For each field, apply the provider with highest priority
    Object.entries(this.priorityMap).forEach(([field, providers]) => {
      for (const provider of providers) {
        if (providerData[provider]?.[field] !== undefined) {
          result[field as keyof Metadata] = providerData[provider][field];
          break;
        }
      }
    });
    
    return result;
  }
}
```

### 6. Create Provider-Specific Converters

Implement standardized converters for each provider:

```typescript
// Example implementation
export abstract class ProviderConverter<T, U> {
  abstract convert(providerData: T): U;
  
  protected getLocalizedString(obj: Record<string, string> | null | undefined, defaultValue: string = ''): string {
    if (!obj) return defaultValue;
    
    // Prioritize English, then Japanese, then any available language
    if (obj.en) return obj.en;
    if (obj.ja) return obj.ja;
    
    const values = Object.values(obj).filter(Boolean);
    return values[0] || defaultValue;
  }
}

export class MangadexConverter extends ProviderConverter<MangadexApiResponse, StandardizedMetadata> {
  convert(mangadexData: MangadexApiResponse): StandardizedMetadata {
    // Implementation details...
    return {
      title: this.getLocalizedString(mangadexData.attributes.title),
      description: this.getLocalizedString(mangadexData.attributes.description),
      // Other fields...
    };
  }
}
```

## Implementation Timeline

### Phase 1: Core Framework (Week 1)

1. Create core converter utilities
2. Implement type definitions
3. Create safe property access utilities
4. Implement circular reference handler

### Phase 2: Provider Converters (Week 2)

1. Implement base provider converter
2. Create provider-specific converters
3. Implement standardized provider interface

### Phase 3: Database Converters (Week 3)

1. Implement base Prisma converter
2. Create entity-specific converters
3. Update existing code to use new converters

### Phase 4: Metadata Merger (Week 4)

1. Implement improved metadata merger
2. Create field prioritization logic
3. Implement user preference handling

### Phase 5: Integration & Testing (Week 5)

1. Integrate all converters into the application
2. Create comprehensive tests for conversion edge cases
3. Measure performance and optimize as needed

## Expected Benefits

1. **Improved Type Safety**
   - Fewer type assertions and manual casts
   - More reliable type checking during compilation

2. **Better Code Organization**
   - Clear separation of conversion logic
   - Consistent patterns across the codebase

3. **Enhanced Maintainability**
   - Easier to add new providers or data models
   - More consistent handling of edge cases

4. **Improved Performance**
   - More efficient data conversion
   - Reduced duplication of conversion logic

5. **Better Developer Experience**
   - Clearer interfaces and contracts
   - More discoverable conversion utilities