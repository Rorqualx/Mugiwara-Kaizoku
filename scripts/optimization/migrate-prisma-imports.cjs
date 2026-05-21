#!/usr/bin/env node
/**
 * AST-based script to migrate PrismaClient imports from lib/prisma to server/db
 * Ensures single source of truth for database connections
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const VERBOSE = process.argv.includes('--verbose');

// Stats tracking
const stats = {
  filesProcessed: 0,
  importsUpdated: 0,
  errors: [],
  skipped: []
};

/**
 * Calculate relative import path from source to target
 */
function getRelativeImportPath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);

  // Remove .ts extension
  relativePath = relativePath.replace(/\.ts$/, '');

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  if (VERBOSE) console.log(`Processing: ${filePath}`);

  try {
    const code = fs.readFileSync(filePath, 'utf8');

    // Skip if no prisma import from lib/prisma
    if (!code.includes('lib/prisma')) {
      stats.skipped.push(filePath);
      return false;
    }

    // Parse TypeScript/TSX
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties'
      ]
    });

    let modified = false;

    // Traverse and transform
    traverse(ast, {
      ImportDeclaration(nodePath) {
        const source = nodePath.node.source.value;

        // Check for various patterns of lib/prisma imports
        if (source.includes('lib/prisma') || source.includes('../../lib/prisma')) {
          const targetPath = path.join(process.cwd(), 'src/server/db.ts');
          const newImportPath = getRelativeImportPath(filePath, targetPath);

          if (VERBOSE) {
            console.log(`  Updating import:`);
            console.log(`    From: ${source}`);
            console.log(`    To:   ${newImportPath}`);
          }

          // Update the import path
          nodePath.node.source.value = newImportPath;

          // Update import specifiers if needed
          nodePath.node.specifiers.forEach(spec => {
            if (t.isImportSpecifier(spec)) {
              // If importing prisma, it stays the same
              // If importing prismaManager, change to db
              if (spec.imported.name === 'prismaManager') {
                spec.imported.name = 'db';
                if (spec.local.name === 'prismaManager') {
                  spec.local.name = 'db';
                }
              }
            }
          });

          modified = true;
          stats.importsUpdated++;
        }
      }
    });

    if (modified) {
      // Generate new code
      const { code: newCode } = generate(ast, {
        retainLines: true,
        retainFunctionParens: true,
        compact: false
      }, code);

      if (!DRY_RUN) {
        // Create backup
        const backupPath = filePath + '.backup';
        fs.copyFileSync(filePath, backupPath);

        // Write updated file
        fs.writeFileSync(filePath, newCode);

        if (VERBOSE) console.log(`  ✓ File updated`);
      } else {
        if (VERBOSE) console.log(`  [DRY RUN] Would update file`);
      }

      stats.filesProcessed++;
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    stats.errors.push({ file: filePath, error: error.message });
    return false;
  }
}

/**
 * Find all TypeScript files that import from lib/prisma
 */
function findFilesToProcess() {
  const { execSync } = require('child_process');

  try {
    const result = execSync(
      'grep -r "from.*lib/prisma" src --include="*.ts" --include="*.tsx" -l',
      { encoding: 'utf8' }
    );

    return result.split('\n').filter(Boolean);
  } catch (error) {
    // grep returns exit code 1 if no matches found
    if (error.status === 1) return [];
    throw error;
  }
}

/**
 * Test mode - process only a few files
 */
function runTestMode() {
  console.log('🧪 Running in TEST MODE\n');

  const testFiles = findFilesToProcess().slice(0, 3);

  if (testFiles.length === 0) {
    console.log('No files found to test');
    return;
  }

  console.log(`Testing on ${testFiles.length} files:\n`);

  testFiles.forEach(file => {
    console.log(`\n📄 ${file}`);
    processFile(file);
  });

  console.log('\n✅ Test complete. Review changes above.');
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 PrismaClient Import Migration Tool\n');

  if (TEST_MODE) {
    runTestMode();
    return;
  }

  const files = findFilesToProcess();

  if (files.length === 0) {
    console.log('✅ No files need migration');
    return;
  }

  console.log(`Found ${files.length} files to process`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Process files
  files.forEach((file, index) => {
    if (!VERBOSE && index % 10 === 0) {
      process.stdout.write(`Processing... ${index}/${files.length}\r`);
    }
    processFile(file);
  });

  // Print statistics
  console.log('\n\n📊 Migration Statistics:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Imports updated: ${stats.importsUpdated}`);
  console.log(`  Files skipped: ${stats.skipped.length}`);
  console.log(`  Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors occurred:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  ${file}: ${error}`);
    });
  }

  if (!DRY_RUN && stats.filesProcessed > 0) {
    console.log('\n✅ Migration complete!');
    console.log('💡 Backup files created with .backup extension');
    console.log('📝 Run TypeScript check: pnpm tsc --noEmit');
  }
}

// Check for required dependencies
try {
  require('@babel/parser');
  require('@babel/traverse');
  require('@babel/generator');
  require('@babel/types');
} catch (error) {
  console.error('❌ Missing required Babel packages');
  console.error('Run: pnpm add -D @babel/parser @babel/traverse @babel/generator @babel/types');
  process.exit(1);
}

// Run the migration
main();