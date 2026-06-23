# Automatic Alternative Search

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Automatic Alternative Search

---
# Automatic Alternative Search

## Overview

The release blocklist system now includes automatic alternative search functionality. When a release is blocked (due to quality issues, wrong content, etc.), the system automatically searches for alternative releases of the same content.

## How It Works

### 1. Release Blocking
When a release is checked against the blocklist and found to be blocked, the system:
- Returns the block reason and details
- Automatically searches for up to 5 alternative releases
- Returns the alternatives in the check result

### 2. Alternative Search Process
The automatic search process:
1. Retrieves the manga details including alternative titles (synonyms)
2. Builds multiple search queries:
   - `{title} chapter {number}`
   - `{title} ch{number}`
   - `{title} {number}`
   - Same patterns for all alternative titles
3. Searches Prowlarr with each query
4. Filters results to:
   - Match the requested chapter number
   - Exclude already blocked releases
   - Remove duplicates
5. Returns up to 5 valid alternatives

### 3. Integration with Download Manager
When a download is blocked:
- The error message includes information about available alternatives
- Shows the first 3 alternatives with their source
- Indicates if more alternatives are available

## Implementation Details

### ReleaseBlocklistService
The `findAlternativeReleases` method in `ReleaseBlocklistService`:
```typescript
private async findAlternativeReleases(
  mangaId: number,
  chapterNumber: string,
  excludeReleases: string[]
): Promise<AsyncResult<ReleaseIdentifier[], Error>>
```

This method:
- Uses `ProwlarrMangaSearch` to find releases
- Checks each result against the blocklist
- Returns unblocked alternatives only

### Enhanced CheckRelease Response
The `BlocklistCheckResult` now includes alternatives:
```typescript
interface BlocklistCheckResult {
  isBlocked: boolean;
  reason?: ReleaseBlocklistReason;
  details?: string;
  matchedPattern?: string;
  alternatives?: ReleaseIdentifier[];
}
```

### Download Manager Integration
The download manager provides detailed error messages when releases are blocked:
```
Release blocked: QUALITY_POOR - Known for poor scan quality

Alternative releases found (3):
1. [GoodGroup] One Piece Chapter 1000 [HQ].cbz (Nyaa)
2. One Piece - Chapter 1000 (Official).cbz (MangaDex)
3. One_Piece_Ch1000_HD.zip (TorrentGalaxy)
```

## Usage Examples

### Checking a Release with Alternatives
```typescript
const blocklistService = getReleaseBlocklistService(prisma);
const result = await blocklistService.checkRelease({
  releaseTitle: '[BadGroup] One Piece Chapter 1000.cbz',
  mangaId: 123,
  chapterNumber: '1000',
  source: 'Nyaa'
});

if (result.data.isBlocked) {
  console.log(`Blocked: ${result.data.reason}`);
  console.log(`Alternatives: ${result.data.alternatives.length}`);
  
  for (const alt of result.data.alternatives) {
    console.log(`- ${alt.releaseTitle} (${alt.source})`);
  }
}
```

### Frontend Display
The release blocklist page shows:
- Statistics including success rate improvement
- Blocked releases with reasons
- Alternative count for each blocked release

## Testing

To verify the behavior manually:
1. Add a manga that has alternative titles
2. Block a test release
3. Trigger a search for a similar release (alternative search kicks in)
4. Confirm found alternatives are surfaced and pattern-based blocking applies

## Configuration

Alternative search behavior can be influenced by:
- Prowlarr indexer configuration
- Search categories in Prowlarr
- Manga metadata (especially synonyms/alternative titles)

## Future Enhancements

Potential improvements:
- User preference for alternative sources
- Quality scoring for alternatives
- Automatic download of best alternative
- Learning from user choices
- Integration with quality profiles