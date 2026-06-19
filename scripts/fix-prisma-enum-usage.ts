#!/usr/bin/env node

/**
 * Script to fix files that incorrectly use Prisma enums as values
 * after they were converted to type imports.
 *
 * This identifies where enums are used as runtime values and converts
 * them back to regular imports.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface EnumUsageFix {
  file: string;
  enumName: string;
  lineNumber: number;
  usage: string;
}

// List of files reported by TypeScript with enum value usage errors
const filesWithErrors = [
  'src/components/addManga/steps/confirmationStep/hooks/useFieldSelections.ts',
  'src/components/calendar/__tests__/Calendar.e2e.test.tsx',
  'src/components/calendar/CalendarEventModal.tsx',
  'src/components/calendar/ReleaseScheduleOverride.tsx',
  'src/components/chaptersTable.tsx',
  'src/components/DownloadQueue.tsx',
  'src/components/events/EventsPanel.tsx',
  'src/components/library/BulkActionsModal.tsx',
  'src/components/library/ResponsiveLibraryList.tsx',
  'src/components/library/scan/LibraryScanModal.tsx',
  'src/components/library/views/DetailedView.tsx',
  'src/components/manga/ChapterDetailModal.tsx',
  'src/components/manga/ChapterList.tsx',
  'src/components/manga/MangaActionBar.tsx',
  'src/components/manga/MangaDetailView.tsx',
  'src/components/manga/ResponsiveMangaDetail.tsx',
  'src/components/manga/VolumeDetailModal.tsx',
  'src/components/mangaDetail.tsx',
  'src/components/refreshMetadata/RefreshMetadataModalContent.tsx',
  'src/components/responsive/ResponsiveChaptersTable.tsx',
  'src/components/settings/MetadataSettings.tsx',
  'src/components/settings/ProviderSettings.tsx',
  'src/components/systems/ResponsiveUserList.tsx',
  'src/components/tasks/ResponsiveTaskList.tsx',
  'src/components/tasks/TaskList.tsx',
  'src/components/tasks/utils.ts',
  'src/components/updateManga/UpdateForm.tsx',
  'src/components/volumeChaptersTable.tsx',
  'src/hooks/useChapterSync.ts',
  'src/hooks/useManga.ts',
  'src/hooks/useProviderConfig.ts',
  'src/hooks/useSuwayomiConfig.ts',
  'src/hooks/useTaskCounts.ts',
  'src/lib/auth/validation.ts',
  'src/lib/prisma.ts',
  'src/pages/settings/release-blocklist.tsx',
  'src/pages/settings/search-providers.tsx',
  'src/pages/tasks/active.tsx',
  'src/pages/tasks/completed.tsx',
  'src/pages/tasks/dashboard.tsx',
  'src/pages/tasks/failed.tsx',
  'src/pages/tasks/out-of-sync.tsx',
  'src/pages/tasks/queued.tsx',
  'src/pages/tasks/scheduled.tsx',
  'src/pages/wanted/downloads.tsx',
  'src/pages/wanted/history.tsx',
  'src/pages/wanted/missing.tsx',
];

// Enums that are being used as values (from error messages)
const enumsUsedAsValues = [
  'MangaPublicationStatus',
  'CalendarEventType',
  'EventStatus',
  'ReleaseType',
  'ChapterStatus',
  'TaskStatus',
  'TaskType',
  'UserRole',
  'MetadataProvider',
  'ProviderType',
  'NotificationEventType',
  'LibraryStatus',
  'MangaLibraryStatus',
  'MangaFileStatus'
];

function fixFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  // Find import type lines with Prisma client
  lines.forEach((line, index) => {
    if (line.includes('import type') && line.includes('@prisma/client')) {
      const importMatch = line.match(/import\s+type\s+\{([^}]+)\}\s+from\s+['"]@prisma\/client['"]/);

      if (importMatch) {
        const imports = importMatch[1].split(',').map(i => i.trim());
        const typeOnlyImports: string[] = [];
        const valueImports: string[] = [];

        imports.forEach(imp => {
          const baseName = imp.split(' as ')[0].trim();
          if (enumsUsedAsValues.includes(baseName)) {
            valueImports.push(imp);
          } else {
            typeOnlyImports.push(imp);
          }
        });

        if (valueImports.length > 0) {
          const newLines: string[] = [];

          if (valueImports.length > 0) {
            newLines.push(`import { ${valueImports.join(', ')} } from '@prisma/client';`);
          }

          if (typeOnlyImports.length > 0) {
            newLines.push(`import type { ${typeOnlyImports.join(', ')} } from '@prisma/client';`);
          }

          lines[index] = newLines.join('\n');
          modified = true;
        }
      }
    }
  });

  if (modified) {
    fs.writeFileSync(absolutePath, lines.join('\n'), 'utf-8');
    console.log(`✅ Fixed ${path.relative(process.cwd(), absolutePath)}`);
  }
}

async function main() {
  console.log('🔧 Fixing Prisma enum value usage errors...\n');

  for (const file of filesWithErrors) {
    fixFile(file);
  }

  console.log('\n✨ Done! Run "npx tsc --noEmit" to verify the fixes.');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});