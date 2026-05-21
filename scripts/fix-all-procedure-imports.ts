#!/usr/bin/env tsx

/**
 * Fix all missing procedure imports
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTERS_DIR = path.join(process.cwd(), 'src/server/trpc/routers');

const filesToFix = [
  'activity.ts',
  'bulk.ts',
  'chapter.ts',
  'events.ts',
  'library.ts',
  'metadata.ts',
  'settings-events.ts',
  'suwayomi.ts',
  'tasks.ts',
  'users.ts',
  'integrations/kavita.ts',
  'integrations/komga.ts'
];

for (const file of filesToFix) {
  const filePath = path.join(ROUTERS_DIR, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check what procedures are used
  const usedProcedures = new Set<string>();
  if (content.includes('publicProcedure.') || content.includes(': publicProcedure')) {
    usedProcedures.add('publicProcedure');
  }
  if (content.includes('protectedProcedure.') || content.includes(': protectedProcedure')) {
    usedProcedures.add('protectedProcedure');
  }
  if (content.includes('adminProcedure.') || content.includes(': adminProcedure')) {
    usedProcedures.add('adminProcedure');
  }
  if (content.includes('systemProcedure.') || content.includes(': systemProcedure')) {
    usedProcedures.add('systemProcedure');
  }

  if (usedProcedures.size === 0) {
    console.log(`ℹ️  ${file} - no procedures used`);
    continue;
  }

  // Check if already has import
  if (content.includes("from '../procedures'")) {
    console.log(`✅ ${file} - already has import`);
    continue;
  }

  // Find where to insert (after router import)
  const routerImportMatch = content.match(/import\s*{\s*router[^}]*}\s*from\s*['"]\.\.\/trpc['"]\s*;?\s*\n/);

  if (routerImportMatch) {
    const insertPos = routerImportMatch.index! + routerImportMatch[0].length;
    const importStatement = `import { ${Array.from(usedProcedures).sort().join(', ')} } from '../procedures';\n`;
    content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - added import for: ${Array.from(usedProcedures).join(', ')}`);
  } else {
    console.log(`⚠️  ${file} - couldn't find router import`);
  }
}

console.log('\n✅ Import fixing complete!');