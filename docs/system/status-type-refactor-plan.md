# Status Type Refactoring Plan

## Current Problem

The codebase currently conflates different concepts under a single `MangaStatus` enum:

1. **Publication Status** - The actual publication status of the manga (ONGOING, COMPLETED, HIATUS, etc.)
2. **File/Processing Status** - The state of manga files in the system (PENDING, DOWNLOADING, FAILED, etc.)
3. **Client Status** - UI state representation (ACTIVE, ERROR, DELETED, etc.)

This creates confusion and type safety issues throughout the codebase.

## Current State Analysis

### 1. Database Schema (Prisma)
```prisma
// Current in schema.prisma - This is actually FILE STATUS
enum MangaStatus {
  PENDING    // File is pending processing
  ACTIVE     // File is actively being processed
  COMPLETED  // File processing completed
  ERROR      // File processing error
  DELETED    // File was deleted
}
```

### 2. TypeScript Types
```typescript
// In common.types.ts - This is PUBLICATION STATUS
export enum MangaStatus {
  ONGOING = 'ONGOING',           // Manga is still being published
  COMPLETED = 'COMPLETED',        // Manga publication finished
  CANCELLED = 'CANCELLED',        // Manga was cancelled
  HIATUS = 'HIATUS',            // Manga is on hiatus
  NOT_YET_PUBLISHED = 'NOT_YET_PUBLISHED',
  UNKNOWN = 'UNKNOWN'
}

// Also in common.types.ts - This is CLIENT/UI STATUS
export enum ClientMangaStatus {
  ACTIVE = 'ACTIVE',     // Active in library
  COMPLETED = 'COMPLETED', // User marked as complete
  PENDING = 'PENDING',    // Pending user action
  ERROR = 'ERROR',       // Error state
  DELETED = 'DELETED'    // Removed from library
}
```

## Proposed Solution

### 1. Create Clear, Purpose-Specific Enums

```typescript
// Publication status - How the manga is published
export enum MangaPublicationStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  HIATUS = 'HIATUS',
  NOT_YET_PUBLISHED = 'NOT_YET_PUBLISHED',
  UNKNOWN = 'UNKNOWN'
}

// File/Processing status - State of files in our system
export enum MangaFileStatus {
  PENDING = 'PENDING',        // Waiting to be processed
  DOWNLOADING = 'DOWNLOADING', // Currently downloading
  IMPORTING = 'IMPORTING',     // Being imported
  PROCESSING = 'PROCESSING',   // Being processed (metadata extraction, etc.)
  COMPLETED = 'COMPLETED',     // Successfully processed
  FAILED = 'FAILED',          // Processing failed
  DELETED = 'DELETED',        // Files deleted
  MISSING = 'MISSING'         // Files missing from expected location
}

// Library status - User's library management
export enum MangaLibraryStatus {
  ACTIVE = 'ACTIVE',         // Active in library
  ARCHIVED = 'ARCHIVED',     // Archived by user
  COMPLETED = 'COMPLETED',   // User marked as read/complete
  DROPPED = 'DROPPED',       // User dropped the manga
  PLAN_TO_READ = 'PLAN_TO_READ', // In reading list
  READING = 'READING'        // Currently reading
}

// Keep MangaStatus as alias for backward compatibility during migration
export type MangaStatus = MangaPublicationStatus;
```

### 2. Update Database Schema

```prisma
// Update schema.prisma
enum MangaPublicationStatus {
  ONGOING
  COMPLETED
  CANCELLED
  HIATUS
  NOT_YET_PUBLISHED
  UNKNOWN
}

enum MangaFileStatus {
  PENDING
  DOWNLOADING
  IMPORTING
  PROCESSING
  COMPLETED
  FAILED
  DELETED
  MISSING
}

enum MangaLibraryStatus {
  ACTIVE
  ARCHIVED
  COMPLETED
  DROPPED
  PLAN_TO_READ
  READING
}

model Manga {
  id                  String                  @id @default(cuid())
  publicationStatus   MangaPublicationStatus  @default(UNKNOWN)
  fileStatus         MangaFileStatus         @default(PENDING)
  libraryStatus      MangaLibraryStatus      @default(ACTIVE)
  // ... other fields
}
```

## Migration Strategy

### Phase 1: Add New Types (Non-Breaking)
1. Create new enum types in TypeScript
2. Add migration to add new columns to database
3. Keep existing `MangaStatus` as deprecated alias

### Phase 2: Update Usage Points
1. **Metadata Providers** → Use `MangaPublicationStatus`
2. **File Operations** → Use `MangaFileStatus`
3. **Library Management** → Use `MangaLibraryStatus`
4. **UI Components** → Use appropriate status based on context

### Phase 3: Data Migration
1. Migrate existing data to new columns
2. Map old status values to appropriate new enums
3. Maintain backward compatibility layer

### Phase 4: Remove Old Code
1. Remove deprecated `MangaStatus` column
2. Remove compatibility aliases
3. Update all imports

## Code Changes Required

### 1. Status Mapping Functions
```typescript
// src/utils/status-mapping.ts
export function mapToPublicationStatus(status: string): MangaPublicationStatus {
  // Map provider statuses to publication status
}

export function mapToFileStatus(status: string): MangaFileStatus {
  // Map processing statuses to file status
}

export function mapToLibraryStatus(status: string): MangaLibraryStatus {
  // Map user actions to library status
}

// Backward compatibility during migration
export function mapLegacyMangaStatus(status: string): {
  publication: MangaPublicationStatus;
  file: MangaFileStatus;
  library: MangaLibraryStatus;
} {
  // Intelligent mapping based on context
}
```

### 2. Update Components
```typescript
// Before
interface MangaCardProps {
  status: MangaStatus;
}

// After
interface MangaCardProps {
  publicationStatus: MangaPublicationStatus;
  fileStatus: MangaFileStatus;
  libraryStatus: MangaLibraryStatus;
}
```

### 3. Update API Responses
```typescript
// Before
interface MangaResponse {
  status: string;
}

// After
interface MangaResponse {
  publicationStatus: string;
  fileStatus: string;
  libraryStatus: string;
}
```

## Benefits

1. **Type Safety**: Clear distinction between different status concepts
2. **Maintainability**: Easier to understand what each status represents
3. **Extensibility**: Can add new statuses to specific enums without affecting others
4. **Accuracy**: No more confusion between "manga is completed" (publication) vs "download is completed" (file)

## Risks & Mitigation

1. **Breaking Changes**: Use phased migration with backward compatibility
2. **Data Migration**: Careful mapping of existing data with validation
3. **Third-party Integrations**: Maintain adapters for external systems

## Implementation Checklist

- [ ] Create new enum types in TypeScript
- [ ] Add database migration for new columns
- [ ] Update status mapping utilities
- [ ] Update metadata providers to use publication status
- [ ] Update download/file operations to use file status
- [ ] Update library management to use library status
- [ ] Update UI components with new props
- [ ] Create data migration script
- [ ] Update API documentation
- [ ] Add deprecation notices to old types
- [ ] Test backward compatibility
- [ ] Deploy with feature flag
- [ ] Monitor for issues
- [ ] Remove deprecated code in next major version

## Timeline

- **Week 1**: Create types and database schema
- **Week 2**: Update core utilities and services
- **Week 3**: Update UI components
- **Week 4**: Data migration and testing
- **Week 5**: Deploy and monitor
- **Week 6+**: Remove deprecated code

This refactoring will significantly improve code clarity and reduce bugs related to status confusion.