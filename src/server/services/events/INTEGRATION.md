# Events System Integration Guide

This document outlines how to integrate the new events system into existing services and components of the Kaizoku application.

## Overview

The new event system replaces the mock implementation with a real database-backed solution that tracks system activities across all components. This provides better observability, troubleshooting, and auditing capabilities.

## Key Components

1. **Event Service**: Core service for creating and retrieving events
2. **Event Logger**: Helper utility for simplified event logging
3. **Event Cleanup**: Scheduled task to remove old events
4. **Events Router**: tRPC API for client-side event access
5. **Events UI**: Updated user interface for viewing and filtering events

## Integration Steps

### 1. Library Service Integration

Update the Library service to log meaningful events throughout the library scanning process:

```typescript
// In library scanning function
import { eventLogger } from '@/server/services/events';
import { EventType } from '@/server/services/events';

async function scanLibrary(libraryId: string, path: string) {
  try {
    // Log scan start
    await eventLogger.logLibraryEvent(
      EventType.LIBRARY_SCAN_STARTED, 
      `Library scan started: ${libraryName}`,
      {
        libraryId,
        libraryName,
        details: { path }
      }
    );
    
    // Existing scanning logic...
    
    // Log scan completion
    await eventLogger.logLibraryEvent(
      EventType.LIBRARY_SCAN_COMPLETED,
      `Library scan completed: ${libraryName}`,
      {
        libraryId,
        libraryName,
        details: { 
          itemsFound: totalManga,
          newItems: newMangaCount,
          duration: scanDuration
        }
      }
    );
  } catch (error) {
    // Log scan error
    await eventLogger.logError(
      EventSource.LIBRARY,
      `Error scanning library: ${libraryName}`,
      error,
      {
        relatedEntityId: libraryId,
        relatedEntityType: 'library',
        additionalDetails: { path }
      }
    );
    throw error;
  }
}
```

### 2. Download Service Integration

Update the Download service to track download progress and completion:

```typescript
// In download manager
import { eventLogger } from '@/server/services/events';
import { EventType } from '@/server/services/events';

async function downloadManga(mangaId: string, mangaTitle: string) {
  try {
    // Log download start
    await eventLogger.logMangaEvent(
      EventType.DOWNLOAD_STARTED,
      `Download started: ${mangaTitle}`,
      {
        mangaId,
        mangaTitle,
        details: { source: sourceId }
      }
    );
    
    // Set up progress tracking
    const progressCallback = async (progress: number) => {
      if (progress % 10 === 0) { // Only log every 10% to avoid too many events
        await eventLogger.logDownloadEvent(
          EventType.DOWNLOAD_PROGRESS,
          `Download progress for ${mangaTitle}: ${progress}%`,
          {
            mangaId,
            mangaTitle,
            details: { progress, source: sourceId }
          }
        );
      }
    };
    
    // Existing download logic with progress callback...
    
    // Log download completion
    await eventLogger.logDownloadEvent(
      EventType.DOWNLOAD_COMPLETED,
      `Download completed: ${mangaTitle}`,
      {
        mangaId,
        mangaTitle,
        details: { chapters: downloadedChapters }
      }
    );
  } catch (error) {
    // Log download error
    await eventLogger.logError(
      EventSource.DOWNLOAD,
      `Error downloading manga: ${mangaTitle}`,
      error,
      {
        relatedEntityId: mangaId,
        relatedEntityType: 'manga',
        additionalDetails: { source: sourceId }
      }
    );
    throw error;
  }
}
```

### 3. Integration Service Updates

Update the integration services (AniList, MangaDex, etc.) to log connection status and errors:

```typescript
// In integration service
import { eventLogger } from '@/server/services/events';
import { EventType, EventSource } from '@/server/services/events';

async function connectToProvider(providerConfig: ProviderConfig) {
  try {
    // Existing connection logic...
    
    // Log successful connection
    await eventLogger.logEvent(
      EventType.INTEGRATION_CONNECTED,
      sourceName as EventSource, // Type casting for TypeScript
      `Connected to ${sourceName}`,
      {
        details: { 
          status: 'connected',
          configId: providerConfig.id
        }
      }
    );
    
    return connection;
  } catch (error) {
    // Log connection error
    await eventLogger.logError(
      sourceName as EventSource,
      `Failed to connect to ${sourceName}`,
      error
    );
    throw error;
  }
}
```

### 4. Task Manager Integration

Update the task manager to log task lifecycle events:

```typescript
// In task manager
import { eventLogger } from '@/server/services/events';
import { EventType } from '@/server/services/events';

async function executeTask(task: Task) {
  const startTime = Date.now();
  
  try {
    // Log task start
    await eventLogger.logTaskEvent(
      EventType.TASK_STARTED,
      `Task started: ${task.type}`,
      {
        taskId: task.id,
        taskType: task.type,
        details: { 
          scheduled: task.scheduled,
          priority: task.priority
        }
      }
    );
    
    // Existing task execution logic...
    
    // Calculate duration
    const duration = (Date.now() - startTime) / 1000; // in seconds
    
    // Log task completion
    await eventLogger.logTaskEvent(
      EventType.TASK_COMPLETED,
      `Task completed: ${task.type}`,
      {
        taskId: task.id,
        taskType: task.type,
        details: { 
          duration: duration.toFixed(2),
          result: result
        }
      }
    );
  } catch (error) {
    // Log task failure
    await eventLogger.logError(
      EventSource.TASK,
      `Task failed: ${task.type}`,
      error,
      {
        relatedEntityId: task.id,
        relatedEntityType: 'task',
        additionalDetails: { 
          type: task.type,
          retryCount: task.retryCount
        }
      }
    );
    
    // Existing error handling logic...
  }
}
```

### 5. Application Startup Integration

Update the application startup process to log system startup events:

```typescript
// In application startup file
import { eventLogger } from '@/server/services/events';
import { scheduleEventCleanup } from '@/server/services/events/cleanupTask';
import { seedEvents } from '@/server/services/events/seedEvents';

async function startApplication() {
  try {
    // Log application startup
    await eventLogger.logStartup({
      startupTime: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || 'unknown'
    });
    
    // Check if this is the first startup (no events exist)
    const { total } = await eventService.getEvents({}, 1, 1);
    if (total === 0) {
      // Seed initial events
      await seedEvents();
    }
    
    // Schedule event cleanup
    scheduleEventCleanup();
    
    // Continue with application startup...
  } catch (error) {
    console.error('Error during application startup:', error);
    process.exit(1);
  }
}
```

## Testing the Integration

After integrating with each service, perform the following tests:

1. Check that events are properly created in the database
2. Verify that the events UI displays the new events
3. Test filtering by various event types and sources
4. Confirm that error events include the proper error details
5. Validate that the cleanup task correctly removes old events

## Migration Considerations

During the transition period, both the old mock system and the new real system will operate in parallel. The compatibility layer in `eventEmitter.ts` ensures that components still using the old system continue to function while gradually migrating to the new system.

Once all components have been migrated to use the new `eventLogger`, the compatibility layer can be removed.
