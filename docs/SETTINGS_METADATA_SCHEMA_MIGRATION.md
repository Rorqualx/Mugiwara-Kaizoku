# Settings.metadata Schema Migration Plan

## Overview

Several workers and services currently store complex per-entity configuration in the `Settings.metadata` JSON field. This document outlines the plan to migrate this data to dedicated database tables for better query performance, type safety, and data integrity.

## Current State

### Files Using Settings.metadata for Complex Data

1. **autoDownloadScheduler.ts** (lines 38-100)
2. **autoDownloadWorker.ts** (lines 61-73)

### Data Structures in Settings.metadata

```typescript
{
  autoDownloadRules: {
    [mangaId: number]: {
      enabled: boolean;
      lastChecked: string; // ISO timestamp
      checkInterval: number; // seconds
      maxSize?: number; // MB
      excludeGroups?: string[];
      preferredGroups?: string[];
    }
  }
}
```

## Proposed Schema

### New Table: AutoDownloadRule

```prisma
model AutoDownloadRule {
  id             Int      @id @default(autoincrement())
  mangaId        Int
  enabled        Boolean  @default(false)
  lastChecked    DateTime?
  checkInterval  Int      @default(3600)  // seconds, default 1 hour
  maxSize        Int?                      // MB
  excludeGroups  String[]  @default([])
  preferredGroups String[] @default([])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  manga          Manga    @relation(fields: [mangaId], references: [id], onDelete: Cascade)

  @@unique([mangaId])
  @@index([enabled])
  @@index([lastChecked])
}
```

### Benefits

1. **Type Safety**: Proper TypeScript types instead of dynamic JSON
2. **Query Performance**: Indexed fields for fast lookups
3. **Data Integrity**: Foreign key constraints ensure referential integrity
4. **Atomic Updates**: Update individual fields without reading/parsing entire JSON
5. **Migrations**: Schema changes via Prisma migrations instead of manual JSON manipulation

## Migration Strategy

### Phase 1: Add New Table (✅ Planned)

1. Add `AutoDownloadRule` model to `schema.prisma`
2. Run Prisma migration: `pnpm prisma migrate dev --name add-auto-download-rule`

### Phase 2: Data Migration Script

Create migration script:

```typescript
// scripts/migrate-auto-download-rules.ts
async function migrateAutoDownloadRules() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.metadata) return;

  const metadata = typeof settings.metadata === 'string'
    ? JSON.parse(settings.metadata)
    : settings.metadata;

  const autoDownloadRules = metadata.autoDownloadRules || {};

  for (const [mangaIdStr, rule] of Object.entries(autoDownloadRules)) {
    const mangaId = parseInt(mangaIdStr, 10);
    if (isNaN(mangaId)) continue;

    await prisma.autoDownloadRule.upsert({
      where: { mangaId },
      create: {
        mangaId,
        enabled: rule.enabled ?? false,
        lastChecked: rule.lastChecked ? new Date(rule.lastChecked) : null,
        checkInterval: rule.checkInterval ?? 3600,
        maxSize: rule.maxSize,
        excludeGroups: rule.excludeGroups || [],
        preferredGroups: rule.preferredGroups || []
      },
      update: {
        enabled: rule.enabled ?? false,
        lastChecked: rule.lastChecked ? new Date(rule.lastChecked) : null,
        checkInterval: rule.checkInterval ?? 3600,
        maxSize: rule.maxSize,
        excludeGroups: rule.excludeGroups || [],
        preferredGroups: rule.preferredGroups || []
      }
    });
  }

  console.log('Migration complete');
}
```

### Phase 3: Code Migration

**autoDownloadScheduler.ts changes:**

```typescript
// Before
const settings = await prisma.settings.findFirst();
const metadata = typeof settings.metadata === 'string'
  ? JSON.parse(settings.metadata)
  : settings.metadata;
const autoDownloadRules = metadata.autoDownloadRules || {};

// After
const rules = await prisma.autoDownloadRule.findMany({
  where: {
    enabled: true,
    OR: [
      { lastChecked: null },
      { lastChecked: { lt: new Date(Date.now() - checkInterval * 1000) } }
    ]
  },
  include: { manga: { select: { title: true } } }
});
```

**autoDownloadWorker.ts changes:**

```typescript
// Before
const settings = await prisma.settings.findFirst();
const metadata = typeof settings.metadata === 'string'
  ? JSON.parse(settings.metadata)
  : settings.metadata;
const rule = metadata.autoDownloadRules?.[mangaId];

// After
const rule = await prisma.autoDownloadRule.findUnique({
  where: { mangaId }
});
```

### Phase 4: Deprecation Period

1. Keep both systems running in parallel (table + Settings.metadata)
2. Write to both locations for backwards compatibility
3. Add deprecation warnings when accessing Settings.metadata
4. Monitor for any issues

### Phase 5: Remove Legacy Code

1. Remove Settings.metadata read/write code
2. Remove migration compatibility layer
3. Update documentation

## Implementation Timeline

- [ ] Phase 1: Add schema (1 day)
- [ ] Phase 2: Data migration script (1 day)
- [ ] Phase 3: Code migration (2 days)
- [ ] Phase 4: Deprecation period (1-2 weeks)
- [ ] Phase 5: Remove legacy code (1 day)

## Notes

### calendarSyncWorker.ts

**Status**: Already migrated ✅

The calendarSyncWorker checks provider enabled status via Settings.metadata.providers, but this is **already available in Config table**:

```typescript
// Current (lines 69-84)
const settings = await prisma.settings.findFirst();
const metadata = settings.metadata;
const providers = metadata.providers || {};
return providers[provider]?.enabled === true;

// Should migrate to:
const enabled = await getConfigBoolean(`${provider}.enabled`, false);
return enabled;
```

This is a simple migration similar to the other files we've already completed.

## Related Files

- `src/server/queue/autoDownloadScheduler.ts`
- `src/server/queue/workers/autoDownloadWorker.ts`
- `src/server/queue/workers/calendarSyncWorker.ts` (simple Config migration)
