# Events Tab Quick Reference

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Events Tab Quick Reference

---
# Events Tab Navigation - Quick Reference

## Problem & Solution

**Issue**: Events tab freezes when navigating away
**Status**: ✅ FIXED

## Key Fixes Applied

### 1. Icon Import Fix
```diff
- import { IconActivity } from '../../utils/tabler-icons-wrapper';;
+ import { IconActivity } from '../../utils/tabler-icons-wrapper';
```

### 2. Polling Lifecycle
```typescript
// Only poll when component is mounted
pollingInterval: isMounted ? pollingInterval : 0
```

### 3. Safe State Updates
```typescript
// Check if mounted before updating state
if (isMounted) {
  setEventStats(calculateEventStats);
}
```

### 4. Cleanup on Unmount
```typescript
useEffect(() => {
  return () => {
    setIsActive(false); // Stop polling
    // Cancel queries
  };
}, []);
```

## Testing

1. Go to `/system/status`
2. Click "Events" tab
3. Click any other tab
4. Should navigate smoothly without refresh

## Debug Commands

```javascript
// Check performance in console
window.navigationPerfMonitor.logStats()

// View current stats
window.navigationPerfMonitor.getStats()
```

## If Issues Return

1. Check browser console for errors
2. Verify no duplicate icon imports
3. Ensure cleanup effects are running
4. Monitor memory usage in DevTools

## Related Files

- `src/components/events/EventsDashboard.tsx`
- `src/hooks/useSystemEvents.ts`
- `src/hooks/useEventsDashboardCleanup.ts`
- `src/utils/performanceMonitor.ts`

## Contact

If navigation issues persist, check:
- React Query cache settings
- Next.js router events
- Component error boundaries