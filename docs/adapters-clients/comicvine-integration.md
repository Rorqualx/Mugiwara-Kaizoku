# ComicVine Integration Documentation

## Overview
This document describes how ComicVine volume and issue metadata is integrated throughout the Kaizoku application, from the confirmation screen through to the manga detail page and chapter listings.

## Data Flow

### 1. Fetching ComicVine Volume Details
A new tRPC endpoint `fetchComicvineVolumeDetails` has been added to fetch comprehensive metadata for ComicVine volumes and issues:

```typescript
// src/server/trpc/routers/metadata.ts
fetchComicvineVolumeDetails: procedure
  .input(z.object({
    url: z.string().optional(),
    id: z.string().optional(), 
    type: z.enum(['volume', 'issue']).default('volume'),
  }))
```

This endpoint:
- Accepts either a ComicVine URL or ID
- Automatically detects whether the URL is for a volume (4050-) or issue (4000-)
- Returns comprehensive metadata including:
  - Cover images in multiple sizes
  - Publisher information
  - Complete issues list with issue numbers and names
  - Character appearances
  - Creator credits with roles
  - Publication dates
  - First and last issue information

### 2. Confirmation Screen Enhancement
The confirmation screen (`src/components/addManga/steps/confirmationStep.tsx`) has been enhanced to:

#### Display ComicVine Volume Data
- Shows a list of issues (up to 10) with issue numbers and names
- Displays character appearances as badges (up to 8)
- Shows creator credits with roles (up to 5)
- Indicates total count when there are more items than displayed

#### Enhanced Metadata Fetching
When a ComicVine URL is entered:
1. Fetches basic metadata using `fetchComicvineMetadata`
2. Also fetches detailed volume information using `fetchComicvineVolumeDetails`
3. Merges both results to provide comprehensive data
4. Stores issues, characters, and creators in both `metadata` and `providerSpecific` fields

### 3. Chapter Creation from ComicVine Issues
When a ComicVine manga is added to the library:

#### Automatic Chapter Generation
The system automatically creates chapters from ComicVine issues:
```typescript
// src/server/services/metadataMerger.ts
async enrichChapterMetadataFromComicVine(mangaId: number)
```

This process:
1. Fetches the issues list from ComicVine API
2. Creates a chapter entry for each issue with:
   - `coverImage`: Issue cover art URL
   - `description`: Issue synopsis/description
   - `title`: Issue title
   - `index`: Issue number
   - `pageCount`: Number of pages (if available)

### 4. Chapter Display Enhancements

#### Chapter List Table (`src/components/manga/ChapterList.tsx`)
The chapter list displays:
- **Cover Thumbnails**: Shows issue cover art (40x60px) next to each chapter
- **Descriptions**: Displays issue description (truncated to 2 lines)
- **Clickable Titles**: Opens detail modal when clicked

#### Chapter Detail Modal (`src/components/manga/ChapterDetailModal.tsx`)
When clicking on a chapter, a modal displays:
- **Large Cover Image**: Full issue cover art (250px height)
- **Full Description**: Complete issue synopsis
- **Metadata**: Release date, language, page count, file size
- **Action Buttons**: Download and Read options

## Data Fields Mapping

### ComicVine Volume → Manga Metadata
| ComicVine Field | Manga Metadata Field | Description |
|----------------|---------------------|-------------|
| name | title | Volume/series name |
| description | description | Series synopsis |
| image.* | coverUrl, coverLarge, etc. | Cover images in various sizes |
| publisher | publisher | Publisher information |
| count_of_issues | issueCount | Total number of issues |
| start_year | startYear | Year series started |
| characters | characters | Character appearances |
| person_credits | creators | Creator credits |
| issues | issues | List of all issues |

### ComicVine Issue → Chapter
| ComicVine Field | Chapter Field | Description |
|----------------|--------------|-------------|
| issue_number | index | Chapter number |
| name | title | Issue title |
| description | description | Issue synopsis |
| image.* | coverImage | Issue cover art |
| cover_date | releaseDate | Publication date |

## User Experience

### Adding a ComicVine Manga
1. User searches for a manga
2. If ComicVine result is selected, user can:
   - See basic metadata immediately
   - Enter a ComicVine URL to fetch enhanced data
   - View issues list, characters, and creators in confirmation screen
3. Upon confirmation, the system:
   - Creates the manga entry with full metadata
   - Automatically generates chapters from ComicVine issues
   - Populates each chapter with cover art and descriptions

### Viewing Manga Details
1. **Manga Page**: Shows complete metadata including publisher, issue count, characters
2. **Chapter Table**: Displays issue covers and descriptions inline
3. **Chapter Modal**: Shows full issue details when clicked

## API Usage

### Example: Fetching Fire Force Volume 34
```typescript
// Using the tRPC endpoint
const result = await trpc.metadata.fetchComicvineVolumeDetails.mutate({
  url: 'https://comicvine.gamespot.com/fire-force-34-extinguish-the-flames-of-despair/4000-1020567/'
});

// Result includes:
{
  id: 1020567,
  name: "Fire Force 34: Extinguish the Flames of Despair",
  coverImages: {
    small: "...",
    medium: "...",
    large: "...",
    original: "..."
  },
  volume: {
    id: 104877,
    name: "Fire Force"
  },
  characterCredits: [...],
  personCredits: [...]
}
```

## Benefits

1. **Rich Metadata**: Users get comprehensive information about comic issues
2. **Visual Enhancement**: Cover art for each issue improves browsing experience  
3. **Automatic Population**: No manual entry needed for chapter information
4. **Detailed Tracking**: Each issue has its own metadata for better organization
5. **Publisher Support**: Proper handling of western comic publishers and formats

## Technical Implementation

### Key Components Modified
- `src/server/trpc/routers/metadata.ts`: Added `fetchComicvineVolumeDetails` endpoint
- `src/components/addManga/steps/confirmationStep.tsx`: Enhanced to display volume details
- `src/server/services/metadataMerger.ts`: Creates chapters from ComicVine issues
- `src/components/manga/ChapterList.tsx`: Displays cover thumbnails and descriptions
- `src/components/manga/ChapterDetailModal.tsx`: Shows full issue information

### Database Schema
Chapters table already includes necessary fields:
- `coverImage`: Stores issue cover URL
- `description`: Stores issue synopsis
- `pageCount`: Stores page count
- `releaseDate`: Stores publication date

No schema changes were required as the existing structure already supported this metadata.