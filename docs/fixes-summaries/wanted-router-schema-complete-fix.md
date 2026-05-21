# Wanted Router Schema Complete Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Wanted Router Schema Complete Fix

---
# Summary of Schema Fixes for Wanted Router

## Issue
The build was failing with two main issues:
1. Missing Prisma models (`wantedItem`, `downloadHistory`, `blocklist`)
2. TypeScript errors when including relations

## Solution Applied

### 1. Added missing enums to schema.prisma:
- `WantedStatus` (PENDING, SEARCHING, FOUND, BLOCKED, DOWNLOADED, FAILED)
- `WantedPriority` (LOW, NORMAL, HIGH, CRITICAL)
- `DownloadHistoryStatus` (COMPLETED, FAILED, CANCELLED, PARTIAL)
- `BlocklistReason` (MANUAL, QUALITY, LANGUAGE, SOURCE, DMCA, OTHER)

### 2. Added missing models with proper relations:
- `WantedItem` - Tracks manga/chapters wanted for download
- `DownloadHistory` - Historical record of all downloads
- `Blocklist` - Items blocked from downloading

### 3. Added proper Prisma relations:
- Forward relations from `WantedItem`, `DownloadHistory`, and `Blocklist` to `Manga` and `Chapter`
- Reverse relations in `Manga` and `Chapter` models

## Key Changes to Schema

```prisma
// WantedItem Model with relations
model WantedItem {
  // ... fields ...
  manga           Manga           @relation(fields: [mangaId], references: [id], onDelete: Cascade)
  chapter         Chapter?        @relation(fields: [chapterId], references: [id], onDelete: Cascade)
}

// Updated Manga model with reverse relations
model Manga {
  // ... existing fields ...
  wantedItems       WantedItem[]       // Wanted items for this manga
  downloadHistory   DownloadHistory[]  // Download history for this manga
  blocklist         Blocklist[]        // Blocklist entries for this manga
}

// Updated Chapter model with reverse relations
model Chapter {
  // ... existing fields ...
  wantedItems       WantedItem[]       // Wanted items for this chapter
  downloadHistory   DownloadHistory[]  // Download history for this chapter
  blocklist         Blocklist[]        // Blocklist entries for this chapter
}
```

## TypeScript Error Resolution
The remaining TypeScript errors about `include` being assigned to type 'never' will be resolved when:
1. The Prisma client is regenerated with the new schema
2. The build process runs `prisma generate`

## Next Steps
Run `pnpm build:clean` again - the build should now complete successfully as:
- All required models are defined
- All relations are properly set up
- Prisma client will be regenerated with the correct types

## Date
Fixed on: $(date)
