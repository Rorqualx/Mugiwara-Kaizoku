# Kapowarr Integration Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Integration Guide

---
# Kapowarr Native Downloader Integration

## Overview

The Kapowarr integration provides native manga downloading capabilities from any website without requiring external download clients. It allows users to configure custom website sources, search for manga, and download chapters directly.

## Features

- **Custom Website Sources**: Add any manga website as a source by providing URL and selectors
- **Automatic Structure Detection**: Validates websites and suggests selectors automatically
- **Multi-Source Search**: Search across all configured sources simultaneously
- **Direct Downloads**: Download manga chapters without external clients
- **Progress Tracking**: Monitor download progress and history
- **Flexible Configuration**: Customize selectors for different website structures

## Architecture

### Domain Types
- `KapowarrSource`: Represents a configured website source
- `KapowarrDownload`: Tracks individual chapter downloads
- `KapowarrSourceConfig`: Configuration including selectors and authentication

### Key Components
1. **Base Infrastructure**
   - `BaseKapowarrAdapter`: Abstract base class for website adapters
   - `WebScraper`: Cheerio-based HTML parsing engine
   - `WebsiteProviderAdapter`: Generic adapter for any website

2. **Services**
   - `KapowarrManager`: Central service managing sources and downloads
   - `WebsiteValidator`: Validates websites and detects structure

3. **tRPC Router**
   - Source management (CRUD operations)
   - Website validation
   - Manga search
   - Download management

4. **UI Components**
   - Settings page with source management
   - Search interface
   - Download history viewer

## Configuration

### Adding a Source

1. Navigate to Settings > Kapowarr
2. Click "Add Source" tab
3. Enter source name and website URL
4. Click "Validate Website" to auto-detect structure
5. Review and adjust selectors if needed
6. Save the source

### Selector Configuration

Selectors use CSS or XPath syntax to extract data from web pages:

```json
{
  "searchUrl": "https://example.com/search?q={query}",
  "selectors": {
    "searchResults": {
      "container": ".search-results",
      "title": { "css": ".manga-title", "extract": "text" },
      "coverUrl": { "css": "img.cover", "extract": "attribute", "attribute": "src" },
      "url": { "css": "a.link", "extract": "attribute", "attribute": "href" }
    },
    "chapterList": {
      "container": ".chapter-list",
      "number": { "css": ".ch-number", "extract": "text" },
      "url": { "css": "a", "extract": "attribute", "attribute": "href" }
    }
  }
}
```

### Authentication Options

Sources can be configured with authentication:
- **Basic Auth**: Username/password
- **Cookie**: Session cookies
- **Header**: Custom authorization headers

## API Reference

### tRPC Endpoints

```typescript
// Get all sources
kapowarr.getSources()

// Add a new source
kapowarr.addSource({ name, baseUrl, config })

// Validate a website
kapowarr.validateWebsite({ url })

// Search for manga
kapowarr.searchManga({ query, sourceIds?, limit? })

// Download a chapter
kapowarr.downloadChapter({ sourceId, mangaId, chapterId })

// Get download history
kapowarr.getDownloads({ status?, sourceId?, mangaId? })
```

## Development

### Creating a Custom Adapter

To add support for a specific website with custom logic:

```typescript
import { BaseKapowarrAdapter } from './baseKapowarrAdapter';

export class MyWebsiteAdapter extends BaseKapowarrAdapter {
  buildSearchUrl(query: string): string {
    // Custom search URL logic
    return `${this.config.baseUrl}/search/${encodeURIComponent(query)}`;
  }
  
  buildChapterUrl(mangaId: string, chapterId: string): string {
    // Custom chapter URL logic
    return `${this.config.baseUrl}/read/${mangaId}/${chapterId}`;
  }
}
```

### Adding Transformations

Selectors support transformations for data processing:

```typescript
{
  "transform": [
    { "type": "regex", "params": { "pattern": "Chapter (\\d+)", "replacement": "$1" }},
    { "type": "trim" },
    { "type": "prepend", "params": { "value": "https://example.com" }}
  ]
}
```

## Troubleshooting

### Common Issues

1. **Website validation fails**
   - Check if the website is accessible
   - Verify the URL is correct
   - Some sites may block automated access

2. **Selectors not working**
   - Inspect the website's HTML structure
   - Update selectors if the website changed
   - Test selectors using the browser console

3. **Downloads failing**
   - Check source status and enable if disabled
   - Verify manga still exists on the website
   - Check for rate limiting or IP blocks

### Debug Mode

Enable debug logging for detailed information:

```typescript
// In KapowarrManager
logger.debug('Selector results:', results);
```

## Security Considerations

- **Input Validation**: All user inputs are validated
- **XSS Prevention**: HTML content is sanitized
- **Rate Limiting**: Built-in rate limiting prevents abuse
- **Authentication**: Credentials are stored securely

## Future Enhancements

- **Batch Downloads**: Download multiple chapters at once
- **Download Scheduling**: Schedule downloads for off-peak hours
- **Plugin System**: Support for community-created adapters
- **OCR Support**: Extract text from image-only chapters
- **Mobile App**: Native mobile application support

## Contributing

To contribute to the Kapowarr integration:

1. Follow the established patterns (AsyncResult, proper error handling)
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure TypeScript compliance with no `any` types

## License

The Kapowarr integration is part of the Mugiwara-Kaizoku project and follows the same license terms.
