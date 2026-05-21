#!/bin/bash

# TRPC Router Consolidation Script
# Safely consolidates router and routers directories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OLD_DIR="$PROJECT_ROOT/src/server/trpc/router"
NEW_DIR="$PROJECT_ROOT/src/server/trpc/routers"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== TRPC Router Consolidation Script ===${NC}"
echo "Consolidating from router/ to routers/ directory"
echo ""

# Step 1: Copy unique files from router/ to routers/
echo -e "${GREEN}Step 1: Copying unique files from router/ to routers/${NC}"
echo "----------------------------------------"

UNIQUE_FILES=(
    "download.ts"
    "health.ts"
    "history.ts"
    "index.ts"
    "search.ts"
    "settings.ts"
    "suwayomi.ts"
    "sync.ts"
    "system.ts"
    "appRouter.ts"
)

for file in "${UNIQUE_FILES[@]}"; do
    if [ -f "$OLD_DIR/$file" ]; then
        echo -e "${YELLOW}Copying $file to routers/${NC}"
        cp "$OLD_DIR/$file" "$NEW_DIR/$file"
        echo -e "${GREEN}✓ Copied${NC}"
    fi
done

# Step 2: Handle files that exist in both directories
echo -e "\n${GREEN}Step 2: Handling duplicate files${NC}"
echo "----------------------------------------"

# For activity.ts, router version is used (84 lines vs 137)
echo -e "${YELLOW}Using router/activity.ts (currently imported)${NC}"
cp "$OLD_DIR/activity.ts" "$NEW_DIR/activity-current.ts"

# Keep the optimized version too
if [ -f "$OLD_DIR/activity.optimized.ts" ]; then
    echo -e "${YELLOW}Copying activity.optimized.ts${NC}"
    cp "$OLD_DIR/activity.optimized.ts" "$NEW_DIR/activity.optimized.ts"
fi

# For library.ts, check which one is imported
echo -e "${YELLOW}Keeping both library.ts versions temporarily${NC}"
cp "$OLD_DIR/library.ts" "$NEW_DIR/library-from-router.ts"

# For tasks.ts
echo -e "${YELLOW}Keeping both tasks.ts versions temporarily${NC}"
cp "$OLD_DIR/tasks.ts" "$NEW_DIR/tasks-from-router.ts"

# For events.ts
echo -e "${YELLOW}Keeping both events.ts versions temporarily${NC}"
cp "$OLD_DIR/events.ts" "$NEW_DIR/events-from-router.ts"

# Step 3: Update imports in appRouter.ts
echo -e "\n${GREEN}Step 3: Creating new consolidated appRouter${NC}"
echo "----------------------------------------"

cat > "$NEW_DIR/appRouter.ts" << 'EOF'
import { router, procedure } from '../trpc';
import { libraryRouter } from './library-from-router';
import { settingsRouter } from './settings';
import { tasksRouter } from './tasks-from-router';
import { systemRouter } from './system';
import { activityRouter } from './activity-current';
import { bulkRouter } from './bulk';
import { prisma } from '../../../lib/prisma';
import { Prisma } from '@prisma/client';
import { mangaRouter } from './manga';
import { eventsRouter } from './events-from-router';
import { metadataRouter } from './metadata';
import { kavitaRouter, komgaRouter } from './integrations';
import { usersRouter } from './users';
import { kapowarrRouter } from './kapowarr';
import { TaskStatus } from '../../../types/canonical/task.types';
import { downloadRouter } from './download';
import { syncRouter } from './sync';
import { suwayomiRouter } from './suwayomi';
import { searchRouter } from './search';
import { healthRouter } from './health';
import { configRouter } from './config';
import { backupRouter } from './backup';
import { notificationRouter } from './notifications';
import { integrationsRouter } from './integrations';
import { wantedRouter } from './wanted';
import { readerRouter } from './reader';
import { providerMatchingRouter } from './providerMatching';
import { calendarRouter } from './calendar';
import { releaseBlocklistRouter } from './releaseBlocklist';
import { apiRouter } from './api';
import { z } from 'zod';

// Define the type for chapters with included manga and metadata
type ChapterWithMangaMetadata = Prisma.ChapterGetPayload<{
  include: { manga: { select: { metadata: true } } };
}>;

