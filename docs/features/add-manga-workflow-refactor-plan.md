# Add Manga Workflow Refactoring Plan

## Executive Summary
This document outlines a comprehensive plan to refactor and improve the Add Manga workflow wizard in the Mugiwara-Kaizoku application. The refactoring aims to improve maintainability, performance, type safety, and user experience while preserving all existing functionality.

## Current State Analysis

### Components
- **form.tsx**: 500+ lines - Main orchestrator
- **searchStep.tsx**: 1500+ lines - Search functionality  
- **confirmationStep.tsx**: 6000+ lines - Metadata selection (needs most work)
- **UniversalImportWizard.tsx**: 800+ lines - Enhanced import

### Key Issues
1. Component size and complexity (especially confirmationStep)
2. Type definition duplication across components
3. Sequential API calls impacting performance
4. Inconsistent error handling and user feedback
5. Complex nested state management

## Implementation Plan

## Phase 1: Component Extraction (Week 1-2)

### 1.1 Extract Reusable Components from confirmationStep.tsx

#### FieldSelector Component
```typescript
// src/components/addManga/components/FieldSelector.tsx
interface FieldSelectorProps {
  fieldName: string;
  fieldLabel: string;
  options: FieldOption[];
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'select' | 'date' | 'number' | 'array';
  multiple?: boolean;
}

// Features:
- Unified dropdown for field selection
- Support for different data types
- Provider badge display
- Confidence score visualization
```

#### ProviderBadge Component  
```typescript
// src/components/addManga/components/ProviderBadge.tsx
interface ProviderBadgeProps {
  provider: string;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

// Features:
- Consistent provider color coding
- Optional confidence score display
- Reusable across all components
```

#### VolumeChapterTable Component
```typescript
// src/components/addManga/components/VolumeChapterTable.tsx
interface VolumeChapterTableProps {
  provider: string;
  volumeData: VolumeData[];
  chapterData: ChapterData[];
  onVolumeSelect?: (volume: VolumeData) => void;
  expandable?: boolean;
}

// Features:
- Cross-provider volume/chapter display
- Expandable rows for chapter details
- Color-coded provider badges
```

#### MetadataConfidenceDisplay Component
```typescript
// src/components/addManga/components/MetadataConfidenceDisplay.tsx
interface MetadataConfidenceDisplayProps {
  confidence: number;
  fields: Record<string, FieldConfidence>;
  compact?: boolean;
}

// Features:
- Visual confidence scoring
- Field-by-field breakdown
- Color-coded quality indicators
```

#### MetadataPreview Component
```typescript
// src/components/addManga/components/MetadataPreview.tsx
interface MetadataPreviewProps {
  metadata: MangaMetadata;
  fieldSelections: Record<string, FieldSelection>;
  showSources?: boolean;
}

// Features:
- Clean metadata preview
- Source attribution per field
- Collapsible sections
```

### 1.2 File Structure
```
src/components/addManga/
├── components/
│   ├── FieldSelector.tsx
│   ├── ProviderBadge.tsx
│   ├── VolumeChapterTable.tsx
│   ├── MetadataConfidenceDisplay.tsx
│   ├── MetadataPreview.tsx
│   ├── ProviderSearchResults.tsx
│   └── index.ts
├── steps/
│   ├── searchStep.tsx (refactored)
│   ├── confirmationStep.tsx (refactored)
│   └── index.ts
├── hooks/
│   ├── useMetadataSelection.ts
│   ├── useProviderEnhancement.ts
│   └── useVolumeChapterData.ts
├── utils/
│   ├── metadataHelpers.ts
│   ├── providerHelpers.ts
│   └── dateConverters.ts
└── types/
    └── addManga.types.ts

```

## Phase 2: Type Consolidation (Week 2)

