#!/usr/bin/env node

/**
 * Migration Script: Convert custom result patterns to AsyncResult
 *
 * This script automates the migration of custom success/error patterns
 * to the centralized AsyncResult pattern.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ASYNC_RESULT_IMPORT = `import {
  AsyncResult,
  createSuccessResult,
  createErrorResult,
  createContextualError,
  isSuccess,
  isError
} from '../../../utils/async-result';`;

// Files to migrate (grouped by phase)
const MIGRATION_PHASES = {
  'Phase 1B - Core Routers': [
    'src/server/trpc/routers/manga.ts',
    'src/server/trpc/routers/library.ts',
    'src/server/trpc/routers/chapter.ts',
    'src/server/trpc/routers/metadata.ts',
  ],
  'Phase 1C - Integration Routers': [
    'src/server/trpc/routers/download.ts',
    'src/server/trpc/routers/downloadClients.ts',
    'src/server/trpc/routers/suwayomi.ts',
    'src/server/trpc/routers/kapowarr.ts',
  ],
  'Phase 2A - Notification Services': [
    'src/server/services/notifications/base/BaseNotificationAdapter.ts',
    'src/server/services/notifications/adapters/discordAdapter.ts',
    'src/server/services/notifications/adapters/emailAdapter.ts',
    'src/server/services/notifications/adapters/slackAdapter.ts',
    'src/server/services/notifications/adapters/telegramAdapter.ts',
    'src/server/services/notifications/adapters/webhookAdapter.ts',
  ],
  'Phase 3 - UI Components': [
    'src/pages/settings/indexers.tsx',
    'src/pages/settings/integrations/prowlarr.tsx',
    'src/components/settings/suwayomi/SuwayomiSecuritySettings.tsx',
  ],
  'Phase 4 - SDK': [
    'src/sdk/examples/typescript-patterns.ts',
  ]
};

/**
 * Pattern replacements
 */
const REPLACEMENTS = [
  // Simple success return
  {
    pattern: /return\s*{\s*success:\s*true\s*}/g,
    replacement: 'return createSuccessResult(null)'
  },
  // Success with data
  {
    pattern: /return\s*{\s*success:\s*true,\s*([^}]+)\s*}/g,
    replacement: (match, data) => {
      // Extract the data properties
      const cleanData = data.trim();
      return `return createSuccessResult({ ${cleanData} })`;
    }
  },
  // Simple error return
  {
    pattern: /return\s*{\s*success:\s*false,\s*error:\s*['"`]([^'"`]+)['"`]\s*}/g,
    replacement: (match, errorMsg) => {
      return `return createErrorResult(new Error('${errorMsg}'))`;
    }
  },
  // Custom Result type definitions
  {
    pattern: /interface\s+(\w*Result)\s*{\s*success:\s*boolean[^}]*}/g,
    replacement: (match, name) => {
      return `type ${name} = AsyncResult<any, Error>`;
    }
  },
  // TestResult interface
  {
    pattern: /interface\s+TestResult\s*{\s*success:\s*boolean;\s*message:\s*string;\s*}/g,
    replacement: 'type TestResult = AsyncResult<string, Error>'
  }
];

/**
 * Add AsyncResult imports if not present
 */
function addImportsIfNeeded(content, filePath) {
  // Check if already has AsyncResult import
  if (content.includes('from \'../../../utils/async-result\'') ||
      content.includes('from \'../../utils/async-result\'') ||
      content.includes('from \'@/utils/async-result\'')) {

    // Check if it has all needed imports
    if (!content.includes('createSuccessResult')) {
      // Update existing import
      content = content.replace(
        /import\s*{[^}]+}\s*from\s*['"].*async-result['"]/,
        (match) => {
          // Extract current imports
          const currentImports = match.match(/{([^}]+)}/)[1];
          const imports = currentImports.split(',').map(i => i.trim());

          // Add missing imports
          const neededImports = [
            'AsyncResult',
            'createSuccessResult',
            'createErrorResult',
            'createContextualError',
            'isSuccess',
            'isError'
          ];

          neededImports.forEach(imp => {
            if (!imports.includes(imp)) {
              imports.push(imp);
            }
          });

          // Reconstruct import
          const importPath = match.match(/from\s*['"](.*)['"]/)[1];
          return `import {\n  ${imports.join(',\n  ')}\n} from '${importPath}'`;
        }
      );
    }
  } else {
    // Add import at the beginning after other imports
    const importPath = getRelativeImportPath(filePath);
    const importStatement = `import {
  AsyncResult,
  createSuccessResult,
  createErrorResult,
  createContextualError,
  isSuccess,
  isError
} from '${importPath}';`;

    // Find the last import statement
    const importRegex = /^import\s+.*$/gm;
    const imports = content.match(importRegex);
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      content = content.slice(0, lastImportIndex + lastImport.length) +
                '\n' + importStatement +
                content.slice(lastImportIndex + lastImport.length);
    }
  }

  return content;
}

/**
 * Get relative import path for async-result
 */
function getRelativeImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  if (filePath.includes('src/server/')) {
    if (filePath.includes('src/server/trpc/routers/')) {
      return '../../../utils/async-result';
    }
    if (filePath.includes('src/server/services/')) {
      return '../../../utils/async-result';
    }
  }
  if (filePath.includes('src/pages/')) {
    return '../../utils/async-result';
  }
  if (filePath.includes('src/components/')) {
    return '../../utils/async-result';
  }
  if (filePath.includes('src/sdk/')) {
    return '../../utils/async-result';
  }
  // Default
  return '@/utils/async-result';
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Add imports if needed
  content = addImportsIfNeeded(content, filePath);

  // Apply replacements
  let changeCount = 0;
  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      changeCount += matches.length;
      content = content.replace(pattern, replacement);
    }
  });

  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log(`  ✅ Migrated ${filePath} (${changeCount} patterns replaced)`);
    return true;
  } else {
    console.log(`  ⏭️  No changes needed for ${filePath}`);
    return false;
  }
}

/**
 * Main migration function
 */
function migrate() {
  console.log('🚀 Starting AsyncResult Migration\n');

  let totalFiles = 0;
  let migratedFiles = 0;

  // Process each phase
  Object.entries(MIGRATION_PHASES).forEach(([phase, files]) => {
    console.log(`\n📦 ${phase}`);
    console.log('━'.repeat(50));

    files.forEach(file => {
      totalFiles++;
      if (processFile(file)) {
        migratedFiles++;
      }
    });
  });

  console.log('\n' + '━'.repeat(50));
  console.log(`\n✨ Migration Complete!`);
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Files migrated: ${migratedFiles}`);
  console.log(`   Files unchanged: ${totalFiles - migratedFiles}`);

  if (migratedFiles > 0) {
    console.log('\n⚠️  Next steps:');
    console.log('   1. Run: npx tsc --noEmit');
    console.log('   2. Fix any TypeScript errors');
    console.log('   3. Run tests to verify functionality');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, processFile };