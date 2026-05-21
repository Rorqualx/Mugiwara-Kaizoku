# Fandom 5 Step Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom 5 Step Implementation

---
# Fandom 5-Step Crawler Implementation

## Summary of Changes Made

### 1. Fixed Metadata Storage
- Updated `addMangaSchema` to include `volumes`, `chapters`, `urls`, `sourceId`, `alternativeTitles`, and `authors`
- Modified manga.add procedure to save all parsed metadata to the database
- Enhanced confirmation screen to pass authors from Fandom metadata

### 2. Current Implementation Status

#### ✅ Completed Features:
1. **Volume/Chapter Parsing** - Enhanced parser handles Fire Force and other formats
2. **Metadata Extraction** - New endpoint extracts cover, description, authors, genres
3. **URL-based Enhancement** - Confirmation screen can fetch metadata from Fandom URLs
4. **Data Storage** - All parsed data is now properly saved to database
5. **Cross-Wiki Search** (Step 1) - `FandomSearchService` searches across multiple wikis
6. **Manga Page Discovery** (Step 2) - Service identifies manga-specific pages
7. **Enhanced Gallery Extraction** (Step 3) - `getEnhancedMangaMetadata` extracts all images
8. **Individual Chapter URLs** (Step 4) - Enhanced volume parser extracts chapter URLs
9. **Chapter Detail Service** (Step 5) - `ChapterDetailService` fetches individual chapter data

### 3. New Implementation (July 2025)

#### ✅ Services Created:
- `/src/server/services/fandom/fandomSearchService.ts` - Cross-wiki search functionality
- `/src/server/services/fandom/chapterDetailService.ts` - Chapter detail extraction
- Enhanced `/src/api/metadataProviders/fandomClient.ts` with `getEnhancedMangaMetadata`

#### ✅ tRPC Endpoints Added:
- `searchFandomWikis` - Search across multiple Fandom wikis
- `fetchEnhancedMangaMetadata` - Get comprehensive manga metadata with galleries
- `parseEnhancedVolumes` - Parse volumes with chapter URL extraction
- `fetchChapterDetails` - Batch fetch individual chapter details

#### ✅ UI Component:
- `/src/components/fandom/FandomImportWizard.tsx` - 5-step import wizard UI

#### 🚧 Still Needs:
1. **Integration with Add Manga Flow** - Connect wizard to existing manga addition process
2. **Chapter Details Storage** - Database schema for storing chapter-specific metadata
3. **Progress Tracking** - Real-time updates during chapter detail fetching
4. **Error Recovery** - Handle partial failures in batch operations

## Detailed Implementation Plan

### Step 1: Enhanced Cross-Wiki Search

Create a new service: `/src/server/services/fandom/fandomSearchService.ts`

```typescript
interface FandomSearchService {
  // Search across multiple Fandom wikis
  async searchAllWikis(query: string): Promise<WikiSearchResult[]> {
    const wikis = [
      'onepiece', 'myheroacademia', 'fire-force', 'hunterxhunter',
      'naruto', 'bleach', 'demonslayer', 'jujutsukaisen', 'blackclover'
    ];
    
    // Parallel search with rate limiting
    const results = await this.batchSearch(wikis, query);
    return this.rankResults(results);
  }
  
  // Find manga-specific page from results
  async findMangaPage(searchResults: WikiSearchResult[]): Promise<string | null> {
    // Prioritize pages with "(manga)" suffix
    const mangaPage = searchResults.find(r => 
      r.title.includes('(manga)') || r.url.includes('_(manga)')
    );
    
    return mangaPage?.url || searchResults[0]?.url;
  }
}
```

### Step 2: Manga Page Discovery

Enhance the existing Fandom client with manga page detection:

