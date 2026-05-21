# DEVELOPER_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DEVELOPER_GUIDE

---
# Kapowarr Developer Guide

This guide is for developers who want to extend or customize Kapowarr functionality.

## Architecture Overview

Kapowarr follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   UI Layer      │────▶│  tRPC Router     │────▶│ Service Layer  │
│  (React/Next)   │     │  (API Layer)     │     │ (KapowarrMgr)  │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                           │
                        ┌──────────────────────────────────┼──────────┐
                        │                                  │          │
                  ┌─────▼──────┐              ┌───────────▼──┐  ┌───▼────┐
                  │  Adapters   │              │ Web Scraper  │  │ Queue  │
                  │(Base/Custom)│              │  (Cheerio)   │  │ (PG)   │
                  └─────────────┘              └──────────────┘  └────────┘
```

## Core Components

### 1. KapowarrManager (Service Layer)

Central service managing all Kapowarr operations:

```typescript
// src/services/kapowarr/KapowarrManager.ts
class KapowarrManager {
  // Singleton instance
  static getInstance(): KapowarrManager
  
  // Source management
  async addSource(source: KapowarrSource): Promise<KapowarrSource>
  async updateSource(id: string, updates: Partial<KapowarrSource>): Promise<KapowarrSource>
  async removeSource(id: string): Promise<void>
  
  // Adapter management
  registerAdapter(adapter: BaseKapowarrAdapter): void
  getAdapter(sourceId: string): BaseKapowarrAdapter | undefined
  
  // Operations
  async search(query: string): Promise<MangaSearchResult[]>
  async queueChapterDownload(params: DownloadParams): Promise<string>
}
```

### 2. BaseKapowarrAdapter

Abstract base class for all Kapowarr adapters:

```typescript
// src/api/metadataProviders/adapters/baseKapowarrAdapter.ts
abstract class BaseKapowarrAdapter implements IntegrationAdapter {
  // Required implementations
  abstract search(query: string): Promise<MangaSearchResult[]>
  abstract getMangaById(id: string): Promise<IntegrationMangaData>
  abstract getMangaByTitle(title: string): Promise<IntegrationMangaData>
  
  // Protected methods for implementations
  protected async performSearch(query: string): Promise<AsyncResult<MangaSearchResult[], Error>>
  protected async performGetMangaById(id: string): Promise<AsyncResult<any, Error>>
  protected async performGetChapters(mangaId: string): Promise<AsyncResult<any[], Error>>
  protected async performGetChapterPages(chapterId: string): Promise<AsyncResult<string[], Error>>
}
```

### 3. WebScraper

Handles HTML parsing and data extraction:

```typescript
// src/api/metadataProviders/scrapers/WebScraper.ts
class WebScraper {
  constructor(config: KapowarrProviderConfig)
  
  // Core methods
  async search(query: string): Promise<SearchResult[]>
  async getMangaDetails(url: string): Promise<MangaDetails>
  async getChapterList(mangaUrl: string): Promise<ChapterInfo[]>
  async getDownloadLinks(chapterUrl: string): Promise<string[]>
  
  // Utility methods
  private extractFromElement($: CheerioAPI, element: any, selector: SelectorConfig): any
  private applyTransforms(value: any, transforms: Transform[]): any
}
```

## Creating a Custom Adapter

### Step 1: Extend BaseKapowarrAdapter

```typescript
import { BaseKapowarrAdapter } from '@/api/metadataProviders/adapters/baseKapowarrAdapter';
import { KapowarrProviderConfig } from '@/types/adapters/kapowarr';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

export class MyCustomAdapter extends BaseKapowarrAdapter {
  constructor(config: KapowarrProviderConfig) {
    super(config);
  }

  async search(query: string): Promise<MangaSearchResult[]> {
    const result = await this.performSearch(query);
    if (isSuccess(result)) return result.data;
    throw result.error;
  }

