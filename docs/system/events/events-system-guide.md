# Events System Documentation

The events system provides a way to log and display important system events in the application. This document explains how to use the events system in your code.

## Overview

The events system consists of three main components:

1. **EventEmitter**: A utility that manages the event storage and provides functions to emit and retrieve events.
2. **SystemEvents Utilities**: Helper functions to emit specific types of events from different parts of the application.
3. **Events UI**: Components that display events in the UI, including the Events page and EventsPanel.

## Event Types

Events have the following properties:

- **id**: A unique identifier for the event
- **type**: The type of event (info, warning, error, success)
- **message**: The event message
- **timestamp**: When the event occurred
- **component**: The component that emitted the event

## How to Use

### Emitting Events

You can emit events in two ways:

#### 1. Using the EventEmitter directly

```typescript
import { emitEvent } from '@/utils/eventEmitter';

// Emit an event
emitEvent('info', 'Something happened', 'System');
```

#### 2. Using the SystemEvents utilities (recommended)

```typescript
import { logMangaAdded, logDownloadStarted } from '@/utils/systemEvents';

// Log a manga being added
logMangaAdded('One Piece', 'Main Library');

// Log a download starting
logDownloadStarted('Naruto', 'Chapter 700');
```

### Viewing Events

Events can be viewed in two places:

1. **Events Page**: Navigate to System > Events to see all events with filtering options.
2. **EventsPanel**: A component that shows active events in the UI.

## Available Event Utilities

The `systemEvents.ts` file provides many helper functions for common events:

### System Events

- `logSystemStartup()`
- `logSystemShutdown()`
- `logSystemError(error: string)`
- `logSystemWarning(warning: string)`
- `logSystemUpdate(version: string)`

### Database Events

- `logDatabaseConnection()`
- `logDatabaseError(error: string)`
- `logDatabaseBackup(path: string)`

### Library Events

- `logLibraryCreated(name: string)`
- `logLibraryDeleted(name: string)`
- `logLibraryUpdated(name: string)`
- `logLibraryScan(name: string)`
- `logLibraryScanComplete(name: string, count: number)`

### Manga Events

- `logMangaAdded(title: string, library: string)`
- `logMangaRemoved(title: string)`
- `logMangaUpdated(title: string)`
- `logMangaError(title: string, error: string)`

### Download Events

- `logDownloadStarted(title: string, chapter: string)`
- `logDownloadComplete(title: string, chapter: string)`
- `logDownloadError(title: string, chapter: string, error: string)`
- `logDownloadCancelled(title: string, chapter: string)`

### Integration Events

- `logIntegrationConnected(name: string)`
- `logIntegrationDisconnected(name: string)`
- `logIntegrationError(name: string, error: string)`

### Task Events

- `logTaskStarted(name: string)`
- `logTaskCompleted(name: string)`
- `logTaskFailed(name: string, error: string)`
- `logTaskScheduled(name: string, time: string)`

### Metadata Events

- `logMetadataRefresh(title: string)`
- `logMetadataRefreshComplete(count: number)`
- `logMetadataError(title: string, error: string)`

## Implementation Details

### In-Memory Storage

Currently, events are stored in memory and will be lost when the page is refreshed. In a future update, events could be persisted to a database or local storage.

### Event Limit

The system stores up to 100 events in memory to prevent excessive memory usage. Older events are automatically removed when new ones are added.

### Adding New Event Types

To add a new event type:

1. Add a new helper function to `systemEvents.ts`
2. Use the `emitEvent` function with the appropriate parameters
3. Use the new helper function in your code

## Example Usage

```typescript
import { 
  logMangaAdded, 
  logDownloadStarted, 
  logDownloadComplete 
} from '@/utils/systemEvents';

// When adding a new manga
function addManga(title: string, library: string) {
  // Add manga to database
  // ...
  
  // Log the event
  logMangaAdded(title, library);
}

// When downloading a chapter
async function downloadChapter(manga: string, chapter: string) {
  try {
    // Log download started
    logDownloadStarted(manga, chapter);
    
    // Download logic
    // ...
    
    // Log download completed
    logDownloadComplete(manga, chapter);
  } catch (error) {
    // Log download error
    logDownloadError(manga, chapter, error.message);
  }
}
