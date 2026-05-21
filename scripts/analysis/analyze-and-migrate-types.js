#!/usr/bin/env node

/**
 * Type Consolidation Analysis and Migration Tool
 * 
 * This script analyzes duplicate type definitions and helps migrate to canonical versions.
 * Usage: node scripts/analyze-and-migrate-types.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { Project } = require('ts-morph');

// Configuration
const config = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  rootDir: path.resolve(__dirname, '..'),
  srcDir: path.resolve(__dirname, '../src'),
  typesDir: path.resolve(__dirname, '../src/types'),
};

// Type mapping configuration
const typeMappings = {
  // High priority duplicates
  'SearchOptions': {
    canonical: '@/types/integration/base',
    deprecated: [
      '@/types/adapters/base',
      '@/utils/integration-adapter',
    ]
  },
  'MetadataProvider': {
    canonical: '@/types/domain/provider-types',
    deprecated: [
      '@/types/provider-interfaces',
      '@/types/metadata-types',
      '@/types/provider-types',
    ]
  },
  'MangaWithRelations': {
    canonical: '@/types/domain/manga-types',
    deprecated: [
      '@/types/prismaTypes.deprecated',
      '@/types/library-page-types',
    ]
  },
  'MangaMetadata': {
    canonical: '@/types/domain/manga-types',
    deprecated: [
      '@/types/prismaTypes.deprecated',
      '@/types/manga-metadata',
    ],
    special: '@/types/common', // Database model - keep separate
  },
  // Medium priority duplicates
  'ExternalLink': {
    canonical: '@/types/domain/external-link',
    deprecated: [
      '@/types/manga-metadata',
      '@/types/domain/manga-types', // Should import from external-link
    ]
  },
  'Chapter': {
    canonical: '@/types/domain/chapter-types',
    deprecated: [
      '@/types/prismaTypes.deprecated',
    ],
    special: '@/types/mangal/chapter', // Mangal-specific - keep separate
  },
};

// Logging utilities
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  verbose: (msg) => config.verbose && console.log(`🔍 ${msg}`),
};

// Initialize TypeScript project
function initializeProject() {
  log.info('Initializing TypeScript project...');
  const project = new Project({
    tsConfigFilePath: path.join(config.rootDir, 'tsconfig.json'),
  });
  
  // Add source files
  project.addSourceFilesAtPaths([
    path.join(config.srcDir, '**/*.ts'),
    path.join(config.srcDir, '**/*.tsx'),
  ]);
  
  log.success(`Loaded ${project.getSourceFiles().length} source files`);
  return project;
}

// Find all occurrences of a type
function findTypeOccurrences(project, typeName) {
  const occurrences = new Map();
  
  project.getSourceFiles().forEach(sourceFile => {
    const filePath = sourceFile.getFilePath();
    
    // Skip node_modules and build directories
    if (filePath.includes('node_modules') || filePath.includes('.next')) {
      return;
    }
    
    // Check for interface/type declarations
    const interfaces = sourceFile.getInterfaces();
    const typeAliases = sourceFile.getTypeAliases();
    
    interfaces.forEach(iface => {
      if (iface.getName() === typeName) {
        if (!occurrences.has(filePath)) {
          occurrences.set(filePath, []);
        }
        occurrences.get(filePath).push({
          type: 'declaration',
          line: iface.getStartLineNumber(),
          text: iface.getText().substring(0, 100) + '...',
        });
      }
    });
    
    typeAliases.forEach(typeAlias => {
      if (typeAlias.getName() === typeName) {
        if (!occurrences.has(filePath)) {
          occurrences.set(filePath, []);
        }
        occurrences.get(filePath).push({
          type: 'declaration',
          line: typeAlias.getStartLineNumber(),
          text: typeAlias.getText().substring(0, 100) + '...',
        });
      }
    });
    
    // Check for imports
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const namedImports = importDecl.getNamedImports();
      namedImports.forEach(namedImport => {
        if (namedImport.getName() === typeName) {
          if (!occurrences.has(filePath)) {
            occurrences.set(filePath, []);
          }
          occurrences.get(filePath).push({
            type: 'import',
            line: importDecl.getStartLineNumber(),
            module: importDecl.getModuleSpecifierValue(),
          });
        }
      });
    });
  });
  
  return occurrences;
}

