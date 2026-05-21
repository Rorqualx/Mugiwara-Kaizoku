# Data Model Conversion

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Data Model Conversion

---
# Data Model Conversion Utilities

This document provides an overview of the Data Model Conversion Utilities implemented in the project. These utilities provide a comprehensive, type-safe approach to converting between different data models in the application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Components](#key-components)
4. [Usage Examples](#usage-examples)
5. [Extension Guide](#extension-guide)
6. [Testing](#testing)
7. [Future Enhancements](#future-enhancements)

## Overview

The Data Model Conversion Utilities address several key challenges in the application:

1. **Type-Safe Conversions**: Provide a strongly-typed framework for converting between different data representations.
2. **Circular References**: Handle complex bidirectional relationships between entities.
3. **Fallback Handling**: Standardize how missing or invalid data is handled with sensible defaults.
4. **Provider Normalization**: Convert provider-specific data formats to standardized application models.
5. **Metadata Merging**: Intelligently combine metadata from multiple sources with field prioritization.

## Architecture

The utilities follow a layered architecture:

```
┌────────────────────────────────────┐
│           Application Code         │
└───────────────┬────────────────────┘
                │
┌───────────────▼────────────────────┐
│      Specialized Converters        │
│  MangaConverter, ChapterConverter  │
│  MetadataConverter, etc.           │
└───────────────┬────────────────────┘
                │
┌───────────────▼────────────────────┐
│         Base Converters            │
│  BaseConverter, PrismaConverter,   │
│  ProviderConverter                 │
└───────────────┬────────────────────┘
                │
┌───────────────▼────────────────────┐
│           Core Utilities           │
│  SafeAccess, CircularReferenceHandler│
│  TypeGuards, MetadataMerger        │
└────────────────────────────────────┘
```

This layered approach allows for:

- **Abstraction**: Each layer provides abstractions that simplify usage at higher levels.
- **Reusability**: Core utilities are reused across multiple converters.
- **Extensibility**: New converters can be added while reusing the existing infrastructure.

## Key Components

### Base Converters

1. **BaseConverter**: Abstract base class for all converters.
   - Provides the foundation with common functionality.
   - Handles options management and error handling.

2. **PrismaConverter**: Base class for converting Prisma database models.
   - Handles date conversions and type mapping.
   - Manages circular references between related entities.

3. **ProviderConverter**: Base class for provider-specific converters.
   - Standardizes provider integration.
   - Handles provider-specific nuances.

### Specialized Converters

1. **MangaConverter**: Converts Prisma manga models to application models.
   - Handles complex manga relationships.
   - Manages metadata and chapter conversions.

2. **ChapterConverter**: Converts Prisma chapter models to application models.
   - Formats chapter titles.
   - Maintains relationship with parent manga.

3. **MetadataConverter**: Converts provider-specific metadata to standardized format.
   - Maps fields based on configurable options.
   - Handles various metadata formats.

### Provider-Specific Converters

1. **MangaDexConverter**: Specialized converter for MangaDex API data.
   - Handles localized content with language preferences.
   - Processes MangaDex-specific relationships and fields.

2. **AniListConverter**: Specialized converter for AniList GraphQL API data.
   - Configurable title language preferences (english, romaji, native).
   - Extracts staff information from nested relationship structures.
   - Includes comprehensive statistical data (scores, popularity, favorites).
   - Handles nested date objects and formats to ISO strings.

3. **ComicVineConverter**: Specialized converter for ComicVine REST API data.
   - HTML description cleaning with configurable options.
   - Smart status determination based on issue information.
   - Derives genres from concept information.
   - Processes creator/people credits by role importance.

### Core Utilities

1. **SafeAccess**: Type-safe property access with fallbacks.
   - Handles undefined, null, and type mismatches.
   - Provides type-specific access functions (string, number, boolean, date, etc.).

2. **CircularReferenceHandler**: Manages object identity in complex object graphs.
   - Tracks converted objects to maintain identity.
   - Resolves circular references between related entities.

3. **TypeGuards**: Runtime type checking with TypeScript type narrowing.
   - Validates data structures.
   - Enables type-safe operations on dynamic data.

4. **MetadataMerger**: Merges metadata from different providers.
   - Applies field-specific prioritization.
   - Respects user preferences for specific fields.

## Usage Examples

### Basic Conversion

```typescript
import { MangaConverter } from '@/utils/converters';

// Create a converter
const converter = new MangaConverter();

// Convert a Prisma manga model to an application model
const manga = converter.convert(prismaManga);
```

### Handling Circular References

```typescript
import { MangaConverter, ChapterConverter, CircularReferenceHandler } from '@/utils/converters';

// Create a shared reference handler
const refHandler = new CircularReferenceHandler();

// Create converters with shared reference handler
const mangaConverter = new MangaConverter({ refHandler });
const chapterConverter = new ChapterConverter({ 
  refHandler, 
  includeParentManga: true 
});

// Convert manga and chapters
const manga = mangaConverter.convert(prismaManga);
const chapters = chapterConverter.convertMany(prismaChapters);

// Objects maintain their identity and relationships
console.log(chapters[0].manga === manga); // true
```

### Provider Metadata Conversion

```typescript
import { 
  MangaDexConverter, 
  AniListConverter, 
  ComicVineConverter 
} from '@/utils/converters';

// Create a MangaDex-specific converter
const mangadexConverter = new MangaDexConverter({
  preferredLanguage: 'en',
  fallbackLanguages: ['en', 'ja'],
  coverQuality: 'medium',
});

// Convert MangaDex data to standardized metadata
const mangadexMetadata = mangadexConverter.convert(mangadexData);

// Create an AniList-specific converter
const anilistConverter = new AniListConverter({
  titleLanguage: 'english', // Options: 'english', 'romaji', 'native'
  coverSize: 'large',       // Options: 'extraLarge', 'large', 'medium'
  includeStats: true,       // Include popularity and score statistics
});

// Convert AniList data to standardized metadata
const anilistMetadata = anilistConverter.convert(anilistData);

// Create a ComicVine-specific converter
const comicvineConverter = new ComicVineConverter({
  coverSize: 'super',        // Options: 'super', 'medium', 'small', 'original'
  stripHtml: true,           // Clean HTML from descriptions
  includeCharacters: true,   // Include character information
});

// Convert ComicVine data to standardized metadata
const comicvineMetadata = comicvineConverter.convert(comicvineData);
```

### Metadata Merging

```typescript
import { MetadataMerger } from '@/utils/converters';

// Create a merger with field-specific provider priorities
const merger = new MetadataMerger({
  titlePriority: ['MangaDex', 'AniList', 'ComicVine'],
  descriptionPriority: ['AniList', 'MangaDex', 'ComicVine'],
  fieldPreferences: {
    // User-specific field preferences
    title: 'MangaDex',
    description: 'AniList',
  },
});

// Merge metadata from different providers
const mergedMetadata = merger.merge([
  mangadexMetadata,
  anilistMetadata,
  comicvineMetadata,
]);
```

## Extension Guide

### Adding a New Converter

To add a new converter for a specific entity:

1. **Choose the appropriate base class**:
   - `PrismaConverter` for database models
   - `ProviderConverter` for provider-specific data
   - `BaseConverter` for other types of conversions

2. **Define the source and target types**:
   ```typescript
   class NewEntityConverter extends PrismaConverter<SourceType, TargetType> {
     // Implementation here
   }
   ```

3. **Implement the `convert` method**:
   ```typescript
   convert(source: SourceType, options?: Partial<Options>): TargetType {
     this.updateOptions(options);
     
     // Create the target object
     const target: TargetType = {
       // Map properties from source to target
     };
     
     // Handle relationships if needed
     
     return target;
   }
   ```

4. **Add a factory function**:
   ```typescript
   export function createNewEntityConverter(options?: Partial<Options>): NewEntityConverter {
     return new NewEntityConverter(options);
   }
   ```

5. **Create tests** for the new converter.

6. **Export** the new converter from the appropriate index file.

### Adding a Provider-Specific Converter

To add a converter for a new provider:

1. **Create a new file** in the `src/utils/converters/providers` directory.

2. **Extend the `MetadataConverter` class**:
   ```typescript
   export class NewProviderConverter extends MetadataConverter<ProviderType, ConverterOptions> {
     // Implementation here
   }
   ```

3. **Implement provider-specific field mapping**:
   ```typescript
   protected customizeMetadata(metadata: MangaMetadata, source: ProviderType): MangaMetadata {
     // Provider-specific customization
     return {
       ...metadata,
       // Override fields as needed
     };
   }
   ```

4. **Add to the providers index file**.

## Testing

Each converter has a corresponding test file in the `__tests__` directory that verifies:

1. **Basic Conversion**: Tests that a source object is correctly converted to a target object.
2. **Option Handling**: Tests that converter options modify the conversion behavior.
3. **Edge Cases**: Tests handling of null, undefined, and invalid values.
4. **Circular References**: Tests that circular references are correctly resolved.

## Future Enhancements

Potential future enhancements to the Data Model Conversion Utilities include:

1. **Bidirectional Conversion**: Add support for converting in both directions (e.g., application to Prisma).
2. **Validation**: Integrate with a validation library for runtime validation.
3. **Additional Provider Converters**: Implement converters for more providers (e.g., Fandom, MyAnimeList).
4. **Performance Optimizations**: Add caching and lazy loading for expensive conversions.
5. **Schema-Based Conversion**: Generate converters from schema definitions.
6. **Integration with API Layer**: Create utilities for API request/response conversions.
7. **Provider-Specific Chapter Converters**: Implement specialized converters for provider-specific chapter data.
8. **Validation Rules**: Add configurable validation rules for converter inputs and outputs.
9. **Conversion Pipelines**: Support chaining multiple converters in a pipeline for complex transformations.

---

The Data Model Conversion Utilities provide a robust foundation for handling complex data transformations throughout the application, ensuring type safety, consistency, and maintainability.