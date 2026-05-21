# BaseKapowarrAdapter Interface Conflict Resolution

## Problem Analysis

The `BaseKapowarrAdapter` class is trying to implement both:
1. **IntegrationAdapter** - expects `getChapters(mangaId: string | number): Promise<ChapterEntity[]>`
2. **KapowarrAdapter** - expects `getChapters(mangaId: string): Promise<KapowarrChapter[]>`

These have conflicting:
- Parameter types: `string | number` vs `string`
- Return types: `ChapterEntity[]` vs `KapowarrChapter[]`

Similarly for `searchManga`:
1. **IntegrationAdapter** - expects `searchManga(query: string, options?: SearchOptions): Promise<MangaMetadata[]>`
2. **KapowarrAdapter** - expects `searchManga(query: string): Promise<KapowarrSearchResult[]>`

## Solution: Adapter Pattern with Delegation

Instead of trying to implement both interfaces directly, we'll use composition and delegation to satisfy both contracts.

## Implementation Plan

### Option 1: Remove Direct KapowarrAdapter Implementation (Recommended)

Since `BaseKapowarrAdapter` is primarily an `IntegrationAdapter`, we should focus on that interface and provide helper methods for Kapowarr-specific needs.

```typescript
export abstract class BaseKapowarrAdapter<TConfig extends KapowarrConfig> 
  extends BaseIntegrationAdapter<TConfig> 
  implements IntegrationAdapter<TConfig> {
  // Remove KapowarrAdapter from implements clause
  
  // Keep IntegrationAdapter method
  async getChapters(mangaId: string | number, options?: { limit?: number; offset?: number; translatedLanguage?: string[] }): Promise<ChapterEntity[]> {
    const result = await this.getChaptersAsync(mangaId, options);
    if (isSuccess(result)) return result.data;
    if (isError(result)) throw result.error;
    throw new Error('Unknown state in getChapters');
  }
  
  // Add Kapowarr-specific helper that doesn't conflict
  async getKapowarrChapters(mangaId: string): Promise<KapowarrChapter[]> {
    const chapters = await this.getChapters(mangaId);
    return chapters.map(ch => this.toKapowarrChapter(ch));
  }
  
  // Similar for searchManga
  async searchManga(query: string, options?: SearchOptions): Promise<MangaMetadata[]> {
    const result = await this.searchAsync(query, options);
    if (isSuccess(result)) {
      return result.data.map(r => this.toMangaMetadata(r));
    }
    if (isError(result)) throw result.error;
    throw new Error('Unknown state in searchManga');
  }
  
  // Kapowarr-specific helper
  async searchKapowarr(query: string): Promise<KapowarrSearchResult[]> {
    const results = await this.search(query);
    return results.map(r => this.toKapowarrSearchResult(r));
  }
  
  // Conversion methods
  protected abstract toKapowarrChapter(chapter: ChapterEntity): KapowarrChapter;
  protected abstract toKapowarrSearchResult(result: MangaSearchResult): KapowarrSearchResult;
  protected abstract toMangaMetadata(result: MangaSearchResult): MangaMetadata;
}
```

### Option 2: Create a Separate Kapowarr Adapter Wrapper

If you need a class that strictly implements KapowarrAdapter, create a wrapper:

```typescript
// Keep BaseKapowarrAdapter as IntegrationAdapter only
export abstract class BaseKapowarrAdapter<TConfig extends KapowarrConfig> 
  extends BaseIntegrationAdapter<TConfig> 
  implements IntegrationAdapter<TConfig> {
  // Implementation focused on IntegrationAdapter
}

// Create a separate wrapper for KapowarrAdapter compliance
export class KapowarrAdapterWrapper implements KapowarrAdapter {
  constructor(private baseAdapter: BaseKapowarrAdapter<any>) {}
  
  async searchManga(query: string): Promise<KapowarrSearchResult[]> {
    const results = await this.baseAdapter.search(query);
    return results.map(r => this.toKapowarrSearchResult(r));
  }
  
  async getMangaDetails(id: string): Promise<KapowarrManga> {
    const manga = await this.baseAdapter.getMangaById(id);
    return this.toKapowarrManga(manga);
  }
  
  async getChapters(mangaId: string): Promise<KapowarrChapter[]> {
    const chapters = await this.baseAdapter.getChapters(mangaId);
    return chapters.map(ch => this.toKapowarrChapter(ch));
  }
  
  async validateWebsite(url: string): Promise<WebsiteValidationResult> {
    return this.baseAdapter.validateWebsite(url);
  }
  
  // Conversion methods
  private toKapowarrSearchResult(result: MangaSearchResult): KapowarrSearchResult {
    // conversion logic
  }
  
  private toKapowarrManga(manga: IntegrationMangaData): KapowarrManga {
    // conversion logic
  }
  
  private toKapowarrChapter(chapter: ChapterEntity): KapowarrChapter {
    // conversion logic
  }
}
```

### Option 3: Use Method Overloading (TypeScript Limitation)

TypeScript doesn't support true method overloading for implementations, but we can use union types:

```typescript
export abstract class BaseKapowarrAdapter<TConfig extends KapowarrConfig> 
  extends BaseIntegrationAdapter<TConfig> {
  
  // Single method that satisfies both interfaces
  async getChapters(
    mangaId: string | number, 
    options?: { limit?: number; offset?: number; translatedLanguage?: string[] }
  ): Promise<ChapterEntity[] | KapowarrChapter[]> {
    // Detect which interface is being used
    if (typeof mangaId === 'number' || options !== undefined) {
      // IntegrationAdapter call
      return this.getChaptersAsEntities(mangaId, options);
    } else {
      // KapowarrAdapter call
      return this.getChaptersAsKapowarr(mangaId as string);
    }
  }
  
  private async getChaptersAsEntities(
    mangaId: string | number,
    options?: { limit?: number; offset?: number; translatedLanguage?: string[] }
  ): Promise<ChapterEntity[]> {
    // Implementation for IntegrationAdapter
  }
  
  private async getChaptersAsKapowarr(mangaId: string): Promise<KapowarrChapter[]> {
    // Implementation for KapowarrAdapter
  }
}
```

## Recommended Solution

**Option 1** is the cleanest approach:
1. Remove `KapowarrAdapter` from the implements clause
2. Focus on `IntegrationAdapter` as the primary interface
3. Add helper methods with non-conflicting names for Kapowarr-specific functionality
4. This maintains type safety and avoids architectural complexity

## Implementation Steps

1. Remove `KapowarrAdapter` from the implements clause in `baseKapowarrAdapter.ts`
2. Keep the existing `getChapters` method that satisfies `IntegrationAdapter`
3. Rename the Kapowarr-specific method to `getKapowarrChapters`
4. Update any code that expects `KapowarrAdapter` interface to use the helper methods
5. Add proper type conversion methods as protected abstract methods

This approach:
- Maintains backward compatibility
- Provides clear separation of concerns
- Avoids complex type gymnastics
- Makes the code more maintainable