```typescript
// Add to fandomClient.ts
async findMangaMainPage(wikiDomain: string, mangaTitle: string): Promise<MangaPageInfo> {
  // Search for manga-specific page
  const searchResults = await this.search(mangaTitle);
  
  // Check for standard patterns
  const patterns = [
    `${mangaTitle}_(manga)`,
    `${mangaTitle}_(Manga)`,
    mangaTitle
  ];
  
  for (const pattern of patterns) {
    const page = await this.checkPageExists(wikiDomain, pattern);
    if (page) return page;
  }
  
  throw new Error('Manga page not found');
}
```

### Step 3: Enhanced Gallery and Metadata Extraction

```typescript
interface EnhancedMangaMetadata {
  // Basic info
  title: string;
  alternativeTitles: string[];
  
  // Images
  coverArt: {
    primary: string;
    gallery: string[];
    volumeCovers: string[];
    characterArt: string[];
  };
  
  // Descriptions
  descriptions: {
    synopsis?: string;
    plot?: string;
    background?: string;
    history?: string;
  };
  
  // Navigation
  links: {
    volumesPage?: string;
    chaptersPage?: string;
    charactersPage?: string;
    arcsPage?: string;
  };
  
  // Publication
  publication: {
    author?: string;
    illustrator?: string;
    publisher?: { japan?: string; english?: string };
    demographic?: string;
    genres: string[];
    themes: string[];
  };
}

// Extract all gallery images
async extractGalleryImages($: CheerioAPI): Promise<string[]> {
  const images: string[] = [];
  
  // Gallery sections
  $('.wikia-gallery-item img, .gallery img').each((_, img) => {
    const src = $(img).attr('data-src') || $(img).attr('src');
    if (src && !src.includes('data:')) {
      images.push(this.cleanImageUrl(src));
    }
  });
  
  return images;
}
```

### Step 4: Extract Individual Chapter URLs

Enhance the volume parser to collect chapter URLs:

```typescript
interface ChapterWithUrl extends ChapterInfo {
  url: string;
  releaseDate?: {
    japan?: string;
    english?: string;
  };
}

// Update parseVolumeTables to extract URLs
function parseEnhancedVolumeTables(html: string): EnhancedVolumeInfo[] {
  const $ = cheerio.load(html);
  const volumes: EnhancedVolumeInfo[] = [];
  
  $('table').each((_, table) => {
    // ... existing parsing logic ...
    
    // Extract chapter links
    $(table).find('a').each((_, link) => {
      const href = $(link).attr('href');
      const text = $(link).text();
      
      if (href && text.match(/chapter\s+\d+/i)) {
        const chapterNum = text.match(/\d+/)?.[0];
        if (chapterNum) {
          chapter.url = this.resolveUrl(href);
        }
      }
    });
  });
  
  return volumes;
}
```

### Step 5: Chapter Detail Extraction

Create a new service for chapter details:

```typescript
interface ChapterDetailService {
  async fetchChapterDetails(chapterUrl: string): Promise<ChapterDetails> {
    const html = await this.fetchPage(chapterUrl);
    const $ = cheerio.load(html);
    
    return {
      number: this.extractChapterNumber($),
      title: this.extractChapterTitle($),
      summary: this.extractSummary($),
      pageCount: this.extractPageCount($),
      coverArt: this.extractChapterCover($),
      characters: this.extractCharacters($),
      trivia: this.extractTrivia($),
      navigation: {
        previous: $('a:contains("Previous")').attr('href'),
        next: $('a:contains("Next")').attr('href')
      }
    };
  }
  
  // Batch processing with rate limiting
  async batchFetchChapterDetails(
    urls: string[], 
    options: { batchSize: number; delay: number }
  ): Promise<ChapterDetails[]> {
    const results: ChapterDetails[] = [];
    
    for (let i = 0; i < urls.length; i += options.batchSize) {
      const batch = urls.slice(i, i + options.batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.fetchChapterDetails(url))
      );
      results.push(...batchResults);
      
      // Rate limiting
      if (i + options.batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }
    
    return results;
  }
}
```

## Database Schema Updates

