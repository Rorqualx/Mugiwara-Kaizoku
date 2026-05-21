# Fandom Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Guide

---
# Fandom Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Setup and Usage](#setup-and-usage)
5. [Enhanced Data Integration](#enhanced-data-integration)
6. [Cross-Provider Enrichment](#cross-provider-enrichment)
7. [Troubleshooting](#troubleshooting)
8. [Technical Reference](#technical-reference)
9. [Testing](#testing)

## Overview

The Fandom integration leverages the extensive manga and anime wikis on Fandom to provide comprehensive metadata enrichment. By crawling and parsing wiki pages, Kaizoku can extract detailed information that may not be available from primary metadata providers like AniList, ComicVine, or MangaDex.

### Key Benefits

- **Complete Chapter Information**: Chapter titles, descriptions, and cover art
- **Detailed Volume Data**: Release dates, ISBNs, and volume-specific information
- **Character Profiles**: Character information, roles, and images
- **Cross-Provider Enrichment**: Fills gaps in metadata from other providers
- **Wiki-Quality Data**: Community-maintained, comprehensive information

## Features

### Metadata Extraction

The integration can extract:

- **Volume Information**:
  - Volume numbers and titles
  - Release dates
  - ISBN numbers
  - Cover images
  - Chapter listings per volume

- **Chapter Details**:
  - Chapter titles and numbers
  - Publication dates
  - Chapter summaries
  - Cover art (when available)
  - Arc information

- **Character Data**:
  - Character profiles
  - Roles and appearances
  - Character images
  - Relationships

- **Additional Information**:
  - External links
  - References
  - Publication demographics
  - Original language details

### Automatic Enhancement

The integration works automatically in several scenarios:

1. **On Manga Addition**: When adding manga to the library
2. **During Metadata Refresh**: When manually refreshing metadata
3. **On Demand**: When viewing manga with incomplete metadata

## Architecture

### Components

```
Fandom Integration
  ├── FandomWikiCrawler (data extraction)
  │   ├── Volume Crawler
  │   ├── Chapter Crawler
  │   ├── Character Crawler
  │   └── Infobox Parser
  ├── FandomCrawlerUtility (crawler interface)
  │   ├── Wiki Detection
  │   ├── Result Caching
  │   └── Error Handling
  ├── FandomService (API interface)
  │   ├── Search Methods
  │   ├── Data Retrieval
  │   └── Metadata Updates
  └── MetadataMerger (integration point)
      ├── Cross-Provider Matching
      ├── Data Merging
      └── Conflict Resolution
```

### Data Flow

1. **Wiki Detection**: Find the appropriate Fandom wiki for a manga
2. **Data Crawling**: Extract structured data from wiki pages
3. **Data Processing**: Transform wiki data into standardized format
4. **Metadata Merging**: Combine with existing metadata
5. **Database Update**: Store enhanced metadata

## Setup and Usage

### Configuration

The Fandom integration is enabled by default and requires no additional configuration. However, you can customize:

```typescript
interface FandomConfig {
  enabled: boolean;
  cacheDuration?: number;      // Cache duration in seconds
  crawlTimeout?: number;       // Crawler timeout in milliseconds
  maxRetries?: number;         // Maximum retry attempts
  preferredLanguage?: string;  // Preferred wiki language
}
```

### Basic Usage

#### Search for Manga

```typescript
import { fandomService } from '@/server/services/fandom/service';

// Search for manga on Fandom
const results = await fandomService.searchManga('One Piece');
```

#### Get Chapter Information

```typescript
// Get chapters with titles
const chapters = await fandomService.getChapters('One Piece');
// Returns: [{ number: 1, title: 'Romance Dawn', ... }, ...]
```

#### Get Volume/Chapter Counts

```typescript
// Get counts
const volumeCount = await fandomService.getVolumeCount('One Piece');
const chapterCount = await fandomService.getChapterCount('One Piece');
```

## Enhanced Data Integration

### Crawler Modes

The Fandom Wiki crawler supports different modes:

```bash
# Full crawl (all data)
node scripts/fandom_wiki_crawler.mjs onepiece full

# Specific data types
node scripts/fandom_wiki_crawler.mjs onepiece volumes
node scripts/fandom_wiki_crawler.mjs onepiece chapters
node scripts/fandom_wiki_crawler.mjs onepiece characters
```

### Enhanced Data Structure

```typescript
interface FandomEnhancedData {
  wiki: {
    domain: string;
    info?: WikiInfo;
  };
  
  volumes: Array<{
    number: number;
    title?: string;
    releaseDate?: string;
    isbn?: string;
    coverImage?: string;
    chapters: number[];
  }>;
  
  chapters: Array<{
    number: number;
    title?: string;
    volume?: number;
    releaseDate?: string;
    summary?: string;
    coverImage?: string;
    arc?: string;
  }>;
  
  characters: Array<{
    name: string;
    role?: string;
    description?: string;
    image?: string;
    appearances: number[];
  }>;
  
  infoboxData: Array<{
    title: string;
    infobox: {
      demographic?: string;
      originalLanguage?: string;
      publisher?: string;
      author?: string;
      status?: string;
    };
  }>;
}
```

### Using Enhanced Data

```typescript
// Get enhanced data
const enhancedData = await fandomService.getEnhancedMangaData('One Piece');

// Access detailed information
console.log(`Total volumes: ${enhancedData.volumes.length}`);
console.log(`Total chapters: ${enhancedData.chapters.length}`);
console.log(`Main characters: ${enhancedData.characters.length}`);

// Update manga with enhanced data
const updatedManga = await fandomService.updateMangaMetadata(mangaId);
```

## Cross-Provider Enrichment

### How It Works

1. **Primary Provider First**: Fetch basic metadata from AniList/ComicVine/MangaDex
2. **Title Matching**: Use string similarity to find corresponding Fandom wiki
3. **Data Extraction**: Crawl wiki for additional information
4. **Smart Merging**: Combine data, prioritizing authoritative sources
5. **Conflict Resolution**: Handle discrepancies between providers

### Example: One Piece

```
AniList provides:
  - Basic info (genres, status, cover)
  - Synopsis
  - Character list

MangaDex provides:
  - Some chapter information
  - Multiple language options

Fandom adds:
  - Complete chapter titles (1000+ chapters)
  - Volume organization (100+ volumes)
  - Detailed character profiles
  - Arc information
  - Chapter summaries
```

### String Similarity Matching

The integration uses intelligent matching to handle title variations:

```typescript
// These would all match to the same Fandom wiki:
"One Piece"              // AniList
"One Piece (Manga)"      // Fandom
"ONE PIECE"              // MangaDex
"ワンピース"              // Japanese title
```

## Troubleshooting

### Common Issues

#### No Fandom Data Found

**Problem**: Manga exists but no Fandom data is retrieved.

**Solutions**:
1. Check if a Fandom wiki exists for the manga
2. Try alternative title spellings
3. Verify the wiki URL format
4. Check crawler logs for errors

#### Incomplete Chapter Titles

**Problem**: Some chapters have titles, others don't.

**Solutions**:
1. The wiki might have incomplete data
2. Run a full crawl to get latest data
3. Check if chapters are organized differently on the wiki

#### Slow Metadata Updates

**Problem**: Fandom data takes long to load.

**Solutions**:
1. Crawling is resource-intensive; be patient
2. Use cached data when available
3. Consider running crawls during off-peak hours

#### Mismatched Data

**Problem**: Fandom data doesn't match other providers.

**Solutions**:
1. Fandom wikis are community-maintained
2. Trust primary providers for critical data
3. Use Fandom for supplementary information

### Debugging

Enable debug logging:

```typescript
// In your environment
FANDOM_DEBUG=true

// Or in code
fandomService.setDebugMode(true);
```

Check crawler output:
```bash
# View crawler results
cat crawler_results/onepiece_fandom_data.json | jq .
```

## Technical Reference

### FandomService Methods

```typescript
class FandomService {
  // Search operations
  async searchManga(title: string): Promise<SearchResult[]>
  
  // Data retrieval
  async getChapters(mangaTitle: string): Promise<Chapter[]>
  async getVolumeCount(mangaTitle: string): Promise<number>
  async getChapterCount(mangaTitle: string): Promise<number>
  
  // Enhanced data
  async getEnhancedMangaData(title: string): Promise<FandomEnhancedData>
  async updateMangaMetadata(mangaId: number): Promise<Manga>
  
  // Utility methods
  async findBestWiki(title: string): Promise<string | null>
  async validateWiki(domain: string): Promise<boolean>
}
```

### MetadataMerger Integration

```typescript
class MetadataMergerService {
  // Enrich manga with all available providers
  async enrichMangaMetadata(
    mangaId: number, 
    forceRefresh?: boolean
  ): Promise<void>
  
  // Specifically use Fandom for chapter enrichment
  async enrichChapterMetadataFromFandom(
    mangaId: number
  ): Promise<boolean>
  
  // Cross-provider title matching
  async findMatchingFandomWiki(
    mangaTitle: string, 
    alternativeTitles?: string[]
  ): Promise<string | null>
}
```

### Crawler Utility

```typescript
class FandomCrawlerUtility {
  // Run crawler
  async runCrawler(
    wikiDomain: string, 
    mode?: CrawlMode
  ): Promise<FandomEnhancedData>
  
  // Load results
  async loadCrawlerResults(
    wikiDomain: string
  ): Promise<FandomEnhancedData | null>
  
  // Cache management
  async clearCache(wikiDomain?: string): Promise<void>
  async getCacheAge(wikiDomain: string): Promise<number>
}
```

## Testing

### Test Scripts

```bash
# General integration test
node scripts/test-fandom-integration.mjs

# Specific manga test (One Piece)
node scripts/test-one-piece-fandom.mjs

# Service isolation test
node scripts/test-fandom-service.js

# Enhanced data test
node scripts/test-fandom-enhanced-data.mjs
```

### Manual Testing

1. **Add a Popular Manga**:
   - Add "One Piece" or "Naruto" from any provider
   - Check if chapter titles appear
   - Verify volume organization

2. **Refresh Metadata**:
   - Use the refresh button on manga detail page
   - Monitor logs for Fandom enrichment
   - Check for new data

3. **Compare Providers**:
   - Add same manga from different providers
   - Compare the metadata completeness
   - Verify Fandom fills the gaps

### Crawler Testing

```bash
# Test crawler directly
node scripts/fandom_wiki_crawler.mjs naruto full

# View results
ls -la crawler_results/
cat crawler_results/naruto_fandom_data.json | jq '.chapters[0]'
```

## Best Practices

1. **Cache Management**:
   - Crawler results are cached to reduce load
   - Clear cache periodically for fresh data
   - Respect wiki rate limits

2. **Data Priority**:
   - Use Fandom for supplementary data
   - Trust primary providers for critical info
   - Handle conflicts gracefully

3. **Performance**:
   - Run crawls asynchronously
   - Use cached data when possible
   - Limit concurrent crawl operations

4. **Error Handling**:
   - Always have fallbacks
   - Log crawler errors for debugging
   - Handle missing wikis gracefully

## Future Improvements

Planned enhancements include:

1. **Multi-Language Support**: Crawl wikis in different languages
2. **Incremental Updates**: Only crawl changed pages
3. **More Wiki Sources**: Support Wikipedia, other wiki platforms
4. **User Contributions**: Allow users to submit wiki links
5. **Automated Wiki Discovery**: Find wikis automatically
6. **Real-time Updates**: Subscribe to wiki changes
7. **Data Validation**: Verify extracted data accuracy
8. **Custom Wiki Support**: Allow adding custom wiki sources

## Conclusion

The Fandom integration provides a powerful way to enrich manga metadata by leveraging the extensive information available on Fandom wikis. Through intelligent crawling and cross-provider matching, it ensures that users have access to the most comprehensive metadata possible, regardless of which primary provider they use.

The combination of automated enhancement, detailed extraction capabilities, and smart merging makes the Fandom integration an essential component for delivering a rich manga reading experience in Kaizoku.
