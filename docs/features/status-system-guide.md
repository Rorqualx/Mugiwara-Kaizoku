# Status System Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*  
*Date: August 30, 2025*

## Overview

This guide documents the three-tier status system used throughout Mugiwara-Kaizoku. The system separates concerns by using specific status enums for different aspects of manga management.

## ⚠️ BREAKING CHANGE NOTICE

As of August 30, 2025, the generic `MangaStatus` enum has been completely removed. All code must use the appropriate specific status enum.

---

## The Three Status Types

### 1. MangaPublicationStatus

**Purpose**: Represents the publication state of a manga from the publisher's perspective.

**Location**: `src/types/canonical/shared-types.ts`

```typescript
export enum MangaPublicationStatus {
  ONGOING = 'ONGOING',     // Currently being published
  ACTIVE = 'ACTIVE',        // Active but release schedule unclear
  COMPLETED = 'COMPLETED',  // Publication finished
  HIATUS = 'HIATUS',       // On temporary break
  CANCELLED = 'CANCELLED',  // Publication cancelled
  DELETED = 'DELETED',      // Removed/deleted by publisher
  ERROR = 'ERROR',          // Error retrieving status
  UNKNOWN = 'UNKNOWN',      // Status unknown
  PENDING = 'PENDING'       // Status pending determination
}

// Type for use in type annotations
export type MangaPublicationStatusValue = typeof MangaPublicationStatus[keyof typeof MangaPublicationStatus];
```

**When to Use**:
- Metadata from providers (AniList, ComicVine, etc.)
- Display publication status in UI
- Search and filter by publication state

### 2. MangaFileStatus

**Purpose**: Represents the processing/download state of manga files in the system.

**Location**: `src/types/canonical/status.types.ts`

```typescript
export enum MangaFileStatus {
  PENDING = 'PENDING',         // Waiting to be processed
  DOWNLOADING = 'DOWNLOADING',  // Currently downloading
  IMPORTING = 'IMPORTING',      // Being imported from file system
  PROCESSING = 'PROCESSING',    // Being processed (metadata extraction, etc.)
  COMPLETED = 'COMPLETED',      // Successfully processed and available
  FAILED = 'FAILED',           // Processing/download failed
  DELETED = 'DELETED',         // Files were deleted
  MISSING = 'MISSING',         // Files missing from expected location
  ERROR = 'ERROR'              // Processing error occurred
}

// Type for use in type annotations
export type MangaFileStatusValue = typeof MangaFileStatus[keyof typeof MangaFileStatus];
```

**When to Use**:
- Download queue management
- File system operations
- Processing pipeline status
- Error tracking for file operations

### 3. MangaLibraryStatus

**Purpose**: Represents how the user is tracking the manga in their library.

**Location**: `src/types/canonical/status.types.ts`

```typescript
export enum MangaLibraryStatus {
  ACTIVE = 'ACTIVE',               // Active in library, monitoring for updates
  ARCHIVED = 'ARCHIVED',           // Archived by user, not monitoring
  COMPLETED = 'COMPLETED',         // User marked as fully read
  DROPPED = 'DROPPED',             // User dropped the manga
  PLAN_TO_READ = 'PLAN_TO_READ',  // In user's reading list
  READING = 'READING',             // Currently reading
  ON_HOLD = 'ON_HOLD',            // Temporarily on hold
  DELETED = 'DELETED'              // Removed from library
}

// Type for use in type annotations
export type MangaLibraryStatusValue = typeof MangaLibraryStatus[keyof typeof MangaLibraryStatus];
```

**When to Use**:
- User library management
- Reading progress tracking
- Personal manga organization
- User statistics and analytics

---

## Usage Examples

### Importing Status Types

```typescript
// Import publication status for metadata operations
import { MangaPublicationStatus, MangaPublicationStatusValue } from '@/types/canonical/shared-types';

// Import file and library status
import { 
  MangaFileStatus, 
  MangaFileStatusValue,
  MangaLibraryStatus,
  MangaLibraryStatusValue 
} from '@/types/canonical/status.types';
```

### Using in Components

```typescript
// Component displaying publication status
function MangaStatusBadge({ status }: { status: MangaPublicationStatusValue }) {
  const statusColors: Record<MangaPublicationStatusValue, string> = {
    [MangaPublicationStatus.ONGOING]: 'blue',
    [MangaPublicationStatus.COMPLETED]: 'green',
    [MangaPublicationStatus.CANCELLED]: 'red',
    [MangaPublicationStatus.HIATUS]: 'yellow',
    // ... etc
  };
  
  return <Badge color={statusColors[status]}>{status}</Badge>;
}

// Component tracking download status
function DownloadProgress({ fileStatus }: { fileStatus: MangaFileStatusValue }) {
  switch (fileStatus) {
    case MangaFileStatus.DOWNLOADING:
      return <Spinner label="Downloading..." />;
    case MangaFileStatus.COMPLETED:
      return <CheckIcon color="green" />;
    case MangaFileStatus.FAILED:
      return <ErrorIcon color="red" />;
    // ... etc
  }
}
```

### Database Models

