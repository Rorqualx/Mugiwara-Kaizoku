# MangaDex TypeScript API Client

A strictly typed, safe, and secure TypeScript client for the MangaDex API, built with best practices for production use.

## Features

- **Strict TypeScript Typing**: Full TypeScript support with strict type checking
- **Safety & Security**: Input validation, rate limiting, and error handling
- **Best Practices**: Follows MangaDex API guidelines and TypeScript best practices
- **Comprehensive Coverage**: Supports all major API endpoints
- **Production Ready**: Configurable, extensible, and well-documented

## Installation

```bash
npm install mangadex-ts-client
```

Or for development:

```bash
cd ts-mangadex
npm install
npm run build
```

## Quick Start

```typescript
import { createDefaultClient } from 'mangadex-ts-client';

async function main() {
  // Create client with safe defaults
  const client = createDefaultClient();
  
  // Test API health
  const pingResult = await client.ping();
  console.log(`API is healthy: ${pingResult}`);
  
  // Search for manga
  const results = await client.searchManga({
    title: 'One Piece',
    limit: 5,
    contentRating: ['safe', 'suggestive'],
  });
  
  // Get detailed manga information
  if (Array.isArray(results.data) && results.data.length > 0) {
    const manga = await client.getManga(results.data[0].id);
    console.log(`Found: ${client.getEnglishTitle(manga.data)}`);
  }
}

main().catch(console.error);
```

## API Reference

### Client Configuration

```typescript
import { MangaDexClient } from 'mangadex-ts-client';

const client = new MangaDexClient({
  baseUrl: 'https://api.mangadex.org',
  timeout: 30000, // 30 seconds
  rateLimit: {
    maxRequests: 5, // MangaDex recommends 5-10 requests per second
    perMilliseconds: 1000,
  },
  defaultContentRating: ['safe', 'suggestive', 'erotica'],
  userAgent: 'Your-App-Name/1.0.0',
});
```

### Core Methods

#### Search Manga
```typescript
const results = await client.searchManga({
  title: 'Naruto',
  limit: 10,
  status: ['ongoing', 'completed'],
  contentRating: ['safe'],
  order: { followedCount: 'desc' },
});
```

#### Get Manga by ID
```typescript
const manga = await client.getManga('manga-uuid-here', [
  'author',
  'artist',
  'cover_art',
]);
```

#### Get Manga Chapters
```typescript
const chapters = await client.getMangaChapters('manga-uuid-here', {
  limit: 20,
  translatedLanguage: ['en'],
  order: { chapter: 'desc' },
});
```

#### Get Cover Art
```typescript
const covers = await client.getMangaCovers('manga-uuid-here', 10, 0);
const coverUrl = client.getCoverUrl(covers.data[0].attributes, '512');
```

#### Get Chapter Images
```typescript
const images = await client.getChapterImages('chapter-uuid-here');
// images contains URLs for chapter pages
```

### Utility Methods

```typescript
// Get English title (falls back to other languages)
const title = client.getEnglishTitle(manga);

// Get English description
const description = client.getEnglishDescription(manga);

// Extract relationships
const authors = client.extractRelationships(manga, 'author');

// Validate UUID
const isValid = client.isValidUUID('some-uuid'); // Returns boolean
```

## Type Safety

The client provides comprehensive TypeScript types:

```typescript
import {
  Manga,
  Chapter,
  Author,
  CoverArt,
  MangaSearchParams,
  ChapterSearchParams,
  ContentRating,
  PublicationStatus,
  // ... and many more
} from 'mangadex-ts-client';
```

## Error Handling

```typescript
import { MangaDexApiError } from 'mangadex-ts-client';

try {
  await client.getManga('invalid-uuid');
} catch (error) {
  if (error instanceof MangaDexApiError) {
    console.error(`API Error: ${error.message}`);
    console.error(`Status: ${error.statusCode}`);
    console.error(`Request ID: ${error.requestId}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Security Best Practices

### 1. Input Validation
- All UUIDs are validated before making requests
- Query parameters are sanitized
- Content ratings are enforced

### 2. Rate Limiting
- Built-in rate limiter (configurable)
- Respects MangaDex API guidelines (5-10 requests/second)
- Automatic retry-after header support

### 3. Error Handling
- Structured error types
- Request ID tracking
- Graceful degradation

### 4. HTTPS Enforcement
- All requests use HTTPS
- Certificate validation
- Secure headers

## Examples

See the `src/examples/` directory for complete examples:

1. **Basic Demo**: `demo.ts` - Complete API demonstration
2. **Search Example**: `search.ts` - Advanced search with filters
3. **Batch Operations**: `batch.ts` - Handling multiple requests

Run examples:
```bash
npm run build
node dist/examples/demo.js
```

## Development

### Building
```bash
npm run build        # Build project
npm run build:watch  # Watch mode
```

### Testing
```bash
npm test             # Run tests
npm run test:watch   # Watch mode
```

### Linting
```bash
npm run lint         # TypeScript and ESLint
npm run lint:fix     # Auto-fix issues
```

## MangaDex API Compliance

This client follows MangaDex's [Acceptable Use Policy](https://api.mangadex.org/docs/):

- ✅ Credits MangaDex in user agent
- ✅ Respects rate limits
- ✅ Properly handles content ratings
- ✅ No ads or paid services
- ✅ Credits scanlation groups when displaying chapters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- [MangaDex API Documentation](https://api.mangadex.org/docs/)
- [GitHub Issues](https://github.com/your-username/mangadex-ts-client/issues)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Acknowledgments

- MangaDex team for providing the API
- All scanlation groups and contributors
- TypeScript community for excellent tooling
