# Library Navigation Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Library Navigation Fixes

---
# Library Navigation and UI Fixes

## Summary
Fixed multiple critical issues affecting the library page functionality:

1. **React Queue Error in useLibrary Hook**
2. **Manga Navigation/Redirect Issue**
3. **Missing Cover Art in Library Display**
4. **Delete Manga Functionality**

## Issues Fixed

### 1. React Queue Error
**Problem**: The useLibrary hook was trying to use `trpc.library.get` which doesn't exist in the current router configuration.

**Solution**: Changed to use the correct `trpc.library.detail` procedure which is available in the library router.

**File Changed**: `src/hooks/useLibrary.ts`
```typescript
// Before
trpc.library.get

// After
trpc.library.detail
```

### 2. Manga Navigation Issue
**Problem**: Clicking on manga cards wasn't navigating properly - required a manual page refresh to work.

**Solution**: Fixed the onClick handler to properly handle the router.push promise and added error handling.

**File Changed**: `src/components/library/views/PosterView.tsx`
```typescript
// Before
onClick={() => void router.push(`/manga/${m.id}`)}

// After
onClick={() => {
  router.push(`/manga/${m.id}`).catch((error) => {
    console.error('Failed to navigate to manga:', error);
  });
}}
```

### 3. Missing Cover Art
**Problem**: The cover art wasn't displayed in the library manga cards.

**Solution**: The fix for the React queue error resolved this issue. The library.detail procedure properly includes manga metadata with cover URLs.

### 4. Delete Manga Functionality
**Problem**: The delete button in manga cards wasn't actually deleting the manga from the database.

**Solution**: Added proper mutation handling to call the manga.remove tRPC procedure.

**File Changed**: `src/components/library/views/PosterView.tsx`
- Added imports for tRPC client and notifications
- Added remove mutation with success/error handling
- Updated onRemove handler to actually call the mutation

```typescript
// Added mutation
const removeMangaMutation = trpc.manga.remove.useMutation({
  onSuccess: (data, variables) => {
    showSuccess({
      title: 'Manga Removed',
      message: `Successfully removed manga`
    });
    setTimeout(() => {
      onRefresh();
    }, 500);
  },
  onError: (error) => {
    showError({
      title: 'Failed to Remove Manga',
      message: error.message || 'An error occurred while removing the manga'
    });
  }
});

// Updated handler
onRemove={async (shouldRemoveFiles: boolean) => {
  console.log(`Library: Removing manga ${m.id} with shouldRemoveFiles=${shouldRemoveFiles}`);
  try {
    await removeMangaMutation.mutateAsync({
      id: typeof m.id === 'string' ? parseInt(m.id, 10) : m.id,
      shouldRemoveFiles
    });
  } catch (error) {
    console.error('Failed to remove manga:', error);
  }
}}
```

## Technical Details

### Router Structure
The project has two library router files:
- `src/server/trpc/router/library.ts` - Contains `detail` procedure (used)
- `src/server/trpc/routers/library.ts` - Contains `get` procedure (not used in current configuration)

The active router being used by the application is the one in the `router/` directory.

## Testing Recommendations

1. **Navigation Test**: Click on manga cards and verify immediate navigation without refresh
2. **Cover Art Test**: Verify cover images display properly in library view
3. **Delete Test**: Test deleting manga with and without file removal option
4. **Error Handling**: Test error scenarios (network issues, server errors) to ensure proper error messages

## All Type Checks Pass
```bash
pnpm type-check
# ✓ No TypeScript errors
```