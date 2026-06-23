# Events System

The Kaizoku Events System provides a comprehensive solution for tracking and monitoring system activities across all components of the application. It replaces the previous mock implementation with a real database-backed system that offers improved observability, troubleshooting capabilities, and audit logging.

## Features

- Real-time event tracking across all system components
- Persistent storage in the database
- Flexible filtering by event type, source, severity, and time range
- Visual event monitoring dashboard
- Automated cleanup of old events
- Standardized event schema and logging patterns

## Event Types

Events are categorized by their type, which indicates the specific action or occurrence:

| Category   | Event Types                                                    |
|------------|----------------------------------------------------------------|
| System     | `system.startup`, `system.shutdown`, `system.error`            |
| Library    | `library.scan.started`, `library.scan.completed`, `library.scan.error` |
| Manga      | `manga.added`, `manga.updated`, `manga.deleted`, `manga.metadata.updated` |
| Download   | `download.started`, `download.progress`, `download.completed`, `download.error` |
| Integration| `integration.connected`, `integration.disconnected`, `integration.error` |
| User       | `user.login`, `user.logout`, `user.action`                     |
| Task       | `task.created`, `task.started`, `task.completed`, `task.failed`|
| Backup     | `backup.started`, `backup.completed`, `backup.failed`          |

## Event Sources

Events are associated with the component that generated them:

- `system` - Core system components
- `library` - Library management
- `manga` - Manga content management
- `download` - Download processes
- `anilist` - AniList integration
- `mangadex` - MangaDex integration
- `comicvine` - ComicVine integration
- `suwayomi` - Suwayomi integration
- `prowlarr` - Prowlarr integration
- `user` - User actions
- `task` - Task scheduler
- `backup` - Backup system
- `database` - Database operations
- `metadata` - Metadata management

## Severity Levels

Events have a severity level that indicates their importance:

- `debug` - Detailed information for debugging
- `info` - General informational messages
- `warning` - Potential issues that don't prevent operation
- `error` - Errors that may have affected operation
- `critical` - Severe errors that prevented normal operation

## Using the Events System

### Viewing Events

The Events page in the System section displays all system events with filtering options:

1. Navigate to System > Events
2. Use the filters to narrow down events by type, source, level, or date range
3. Click on an event to view detailed information

### Understanding Event Details

When viewing event details, you'll see:

- Message: A human-readable description of what happened
- Timestamp: When the event occurred
- Level: The severity level
- Source: The component that generated the event
- Type: The specific event type
- Details: Additional context and information about the event
- Related Entity: Associated item (manga, library, etc.) if applicable
- Error Information: For error events, detailed error data

### Event Retention

Events are automatically cleaned up after a configurable retention period (default: 30 days). You can manually clear old events using the "Clear Old Events" button on the Events page.

## For Developers

### Logging Events

Use the `eventLogger` to create new events:

```typescript
import { eventLogger } from '@/server/services/events';
import { EventType, EventSource } from '@/server/services/events';

// Log a basic event
await eventLogger.logEvent(
  EventType.MANGA_ADDED,
  EventSource.MANGA,
  'New manga added: One Piece',
  {
    details: {
      mangaTitle: 'One Piece',
      source: 'MangaDex'
    },
    relatedEntityId: '42',
    relatedEntityType: 'manga'
  }
);

// Log an error event
try {
  // Operation that might fail
} catch (error) {
  await eventLogger.logError(
    EventSource.DOWNLOAD,
    'Failed to download chapter',
    error,
    {
      relatedEntityId: mangaId,
      relatedEntityType: 'manga'
    }
  );
}
```

### Helper Methods

The `eventLogger` provides convenience methods for common event types:

- `logLibraryEvent()` - Library-related events
- `logMangaEvent()` - Manga-related events
- `logDownloadEvent()` - Download-related events
- `logTaskEvent()` - Task-related events
- `logStartup()` - System startup events
- `logError()` - Error events from any source

### Database Schema

Events are stored in the `SystemEvent` table with the following schema:

```prisma
model SystemEvent {
  id                String   @id
  timestamp         DateTime @default(now())
  type              String
  source            String
  level             String
  message           String
  details           Json?
  relatedEntityId   String?
  relatedEntityType String?
  userId            String?

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([level])
  @@index([relatedEntityId, relatedEntityType])
  @@index([source])
  @@index([timestamp])
  @@index([type])
  @@index([userId])
}
```

## Best Practices

1. **Be Concise**: Keep event messages short and descriptive
2. **Include Context**: Add relevant details to help understand what happened
3. **Link to Entities**: Connect events to related entities whenever possible
4. **Mind the Volume**: Avoid excessive event generation (e.g., for progress updates)
5. **Use Appropriate Levels**: Reserve error/critical levels for actual problems
6. **Include Actionable Data**: For error events, include enough information to diagnose the issue
