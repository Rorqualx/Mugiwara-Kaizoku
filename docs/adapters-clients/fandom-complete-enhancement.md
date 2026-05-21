# Fandom Complete Enhancement

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Complete Enhancement

---
# Fandom Parser Complete Enhancement Summary

## Overview
This document summarizes the complete enhancement of the Fandom parser to handle Fire Force manga and similar wikis that have different HTML structures.

## Implemented Features

### 1. Enhanced Volume/Chapter Parsing
- **File**: `/src/api/metadataProviders/utils/fandomTableParser.ts`
- **Enhancement**: Added support for Fire Force-style tables that use "(Volume X)" format
- **Key Function**: `parseFireForceStyleTable()` - Handles tables without CSS classes
- **Result**: Successfully parses 34 volumes with 879 chapters from Fire Force wiki

### 2. New tRPC Endpoints
- **File**: `/src/server/trpc/routers/metadata.ts`

#### a) `parseFandomUrl` Mutation
- Parses volume/chapter information from Fandom URLs
- Returns:
  - Total volume count
  - Total chapter count  
  - Detailed volume information (first 5 volumes for preview)

#### b) `fetchFandomMetadata` Mutation
- Extracts enhanced metadata from Fandom wiki pages
- Returns:
  - Cover image URL
  - Full description
  - Alternative titles
  - Genres
  - Authors
  - Status
- Handles lazy-loaded images with `data-src` attributes

### 3. MetadataUrlsForm Component Enhancement
- **File**: `/src/components/updateManga/MetadataUrlsForm.tsx`
- **Features**:
  - Automatically parses Fandom URLs when added
  - Shows parsed volume/chapter counts as badges
  - Expandable preview of first 5 volumes
  - Loading state while parsing
  - Visual feedback with notifications

### 4. Confirmation Screen Enhancement
- **File**: `/src/components/addManga/steps/confirmationStep.tsx`
- **Features**:
  - Metadata URL input during manga addition
  - Automatic parsing of Fandom URLs
  - Fetches enhanced metadata (cover, description) from main wiki pages
  - Visual indicators when cover/description is missing
  - Expandable volume preview
  - Updates manga selection with fetched metadata in real-time

## Usage Flow

### Adding New Manga:
1. Search for manga and select from results
2. In confirmation screen:
   - If source is Fandom and cover/description is missing, add the wiki page URL
   - System automatically fetches cover art and description
   - Add volume list URL to extract volume/chapter counts
   - Review parsed data in expandable preview
3. Confirm to add manga with complete metadata

### Updating Existing Manga:
1. Go to manga details page
2. Navigate to "Metadata URLs" section
3. Add Fandom wiki URLs:
   - Main page URL for cover/description
   - Volume list URL for chapter counts
4. System automatically parses and displays the data
5. Click "Update URLs & Refresh" to save

## Technical Implementation

### Cover Image Extraction Priority:
1. Infobox image (`.portable-infobox .pi-image img`)
2. Thumbnail images with lazy loading (`img[data-src]`)
3. Figure images (`figure.image img`)
4. Any image with "cover" in the URL

### Volume Table Detection:
1. Tables with standard classes (`.wikitable`, `.article-table`)
2. Tables containing "(Volume X)" pattern
3. Handles concatenated chapter lists within cells

### Error Handling:
- All operations use AsyncResult pattern
- Graceful fallbacks for missing data
- User-friendly error messages
- Loading states for all async operations

## Benefits

1. **Complete Metadata**: Automatically extracts all available metadata from Fandom wikis
2. **User-Friendly**: Visual feedback and previews before saving
3. **Flexible**: Works with various Fandom wiki structures
4. **Real-time Updates**: See metadata changes instantly in the UI
5. **Comprehensive**: Handles both volume/chapter counts and general metadata

## Testing

Tested successfully with:
- Fire Force Wiki: https://fire-force.fandom.com/wiki/Fire_Force_(manga)
- Volume List: https://fire-force.fandom.com/wiki/List_of_Volumes
- Results: 34 volumes, 879 chapters, cover image, and description extracted

## Future Enhancements

1. Support for more wiki formats beyond Fandom
2. Batch processing of multiple URLs
3. Automatic wiki page detection
4. Integration with other metadata sources