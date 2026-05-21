#!/usr/bin/env tsx

/**
 * Fix empty imports created by the cleanup script
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixEmptyImports(): Promise<number> {
  console.log('🔧 Fixing empty imports...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  });

  let filesFixed = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Remove empty named imports like: import { } from '...'
    content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n/g, '');

    // Remove duplicate import lines
    const lines = content.split('\n');
    const seen = new Set<string>();
    const uniqueLines: string[] = [];

    for (const line of lines) {
      // Normalize the line for comparison (remove extra spaces)
      const normalizedLine = line.trim();

      if (normalizedLine.startsWith('import ') && !seen.has(normalizedLine)) {
        seen.add(normalizedLine);
        uniqueLines.push(line);
      } else if (!normalizedLine.startsWith('import ')) {
        uniqueLines.push(line);
      }
    }

    content = uniqueLines.join('\n');

    // Clean up multiple consecutive empty lines
    content = content.replace(/\n{3,}/g, '\n\n');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      filesFixed++;
    }
  }

  return filesFixed;
}

// Run the fix
async function main() {
  const filesFixed = await fixEmptyImports();
  console.log(`\n📊 Fixed ${filesFixed} files with empty imports`);
}

main().catch(console.error);