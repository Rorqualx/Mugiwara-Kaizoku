# Fandom Enhanced Data Extraction

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Enhanced Data Extraction

---
# Fandom Enhanced Data Extraction Plan

## Current Issue
The Fandom adapter is currently only fetching basic metadata from the wiki's JSON API, which results in:
- Missing volume/chapter counts (showing as 0)
- Truncated descriptions
- Missing alternate titles
- No detailed chapter information

## Required Enhancements

### 1. Volume/Chapter Table Parsing
- Fetch the actual HTML page content (not just JSON API)
- Parse volume tables to extract:
  - Volume numbers and titles
  - Release dates (JP and EN)
  - Cover characters
  - ISBN numbers
  - Page counts
  - Chapter lists within each volume

### 2. Enhanced Data Points
- Full description from the main article
- Alternate titles from infobox
- Proper volume and chapter counts
- Author/artist information
- Publication dates
- Genre tags

### 3. URL Pattern Recognition
For manga wikis, the typical URL patterns are:
- Main page: `https://[manga-name].fandom.com/wiki/[Manga_Name]`
- Volumes page: `https://[manga-name].fandom.com/wiki/List_of_Volumes`
- Chapters page: `https://[manga-name].fandom.com/wiki/Chapters_and_Volumes/Volumes`

### 4. Implementation Approach

#### Step 1: Add HTML Fetching
```typescript
private async fetchPageHTML(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}
```

#### Step 2: Parse Volume Tables
```typescript
private async parseVolumeTables(html: string): Promise<VolumeData[]> {
  const $ = cheerio.load(html);
  const volumes = [];
  
  // Find volume tables (usually have class "wikitable")
  $('.wikitable').each((i, table) => {
    // Parse table rows for volume data
  });
  
  return volumes;
}
```

#### Step 3: Extract Enhanced Metadata
```typescript
private async getEnhancedMangaInfo(url: string): Promise<EnhancedFandomMangaInfo> {
  // 1. Fetch main page HTML
  const mainPageHtml = await this.fetchPageHTML(url);
  
  // 2. Extract infobox data
  const infoboxData = this.parseInfobox(mainPageHtml);
  
  // 3. Find and fetch volumes page
  const volumesUrl = this.findVolumesPageUrl(mainPageHtml);
  const volumesHtml = await this.fetchPageHTML(volumesUrl);
  
  // 4. Parse volume/chapter data
  const volumeData = await this.parseVolumeTables(volumesHtml);
  
  return {
    ...basicInfo,
    volumes: volumeData.length,
    totalChapters: volumeData.reduce((sum, vol) => sum + vol.chapters.length, 0),
    alternativeTitles: infoboxData.alternativeTitles,
    description: infoboxData.description,
    volumeDetails: volumeData
  };
}
```

## Benefits
- Complete volume and chapter information
- Accurate counts instead of 0s
- Full descriptions
- Alternate titles for better search
- Detailed chapter lists for tracking

## Next Steps
1. Implement HTML fetching capability in FandomClient
2. Add cheerio-based parsing for volume tables
3. Enhance the getMangaInfo method to use these new capabilities
4. Update the adapter to pass through the enhanced data
5. Test with Fire Force and One Piece wikis