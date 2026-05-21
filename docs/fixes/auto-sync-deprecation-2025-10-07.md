# Auto-Sync/Refresh Deprecation - October 7, 2025

## Issue Report

**Problem**: Manga page is automatically syncing/refreshing data after initial import, causing chapters to be overwritten.

**User Report**: "something seems to be updating or syncing data after the initial import and chapters are being overwritten"

---

## 🔍 Audit Findings

### Auto-Update Mechanisms Identified

#### 1. **Default tRPC/React Query Auto-Refetch Behavior**

**Location**: `src/pages/manga/[id].tsx:542`

```typescript
const { data: mangaData, isLoading, refetch } = trpc.manga.get.useQuery(
    { id: mangaId ?? 0 },
    { enabled: !!mangaId && mangaId > 0 }  // ❌ No refetch prevention
);
```

**Problem**: Missing query options to prevent auto-refetch

**Default Behavior** (without options):
- ✅ `refetchOnWindowFocus: true` - Refetches when window regains focus
- ✅ `refetchOnReconnect: true` - Refetches when network reconnects
- ✅ `refetchOnMount: true` - Refetches on component mount (if stale)
- ⏰ `staleTime: 0` - Data immediately considered stale

**Impact**: Every time user switches tabs and comes back, data refreshes and potentially overwrites chapters.

---

#### 2. **SyncStatusCard Auto-Check on Mount**

**Location**: `src/components/manga/SyncStatusCard.tsx:100-102`

```typescript
// Check sync status on mount
useEffect(() => {
  handleCheckSync();
}, [mangaId]);
```

**Problem**: Automatically runs sync check every time:
- Component mounts
- mangaId changes
- Page refreshes

**Flow**:
```
SyncStatusCard mounts
  → handleCheckSync()
    → checkSyncMutation.mutateAsync({ mangaId })
      → Queries database for out-of-sync chapters
        → May trigger data updates
```

**Impact**: Unnecessary background sync checks that could trigger chapter data updates.

---

#### 3. **Excessive refetch() Calls Throughout Page**

**Locations**: Multiple places in `src/pages/manga/[id].tsx`

```typescript
Line 809:  void utils.manga.query.invalidate();
Line 820:  refetch();
Line 837:  refetch();
Line 972:  refetch();
Line 1050: refetch();
Line 1058: onRefresh={refetch}
Line 1795: onSyncFixed={() => refetch()}
Line 1843: refetch();
Line 1858: refetch();
Line 1874: refetch();
Line 1890: refetch();
Line 1910: refetch();
Line 1918: refetch();
```

**Problem**: 13 different places calling `refetch()` after various operations

**Common Triggers**:
- After updating manga metadata
- After monitoring status changes
- After downloading chapters
- After fixing sync issues
- After cover/banner selection
- After provider binding

**Impact**: While some refetches are necessary after mutations, others may be causing unnecessary data overwrites.

---

#### 4. **SyncStatusCard Callback Chain**

**Location**: `src/pages/manga/[id].tsx:1795`

```typescript
<SyncStatusCard
  mangaId={mangaId}
  mangaTitle={manga["title"]}
  onSyncFixed={() => refetch()}  // ❌ Triggers full page refresh
/>
```

**Flow**:
```
User clicks "Fix Sync" in SyncStatusCard
  → fixSyncMutation executes
    → onSuccess callback (line 87 in SyncStatusCard)
      → handleCheckSync() // Re-check sync
      → onSyncFixed?.()    // Call parent callback
        → refetch() in manga page
          → Fetches ALL manga data again
            → Chapters may be overwritten
```

**Impact**: Fixing sync issues triggers a full data refresh that could overwrite chapter data.

---

## 📋 Root Cause Analysis

### Primary Issue: Default React Query Refetch Behavior

The manga detail page query uses **default React Query settings**, which means:

1. **Window Focus Refetch**: Every time user switches tabs and returns, data refreshes
2. **No Stale Time**: Data is immediately considered stale (0ms)
3. **Mount Refetch**: Component remounting triggers refetch

### Secondary Issue: Over-Aggressive Refetching

Multiple operations trigger `refetch()` even when not strictly necessary:
- Some operations should use **optimistic updates** instead
- Some operations should use **partial invalidation** instead of full refetch
- Some refetches are defensive but cause unnecessary data churn

### Tertiary Issue: Auto-Background Sync

`SyncStatusCard` automatically checks sync status on mount, potentially triggering:
- Database queries
- Sync fix operations
- Full page refetches via callback

---

## ✅ Recommended Solutions

### Solution 1: Disable Auto-Refetch in Manga Query (HIGH PRIORITY)

**File**: `src/pages/manga/[id].tsx:542`

```typescript
// BEFORE
const { data: mangaData, isLoading, refetch } = trpc.manga.get.useQuery(
    { id: mangaId ?? 0 },
    { enabled: !!mangaId && mangaId > 0 }
);

// AFTER
const { data: mangaData, isLoading, refetch } = trpc.manga.get.useQuery(
    { id: mangaId ?? 0 },
    {
      enabled: !!mangaId && mangaId > 0,
      refetchOnWindowFocus: false,     // Prevent refetch on tab switch
      refetchOnReconnect: false,       // Prevent refetch on network reconnect
      refetchOnMount: false,           // Prevent refetch on component mount
      staleTime: Infinity,             // Data never goes stale
      cacheTime: Infinity              // Keep in cache forever
    }
);
```

