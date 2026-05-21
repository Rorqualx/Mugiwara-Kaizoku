# Fandom Enhanced Crawler Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Enhanced Crawler Plan

---
# Enhanced Fandom Crawler Implementation Plan

## Overview
This document outlines the implementation of a comprehensive 5-step Fandom crawler that extracts complete manga metadata, including chapter-level details.

## Step 1: Search for Manga on Fandom

### Current Implementation
- Uses Fandom Search API: `https://{wiki}.fandom.com/api/v1/Search/List`
- Searches across multiple wikis simultaneously
- Returns basic search results with title, URL, and snippet

### Enhancement Needed
1. **Implement Cross-Wiki Search**
   ```typescript
   async searchAllFandomWikis(mangaTitle: string): Promise<FandomSearchResult[]> {
     const popularWikis = [
       'manga', 'anime', 'onepiece', 'myheroacademia', 
       'hunterxhunter', 'fire-force', 'naruto', 'bleach'
     ];
     
     // Search each wiki in parallel
     const results = await Promise.all(
       popularWikis.map(wiki => this.searchWiki(`${wiki}.fandom.com`, mangaTitle))
     );
     
     return this.aggregateAndRankResults(results);
   }
   ```

2. **Improve Result Ranking**
   - Prioritize exact title matches
   - Boost results with "(manga)" in the title
   - Consider wiki popularity and article quality

## Step 2: Identify Manga Main Page

### Pattern Recognition
Look for these URL patterns in search results:
- `{manga_name}_(manga)` - Most reliable pattern
- `{manga_name}_(Manga)` - Case variation
- Main wiki page if no manga-specific page exists

### Implementation
```typescript
interface MangaPageIdentifier {
  findMangaPage(searchResults: FandomSearchResult[]): string | null {
    // Priority 1: Direct manga page
    const mangaPage = searchResults.find(r => 
      r.title.match(/\(manga\)/i) || 
      r.url.includes('_(manga)') || 
      r.url.includes('_(Manga)')
    );
    
    // Priority 2: Main series page
    if (!mangaPage) {
      return searchResults.find(r => 
        r.title === mangaTitle || 
        r.url.endsWith(`/wiki/${mangaTitle.replace(/\s+/g, '_')}`)
      );
    }
    
    return mangaPage?.url || null;
  }
}
```

## Step 3: Extract Manga Metadata

### Data Points to Extract
1. **Cover Art Options**
   - Infobox image (primary)
   - Gallery images
   - Volume covers from history section
   
2. **Text Metadata**
   - Synopsis/Plot
   - Background/History
   - Author information
   - Publication details
   - Genre tags
   
3. **Navigation Links**
   - Volumes and Chapters page
   - Character pages
   - Arc pages

### Implementation
```typescript
interface MangaMetadata {
  title: string;
  alternativeTitles: string[];
  coverImages: {
    primary: string;
    gallery: string[];
    volumeCovers: string[];
  };
  description: {
    synopsis?: string;
    plot?: string;
    background?: string;
    history?: string;
  };
  links: {
    volumesPage?: string;
    chaptersPage?: string;
    charactersPage?: string;
  };
  publicationInfo: {
    author?: string;
    publisher?: string;
    demographic?: string;
    genres: string[];
    status: string;
  };
}
```

### Finding Volume/Chapter Links
```typescript
async findVolumeChapterLinks(pageHtml: string): Promise<string[]> {
  const $ = cheerio.load(pageHtml);
  const possibleLinks: string[] = [];
  
  // Look for common link patterns
  const patterns = [
    'Chapters_and_Volumes',
    'List_of_Volumes',
    'Volumes_and_Chapters',
    'Chapter_List',
    'Volume_List',
    'Releases_(Manga)'
  ];
  
  $('a').each((_, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text();
    
    if (href && patterns.some(p => href.includes(p) || text.includes(p))) {
      possibleLinks.push(href);
    }
  });
  
  // Special case for nested volume pages (e.g., One Piece)
  const volumeSubpage = possibleLinks.find(link => 
    link.includes('/Volumes') || link.includes('/Volume_List')
  );
  
  return volumeSubpage ? [volumeSubpage] : possibleLinks;
}
```

## Step 4: Parse Volume and Chapter Information

### Enhanced Parser Features
1. **Extract Release Dates**
   - Japanese release dates
   - English/US release dates
   - Digital release dates

2. **Chapter URLs Collection**
   ```typescript
   interface ChapterInfo {
     chapterNumber: string;
     title: string;
     volumeNumber: number;
     url: string; // Individual chapter page URL
     releaseDate?: {
       japan?: Date;
       english?: Date;
     };
   }
   ```

3. **Volume Cover Extraction**
   ```typescript
   interface VolumeInfo {
     volumeNumber: number;
     title: string;
     coverImage?: string;
     isbn?: string;
     chapters: ChapterInfo[];
     releaseDate?: {
       japan?: Date;
       english?: Date;
     };
   }
   ```

