# Events Page Full Solution Plan Final

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Events Page Full Solution Plan Final

---
# Events Page Navigation Issue - Final Solution Plan

## Executive Summary
The events page at `/system/events` experiences navigation freezing due to icon import issues, polling mechanism conflicts, and component lifecycle problems. This finalized plan provides a targeted, practical approach to resolve these issues.

## Problem Statement
- **Primary Issue**: Navigation freezes when leaving the events tab, requiring a page refresh
- **Root Causes Identified**: 
  1. Malformed icon imports with syntax errors
  2. Polling mechanism not properly cleaned up
  3. RingProgress component receiving invalid data
  4. Missing component cleanup on unmount

## Phase 1: Immediate Fixes (Already Implemented)

### ✅ 1.1 Fixed Icon Import Syntax
```typescript
// Fixed duplicate imports and syntax errors
import { 
  IconActivity,
  IconAlertTriangle,
  IconInfoCircle,
  IconExclamationCircle
} from '../../utils/tabler-icons-wrapper';
```

### ✅ 1.2 Added Component Cleanup
```typescript
// Added cleanup effect to EventsDashboard
useEffect(() => {
  return () => {
    setEventStats(DEFAULT_EVENT_STATS);
  };
}, []);
```

### ✅ 1.3 Fixed Percentage Calculations
```typescript
// Added NaN protection
const calculateLevelPercentage = (level: EventLevel): number => {
  if (!isValidEventLevel(level) || eventStats.total === 0) {
    return 0;
  }
  const percentage = (eventStats.byLevel[level] / eventStats.total) * 100;
  return isNaN(percentage) ? 0 : Math.max(0, Math.min(100, percentage));
};
```

### ✅ 1.4 Improved RingProgress Stability
```typescript
// Added key prop and filtered empty sections
<RingProgress
  key={`ring-${eventStats.total}`}
  sections={sections.filter(section => section.value > 0)}
/>
```

## Phase 2: Enhanced Cleanup and State Management (Priority)

### 2.1 Implement Comprehensive Cleanup Hook
```typescript
// File: src/hooks/useEventsDashboardCleanup.ts
import { useEffect, useRef } from 'react';

export function useEventsDashboardCleanup() {
  const cleanupRef = useRef<(() => void)[]>([]);
  
  const registerCleanup = (cleanup: () => void) => {
    cleanupRef.current.push(cleanup);
  };
  
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      });
      cleanupRef.current = [];
    };
  }, []);
  
  return { registerCleanup };
}
```

### 2.2 Fix Polling Lifecycle
```typescript
// Update useSystemEvents hook
export function useSystemEvents(options: UseSystemEventsOptions = {}): UseSystemEventsResult {
  const [isActive, setIsActive] = useState(true);
  
  useEffect(() => {
    return () => {
      setIsActive(false); // Stop polling on unmount
    };
  }, []);
  
  const { data, isLoading, error, refetch } = trpc.events.list.useQuery(
    queryParams,
    {
      refetchInterval: isActive ? pollingInterval : false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      enabled: isActive,
      staleTime: 5000,
      onError: (error) => {
        console.error('Events query error:', error);
      }
    }
  );
  
  // Manual cleanup for active queries
  useEffect(() => {
    return () => {
      // Cancel any in-flight requests
      trpc.events.list.cancel(queryParams);
    };
  }, []);
}
```

### 2.3 Optimize Component Mounting
```typescript
// In EventsDashboard.tsx
export function EventsDashboard(props: EventsDashboardProps): React.ReactElement {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Don't start polling until component is mounted
  const { events, isLoading, total } = useSystemEvents({
    ...props,
    pollingInterval: isMounted ? props.pollingInterval : 0
  });
  
  // Prevent state updates on unmounted component
  const safeSetState = useCallback((updater: any) => {
    if (isMounted) {
      setEventStats(updater);
    }
  }, [isMounted]);
}
```

## Phase 3: Navigation System Improvements

### 3.1 Add Navigation State Management
```typescript
// In SystemNavigation.tsx
export function SystemNavigation({ 
  disableLinks = false,
  activeTab,
  onTabChange 
}: SystemNavigationProps): React.ReactElement {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Track navigation state
  useEffect(() => {
    const handleStart = () => setIsNavigating(true);
    const handleComplete = () => setIsNavigating(false);
    
    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);
    
    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);
  
  // Disable interactions during navigation
  const handleTabClick = (e: React.MouseEvent, path: string) => {
    if (isNavigating) {
      e.preventDefault();
      return;
    }
    // Allow navigation
  };
}
```

### 3.2 Implement Safe Page Transitions
```typescript
// Create a wrapper for system pages
export function SystemPageWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    const handleRouteChange = () => {
      setIsTransitioning(true);
    };
    
    const handleRouteComplete = () => {
      setIsTransitioning(false);
    };
    
    router.events.on('routeChangeStart', handleRouteChange);
    router.events.on('routeChangeComplete', handleRouteComplete);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
      router.events.off('routeChangeComplete', handleRouteComplete);
    };
  }, [router]);
  
  if (isTransitioning) {
    return <LoadingOverlay />;
  }
  
  return <>{children}</>;
}
```

