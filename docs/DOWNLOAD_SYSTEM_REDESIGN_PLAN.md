# Download System Redesign - Intuitive UX Plan
**Date:** 2025-10-11
**Goal:** Clear separation between Quick Download (automated) and Manual Search (interactive)
**Status:** 📋 Planning Phase

---

## Vision: Two Clear Download Modes

### Mode 1: Quick Download (One-Click, Automated) ⚡
**User Intent:** "Just download this chapter, I trust the app to find it"

**User Experience:**
1. User clicks "Quick Download" button on chapter
2. App automatically searches Prowlarr
3. App automatically selects best match
4. App initiates download immediately
5. User sees: "Searching..." → "Download started"
6. Total time: 3-5 seconds

**When to Use:**
- User wants convenience over control
- User trusts app's selection algorithm
- Bulk downloads (Download All)
- Background downloads

---

### Mode 2: Manual Search (Interactive, Detailed) 🔍
**User Intent:** "Let me see options and pick the best release"

**User Experience:**
1. User clicks "Search Downloads" button on chapter
2. Modal opens with search results table
3. User reviews indexers, quality, seeders, size
4. User picks specific release
5. User clicks "Download" on chosen result
6. Total time: 15-30 seconds (user-dependent)

**When to Use:**
- User wants specific quality (CBZ vs CBR)
- User wants specific group/publisher
- User wants to avoid blocked releases
- User wants to check seeders before downloading

---

## Current State Analysis

### ❌ Problems with Current UX

1. **Hidden Prowlarr Integration**
   - Prowlarr search buried in "Search" tab of chapter modal
   - Most users don't discover it
   - Chapter list buttons use legacy system instead

2. **No Automated Prowlarr Download**
   - All Prowlarr downloads require manual search
   - Can't quick-download from chapter list using Prowlarr
   - No "app finds best match" option

3. **Confusing Button Labels**
   - "Download" → Uses legacy source (may not exist)
   - "Search Packs" → Opens Prowlarr search (unclear)
   - No clear distinction between modes

4. **Legacy System Still Active**
   - Chapter list downloads use original source URLs
   - Often fails if source is down or URL expired
   - Users don't know why it fails

---

## Proposed UX Redesign

### New Chapter List Buttons (Individual Chapters)

```
┌─────────────────────────────────────────────────────┐
│  Chapter 1: The Beginning         [•••] Dropdown    │
└─────────────────────────────────────────────────────┘
                                       ↓ Click
                    ┌──────────────────────────────────┐
                    │ ⚡ Quick Download                 │
                    │ 🔍 Search Downloads...           │
                    │ ──────────────────────────       │
                    │ 📖 Read                          │
                    │ ✓ Mark as Read                   │
                    │ 🗑 Delete                         │
                    └──────────────────────────────────┘
```

**Button Behavior:**

1. **⚡ Quick Download** (NEW)
   - Calls new `quickDownloadWithSearch` endpoint
   - Auto-searches: "{manga title} Chapter {number}"
   - Auto-selects best match using scoring algorithm
   - Shows notification: "Searching... → Download started"
   - Falls back to original source if Prowlarr fails

2. **🔍 Search Downloads...** (RENAMED)
   - Opens ChapterDetailModal → Search tab
   - Shows full Prowlarr search interface
   - User picks specific release
   - Same as current "Search" tab functionality

3. **Legacy behaviors preserved:**
   - Read, Mark as Read, Delete remain unchanged

---

### New Bulk Download Buttons (Header Actions)

```
┌─────────────────────────────────────────────────────┐
│  Chapters (304)                                     │
│                                                      │
│  [⚡ Quick Download All ▼]  [🔍 Search Packs]       │
└─────────────────────────────────────────────────────┘
```

**Button Behavior:**

1. **⚡ Quick Download All** (DROPDOWN)
   - Quick Download All Missing
   - Quick Download All Chapters
   - Quick Download Selected
   - Uses automated search + selection for each

