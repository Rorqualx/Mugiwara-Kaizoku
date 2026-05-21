# Fandom Provider Enhancement Plan

## Overview
This document outlines the improvement plan for the Fandom metadata provider, focusing on enhancing cover art extraction, infobox parsing, and chapter-level metadata extraction.

## Priority 1: Cover Art Extraction 🎨

### 1.1 Volume Cover Art from List Pages
**Current Issue:** Volume cover images are present in the wiki tables but not extracted
**Example URL:** `https://static.wikia.nocookie.net/fire-brigade-of-flames/images/[id]/[name].png`

**Implementation Steps:**
1. Parse volume table cells for image elements
2. Extract `src` or `data-src` attributes from `<img>` tags
3. Handle lazy-loaded images with `data-image-key` attributes
4. Clean URLs by removing revision parameters
5. Store as `coverUrl` in volume metadata

**Expected Format:**
```typescript
{
  volume: 1,
  coverUrl: "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/9/98/Volume_1.png",
  coverCharacter: "Shinra Kusakabe"
}
```

### 1.2 Chapter Cover Art from Individual Pages
**Current Issue:** Chapter pages contain cover images but they're not extracted
**Example:** Chapter 0 has cover art at the top of the page

**Implementation Steps:**
1. Look for images in `.mw-parser-output` with class `pi-image` or in infoboxes
2. Extract the first substantial image (min dimensions 200x200)
3. Clean Wikia URLs to get the highest resolution version
4. Store as `chapterCoverUrl` in chapter metadata

**URL Cleaning Pattern:**
- Remove `/revision/latest` parameters
- Remove scale-to-width parameters
- Get original image URL format

## Priority 2: Infobox Data Extraction 📊

### 2.1 Main Manga Page Infobox
**Current Issue:** Author, publisher, and other key details not extracted from infobox

**Target Fields:**
- Author/Writer (Atsushi Ōkubo)
- Publisher (Kodansha, Kodansha USA)
- Demographic (Shōnen)
- Original Run dates
- Total Volumes/Chapters count
- Status (Completed/Ongoing)
- Genres

**Implementation Steps:**
1. Identify infobox by class `.portable-infobox` or `.infobox`
2. Parse `<div class="pi-data">` elements
3. Map label-value pairs to metadata fields
4. Handle multiple values (e.g., multiple publishers)

### 2.2 Chapter Page Infobox
**Current Issue:** Arc, page count, and detailed info not extracted

**Target Fields:**
- Arc name and number
- Chapter number (formatted)
- Page count
- Japanese title
- Release dates (Japan/English)
- Previous/Next chapter links

## Priority 3: Enhanced Chapter Metadata 📖

### 3.1 Arc Information
**Implementation:**
1. Extract from infobox field "Arc"
2. Create arc mapping structure
3. Group chapters by arc for better organization

### 3.2 Chapter Synopsis
**Implementation:**
1. Extract first paragraph after "Summary" heading
2. Limit to 500 characters
3. Clean wiki markup and references

### 3.3 Character Appearances
**Implementation:**
1. Parse "Character Appearances" section
2. Extract character names as array
3. Link to character wiki pages if available

## Priority 4: Technical Improvements 🔧

### 4.1 Image URL Processing
```typescript
function cleanWikiaImageUrl(url: string): string {
  // Remove revision parameters
  url = url.replace(/\/revision\/.*$/, '');
  
  // Remove scale-to-width
  url = url.replace(/\/scale-to-width-down\/\d+/, '');
  
  // Ensure HTTPS
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  
  return url;
}
```

### 4.2 Robust Infobox Parser
```typescript
interface InfoboxData {
  [key: string]: string | string[];
}

function parseInfobox(element: Element): InfoboxData {
  const data: InfoboxData = {};
  
  // Handle portable-infobox format
  const dataElements = element.querySelectorAll('.pi-data');
  dataElements.forEach(el => {
    const label = el.querySelector('.pi-data-label')?.textContent?.trim();
    const value = el.querySelector('.pi-data-value')?.textContent?.trim();
    if (label && value) {
      data[label.toLowerCase().replace(/\s+/g, '_')] = value;
    }
  });
  
  // Handle traditional infobox format
  const rows = element.querySelectorAll('tr');
  rows.forEach(row => {
    const th = row.querySelector('th')?.textContent?.trim();
    const td = row.querySelector('td')?.textContent?.trim();
    if (th && td) {
      data[th.toLowerCase().replace(/\s+/g, '_')] = td;
    }
  });
  
  return data;
}
```

## Implementation Timeline

### Phase 1 (Week 1): Cover Art Extraction
- [ ] Implement volume cover art extraction
- [ ] Implement chapter cover art extraction  
- [ ] Add URL cleaning utilities
- [ ] Test with Fire Force wiki

### Phase 2 (Week 2): Infobox Parsing
- [ ] Build robust infobox parser
- [ ] Extract author/publisher data
- [ ] Extract publication details
- [ ] Add genre and demographic info

### Phase 3 (Week 3): Chapter Enhancement
- [ ] Add arc extraction
- [ ] Extract chapter synopsis
- [ ] Add character tracking
- [ ] Extract page counts

### Phase 4 (Week 4): Testing & Optimization
- [ ] Comprehensive testing with multiple manga wikis
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation updates

## Test Cases

### Test 1: Fire Force Volume Cover
```typescript
// Expected output for Volume 1
{
  volumeNumber: 1,
  coverUrl: "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/.../Volume_1.png",
  coverCharacter: "Shinra Kusakabe",
  englishTitle: "Fire Force 01",
  japaneseTitle: "炎炎ノ消防隊 01"
}
```

### Test 2: Fire Force Chapter 0
```typescript
// Expected output
{
  chapterNumber: 0,
  title: "Shinra Kusakabe Joins the Force",
  japaneseTitle: "森羅日下部入隊",
  arc: "Introduction arc",
  pages: 54,
  coverUrl: "https://static.wikia.nocookie.net/fire-brigade-of-flames/images/9/98/Shinra_Kusakabe_Joins_the_Force.png",
  synopsis: "On a train, a human is set ablaze while...",
  characters: ["Shinra Kusakabe", "Akitaru Ōbi", "Takehisa Hinawa", "Maki Oze", "Iris"]
}
```

### Test 3: Main Manga Page
```typescript
// Expected output
{
  title: "Fire Force",
  author: "Atsushi Ōkubo",
  publisher: ["Kodansha", "Kodansha USA"],
  demographic: "Shōnen",
  status: "Completed",
  volumes: 34,
  chapters: 304,
  genres: ["Action", "Supernatural", "Science Fantasy"],
  startDate: "2015-09-23",
  endDate: "2022-02-22"
}
```

## Success Metrics

1. **Cover Art Extraction Rate**: Target 95% success rate for volume and chapter covers
2. **Infobox Data Completeness**: Extract at least 80% of available infobox fields
3. **Chapter Metadata Richness**: Increase metadata fields from 5 to 12+ per chapter
4. **Performance**: Maintain page parsing under 500ms per page
5. **Error Rate**: Less than 5% failure rate on standard wiki pages

## Notes

- Priority on Fire Force wiki but ensure compatibility with other Fandom wikis
- Handle variations in wiki formatting gracefully
- Cache extracted images to reduce repeated API calls
- Consider implementing progressive enhancement (basic → detailed metadata)