### 2.1 Create Unified Type Definitions
```typescript
// src/types/addManga.types.ts

// Single source of truth for form types
export interface AddMangaFormValues {
  query: string;
  mangaTitle: string;
  mangaId: string;
  libraryId: number;
  source?: string;
  metadata?: MangaMetadata;
  fieldSelections?: FieldSelections;
  parsedVolumeData?: ParsedVolumeData;
}

// Unified search result type
export interface MangaSearchResult {
  id: string;
  title: string;
  source: string;
  provider: string;
  coverUrl?: string;
  description?: string;
  status?: MangaStatus;
  metadata: MangaMetadata;
  providerSpecific?: Record<string, any>;
  confidence?: number;
}

// Field selection types
export interface FieldSelection {
  source: string;
  value: any;
  confidence?: number;
}

export type FieldSelections = Record<string, FieldSelection>;

// Provider result types
export interface ProviderSearchResult {
  provider: string;
  results: MangaSearchResult[];
  error?: string;
  isLoading: boolean;
}
```

### 2.2 Migration Strategy
1. Create new unified types file
2. Update imports incrementally
3. Add type guards for backward compatibility
4. Remove duplicate definitions
5. Update documentation

## Phase 3: State Management Optimization (Week 3)

### 3.1 Implement useReducer for Complex State

```typescript
// src/components/addManga/hooks/useAddMangaState.ts

type AddMangaState = {
  currentStep: number;
  formValues: AddMangaFormValues;
  searchResults: Record<string, ProviderSearchResult>;
  selectedManga: MangaSearchResult | null;
  fieldSelections: FieldSelections;
  isLoading: boolean;
  errors: Record<string, string>;
};

type AddMangaAction = 
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_FORM'; payload: Partial<AddMangaFormValues> }
  | { type: 'SET_SEARCH_RESULTS'; payload: { provider: string; results: any[] } }
  | { type: 'SELECT_MANGA'; payload: MangaSearchResult }
  | { type: 'UPDATE_FIELD_SELECTION'; payload: { field: string; selection: FieldSelection } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: { key: string; error: string } };

function addMangaReducer(state: AddMangaState, action: AddMangaAction): AddMangaState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'UPDATE_FORM':
      return { ...state, formValues: { ...state.formValues, ...action.payload } };
    // ... other cases
  }
}
```

### 3.2 Custom Hooks for State Logic

```typescript
// src/components/addManga/hooks/useMetadataSelection.ts
export function useMetadataSelection(initialManga: MangaSearchResult) {
  const [fieldSelections, setFieldSelections] = useState<FieldSelections>({});
  
  const updateFieldSelection = useCallback((field: string, source: string, value: any) => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: { source, value }
    }));
  }, []);
  
  const getCompiledMetadata = useCallback(() => {
    // Compile metadata from field selections
    return compileMetadataFromSelections(fieldSelections);
  }, [fieldSelections]);
  
  return {
    fieldSelections,
    updateFieldSelection,
    getCompiledMetadata
  };
}
```

## Phase 4: Performance Optimization (Week 3-4)

### 4.1 Parallel Provider Fetching

```typescript
// src/components/addManga/hooks/useParallelProviderSearch.ts
export function useParallelProviderSearch(query: string, providers: string[]) {
  const [results, setResults] = useState<Record<string, ProviderSearchResult>>({});
  
  const search = useCallback(async () => {
    // Create parallel search promises
    const searchPromises = providers.map(provider => 
      searchProvider(query, provider).then(
        results => ({ provider, results, error: null }),
        error => ({ provider, results: [], error: error.message })
      )
    );
    
    // Execute all searches in parallel
    const providerResults = await Promise.allSettled(searchPromises);
    
    // Process results
    const resultsMap = providerResults.reduce((acc, result) => {
      if (result.status === 'fulfilled') {
        acc[result.value.provider] = result.value;
      }
      return acc;
    }, {} as Record<string, ProviderSearchResult>);
    
    setResults(resultsMap);
  }, [query, providers]);
  
  return { results, search };
}
```

### 4.2 Implement Request Batching

```typescript
// src/components/addManga/utils/batchRequests.ts
export class MetadataRequestBatcher {
  private queue: Array<{ id: string; resolver: (data: any) => void }> = [];
  private timeout: NodeJS.Timeout | null = null;
  
  async fetchMetadata(id: string): Promise<any> {
    return new Promise((resolve) => {
      this.queue.push({ id, resolver: resolve });
      this.scheduleBatch();
    });
  }
  
  private scheduleBatch() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.executeBatch();
    }, 50); // 50ms debounce
  }
  
  private async executeBatch() {
    const batch = [...this.queue];
    this.queue = [];
    this.timeout = null;
    
    if (batch.length === 0) return;
    
    // Fetch all metadata in one request
    const results = await trpc.metadata.batchFetch.mutate({
      ids: batch.map(item => item.id)
    });
    
    // Resolve individual promises
    batch.forEach((item, index) => {
      item.resolver(results[index]);
    });
  }
}
```

