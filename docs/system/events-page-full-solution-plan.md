# Events Page Full Solution Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Events Page Full Solution Plan

---
# Events Page Navigation Issue - Full Solution Plan

## Executive Summary
The events page at `/system/events` experiences navigation freezing, requiring a page refresh to leave the tab. This plan outlines a systematic approach to permanently resolve the issue while maintaining full functionality.

## Phase 1: Root Cause Analysis (Day 1)

### 1.1 Performance Profiling
- [ ] Use Chrome DevTools Performance tab to record navigation sequence
- [ ] Identify memory leaks using Heap Snapshot comparison
- [ ] Check for detached DOM nodes
- [ ] Monitor JavaScript heap size during navigation

### 1.2 Component Isolation Testing
- [ ] Test each component in isolation:
  - [ ] EventsDashboard without child components
  - [ ] RingProgress component alone
  - [ ] Table components separately
  - [ ] Icon components individually

### 1.3 Hook Analysis
- [ ] Profile useSystemEvents hook for:
  - [ ] Infinite re-renders
  - [ ] Memory retention
  - [ ] Cleanup execution
  - [ ] Polling lifecycle

### 1.4 Navigation System Analysis
- [ ] Trace SystemNavigation component behavior
- [ ] Check for route change listeners
- [ ] Verify cleanup of event listeners
- [ ] Test tab switching mechanism

## Phase 2: Immediate Fixes (Day 1-2)

### 2.1 Fix Module Resolution
```typescript
// Create proper module declaration
// File: src/utils/tabler-icons-wrapper.d.ts
declare module '*.js' {
  const content: any;
  export = content;
}

// Update tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "moduleResolution": "node"
  }
}
```

### 2.2 Implement Proper Cleanup
```typescript
// In EventsDashboard.tsx
useEffect(() => {
  const abortController = new AbortController();
  
  return () => {
    abortController.abort();
    // Cancel all pending requests
    // Clear all timers
    // Remove all event listeners
  };
}, []);
```

### 2.3 Fix Polling Mechanism
```typescript
// Replace setInterval with React Query's refetch
const { data, error, isLoading, refetch } = trpc.events.list.useQuery(
  queryParams,
  {
    refetchInterval: false, // Disable automatic refetch
    enabled: isActive, // Only fetch when tab is active
  }
);

// Manual polling with cleanup
useEffect(() => {
  if (!isActive || pollingInterval === 0) return;
  
  const timer = setInterval(() => {
    refetch();
  }, pollingInterval);
  
  return () => clearInterval(timer);
}, [isActive, pollingInterval, refetch]);
```

### 2.4 Optimize RingProgress Component
```typescript
// Memoize heavy calculations
const chartSections = useMemo(() => {
  if (eventStats.total === 0) return [];
  
  return Object.entries(eventStats.byLevel)
    .map(([level, count]) => ({
      value: (count / eventStats.total) * 100,
      color: getLevelColor(level),
      tooltip: `${level}: ${count}`
    }))
    .filter(section => section.value > 0);
}, [eventStats]);

// Use lazy loading for chart
const RingProgress = lazy(() => import('@mantine/core').then(m => ({ default: m.RingProgress })));
```

## Phase 3: Architecture Improvements (Day 2-3)

### 3.1 Implement Event-Driven Architecture
```typescript
// Create event bus for system events
class EventBus {
  private subscribers = new Map<string, Set<Function>>();
  
  subscribe(event: string, callback: Function) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(event)?.delete(callback);
    };
  }
  
  emit(event: string, data?: any) {
    this.subscribers.get(event)?.forEach(cb => cb(data));
  }
}

export const systemEventBus = new EventBus();
```

### 3.2 Create Dedicated Events Store
```typescript
// File: src/store/eventsStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface EventsStore {
  events: SystemEvent[];
  isLoading: boolean;
  error: Error | null;
  lastFetch: Date | null;
  
  // Actions
  setEvents: (events: SystemEvent[]) => void;
  addEvent: (event: SystemEvent) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  clearEvents: () => void;
}

export const useEventsStore = create<EventsStore>()(
  subscribeWithSelector((set) => ({
    events: [],
    isLoading: false,
    error: null,
    lastFetch: null,
    
    setEvents: (events) => set({ events, lastFetch: new Date() }),
    addEvent: (event) => set((state) => ({ 
      events: [event, ...state.events].slice(0, 1000) // Keep max 1000 events
    })),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearEvents: () => set({ events: [], lastFetch: null })
  }))
);
```

### 3.3 Implement Virtual Scrolling
```typescript
// For large event lists
import { VirtualList } from '@tanstack/react-virtual';

function EventList({ events }: { events: SystemEvent[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5
  });
  
  return (
    <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <EventRow 
            key={events[virtualItem.index].id}
            event={events[virtualItem.index]}
            style={{
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

## Phase 4: Performance Optimizations (Day 3-4)

### 4.1 Implement Code Splitting
```typescript
// Lazy load heavy components
const EventsDashboard = lazy(() => import('./EventsDashboard'));
const EventFilters = lazy(() => import('./EventFilters'));
const EventExport = lazy(() => import('./EventExport'));

