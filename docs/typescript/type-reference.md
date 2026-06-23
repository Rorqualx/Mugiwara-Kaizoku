# TypeScript Type Reference Guide

This document provides a visual reference for the key type structures used throughout the Mugiwara-Kaizoku project.

## Core Domain Types

### Manga Data Model

```mermaid
classDiagram
    class Manga {
        +number id
        +string title
        +string source
        +string status
        +string libraryPath
        +number libraryId
        +string? coverImage
        +Date createdAt
        +Date updatedAt
        +Date? lastChecked
        +MonitoringConfig monitoringConfig
        +Record~string, unknown~ providerMetadata
    }
    
    class Metadata {
        +number id
        +string cover
        +string? coverLarge
        +string? coverMedium
        +string? coverSmall
        +string? summary
        +string[] genres
        +string status
        +string[] tags
        +string[] authors
        +string[] characters
        +Date? startDate
        +Date? endDate
        +string[] synonyms
        +string[] urls
        +number? chapters
        +number? volumes
        +Date lastFetch
    }
    
    class Chapter {
        +number id
        +number mangaId
        +string title
        +string fileName
        +number? index
        +number size
        +string downloadStatus
        +string? language
        +number? pageCount
        +number? resolutionWidth
        +number? resolutionHeight
        +string? resolutionLabel
        +Date createdAt
        +Date updatedAt
    }
    
    class Library {
        +number id
        +string name
        +string path
        +Date createdAt
    }
    
    class OutOfSyncChapter {
        +number id
        +number mangaId
        +string title
        +string fileName
        +Date createdAt
        +Date updatedAt
    }
    
    Manga "1" -- "1" Metadata : has
    Manga "1" -- "*" Chapter : contains
    Manga "1" -- "*" OutOfSyncChapter : has
    Manga "*" -- "1" Library : belongs to
```

### Search Types

```mermaid
classDiagram
    class SearchResult {
        +string id
        +string title
        +string? cover
        +string? coverImage
        +string? description
        +string? status
        +string[]? alternativeTitles
        +number? score
        +number? popularity
        +string? startDate
        +string? endDate
        +string[]? genres
        +number? chapters
        +number? volumes
    }
    
    class MangaDexSearchResult {
        +string id
        +string title
        +string? cover
        +string? description
        +'manga' source
        +string? countryOfOrigin
        +boolean? isLicensed
        +MangaDexTag[]? tags
        +MangaDexExternalLink[]? externalLinks
        +string? dateAdded
        +string? dateLastUpdated
    }
    
    class AniListSearchResult {
        +string id
        +string title
        +string? cover
        +string? description
        +AniListDate? startDate
        +AniListDate? endDate
        +string? status
        +string[]? genres
        +string? format
        +string? countryOfOrigin
        +number? meanScore
        +number? popularity
    }
    
    SearchResult <|-- MangaDexSearchResult
    SearchResult <|-- AniListSearchResult
```

### Transaction Types

```mermaid
classDiagram
    class PrismaTransactionClient {
        +manga: MangaClient
        +chapter: ChapterClient
        +metadata: MetadataClient
        +library: LibraryClient
        +outOfSyncChapter: OutOfSyncChapterClient
    }
    
    class MangaTransactionClient {
        +create(data) Promise~Manga~
        +update(params) Promise~Manga~
        +delete(params) Promise~Manga~
        +findUnique(params) Promise~Manga~
    }
    
    class ChapterTransactionClient {
        +create(data) Promise~Chapter~
        +update(params) Promise~Chapter~
        +delete(params) Promise~Chapter~
        +findUnique(params) Promise~Chapter~
    }
    
    PrismaTransactionClient -- MangaTransactionClient
    PrismaTransactionClient -- ChapterTransactionClient
```

## UI Component Types

### Page Component Props

```mermaid
classDiagram
    class MangaDetailData {
        +string id
        +string title
        +string? source
        +string? status
        +string? coverImage
        +string? description
        +string? libraryPath
        +string? interval
        +string? monitoringConfig
        +ChapterWithMetadata[]? chapters
        +ProviderMetadata? providerMetadata
        +MangaMetadata? metadata
    }
    
    class LibraryData {
        +number id
        +string name
        +string path
        +Date createdAt
        +MangaWithRelations[] mangas
        +number mangaCount
    }
    
    class ChapterWithMetadata {
        +string id
        +string? title
        +number? number
        +number? index
        +string? fileName
        +number? volume
        +string? releaseDate
        +boolean? downloaded
        +string? language
        +number? size
    }
    
    MangaDetailData -- ChapterWithMetadata
```

### Form Input Types

