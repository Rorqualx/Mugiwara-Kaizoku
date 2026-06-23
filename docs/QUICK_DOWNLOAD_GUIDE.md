# Quick Download System Guide

## Overview

The Quick Download system provides **one-click automated downloads** for manga chapters by intelligently searching Prowlarr, scoring releases, and automatically selecting the best match.

### Two-Mode Download System

**Quick Download (Automated)**
- ⚡ One-click operation
- 🤖 App searches Prowlarr automatically
- 🎯 Intelligent scoring selects best release
- 📦 Downloads start immediately

**Search Downloads (Interactive)**
- 🔍 User searches manually
- 📊 Review results in table format
- 👆 Pick specific release
- 📥 Initiate download

---

## User Guide

### Single Chapter Quick Download

1. Navigate to a manga's chapter list
2. Find the chapter you want to download
3. Click the **"Download"** dropdown button on the chapter row
4. Select **"Quick Download"**
5. Watch the notification:
   - "Searching..." → Progress indicator
   - Success → Shows release title and indexer
   - Failure → Clear error message

### Bulk Quick Download

**Download Missing Chapters:**
1. Navigate to manga chapter list
2. Click **"Quick Download"** button in header
3. Select **"Download Missing (N)"**
4. System auto-searches and downloads all missing chapters

**Download All Chapters:**
1. Click **"Quick Download"** → **"Download All (N)"**
2. Downloads entire series (even already downloaded chapters)

**Download Selected Chapters:**
1. Check boxes next to desired chapters
2. Click **"Quick Download"** → **"Download Selected (N)"**
3. Only selected chapters will be downloaded

### Understanding Notifications

**Searching...**
```
"Auto-searching Prowlarr for best release..."
```
System is querying Prowlarr and scoring results.

**Success**
```
"Quick Download Started
Downloading: Fire Force v01-30 (Nyaa.si)"
```
Best release selected and download initiated.

**No Results**
```
"No Results Found
No matching releases found for this chapter"
```
Prowlarr returned no search results. Try manual search.

**All Blocked**
```
"All Results Blocked
All matching releases are on the blocklist"
```
Found results but all are blocked. Check blocklist settings.

**Failed**
```
"Download Failed
Failed to add download to client"
```
Download client error. Check Transmission/Deluge configuration.

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (UI)                          │
│  ChapterList.tsx → Quick Download Button/Dropdown           │
└────────────────────┬────────────────────────────────────────┘
                     │ tRPC Mutation
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               Backend (tRPC Router)                         │
│  manga/downloadOperations.ts → quickDownloadWithSearch endpoint                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│           QuickDownloadService (Orchestrator)               │
│  autoSelector.ts → Manages workflow                         │
│                                                             │
│  For each chapter:                                          │
│  1. Build search query: "{manga title} Chapter {index}"    │
│  2. Call ProwlarrMangaSearch.searchManga()                 │
│  3. Call scoringAlgorithm.autoSelectBestResult()           │
│  4. Call DownloadManager.processDownloadRequest()          │
│  5. 500ms delay (rate limiting)                            │
└────┬────────────────────────────────────────┬──────────────┘
     │                                        │
     ↓                                        ↓
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Scoring Algorithm       │    │  Download Manager           │
│  scoringAlgorithm.ts     │    │  downloadManager.ts         │
│                          │    │                             │
│  - Score each result     │    │  - Select client            │
│  - Apply bonuses/penalties│    │  - Create job              │
│  - Sort by score         │    │  - Initiate download       │
│  - Return best match     │    │  - Track attempt           │
└──────────────────────────┘    └─────────────────────────────┘
```

### Scoring Algorithm

Releases are scored on multiple factors:

#### Base Score (from Prowlarr)
- Uses Prowlarr's built-in relevance score
- Typically 0-100 based on title match quality

#### Format Bonus (up to 100 points)
```
CBZ:  +100 points (highest preference)
CBR:  +80 points
EPUB: +60 points
PDF:  +40 points
```

#### Quality Indicators
- **Official Release**: +50 points
- **Complete Collection**: +30 points (has "Complete" tag)

#### Health (Torrents Only)
- **Minimum Seeders**: 1 required
- **Seeders Bonus**: `seeders × 2`, capped at 100 points
- **Below Minimum**: -50 points (penalty)

#### Recency Bonus (up to 20 points)
- **< 30 days old**: +20 points
- **< 90 days old**: +10 points
- **< 365 days old**: +5 points

#### Language Bonus (up to 30 points)
- **First preferred language** (English): +30 points
- **Second preferred language** (Japanese): +20 points

#### Size Constraints
- **Too small** (< 10 MB): -50 points
- **Too large** (> 500 MB): -20 points

#### Blocklist (eliminates release)
- **Blocked release**: -1000 points (effectively eliminated)

### Example Scoring

**Release A: Official CBZ, 15 seeders, 60 days old, English**
```
Base Score:        80
Format Bonus:     +100 (CBZ)
Official Bonus:    +50
Seeders Bonus:     +30 (15 × 2, capped)
Recency Bonus:     +10 (60 days)
Language Bonus:    +30 (English)
─────────────────────
Total Score:       300 points
```

**Release B: Fan Scan CBR, 5 seeders, 200 days old, English**
```
Base Score:        75
Format Bonus:      +80 (CBR)
Official Bonus:     +0 (not official)
Seeders Bonus:     +10 (5 × 2)
Recency Bonus:      +5 (200 days)
Language Bonus:    +30 (English)
─────────────────────
Total Score:       200 points
```

**Release A wins!** (300 vs 200)

---

## Configuration

### Default Criteria

Location: `src/types/quickDownload.types.ts:43-54`

```typescript
export const DEFAULT_QUICK_DOWNLOAD_CRITERIA: QuickDownloadCriteria = {
  preferredFormats: ['CBZ', 'CBR', 'PDF', 'EPUB'],
  preferOfficial: true,
  preferComplete: true,
  minSeeders: 1,
  seedersWeight: 2,
  maxAgeDays: 365,
  minSizeMB: 10,
  maxSizeMB: 500,
  preferredLanguages: ['English', 'Japanese'],
  skipBlocklisted: true
};
```

### Customizing Criteria (Future Feature)

The system supports criteria overrides:

```typescript
// Example: Prefer EPUB over CBZ for this download
quickDownloadMutation.mutate({
  mangaId: 123,
  chapterId: 456,
  mode: 'SINGLE',
  criteria: {
    preferredFormats: ['EPUB', 'PDF', 'CBZ'],
    minSeeders: 5  // Require more seeders
  }
});
```

### Rate Limiting

**Bulk Downloads:**
- 500ms delay between chapters
- Prevents overwhelming Prowlarr

---

## Developer Guide

### File Structure

```
src/
├── types/
│   └── quickDownload.types.ts          # Type definitions
├── server/
│   ├── services/
│   │   ├── quickDownload/
│   │   │   ├── autoSelector.ts         # Orchestration service
│   │   │   └── scoringAlgorithm.ts     # Scoring logic
│   │   └── download/
│   │       └── downloadManager.ts       # Download execution
│   └── trpc/
│       └── routers/
│           └── manga/downloadOperations.ts  # quick-download endpoint
└── components/
    └── manga/
        └── ChapterList.tsx              # UI components
