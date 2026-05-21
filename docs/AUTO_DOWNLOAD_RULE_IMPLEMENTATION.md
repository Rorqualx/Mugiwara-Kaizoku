# AutoDownloadRule Schema Implementation Plan

## Overview

This document provides a detailed implementation plan for migrating auto-download rules from Settings.metadata.autoDownloadRules (JSON) to a dedicated AutoDownloadRule database table.

## Current State

**Files Affected:**
- `src/server/queue/workers/autoDownloadWorker.ts` - Reads rules from Settings.metadata
- `src/server/queue/autoDownloadScheduler.ts` - Writes rules to Settings.metadata

**Current Data Structure (JSON):**
```typescript
// Stored in Settings.metadata.autoDownloadRules
{
  "[mangaId]": {
    enabled: boolean,
    lastChecked: string (ISO date),
    checkInterval: number (seconds),
    maxSize: number (MB),
    excludeGroups: string[],
    preferredGroups: string[]
  }
}
```

**Problems:**
1. ❌ Poor queryability (can't filter enabled rules without full table scan)
2. ❌ No type safety (JSON parsing required)
3. ❌ No referential integrity (mangaId not validated as FK)
4. ❌ Atomic updates difficult (read-modify-write pattern)
5. ❌ No indexes for performance
6. ❌ Complex migration when adding fields

---

## Proposed Schema

### Phase 1: Add AutoDownloadRule Model

**File:** `prisma/schema.prisma`

```prisma
model AutoDownloadRule {
  id              Int       @id @default(autoincrement())
  mangaId         Int       @unique
  enabled         Boolean   @default(true)
  lastChecked     DateTime?
  checkInterval   Int       @default(3600) // seconds
  maxSize         Int?                     // MB, null = no limit
  excludeGroups   String[]  @default([])
  preferredGroups String[]  @default([])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  manga           Manga     @relation(fields: [mangaId], references: [id], onDelete: Cascade)

  @@index([enabled])
  @@index([lastChecked])
  @@index([mangaId])
}
```

**Relationship to Manga:**
```prisma
// Add to Manga model
model Manga {
  // ... existing fields ...
  autoDownloadRule AutoDownloadRule?
}
```

### Phase 2: Create Migration Script

**File:** `src/server/services/config/autoDownloadMigration.ts`

```typescript
import { prisma } from '../../db';
import { logger } from '../../../utils/logger';

interface LegacyAutoDownloadRule {
  enabled: boolean;
  lastChecked: string;
  checkInterval: number;
  maxSize?: number;
  excludeGroups: string[];
  preferredGroups: string[];
}

export async function migrateAutoDownloadRules(): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const results = {
    migrated: 0,
    skipped: 0,
    errors: [] as string[]
  };

  try {
    // 1. Read legacy settings
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.metadata) {
      logger.info('No legacy auto-download rules to migrate');
      return results;
    }

    // 2. Parse metadata
    const metadata = typeof settings.metadata === 'string'
      ? JSON.parse(settings.metadata)
      : settings.metadata;

    const autoDownloadRules = metadata.autoDownloadRules as Record<
      string,
      LegacyAutoDownloadRule
    > || {};

    logger.info(
      `Found ${Object.keys(autoDownloadRules).length} auto-download rules to migrate`
    );

    // 3. Migrate each rule
    for (const [mangaIdStr, rule] of Object.entries(autoDownloadRules)) {
      const mangaId = parseInt(mangaIdStr, 10);

      if (isNaN(mangaId)) {
        results.errors.push(`Invalid manga ID: ${mangaIdStr}`);
        results.skipped++;
        continue;
      }

      try {
        // Verify manga exists
        const manga = await prisma.manga.findUnique({
          where: { id: mangaId }
        });

        if (!manga) {
          logger.warn(`Manga ${mangaId} not found, skipping auto-download rule`);
          results.skipped++;
          continue;
        }

        // Check if rule already exists
        const existing = await prisma.autoDownloadRule.findUnique({
          where: { mangaId }
        });

        if (existing) {
          logger.debug(`Auto-download rule for manga ${mangaId} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Create new rule
        await prisma.autoDownloadRule.create({
          data: {
            mangaId,
            enabled: rule.enabled ?? true,
            lastChecked: rule.lastChecked
              ? new Date(rule.lastChecked)
              : null,
            checkInterval: rule.checkInterval ?? 3600,
            maxSize: rule.maxSize ?? null,
            excludeGroups: rule.excludeGroups ?? [],
            preferredGroups: rule.preferredGroups ?? []
          }
        });

        results.migrated++;
        logger.debug(`Migrated auto-download rule for manga ${mangaId}`);
      } catch (error) {
        const errorMsg = `Failed to migrate rule for manga ${mangaId}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        logger.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    logger.info(
      `Auto-download migration complete: ${results.migrated} migrated, ` +
      `${results.skipped} skipped, ${results.errors.length} errors`
    );

    return results;
  } catch (error) {
    logger.error('Auto-download migration failed:', error);
    throw error;
  }
}
```

### Phase 3: Update ConfigService Integration

**File:** `src/server/services/config/configService.ts`

Add to migrations array:

```typescript
import { migrateAutoDownloadRules } from './autoDownloadMigration';

// In ConfigService.runMigrations()
const migrationFunctions = [
  // ... existing migrations ...
  migrateAutoDownloadRules
];
```

### Phase 4: Update Worker Files

#### Update autoDownloadScheduler.ts

**Before:**
```typescript
// Read from Settings.metadata
const settings = await prisma.settings.findFirst();
const metadata = JSON.parse(settings.metadata);
const rules = metadata.autoDownloadRules || {};

// Create/update rule
rules[mangaId] = {
  enabled: true,
  checkInterval: 3600,
  // ...
};

await prisma.settings.update({
  where: { id: settings.id },
  data: { metadata: JSON.stringify(metadata) }
});
```

**After:**
```typescript
// Use AutoDownloadRule table
const existingRule = await prisma.autoDownloadRule.findUnique({
  where: { mangaId }
});

if (existingRule) {
  await prisma.autoDownloadRule.update({
    where: { mangaId },
    data: {
      enabled: true,
      checkInterval: 3600,
      // ...
    }
  });
} else {
  await prisma.autoDownloadRule.create({
    data: {
      mangaId,
      enabled: true,
      checkInterval: 3600,
      // ...
    }
  });
}
```

#### Update autoDownloadWorker.ts

**Before:**
```typescript
// Read all rules from Settings.metadata
const settings = await prisma.settings.findFirst();
const metadata = JSON.parse(settings.metadata);
const allRules = metadata.autoDownloadRules || {};

// Filter enabled rules
const enabledMangaIds = Object.entries(allRules)
  .filter(([_, rule]) => rule.enabled)
  .map(([mangaId, _]) => parseInt(mangaId));
```

**After:**
```typescript
// Query enabled rules directly
const enabledRules = await prisma.autoDownloadRule.findMany({
  where: { enabled: true },
  include: { manga: true }
});

// Process rules
for (const rule of enabledRules) {
  // Check if it's time to download
  const shouldCheck = !rule.lastChecked ||
    (Date.now() - rule.lastChecked.getTime()) >= rule.checkInterval * 1000;

  if (shouldCheck) {
    await processAutoDownload(rule);
  }
}

async function processAutoDownload(rule: AutoDownloadRule) {
  // Implementation here

  // Update lastChecked
  await prisma.autoDownloadRule.update({
    where: { id: rule.id },
    data: { lastChecked: new Date() }
  });
}
```

### Phase 5: Update Router Endpoints

**File:** `src/server/trpc/routers/manga.ts`

#### Endpoint: configureAutoDownload

**Before:**
```typescript
configureAutoDownload: protectedProcedure
  .input(z.object({
    mangaId: z.number(),
    enabled: z.boolean(),
    // ...
  }))
  .mutation(async ({ input }) => {
    const settings = await prisma.settings.findFirst();
    const metadata = JSON.parse(settings.metadata);

    metadata.autoDownloadRules = metadata.autoDownloadRules || {};
    metadata.autoDownloadRules[input.mangaId] = {
      enabled: input.enabled,
      // ...
    };

    await prisma.settings.update({
      where: { id: settings.id },
      data: { metadata: JSON.stringify(metadata) }
    });

    return { success: true };
  })
```

**After:**
```typescript
configureAutoDownload: protectedProcedure
  .input(z.object({
    mangaId: z.number(),
    enabled: z.boolean(),
    checkInterval: z.number().optional(),
    maxSize: z.number().optional(),
    excludeGroups: z.array(z.string()).optional(),
    preferredGroups: z.array(z.string()).optional()
  }))
  .mutation(async ({ input }) => {
    await prisma.autoDownloadRule.upsert({
      where: { mangaId: input.mangaId },
      create: {
        mangaId: input.mangaId,
        enabled: input.enabled,
        checkInterval: input.checkInterval ?? 3600,
        maxSize: input.maxSize,
        excludeGroups: input.excludeGroups ?? [],
        preferredGroups: input.preferredGroups ?? []
      },
      update: {
        enabled: input.enabled,
        ...(input.checkInterval && { checkInterval: input.checkInterval }),
        ...(input.maxSize !== undefined && { maxSize: input.maxSize }),
        ...(input.excludeGroups && { excludeGroups: input.excludeGroups }),
        ...(input.preferredGroups && { preferredGroups: input.preferredGroups })
      }
    });

    return { success: true };
  })
```

#### Endpoint: getAutoDownloadConfig

**Before:**
```typescript
getAutoDownloadConfig: publicProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(async ({ input }) => {
    const settings = await prisma.settings.findFirst();
    const metadata = JSON.parse(settings.metadata);
    const rules = metadata.autoDownloadRules || {};

    return rules[input.mangaId] || null;
  })
```

**After:**
```typescript
getAutoDownloadConfig: publicProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(async ({ input }) => {
    const rule = await prisma.autoDownloadRule.findUnique({
      where: { mangaId: input.mangaId }
    });

    return rule;
  })
```

---

## Implementation Checklist

### Phase 1: Schema Setup
- [ ] Add AutoDownloadRule model to `prisma/schema.prisma`
- [ ] Add autoDownloadRule relation to Manga model
- [ ] Run `npx prisma migrate dev --name add-auto-download-rule`
- [ ] Run `npx prisma generate`

### Phase 2: Migration Script
- [ ] Create `src/server/services/config/autoDownloadMigration.ts`
- [ ] Implement `migrateAutoDownloadRules()` function
- [ ] Add unit tests for migration logic
- [ ] Add migration to ConfigService

### Phase 3: Update Worker Files
- [ ] Update `autoDownloadScheduler.ts` to use AutoDownloadRule table
- [ ] Update `autoDownloadWorker.ts` to query AutoDownloadRule table
- [ ] Add error handling for FK constraints
- [ ] Update logging to use rule IDs instead of metadata paths

### Phase 4: Update Router
- [ ] Update `manga.ts` configureAutoDownload endpoint
- [ ] Update `manga.ts` getAutoDownloadConfig endpoint
- [ ] Update input validation schemas
- [ ] Add endpoint to list all auto-download rules

### Phase 5: Testing
- [ ] Run type-check: `pnpm type-check`
- [ ] Test migration script with sample data
- [ ] Test worker functionality with new schema
- [ ] Test router endpoints
- [ ] Verify referential integrity (cascade deletes)

### Phase 6: Cleanup
- [ ] Remove Settings.metadata.autoDownloadRules references
- [ ] Update documentation
- [ ] Add schema comments for future developers

---

## Benefits After Migration

### Performance
- ✅ **Indexed queries:** O(1) lookups by mangaId, fast filtering by enabled status
- ✅ **No JSON parsing:** Direct column access
- ✅ **Optimized reads:** Only fetch needed columns with `select`

### Data Integrity
- ✅ **Foreign key constraints:** Cascade deletes when manga is removed
- ✅ **Type safety:** Prisma types instead of JSON parsing
- ✅ **Validation:** Database-level constraints

### Maintainability
- ✅ **Schema evolution:** Add columns with migrations, not JSON parsing logic
- ✅ **Atomic updates:** Update specific fields without read-modify-write
- ✅ **Better errors:** FK violations vs silent JSON errors

### Developer Experience
- ✅ **Autocomplete:** IDE support for rule properties
- ✅ **Type checking:** Compile-time validation
- ✅ **Debuggability:** Query actual table vs JSON field

---

## Rollback Plan

If issues arise during migration:

1. **Keep old JSON data:** Don't delete Settings.metadata.autoDownloadRules until verified
2. **Dual-write period:** Write to both table and JSON during testing
3. **Feature flag:** Use config flag to toggle between old/new system
4. **Backup:** Create database backup before migration

---

## Timeline Estimate

| Phase | Estimated Time | Difficulty |
|-------|---------------|-----------|
| Phase 1: Schema Setup | 30 minutes | Easy |
| Phase 2: Migration Script | 2 hours | Medium |
| Phase 3: Update Workers | 2 hours | Medium |
| Phase 4: Update Router | 1 hour | Easy |
| Phase 5: Testing | 2 hours | Medium |
| Phase 6: Cleanup | 30 minutes | Easy |
| **Total** | **8 hours** | **Medium** |

---

## Success Criteria

Migration is considered successful when:

1. ✅ All existing auto-download rules are migrated to new table
2. ✅ AutoDownloadWorker queries new table instead of Settings.metadata
3. ✅ AutoDownloadScheduler writes to new table
4. ✅ Router endpoints use Prisma queries instead of JSON parsing
5. ✅ Zero TypeScript errors
6. ✅ All tests passing
7. ✅ No references to Settings.metadata.autoDownloadRules remain in active code
8. ✅ Cascade deletes work when manga is removed
9. ✅ Performance improvement verified (query times reduced)

---

## References

- Original schema plan: `docs/SETTINGS_METADATA_SCHEMA_MIGRATION.md`
- Settings table analysis: `docs/SETTINGS_TABLE_ANALYSIS.md`
- Prisma migration docs: https://www.prisma.io/docs/concepts/components/prisma-migrate
