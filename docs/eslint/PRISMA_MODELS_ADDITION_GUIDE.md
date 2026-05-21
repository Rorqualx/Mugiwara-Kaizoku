# Missing Prisma Models - Implementation Guide

**Status:** 🔴 CRITICAL - Required for no-unsafe-assignment remediation
**Created:** 2025-11-09
**Priority:** Phase 1 (Must complete before starting fixes)

---

## Executive Summary

**7 missing Prisma models** have been identified that are causing dynamic access patterns and `@ts-nocheck` suppressions across the codebase. Per project requirements, we will **add all models to schema.prisma** (no workarounds).

### Priority Levels

| Priority | Models | Impact | Files Affected |
|----------|--------|--------|----------------|
| 🔴 **CRITICAL** | 1 (PackDownload) | Blocking multi-volume downloads | 4 files |
| 🟡 **MEDIUM** | 2 (Metadata models) | Degraded features | 1 file |
| 🟢 **LOW** | 4 (ML models) | Disabled/future features | 1 file |

---

## Phase 1: CRITICAL - PackDownload Model

### Overview

The `PackDownload` model is **CRITICAL** and must be added immediately. It's actively used in 4 files with `@ts-nocheck` suppressions and dynamic Prisma access.

### Files Currently Broken

1. ✅ `/src/server/services/download/downloadMonitor.ts` - Has `@ts-nocheck`
2. ✅ `/src/server/services/download/downloadManager.ts` - Has `@ts-nocheck`
3. ✅ `/src/server/services/packImport/deduplication.ts` - Has `@ts-nocheck`
4. ✅ `/src/server/services/packImport/packImportService.ts` - Indirect usage

### Add to schema.prisma

**Location:** After the `KapowarrDownload` model (around line 220)

```prisma
model PackDownload {
  id                BigInt                   @id @default(autoincrement())
  releaseTitle      String                   // e.g., "One Piece Volume 1-5"
  volumeStart       Int?                     // null for series packs
  volumeEnd         Int?                     // null for series packs
  mangaId           Int
  jobId             BigInt                   // Foreign key to jobs table
  downloadId        String                   // Download client ID (Transmission, Deluge, etc.)
  clientType        String                   // 'transmission', 'deluge', 'sabnzbd', etc.
  indexer           String?                  // 'prowlarr', etc.
  protocol          String                   // 'torrent', 'usenet'
  status            PackDownloadStatus       @default(DOWNLOADING)
  fileSize          BigInt?                  // Total file size in bytes
  filePath          String?                  // Path to extracted files
  errorMessage      String?                  // Error details if failed
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  completedAt       DateTime?

  // Relations
  manga             Manga                    @relation(fields: [mangaId], references: [id], onDelete: Cascade)
  chapters          Chapter[]                // Chapters from this pack

  // Indexes for performance
  @@index([mangaId])
  @@index([status])
  @@index([downloadId])
  @@index([jobId])
  @@map("pack_download")
}

enum PackDownloadStatus {
  DOWNLOADING
  COMPLETED
  IMPORTING
  IMPORTED
  FAILED
  CANCELLED
}
```

### Update Chapter Model

**Location:** In the `Chapter` model (around line 87-120)

Add this field:
```prisma
model Chapter {
  // ... existing fields ...
  packDownloadId    BigInt?                  // Link to pack download

  // ... existing relations ...
  PackDownload      PackDownload?            @relation(fields: [packDownloadId], references: [id], onDelete: SetNull)

  // ... existing indexes ...
  @@index([packDownloadId])
}
```

### Migration Steps

```bash
# 1. Add models to schema.prisma
# 2. Generate migration
npx prisma migrate dev --name add_pack_download_model

# 3. Verify migration
npx prisma generate

# 4. Update TypeScript files
# Remove @ts-nocheck from:
# - src/server/services/download/downloadMonitor.ts
# - src/server/services/download/downloadManager.ts
# - src/server/services/packImport/deduplication.ts

# 5. Replace dynamic access with proper Prisma calls
# Example in downloadMonitor.ts line 376-400:
# ❌ Before: const prismaClientAny = this.prismaClient as unknown;
# ✅ After:  await this.prismaClient.packDownload.findFirst(...)
```