```

### Adding New Scoring Factors

**1. Update Type Definition** (`quickDownload.types.ts`)
```typescript
export interface QuickDownloadCriteria {
  // ... existing fields
  preferHQ: boolean;  // NEW: Prefer HQ releases
  hqBonus: number;    // NEW: Bonus points for HQ
}
```

**2. Update Default Criteria**
```typescript
export const DEFAULT_QUICK_DOWNLOAD_CRITERIA = {
  // ... existing defaults
  preferHQ: true,
  hqBonus: 40
};
```

**3. Implement Scoring Logic** (`scoringAlgorithm.ts`)
```typescript
export function scoreSearchResult(result, criteria) {
  // ... existing scoring

  // HQ BONUS
  if (criteria.preferHQ && result.tags?.includes('HQ')) {
    breakdown.hqBonus = criteria.hqBonus;
    totalScore += breakdown.hqBonus;
    logger.debug(`HQ bonus: +${breakdown.hqBonus}`);
  }

  return { result, score: totalScore, scoreBreakdown: breakdown };
}
```

### Testing Scoring Algorithm

```typescript
import { scoreSearchResult } from './scoringAlgorithm';
import { DEFAULT_QUICK_DOWNLOAD_CRITERIA } from '../../../types/quickDownload.types';

// Mock result
const mockResult = {
  title: 'Test Release',
  format: 'CBZ',
  isOfficial: true,
  seeders: 20,
  size: 150 * 1024 * 1024, // 150 MB
  protocol: 'torrent',
  languages: ['English']
};