```typescript
interface MangaEntity {
  id: string;
  title: string;
  
  // Publication status from metadata
  publicationStatus: MangaPublicationStatusValue;
  
  // File processing status
  fileStatus: MangaFileStatusValue;
  
  // User's library status
  libraryStatus: MangaLibraryStatusValue;
  
  // ... other fields
}
```

### Status Mapping Functions

```typescript
import { normalizeStatus } from '@/types/canonical/manga.types';

// Convert provider status to canonical publication status
function mapProviderStatus(providerStatus: string): MangaPublicationStatusValue {
  return normalizeStatus(providerStatus);
}

// The normalizeStatus function handles common variations:
// - 'publishing', 'releasing', 'serializing' -> ONGOING
// - 'finished', 'ended', 'complete' -> COMPLETED
// - 'discontinued', 'canceled' -> CANCELLED
// - etc.
```

---

## Migration Guide

### From Old Code (MangaStatus) to New Code

```typescript
// ❌ OLD - DEPRECATED
import { MangaStatus, MangaStatusValue } from '@/types/canonical';

function getStatus(): MangaStatusValue {
  return MangaStatus.ONGOING;
}

// ✅ NEW - CORRECT
import { MangaPublicationStatus, MangaPublicationStatusValue } from '@/types/canonical/shared-types';

function getStatus(): MangaPublicationStatusValue {
  return MangaPublicationStatus.ONGOING;
}
```

### Type Annotations

```typescript
// ❌ OLD
const statusMap: Record<string, MangaStatus> = { ... };

// ✅ NEW
const statusMap: Record<string, MangaPublicationStatusValue> = { ... };
```

### Status Checks

```typescript
// ❌ OLD
if (manga.status === MangaStatus.COMPLETED) { ... }

// ✅ NEW
if (manga.publicationStatus === MangaPublicationStatus.COMPLETED) { ... }
```

---

## Common Patterns

### 1. Status Type Guards

```typescript
export function isPublicationOngoing(status: MangaPublicationStatusValue): boolean {
  return status === MangaPublicationStatus.ONGOING || 
         status === MangaPublicationStatus.ACTIVE;
}

export function isFileReady(status: MangaFileStatusValue): boolean {
  return status === MangaFileStatus.COMPLETED;
}

export function isInUserLibrary(status: MangaLibraryStatusValue): boolean {
  return status !== MangaLibraryStatus.DELETED;
}
```

### 2. Status Transitions

```typescript
// Valid file status transitions
const FILE_STATUS_TRANSITIONS: Record<MangaFileStatusValue, MangaFileStatusValue[]> = {
  [MangaFileStatus.PENDING]: [MangaFileStatus.DOWNLOADING, MangaFileStatus.FAILED],
  [MangaFileStatus.DOWNLOADING]: [MangaFileStatus.PROCESSING, MangaFileStatus.FAILED],
  [MangaFileStatus.PROCESSING]: [MangaFileStatus.COMPLETED, MangaFileStatus.FAILED],
  // ... etc
};

function canTransitionTo(
  current: MangaFileStatusValue, 
  target: MangaFileStatusValue
): boolean {
  return FILE_STATUS_TRANSITIONS[current]?.includes(target) ?? false;
}
```

### 3. Combined Status Logic

```typescript
interface MangaFullStatus {
  publication: MangaPublicationStatusValue;
  file: MangaFileStatusValue;
  library: MangaLibraryStatusValue;
}

function shouldDownloadChapters(status: MangaFullStatus): boolean {
  return (
    // Manga is still being published
    (status.publication === MangaPublicationStatus.ONGOING ||
     status.publication === MangaPublicationStatus.ACTIVE) &&
    // User is actively reading
    status.library === MangaLibraryStatus.READING &&
    // Files are ready
    status.file === MangaFileStatus.COMPLETED
  );
}
```

---

## Best Practices

1. **Always use the specific status enum** for the context
2. **Never mix status types** (e.g., don't assign FileStatus to PublicationStatus)
3. **Use type annotations** with the `*StatusValue` types for type safety
4. **Map external statuses** through normalization functions
5. **Document status transitions** in your business logic
6. **Use type guards** for runtime safety

---

## Troubleshooting

### TypeScript Error: "MangaStatus is not defined"

The generic `MangaStatus` has been removed. Update your imports:

```typescript
// Replace this:
import { MangaStatus } from '@/types/canonical';

// With this:
import { MangaPublicationStatus } from '@/types/canonical/shared-types';
```

### TypeScript Error: "Type 'MangaStatus' refers to a value"

You're using the enum as a type. Use the type alias instead:

```typescript
// ❌ Wrong
function processStatus(status: MangaPublicationStatus) { }

// ✅ Correct
function processStatus(status: MangaPublicationStatusValue) { }
```

### Runtime Error: Status value not recognized

Ensure you're using the correct status enum for the context and that external values are properly mapped through normalization functions.

---

## See Also

- [Type System Architecture](./type-system-architecture-standardization.md)
- [Migration Guide](./migration/status-migration-guide.md)
- [API Documentation](./api-documentation-standardized.md)

---

*Last Updated: August 30, 2025*  
*Next Review: September 30, 2025*