# Release Blocklist Integration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Release Blocklist Integration

---
# Release Blocklist Integration

## Overview

The release blocklist feature has been integrated into the download manager to prevent downloading of known problematic releases. This feature automatically filters out blocked releases during search and prevents their download.

## How It Works

### 1. Search Filtering
When searching for manga via Prowlarr, the `ProwlarrMangaSearch` service now:
- Checks each search result against the blocklist
- Filters out blocked releases from the results
- Logs blocked releases with their reason
- Includes blocklist status in results for UI display

### 2. Download Prevention
The `DownloadManager` now checks the blocklist before processing downloads:
- **Prowlarr downloads**: Checks the release before sending to download client
- **Direct URL downloads**: Extracts filename and checks against blocklist
- Records all download attempts (success/failure) for quality tracking

### 3. Quality Tracking
Every download attempt is recorded with:
- Release information
- Success/failure status
- Error reasons if failed
- Download metrics (time, file size)
- Automatic quality evaluation for future blocking

## Integration Points

### ProwlarrMangaSearch (`src/server/services/prowlarr/mangaSearch.ts`)
- Added blocklist checking in `searchManga()` method
- Filters out blocked releases from search results
- Enhances results with blocklist information

### DownloadManager (`src/server/services/download/downloadManager.ts`)
- Added blocklist checks in `handleProwlarrDownload()` and `handleDirectDownload()`
- Records download attempts for quality tracking
- Returns descriptive errors when releases are blocked

### Data Types (`src/types/prowlarr.ts`)
- Extended `ProwlarrSearchResult` interface to include blocklist information
- Allows UI to display blocklist status

## Blocklist Reasons

The system supports blocking releases for various reasons:
- `QUALITY_POOR`: Poor scan/translation quality
- `WRONG_LANGUAGE`: Wrong language version
- `INCOMPLETE`: Missing pages or content
- `WATERMARKED`: Heavy watermarks
- `DUPLICATE`: Duplicate of better release
- `CORRUPTED`: File corruption
- `WRONG_CONTENT`: Mislabeled content
- `RELEASE_GROUP`: Blocked release group
- `USER_PREFERENCE`: User preference
- `AUTO_QUALITY`: Auto-blocked for quality issues
- `DMCA`: Copyright issue
- `OTHER`: Other reason

## Auto-Blocking

The system can automatically block releases based on:
- High failure rate (>80% failures with 3+ attempts)
- Multiple download errors
- Suspiciously small file sizes (<100KB)

## Usage Examples

### Check if a release is blocked
```typescript
const blocklistService = getReleaseBlocklistService(prisma);
const result = await blocklistService.checkRelease({
  releaseTitle: 'One.Piece.Ch1000.LowQuality.cbz',
  source: 'Nyaa'
});

if (result.data.isBlocked) {
  console.log(`Blocked: ${result.data.reason} - ${result.data.details}`);
}
```

### Block a release manually
```typescript
await blocklistService.blockRelease({
  release: {
    releaseTitle: '[BadGroup] Manga Title Ch100.cbz',
    source: 'Indexer'
  },
  reason: ReleaseBlocklistReason.QUALITY_POOR,
  reasonDetails: 'Known for poor quality scans',
  releaseGroup: 'BadGroup'
}, userId);
```

### Block by pattern
```typescript
await blocklistService.blockRelease({
  release: {
    releaseTitle: 'Example.CORRUPTED.zip'
  },
  reason: ReleaseBlocklistReason.CORRUPTED,
  blockPattern: '.*CORRUPTED.*' // Blocks all releases with "CORRUPTED" in name
}, userId);
```

## Testing

Run the test script to verify the integration:
```bash
bun run tsx scripts/test-blocklist-integration.ts
```

This script will:
1. Add test blocklist entries
2. Test blocklist checking
3. Test search filtering (if Prowlarr is configured)
4. Test download attempt recording
5. Display blocklist statistics
6. Clean up test data

## Future Enhancements

- UI for managing blocklist entries
- Bulk import/export of blocklist rules
- Integration with community blocklists
- Machine learning for quality prediction
- Automatic alternative suggestions