# Mangadex Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Mangadex Guide

---
# MangaDex Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Setup](#setup)
4. [Usage](#usage)
5. [API Integration](#api-integration)
6. [Enhanced Data Fields](#enhanced-data-fields)
7. [Troubleshooting](#troubleshooting)
8. [Scripts and Tools](#scripts-and-tools)
9. [Technical Reference](#technical-reference)

## Overview

MangaDex is one of the largest online manga reading platforms, providing comprehensive metadata and chapter information for thousands of manga titles. The Kaizoku integration leverages the MangaDex API to provide:

- Rich metadata including covers, descriptions, and publication details
- Enhanced chapter titles with proper naming
- Volume organization and chapter grouping
- Multi-language support
- External links to official sources

## Features

### Core Features

- **Advanced Search**: Search manga by title with comprehensive filtering
- **Rich Metadata**: Detailed manga information including demographics, ratings, and external links
- **Chapter Management**: Enhanced chapter titles and volume organization
- **Language Support**: Access to multiple translation languages
- **Automatic Enhancement**: Chapter titles are automatically enhanced when viewing manga

### Enhanced Data Integration

- **Publication Demographics**: Target audience classification (shounen, seinen, josei, shoujo)
- **Language Information**: Original language and available translations
- **External Links**: Links to official sites, social media, and retail platforms
- **Statistics**: Rating data, follow counts, and engagement metrics
- **Timestamps**: Creation and update timestamps for tracking changes

## Setup

### Enable MangaDex Provider

Run the setup script to enable MangaDex as a search provider:

```bash
node scripts/enable-mangadex-provider.js
```

This will:
1. Add MangaDex to the available search providers
2. Configure default settings
3. Enable the integration in the application

### Configuration

MangaDex integration works out of the box without authentication. However, some features may benefit from authenticated access:

```typescript
interface MangaDexConfig {
  enabled: boolean;
  apiEndpoint?: string;    // Default: 'https://api.mangadex.org'
  rateLimit?: number;      // Default: 5 requests/second
  language?: string[];     // Default: ['en']
}
```

## Usage

### Searching for Manga

1. **In the Application**:
   - Navigate to the search page
   - Select MangaDex as the provider (or use multi-provider search)
   - Enter your search query
   - Results will include MangaDex manga with cover images

2. **Search Options**:
   - Title search (partial matching supported)
   - Language filtering
   - Include/exclude content ratings
   - Sort by relevance, update date, or follow count

### Adding Manga to Library

When adding manga from MangaDex:

1. **Automatic Metadata Retrieval**:
   - Cover images are downloaded
   - Description and genres are saved
   - Publication status is tracked
   - External links are preserved

2. **Chapter Enhancement**:
   - Chapter titles are automatically enhanced
   - Proper formatting: "Chapter X: Title Name"
   - Volume grouping is preserved

### Viewing Manga Details

The manga detail page displays:

- High-quality cover art
- Comprehensive description
- Publication information (demographic, status, language)
- Enhanced chapter list with proper titles
- Volume organization
- External links to official sources

## API Integration

### Architecture

```
MangaDexProvider
  ├── MangaDexApiClient (API communication)
  │   ├── Rate Limiting
  │   ├── Response Caching
  │   └── Error Handling
  ├── MangaDexMangaService (manga operations)
  └── MangaDexChapterService (chapter operations)
```

### API Client Methods

```typescript
class MangaDexApiClient {
  // Manga operations
  searchManga(params: SearchParams): Promise<MangaList>
  getManga(id: string, includes?: string[]): Promise<Manga>
  getMangaVolumesAndChapters(id: string): Promise<Aggregate>
  
  // Chapter operations
  getMangaFeed(id: string, params?: FeedParams): Promise<ChapterList>
  getChapter(id: string): Promise<Chapter>
  getChapterPages(id: string): Promise<Pages>
  
  // Cover operations
  getMangaCovers(mangaId: string): Promise<CoverList>
  buildCoverUrl(mangaId: string, filename: string, size?: CoverSize): string
  
  // Author/Artist operations
  searchAuthors(name: string): Promise<AuthorList>
  getAuthor(id: string): Promise<Author>
}
```

## Enhanced Data Fields

### Basic Metadata

```typescript
interface MangaDexManga {
  // Core fields
  id: string;
  title: LocalizedString;
  altTitles: LocalizedString[];
  description: LocalizedString;
  
  // Publication info
  year?: number;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  publicationDemographic?: 'shounen' | 'seinen' | 'josei' | 'shoujo';
  
  // Language info
  originalLanguage: string;
  availableTranslatedLanguages: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Content info
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  tags: Tag[];
  
  // State info
  state: 'draft' | 'submitted' | 'published' | 'rejected';
  isLocked: boolean;
  version: number;
}
```

### External Links

```typescript
interface Links {
  al?: string;          // AniList
  ap?: string;          // Anime-Planet
  bw?: string;          // Bookwalker
  mu?: string;          // MangaUpdates
  nu?: string;          // NovelUpdates
  kt?: string;          // Kitsu
  amz?: string;         // Amazon
  ebj?: string;         // EBookJapan
  mal?: string;         // MyAnimeList
  cdj?: string;         // CDJapan
  raw?: string;         // Raw source
  engtl?: string;       // Official English
}
```

### Statistics

When available, statistics include:

```typescript
interface Statistics {
  rating: {
    average: number;
    distribution: {
      '1': number;
      '2': number;
      // ... up to '10'
    };
  };
  follows: number;
}
```

## Troubleshooting

### Common Issues

#### Missing Chapter Titles

**Problem**: Chapters show generic titles like "Chapter 1" instead of proper names.

**Solution**: 
```bash
# Refresh specific manga
node scripts/refresh-mangadex-manga.js [mangaId]

# Or refresh all MangaDex manga
node scripts/refresh-mangadex-manga.js
```

#### API Rate Limiting

**Problem**: "Rate limit exceeded" errors.

**Solution**:
1. The integration includes automatic rate limiting (5 req/sec)
2. If persistent, wait a few minutes before retrying
3. Consider implementing request queuing for bulk operations

#### Missing Metadata

**Problem**: Manga missing cover images or descriptions.

**Solution**:
```bash
# Update metadata for specific manga
node scripts/update-manga-metadata-mangadex.js [mangaId]
```

#### Language Issues

**Problem**: Chapters not in desired language.

**Solution**:
1. Check available languages in manga details
2. Configure preferred languages in settings
3. The integration defaults to English ('en')

### Finding Manga IDs

To find a manga's database ID:

```bash
node scripts/find-manga-by-title.js "Manga Title"
```

Example:
```bash
node scripts/find-manga-by-title.js "One Piece"
# Output: ID: 123, Title: One Piece, Source: mangadex
# Command: node scripts/refresh-mangadex-manga.js 123
```

## Scripts and Tools

### Setup and Configuration

```bash
# Enable MangaDex provider
node scripts/enable-mangadex-provider.js
```

### Data Management

```bash
# Refresh all manga data (metadata + chapters)
node scripts/refresh-mangadex-manga.js [mangaId]

# Update only metadata
node scripts/update-manga-metadata-mangadex.js [mangaId]

# Enhance only chapter titles
node scripts/enhance-chapter-titles-mangadex.js [mangaId]

# Find manga by title
node scripts/find-manga-by-title.js "Title"
```

### Testing

```bash
# Test search functionality
node scripts/test-mangadex-search.js "One Piece"

# Test chapter title enhancement
node scripts/test-mangadex-chapter-titles.mjs

# Test enhanced data retrieval
node scripts/test-mangadex-enhanced-data.mjs
```

## Technical Reference

### Service Methods

#### MangaDexMangaService

```typescript
class MangaDexMangaService {
  // Search for manga
  async searchManga(
    query: string, 
    limit?: number, 
    offset?: number
  ): Promise<SearchResult[]>
  
  // Get detailed manga information
  async getManga(id: string): Promise<MangaDexManga>
  
  // Update manga metadata in database
  async updateMangaMetadata(mangaId: number): Promise<void>
  
  // Find MangaDex ID by title
  async findMangaIdByTitle(title: string): Promise<string | null>
}
```

#### MangaDexChapterService

```typescript
class MangaDexChapterService {
  // Get all chapters for a manga
  async getMangaChapters(
    mangaId: string, 
    language?: string
  ): Promise<Chapter[]>
  
  // Get chapters organized by volume
  async getChaptersByVolume(
    mangaId: string, 
    language?: string
  ): Promise<VolumeChapterMap>
  
  // Enhance chapter titles in database
  async enhanceChapterTitles(mangaId: number): Promise<void>
  
  // Get chapter reading pages
  async getChapterPages(
    id: string, 
    dataSaver?: boolean
  ): Promise<string[]>
}
```

### Error Handling

The integration includes comprehensive error handling:

```typescript
class MangaDexError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: any[]
  ) {
    super(message);
    this.name = 'MangaDexError';
  }
}
```

Common error codes:
- `400`: Bad request (invalid parameters)
- `404`: Manga/Chapter not found
- `429`: Rate limit exceeded
- `500`: MangaDex server error

### Best Practices

1. **Rate Limiting**:
   - Respect the 5 requests/second limit
   - Implement exponential backoff for retries
   - Cache responses when appropriate

2. **Language Handling**:
   - Always specify desired languages in requests
   - Handle missing translations gracefully
   - Default to original language if translation unavailable

3. **Data Quality**:
   - Validate external IDs before using
   - Handle missing optional fields
   - Keep local metadata in sync with MangaDex

4. **Performance**:
   - Use pagination for large result sets
   - Request only needed includes
   - Cache cover URLs (they're static)

## Future Improvements

Planned enhancements include:

1. **Authentication Support**: Login for access to private follows and lists
2. **Advanced Filtering**: Tag-based search, demographic filtering
3. **Batch Operations**: Update multiple manga efficiently
4. **Reading Progress Sync**: Sync reading progress with MangaDex
5. **Scanlation Group Preferences**: Filter by preferred translation groups
6. **Cover Art Selection**: Choose from multiple cover options

## Additional Resources

- [MangaDex API Documentation](https://api.mangadex.org/docs/)
- [MangaDex API Swagger](https://api.mangadex.org/swagger.html)
- [MangaDex Forums](https://forums.mangadex.org/)

## Conclusion

The MangaDex integration provides comprehensive manga metadata and chapter management capabilities. With automatic enhancement, rich data fields, and robust error handling, it offers a reliable way to access one of the largest manga databases available.