// Route-based code splitting
const SystemEventsPage = lazy(() => import('../pages/system/events'));
```

### 4.2 Optimize Re-renders
```typescript
// Use React.memo for expensive components
export const EventCard = memo(({ event }: { event: SystemEvent }) => {
  return (
    <Card>
      {/* Event details */}
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.event.id === nextProps.event.id &&
         prevProps.event.updatedAt === nextProps.event.updatedAt;
});

// Use useMemo for expensive calculations
const eventStats = useMemo(() => 
  calculateEventStats(events), 
  [events]
);
```

### 4.3 Implement Request Debouncing
```typescript
// Debounce API calls
const debouncedFetch = useMemo(
  () => debounce((params) => {
    refetch(params);
  }, 300),
  [refetch]
);
```

### 4.4 Add Intersection Observer
```typescript
// Only render visible components
function useIntersectionObserver(ref: RefObject<Element>) {
  const [isIntersecting, setIntersecting] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting)
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [ref]);
  
  return isIntersecting;
}
```

## Phase 5: Testing Strategy (Day 4-5)

### 5.1 Unit Tests
```typescript
// EventsDashboard.test.tsx
describe('EventsDashboard', () => {
  it('should cleanup on unmount', () => {
    const { unmount } = render(<EventsDashboard />);
    const spy = jest.spyOn(window, 'clearInterval');
    unmount();
    expect(spy).toHaveBeenCalled();
  });
  
  it('should handle empty events', () => {
    const { getByText } = render(<EventsDashboard />);
    expect(getByText('No events found')).toBeInTheDocument();
  });
});
```

### 5.2 Integration Tests
```typescript
// Navigation.test.tsx
describe('System Navigation', () => {
  it('should switch tabs without freezing', async () => {
    const { getByText } = render(<SystemLayout />);
    
    // Navigate to events
    fireEvent.click(getByText('Events'));
    await waitFor(() => expect(getByText('Event Dashboard')).toBeInTheDocument());
    
    // Navigate away
    fireEvent.click(getByText('Status'));
    await waitFor(() => expect(getByText('System Status')).toBeInTheDocument());
  });
});
```

### 5.3 Performance Tests
```typescript
// Performance monitoring
function measureNavigationTime() {
  performance.mark('navigation-start');
  
  // Navigate to events tab
  navigateToEvents();
  
  performance.mark('navigation-end');
  performance.measure(
    'navigation-duration',
    'navigation-start',
    'navigation-end'
  );
  
  const measure = performance.getEntriesByName('navigation-duration')[0];
  expect(measure.duration).toBeLessThan(100); // Should be under 100ms
}
```

## Phase 6: Monitoring & Prevention (Ongoing)

### 6.1 Add Performance Monitoring
```typescript
// Monitor component performance
if (process.env.NODE_ENV === 'development') {
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  });
}
```

### 6.2 Implement Error Boundaries
```typescript
class EventsErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Events page error:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <EventsErrorFallback />;
    }
    return this.props.children;
  }
}
```

### 6.3 Add Memory Leak Detection
```typescript
// Development-only memory leak detector
if (process.env.NODE_ENV === 'development') {
  let memorySnapshots: number[] = [];
  
  setInterval(() => {
    if (performance.memory) {
      memorySnapshots.push(performance.memory.usedJSHeapSize);
      
      if (memorySnapshots.length > 10) {
        const recentAvg = memorySnapshots.slice(-5).reduce((a, b) => a + b) / 5;
        const oldAvg = memorySnapshots.slice(0, 5).reduce((a, b) => a + b) / 5;
        
        if (recentAvg > oldAvg * 1.5) {
          console.warn('Possible memory leak detected');
        }
        
        memorySnapshots = memorySnapshots.slice(-10);
      }
    }
  }, 5000);
}
```

## Implementation Timeline

### Week 1
- Day 1: Root cause analysis and immediate fixes
- Day 2-3: Architecture improvements
- Day 4-5: Performance optimizations and testing

### Week 2
- Day 1-2: Integration testing and bug fixes
- Day 3-4: Performance monitoring setup
- Day 5: Documentation and deployment

## Success Metrics

1. **Navigation Performance**
   - Tab switch time < 100ms
   - No memory leaks detected
   - Zero navigation freezes

2. **User Experience**
   - Smooth transitions between tabs
   - Responsive UI during data loading
   - Graceful error handling

3. **Code Quality**
   - 100% test coverage for critical paths
   - No TypeScript errors
   - Clean performance profile

## Rollback Plan

If issues persist after implementation:

1. **Immediate**: Switch to SafeEventsDashboard
2. **Short-term**: Disable problematic features
3. **Long-term**: Redesign events architecture

## Final Deliverables

1. Fully functional events page with all features
2. Comprehensive test suite
3. Performance monitoring dashboard
4. Technical documentation
5. Deployment guide

This plan ensures a systematic approach to permanently resolve the events page issue while improving overall system performance and maintainability.
