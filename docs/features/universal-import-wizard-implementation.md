# Universal Import Wizard Implementation

## Overview
We've successfully transformed the Fandom-specific import wizard into a universal import system that works for ALL metadata providers (AniList, ComicVine, Wikipedia, Fandom, etc.). This provides a detailed, comprehensive metadata selection workflow before the confirmation step.

## Changes Made

### 1. **UniversalImportWizard Component** (`src/components/addManga/UniversalImportWizard.tsx`)
   - Created a comprehensive 6-step wizard for importing manga from any provider
   - **Steps:**
     1. **Source URL**: Allows URL submission and parsing for automatic metadata extraction
     2. **Metadata**: Detailed metadata fields (description, genres, tags, creators, publication info)
     3. **Media Selection**: Gallery with tabs for covers, banners, gallery images, and volume covers
     4. **Volumes/Chapters**: Volume and chapter configuration with detailed structure
     5. **External IDs**: AniList, MAL, MangaDex, ComicVine IDs and external links
     6. **Review**: Comprehensive preview with metadata quality scoring and confidence levels

   - **Key Features:**
     - URL parsing for all providers using `parseMetadataUrl` mutation
     - Provider-specific data fetching (AniList, ComicVine, Wikipedia, Fandom)
     - Comprehensive metadata extraction from parsed URLs
     - Media gallery management with multiple image sources
     - Confidence scoring for each metadata field
     - Detailed preview panel showing all selected metadata

### 2. **SearchStep Updates** (`src/components/addManga/steps/searchStep.tsx`)
   - Modified to launch UniversalImportWizard for ALL providers, not just Fandom
   - Replaced Fandom-specific state with universal wizard state:
     - `showImportWizard`, `wizardProvider`, `resultToProcess`
   - The wizard is now triggered before confirmation for all sources
   - Maintains backward compatibility with legacy FandomImportWizard

### 3. **Enhanced Metadata Extraction**
   - Comprehensive field extraction:
     - Basic: title, alternative titles, description, status, format
     - Creators: authors, artists, publisher
     - Classification: genres, tags, country, language, adult content
     - Publication: start date, end date, release year
     - Media: covers, banners, gallery images, volume covers
     - Structure: volumes, chapters, detailed volume/chapter lists
     - External: AniList ID, MAL ID, MangaDex ID, external links

### 4. **Provider-Specific Enhancements**
   - **AniList**: Fetches complete metadata via API
   - **ComicVine**: Extracts issues as volumes, handles ComicVine-specific metadata
   - **Wikipedia**: Parses volume tables and chapter lists
   - **Fandom**: Complete wiki parsing with gallery extraction

### 5. **Confidence Scoring System**
   - Each metadata field gets a confidence score based on:
     - Provider reliability (AniList > ComicVine > Fandom > Wikipedia)
     - Field completeness
     - Data quality
   - Visual indicators: green (>80%), yellow (>60%), orange (>40%), red (<40%)

### 6. **UI Improvements**
   - **Media Selection**: Tabbed interface for different image types
   - **Metadata Preview**: Side-by-side comparison of selected metadata and quality scores
   - **Field-by-field editing**: Each field can be manually edited
   - **URL parsing**: Any field can be extracted from a URL
   - **Progress tracking**: Visual stepper showing wizard progress

## Data Flow

1. **User searches for manga** → Results displayed from all providers
2. **User selects a result** → UniversalImportWizard opens with provider context
3. **Wizard Step 1**: User can provide URL for additional parsing
4. **Wizard Steps 2-5**: User reviews and edits extracted metadata
5. **Wizard Step 6**: Review all selections with confidence scores
6. **Import**: Data passed to confirmation step with all metadata preserved

## Benefits

1. **Consistency**: Same detailed workflow for all providers
2. **Flexibility**: Users can edit any field and add custom data
3. **Transparency**: Confidence scores show data quality
4. **Completeness**: All metadata fields are exposed and editable
5. **Media Management**: Comprehensive gallery selection for all image types
6. **URL Parsing**: Extract metadata from any supported URL

## Testing Instructions

1. Navigate to `/add` page
2. Search for any manga
3. Select a result from any provider (AniList, ComicVine, Wikipedia, Fandom)
4. The UniversalImportWizard will open automatically
5. Test URL parsing by entering a provider URL in step 1
6. Review extracted metadata in subsequent steps
7. Check confidence scores in the review step
8. Complete import to see data in confirmation screen

## Future Enhancements

1. **Pattern Learning**: Store successful extractions to improve future parsing
2. **Batch Import**: Support multiple manga import in single wizard session
3. **Custom Providers**: Allow users to add custom metadata sources
4. **Template System**: Save metadata templates for similar manga
5. **AI Enhancement**: Use AI to suggest missing metadata fields