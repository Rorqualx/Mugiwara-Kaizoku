# Confirmation Step Consolidation Plan

## Current Situation

### Files Structure
```
src/components/addManga/steps/
├── confirmationStep.tsx (7591 lines - MONOLITHIC)
└── confirmationStep/
    ├── index.ts (exports refactored pieces)
    ├── components/
    │   ├── MetadataFieldSelector.tsx
    │   └── VolumeChapterDisplay.tsx
    └── hooks/
        ├── useConfirmationState.ts
        ├── useFieldSelections.ts
        └── useProviderSearch.ts
```

### Problems
1. **Main file is 7591 lines** - Too large, unmaintainable
2. **Refactored components exist but are unused** - Wasted effort
3. **Duplicate code** - Main file doesn't use the extracted hooks/components
4. **Multiple provider search hooks** - One in main hooks dir, one in confirmationStep

## Consolidation Strategy

### Phase 1: Analyze and Map Dependencies
1. Map all functionality in the monolithic confirmationStep.tsx
2. Identify which parts are already extracted
3. Find remaining pieces that need extraction

### Phase 2: Extract Remaining Components
From the monolithic file, extract:
- Provider tabs component
- Metadata display cards
- Alternative titles section
- Banner/cover image modals
- Chapter preview modal
- Download configuration section
- Monitoring configuration section

### Phase 3: Refactor Main Component
1. Import all extracted hooks and components
2. Replace inline implementations with extracted versions
3. Reduce main file to orchestration logic only (target: <500 lines)

### Phase 4: Clean Up
1. Remove duplicate hooks (useProviderSearch duplication)
2. Update all imports in parent components
3. Delete unused code
4. Run type checking

## File Structure After Consolidation

```
src/components/addManga/steps/
├── confirmationStep.tsx (< 500 lines - orchestration only)
└── confirmationStep/
    ├── index.ts
    ├── types.ts (shared types)
    ├── components/
    │   ├── MetadataFieldSelector.tsx
    │   ├── VolumeChapterDisplay.tsx
    │   ├── ProviderTabs.tsx (NEW)
    │   ├── MetadataCard.tsx (NEW)
    │   ├── AlternativeTitles.tsx (NEW)
    │   ├── MediaModals.tsx (NEW)
    │   ├── ChapterPreview.tsx (NEW)
    │   └── ConfigurationSections.tsx (NEW)
    └── hooks/
        ├── useConfirmationState.ts
        ├── useFieldSelections.ts
        ├── useProviderSearch.ts
        └── useMetadataSync.ts (NEW)
```

## Implementation Steps

### Step 1: Extract Provider Tabs Component
- Lines ~2000-3000 dealing with provider tab rendering
- Create `ProviderTabs.tsx`

### Step 2: Extract Metadata Display Components
- Lines ~3000-5000 for metadata cards and display
- Create `MetadataCard.tsx` and `AlternativeTitles.tsx`

### Step 3: Extract Modal Components
- Lines ~7400-7580 for banner and chapter modals
- Create `MediaModals.tsx` and `ChapterPreview.tsx`

### Step 4: Extract Configuration Components
- Lines ~5000-6500 for download and monitoring config
- Create `ConfigurationSections.tsx`

### Step 5: Refactor Main Component
- Import all extracted pieces
- Replace inline code with component calls
- Keep only orchestration and state management

### Step 6: Testing & Validation
- Test the confirmation flow end-to-end
- Verify all provider searches work
- Check field selection synchronization
- Validate form submission

## Expected Benefits
1. **Maintainability**: Smaller, focused components
2. **Reusability**: Extracted components can be reused
3. **Testing**: Easier to unit test individual pieces
4. **Performance**: Better code splitting and lazy loading
5. **Developer Experience**: Easier to understand and modify

## Success Metrics
- Main confirmationStep.tsx reduced from 7591 to <500 lines
- All extracted components <300 lines each
- Zero TypeScript errors
- All existing functionality preserved
- Improved load time due to code splitting