2. **🔍 Search Packs** (EXISTING)
   - Opens PackSearchModal
   - User searches for volume packs
   - User picks specific pack
   - Same as current functionality

---

### ChapterDetailModal Tabs (When Clicking Chapter Title)

```
┌─────────────────────────────────────────────────────┐
│  Chapter 1: The Beginning                    [✕]   │
├─────────────────────────────────────────────────────┤
│  [Details]  [Search Downloads]  [History]          │
└─────────────────────────────────────────────────────┘
```

**Tab Changes:**
1. "Details" → Remains same (chapter info)
2. "Search" → Renamed to "Search Downloads" (clearer)
3. "History" → Remains same (download attempts)

---

## Quick Download Algorithm Design

### Smart Selection Criteria (Ranked by Priority)

```typescript
interface QuickDownloadCriteria {
  // Priority 1: Format preference
  preferredFormats: ['CBZ', 'CBR', 'PDF', 'EPUB'];  // In order

  // Priority 2: Quality indicators
  preferOfficial: boolean;          // Official publishers score higher
  preferComplete: boolean;          // "Complete" tag scores higher

  // Priority 3: Health (torrents only)
  minSeeders: number;               // Minimum seeders required (default: 1)
  seedersWeight: number;            // Score multiplier for seeders

  // Priority 4: Recency
  maxAgeDays: number;               // Prefer recent uploads (default: 365)

  // Priority 5: Size constraints
  minSizeMB: number;                // Reject suspiciously small files
  maxSizeMB: number;                // Reject suspiciously large files

  // Priority 6: Language
  preferredLanguages: string[];     // ['English', 'Japanese']

  // Auto-reject criteria
  blocklistedReleases: boolean;     // Skip blocked releases (always true)
  blocklistedIndexers: string[];    // Skip specific indexers
}
```

### Scoring Algorithm

```typescript
function scoreQuickDownloadResult(result: ProwlarrSearchResult): number {
  let score = 0;

  // BASE SCORE: Prowlarr's relevance score
  score += result.score || 0;  // Usually 0-100

  // FORMAT BONUS: Preferred formats get huge boost
  const formatScores = { CBZ: 100, CBR: 80, PDF: 40, EPUB: 60 };
  if (result.format && formatScores[result.format]) {
    score += formatScores[result.format];
  }

  // OFFICIAL BONUS: Official releases preferred
  if (result.isOfficial) {
    score += 50;
  }

  // COMPLETE BONUS: Complete collections preferred
  if (result.tags?.includes('Complete')) {
    score += 30;
  }

  // SEEDERS BONUS: Health indicator (torrents only)
  if (result.protocol === 'torrent' && result.seeders) {
    score += Math.min(result.seeders * 2, 100);  // Cap at 100
  }

  // RECENCY BONUS: Recent uploads preferred
  const ageDays = (Date.now() - new Date(result.publishDate).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) score += 20;      // Very recent
  else if (ageDays < 90) score += 10; // Recent
  else if (ageDays < 365) score += 5; // This year

  // LANGUAGE BONUS: Preferred languages
  if (result.audioLanguage === 'English' || result.languages?.includes('English')) {
    score += 30;
  }

  // SIZE PENALTY: Suspiciously small or large
  const sizeMB = result.size / (1024 * 1024);
  if (sizeMB < 10) score -= 50;        // Too small (likely fake)
  if (sizeMB > 500) score -= 20;       // Very large (may be pack)

  // BLOCKLIST PENALTY: Blocked releases get -1000 (effectively eliminated)
  if (result.isBlocked) {
    score -= 1000;
  }

  return score;
}
```

### Selection Process

```
1. Search Prowlarr: "{manga title} Chapter {number}"
2. Filter results: Remove blocked releases
3. Score all results: Use algorithm above
4. Sort by score: Highest first
5. Validate top result: Check downloadUrl exists
6. Select winner: Highest scoring valid result
7. Initiate download: Pass to downloadManager
```

---

## Backend Implementation Plan

