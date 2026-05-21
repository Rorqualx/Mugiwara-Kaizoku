# Suwayomi Download Api

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Suwayomi Download Api

---
# Suwayomi Download API

This document describes the streamlined Suwayomi integration that focuses on server-side functionality and download capabilities without the frontend components.

## Overview

The Suwayomi integration has been refactored to:

1. Remove the frontend components and UI dependencies
2. Focus on the core server functionality and download capabilities
3. Provide a clean API for downloading manga chapters
4. Improve error handling and resource management

## Architecture

The new implementation consists of three main components:

1. **SuwayomiClient**: A TypeScript client for communicating with the Suwayomi Server API
2. **SuwayomiService**: A service for managing the Suwayomi Server lifecycle
3. **SuwayomiDownloadManager**: A manager for handling downloads from Suwayomi

### SuwayomiClient

The `SuwayomiClient` is a TypeScript client that communicates with the Suwayomi Server API. It provides methods for:

- Searching for manga
- Getting manga details
- Getting chapters
- Downloading chapters
- Managing sources

```typescript
// Example usage
const client = new SuwayomiClient({ baseURL: 'http://localhost:4567' });

// Search for manga
const results = await client.searchManga('1', 'One Piece');

// Get manga details
const manga = await client.getManga('123');

// Get chapters
const chapters = await client.getChapters('123');

// Download a chapter
await client.downloadChapter('456');
```

### SuwayomiService

The `SuwayomiService` manages the Suwayomi Server lifecycle. It provides methods for:

- Starting and stopping the server
- Checking if the server is running
- Getting the server URL
- Getting available sources
- Installing and uninstalling sources

```typescript
// Example usage
const service = suwayomiService;

// Start the server
await service.startServer();

// Check if the server is running
const isRunning = await service.isServerRunning();

// Get available sources
const sources = await service.getAvailableSources();

// Get the client
const client = service.getClient();

// Get the download manager
const downloadManager = service.getDownloadManager();
```

### SuwayomiDownloadManager

The `SuwayomiDownloadManager` handles downloads from Suwayomi. It provides methods for:

- Queuing downloads
- Canceling downloads
- Getting download status
- Clearing the download queue

```typescript
// Example usage
const downloadManager = suwayomiService.getDownloadManager();

// Queue a download
const downloadId = await downloadManager.queueChapterDownload(
  '123', // mangaId
  '456', // chapterId
  'One Piece', // mangaTitle
  'Chapter 1', // chapterTitle
  1 // chapterNumber
);

// Get download status
const download = downloadManager.getDownload(downloadId);

// Cancel a download
await downloadManager.cancelDownload(downloadId);

// Clear all downloads
await downloadManager.clearDownloads();
```

## API Endpoints

The following tRPC endpoints are available for interacting with Suwayomi:

### Server Management

- `suwayomi.checkJava`: Check if Java is installed
- `suwayomi.isServerRunning`: Check if the server is running
- `suwayomi.startServer`: Start the server
- `suwayomi.stopServer`: Stop the server
- `suwayomi.installServer`: Install the server
- `suwayomi.updateConfig`: Update the server configuration

### Source Management

- `suwayomi.getSources`: Get available sources

### Manga and Chapter Management

- `suwayomi.searchManga`: Search for manga
- `suwayomi.getMangaDetails`: Get manga details
- `suwayomi.getChapters`: Get chapters for a manga

### Download Management

- `suwayomi.downloadChapter`: Download a chapter
- `suwayomi.cancelDownload`: Cancel a download
- `suwayomi.clearDownloads`: Clear all downloads
- `suwayomi.getDownloads`: Get all downloads
- `suwayomi.getDownload`: Get a specific download

## Integration with Source Provider

The Suwayomi integration is also available through the source provider system. The following methods are available:

- `getUnifiedSources`: Get unified sources from both Mangal and Suwayomi
- `toggleSource`: Toggle source enabled status
- `downloadChapter`: Download a chapter from a source

```typescript
// Example usage
import { downloadChapter } from '@/server/services/sources/suwayomiSourceProvider';

// Download a chapter
const result = await downloadChapter(
  'suwayomi', // sourceType
  '123', // mangaId
  '456', // chapterId
  'One Piece', // mangaTitle
  'Chapter 1', // chapterTitle
  1 // chapterNumber
);

if (result.success) {
  console.log(`Download started with ID: ${result.downloadId}`);
} else {
  console.error(`Download failed: ${result.error}`);
}
```

## Events

The `SuwayomiDownloadManager` emits the following events:

- `progress`: Emitted when download progress changes
- `complete`: Emitted when a download completes
- `error`: Emitted when a download errors
- `queue_updated`: Emitted when the download queue changes
- `status_changed`: Emitted when a download status changes

## Configuration

The Suwayomi integration can be configured through the settings system. The following settings are available:

- `suwayomiEnabled`: Enable or disable the Suwayomi integration
- `suwayomiServerPath`: Path to the Suwayomi server JAR file
- `suwayomiConfigPath`: Path to the Suwayomi configuration directory
- `suwayomiPort`: Port for the Suwayomi server
- `suwayomiSources`: List of enabled Suwayomi sources

## Error Handling

The new implementation includes improved error handling:

- All API methods return meaningful error messages
- The client includes automatic retries for transient errors
- The download manager tracks download status and errors
- All errors are logged for debugging

## Resource Management

The new implementation includes improved resource management:

- The server is automatically stopped when the application exits
- The download manager cleans up resources when stopped
- Downloads are properly canceled when the server stops
- Memory usage is optimized by using streams for downloads
