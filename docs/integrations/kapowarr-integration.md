# Kapowarr Integration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Integration

---
# Kapowarr Native Downloader Integration

## Overview

The Kapowarr integration provides native manga downloading capabilities from any website, inspired by Kapowarr's approach to content acquisition. It allows users to configure custom website sources with CSS selectors for data extraction.

## Current Implementation Status

### ✅ Completed (Phases 1-4)

1. **Core Type System & Domain Models**
   - Domain types in `src/types/domain/kapowarr-types.ts`
   - Adapter interfaces in `src/types/adapters/kapowarr.ts`
   - Prisma schema updated with Kapowarr models
   - Enum values following UPPERCASE convention

2. **Base Infrastructure**
   - `BaseKapowarrAdapter` - Abstract base class for website adapters
   - `WebScraper` - HTML parsing and data extraction engine
   - `WebsiteProviderAdapter` - Generic adapter implementation
   - Converter utilities for Prisma to domain type conversion

3. **tRPC Integration**
   - Complete router with all CRUD operations
   - Event logging integration
   - Proper error handling and validation
   - ID conversion using `toNumberId`

4. **UI Components**
   - Settings page with source management
   - Add source wizard with validation
   - Download history and monitoring
   - Search interface for finding manga

### 🚧 To Be Implemented (Phases 5-8)

5. **Services & Background Jobs**
   - KapowarrManager service
   - Background download worker
   - Queue management

6. **Integration & Migration**
   - Navigation routes
   - Settings page integration
   - Default source templates

7. **Testing & Documentation**
   - Unit tests for adapters
   - Integration tests for tRPC endpoints
   - User documentation

8. **Deployment & Monitoring**
   - Environment configuration
   - Performance metrics
   - Error tracking

## Architecture

### Component Structure

```
src/
├── api/metadataProviders/
│   ├── adapters/
│   │   ├── baseKapowarrAdapter.ts    # Base adapter class
│   │   └── websiteProviderAdapter.ts  # Generic website adapter
│   └── scrapers/
│       └── WebScraper.ts              # Web scraping engine
├── components/
│   ├── settings/kapowarr/            # Settings UI components
│   │   ├── KapowarrSettings.tsx
│   │   ├── KapowarrSourceList.tsx
│   │   ├── AddKapowarrSource.tsx
│   │   ├── KapowarrDownloads.tsx
│   │   ├── WebsiteInspector.tsx
│   │   └── SelectorBuilder.tsx
│   └── manga/kapowarr/               # Manga search components
│       └── KapowarrSearch.tsx
├── server/trpc/routers/
│   └── kapowarr.ts                   # tRPC router
├── types/
│   ├── domain/
│   │   └── kapowarr-types.ts         # Domain types
│   └── adapters/
│       └── kapowarr.ts               # Adapter interfaces
└── utils/converters/
    └── kapowarr-converters.ts        # Type converters
```

### Data Flow

1. **Configuration**: User adds website source with selectors
2. **Search**: Query sent to configured sources via adapters
3. **Scraping**: WebScraper extracts data using CSS selectors
4. **Download**: Chapter URLs queued for background downloading
5. **Storage**: Downloaded files saved to manga library

## Usage

### Adding a Website Source

1. Navigate to Settings → Kapowarr
2. Click "Add Source" tab
3. Enter website details:
   - Name: Friendly name for the source
   - Base URL: Website homepage
   - Search URL: Search endpoint with `{query}` placeholder
4. Validate the website
5. Configure CSS selectors for data extraction
6. Save the source

### Configuring Selectors

The selector builder helps identify CSS selectors for:

- **Search Results**: Container and individual result fields
- **Manga Details**: Title, description, cover, metadata
- **Chapter List**: Container and chapter information
- **Download Links**: Image URLs for chapter pages

### Example Selector Configuration

```javascript
{
  searchResults: {
    container: '.search-results .manga-item',
    id: { css: 'a', extract: 'attribute', attribute: 'href' },
    title: { css: '.title', extract: 'text' },
    coverUrl: { css: 'img', extract: 'attribute', attribute: 'src' },
    url: { css: 'a', extract: 'attribute', attribute: 'href' }
  },
  mangaDetails: {
    title: { css: 'h1.manga-title', extract: 'text' },
    description: { css: '.synopsis', extract: 'text' },
    coverUrl: { css: '.cover img', extract: 'attribute', attribute: 'src' }
  },
  chapterList: {
    container: '.chapter-list li',
    number: { css: '.chapter-num', extract: 'text' },
    title: { css: '.chapter-title', extract: 'text' },
    url: { css: 'a', extract: 'attribute', attribute: 'href' }
  }
}
```

## API Reference

### tRPC Endpoints

- `kapowarr.getSources` - Get all configured sources
- `kapowarr.getSource` - Get a single source by ID
- `kapowarr.addSource` - Add a new website source
- `kapowarr.updateSource` - Update source configuration
- `kapowarr.deleteSource` - Remove a source
- `kapowarr.validateWebsite` - Test website compatibility
- `kapowarr.searchManga` - Search across sources
- `kapowarr.downloadChapter` - Queue chapter download
- `kapowarr.getDownloads` - Get download history
- `kapowarr.cancelDownload` - Cancel active download
- `kapowarr.retryDownload` - Retry failed download

## Development Guidelines

### Following Mugiwara-Kaizoku Patterns

1. **Adapter Pattern**: All website integrations extend `BaseKapowarrAdapter`
2. **AsyncResult Pattern**: Internal methods use AsyncResult for error handling
3. **Type Safety**: No `any` types except for validated JSON config
4. **Enum Standards**: All enums use UPPERCASE string values
5. **ID Conversion**: Use `toNumberId()` when passing to Prisma
6. **Error Logging**: Use system event logger for all operations

### Adding a New Adapter

1. Create a new adapter class extending `BaseKapowarrAdapter`
2. Implement required methods:
   - `buildSearchUrl`
   - `buildChapterUrl`
   - `buildMangaUrl`
3. Override data extraction if needed
4. Add factory function for creation

### Security Considerations

- Sanitize all scraped content
- Validate URLs before fetching
- Respect robots.txt
- Add rate limiting per source
- Handle authentication securely

## Next Steps

To complete the implementation:

1. **Create KapowarrManager Service**
   - Initialize adapters from database
   - Coordinate searches across sources
   - Manage download queue

2. **Implement Download Worker**
   - Process download queue
   - Handle retries and failures
   - Update progress in database

3. **Add Navigation Routes**
   - Link from main settings
   - Add to manga search options
   - Create detail pages

4. **Write Tests**
   - Unit tests for adapters
   - Integration tests for scraping
   - E2E tests for UI flow

5. **Add Default Sources**
   - Pre-configured popular sites
   - Template selector patterns
   - Migration for existing users