## Phase 5: Error Handling & UX Improvements (Week 4)

### 5.1 Enhanced Error Handling

```typescript
// src/components/addManga/hooks/useErrorHandler.ts
export function useErrorHandler() {
  const showError = useCallback((error: unknown, context?: string) => {
    const message = error instanceof Error ? error.message : String(error);
    
    notifications.show({
      title: context ? `Error in ${context}` : 'Error',
      message,
      color: 'red',
      icon: <IconX />,
      autoClose: 5000
    });
    
    logger.error(`[AddManga] ${context || 'Unknown context'}:`, error);
  }, []);
  
  const showSuccess = useCallback((message: string) => {
    notifications.show({
      title: 'Success',
      message,
      color: 'green',
      icon: <IconCheck />,
      autoClose: 3000
    });
  }, []);
  
  return { showError, showSuccess };
}
```

### 5.2 Loading State Management

```typescript
// src/components/addManga/components/LoadingOverlay.tsx
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  onCancel?: () => void;
}

export function LoadingOverlay({ visible, message, progress, onCancel }: LoadingOverlayProps) {
  if (!visible) return null;
  
  return (
    <Overlay>
      <Stack align="center" spacing="md">
        {progress !== undefined ? (
          <Progress value={progress} size="xl" radius="xl" />
        ) : (
          <Loader size="xl" />
        )}
        {message && <Text>{message}</Text>}
        {onCancel && (
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </Stack>
    </Overlay>
  );
}
```

### 5.3 User Feedback Components

```typescript
// src/components/addManga/components/ProviderStatus.tsx
interface ProviderStatusProps {
  providers: Record<string, ProviderSearchResult>;
}

export function ProviderStatus({ providers }: ProviderStatusProps) {
  return (
    <Group spacing="xs">
      {Object.entries(providers).map(([name, result]) => (
        <Badge
          key={name}
          color={result.error ? 'red' : result.isLoading ? 'yellow' : 'green'}
          leftSection={result.isLoading ? <Loader size="xs" /> : null}
        >
          {name}: {result.results.length} results
        </Badge>
      ))}
    </Group>
  );
}
```

## Phase 6: Caching Strategy (Week 5)

### 6.1 Implement React Query

```typescript
// src/components/addManga/hooks/useProviderSearchQuery.ts
import { useQuery, useQueries } from '@tanstack/react-query';

export function useProviderSearchQuery(query: string, provider: string) {
  return useQuery({
    queryKey: ['mangaSearch', provider, query],
    queryFn: () => searchProvider(query, provider),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!query && query.length > 2
  });
}

export function useMultiProviderSearch(query: string, providers: string[]) {
  return useQueries({
    queries: providers.map(provider => ({
      queryKey: ['mangaSearch', provider, query],
      queryFn: () => searchProvider(query, provider),
      staleTime: 5 * 60 * 1000,
      enabled: !!query && query.length > 2
    }))
  });
}
```

### 6.2 Metadata Cache Manager

```typescript
// src/components/addManga/utils/MetadataCache.ts
class MetadataCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxAge = 5 * 60 * 1000; // 5 minutes
  
  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear() {
    this.cache.clear();
  }
}

export const metadataCache = new MetadataCache();
```

## Implementation Timeline

### Week 1-2: Component Extraction
- [ ] Extract FieldSelector component
- [ ] Extract ProviderBadge component
- [ ] Extract VolumeChapterTable component
- [ ] Extract MetadataConfidenceDisplay component
- [ ] Extract MetadataPreview component
- [ ] Update confirmationStep to use new components
- [ ] Test extracted components