// Helper function to format chapter data
function formatChapter(chapter: ChapterWithMangaMetadata) {
  return {
    id: chapter.id,
    title: chapter.title,
    fileName: chapter.fileName || null,
    size: chapter.size,
    mangaId: chapter.mangaId,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
    index: chapter.index,
    metadata: chapter.manga?.metadata || null,
  };
}

export const appRouter = router({
  // All routers now from routers/ directory
  manga: mangaRouter,
  settings: settingsRouter,
  library: libraryRouter,
  events: eventsRouter,
  tasks: tasksRouter,
  system: systemRouter,
  activity: activityRouter,
  users: usersRouter,
  metadata: metadataRouter,
  kapowarr: kapowarrRouter,
  bulk: bulkRouter,
  health: healthRouter,
  download: downloadRouter,
  sync: syncRouter,
  suwayomi: suwayomiRouter,
  search: searchRouter,
  config: configRouter,
  backup: backupRouter,
  notifications: notificationRouter,
  integrations: integrationsRouter,
  wanted: wantedRouter,
  reader: readerRouter,
  providerMatching: providerMatchingRouter,
  calendar: calendarRouter,
  releaseBlocklist: releaseBlocklistRouter,
  api: apiRouter,

  // Root procedures if any
  health: procedure.query(() => ({ status: 'ok', timestamp: new Date() })),
  
  // Add getLatestChapters procedure here if needed
  getLatestChapters: procedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 10;
      const chapters = await prisma.chapter.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { manga: { select: { metadata: true } } },
      });
      return chapters.map(formatChapter);
    }),
});

export type AppRouter = typeof appRouter;
EOF

echo -e "${GREEN}✓ Created consolidated appRouter.ts${NC}"

# Step 4: Update root.ts to use only routers directory
echo -e "\n${GREEN}Step 4: Updating root.ts imports${NC}"
echo "----------------------------------------"

cat > "$PROJECT_ROOT/src/server/trpc/root.ts" << 'EOF'
/**
 * Root Router Module
 * 
 * This module composes all sub-routers into a single application router.
 * Consolidated to use only the routers/ directory.
 */

import { router } from './trpc';
import { appRouter as fullAppRouter } from './routers/appRouter';

/**
 * Main application router
 * Uses the consolidated appRouter from routers/ directory
 */
export const appRouter = fullAppRouter;

/**
 * Type definition for the application router
 */
export type AppRouter = typeof appRouter;
EOF

echo -e "${GREEN}✓ Updated root.ts${NC}"

# Step 5: Create migration report
echo -e "\n${GREEN}Step 5: Creating migration report${NC}"
echo "----------------------------------------"

cat > "$PROJECT_ROOT/docs/trpc-router-consolidation.md" << EOF
# TRPC Router Consolidation Report

*Generated: $(date)*
*Status: Active*

## Migration Summary

Successfully consolidated TRPC routers from two directories to one.

### Files Migrated from router/ to routers/

#### Unique Files (Direct Copy)
- download.ts
- health.ts
- history.ts
- index.ts
- search.ts
- settings.ts
- suwayomi.ts
- sync.ts
- system.ts
- appRouter.ts

#### Duplicate Files (Renamed)
- activity.ts → activity-current.ts (using router/ version)
- library.ts → library-from-router.ts
- tasks.ts → tasks-from-router.ts
- events.ts → events-from-router.ts

### Next Steps

1. Test the application thoroughly
2. Once confirmed working, remove:
   - The old router/ directory
   - Rename temporary files back to original names
3. Update any remaining imports

### Testing Commands

\`\`\`bash
# Type check
bun run type-check

# Run tests
bun run test

# Start dev server
bun run dev
\`\`\`
EOF

echo -e "${GREEN}✓ Migration report created${NC}"

echo -e "\n${GREEN}=== Consolidation Complete ===${NC}"
echo "The router/ directory contents have been migrated to routers/"
echo "Old router/ directory preserved for rollback if needed"
echo ""
echo -e "${YELLOW}IMPORTANT: Test thoroughly before removing old router/ directory${NC}"