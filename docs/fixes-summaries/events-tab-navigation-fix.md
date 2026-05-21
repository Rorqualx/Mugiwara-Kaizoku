# Events Tab Navigation Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Events Tab Navigation Fix

---
# Events Tab Navigation Fix

## Issue
The events tab in the system navigation was getting stuck and required a page refresh to navigate away from it.

## Root Causes Identified

1. **Duplicate Icon Imports**: The EventsDashboard component had multiple duplicate imports of the same icons with extra semicolons, which could cause module loading issues.

2. **Invalid Import Comments**: The component had invalid `// @next/dynamic-imports` comments that don't correspond to any valid Next.js directive.

3. **RingProgress Component Issues**: The RingProgress component could receive NaN or invalid percentage values, potentially causing rendering freezes.

4. **Polling Configuration**: The tRPC query configuration for events polling wasn't optimized and might have been causing state management issues.

## Fixes Applied

### 1. Fixed Icon Imports
```typescript
// Before - Multiple duplicate imports with syntax errors
import { IconActivity } from '../../utils/tabler-icons-wrapper';;
import { IconAlertTriangle } from '../../utils/tabler-icons-wrapper';;
import { IconInfoCircle } from '../../utils/tabler-icons-wrapper';;
import { IconExclamationCircle } from '../../utils/tabler-icons-wrapper';;;

// After - Clean single import
import { 
  IconActivity,
  IconAlertTriangle,
  IconInfoCircle,
  IconExclamationCircle
} from '../../utils/tabler-icons-wrapper';
```

### 2. Added Cleanup Effect
Added a cleanup effect to ensure proper state cleanup when the component unmounts:
```typescript
useEffect(() => {
  return () => {
    // Cleanup any pending state updates
    setEventStats(DEFAULT_EVENT_STATS);
  };
}, []);
```

### 3. Enhanced Percentage Calculation
Added safety checks to prevent NaN values:
```typescript
const calculateLevelPercentage = (level: EventLevel): number => {
  if (!isValidEventLevel(level) || eventStats.total === 0) {
    return 0;
  }
  
  const percentage = (eventStats.byLevel[level] / eventStats.total) * 100;
  // Ensure percentage is a valid number and not NaN
  return isNaN(percentage) ? 0 : Math.max(0, Math.min(100, percentage));
};
```

### 4. Improved RingProgress Rendering
- Added filtering to only show sections with data: `.filter(section => section.value > 0)`
- Added a key prop to force proper re-rendering: `key={\`ring-\${eventStats.total}\`}`

### 5. Enhanced tRPC Query Configuration
```typescript
const { data, isLoading, error, refetch } = trpc.events.list.useQuery(queryParams, {
  refetchInterval: pollingInterval,
  refetchOnWindowFocus: false,
  refetchOnMount: true,
  enabled: true,
  staleTime: 5000, // Consider data stale after 5 seconds
});
```

## Testing the Fix

1. Navigate to `/system/status` or any other system tab
2. Click on the "Events" tab
3. Verify the events dashboard loads properly
4. Click on any other tab (e.g., "Status", "Backup", etc.)
5. Navigation should work smoothly without requiring a page refresh

## Additional Recommendations

1. **Monitor Performance**: Keep an eye on the browser's developer console for any errors when navigating between tabs.

2. **Consider Reducing Polling Interval**: The current default polling interval is 30 seconds for the dashboard and 10 seconds for the hook. Consider whether this frequency is necessary.

3. **Memory Profiling**: If issues persist, use the browser's memory profiler to check for memory leaks during navigation.

4. **Error Boundaries**: The SystemLayout already has an ErrorBoundary, which should catch any rendering errors.
