# Library Search Filter Feature

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Library Search Filter Feature

---
# Library Search & Filter Feature

## Overview

The Library Search & Filter feature enhances the manga library management experience by providing powerful search and filtering capabilities within individual libraries. This feature is especially useful for users with large manga collections who need to quickly find specific titles or organize their content.

## Features

### 1. **Text Search**
- Search manga by title or alternative titles
- Real-time filtering as you type
- Case-insensitive search

### 2. **Source Filtering**
- Filter manga by their source/provider (AniList, MangaDex, ComicVine, Fandom)
- Multi-select capability to view manga from multiple sources
- Dynamic source list based on actual manga in the library

### 3. **Status Filtering**
- Filter by manga publication status:
  - Ongoing
  - Completed
  - Licensed
  - Publishing Finished
  - Cancelled
  - On Hiatus
- Visual status badges with color coding
- Multi-select for viewing multiple statuses

### 4. **Sorting Options**
- Sort manga by:
  - Title (alphabetical)
  - Date Added (when manga was added to library)
  - Last Updated (most recent changes)
  - Chapter Count
  - Status
- Ascending/Descending order toggle

### 5. **Visual Feedback**
- Result count display (e.g., "15 of 50 manga")
- Active filter badges with quick removal
- Collapsible filter panel to save screen space
- Clear all filters button

## Implementation Details

### Component Structure

```
src/components/library/search/
├── LibrarySearchFilter.tsx    # Main search/filter component
└── index.ts                   # Export file
```

### Usage in Library Page

The search filter is integrated into the library detail page (`/library/[id]`) and appears above the manga grid when the library contains manga.

```tsx
<LibrarySearchFilter
  manga={libraryManga}
  onFilteredMangaChange={handleFilteredMangaChange}
  initialShowFilters={false}
/>
```

### State Management

The component maintains its own filter state and communicates filtered results to the parent component through a callback:

```typescript
interface LibraryFilterOptions {
  searchQuery: string;
  sources: string[];
  statuses: MangaStatus[];
  sortBy: LibrarySortCriteria;
  sortOrder: SortOrder;
}
```

## User Interface

### Default View
- Compact search bar with result count
- Filter button to expand advanced options
- Clear indication when filters are active

### Expanded View
- Grid layout for filter controls
- Organized into logical groups:
  - Source selection
  - Status selection
  - Sort options
  - Sort order

### Active Filters Display
- Shows all active filters as removable badges
- One-click removal of individual filters
- Clear all button for quick reset

## Performance Considerations

1. **Memoization**: Filtered results are memoized to prevent unnecessary recalculations
2. **Debouncing**: Search input can be debounced for better performance with large libraries
3. **Efficient Sorting**: Uses native JavaScript sort with optimized comparison functions

## Future Enhancements

Potential improvements for future iterations:

1. **Additional Filters**:
   - Genre filtering
   - Year/date range filtering
   - Reading progress (unread, in progress, completed)
   - Custom tags

2. **Search Enhancements**:
   - Fuzzy search for typo tolerance
   - Search by author/artist
   - Advanced query syntax

3. **Persistence**:
   - Save filter preferences per library
   - Quick filter presets
   - Recent searches

4. **Export/Actions**:
   - Bulk operations on filtered results
   - Export filtered list
   - Batch status updates

## Testing

To test the feature:

1. Navigate to a library with multiple manga
2. Use the search bar to find specific titles
3. Click the filter icon to expand options
4. Try different filter combinations
5. Verify sort orders work correctly
6. Test clearing filters individually and all at once

## Accessibility

- All interactive elements are keyboard accessible
- Proper ARIA labels for screen readers
- Clear visual feedback for all states
- Color-blind friendly status indicators

## Code Quality

The implementation follows the project's established patterns:
- Uses TypeScript with proper type safety
- Follows the AsyncResult pattern where applicable
- Uses relative imports as per project guidelines
- Implements proper enum usage (uppercase values)
- Includes comprehensive JSDoc documentation
