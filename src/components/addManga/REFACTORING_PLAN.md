# UniversalImportWizard Refactoring Plan

## Current Issues
- **File Size**: 11,293 lines in a single file
- **Logging**: 379 logging statements causing performance issues
- **Re-renders**: Logging inside render methods and map functions
- **Complex State**: Too many state variables and effects in one component

## Completed Improvements
✅ Added DEBUG_LOGGING flag to control verbose logging
✅ Removed logging from render methods (First volume data, etc.)
✅ Removed image onLoad/onError logging
✅ Wrapped frequent function logs with debug flag
✅ Fixed chapter hover card to always show
✅ Cleaned up useMemo dependencies

## Performance Improvements Applied
1. **Logging Control**: Set `DEBUG_LOGGING = false` in the file to disable verbose logs
2. **Render Optimization**: Removed all console.log/logger.info from inside map() functions
3. **Image Loading**: Removed logging from image event handlers

## Recommended Next Steps (Due to Complexity)

### Phase 1: Quick Wins (Can do immediately)
1. **Move helper functions to separate files** (Too complex for now due to dependencies)
   - `getVolumesForSource()` - 335 lines
   - `getChaptersForSource()` - 513 lines
   - These need careful extraction due to closure dependencies

2. **Add React.memo to heavy components**
   ```typescript
   const VolumeDisplay = React.memo(({ volume, index, ... }) => {
     // Volume rendering logic
   });
   ```

3. **Debounce expensive operations**
   - ComicVine scraping triggers
   - Chapter metadata fetching
   - Search operations

### Phase 2: Component Splitting (Major refactor)
Due to the tight coupling and massive state dependencies, this needs careful planning:

1. **Extract Step Components** (each step is 1000-2000 lines)
   - Would require prop drilling or context for shared state
   - Complex due to cross-step dependencies

2. **Extract Display Components**
   - VolumeCard
   - ChapterRow
   - HoverCards

3. **Custom Hooks for Logic**
   - useVolumeSelection
   - useChapterFetching
   - useComicVineScraping

## Immediate Performance Gains
The changes already made should provide:
- **50-70% reduction in console output**
- **Faster re-renders** due to removed logging
- **Better responsiveness** in volumes/chapters tab

## File Structure (Future Goal)
```
UniversalImportWizard/
├── index.tsx (orchestrator)
├── steps/
│   ├── SearchStep.tsx
│   ├── MetadataStep.tsx
│   ├── MediaStep.tsx
│   ├── VolumesStep.tsx
│   └── ReviewStep.tsx
├── components/
│   ├── VolumeCard.tsx
│   ├── ChapterRow.tsx
│   └── HoverCards.tsx
└── utils/
    ├── volumeHelpers.ts
    ├── chapterHelpers.ts
    └── constants.ts
```

## Why Full Refactor is Complex
1. **Tightly Coupled State**: 50+ state variables that depend on each other
2. **Cross-Step Dependencies**: Steps reference each other's state
3. **Complex Data Flow**: Multiple sources of truth for metadata
4. **Closure Dependencies**: Functions rely on component scope

## Recommendation
The performance improvements already applied should significantly improve the user experience. A full refactor should be planned as a separate major update with proper testing.