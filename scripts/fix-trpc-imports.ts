#!/usr/bin/env tsx

/**
 * Script to fix tRPC imports in router files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Fix imports in a router file
 */
function fixImportsInFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;
  
  // Check if file imports from ../procedures
  const hasProceduresImport = content.includes("from '../procedures'");
  const hasRouterFromTrpc = content.includes("import { router") && content.includes("from '../trpc'");
  const hasRouterFromProcedures = content.includes("import { router") && content.includes("from '../procedures'");
  
  if (hasRouterFromProcedures || (hasProceduresImport && !hasRouterFromTrpc)) {
    // Need to fix imports
    
    // Pattern 1: import { router, ... } from '../procedures'
    // Should be: import { ... } from '../procedures' and import { router } from '../trpc'
    const importFromProceduresRegex = /import\s*{([^}]+)}\s*from\s*['"]\.\.\/(procedures)['"];?/g;
    
    let match;
    while ((match = importFromProceduresRegex.exec(content)) !== null) {
      const imports = match[1].split(',').map(s => s.trim());
      
      // Separate router from other imports
      const routerIndex = imports.indexOf('router');
      const procedureImports = imports.filter(i => i !== 'router' && i !== 'procedure');
      const hasProcedure = imports.includes('procedure');
      
      if (routerIndex !== -1 || hasProcedure) {
        // Need to update imports
        const newImports = [];
        
        // Add router import from ../trpc
        if (routerIndex !== -1 || hasProcedure) {
          newImports.push("import { router } from '../trpc';");
        }
        
        // Add procedure imports from ../procedures
        if (procedureImports.length > 0) {
          newImports.push(`import { ${procedureImports.join(', ')} } from '../procedures';`);
        }
        
        // Replace the original import
        content = content.replace(match[0], newImports.join('\n'));
        modified = true;
      }
    }
    
    // Pattern 2: Replace standalone 'procedure.' with 'publicProcedure.'
    if (content.includes('procedure.') && !content.includes('import { procedure')) {
      // Find what procedures are imported
      const procedureImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]\.\.\/(procedures|trpc)['"];?/);
      
      if (procedureImportMatch) {
        const imports = procedureImportMatch[1].split(',').map(s => s.trim());
        
        // Default to publicProcedure if not specified
        let defaultProcedure = 'publicProcedure';
        if (imports.includes('protectedProcedure')) {
          defaultProcedure = 'protectedProcedure';
        } else if (imports.includes('adminProcedure')) {
          defaultProcedure = 'adminProcedure';
        }
        
        // Replace procedure. with the default
        content = content.replace(/(?<!\w)procedure\./g, `${defaultProcedure}.`);
        modified = true;
        
        // Make sure the procedure is imported
        if (!imports.includes(defaultProcedure)) {
          const newImports = [...imports, defaultProcedure].filter(i => i !== 'procedure');
          content = content.replace(
            procedureImportMatch[0],
            `import { ${newImports.join(', ')} } from '../procedures';`
          );
        }
      }
    }
  }
  
  // Write back if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

/**
 * Main function
 */
async function fixAllImports() {
  console.log('🔧 Fixing tRPC imports in router files\n');
  console.log('='.repeat(60));
  
  // Get all router files
  const routerFiles = await glob('*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });
  
  console.log(`Found ${routerFiles.length} router files to process\n`);
  
  let filesFixed = 0;
  
  for (const file of routerFiles) {
    const filePath = path.join(ROUTERS_DIR, file);
    
    if (fixImportsInFile(filePath)) {
      console.log(`✅ Fixed imports in ${file}`);
      filesFixed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files fixed: ${filesFixed}`);
  console.log('\n✅ Import fixing complete!');
}

// Run the script
fixAllImports().catch(console.error);