### New Endpoint: `quickDownloadWithSearch`

**Location:** `src/server/trpc/routers/manga.ts`

```typescript
quickDownloadWithSearch: publicProcedure
  .input(z.object({
    mangaId: z.number(),
    chapterId: z.number().optional(),       // Single chapter
    chapterIds: z.array(z.number()).optional(), // Multiple chapters (bulk)
    mode: z.enum(['SINGLE', 'BULK']).default('SINGLE'),

    // Optional overrides for advanced users
    criteria: z.object({
      preferredFormats: z.array(z.string()).optional(),
      minSeeders: z.number().optional(),
      preferredLanguages: z.array(z.string()).optional()
    }).optional()
  }))
  .mutation(async ({ input, ctx }) => {
    const { mangaId, chapterId, chapterIds, mode, criteria } = input;

    // 1. Get manga details
    const manga = await ctx.prisma.manga.findUnique({
      where: { id: mangaId },
      include: { chapters: true }
    });

    if (!manga) throw new TRPCError({ code: 'NOT_FOUND' });

    // 2. Determine chapters to download
    const targetChapters = mode === 'SINGLE'
      ? [manga.chapters.find(ch => ch.id === chapterId)]
      : manga.chapters.filter(ch => chapterIds?.includes(ch.id));

    const results = [];

    // 3. For each chapter, auto-search and auto-select
    for (const chapter of targetChapters) {
      // Search Prowlarr
      const searchQuery = `${manga.title} Chapter ${chapter.index}`;
      const searchResults = await prowlarrService.search(searchQuery);

      // Score and select best match
      const scoredResults = searchResults.map(result => ({
        result,
        score: scoreQuickDownloadResult(result, criteria)
      }));

      scoredResults.sort((a, b) => b.score - a.score);

      const bestMatch = scoredResults[0]?.result;

      if (!bestMatch) {
        results.push({
          chapterId: chapter.id,
          status: 'NO_RESULTS',
          error: 'No matching releases found'
        });
        continue;
      }

      // 4. Initiate download with best match
      const downloadResult = await downloadManager.processDownloadRequest({
        mangaId,
        chapterIds: [chapter.id],
        method: DownloadMethod.PROWLARR,
        mode: DownloadMode.BULK,
        clientType: selectSmartClient(bestMatch.protocol),
        prowlarrResult: bestMatch
      });

      if (isSuccess(downloadResult)) {
        results.push({
          chapterId: chapter.id,
          status: 'STARTED',
          releaseTitle: bestMatch.title,
          indexer: bestMatch.indexerName,
          score: scoredResults[0].score
        });
      } else {
        results.push({
          chapterId: chapter.id,
          status: 'FAILED',
          error: downloadResult.error.message
        });
      }
    }

    return {
      success: true,
      results,
      summary: {
        total: targetChapters.length,
        started: results.filter(r => r.status === 'STARTED').length,
        failed: results.filter(r => r.status === 'FAILED').length,
        noResults: results.filter(r => r.status === 'NO_RESULTS').length
      }
    };
  })
```

---

## Frontend Implementation Plan

### 1. Update ChapterList Dropdown Menu

**File:** `src/components/manga/ChapterList.tsx`

**Changes:**
```typescript
// Add new menu items
<Menu.Item
  leftSection={<IconBolt size={14} />}  // Lightning bolt icon
  onClick={() => handleQuickDownload(chapter.id)}
>
  <div>
    <Text size="sm">Quick Download</Text>
    <Text size="xs" c="dimmed">Auto-search & download</Text>
  </div>
</Menu.Item>

<Menu.Item
  leftSection={<IconSearch size={14} />}
  onClick={() => openSearchModal(chapter)}
>
  <div>
    <Text size="sm">Search Downloads...</Text>
    <Text size="xs" c="dimmed">Pick from results</Text>
  </div>
</Menu.Item>
```

