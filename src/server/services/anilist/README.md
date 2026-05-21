# AniList Service

This directory contains the AniList service implementation for Kaizoku, which provides functionality for interacting with the AniList GraphQL API.

## Modular Queries

The AniList service now uses modular queries to optimize data fetching. This approach allows for more efficient API usage by only requesting the data needed for specific use cases.

### Available Query Types

1. **Basic Information Query** (`BASIC_MANGA_INFO`)
   - Lightweight query for essential information
   - Used for search results and list views
   - Includes: ID, title, cover image, volumes, chapters, genres, status, score

2. **Detailed Information Query** (`DETAILED_MANGA_INFO`)
   - Comprehensive metadata for manga detail pages
   - Excludes relations and characters to reduce payload size
   - Includes: Basic info + description, publication details, dates, stats, tags

3. **Related Content Query** (`RELATED_MANGA_INFO`)
   - Focuses on relations and recommendations
   - Used for "Related Manga" sections
   - Includes: ID + relations and recommendations data

4. **Staff and Characters Query** (`STAFF_AND_CHARACTERS_INFO`)
   - Character and staff information
   - Used for dedicated character/staff pages
   - Includes: ID + character and staff data

5. **Community Data Query** (`COMMUNITY_DATA_INFO`)
   - Community-related information
   - Includes: ID + trends and reviews

6. **Complete Information Query** (`COMPLETE_MANGA_INFO`)
   - All available information in a single query
   - Use sparingly due to large payload size
   - Includes: All of the above combined

### Service Methods

The AniList service provides methods for each query type:

```typescript
// Basic info
async getBasicMangaInfo(id: number): Promise<AniListMedia | null>

// Detailed info
async getDetailedMangaInfo(id: number): Promise<AniListMedia | null>

// Related content
async getRelatedMangaInfo(id: number): Promise<AniListMedia | null>

// Staff and characters
async getStaffAndCharactersInfo(id: number): Promise<AniListMedia | null>

// Community data
async getCommunityDataInfo(id: number): Promise<AniListMedia | null>

// Complete info
async getCompleteMangaInfo(id: number): Promise<AniListMedia | null>

// Optimized search
async searchBasicManga(query: string, page?: number, perPage?: number): Promise<AniListMedia[]>
```

## Usage Examples

### Basic Search

```typescript
import { anilistService } from '@/server/services/anilist/service';

// Search for manga with basic info
const results = await anilistService.searchBasicManga('One Piece', 1, 10);
```

### Fetching Manga Details

```typescript
import { anilistService } from '@/server/services/anilist/service';

// Get detailed manga info
const mangaDetails = await anilistService.getDetailedMangaInfo(30002);

// Get related manga
const relatedManga = await anilistService.getRelatedMangaInfo(30002);
```

## Testing

A test script is provided to demonstrate the usage of these modular queries:

```bash
# Run the test script
node scripts/test-anilist-modular-queries.mjs [mangaId]

# Example with specific manga ID
node scripts/test-anilist-modular-queries.mjs 30002
```

## Benefits

- **Reduced data transfer**: Only fetch the data needed for each use case
- **Improved performance**: Smaller queries execute faster
- **Better maintainability**: Easier to understand and modify specific queries
- **Reduced rate limiting issues**: More efficient use of AniList API quota
