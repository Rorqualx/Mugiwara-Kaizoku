# ComicVine Service

This directory contains the ComicVine service implementation for Kaizoku, which provides functionality for interacting with the ComicVine API.

## Modular Queries

The ComicVine service uses modular queries to optimize data fetching. This approach allows for more efficient API usage by only requesting the data needed for specific use cases.

### Available Query Types

1. **Basic Volume Info Query** (`BASIC_VOLUME`)
   - Lightweight query for essential information
   - Used for search results and list views
   - Includes: ID, name, image, start_year, publisher, count_of_issues, deck

2. **Detailed Volume Info Query** (`DETAILED_VOLUME`)
   - Comprehensive metadata for manga detail pages
   - Includes: Basic info + description, genres, first_issue, last_issue, dates

3. **Complete Volume Info Query** (`COMPLETE_VOLUME`)
   - All available information in a single query
   - Use sparingly due to large payload size
   - Includes: All volume data including characters, person_credits, issues

4. **Issue Info Query** (`ISSUE`)
   - Information about individual issues/chapters
   - Includes: ID, name, image, description, issue_number, volume, dates, credits

5. **Character Info Query** (`CHARACTER`)
   - Character information
   - Includes: ID, name, image, description, publisher, gender, origin, real_name

6. **Creator Info Query** (`CREATOR`)
   - Creator (person) information
   - Includes: ID, name, image, description, birth, country, credits

### Service Methods

The ComicVine service provides methods for each query type:

```typescript
// Basic volume info
async getBasicVolumeInfo(id: number): Promise<ComicVineVolume | null>

// Detailed volume info
async getDetailedVolumeInfo(id: number): Promise<ComicVineVolume | null>

// Complete volume info
async getCompleteVolumeInfo(id: number): Promise<ComicVineVolume | null>

// Issue info
async getIssueInfo(id: number): Promise<ComicVineIssue | null>

// Character info
async getCharacterInfo(id: number): Promise<ComicVineCharacter | null>

// Creator info
async getCreatorInfo(id: number): Promise<ComicVineCreator | null>

// Search for volumes
async searchBasicVolumes(query: string, page?: number, limit?: number): Promise<ComicVineVolume[]>

// Get issues for a volume
async getVolumeIssues(volumeId: number, page?: number, limit?: number): Promise<ComicVineIssue[]>

// Get characters for a volume
async getVolumeCharacters(volumeId: number, page?: number, limit?: number): Promise<ComicVineCharacter[]>

// Get creators for a volume
async getVolumeCreators(volumeId: number, page?: number, limit?: number): Promise<ComicVineCreator[]>
```

## Usage Examples

### Basic Search

```typescript
import { comicvineService } from '@/server/services/comicvine/service';

// Initialize the service (required before first use)
await comicvineService.initialize();

// Search for volumes with basic info
const results = await comicvineService.searchBasicVolumes('Batman', 0, 10);
```

### Fetching Volume Details

```typescript
import { comicvineService } from '@/server/services/comicvine/service';

// Get detailed volume info
const volumeDetails = await comicvineService.getDetailedVolumeInfo(12345);

// Get issues for a volume
const issues = await comicvineService.getVolumeIssues(12345);
```

## Testing

A test script is provided to demonstrate the usage of these modular queries:

```bash
# Run the test script
node scripts/test-comicvine-modular-queries.mjs [volumeId]

# Example with specific volume ID
node scripts/test-comicvine-modular-queries.mjs 12345
```

## ComicVine API Notes

### Volume vs. Issue Mapping

ComicVine's data model differs from traditional manga organization:

- A **Volume** in ComicVine represents a collection or series (e.g., "Batman")
- An **Issue** in ComicVine represents a single chapter or book in that series

When mapping to manga terminology:
- ComicVine Volume → Manga Series
- ComicVine Issues → Manga Chapters
- For volume count, we use 1 if there are issues (since a ComicVine volume is a single collection)
- For chapter count, we use the `count_of_issues` field

### Rate Limiting

The ComicVine API has a rate limit of 450 requests per hour. The service includes built-in rate limiting with exponential backoff to handle this limitation.

## Benefits

- **Reduced data transfer**: Only fetch the data needed for each use case
- **Improved performance**: Smaller queries execute faster
- **Better maintainability**: Easier to understand and modify specific queries
- **Reduced rate limiting issues**: More efficient use of ComicVine API quota
- **Enhanced error handling**: Centralized error handling and retry logic

## API Key Configuration

The ComicVine service requires an API key to function. This key is automatically retrieved from the application settings. To configure your API key:

1. Go to Settings > Metadata > ComicVine
2. Enable the ComicVine provider
3. Enter your API key in the provided field
4. Save the settings

The service will automatically use this key for all API requests.