**Handler:**
```typescript
const quickDownloadMutation = trpc.manga.quickDownloadWithSearch.useMutation({
  onSuccess: (data) => {
    const { summary } = data;
    notifications.show({
      title: 'Quick Download',
      message: `${summary.started} started, ${summary.failed} failed`,
      color: summary.started > 0 ? 'green' : 'red'
    });
  }
});

const handleQuickDownload = async (chapterId: number) => {
  // Show searching notification
  notifications.show({
    id: 'quick-search',
    title: 'Quick Download',
    message: 'Searching Prowlarr...',
    loading: true,
    autoClose: false
  });

  await quickDownloadMutation.mutateAsync({
    mangaId: manga.id,
    chapterId,
    mode: 'SINGLE'
  });

  notifications.hide('quick-search');
};
```

---

### 2. Update Bulk Download Dropdown

**File:** `src/components/manga/ChapterList.tsx`

**Changes:**
```typescript
<Menu shadow="md" width={250}>
  <Menu.Target>
    <Button
      leftSection={<IconBolt size={16} />}
      rightSection={<IconChevronDown size={14} />}
    >
      Quick Download
    </Button>
  </Menu.Target>

  <Menu.Dropdown>
    <Menu.Item
      leftSection={<IconBolt size={14} />}
      onClick={() => handleQuickDownloadBulk('MISSING')}
    >
      Download Missing Chapters
      <Text size="xs" c="dimmed">Auto-search via Prowlarr</Text>
    </Menu.Item>

    <Menu.Item
      leftSection={<IconBolt size={14} />}
      onClick={() => handleQuickDownloadBulk('ALL')}
    >
      Download All Chapters
      <Text size="xs" c="dimmed">Auto-search via Prowlarr</Text>
    </Menu.Item>

    {selectedChapters.length > 0 && (
      <Menu.Item
        leftSection={<IconBolt size={14} />}
        onClick={() => handleQuickDownloadBulk('SELECTED')}
      >
        Download Selected ({selectedChapters.length})
        <Text size="xs" c="dimmed">Auto-search via Prowlarr</Text>
      </Menu.Item>
    )}
  </Menu.Dropdown>
</Menu>
```

---

### 3. Rename Modal Tab

**File:** `src/components/manga/ChapterDetailModal.tsx`

**Changes:**
```typescript
<Tabs.Tab value="search" leftSection={<IconSearch size={16} />}>
  Search Downloads  {/* Changed from just "Search" */}
</Tabs.Tab>
```

---

## User Settings (Future Enhancement)

### Quick Download Preferences Page

**Location:** Settings → Downloads → Quick Download

```typescript
interface QuickDownloadSettings {
  enabled: boolean;                    // Enable Quick Download feature

  // Format preferences
  preferredFormats: string[];          // ['CBZ', 'CBR', 'PDF', 'EPUB']

  // Quality preferences
  preferOfficial: boolean;             // Prefer official publishers
  preferComplete: boolean;             // Prefer "Complete" releases

  // Health requirements (torrents)
  minSeeders: number;                  // Minimum seeders (default: 1)

  // Language preferences
  preferredLanguages: string[];        // ['English', 'Japanese']

  // Size constraints
  minSizeMB: number;                   // Min file size (default: 10)
  maxSizeMB: number;                   // Max file size (default: 500)

  // Fallback behavior
  fallbackToOriginalSource: boolean;   // Try legacy download if Prowlarr fails
  showConfirmationDialog: boolean;     // Show "Download starting..." modal

  // Notification preferences
  notifyOnStart: boolean;              // Notify when download starts
  notifyOnComplete: boolean;           // Notify when download completes
  showSelectionDetails: boolean;       // Show which release was selected
}
```

