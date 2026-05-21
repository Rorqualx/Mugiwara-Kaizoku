# Metadata Structure Migration

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Metadata Structure Migration

---
# Metadata Structure Migration Guide

This document outlines the process for migrating all metadata in Kaizoku to the new standardized structure.

## Current Structure Issues

Currently, Kaizoku uses two different structures for storing integration metadata:

1. **Old Structure**: Integration settings stored directly at the metadata root level
   ```json
   {
     "comicvine": {
       "enabled": true,
       "settings": { "apiKey": "value" }
     },
     "anilist": {
       "enabled": true,
       "settings": { "tokens": {} }
     }
   }
   ```

2. **New Structure**: Integration settings stored under a `providers` object
   ```json
   {
     "providers": {
       "comicvine": {
         "enabled": true,
         "settings": { "apiKey": "value" }
       },
       "anilist": {
         "enabled": true,
         "settings": { "tokens": {} }
       }
     }
   }
   ```

This dual structure creates confusion, increases code complexity, and leads to UI issues like duplicate status indicators.

## Standardization Plan

### 1. Migration Script

Create a migration script to move all integration settings to the new structure:

```javascript
// scripts/migrate-metadata-structure.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateMetadataStructure() {
  console.log('Starting metadata structure migration...');
  
  // Get all settings records
  const settings = await prisma.settings.findMany();
  let migratedCount = 0;
  
  for (const setting of settings) {
    if (!setting.metadata) continue;
    
    // Parse metadata
    const metadata = typeof setting.metadata === 'string' 
      ? JSON.parse(setting.metadata) 
      : setting.metadata;
    
    // Check if migration is needed
    const needsMigration = 
      metadata.comicvine || 
      metadata.anilist || 
      metadata.mangadex || 
      metadata.fandom;
    
    if (!needsMigration) {
      console.log(`Setting ID ${setting.id} already using new structure.`);
      continue;
    }
    
    // Ensure providers object exists
    if (!metadata.providers) {
      metadata.providers = {};
    }
    
    // Migrate each integration
    const integrations = ['comicvine', 'anilist', 'mangadex', 'fandom'];
    for (const integration of integrations) {
      if (metadata[integration]) {
        // Copy to new structure
        metadata.providers[integration] = { ...metadata[integration] };
        // Delete old structure
        delete metadata[integration];
        console.log(`Migrated ${integration} settings for ID ${setting.id}`);
      }
    }
    
    // Save updated metadata
    await prisma.settings.update({
      where: { id: setting.id },
      data: { 
        metadata: typeof setting.metadata === 'string' 
          ? JSON.stringify(metadata) 
          : metadata 
      }
    });
    
    migratedCount++;
  }
  
  console.log(`Migration complete. Migrated ${migratedCount} settings records.`);
}

migrateMetadataStructure()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 2. Update API and Service Code

Modify all code that interacts with integration settings to use only the new structure:

#### Provider Services

```typescript
// Example for ComicVine service
class ComicVineService {
  constructor(metadata) {
    // Old approach (with fallback)
    // this.enabled = metadata.comicvine?.enabled || metadata.providers?.comicvine?.enabled || false;
    // this.apiKey = metadata.comicvine?.settings?.apiKey || metadata.providers?.comicvine?.settings?.apiKey;
    
    // New standardized approach
    this.enabled = metadata.providers?.comicvine?.enabled || false;
    this.apiKey = metadata.providers?.comicvine?.settings?.apiKey;
  }
}
```

#### Settings API

```typescript
// Example for updating ComicVine settings
updateComicVineSettings: procedure
  .input(z.object({
    enabled: z.boolean(),
    apiKey: z.string().optional()
  }))
  .mutation(async ({ ctx, input }) => {
    const { prisma } = ctx;
    const settings = await prisma.settings.findFirst();
    
    if (!settings) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Settings not found'
      });
    }
    
    const metadata = typeof settings.metadata === 'string'
      ? JSON.parse(settings.metadata)
      : settings.metadata || {};
    
    // Ensure providers object exists
    if (!metadata.providers) {
      metadata.providers = {};
    }
    
    // Update provider settings in new structure only
    metadata.providers.comicvine = {
      enabled: input.enabled,
      settings: {
        apiKey: input.apiKey || metadata.providers?.comicvine?.settings?.apiKey
      }
    };
    
    // Save updated metadata
    return prisma.settings.update({
      where: { id: settings.id },
      data: {
        metadata: JSON.stringify(metadata)
      }
    });
  })
```

### 3. Update UI Components

Update all UI components to read integration status from the new structure only:

```tsx
// Example for status indicators
const SystemStatusPage = () => {
  // ...
  
  return (
    <div>
      {/* ComicVine status */}
      <StatusBadge 
        status={
          metadata.providers?.comicvine?.enabled 
            ? 'enabled' 
            : 'disabled'
        } 
        label={
          metadata.providers?.comicvine?.enabled 
            ? 'Enabled' 
            : 'Disabled'
        }
      />
      
      {/* Other integration statuses */}
    </div>
  );
};
```

### 4. Testing the Migration

1. **Create backup**: Before running the migration script, create a database backup
2. **Run in development**: Test the migration in a development environment first
3. **Verify data integrity**: Check that all settings are correctly migrated
4. **Test UI components**: Ensure all UI components correctly display integration status
5. **Run integration tests**: Verify that all integrations work after migration

## Implementation Timeline

1. Create migration script and test in development (1 day)
2. Update service classes to use only new structure (1-2 days)
3. Update API endpoints to use only new structure (1-2 days)
4. Update UI components to read from new structure (1-2 days)
5. Final testing and verification (1 day)
6. Deploy to production with database backup (0.5 day)

## Rollback Plan

In case of issues:

1. Restore database from backup
2. Revert codebase changes
3. Investigate issues and develop a new migration approach

## Code Patterns to Look For and Replace

When cleaning up the codebase, search for these patterns that indicate old structure usage:

```typescript
// Pattern 1: Direct access to old structure
metadata.comicvine?.enabled
metadata.anilist?.settings
metadata.mangadex?.enabled

// Pattern 2: Fallback to old structure
metadata.providers?.comicvine?.enabled || metadata.comicvine?.enabled
metadata.providers?.anilist?.settings || metadata.anilist?.settings

// Pattern 3: Conditional checks for old structure
if (metadata.comicvine) { ... }
if (metadata.anilist?.enabled) { ... }
```

Replace with standardized access to new structure:

```typescript
// Standardized approach
metadata.providers?.comicvine?.enabled
metadata.providers?.anilist?.settings
metadata.providers?.mangadex?.enabled
```

By consistently using the new structure throughout the codebase, we'll eliminate confusion, reduce complexity, and prevent issues like duplicate status indicators.
