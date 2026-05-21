#!/usr/bin/env node

/**
 * Fix Import Syntax Script
 * 
 * This script fixes malformed import statements and incomplete export statements
 * in TypeScript files. It's designed to be safe and reversible.
 */

const fs = require('fs');
const path = require('path');

// Files that are known to have syntax errors
const targetFiles = [
  'src/api/metadataProviders/adapters/__tests__/suwayomiAdapter.test.ts',
  'src/api/metadataProviders/adapters/wikipediaAdapter.ts',
  'src/api/metadataProviders/anilist/__tests__/fragments.test.ts',
  'src/api/metadataProviders/anilist/__tests__/pagination.test.ts',
  'src/api/metadataProviders/anilist/__tests__/sorting.test.ts',
  'src/api/metadataProviders/anilistClient.ts',
  'src/api/metadataProviders/fandomClient.ts',
  'src/api/notifications/adapters/notification-types-adapter.ts',
  'src/api/notifications/base/types.ts',
  'src/api/notifications/index.ts',
  'src/api/utils/errorHandling.ts',
  'src/api/utils/index.ts',
  'src/components/addLibrary.tsx',
  'src/components/addManga/AddMangaModal.tsx',
  'src/components/addManga/components/core/ProviderBadge.tsx',
  'src/components/addManga/components/display/MetadataPreview.tsx',
  'src/components/addManga/components/display/ProviderResults.tsx',
  'src/components/addManga/components/display/VolumeChapterTable.tsx',
  'src/components/addManga/components/fields/FieldSelector.tsx',
  'src/components/addManga/components/index.ts',
  'src/components/addManga/components/media/BannerGallery.tsx',
  'src/components/addManga/components/media/ChapterCoversGallery.tsx',
  'src/components/addManga/components/media/ImageGallery.tsx',
  'src/components/addManga/components/media/VolumeCoversGallery.tsx'
];

// Patterns to fix
const fixes = [
  // Fix incomplete imports on multiple lines
  {
    pattern: /^(\s*)([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*,?\s*\n\s*import\s*\{/gm,
    replacement: '$1import { $2,'
  },
  
  // Fix incomplete export type statements
  {
    pattern: /^export\s+type\s+\{\s*([^}]+?)\s*$/gm,
    replacement: 'export type { $1 } from \'./types\';'
  },
  
  // Fix incomplete export statements
  {
    pattern: /^export\s+\{\s*([^}]+?)\s*$/gm,
    replacement: 'export { $1 } from \'./types\';'
  },
  
  // Fix import statements split across lines
  {
    pattern: /import\s+\{([^}]*)\n([^}]*)\}\s*from/gm,
    replacement: 'import {$1 $2} from'
  },
  
  // Fix dangling commas in type exports
  {
    pattern: /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*,?\s*\n\s*\}\s*from/gm,
    replacement: '$1  $2\n} from'
  }
];

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Apply fixes
    for (const fix of fixes) {
      content = content.replace(fix.pattern, fix.replacement);
    }
    
    // Fix specific known patterns
    // Fix import statements that start with just identifiers
    content = content.replace(
      /^(\s*)([A-Z][A-Za-z0-9_]*(?:\s*,\s*[A-Z][A-Za-z0-9_]*)*)\s*,?\s*$/gm,
      (match, indent, identifiers) => {
        // Check if the next line looks like an import
        const lines = content.split('\n');
        const lineIndex = lines.findIndex(l => l.includes(match));
        if (lineIndex >= 0 && lineIndex < lines.length - 1) {
          const nextLine = lines[lineIndex + 1];
          if (nextLine.includes('import {') || nextLine.includes('from')) {
            return `${indent}import { ${identifiers},`;
          }
        }
        return match;
      }
    );
    
    // Fix imports from @/types/canonical that are malformed
    content = content.replace(
      /import\s+type\s+\{([^}]+)\}\s+from\s+['"]@\/types\/canonical['"]/g,
      (match, types) => {
        const cleanTypes = types.replace(/\s+/g, ' ').trim();
        return `import type { ${cleanTypes} } from '../../types/canonical'`;
      }
    );
    
    content = content.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]@\/types\/canonical['"]/g,
      (match, types) => {
        const cleanTypes = types.replace(/\s+/g, ' ').trim();
        return `import { ${cleanTypes} } from '../../types/canonical'`;
      }
    );
    
    if (content !== originalContent) {
      // Create backup
      const backupPath = fullPath + '.backup-' + Date.now();
      fs.writeFileSync(backupPath, originalContent);
      
      // Write fixed content
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Fixed: ${filePath}`);
      console.log(`   Backup: ${backupPath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Starting import syntax fixes...\n');

let fixedCount = 0;
let errorCount = 0;

for (const file of targetFiles) {
  const result = fixFile(file);
  if (result === true) {
    fixedCount++;
  } else if (result === false) {
    // File not found or no changes needed
  } else {
    errorCount++;
  }
}

console.log('\n📊 Summary:');
console.log(`   Files fixed: ${fixedCount}`);
console.log(`   Errors: ${errorCount}`);
console.log(`   Total files processed: ${targetFiles.length}`);

if (fixedCount > 0) {
  console.log('\n💡 To verify the fixes, run: pnpm type-check');
  console.log('   To rollback, restore from the .backup-* files');
}