  protected async performSearch(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
    try {
      // Custom search logic
      const scraper = await this.getScraper();
      const results = await scraper.search(query);
      
      // Transform to standard format
      const transformed = results.map(r => ({
        id: r.id,
        title: r.title,
        coverUrl: r.coverUrl,
        source: this.config.sourceId,
        sourceId: r.id,
        url: r.url
      }));
      
      return createSuccessResult(transformed);
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Implement other required methods...
}
```

### Step 2: Register the Adapter

```typescript
// In your initialization code
const manager = KapowarrManager.getInstance();
const adapter = new MyCustomAdapter(config);
manager.registerAdapter(adapter);
```

### Step 3: Add to UI (Optional)

Create a specific UI component for your adapter:

```typescript
// src/components/settings/kapowarr/MyCustomSourceConfig.tsx
import React from 'react';
import { TextInput, Button } from '@mantine/core';

export function MyCustomSourceConfig({ source, onSave }) {
  // Custom configuration UI
  return (
    <div>
      <TextInput label="API Key" />
      <TextInput label="Custom Setting" />
      <Button onClick={onSave}>Save</Button>
    </div>
  );
}
```

## Adding New Transform Types

### Step 1: Define Transform Type

```typescript
// src/types/domain/kapowarr-types.ts
export interface Transform {
  type: 'regex' | 'replace' | 'trim' | 'prefix' | 'suffix' | 'split' | 'join' | 'custom';
  params: Record<string, string | number | boolean>;
}
```

### Step 2: Implement Transform Logic

```typescript
// src/api/metadataProviders/scrapers/WebScraper.ts
private applyTransforms(value: any, transforms: Transform[]): any {
  let result = value;
  
  for (const transform of transforms) {
    switch (transform.type) {
      case 'custom':
        result = this.applyCustomTransform(result, transform.params);
        break;
      // ... other cases
    }
  }
  
  return result;
}

private applyCustomTransform(value: string, params: any): string {
  // Your custom transform logic
  return value;
}
```

## Queue System Integration

### Understanding Task Types

Kapowarr uses three task types:

```typescript
enum TaskType {
  KAPOWARR_DOWNLOAD = 'KAPOWARR_DOWNLOAD',
  KAPOWARR_SOURCE_SYNC = 'KAPOWARR_SOURCE_SYNC',
  KAPOWARR_VALIDATE_SOURCE = 'KAPOWARR_VALIDATE_SOURCE'
}
```

### Creating Task Handlers

```typescript
// src/server/queue/kapowarrHandlers.ts
export const handleKapowarrDownload: TaskHandler<KapowarrDownloadPayload> = async (payload) => {
  const { sourceId, mangaId, chapterId, destinationPath } = payload;
  
  // Get adapter
  const manager = KapowarrManager.getInstance();
  const adapter = manager.getAdapter(sourceId);
  
  if (!adapter) {
    throw new Error(`Adapter not found for source: ${sourceId}`);
  }
  
  // Download chapter
  const pages = await adapter.getChapterPages(chapterId);
  await downloadPages(pages, destinationPath);
};
```

## API Extension

### Adding New tRPC Procedures

```typescript
// src/server/trpc/routers/kapowarr.ts
export const kapowarrRouter = router({
  // New procedure
  testSelector: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      selector: selectorConfigSchema,
    }))
    .mutation(async ({ input }) => {
      const scraper = new WebScraper({
        baseUrl: new URL(input.url).origin,
        selectors: {} // Minimal config
      });
      
      const result = await scraper.testSelector(input.url, input.selector);
      return result;
    }),
});
```

## Database Schema Extension

### Adding New Fields

```prisma
// prisma/schema.prisma
model Task {
  // Existing fields...
  
  // Kapowarr-specific fields
  kapowarrDownloadPayload    Json?
  kapowarrSourceSyncPayload  Json?
  kapowarrValidateSourcePayload Json?
  
  // New field
  kapowarrMetadata           Json?
}
```

## Testing

### Unit Testing Adapters

```typescript
// src/api/metadataProviders/adapters/__tests__/myCustomAdapter.test.ts
describe('MyCustomAdapter', () => {
  let adapter: MyCustomAdapter;
  
  beforeEach(() => {
    adapter = new MyCustomAdapter({
      sourceId: 'test',
      name: 'Test',
      baseUrl: 'http://test.com',
      // ... config
    });
  });
  
  it('should search for manga', async () => {
    const results = await adapter.search('One Piece');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('One Piece');
  });
});
```

### Integration Testing

```typescript
// src/tests/kapowarr/myCustomAdapter.integration.test.ts
describe('MyCustomAdapter Integration', () => {
  it('should download chapter', async () => {
    const manager = KapowarrManager.getInstance();
    const downloadId = await manager.queueChapterDownload({
      sourceId: 'my-custom',
      mangaId: '123',
      chapterId: 'ch1',
      chapterNumber: 1,
      destinationPath: '/tmp/test'
    });
    
    // Wait for download
    await waitForDownloadComplete(downloadId);
    
    // Verify files exist
    expect(fs.existsSync('/tmp/test/ch1')).toBe(true);
  });
});
```

## Performance Optimization

### 1. Connection Pooling

```typescript
class WebScraper {
  private httpClient: AxiosInstance;
  
  constructor(config: KapowarrProviderConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      httpAgent: new http.Agent({ 
        keepAlive: true,
        maxSockets: 10
      })
    });
  }
}
```

### 2. Request Caching

```typescript
class CachedScraper extends WebScraper {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 3600000; // 1 hour
  
  async getMangaDetails(url: string): Promise<MangaDetails> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    
    const data = await super.getMangaDetails(url);
    this.cache.set(url, { data, timestamp: Date.now() });
    return data;
  }
}
```

### 3. Batch Processing

```typescript
async function batchDownload(chapters: ChapterInfo[], batchSize = 5) {
  const batches = chunk(chapters, batchSize);
  
  for (const batch of batches) {
    await Promise.all(
      batch.map(chapter => downloadChapter(chapter))
    );
  }
}
```

## Security Considerations

### 1. Input Validation

```typescript
const sourceSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  config: z.object({
    searchUrl: z.string().url(),
    selectors: selectorsSchema
  })
});

// Validate before processing
const validated = sourceSchema.parse(input);
```

### 2. Sanitize User Input

```typescript
function sanitizeSelector(selector: string): string {
  // Remove potential XSS vectors
  return selector
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}
```

### 3. Rate Limiting

```typescript
class RateLimiter {
  private requests: number[] = [];
  
  async checkLimit(rps: number): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 1000);
    
    if (this.requests.length >= rps) {
      const waitTime = 1000 - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}
```

## Debugging

### Enable Debug Logging

```typescript
// Set environment variable
process.env.KAPOWARR_DEBUG = 'true';

// In your code
if (process.env.KAPOWARR_DEBUG === 'true') {
  console.log('[Kapowarr Debug]', data);
}
```

### Request Inspection

```typescript
// Add request interceptor
httpClient.interceptors.request.use(request => {
  console.log('Starting Request:', request);
  return request;
});

httpClient.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.log('Error:', error);
    return Promise.reject(error);
  }
);
```

## Contributing

### Code Style

- Follow TypeScript best practices
- Use async/await instead of promises
- Handle all error cases
- Add comprehensive tests
- Document public APIs

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Update documentation
6. Submit PR with description

### Adding Documentation

- User-facing features: Update USER_GUIDE.md
- Configuration changes: Update CONFIGURATION_GUIDE.md
- API changes: Update this developer guide
- New features: Add examples

---

For questions or support, join the development Discord channel.

Last Updated: January 2025
