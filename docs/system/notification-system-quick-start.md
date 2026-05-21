# Notification System Quick Start

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Notification System Quick Start

---
# Quick Start Guide: Enhanced Notification System

## For Developers

### 1. Using the Unified Logger

Replace old logging with the unified logger:

```typescript
// OLD ❌
console.log('User logged in');
console.error('Login failed');

// NEW ✅
import { authLogger } from '@/utils/logging/unified-logger';

authLogger.info('User logged in', { userId, username });
authLogger.error('Login failed', { username, reason });
authLogger.critical('Suspicious activity', { failedAttempts: 10 }); // Auto-notifies!
```

### 2. Available Specialized Loggers

```typescript
import {
  systemLogger,    // System events
  authLogger,      // Authentication events  
  databaseLogger,  // Database operations
  metadataLogger,  // Metadata operations
  taskLogger,      // Background tasks
  downloadLogger   // Download operations
} from '@/utils/logging/unified-logger';
```

### 3. Sending Direct Notifications

```typescript
import { notificationService } from '@/services/notifications';

// Send a notification for a specific event
await notificationService.sendNotification(
  'manga_new_chapters',              // Event type
  'New chapters are available!',     // Message
  { mangaId: 123, chapterCount: 5 }  // Metadata
);
```

### 4. Creating Event-Driven Notifications

```typescript
import { EventType, EventLevel } from '@/server/services/events/eventTypes';

// Let the system map events to notifications automatically
await notificationService.handleSystemEvent(
  EventType.MANGA_UPDATED,
  EventLevel.INFO,
  EventSource.MANGA,
  'Manga metadata updated',
  { mangaId: 123, title: 'One Piece' }
);
```

## Available Notification Events

### Manga Events
- `manga_added` - New manga added to library
- `manga_updated` - Manga information updated
- `manga_deleted` - Manga removed from library
- `manga_metadata_updated` - Metadata refreshed
- `manga_new_chapters` - New chapters detected ⭐

### Download Events
- `chapter_downloaded` - Chapter successfully downloaded
- `download_started` - Download initiated
- `download_failed` - Download failed ⚠️
- `download_queued` - Added to download queue

### System Events
- `system_startup` - System started
- `system_shutdown` - System shutting down
- `system_error` - Critical error occurred 🚨
- `system_warning` - System warning
- `system_maintenance` - Maintenance mode

### Authentication Events
- `auth_login_success` - Successful login
- `auth_login_failed` - Failed login attempt ⚠️
- `auth_suspicious_activity` - Multiple failed attempts 🚨
- `auth_password_changed` - Password changed

### Task Events
- `task_created` - New task created
- `task_completed` - Task finished successfully
- `task_failed` - Task failed ⚠️

### And 25+ more events!

## Configuration Example

```typescript
// User's notification preferences
const userConfig = {
  // Which events to receive
  enabledEvents: [
    'manga_new_chapters',
    'download_failed',
    'system_error',
    'auth_suspicious_activity'
  ],
  
  // Minimum severity level
  severityFilter: [
    NotificationSeverity.WARNING,
    NotificationSeverity.ERROR,
    NotificationSeverity.CRITICAL
  ],
  
  // Provider settings
  providers: [
    { type: 'email', enabled: true },
    { type: 'discord', enabled: true }
  ]
};
```

## Best Practices

### 1. Use Appropriate Log Levels
```typescript
logger.debug('Detailed info for debugging');      // Won't notify
logger.info('Normal operation');                  // Won't notify
logger.warn('Something to watch');                // May notify
logger.error('Something went wrong');             // Will notify
logger.critical('System failure!');               // WILL NOTIFY!
```

### 2. Include Meaningful Context
```typescript
// BAD ❌
logger.error('Download failed');

// GOOD ✅
downloadLogger.error('Chapter download failed', {
  mangaId: 123,
  chapterId: 456,
  error: error.message,
  attemptNumber: 3
});
```

### 3. Use Event-Specific Loggers
```typescript
// Use the right logger for the context
authLogger.warn('Invalid login attempt', { username });
databaseLogger.error('Connection lost', { host, port });
taskLogger.info('Backup completed', { size, duration });
```

## Common Patterns

### Pattern 1: Try-Catch with Logging
```typescript
try {
  const result = await riskyOperation();
  logger.info('Operation successful', { result });
} catch (error) {
  logger.error('Operation failed', error);
  // Notification sent automatically for errors
}
```

### Pattern 2: Critical Operations
```typescript
// For operations that MUST succeed
if (!criticalResource) {
  systemLogger.critical('Critical resource unavailable', {
    resource: 'database',
    impact: 'System cannot function'
  });
  // User will be notified immediately!
}
```

### Pattern 3: Progress Tracking
```typescript
downloadLogger.info('Download started', { mangaId, totalChapters });
// ... download logic ...
downloadLogger.info('Download progress', { mangaId, completed: 5, total: 10 });
// ... more logic ...
downloadLogger.info('Download completed', { mangaId, duration });
```

## Migration Checklist

- [ ] Replace `console.log/error` with unified logger
- [ ] Add context objects to all log calls
- [ ] Use specialized loggers for different services
- [ ] Test critical error notifications
- [ ] Update error handlers to use logger
- [ ] Remove old notification code

## Troubleshooting

### Notifications not sending?
1. Check if event is enabled in user config
2. Verify severity level meets threshold
3. Ensure providers are configured
4. Check provider test results

### Too many notifications?
1. Adjust severity filter to ERROR/CRITICAL only
2. Disable verbose events (progress, started, etc.)
3. Use category filters

### TypeScript errors?
1. Import from correct paths
2. Use type guards for unknown errors
3. Check enhanced vs legacy event types

## Support

- See `docs/notification-system-enhancement-plan.md` for full details
- Check `docs/notification-system-implementation-summary.md` for architecture
- Example: `docs/examples/auth-service-with-notifications.ts`