**UI Example:**
```
┌────────────────────────────────────────────────────┐
│ Quick Download Preferences                         │
├────────────────────────────────────────────────────┤
│                                                    │
│ ☑ Enable Quick Download feature                   │
│                                                    │
│ Format Preference (drag to reorder):              │
│   1. CBZ (Comic Book Archive)                     │
│   2. CBR (Comic Book RAR)                         │
│   3. EPUB (E-Book)                                │
│   4. PDF (Portable Document)                      │
│                                                    │
│ Quality:                                           │
│   ☑ Prefer official publisher releases            │
│   ☑ Prefer complete collections                   │
│                                                    │
│ Torrent Health:                                    │
│   Minimum seeders: [1    ]                        │
│                                                    │
│ Language Preference:                               │
│   [English ▼] [Japanese ▼] [+ Add]               │
│                                                    │
│ Size Limits:                                       │
│   Min: [10  ] MB    Max: [500 ] MB               │
│                                                    │
│ Fallback:                                          │
│   ☑ Try original source if Prowlarr fails         │
│   ☐ Show confirmation before downloading          │
│                                                    │
│ Notifications:                                     │
│   ☑ Notify when download starts                   │
│   ☑ Show which release was selected               │
│                                                    │
│            [Save Preferences]                      │
└────────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Add Quick Download (Keep Legacy) ✅

**Goal:** Add new feature without breaking existing functionality

**Changes:**
1. Create `quickDownloadWithSearch` endpoint
2. Add "Quick Download" menu item to chapter dropdown
3. Add "Quick Download All" dropdown to header
4. Keep all legacy buttons working

**Testing:**
- Quick Download uses Prowlarr auto-search
- Legacy buttons still work
- No breaking changes

**Timeline:** 1-2 days

---

### Phase 2: User Settings & Refinement 🔧

**Goal:** Let users customize Quick Download behavior

**Changes:**
1. Add Quick Download settings page
2. Implement scoring algorithm overrides
3. Add "Show selection details" notification option
4. A/B test with users

**Testing:**
- User preferences persist
- Algorithm respects overrides
- Settings UI is intuitive

**Timeline:** 2-3 days

---

### Phase 3: Promote Quick Download (Gradual) 📢

**Goal:** Make Quick Download the default, legacy becomes fallback

**Changes:**
1. Swap button order (Quick Download first)
2. Add onboarding tooltip: "Try Quick Download!"
3. Track usage metrics
4. Gather user feedback

**Testing:**
- Monitor success/failure rates
- Compare Prowlarr vs legacy success
- User survey on satisfaction

**Timeline:** 1 week + monitoring

---

### Phase 4: Deprecate Legacy (Optional) 🗑️

**Goal:** Remove legacy download system entirely

**Prerequisites:**
- Quick Download success rate > 80%
- User feedback positive
- Fallback mechanism proven reliable

**Changes:**
1. Remove legacy "Download" button
2. Replace with Quick Download only
3. Keep "Search Downloads" for manual control
4. Add "Advanced" settings for power users

**Testing:**
- Ensure no downloads break
- Verify fallback works
- Monitor error rates

**Timeline:** 2-3 days (after Phase 3 success)

---

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Adoption Rate**
   - Goal: 60% of downloads use Quick Download within 1 month
   - Measure: Track `quickDownloadWithSearch` vs `download` calls

2. **Success Rate**
   - Goal: 85% of Quick Downloads find and start downloads
   - Measure: Track `status: 'STARTED'` vs total attempts

3. **User Satisfaction**
   - Goal: 4.0+ average rating on Quick Download feature
   - Measure: In-app feedback prompt after 5 uses

4. **Time to Download**
   - Goal: Average 3-5 seconds from click to "Download started"
   - Measure: Time between mutation call and success response

5. **Selection Accuracy**
   - Goal: 90% of auto-selected releases are "good" (not reported/blocked)
   - Measure: Track blocklist additions for Quick Download selections

---

## Risk Mitigation

### Risk #1: Auto-Selection Picks Wrong Release

**Mitigation:**
1. Show notification with selected release title
2. Add "Undo" button in notification (5-second window)
3. Allow report incorrect selection
4. Tune algorithm based on reports

### Risk #2: Prowlarr Search Takes Too Long

**Mitigation:**
1. Set 10-second timeout on search
2. Show "Still searching..." message after 5s
3. Fall back to legacy download on timeout
4. Cache search results for repeated chapters

### Risk #3: Users Confused by Two Download Options

**Mitigation:**
1. Clear labels: "Quick Download" vs "Search Downloads"
2. Descriptive subtitles in menu
3. First-time tooltip explaining difference
4. Help icon with example use cases

### Risk #4: Algorithm Consistently Picks Bad Matches

**Mitigation:**
1. Track user reports of bad downloads
2. Adjust scoring weights based on reports
3. Add machine learning in Phase 5
4. Allow per-manga selection overrides

---

## Code Organization

### New Files to Create

```
src/
├── server/
│   ├── services/
│   │   └── quickDownload/
│   │       ├── scoringAlgorithm.ts      ← Scoring logic
│   │       ├── selectionCriteria.ts     ← User preference types
│   │       └── autoSelector.ts          ← Selection orchestration
│   └── trpc/
│       └── routers/
│           └── manga.ts                  ← Add quickDownloadWithSearch
│
├── components/
│   └── manga/
│       ├── ChapterList.tsx               ← Update dropdown menu
│       └── QuickDownloadNotification.tsx ← New: Show selection details
│
├── pages/
│   └── settings/
│       └── quick-download.tsx            ← New: Preferences page
│
└── types/
    └── quickDownload.types.ts            ← New: Type definitions
