# Events Page Debug Guide

## Issue Summary
The events page at http://localhost:3000/system/events is not working properly - navigation gets stuck when accessing the page.

## Debug Steps Taken

### 1. Fixed Icon Import Issues
**Problem**: The EventsDashboard was importing from `tabler-icons-wrapper` without the .js extension
**Solution**: Updated imports to use `tabler-icons-wrapper.js`

### 2. Added TypeScript Definitions
**Problem**: TypeScript couldn't understand the JavaScript icon wrapper module
**Solution**: Created `tabler-icons-wrapper.d.ts` file with proper type definitions

### 3. Enhanced Error Handling
**Problem**: No error boundaries or loading states were preventing crashes
**Solution**: Added:
- Loading state display
- Error state display with icon
- Try-catch blocks in useEffect
- Null safety checks for event stats

### 4. Fixed Data Safety Issues
**Problem**: RingProgress component could receive invalid values
**Solution**: 
- Added NaN checks in percentage calculations
- Added fallback values for undefined event counts
- Filter out sections with 0% values

## Debugging Instructions

### 1. Check Browser Console
Open browser developer tools and check for:
```javascript
// Look for these types of errors:
- "Cannot read properties of undefined"
- "Module not found" errors
- React hook errors
- tRPC connection errors
```

### 2. Check Network Tab
Look for failed API calls:
- `/api/trpc/events.list` - Should return 200
- `/api/trpc/events.getEventTypes` - Should return 200
- `/api/trpc/events.getEventSources` - Should return 200
- `/api/trpc/events.getEventLevels` - Should return 200

### 3. Test in Isolation
Try creating a minimal test page:

```typescript
// src/pages/test-events.tsx
import { trpc } from '../utils/trpc-client/index';

export default function TestEvents() {
  const { data, error } = trpc.events.list.useQuery({
    page: 1,
    pageSize: 10
  });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return <div>Events loaded: {data?.total || 0}</div>;
}
```

### 4. Check Database
Verify the SystemEvent table exists:
```sql
-- Check if table exists
SELECT * FROM "SystemEvent" LIMIT 1;

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'SystemEvent';
```

### 5. Verify tRPC Router
Check that the events router is properly registered:
```typescript
// In src/server/trpc/router/index.ts
import { eventsRouter } from '../routers/events';

export const appRouter = router({
  // ... other routers
  events: eventsRouter, // Should be here
});
```

### 6. Test Event Creation
Try creating a test event:
```typescript
// In a server-side context
import { prisma } from '../lib/prisma';

await prisma.systemEvent.create({
  data: {
    type: 'system.test',
    source: 'system',
    level: 'info',
    message: 'Test event',
    details: {}
  }
});
```

## Common Issues and Solutions

### Issue: "Cannot read properties of undefined (reading 'list')"
**Cause**: tRPC events router not properly connected
**Solution**: Verify the router is imported and registered correctly

### Issue: Page freezes on navigation
**Cause**: Infinite re-rendering or polling issues
**Solution**: Check useEffect dependencies and polling intervals

### Issue: "Module not found: tabler-icons-wrapper"
**Cause**: TypeScript can't resolve the .js file
**Solution**: Use explicit .js extension in imports

### Issue: Empty event dashboard
**Cause**: No events in database or query filters too restrictive
**Solution**: Create some test events or check filter parameters

## Next Steps if Still Not Working

1. **Disable Polling Temporarily**
   Set `pollingInterval={0}` in EventsDashboard to disable auto-refresh

2. **Add More Logging**
   ```typescript
   console.log('Events data:', { events, isLoading, total });
   console.log('Event stats:', eventStats);
   ```

3. **Check React Query DevTools**
   Install React Query DevTools to inspect the query state

4. **Test with Mock Data**
   Replace the useSystemEvents hook with mock data temporarily

5. **Verify Prisma Schema**
   Ensure SystemEvent model matches the expected structure
