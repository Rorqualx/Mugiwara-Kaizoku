# Fandom Parser Enhancements

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Parser Enhancements

---
# Fandom Parser Enhancement Documentation

## Overview
Enhanced the Fandom metadata parser to extract volume and chapter information from manga wiki pages, with integration into both the update manga and add manga workflows.

## Key Enhancements

### 1. Parser Improvements (`fandomTableParser.ts`)
- Added support for Fire Force-style tables that use "(Volume X)" format
- Enhanced chapter extraction to handle concatenated chapter lists
- Fixed typo: `japanesTitle` → `japaneseTitle`
- Improved regex patterns to extract chapter numbers and titles from complex formats

### 2. New tRPC Endpoint (`metadata.ts`)
- Added `parseFandomUrl` mutation to parse Fandom wiki pages on demand
- Returns:
  - Total volume count
  - Total chapter count
  - Detailed volume information (first 5 volumes for preview)

### 3. MetadataUrlsForm Component Enhancement
- Added automatic parsing when Fandom volume URLs are added
- Shows parsed volume/chapter counts as badges
- Expandable preview of first 5 volumes with chapter details
- Loading state while parsing

### 4. Confirmation Screen Enhancement (`confirmationStep.tsx`)
- Added metadata URL input during manga addition
- Automatic parsing of Fandom URLs for volume pages
- Display of parsed volume/chapter data with expandable preview
- Visual indicators for Fandom sources with parsing tips
- Parsed data included in manga metadata when saved

## Usage Flow

### For Updating Existing Manga:
1. Navigate to manga details page
2. Click on "Metadata URLs" section
3. Add the Fandom wiki's "List of Volumes" URL
4. Parser automatically extracts volume/chapter data
5. Click "Update URLs & Refresh" to save

### For Adding New Manga:
1. Search for manga and select a result
2. In confirmation screen, if source is Fandom:
   - Add the wiki's volume list URL in the metadata section
   - Parser automatically extracts and displays volume/chapter counts
   - Expandable preview shows detailed volume information
3. Confirm to add manga with parsed metadata

## Technical Implementation

### Parser Pattern Detection:
```typescript
// Fire Force style: (Volume 1), (Volume 2), etc.
if ($(element).text().includes(`(Volume ${volumeNumber})`)) {
  // Parse this section as a volume
}
```

### Chapter Extraction:
```typescript
// Matches patterns like: "00. Title (Japanese Title)"
const chapterMatches = chapterText.matchAll(/(\d{2,})\.\s*([^0-9]+?)(?=\d{2,}\.|ISBN|$)/g);
```

### Data Structure:
```typescript
interface ParsedVolumeData {
  volumes: number;
  chapters: number;
  volumeDetails?: Array<{
    volumeNumber: number;
    title: string;
    chapterCount: number;
    chapters: Array<{
      chapterNumber: string;
      title: string;
    }>;
  }>;
}
```

## Tested With

### Fire Force Wiki
- URL: https://fire-force.fandom.com/wiki/List_of_Volumes
- Successfully parsed: 34 volumes with 879 chapters
- Handles unique table structure without CSS classes
- Extracts chapters from concatenated lists

## Benefits

1. **Accurate Metadata**: Automatically extracts precise volume/chapter counts
2. **User-Friendly**: Visual preview of parsed data before saving
3. **Flexible**: Works with various Fandom wiki table formats
4. **Integrated**: Seamlessly integrated into both add and update workflows
5. **Performance**: Parsing happens on-demand with visual feedback

## Future Enhancements

1. Support for more wiki table formats
2. Batch parsing of multiple URLs
3. Automatic detection of volume list pages
4. Integration with other wiki sources beyond Fandom