```mermaid
classDiagram
    class MangaUpdateInput {
        +string title
        +string? status
        +string? source
        +string? libraryPath
        +number? libraryId
        +string? interval
    }
    
    class ChapterUpdateInput {
        +string? title
        +string? fileName
        +number? index
        +number? size
        +string? downloadStatus
        +string? language
        +number? pageCount
    }
    
    class ChapterCreateInput {
        +number mangaId
        +string fileName
        +number? index
        +string title
        +number size
        +string downloadStatus
        +string? language
        +number? pageCount
    }
    
    class LibraryCreateInput {
        +string name
        +string path
    }
```

## API Types

### Provider API Types

```mermaid
classDiagram
    class AniListResponse {
        +number id
        +AniListTitle title
        +string? description
        +AniListCoverImage? coverImage
        +string? status
        +number? averageScore
        +number? popularity
        +AniListDate? startDate
        +AniListDate? endDate
        +string[]? genres
    }
    
    class MangaDexResponse {
        +string id
        +Record~string, string~ title
        +Record~string, string~? description
        +string? status
        +string? originalLanguage
        +boolean? isLocked
        +string[]? tags
        +Record~string, string~? links
        +string? createdAt
        +string? updatedAt
    }
    
    class AniListTitle {
        +string? romaji
        +string? english
        +string? native
    }
    
    class AniListDate {
        +number? year
        +number? month
        +number? day
    }
    
    class AniListCoverImage {
        +string? large
        +string? medium
    }
    
    AniListResponse -- AniListTitle
    AniListResponse -- AniListDate
    AniListResponse -- AniListCoverImage
```

## TRPC Types

### TRPC Router Types

```mermaid
classDiagram
    class AppRouter {
        +MangaRouter manga
        +LibraryRouter library
        +SettingsRouter settings
        +SystemRouter system
        +ProviderRouter providers
        +EventsRouter events
    }
    
    class MangaRouter {
        +get(id) MangaWithRelations
        +query(include) MangaWithRelations[]
        +create(input) Manga
        +update(input) Manga
        +remove(input) Manga
        +enhanceChapterTitles(input) Result
    }
    
    class LibraryRouter {
        +get(id) LibraryWithMangas
        +query(id) LibraryWithMangas
        +list() Library[]
        +create(input) Library
        +update(input) Library
        +delete(input) Library
    }
    
    AppRouter -- MangaRouter
    AppRouter -- LibraryRouter
```

## Utility Types

### Type Guards and Validators

```mermaid
classDiagram
    class TypeGuards {
        +isObject(value) boolean
        +isArray(value) boolean
        +isString(value) boolean
        +isNumber(value) boolean
        +isBoolean(value) boolean
        +isDate(value) boolean
        +hasProperty(obj, prop) boolean
        +validateProperties(obj, props) boolean
    }
    
    class ValidationHelpers {
        +assert(condition, message) void
        +safeAssertion(value, validator) T
        +validateSchema(value, schema) boolean
        +filterArray(array, predicate) T[]
        +transformApiResponse(data, validator, transformer) T
    }
```

## Integration Types

### Integration Adapter Pattern

```mermaid
classDiagram
    class IntegrationAdapter {
        +initialize() Promise~boolean~
        +search(query) Promise~SearchResult[]~
        +getMetadata(id) Promise~SearchResult~
        +getStatus() Promise~IntegrationStatus~
    }
    
    class AniListAdapter {
        +initialize() Promise~boolean~
        +search(query) Promise~SearchResult[]~
        +getMetadata(id) Promise~SearchResult~
        +getStatus() Promise~IntegrationStatus~
        -mapAniListToSearchResult(data) SearchResult
    }
    
    class MangaDexAdapter {
        +initialize() Promise~boolean~
        +search(query) Promise~SearchResult[]~
        +getMetadata(id) Promise~SearchResult~
        +getStatus() Promise~IntegrationStatus~
        -mapMangaDexToSearchResult(data) SearchResult
    }
    
    IntegrationAdapter <|-- AniListAdapter
    IntegrationAdapter <|-- MangaDexAdapter
```

## Test Types

### Test Fixtures and Mocks

```mermaid
classDiagram
    class TestApiRequest {
        +Record~string, string|string[]~ headers
        +any[key: string]
    }
    
    class TestApiResponse {
        +any[key: string]
    }
    
    class TestUserContext {
        +string id
        +UserRole role
        +any[key: string]
    }
    
    class TestEvent {
        +number id
        +EventType type
        +EventSource source
        +EventLevel level
        +string message
        +Record~string, unknown~? details
        +string? relatedEntityId
        +string? relatedEntityType
        +Date timestamp
        +string? userId
    }
    
    class TestAniListSettings {
        +number id
        +string metadata
        +any[key: string]
    }
    
    class TestManga {
        +number id
        +string title
        +TestMetadata? metadata
        +any[key: string]
    }
```

## Using This Reference

Use this visual type reference to:

1. Understand the relationships between core domain types
2. Identify the required properties for API requests/responses
3. See the inheritance hierarchy of specialized types
4. Ensure consistency when creating new types
5. Find the appropriate type for a given use case

This reference will be updated as the type system evolves.