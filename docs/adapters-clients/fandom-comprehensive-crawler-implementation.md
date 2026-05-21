# Fandom Comprehensive Crawler Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Comprehensive Crawler Implementation

---
# Fandom Comprehensive Crawler Implementation

## Overview

The Fandom service has been enhanced with comprehensive crawler functionality to extract detailed volume and chapter information from Fandom wikis. This implementation addresses the need for extracting structured manga data including volume lists, chapter names, and metadata.

## Key Features

### 1. Manga-Specific Search Filtering

The search functionality now filters results to only show manga-specific pages:

- **Included**: Pages with "(manga)" in title, manga-specific URLs, or manga-related content
- **Excluded**: Wiki homepages, anime pages, character pages, episode pages, categories, and templates

Example: When searching for "Fire Force", the results will show:
- ✅ Fire Force (manga)
- ❌ Fire Force Wiki
- ❌ Fire Force (anime)
- ❌ Shinra Kusakabe (character)

### 2. Dynamic Wiki Discovery

The service automatically discovers series-specific wikis:
- Attempts to find dedicated wikis (e.g., fire-force.fandom.com)
- Falls back to general manga.fandom.com if no specific wiki exists
- Uses MediaWiki API to verify wiki existence

### 3. Volume and Chapter Extraction

The enhanced `extractVolumesAndChapters` method extracts:

#### Volume Information:
- Volume number
- Volume title
- Cover image URL
- List of chapters in the volume
- ISBN (if available)
- Release date (if available)

#### Chapter Information:
- Chapter number
- Chapter title
- Description/summary
- URL to chapter page
- Volume association
- Release date (if available)

### 4. Data Extraction Methods

The crawler uses multiple strategies to extract data:

1. **Table Parsing**: Looks for tables containing volume/chapter information
2. **Header-Based Sections**: Identifies volume sections by H2/H3 headers
3. **List Parsing**: Extracts chapter lists from UL/OL elements
4. **Image Extraction**: Captures volume cover images with proper URL formatting

## Implementation Details

### Search Flow

```typescript
1. User searches for manga
2. Service checks for dedicated wiki (e.g., "fire-force.fandom.com")
3. Searches using Special:Search with filtering
4. Returns only manga-specific results
5. User selects manga page
```

### Data Extraction Flow

```typescript
1. User confirms manga selection
2. Service loads manga page
3. Finds "List of Volumes" link
4. Loads volumes page
5. Extracts volume and chapter data
6. Returns structured data for display
```

### Key Methods

#### `searchSpecificWiki`
- Uses Special:Search for comprehensive results
- Filters results to manga-only content
- Falls back to MediaWiki API if needed

#### `findChaptersListUrl`
- Prioritizes "List of Volumes" links
- Falls back to chapter list links
- Returns proper URL for data extraction

#### `extractVolumesAndChapters`
- Parses volume pages for structured data
- Handles multiple page formats
- Extracts cover images and metadata
- Associates chapters with volumes

## Usage Example

When a user searches for "Fire Force":

1. **Search Results** (filtered):
   ```
   - Fire Force (manga) ✓
   - Fire Force Volume 1 ✓
   ```

2. **After Selection**:
   The service automatically finds and loads:
   ```
   https://fire-force.fandom.com/wiki/List_of_Volumes
   ```

3. **Extracted Data**:
   ```json
   {
     "volumes": [
       {
         "number": 1,
         "title": "Volume 1",
         "coverImage": "https://...",
         "chapters": [
           {
             "number": 1,
             "title": "Shinra Kusakabe Joins the Force",
             "volume": 1
           },
           // ...
         ]
       }
     ],
     "chapters": [
       {
         "number": 1,
         "title": "Shinra Kusakabe Joins the Force",
         "description": "...",
         "volume": 1
       }
     ]
   }
   ```

## Benefits

1. **Accurate Search Results**: Only shows manga-related content
2. **Comprehensive Data**: Extracts full volume and chapter information
3. **Visual Content**: Includes cover images for better UX
4. **Structured Data**: Properly organized for database storage
5. **Dynamic Discovery**: Automatically finds the best wiki source

## Future Enhancements

1. **Character Extraction**: Extract character information from volumes
2. **Arc Information**: Group chapters into story arcs
3. **Publication Dates**: Extract and parse release dates
4. **Multi-Language Support**: Handle wikis in different languages
5. **Caching Strategy**: Implement smarter caching for volume data