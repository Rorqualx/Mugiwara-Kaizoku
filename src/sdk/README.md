# Kaizoku API SDK

TypeScript SDK for interacting with the Kaizoku API.

## Installation

```typescript
import { createKaizokuApiClient } from './kaizoku-api-sdk';
```

## Quick Start

```typescript
// Initialize the client
const client = createKaizokuApiClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key-here',
  timeout: 30000, // Optional: 30 seconds
  retryAttempts: 3, // Optional: retry failed requests
});

// List manga
const mangaList = await client.manga.list({
  page: 1,
  limit: 20,
  search: 'One Piece'
});

// Get specific manga
const manga = await client.manga.get(123);

// Create new manga
const newManga = await client.manga.create({
  title: 'One Piece',
  sourceId: 'one-piece',
  source: 'anilist',
  libraryId: 1,
  metadata: {
    description: 'Pirates and adventure!',
    authors: ['Eiichiro Oda'],
    genres: ['Shounen', 'Adventure'],
  }
});
```

## API Reference

### Manga Operations

```typescript
// List manga with pagination and filters
client.manga.list({
  page?: number,
  limit?: number,
  libraryId?: string,
  status?: string,
  search?: string
})

// Get manga by ID
client.manga.get(id: string | number, options?: { include?: string })

// Create new manga
client.manga.create(data: CreateMangaRequest)

// Update manga
client.manga.update(id: string | number, data: UpdateMangaRequest)

// Delete manga
client.manga.delete(id: string | number)

// Refresh manga metadata
client.manga.refreshMetadata(id: string | number, data?: RefreshMetadataRequest)
```

### Library Operations

```typescript
// List all libraries
client.libraries.list()

// Get library by ID
client.libraries.get(id: string | number)

// Create new library
client.libraries.create({
  name: string,
  path: string,
  scanInterval?: number
})

// Update library
client.libraries.update(id: string | number, data: UpdateLibraryRequest)

// Delete library
client.libraries.delete(id: string | number)

// Trigger library scan
client.libraries.scan(id: string | number)
```

### Chapter Operations

```typescript
// List chapters
client.chapters.list({
  page?: number,
  limit?: number,
  mangaId?: string,
  status?: string
})

// Get chapter by ID
client.chapters.get(id: string | number)

// Download chapter
client.chapters.download(id: string | number)
```

### Download Management

```typescript
// List downloads
client.downloads.list({
  page?: number,
  limit?: number,
  status?: string,
  mangaId?: string
})

// Get download by ID
client.downloads.get(id: string)

// Update download (pause/resume/cancel, change priority)
client.downloads.update(id: string, {
  priority?: number,
  status?: 'pause' | 'resume' | 'cancel'
})

// Delete download
client.downloads.delete(id: string)

// Get download statistics
client.downloads.stats()
```

### Metadata Provider Operations

```typescript
// Search across metadata providers
client.metadata.search({
  query: string,
  providers?: string[],
  limit?: number
})

// List available providers
client.metadata.providers()
```

### Webhook Management

```typescript
// List webhooks
client.webhooks.list()

// Get webhook by ID
client.webhooks.get(id: string)

// Create webhook
client.webhooks.create({
  url: string,
  events: string[],
  secret?: string
})

// Update webhook
client.webhooks.update(id: string, {
  url?: string,
  events?: string[],
  enabled?: boolean
})

// Delete webhook
client.webhooks.delete(id: string)

// Test webhook
client.webhooks.test(id: string)
```

### System Operations

```typescript
// Health check
client.system.health()
```

## Error Handling

The SDK provides typed error handling:

```typescript
import { ApiError } from './kaizoku-api-sdk';

try {
  const manga = await client.manga.get(123);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.code}: ${error.message}`);
    console.error(`Status Code: ${error.statusCode}`);
    console.error(`Details:`, error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Cancelling Requests

Long-running requests like metadata searches can be cancelled:

```typescript
// Start a search
const searchPromise = client.metadata.search({
  query: 'One Piece',
  limit: 50
});

// Cancel the search
client.cancelRequest('metadata-search');

// The promise will reject with an AbortError
try {
  await searchPromise;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Search was cancelled');
  }
}
```

## Response Types

All API responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

// Paginated responses include metadata
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  links?: {
    self: string;
    next?: string;
    prev?: string;
  };
}
```

## Configuration Options

```typescript
interface KaizokuApiConfig {
  baseUrl: string;       // Base URL of the Kaizoku API
  apiKey: string;        // Your API key
  timeout?: number;      // Request timeout in milliseconds (default: 30000)
  retryAttempts?: number; // Number of retry attempts for failed requests (default: 3)
}
```

## Rate Limiting

The API includes rate limiting. Check response headers for rate limit information:

- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time when rate limit resets (Unix timestamp)

## Webhook Events

Available webhook events:

- `manga.created`
- `manga.updated`
- `manga.deleted`
- `chapter.created`
- `chapter.downloaded`
- `chapter.failed`
- `library.created`
- `library.scan.started`
- `library.scan.completed`
- `download.started`
- `download.completed`
- `download.failed`