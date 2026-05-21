# Kapowarr Development Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr Development Guide

---
# Kapowarr Development Guide

## Overview

This guide provides technical details for developers working with the Kapowarr native downloader integration in Mugiwara-Kaizoku. The implementation follows the project's established architectural patterns.

## Architecture

### Design Principles

1. **Adapter Pattern**: All website integrations extend `BaseKapowarrAdapter`
2. **AsyncResult Pattern**: All async operations return `AsyncResult<T, Error>`
3. **Type Safety**: Zero `any` types, comprehensive type guards
4. **Domain-Driven Design**: Clear separation between domain and infrastructure
5. **UPPERCASE Enums**: All enum values use UPPERCASE strings

### Component Overview

```
kapowarr/
├── types/
│   ├── domain/kapowarr-types.ts      # Domain models
│   └── adapters/kapowarr.ts          # Adapter interfaces
├── api/
│   ├── adapters/
│   │   ├── baseKapowarrAdapter.ts    # Base adapter class
│   │   └── websiteProviderAdapter.ts  # Generic website adapter
│   └── scrapers/
│       └── WebScraper.ts              # Cheerio-based scraper
├── server/
│   └── routers/kapowarr.ts           # tRPC endpoints
├── services/
│   └── kapowarr/
│       └── KapowarrManager.ts         # Service orchestration
├── utils/
│   └── converters/
│       └── kapowarr-converters.ts    # Prisma converters
└── components/
    └── settings/
        └── KapowarrSettings.tsx       # UI components
```

## Implementation Details

### Creating a Custom Website Adapter

```typescript
// src/api/metadataProviders/adapters/mangaKakalotAdapter.ts
import { BaseKapowarrAdapter } from './baseKapowarrAdapter';
import { KapowarrProviderConfig, KapowarrSearchOptions } from '../../../types/adapters/kapowarr';

export interface MangaKakalotConfig extends KapowarrProviderConfig {
  // Add any site-specific config
}

export class MangaKakalotAdapter extends BaseKapowarrAdapter<MangaKakalotConfig> {
  constructor(config: MangaKakalotConfig) {
    super({
      ...config,
      id: 'mangakakalot',
      name: 'MangaKakalot',
      baseUrl: 'https://mangakakalot.com',
      searchUrl: 'https://mangakakalot.com/search/story/{query}',
      selectors: {
        searchResults: {
          container: '.panel_story_list .story_item',
          id: {
            css: 'a',
            extract: 'attribute',
            attribute: 'href',
            transform: [{
              type: 'regex',
              params: { pattern: '/manga/(.+)$', flags: '' }
            }]
          },
          title: {
            css: 'h3 a',
            extract: 'text'
          },
          coverUrl: {
            css: 'img',
            extract: 'attribute',
            attribute: 'src'
          },
          url: {
            css: 'a',
            extract: 'attribute',
            attribute: 'href'
          }
        },
        // ... other selectors
      }
    });
  }
  
  buildSearchUrl(query: string, options?: KapowarrSearchOptions): string {
    const encodedQuery = encodeURIComponent(query);
    return this.config.searchUrl.replace('{query}', encodedQuery);
  }
  
  buildMangaUrl(mangaId: string): string {
    return `${this.config.baseUrl}/manga/${mangaId}`;
  }
  
  buildChapterUrl(mangaId: string, chapterId: string): string {
    return `${this.config.baseUrl}/chapter/${mangaId}/${chapterId}`;
  }
}

// Factory function
export function createMangaKakalotAdapter(config: Partial<MangaKakalotConfig> = {}): MangaKakalotAdapter {
  return new MangaKakalotAdapter({
    enabled: true,
    ...config
  } as MangaKakalotConfig);
}
```

### Adding tRPC Endpoints

```typescript
// Add to src/server/routers/kapowarr.ts
export const kapowarrRouter = router({
  // Source management
  getSources: publicProcedure
    .query(async ({ ctx }) => {
      const sources = await ctx.prisma.kapowarrSource.findMany({
        orderBy: { name: 'asc' }
      });
      return kapowarrSourceConverter.convertMany(sources);
    }),
  
  addSource: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      baseUrl: z.string().url(),
      config: z.any() // Validated separately
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate config structure
      if (!isKapowarrProviderConfig(input.config)) {
        throw new Error('Invalid source configuration');
      }
      
      const source = await ctx.prisma.kapowarrSource.create({
        data: {
          name: input.name,
          baseUrl: input.baseUrl,
          config: input.config,
          status: 'ACTIVE'
        }
      });
      
      return kapowarrSourceConverter.convert(source);
    }),
  
  // Download management
  downloadChapter: publicProcedure
    .input(z.object({
      sourceId: z.string(),
      mangaId: z.union([z.string(), z.number()]),
      chapterId: z.string(),
      options: z.object({
        quality: z.enum(['low', 'medium', 'high']).optional(),
        format: z.enum(['cbz', 'pdf', 'images']).optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const numericMangaId = toNumberId(input.mangaId);
      
      // Create download record
      const download = await ctx.prisma.kapowarrDownload.create({
        data: {
          sourceId: input.sourceId,
          mangaId: numericMangaId,
          chapterId: input.chapterId,
          chapterNumber: 0, // Will be updated by worker
          status: 'QUEUED'
        }
      });
      
      // Queue download job
      await kapowarrQueue.add('download-chapter', {
        downloadId: download.id,
        sourceId: input.sourceId,
        mangaId: numericMangaId.toString(),
        chapterId: input.chapterId,
        options: input.options
      });
      
      return kapowarrDownloadConverter.convert(download);
    })
});
```