## Phase 4: Performance Monitoring

### 4.1 Add Performance Tracking
```typescript
// utils/performanceMonitor.ts
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  
  startMeasure(name: string) {
    this.marks.set(name, performance.now());
  }
  
  endMeasure(name: string): number {
    const start = this.marks.get(name);
    if (!start) return 0;
    
    const duration = performance.now() - start;
    this.marks.delete(name);
    
    if (duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${duration}ms`);
    }
    
    return duration;
  }
}

// Use in EventsDashboard
const perfMonitor = new PerformanceMonitor();

useEffect(() => {
  perfMonitor.startMeasure('events-mount');
  return () => {
    perfMonitor.endMeasure('events-mount');
  };
}, []);
```

### 4.2 Memory Leak Detection
```typescript
// In development only
if (process.env.NODE_ENV === 'development') {
  useEffect(() => {
    const checkMemoryUsage = () => {
      if (performance.memory) {
        const usedMB = performance.memory.usedJSHeapSize / 1048576;
        if (usedMB > 100) {
          console.warn(`High memory usage in Events page: ${usedMB.toFixed(2)}MB`);
        }
      }
    };
    
    const interval = setInterval(checkMemoryUsage, 10000);
    return () => clearInterval(interval);
  }, []);
}
```

## Phase 5: Testing Implementation

### 5.1 Navigation Test Suite
```typescript
// __tests__/system-navigation.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

describe('System Events Navigation', () => {
  it('should navigate away from events without freezing', async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      pathname: '/system/events',
      push,
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    });
    
    const { getByText } = render(<SystemLayout><EventsDashboard /></SystemLayout>);
    
    // Navigate to status
    fireEvent.click(getByText('Status'));
    
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/system/status');
    });
    
    // Component should unmount cleanly
    expect(() => {
      render(<div>New Page</div>);
    }).not.toThrow();
  });
});
```

### 5.2 Cleanup Test
```typescript
describe('EventsDashboard Cleanup', () => {
  it('should cleanup polling on unmount', () => {
    const { unmount } = render(<EventsDashboard />);
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
```

## Phase 6: Rollback Strategy

### 6.1 Quick Fix (If Issues Persist)
```typescript
// Disable polling temporarily
export function SafeEventsDashboard(props: EventsDashboardProps) {
  return (
    <EventsDashboard 
      {...props} 
      pollingInterval={0} // Disable polling
    />
  );
}
```

### 6.2 Emergency Fallback
```typescript
// Simple events view without complex components
export function FallbackEventsView() {
  const { events } = useSystemEvents({ pollingInterval: 0 });
  
  return (
    <Stack>
      <Title>System Events</Title>
      <Table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Level</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => (
            <tr key={event.id}>
              <td>{new Date(event.timestamp).toLocaleString()}</td>
              <td>{event.level}</td>
              <td>{event.message}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Stack>
  );
}
```

## Implementation Checklist

### Immediate Actions (Day 1)
- [x] Fix icon imports syntax
- [x] Add basic cleanup effects
- [x] Fix percentage calculations
- [x] Improve RingProgress stability
- [ ] Test navigation between all tabs
- [ ] Monitor browser console for errors

### Short-term (Days 2-3)
- [ ] Implement comprehensive cleanup hook
- [ ] Fix polling lifecycle
- [ ] Add navigation state management
- [ ] Implement performance monitoring
- [ ] Add memory leak detection

### Medium-term (Days 4-5)
- [ ] Create test suite
- [ ] Add error boundaries
- [ ] Implement safe page transitions
- [ ] Document the solution
- [ ] Deploy to staging

### Long-term (Week 2)
- [ ] Monitor production performance
- [ ] Gather user feedback
- [ ] Optimize based on metrics
- [ ] Consider architectural improvements

## Success Criteria

1. **Navigation Performance**
   - Tab switches complete in < 100ms
   - No page refresh required
   - Smooth transitions

2. **Memory Management**
   - No memory leaks detected
   - Stable memory usage over time
   - Proper cleanup on unmount

3. **User Experience**
   - Responsive UI during data loading
   - No freezing or hanging
   - Clear error messages

4. **Code Quality**
   - TypeScript errors resolved
   - Tests passing
   - Clean console output

## Monitoring Post-Implementation

1. **Error Tracking**: Monitor for any console errors
2. **Performance Metrics**: Track navigation timing
3. **User Reports**: Gather feedback on navigation experience
4. **Memory Usage**: Monitor heap size over extended use

## Conclusion

This plan addresses the specific issues identified in the events page navigation:
1. Syntax errors in imports (fixed)
2. Polling cleanup issues (enhanced)
3. Component lifecycle problems (improved)
4. Navigation state management (added)

The phased approach ensures immediate relief while building toward a robust long-term solution. The implementation is practical, testable, and includes fallback options if issues persist.