### Code Changes Required

**File:** `downloadMonitor.ts`

```typescript
// ❌ REMOVE (lines 376-400)
const prismaClientAny = this.prismaClient as unknown;
if (!isObject(prismaClientAny) || !hasProperty(prismaClientAny, 'packDownload')) {
  logger.warn('[DownloadMonitor] pack_download table not available');
  return;
}
const packDownloadTable = prismaClientAny['packDownload'];
const findFirstMethod = packDownloadTable['findFirst'];
const packDownloadResult = await findFirstMethod({...}) as unknown;

// ✅ ADD
const packDownload = await this.prismaClient.packDownload.findFirst({
  where: {
    downloadId,
    jobId
  }
});

if (!packDownload) {
  logger.error(`[DownloadMonitor] PackDownload not found`, { downloadId, jobId });
  return;
}
```

**File:** `deduplication.ts`

```typescript
// ❌ REMOVE @ts-nocheck directive from line 1

// Code already attempts to use proper access (line 37):
// This will work once model is added
const existingPacks = await this.prismaClient.packDownload.findMany({
  where: { mangaId, status: { in: ['DOWNLOADING', 'COMPLETED'] } }
});
```

### Validation

After adding the model:

```bash
# 1. TypeScript compilation
npx tsc --noEmit
# Expected: No errors in download/pack files

# 2. ESLint
npx eslint src/server/services/download/ src/server/services/packImport/
# Expected: Reduced no-unsafe-assignment violations

# 3. Run affected services
npm run dev
# Test: Multi-volume pack downloads should work
```

---

## Phase 2: MEDIUM - Metadata Management Models

### Overview

These models enable advanced metadata conflict resolution and provider preferences. Currently using graceful degradation (returns empty arrays).

### 1. MetadataFieldPreference Model

**Location:** After `Metadata` model (around line 370)

```prisma
model MetadataFieldPreference {
  id              Int                      @id @default(autoincrement())
  fieldName       String                   // e.g., "title", "author", "description"
  providerId      String                   // e.g., "anilist", "myanimelist", "mangadex"
  priority        Int                      @default(1)  // Higher = preferred
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  @@unique([fieldName, providerId])
  @@index([priority])
  @@map("metadata_field_preference")
}
```

**Purpose:** Allows users/admins to specify which metadata provider to prefer for specific fields.

**Example:**
- "For `coverArt`, prefer `mangadex` (priority: 10)"
- "For `description`, prefer `anilist` (priority: 8)"

### 2. MetadataConflict Model

**Location:** After `MetadataFieldPreference` model

```prisma
model MetadataConflict {
  id                Int                  @id @default(autoincrement())
  mangaId           Int
  fieldName         String               // Field with conflicting values
  values            Json                 // { "anilist": "value1", "mal": "value2" }
  resolved          Boolean              @default(false)
  resolution        String?              // Which value was chosen
  resolutionProvider String?             // Which provider was selected
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  manga             Manga                @relation(fields: [mangaId], references: [id], onDelete: Cascade)

  @@index([mangaId])
  @@index([resolved])
  @@index([fieldName])
  @@map("metadata_conflict")
}
```

**Purpose:** Tracks when multiple metadata providers return different values for the same field.

**Example:**
```json
{
  "mangaId": 123,
  "fieldName": "publicationYear",
  "values": {
    "anilist": "2020",
    "myanimelist": "2019",
    "mangadex": "2020"
  },
  "resolved": false
}
```

### Update Manga Model

Add relation to `Chapter` model:

```prisma
model Manga {
  // ... existing fields ...

  // ... existing relations ...
  metadataConflicts MetadataConflict[]
}
```

### File to Update

**File:** `src/server/trpc/routers/metadata.ts`

Remove optional chaining (lines 97-116):