### WebScraper Engine Details

The WebScraper uses Cheerio for HTML parsing:

```typescript
// Key methods in WebScraper

// Extract values using CSS selectors
private extractValue($: CheerioAPI, context: Element, selector: SelectorConfig): string {
  let element = selector.css ? $(context).find(selector.css) : $(selector.css);
  
  let value = '';
  switch (selector.extract) {
    case 'text':
      value = element.text().trim();
      break;
    case 'attribute':
      value = element.attr(selector.attribute ?? '') ?? '';
      break;
    case 'html':
      value = element.html() ?? '';
      break;
  }
  
  // Apply transformations
  if (selector.transform) {
    value = this.applyTransformations(value, selector.transform);
  }
  
  return value;
}

// Apply transformations to extracted values
private applyTransformations(value: string, transforms: Transform[]): string {
  let result = value;
  
  for (const transform of transforms) {
    switch (transform.type) {
      case 'regex':
        const match = result.match(new RegExp(transform.params.pattern, transform.params.flags));
        result = match ? (match[1] || match[0]) : '';
        break;
      case 'replace':
        result = result.replace(
          new RegExp(transform.params.search, transform.params.flags || 'g'),
          transform.params.replace
        );
        break;
      // ... other transformations
    }
  }
  
  return result;
}
```

### Service Layer

The KapowarrManager orchestrates operations:

```typescript
export class KapowarrManager {
  private adapters: Map<string, BaseKapowarrAdapter> = new Map();
  
  async initialize(): Promise<void> {
    const sources = await this.prisma.kapowarrSource.findMany({
      where: { enabled: true }
    });
    
    for (const source of sources) {
      const config = typeof source.config === 'string' 
        ? JSON.parse(source.config) 
        : source.config;
      
      const adapter = new WebsiteProviderAdapter(config);
      this.adapters.set(source.id, adapter);
    }
  }
  
  async searchManga(params: {
    query: string;
    sourceIds?: string[];
  }): Promise<MangaSearchResult[]> {
    const sources = params.sourceIds 
      ? params.sourceIds.map(id => this.adapters.get(id)).filter(Boolean)
      : Array.from(this.adapters.values());
    
    const results = await Promise.allSettled(
      sources.map(adapter => adapter!.search(params.query))
    );
    
    return results
      .filter((r): r is PromiseFulfilledResult<MangaSearchResult[]> => 
        r.status === 'fulfilled'
      )
      .flatMap(r => r.value);
  }
}
```

### Background Jobs

Download processing uses BullMQ:

```typescript
// src/workers/kapowarrDownloadWorker.ts
export const kapowarrDownloadWorker = new Worker(
  'kapowarr-downloads',
  async (job: Job<DownloadJobData>) => {
    const { downloadId, sourceId, mangaId, chapterId } = job.data;
    
    // Update status
    await updateDownloadStatus(downloadId, 'DOWNLOADING');
    
    try {
      // Get adapter
      const adapter = await getAdapter(sourceId);
      
      // Get download links
      const links = await adapter.getDownloadLinks(mangaId, chapterId);
      
      // Download images
      for (let i = 0; i < links.length; i++) {
        await downloadImage(links[i]);
        
        // Update progress
        const progress = Math.round(((i + 1) / links.length) * 100);
        await updateDownloadProgress(downloadId, progress);
      }
      
      // Create CBZ/PDF if requested
      await createArchive(downloadId, job.data.options?.format);
      
      // Mark complete
      await updateDownloadStatus(downloadId, 'COMPLETED');
    } catch (error) {
      await updateDownloadStatus(downloadId, 'FAILED', error.message);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.KAPOWARR_CONCURRENT_DOWNLOADS ?? '3')
  }
);
```

## UI Components

### Selector Builder

The visual selector builder helps users create selectors:

