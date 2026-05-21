#!/usr/bin/env node

/**
 * Script to fix Prisma enum imports - converts regular imports to type imports
 * This prevents runtime issues and reduces bundle size
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Prisma enums and types that should be imported as types
const PRISMA_ENUMS = [
  // Task related
  'TaskType',
  'TaskStatus',
  'TaskErrorCode',

  // Chapter/Manga related
  'ChapterStatus',
  'MangaStatus',
  'MangaPublicationStatus',
  'MangaFileStatus',
  'MangaLibraryStatus',

  // Provider related
  'ProviderType',
  'ProviderStatus',
  'MetadataProvider',

  // Library related
  'LibraryType',
  'LibraryStatus',

  // Download related
  'DownloadStatus',
  'DownloadType',

  // Notification related
  'NotificationChannel',
  'NotificationEventType',

  // Sync related
  'SyncStatus',
  'SyncType',

  // User related
  'UserRole',
  'UserStatus',

  // Other enums
  'LogLevel',
  'ConfigNamespace',
  'SystemEventType',
  'ReleaseStatus',
  'CalendarEventType'
];

// Types that are actually runtime values (not enums) and should NOT be type-only
const RUNTIME_TYPES = [
  'Prisma',
  'PrismaClient'
];

interface ImportFix {
  file: string;
  originalLine: string;
  fixedLine: string;
  lineNumber: number;
}

async function findFilesToFix(): Promise<string[]> {
  const pattern = 'src/**/*.{ts,tsx}';
  const files = await glob(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts'],
    absolute: true
  });

  return files;
}

function analyzeFile(filePath: string): ImportFix[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fixes: ImportFix[] = [];

  lines.forEach((line, index) => {
    // Match import statements from @prisma/client
    const importMatch = line.match(/^import\s+(\{[^}]+\})\s+from\s+['"]@prisma\/client['"]/);

    if (importMatch) {
      const importContent = importMatch[1];
      const importedItems = importContent
        .replace(/[{}]/g, '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      // Separate enum imports from runtime imports
      const enumImports: string[] = [];
      const runtimeImports: string[] = [];
      const otherImports: string[] = [];

      importedItems.forEach(item => {
        // Handle aliased imports (e.g., "Manga as MangaEntity")
        const baseName = item.split(' as ')[0].trim();

        if (PRISMA_ENUMS.includes(baseName)) {
          enumImports.push(item);
        } else if (RUNTIME_TYPES.includes(baseName)) {
          runtimeImports.push(item);
        } else if (baseName === baseName.toUpperCase() || baseName.endsWith('Status') || baseName.endsWith('Type')) {
          // Likely an enum based on naming convention
          enumImports.push(item);
        } else {
          // Likely a model or other runtime value
          otherImports.push(item);
        }
      });

      // Build the fixed import statements
      const fixedLines: string[] = [];

      if (enumImports.length > 0) {
        fixedLines.push(`import type { ${enumImports.join(', ')} } from '@prisma/client';`);
      }

      const nonEnumImports = [...runtimeImports, ...otherImports];
      if (nonEnumImports.length > 0) {
        fixedLines.push(`import { ${nonEnumImports.join(', ')} } from '@prisma/client';`);
      }

      // Only create a fix if we need to split or convert to type imports
      if (enumImports.length > 0 && !line.includes('import type')) {
        fixes.push({
          file: filePath,
          originalLine: line,
          fixedLine: fixedLines.join('\n'),
          lineNumber: index + 1
        });
      }
    }
  });

  return fixes;
}

function applyFixes(fixes: ImportFix[]): void {
  // Group fixes by file
  const fixesByFile = new Map<string, ImportFix[]>();

  fixes.forEach(fix => {
    if (!fixesByFile.has(fix.file)) {
      fixesByFile.set(fix.file, []);
    }
    fixesByFile.get(fix.file)!.push(fix);
  });

  // Apply fixes to each file
  fixesByFile.forEach((fileFixes, filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Apply fixes in reverse order to maintain line numbers
    fileFixes
      .sort((a, b) => b.lineNumber - a.lineNumber)
      .forEach(fix => {
        lines[fix.lineNumber - 1] = fix.fixedLine;
      });

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(`✅ Fixed ${fileFixes.length} import(s) in ${path.relative(process.cwd(), filePath)}`);
  });
}

async function main() {
  console.log('🔍 Scanning for Prisma import violations...\n');

  const files = await findFilesToFix();
  console.log(`Found ${files.length} TypeScript files to analyze\n`);

  const allFixes: ImportFix[] = [];

  for (const file of files) {
    const fixes = analyzeFile(file);
    if (fixes.length > 0) {
      allFixes.push(...fixes);
    }
  }

  if (allFixes.length === 0) {
    console.log('✨ No Prisma import violations found!');
    return;
  }

  console.log(`Found ${allFixes.length} import violation(s) across ${new Set(allFixes.map(f => f.file)).size} file(s)\n`);

  // Show sample of fixes
  console.log('Sample fixes to be applied:');
  allFixes.slice(0, 5).forEach(fix => {
    console.log(`\n📁 ${path.relative(process.cwd(), fix.file)}:${fix.lineNumber}`);
    console.log(`  ❌ ${fix.originalLine.trim()}`);
    console.log(`  ✅ ${fix.fixedLine.split('\n').map(l => l.trim()).join('\n     ')}`);
  });

  if (allFixes.length > 5) {
    console.log(`\n... and ${allFixes.length - 5} more\n`);
  }

  // Apply fixes if not in dry-run mode
  if (process.argv.includes('--dry-run')) {
    console.log('\n🔍 Dry run mode - no changes were made');
  } else {
    console.log('\n📝 Applying fixes...\n');
    applyFixes(allFixes);
    console.log(`\n✨ Successfully fixed ${allFixes.length} import violation(s)!`);
    console.log('\n💡 Run "npx tsc --noEmit" to verify the fixes compile correctly');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});