## Step 5: Extract Individual Chapter Details

### Chapter Page Data Extraction
```typescript
interface ChapterDetails {
  chapterNumber: string;
  title: string;
  summary?: string;
  pageCount?: number;
  coverArt?: string;
  characterAppearances?: string[];
  trivia?: string[];
  navigation: {
    previous?: string;
    next?: string;
  };
}

async extractChapterDetails(chapterUrl: string): Promise<ChapterDetails> {
  const html = await this.fetchPage(chapterUrl);
  const $ = cheerio.load(html);
  
  return {
    chapterNumber: this.extractChapterNumber($),
    title: this.extractChapterTitle($),
    summary: $('.mw-parser-output > p').first().text().trim(),
    pageCount: this.extractPageCount($),
    coverArt: this.extractChapterCover($),
    characterAppearances: this.extractCharacters($),
    trivia: this.extractTrivia($),
    navigation: this.extractNavigation($)
  };
}
```

## Data Storage Structure

### Database Schema Enhancement
```typescript
// Enhanced Metadata table
interface EnhancedMetadata {
  // Existing fields...
  
  // New fields for Fandom data
  fandomData?: {
    wikiUrl: string;
    mangaPageUrl: string;
    volumesPageUrl?: string;
    
    // Gallery options for user selection
    coverOptions: {
      primary: string;
      alternatives: string[];
    };
    
    // Extended descriptions
    descriptions: {
      synopsis?: string;
      plot?: string;
      background?: string;
    };
    
    // Publication metadata
    publication: {
      originalRun?: string;
      publishers: {
        japan?: string;
        english?: string;
      };
    };
  };
}

// New Chapter Details table
interface ChapterMetadata {
  id: number;
  mangaId: number;
  chapterNumber: string;
  
  // Fandom-specific data
  fandomUrl?: string;
  summary?: string;
  pageCount?: number;
  coverArt?: string;
  characterAppearances?: string[];
  trivia?: string[];
  
  releaseDates?: {
    japan?: Date;
    english?: Date;
  };
}
```

## Integration Points

### 1. Search Step Enhancement
- Add "Search Fandom" button in manga search
- Show wiki source in search results
- Allow manual wiki selection

### 2. Confirmation Screen
- Show all extracted metadata
- Allow cover art selection from gallery
- Preview volume/chapter structure
- Option to fetch individual chapter details

### 3. Manga Details Page
- Display chapter-level metadata in expandable cards
- Show release dates timeline
- Link to Fandom pages for more info
- Chapter art gallery view

### 4. Background Jobs
- Queue system for fetching chapter details
- Progress tracking for large manga
- Incremental updates as data is fetched

## API Endpoints

### New tRPC Procedures
```typescript
// Step 1: Search across Fandom wikis
searchFandomWikis: procedure
  .input(z.object({ title: z.string() }))
  .query(async ({ input }) => {
    return fandomCrawler.searchAllFandomWikis(input.title);
  }),

// Step 2-3: Get manga metadata
fetchFandomMangaMetadata: procedure
  .input(z.object({ mangaPageUrl: z.string() }))
  .mutation(async ({ input }) => {
    return fandomCrawler.extractMangaMetadata(input.mangaPageUrl);
  }),

// Step 4: Parse volumes and chapters
parseFandomVolumes: procedure
  .input(z.object({ volumesPageUrl: z.string() }))
  .mutation(async ({ input }) => {
    return fandomCrawler.parseVolumesAndChapters(input.volumesPageUrl);
  }),

// Step 5: Get chapter details (with batching)
fetchChapterDetails: procedure
  .input(z.object({ 
    chapterUrls: z.array(z.string()),
    batchSize: z.number().default(10)
  }))
  .mutation(async ({ input }) => {
    return fandomCrawler.batchFetchChapterDetails(
      input.chapterUrls, 
      input.batchSize
    );
  })
```

## Performance Considerations

1. **Caching Strategy**
   - Cache wiki search results for 24 hours
   - Cache manga metadata for 7 days
   - Cache chapter details permanently (immutable)

2. **Rate Limiting**
   - Respect Fandom's rate limits
   - Implement exponential backoff
   - Queue chapter fetching to avoid bursts

3. **Progressive Enhancement**
   - Show basic data immediately
   - Fetch detailed data in background
   - Update UI as data arrives

## User Experience

1. **Guided Flow**
   - Step-by-step wizard for Fandom import
   - Preview at each step
   - Ability to skip/customize

2. **Bulk Operations**
   - Import multiple manga from same wiki
   - Batch update existing manga
   - Export/import Fandom metadata

3. **Manual Override**
   - Edit extracted data before saving
   - Add custom chapter URLs
   - Merge with existing metadata

This comprehensive approach ensures complete metadata extraction from Fandom wikis while maintaining performance and user control over the process.