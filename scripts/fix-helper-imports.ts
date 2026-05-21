#!/usr/bin/env tsx

/**
 * Script to fix remaining imports from async-result/helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixHelperImports() {
  console.log('🔍 Finding files with async-result/helpers imports...');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if file has imports from async-result/helpers
    if (content.includes('async-result/helpers')) {
      // Replace import paths
      const newContent = content.replace(
        /from\s+['"](.*)\/async-result\/helpers['"]/g,
        (match, prefix) => {
          // Calculate the correct relative path
          const fileDir = path.dirname(filePath);
          const relativeToSrc = path.relative(fileDir, SRC_DIR);
          const depth = filePath.split('/').length - SRC_DIR.split('/').length - 1;

          let newPath = '';
          if (depth === 0) {
            newPath = './utils/async-result';
          } else if (depth === 1) {
            newPath = '../utils/async-result';
          } else if (depth === 2) {
            newPath = '../../utils/async-result';
          } else if (depth === 3) {
            newPath = '../../../utils/async-result';
          } else if (depth === 4) {
            newPath = '../../../../utils/async-result';
          } else {
            // For deeper nesting
            newPath = `${Array(depth).fill('..').join('/')}/utils/async-result`;
          }

          // Special case for utils directory
          if (filePath.includes('/utils/') && !filePath.includes('/utils/async-result')) {
            newPath = './async-result';
          }

          return `from '${newPath}'`;
        }
      );

      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
        fixedCount++;
        modified = true;
      }
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

fixHelperImports().catch(console.error);