**Impact**:
- ✅ Prevents automatic refreshing when switching tabs
- ✅ Prevents network reconnect from overwriting data
- ✅ Prevents component remount from refetching
- ✅ Manual `refetch()` calls still work when explicitly needed
- ⚠️ User needs to manually refresh if they want updated data

---

### Solution 2: Disable SyncStatusCard Auto-Check (HIGH PRIORITY)

**File**: `src/components/manga/SyncStatusCard.tsx:100-102`

**Option A: Complete Removal**
```typescript
// REMOVE THIS:
useEffect(() => {
  handleCheckSync();
}, [mangaId]);
```

**Option B: Make it Opt-In**
```typescript
interface SyncStatusCardProps {
  mangaId: number;
  mangaTitle: string;
  onSyncFixed?: () => void;
  autoCheck?: boolean; // NEW: Default false
}

useEffect(() => {
  if (autoCheck) {  // Only run if explicitly enabled
    handleCheckSync();
  }
}, [mangaId, autoCheck]);
```

**Recommendation**: Use Option A (complete removal) to fully deprecate auto-sync

**Impact**:
- ✅ No more automatic sync checks on page load
- ✅ User must manually click refresh button to check sync
- ✅ Prevents unexpected data updates

---

### Solution 3: Audit and Reduce Unnecessary refetch() Calls (MEDIUM PRIORITY)

**Strategy**: Replace refetch() with more targeted approaches

**Categories**:

1. **Keep refetch()**: Operations that modify data and need fresh state
   - After deleting manga
   - After import/refresh metadata operations
   - After fixing sync issues (but make it explicit)

2. **Remove refetch()**: Operations that don't change data
   - After toggling monitoring (use optimistic update)
   - After selecting covers/banners (use optimistic update)
   - After binding providers (only if needed)

3. **Make refetch() optional**: Operations where user can decide
   - Add a "Refresh data after operation" checkbox
   - Only refetch if user opts in

**Example: Optimistic Update Instead of Refetch**
```typescript
// BEFORE: Refetch after cover selection
onCoverSelect={async (coverId) => {
  await updateCover(coverId);
  refetch();  // ❌ Full page refresh
}}

// AFTER: Optimistic update
onCoverSelect={async (coverId) => {
  // Update local state immediately
  setManga(prev => ({ ...prev, coverImageUrl: newCoverUrl }));

  // Update in background (no refetch)
  await updateCover(coverId);

  // Optional: Add manual refresh button if needed
}}
```

---

### Solution 4: Add Explicit Manual Refresh Control (LOW PRIORITY)

**Add a Manual Refresh Button**:

```typescript
// In MangaActionBar or top of page
<Tooltip label="Refresh manga data">
  <ActionIcon onClick={() => refetch()}>
    <IconRefresh />
  </ActionIcon>
</Tooltip>
```

**Benefits**:
- User has explicit control over when data refreshes
- No surprise data updates
- Clear indication that data is being refreshed

---

## 🎯 Implementation Plan

### Phase 1: Immediate Fixes (Prevent Data Overwrites)
1. ✅ Disable auto-refetch in `trpc.manga.get.useQuery`
2. ✅ Disable `SyncStatusCard` auto-check on mount
3. ✅ Add manual refresh button to manga page

### Phase 2: Refetch Audit (Optimize Behavior)
1. Review all 13 `refetch()` calls
2. Replace unnecessary refetches with optimistic updates
3. Add user controls for optional refetches

### Phase 3: Testing
1. Test initial manga load - no auto-refresh
2. Test tab switching - no auto-refresh
3. Test manual refresh button - works correctly
4. Test sync fix - doesn't automatically refetch (user manual refresh)

### Phase 4: Documentation
1. Update component documentation
2. Add JSDoc comments explaining manual refresh requirement
3. Update user-facing docs if applicable

---

## 📊 Expected Impact

### Before Changes
- ❌ Data refreshes automatically on tab switch
- ❌ Data refreshes on component mount
- ❌ Data refreshes on network reconnect
- ❌ SyncStatusCard auto-checks on every load
- ❌ 13 different refetch triggers throughout page
- ❌ Chapters may be overwritten unexpectedly

### After Changes
- ✅ No automatic data refreshes
- ✅ User has full control via manual refresh button
- ✅ No surprise chapter overwrites
- ✅ Sync checks are manual/explicit
- ✅ Reduced unnecessary API calls
- ✅ Predictable data state

---

## ⚠️ Deprecation Notice

**Auto-sync and auto-refresh features are deprecated as of October 7, 2025**

**Reason**: Automatic data synchronization was causing unexpected overwrites of chapter data after initial import.

**Migration**: Users must now manually trigger refresh operations using the refresh button or explicit sync actions.

**Breaking Changes**:
- `SyncStatusCard` no longer auto-checks sync status on mount
- Manga detail page no longer auto-refreshes on window focus
- Manual refresh button added for explicit user control

---

## 🔗 Related Files

- `src/pages/manga/[id].tsx` - Main manga detail page
- `src/components/manga/SyncStatusCard.tsx` - Sync status component
- `src/store/RootStoreProvider.tsx` - Already has anti-refetch settings
- `src/hooks/useManga.ts` - Manga mutation hooks

---

**Status**: Ready for implementation
**Priority**: High
**Complexity**: Low
**Risk**: Low (mainly UI/UX change, no data structure changes)