// Score it
const scored = scoreSearchResult(mockResult, DEFAULT_QUICK_DOWNLOAD_CRITERIA);
console.log('Score:', scored.score);
console.log('Breakdown:', scored.scoreBreakdown);
```

### Debugging Quick Downloads

**Enable Detailed Logging:**

The scoring algorithm logs extensively:

```
[QuickDownload] Starting SINGLE quick download for manga 123
[QuickDownload] Processing 1 chapters
[QuickDownload] Processing chapter 45
[QuickDownload] Searching: "Fire Force Chapter 45"
[QuickDownload] Found 15 results
[QuickDownload] Scoring 15 search results
[QuickDownload] Format bonus for CBZ: +100
[QuickDownload] Official release bonus: +50
[QuickDownload] Seeders bonus (20 seeders): +40
[QuickDownload] Language bonus for English: +30
[QuickDownload] Total score for Fire Force v01-30: 300
[QuickDownload] Top 3 results: [...]
[QuickDownload] Selected: Fire Force v01-30 (score: 300)
[QuickDownload] Download started successfully for chapter 45
```

**Check Job Status:**
```sql
SELECT * FROM jobs
WHERE job_type = 'DOWNLOAD'
ORDER BY created_at DESC
LIMIT 10;
```

**Check Download Attempts:**
```sql
SELECT * FROM "ChapterDispatchAttempt"
WHERE "mangaId" = 123
ORDER BY "createdAt" DESC;
```

---

## Troubleshooting

### Problem: "No Results Found"

**Causes:**
- Prowlarr indexers don't have this manga
- Search query doesn't match indexer naming
- Chapter number format mismatch

**Solutions:**
1. Try manual "Search Downloads..." to see what's available
2. Check Prowlarr indexers are online
3. Adjust search query format (future feature)

### Problem: "All Results Blocked"

**Causes:**
- All found releases are on the blocklist
- Blocklist rules too aggressive

**Solutions:**
1. Review blocklist in settings
2. Remove overly broad rules
3. Try manual search to see blocked releases

### Problem: "Failed to add download to client"

**Causes:**
- Download client (Transmission/Deluge) not running
- Wrong connection settings
- Network issue

**Solutions:**
1. Check download client is running
2. Verify settings at Settings → Download Clients
3. Test connection manually
4. Check logs for detailed error

### Problem: Downloads Start But Fail

**Causes:**
- Torrent/NZB file is corrupt
- Indexer is down
- Authentication issues

**Solutions:**
1. Check download client logs
2. Try different indexer via manual search
3. Verify Prowlarr API key is correct

### Problem: Scoring Seems Wrong

**Causes:**
- Criteria not matching your preferences
- Missing metadata in Prowlarr results

**Solutions:**
1. Review scoring breakdown in logs
2. Adjust default criteria if needed
3. Report issue with example release

---

## Performance Considerations

### Single Download
- **Search Time**: 2-10 seconds (Prowlarr query)
- **Scoring Time**: < 100ms (even with 50+ results)
- **Total Time**: 2-10 seconds

### Bulk Download (10 chapters)
- **Search Time**: 2-10 seconds per chapter
- **Rate Limiting**: 500ms delay between chapters
- **Total Time**: ~25-105 seconds

### Optimization Tips

1. **Reduce Search Scope**: Use specific indexers
2. **Increase Rate Limit Delay**: If Prowlarr times out
3. **Batch Processing**: Process chapters in parallel (future feature)

---

## Future Enhancements

### Planned Features

**User-Configurable Criteria**
- Settings page for default criteria
- Per-manga criteria overrides
- Save custom scoring profiles

**Retry Logic**
- Automatic retry on failure
- Exponential backoff
- Alternative indexer fallback

**Advanced Scoring**
- Custom scoring formulas
- Machine learning for user preferences
- Historical success tracking

**Batch Optimization**
- Parallel Prowlarr queries
- Smart bundling (find packs first)
- Resume incomplete bulk operations

**Quality Profiles**
- Predefined profiles (High Quality, Fast Download, etc.)
- Import/export profiles
- Profile templates

---

## API Reference

### tRPC Endpoint

**Path:** `manga.quickDownloadWithSearch`

**Input:**
```typescript
{
  mangaId: number;
  chapterId?: number;              // For SINGLE mode
  chapterIds?: number[];           // For BULK mode
  mode: 'SINGLE' | 'BULK';
  criteria?: Partial<QuickDownloadCriteria>;  // Optional overrides
}
```

**Output:**
```typescript
{
  success: boolean;
  results: QuickDownloadChapterResult[];
  summary: {
    total: number;
    started: number;
    failed: number;
    noResults: number;
    allBlocked: number;
  };
}
```

**Example:**
```typescript
const result = await trpc.manga.quickDownloadWithSearch.mutate({
  mangaId: 123,
  chapterId: 456,
  mode: 'SINGLE'
});

if (result.success) {
  console.log(`Started: ${result.summary.started}`);
}
```

---

## Contributing

### Adding Tests

**Scoring Algorithm Tests:**
```typescript
// tests/quickDownload/scoringAlgorithm.test.ts
describe('scoreSearchResult', () => {
  it('should prefer CBZ over PDF', () => {
    const cbzResult = { ...mockResult, format: 'CBZ' };
    const pdfResult = { ...mockResult, format: 'PDF' };

    const cbzScore = scoreSearchResult(cbzResult, DEFAULT_CRITERIA);
    const pdfScore = scoreSearchResult(pdfResult, DEFAULT_CRITERIA);

    expect(cbzScore.score).toBeGreaterThan(pdfScore.score);
  });
});
```

### Code Style

- Follow existing TypeScript patterns
- Add comprehensive logging
- Document complex algorithms
- Write unit tests for scoring logic

---

## Credits

**Developed by:** Claude (Anthropic AI Assistant)
**Project:** Mugiwara-Kaizoku (Manga Download Manager)
**Version:** 1.0.0
**Date:** October 2025

---

## Support

For issues or questions:
1. Check this documentation first
2. Review logs for detailed errors
3. Test with manual search to isolate issue
4. Report bugs with example manga/chapter
