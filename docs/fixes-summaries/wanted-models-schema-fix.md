# Wanted Models Schema Fix

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Wanted Models Schema Fix

---
# Wanted Models Schema Update

## Issue
The build was failing because the `wanted.ts` router was trying to use Prisma models that didn't exist in the schema:
- `prisma.wantedItem`
- `prisma.downloadHistory`
- `prisma.blocklist`

## Solution Applied
Added the missing enums and models to `prisma/schema.prisma`:

### Enums Added
- `WantedStatus` - Status for wanted items (PENDING, SEARCHING, FOUND, BLOCKED, DOWNLOADED, FAILED)
- `WantedPriority` - Priority levels (LOW, NORMAL, HIGH, CRITICAL)
- `DownloadHistoryStatus` - Download status (COMPLETED, FAILED, CANCELLED, PARTIAL)
- `BlocklistReason` - Blocklist reasons (MANUAL, QUALITY, LANGUAGE, SOURCE, DMCA, OTHER)

### Models Added
- `WantedItem` - Tracks manga/chapters wanted for download
- `DownloadHistory` - Historical record of all downloads
- `Blocklist` - Items blocked from downloading

## Implementation
All changes were made directly to the canonical `prisma/schema.prisma` file, following project rules.

## Next Steps
Run `pnpm build:clean` to regenerate the Prisma client and complete the build.

## Date
Fixed on: $(date)