```typescript
// ❌ REMOVE ExtendedPrismaClient interface (lines 97-116)
interface ExtendedPrismaClient extends PrismaClient {
  metadataFieldPreference?: {
    findMany: (args?: unknown) => Promise<MetadataFieldPreference[]>;
    deleteMany: (args?: unknown) => Promise<{ count: number }>;
    create: (args: unknown) => Promise<MetadataFieldPreference>;
  };
  metadataConflict?: {
    findMany: (args?: unknown) => Promise<MetadataConflict[]>;
    findUnique: (args?: unknown) => Promise<MetadataConflict | null>;
    update: (args?: unknown) => Promise<MetadataConflict>;
  };
}

// ✅ Use regular PrismaClient (models now exist)
// All code can use: prisma.metadataFieldPreference.findMany(...)
```

### Migration Steps

```bash
# 1. Add models to schema.prisma
npx prisma migrate dev --name add_metadata_management_models

# 2. Generate types
npx prisma generate

# 3. Update metadata.ts
# Remove optional chaining, use direct access

# 4. Test conflict resolution
npm run dev
```

---

## Phase 3: LOW Priority - ML Pattern Recognition Models

### Overview

These models support machine learning-based metadata extraction pattern recognition. Currently **disabled** with in-memory fallback. Can be deferred to future release.

### Status

- **File:** `src/server/parsers/pattern-recognition/persistence/DatabasePatternStore.ts`
- **Current:** All code commented out (lines 53-134)
- **Fallback:** In-memory cache only
- **Priority:** Can be added later when ML features are ready

### Models to Add (Future)

#### 1. LearnedPattern

```prisma
model LearnedPattern {
  id              String                   @id @default(cuid())
  category        String                   // e.g., "title", "author", "chapter"
  signature       Json                     // Pattern signature
  selectors       String[]                 // CSS selectors or XPath
  features        Json                     // Feature extraction config
  featureVector   Float[]                  // ML feature vector
  confidence      Float                    // Confidence score (0-1)
  accuracy        Float                    @default(0)
  usageCount      Int                      @default(0)
  successCount    Int                      @default(0)
  failureCount    Int                      @default(0)
  lastSeen        DateTime
  version         Int                      @default(1)
  sourceUrls      String[]                 // URLs where pattern was learned
  metadata        Json                     @default("{}")
  isActive        Boolean                  @default(true)
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  variations      PatternVariation[]
  performance     PatternPerformance[]

  @@index([isActive])
  @@index([category])
  @@index([confidence])
  @@map("learned_pattern")
}
```

#### 2. PatternVariation

```prisma
model PatternVariation {
  id              String                   @id @default(cuid())
  patternId       String
  variant         Json                     // Variation details
  confidence      Float
  usageCount      Int                      @default(0)
  metadata        Json                     @default("{}")
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  pattern         LearnedPattern           @relation(fields: [patternId], references: [id], onDelete: Cascade)

  @@index([patternId])
  @@map("pattern_variation")
}
```

#### 3. PatternPerformance

```prisma
model PatternPerformance {
  id              String                   @id @default(cuid())
  patternId       String
  testResults     Json                     // Test result details
  accuracy        Float
  precision       Float
  recall          Float
  f1Score         Float
  testDate        DateTime
  metadata        Json                     @default("{}")
  createdAt       DateTime                 @default(now())

  pattern         LearnedPattern           @relation(fields: [patternId], references: [id], onDelete: Cascade)

  @@index([patternId])
  @@index([testDate])
  @@map("pattern_performance")
}
```

#### 4. MLModelWeight (Optional)

```prisma
model MLModelWeight {
  id              String                   @id @default(cuid())
  modelId         String                   // Model identifier
  layerName       String                   // Neural network layer
  weights         Float[]                  // Weight values
  biases          Float[]?                 // Bias values
  metadata        Json                     @default("{}")
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  @@index([modelId])
  @@map("ml_model_weight")
}
```

### When to Add

**Trigger conditions:**
- ML pattern recognition feature is prioritized
- In-memory cache becomes insufficient
- Need persistent pattern learning across restarts

**Not needed until:**
- Core no-unsafe-assignment violations fixed
- Phase 1 and 2 models added
- ML feature development begins

---

## Implementation Roadmap

### Step 1: Add CRITICAL Model (30 min)

```bash
# 1. Edit prisma/schema.prisma
# Add PackDownload model + enum
# Update Chapter model (add packDownloadId field)

# 2. Create migration
npx prisma migrate dev --name add_pack_download_model

# 3. Generate types
npx prisma generate

# 4. Verify
npx tsc --noEmit
```

