# SEARCH_FIX_IMPLEMENTATION

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for SEARCH_FIX_IMPLEMENTATION

---
# Library Search Fix - Step-by-Step Implementation Guide

## Quick Fix Steps

### Step 1: Update MainSearchContext.tsx

Replace the file at `/src/contexts/search/MainSearchContext.tsx` with the fixed version from `/src/fixes/MainSearchContext.fixed.tsx`.

Key changes:
```typescript
// OLD (broken):
const searchQuery = (trpc.manga as any).search?.useQuery
  ? (trpc.manga as any).search.useQuery(...)
  : mockSearchQuery;

// NEW (fixed):
const searchQuery = trpc.manga.search.useQuery(
  { source: selectedSource === 'all' ? 'mangadex' : selectedSource, keyword: query },
  { enabled: query.length >= 3, retry: 1, staleTime: 60000 }
);
```

### Step 2: Update headerContent.tsx

Replace the file at `/src/components/headerContent.tsx` with the fixed version from `/src/fixes/headerContent.fixed.tsx`.

Key changes:
- Added provider selection dropdown
- Show popover when query.length >= 3
- Better error and empty state handling

### Step 3: Update SearchResults Component

In `/src/components/search/SearchResults.tsx`, add proper empty state handling:

```typescript
if (results.length === 0) {
  return (
    <Text size="sm" c="dimmed" ta="center" p="md">
      No results found
    </Text>
  );
}
```

### Step 4: Test the Implementation

1. Run the type check:
   ```bash
   pnpm type-check
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Test search functionality:
   - Type at least 3 characters in the search box
   - Try different providers
   - Test with queries that return no results
   - Test with network disconnected

### Step 5: Verify Fix

Open browser console and run:
```javascript
// Check if search is working
fetch('/api/trpc/manga.search?batch=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    '0': { json: { source: 'mangadex', keyword: 'naruto' } }
  })
}).then(r => r.json()).then(console.log);
```

## Common Issues and Solutions

### Issue 1: "Cannot read properties of undefined"
**Solution**: The tRPC client isn't recognizing the search endpoint. Ensure the manga router is properly imported and the search procedure is defined.

### Issue 2: "Provider not found"
**Solution**: The selected provider isn't registered. Default to 'mangadex' if 'all' is selected.

### Issue 3: Search returns no results
**Solution**: Check if the search query has minimum 3 characters and the provider is working.

## Rollback Instructions

If issues occur after applying fixes:

1. Restore original files:
   ```bash
   git checkout -- src/contexts/search/MainSearchContext.tsx
   git checkout -- src/components/headerContent.tsx
   ```

2. Clear Next.js cache:
   ```bash
   rm -rf .next
   pnpm dev
   ```

## Monitoring

After deployment, monitor for:
- Error rate in search endpoint calls
- Search query success rate
- User engagement with search feature

Check logs at:
- Browser console for client-side errors
- Server logs for API errors
- Network tab for failed requests