// Analyze duplicate types
function analyzeDuplicates(project) {
  log.info('Analyzing duplicate types...\n');
  
  const analysis = {};
  
  Object.entries(typeMappings).forEach(([typeName, mapping]) => {
    log.info(`Analyzing ${typeName}...`);
    const occurrences = findTypeOccurrences(project, typeName);
    
    const declarations = [];
    const imports = [];
    
    occurrences.forEach((items, filePath) => {
      items.forEach(item => {
        if (item.type === 'declaration') {
          declarations.push({ file: filePath, ...item });
        } else {
          imports.push({ file: filePath, ...item });
        }
      });
    });
    
    analysis[typeName] = {
      declarations: declarations.length,
      imports: imports.length,
      details: { declarations, imports },
    };
    
    log.verbose(`  Found ${declarations.length} declarations and ${imports.length} imports`);
  });
  
  return analysis;
}

// Migrate imports to canonical versions
function migrateImports(project, typeName, mapping) {
  let migratedCount = 0;
  
  project.getSourceFiles().forEach(sourceFile => {
    let modified = false;
    
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Check if this import is from a deprecated location
      if (mapping.deprecated.includes(moduleSpecifier)) {
        const namedImports = importDecl.getNamedImports();
        const typeImport = namedImports.find(ni => ni.getName() === typeName);
        
        if (typeImport) {
          log.verbose(`  Migrating import in ${sourceFile.getFilePath()}`);
          
          if (!config.dryRun) {
            // Remove the old import
            typeImport.remove();
            
            // If no more named imports, remove the entire import
            if (importDecl.getNamedImports().length === 0) {
              importDecl.remove();
            }
            
            // Add new import
            const existingCanonicalImport = sourceFile.getImportDeclaration(
              decl => decl.getModuleSpecifierValue() === mapping.canonical
            );
            
            if (existingCanonicalImport) {
              // Add to existing import
              existingCanonicalImport.addNamedImport(typeName);
            } else {
              // Create new import
              sourceFile.addImportDeclaration({
                moduleSpecifier: mapping.canonical,
                namedImports: [typeName],
              });
            }
            
            modified = true;
            migratedCount++;
          }
        }
      }
    });
    
    if (modified) {
      sourceFile.saveSync();
    }
  });
  
  return migratedCount;
}

// Generate migration report
function generateReport(analysis) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TYPE CONSOLIDATION ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');
  
  Object.entries(analysis).forEach(([typeName, data]) => {
    console.log(`\n📦 ${typeName}`);
    console.log(`   Declarations: ${data.declarations}`);
    console.log(`   Imports: ${data.imports}`);
    
    if (data.declarations > 0) {
      console.log('\n   Declaration locations:');
      data.details.declarations.forEach(decl => {
        console.log(`   - ${decl.file}:${decl.line}`);
      });
    }
    
    if (config.verbose && data.imports > 0) {
      console.log('\n   Import locations:');
      const importsByModule = {};
      data.details.imports.forEach(imp => {
        if (!importsByModule[imp.module]) {
          importsByModule[imp.module] = [];
        }
        importsByModule[imp.module].push(imp.file);
      });
      
      Object.entries(importsByModule).forEach(([module, files]) => {
        console.log(`\n   From '${module}':`);
        files.forEach(file => console.log(`     - ${file}`));
      });
    }
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Type Consolidation Tool');
    console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}\n`);
    
    // Initialize project
    const project = initializeProject();
    
    // Analyze duplicates
    const analysis = analyzeDuplicates(project);
    
    // Generate report
    generateReport(analysis);
    
    // Perform migrations if not dry run
    if (!config.dryRun) {
      log.info('\n🔄 Starting migration...\n');
      
      Object.entries(typeMappings).forEach(([typeName, mapping]) => {
        log.info(`Migrating ${typeName}...`);
        const count = migrateImports(project, typeName, mapping);
        log.success(`  Migrated ${count} imports`);
      });
      
      // Save all changes
      project.saveSync();
      log.success('\n✨ Migration complete!');
    } else {
      log.warning('\n⚠️  This was a dry run. Use without --dry-run to apply changes.');
    }
    
    // Final type check
    log.info('\n🔍 Running type check...');
    const { execSync } = require('child_process');
    try {
      execSync('pnpm type-check', { stdio: 'inherit', cwd: config.rootDir });
      log.success('Type check passed!');
    } catch (error) {
      log.error('Type check failed. Please review the changes.');
    }
    
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tool
main().catch(console.error);