### Step 2: Update Download Services (1-2h)

```bash
# 1. Remove @ts-nocheck from 3 files
# 2. Replace dynamic access with proper Prisma calls
# 3. Test multi-volume downloads
# 4. Commit changes
```

### Step 3: Add MEDIUM Models (15 min)

```bash
# 1. Edit prisma/schema.prisma
# Add MetadataFieldPreference model
# Add MetadataConflict model
# Update Manga model (add relation)

# 2. Create migration
npx prisma migrate dev --name add_metadata_management_models

# 3. Generate types
npx prisma generate
```

### Step 4: Update Metadata Router (30 min)

```bash
# 1. Remove ExtendedPrismaClient interface
# 2. Remove optional chaining
# 3. Update error handling
# 4. Test conflict resolution
# 5. Commit changes
```

### Step 5: Defer ML Models

```
# Document in backlog
# No action needed now
# Will add when ML features are ready
```

---

## Expected Impact

### Before

| Metric | Value |
|--------|-------|
| Files with `@ts-nocheck` | 3 |
| Dynamic Prisma access | 4 files |
| Broken features | Multi-volume packs |
| no-unsafe-assignment violations | ~50 (in affected files) |

### After Phase 1

| Metric | Value |
|--------|-------|
| Files with `@ts-nocheck` | 0 |
| Dynamic Prisma access | 0 files |
| Broken features | 0 |
| no-unsafe-assignment violations | ~20 (in affected files) |

### After Phase 2

| Metric | Value |
|--------|-------|
| Optional chaining for models | 0 |
| Metadata features | Fully functional |
| no-unsafe-assignment violations | 0 (in metadata router) |

---

## Validation Checklist

### Phase 1 (PackDownload)

- [ ] Model added to schema.prisma
- [ ] Enum added (PackDownloadStatus)
- [ ] Chapter model updated (packDownloadId field)
- [ ] Migration created and applied
- [ ] `npx prisma generate` succeeds
- [ ] `@ts-nocheck` removed from downloadMonitor.ts
- [ ] `@ts-nocheck` removed from downloadManager.ts
- [ ] `@ts-nocheck` removed from deduplication.ts
- [ ] Dynamic access code replaced
- [ ] TypeScript compiles without errors
- [ ] ESLint violations reduced
- [ ] Multi-volume pack download works

### Phase 2 (Metadata)

- [ ] MetadataFieldPreference model added
- [ ] MetadataConflict model added
- [ ] Manga model updated (relation)
- [ ] Migration created and applied
- [ ] `npx prisma generate` succeeds
- [ ] ExtendedPrismaClient interface removed
- [ ] Optional chaining removed
- [ ] TypeScript compiles without errors
- [ ] Conflict resolution works

### Phase 3 (ML - Future)

- [ ] Document requirements
- [ ] Add to backlog
- [ ] Defer until ML feature work begins

---

## Troubleshooting

### Migration Fails

```bash
# Reset and try again
npx prisma migrate reset
npx prisma migrate dev --name add_pack_download_model
```

### TypeScript Errors After Generation

```bash
# Regenerate Prisma client
npx prisma generate --force

# Clear build cache
rm -rf .next
rm -rf node_modules/.cache
```

### Foreign Key Constraint Errors

Check that:
- `Manga` table has records with IDs referenced
- `jobs` table exists (for PackDownload.jobId)
- Constraints use `onDelete: Cascade` or `onDelete: SetNull`

---

## References

- **Detailed Analysis:** `docs/eslint/MISSING_MODELS_FINDINGS.md` (from agent analysis)
- **Type Definitions:** `src/types/pack-download-types.ts`
- **Affected Files:** See "Files Currently Broken" sections above
- **Prisma Documentation:** https://www.prisma.io/docs/concepts/components/prisma-schema

---

## Document Metadata

**Version:** 1.0
**Created:** 2025-11-09
**Author:** Analysis Agent
**Status:** Ready for Implementation
**Canonical:** Yes

---

*This guide will be updated after each phase completion with actual results and any adjustments needed.*