### 1. Enhanced Metadata Table
Already includes `volumes`, `chapters`, `urls`, `authors`, `synonyms`

### 2. New Chapter Details Table
```sql
CREATE TABLE chapter_metadata (
  id SERIAL PRIMARY KEY,
  manga_id INTEGER REFERENCES manga(id),
  chapter_id INTEGER REFERENCES chapters(id),
  
  -- Fandom-specific data
  fandom_url TEXT,
  summary TEXT,
  page_count INTEGER,
  cover_art TEXT,
  character_appearances TEXT[], -- Array of character names
  trivia TEXT[],
  
  -- Release dates
  release_date_japan DATE,
  release_date_english DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## UI Components

### 1. Enhanced Search Component
- Add "Search Fandom" toggle
- Show wiki source badges
- Allow wiki selection dropdown

### 2. Manga Import Wizard
- Step 1: Search across wikis
- Step 2: Select manga page
- Step 3: Preview metadata and galleries
- Step 4: Select cover art from options
- Step 5: Review volume/chapter structure
- Step 6: Queue chapter detail fetching

### 3. Chapter Details Display
- Expandable chapter cards with:
  - Cover art thumbnail
  - Summary preview
  - Page count
  - Character appearances
  - Release dates
  - Link to Fandom page

## API Endpoints

### New tRPC Procedures

```typescript
// metadata.ts router additions
export const metadataRouter = router({
  // ... existing procedures ...
  
  // Step 1: Search across Fandom wikis
  searchFandomWikis: procedure
    .input(z.object({ 
      title: z.string(),
      wikis: z.array(z.string()).optional()
    }))
    .query(async ({ input }) => {
      const searchService = new FandomSearchService();
      return searchService.searchAllWikis(input.title);
    }),
  
  // Step 2-3: Get enhanced manga metadata
  fetchEnhancedMangaMetadata: procedure
    .input(z.object({ 
      mangaPageUrl: z.string(),
      includeGallery: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      const client = new FandomClient();
      return client.getEnhancedMangaMetadata(input.mangaPageUrl);
    }),
  
  // Step 4: Parse volumes with chapter URLs
  parseEnhancedVolumes: procedure
    .input(z.object({ 
      volumesPageUrl: z.string(),
      extractChapterUrls: z.boolean().default(true)
    }))
    .mutation(async ({ input }) => {
      return parseEnhancedVolumeTables(input.volumesPageUrl);
    }),
  
  // Step 5: Fetch chapter details
  fetchChapterDetails: procedure
    .input(z.object({ 
      chapterUrls: z.array(z.string()),
      mangaId: z.number()
    }))
    .mutation(async ({ input }) => {
      const service = new ChapterDetailService();
      const details = await service.batchFetchChapterDetails(
        input.chapterUrls,
        { batchSize: 10, delay: 1000 }
      );
      
      // Save to database
      await saveChapterDetails(input.mangaId, details);
      
      return { success: true, count: details.length };
    })
});
```

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create FandomSearchService
- [ ] Implement cross-wiki search
- [ ] Add manga page discovery logic

### Phase 2: Enhanced Extraction (Week 2)
- [ ] Enhance metadata extraction with galleries
- [ ] Implement chapter URL collection
- [ ] Create ChapterDetailService

### Phase 3: UI Integration (Week 3)
- [ ] Build import wizard component
- [ ] Add chapter details display
- [ ] Integrate with existing manga page

### Phase 4: Testing & Optimization (Week 4)
- [ ] Test with various manga wikis
- [ ] Optimize rate limiting
- [ ] Add progress tracking
- [ ] Implement caching strategy

## Benefits

1. **Complete Metadata**: All available information from Fandom
2. **User Choice**: Multiple cover art options
3. **Chapter Details**: Rich information for each chapter
4. **Flexible Import**: Choose what data to import
5. **Background Processing**: Chapter details fetched asynchronously
6. **Cross-Wiki Support**: Find manga across all Fandom wikis