```

---

## Implementation Checklist

### Backend (1-2 days)

- [ ] Create scoring algorithm (`scoringAlgorithm.ts`)
- [ ] Create auto-selector service (`autoSelector.ts`)
- [ ] Add `quickDownloadWithSearch` endpoint
- [ ] Add unit tests for scoring
- [ ] Add integration tests for endpoint

### Frontend (1-2 days)

- [ ] Add "Quick Download" to chapter dropdown menu
- [ ] Add "Quick Download All" dropdown to header
- [ ] Create QuickDownloadNotification component
- [ ] Update ChapterDetailModal tab label
- [ ] Add loading states and error handling

### Settings (2-3 days)

- [ ] Create Quick Download settings page
- [ ] Add preference persistence (Config table)
- [ ] Add form validation
- [ ] Add settings migration for existing users

### Testing (1 day)

- [ ] Test Quick Download with various manga
- [ ] Test bulk downloads
- [ ] Test edge cases (no results, all blocked)
- [ ] Test fallback to legacy download
- [ ] User acceptance testing

### Documentation (1 day)

- [ ] Update user guide with Quick Download section
- [ ] Add developer docs for scoring algorithm
- [ ] Create troubleshooting guide
- [ ] Update API documentation

---

## Example User Flows

### Flow 1: Quick Download Single Chapter

```
1. User goes to manga detail page
2. User hovers over chapter in list
3. User clicks dropdown menu (•••)
4. User clicks "⚡ Quick Download"
5. Notification: "Searching Prowlarr..."
6. [Backend searches, scores, selects in 3s]
7. Notification: "Download started: Fire Force v01-30 (CBZ) from Nyaa"
8. Chapter status changes to "Downloading"
9. User continues browsing
```

**Time:** 5 seconds total
**Clicks:** 2 (dropdown + quick download)
**User decisions:** 0 (fully automated)

---

### Flow 2: Manual Search for Specific Quality

```
1. User goes to manga detail page
2. User clicks on chapter title
3. ChapterDetailModal opens
4. User clicks "Search Downloads" tab
5. Search query auto-filled: "Fire Force Chapter 1"
6. User clicks "Search Prowlarr"
7. Results table loads with 15 releases
8. User sorts by "Format" column
9. User finds "Fire Force Ch01 [Official Digital] (CBZ)"
10. User checks seeders (28 seeders, 2 leechers)
11. User clicks "Download" button
12. Notification: "Download started"
13. Modal closes
```

**Time:** 20-30 seconds
**Clicks:** 6-8 (multiple sorting/reviewing)
**User decisions:** 1 (which release to download)

---

### Flow 3: Bulk Quick Download Missing Chapters

```
1. User goes to manga detail page
2. User sees "250 of 304 chapters missing"
3. User clicks "Quick Download All ▼" dropdown
4. User clicks "Download Missing Chapters"
5. Confirmation modal: "Download 250 missing chapters via Prowlarr?"
6. User clicks "Yes, Quick Download"
7. Progress modal: "Processing chapters... 15/250"
8. [Backend processes in batches of 5 concurrent]
9. Progress modal: "Processing chapters... 250/250"
10. Summary notification: "Quick Download complete: 238 started, 12 failed"
11. Failed chapters list: "Ch 47, 89, 103... (no results found)"
12. User clicks "Retry Failed" or dismisses
```

**Time:** 2-5 minutes (for 250 chapters)
**Clicks:** 3 (dropdown + option + confirm)
**User decisions:** 1 (confirm bulk action)

---

## Comparison: Before vs After

### Before (Current System)

| Aspect | Current Experience |
|--------|-------------------|
| **Discovery** | Prowlarr search hidden in modal tab |
| **Automation** | Zero - all downloads require manual search |
| **Speed** | 20-30s per chapter (manual search + selection) |
| **Bulk Downloads** | Not practical with Prowlarr (too manual) |
| **Quality Control** | Full control but tedious |
| **New User Friendly** | No - requires understanding of indexers |

### After (Proposed System)

| Aspect | New Experience |
|--------|----------------|
| **Discovery** | "Quick Download" prominently in dropdown menu |
| **Automation** | Fully automated search + selection for speed |
| **Speed** | 3-5s per chapter (automated) |
| **Bulk Downloads** | Practical - automated selection makes it viable |
| **Quality Control** | "Manual Search" option preserves full control |
| **New User Friendly** | Yes - "Quick Download" works instantly |

---

## Visual Mockups

### Chapter List Dropdown (Before vs After)

**Before:**
```
┌────────────────────────┐
│ 📖 Read                │
│ ✓ Mark as Read         │
│ 🗑 Delete              │
└────────────────────────┘
   ↑ No download options!