```typescript
export function SelectorBuilder({ 
  baseUrl, 
  onSelectorsChange 
}: SelectorBuilderProps) {
  const [previewUrl, setPreviewUrl] = useState(baseUrl);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  
  const handleElementClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const element = event.target as HTMLElement;
    const selector = generateSelector(element);
    
    // Add to current selectors
    onSelectorsChange({
      ...selectors,
      [currentField]: {
        css: selector,
        extract: 'text'
      }
    });
  };
  
  return (
    <div className="selector-builder">
      <iframe 
        src={`/api/proxy?url=${encodeURIComponent(previewUrl)}`}
        onLoad={attachClickHandlers}
      />
      <div className="selector-controls">
        {/* Selector configuration UI */}
      </div>
    </div>
  );
}
```

## Testing

### Unit Tests

```typescript
// src/api/metadataProviders/adapters/__tests__/baseKapowarrAdapter.test.ts
describe('BaseKapowarrAdapter', () => {
  let adapter: TestKapowarrAdapter;
  
  beforeEach(() => {
    adapter = new TestKapowarrAdapter(mockConfig);
  });
  
  describe('search', () => {
    it('should return search results', async () => {
      mockScraper.extractSearchResults.mockResolvedValue(mockResults);
      
      const results = await adapter.search('naruto');
      
      expect(results).toHaveLength(mockResults.length);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        source: mockConfig.name
      });
    });
    
    it('should handle search errors', async () => {
      mockScraper.fetchPage.mockRejectedValue(new Error('Network error'));
      
      await expect(adapter.search('test')).rejects.toThrow('Network error');
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/__tests__/kapowarr.integration.test.ts
describe('kapowarr router integration', () => {
  it('should add and search sources', async () => {
    // Add source
    const source = await caller.kapowarr.addSource({
      name: 'Test Source',
      baseUrl: 'https://test.com',
      config: validConfig
    });
    
    expect(source.status).toBe('ACTIVE');
    
    // Search using source
    const results = await caller.kapowarr.searchManga({
      query: 'test',
      sourceIds: [source.id]
    });
    
    expect(Array.isArray(results)).toBe(true);
  });
});
```

## Performance Considerations

1. **Rate Limiting**: Implement per-source rate limiting
2. **Caching**: Cache search results and manga details
3. **Connection Pooling**: Reuse HTTP connections
4. **Image Optimization**: Compress images during download
5. **Parallel Processing**: Process multiple chapters concurrently

## Security Considerations

1. **Input Validation**: Validate all user inputs, especially selectors
2. **Sandbox Scrapers**: Run scrapers in isolated environments
3. **Content Security**: Sanitize scraped HTML content
4. **Rate Limiting**: Implement global and per-IP rate limits
5. **Authentication**: Secure credential storage for authenticated sources

## Extending Kapowarr

### Adding New Transform Types

```typescript
// In WebScraper.ts
case 'customTransform':
  result = customTransformFunction(result, transform.params);
  break;
```

### Custom Download Services

```typescript
export interface CustomDownloadService {
  canHandle(url: string): boolean;
  download(url: string, options: DownloadOptions): Promise<Buffer>;
}

// Register service
downloadServiceRegistry.register('myservice', new MyDownloadService());
```

### WebSocket Updates

```typescript
// Send real-time updates
io.to(`download:${downloadId}`).emit('progress', {
  downloadId,
  progress,
  status
});
```

## Migration from Existing Sources

To migrate existing metadata providers to Kapowarr:

1. Create adapter configuration
2. Map existing selectors
3. Test with sample content
4. Migrate user preferences
5. Run parallel for transition period

## Troubleshooting

### Common Issues

1. **Selectors not working**: Check if website structure changed
2. **Rate limiting**: Reduce request frequency
3. **Memory leaks**: Ensure adapters are disposed properly
4. **Queue backup**: Increase worker concurrency

### Debug Mode

Enable debug logging:

```typescript
// Set in environment
KAPOWARR_DEBUG=true

// In code
if (process.env.KAPOWARR_DEBUG) {
  console.log('[Kapowarr]', message, data);
}
```

## Future Enhancements

1. **Machine Learning**: Auto-generate selectors using ML
2. **Distributed Scraping**: Scale across multiple nodes
3. **Plugin System**: Allow community adapters
4. **Visual Regression**: Detect website changes automatically
5. **Smart Retry**: Intelligent retry strategies

## Contributing

When contributing to Kapowarr:

1. Follow existing patterns (Adapter, AsyncResult)
2. Add comprehensive tests
3. Document new features
4. Update TypeScript types
5. Consider backward compatibility

## Resources

- [Cheerio Documentation](https://cheerio.js.org/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [CSS Selectors Reference](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
- [XPath Reference](https://developer.mozilla.org/en-US/docs/Web/XPath)