### Week 2: Type Consolidation
- [ ] Create unified types file
- [ ] Update all components to use unified types
- [ ] Remove duplicate type definitions
- [ ] Add type guards for compatibility
- [ ] Update TypeScript documentation

### Week 3: State Management
- [ ] Implement useReducer for complex state
- [ ] Create custom hooks for state logic
- [ ] Refactor components to use new state management
- [ ] Test state management changes

### Week 3-4: Performance
- [ ] Implement parallel provider fetching
- [ ] Add request batching for metadata
- [ ] Optimize re-renders with React.memo
- [ ] Add performance monitoring

### Week 4: Error Handling & UX
- [ ] Implement enhanced error handling
- [ ] Add user-facing notifications
- [ ] Create loading overlays
- [ ] Add provider status indicators
- [ ] Improve accessibility

### Week 5: Caching
- [ ] Set up React Query
- [ ] Implement search result caching
- [ ] Add metadata caching
- [ ] Create cache invalidation strategy
- [ ] Test caching behavior

## Testing Strategy

### Unit Tests
```typescript
// src/components/addManga/components/__tests__/FieldSelector.test.tsx
describe('FieldSelector', () => {
  it('should display all available options', () => {});
  it('should handle selection changes', () => {});
  it('should show provider badges', () => {});
  it('should display confidence scores', () => {});
});
```

### Integration Tests
```typescript
// src/components/addManga/__tests__/AddMangaWorkflow.test.tsx
describe('Add Manga Workflow', () => {
  it('should complete full workflow', () => {});
  it('should handle provider errors gracefully', () => {});
  it('should merge metadata correctly', () => {});
  it('should cache search results', () => {});
});
```

### E2E Tests
```typescript
// e2e/addManga.spec.ts
test('Add manga from search', async ({ page }) => {
  // Navigate to add manga
  // Search for manga
  // Select result
  // Configure metadata
  // Submit and verify
});
```

## Migration Strategy

### Backward Compatibility
1. Keep old components during transition
2. Use feature flags for gradual rollout
3. Maintain API compatibility
4. Provide migration guides

### Rollout Plan
1. **Phase 1**: Deploy extracted components (no breaking changes)
2. **Phase 2**: Update types gradually with compatibility layer
3. **Phase 3**: Enable new state management behind feature flag
4. **Phase 4**: Roll out performance improvements
5. **Phase 5**: Enable caching for all users
6. **Phase 6**: Remove old code and feature flags

## Success Metrics

### Performance
- Search response time < 2s (from 5s)
- Metadata merge time < 500ms (from 2s)
- Component render time < 100ms
- Memory usage reduced by 30%

### Code Quality
- Component size < 500 lines
- Test coverage > 80%
- TypeScript strict mode compliance
- Zero duplicate type definitions

### User Experience
- Error recovery rate > 95%
- User task completion > 90%
- Support tickets reduced by 40%
- User satisfaction score > 4.5/5

## Risk Mitigation

### Technical Risks
- **Risk**: Breaking existing functionality
  - **Mitigation**: Comprehensive test coverage, gradual rollout
  
- **Risk**: Performance regression
  - **Mitigation**: Performance monitoring, rollback capability

- **Risk**: Type incompatibilities
  - **Mitigation**: Compatibility layer, gradual migration

### Process Risks
- **Risk**: Timeline slippage
  - **Mitigation**: Phased approach, MVP for each phase

- **Risk**: Team coordination
  - **Mitigation**: Clear ownership, regular sync meetings

## Documentation Updates

### Developer Documentation
- Component API documentation
- Migration guides
- Architecture diagrams
- Best practices guide

### User Documentation
- Updated user guide
- Video tutorials
- FAQ updates
- Release notes

## Conclusion

This refactoring plan addresses all identified issues in the Add Manga workflow while maintaining backward compatibility and improving user experience. The phased approach allows for gradual implementation with minimal risk, and the comprehensive testing strategy ensures quality throughout the process.

The expected outcomes include:
- 50% reduction in component complexity
- 40% improvement in performance
- 80% reduction in type-related errors
- Significantly improved maintainability and developer experience

Next steps:
1. Review and approve plan
2. Assign team members to phases
3. Set up tracking and monitoring
4. Begin Phase 1 implementation