```

**After:**
```
┌────────────────────────────────────┐
│ ⚡ Quick Download                  │  ← NEW: Auto search & select
│ 🔍 Search Downloads...             │  ← NEW: Manual Prowlarr search
│ ─────────────────────────          │
│ 📖 Read                            │
│ ✓ Mark as Read                     │
│ 🗑 Delete                           │
└────────────────────────────────────┘
```

---

### Bulk Actions (Before vs After)

**Before:**
```
┌───────────────────────────────────────┐
│ [Download All]  [Download Missing]    │
│    ↑ Legacy system - often fails      │
└───────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────────────┐
│ [⚡ Quick Download ▼]  [🔍 Search Packs]     │
│                 ↓                             │
│   ┌─────────────────────────────────┐        │
│   │ Download Missing Chapters       │        │
│   │ Download All Chapters            │        │
│   │ Download Selected (5)            │        │
│   └─────────────────────────────────┘        │
└──────────────────────────────────────────────┘
```

---

## Next Steps

### To Proceed with Implementation:

1. **Review this plan** with team/stakeholders
2. **Approve scoring algorithm** weights and criteria
3. **Create GitHub issues** for each checklist item
4. **Set up feature flag** for gradual rollout
5. **Begin Phase 1 implementation**

### Questions to Resolve:

1. **Fallback behavior:** Should Quick Download fall back to legacy on Prowlarr failure?
2. **Bulk limits:** Max chapters for Quick Download All? (Suggest: 500)
3. **Caching:** Cache Prowlarr search results? For how long?
4. **Notifications:** How verbose? Show every chapter or just summary?
5. **Undo window:** How long to allow undo? (Suggest: 5 seconds)

---

**Ready to implement?** This plan provides complete specification for intuitive, two-mode download system. Quick Download for convenience, Manual Search for control. Clear, simple, powerful.
