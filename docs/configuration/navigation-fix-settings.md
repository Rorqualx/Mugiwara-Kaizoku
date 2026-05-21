# Navigation Fix Settings

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Navigation Fix Settings

---
# Navigation Fix - Settings and Other Routes

## Problem
Settings navigation and other router.push calls were not working due to SSR being disabled with dynamic imports in the application.

## Solution Applied
Replace `router.push()` with `window.location.href` for reliable navigation.

## Files Fixed

### 1. homeActionBar.tsx
```typescript
// Before:
onClick={() => router.push('/settings')}

// After:
onClick={() => {
  console.log('Settings clicked, navigating to:', '/settings');
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = '/settings';
}}
```

### 2. settingsActionBar.tsx
```typescript
// Before:
onClick={() => router.push('/settings/general')}

// After:
onClick={() => {
  console.log('General settings clicked, navigating to:', '/settings/general');
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = '/settings/general';
}}
```

### 3. settings/integrations/index.tsx
```typescript
// Before:
onClick={() => router.push('/settings/api')}

// After:
onClick={() => {
  console.log('API settings clicked, navigating to:', '/settings/api');
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = '/settings/api';
}}
```

## Other Components That May Need Fixing

Based on the grep search, these components still use router.push and may need the same fix if navigation issues occur:

1. **headerContent.tsx** - Navigation to manga pages
2. **ActiveNavItem.tsx** - Navigation menu items
3. **library/views/DetailedView.tsx** - Library add and manga navigation
4. **library/views/ResponsiveDetailedView.tsx** - Manga navigation
5. **library/views/ResponsiveTableView.tsx** - Manga navigation
6. **library/views/TableView.tsx** - Manga navigation
7. **MangaList.tsx** - Manga and library navigation
8. **libraryActionBar.tsx** - Add manga navigation
9. **events/EventDetailsModal.tsx** - Event action navigation
10. **reader/NativeReader.tsx** - Back to manga navigation
11. **library/LibraryList.tsx** - Library navigation
12. **reader/BasicReader.tsx** - Reader settings navigation
13. **reader/EnhancedChaptersTable.tsx** - Chapter navigation
14. **calendar/CalendarEventModal.tsx** - Manga navigation
15. **taskActionBar.tsx** - Tasks dashboard navigation

## Implementation Pattern

For any component experiencing navigation issues, apply this pattern:

```typescript
// Replace this:
onClick={() => router.push('/some/path')}

// With this:
onClick={() => {
  console.log('Navigation clicked, navigating to:', '/some/path');
  // Use window.location directly for reliable navigation
  // This is necessary due to SSR being disabled with dynamic imports
  window.location.href = '/some/path';
}}
```

## Notes

- The console.log is helpful for debugging navigation issues
- This approach causes a full page reload but ensures reliable navigation
- The root cause is the SSR disabled configuration in _app.tsx
- A more comprehensive fix would be to resolve the SSR configuration issues, but that would require significant refactoring