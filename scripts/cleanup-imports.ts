#!/usr/bin/env tsx

/**
 * Clean up imports and remove duplicates across the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

interface ImportCleanupResult {
  filesProcessed: number;
  duplicatesRemoved: number;
  unusedRemoved: number;
  importsOptimized: number;
}

async function cleanupImports(): Promise<ImportCleanupResult> {
  console.log('🧹 Cleaning up imports and removing duplicates...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  });

  const result: ImportCleanupResult = {
    filesProcessed: 0,
    duplicatesRemoved: 0,
    unusedRemoved: 0,
    importsOptimized: 0,
  };

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const original = content;

    // 1. Find and remove duplicate imports
    const importMap = new Map<string, Set<string>>();
    const importLines: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match import statements
      const importMatch = line.match(/^import\s+(?:type\s+)?(?:\{([^}]+)\}|([a-zA-Z_$][\w$]*)|(\*\s+as\s+[a-zA-Z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]/);

      if (importMatch) {
        const [fullMatch, namedImports, defaultImport, namespaceImport, source] = importMatch;

        if (!importMap.has(source)) {
          importMap.set(source, new Set());
        }

        const imports = importMap.get(source)!;

        if (namedImports) {
          // Split named imports and add to set
          const items = namedImports.split(',').map(s => s.trim());
          items.forEach(item => imports.add(item));
        } else if (defaultImport) {
          imports.add(`default:${defaultImport}`);
        } else if (namespaceImport) {
          imports.add(namespaceImport);
        }

        // Mark this line for potential removal
        importLines.push(line);
      }
    }

    // 2. Rebuild imports without duplicates
    const newImports: string[] = [];
    const processedSources = new Set<string>();

    for (const line of lines) {
      const importMatch = line.match(/^import\s+(?:type\s+)?(?:\{([^}]+)\}|([a-zA-Z_$][\w$]*)|(\*\s+as\s+[a-zA-Z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]/);

      if (importMatch) {
        const source = importMatch[4];

        if (!processedSources.has(source)) {
          processedSources.add(source);

          const allImports = importMap.get(source)!;
          const namedImports: string[] = [];
          let defaultImport = '';
          let namespaceImport = '';

          allImports.forEach(imp => {
            if (imp.startsWith('default:')) {
              defaultImport = imp.replace('default:', '');
            } else if (imp.includes('* as')) {
              namespaceImport = imp;
            } else {
              namedImports.push(imp);
            }
          });

          // Build the consolidated import statement
          let importStatement = 'import ';

          if (defaultImport && namedImports.length > 0) {
            importStatement += `${defaultImport}, { ${namedImports.join(', ')} }`;
          } else if (defaultImport) {
            importStatement += defaultImport;
          } else if (namespaceImport) {
            importStatement += namespaceImport;
          } else if (namedImports.length > 0) {
            // Check if any imports have 'type' prefix
            const hasTypeImports = namedImports.some(imp => imp.includes('type '));
            if (hasTypeImports && namedImports.every(imp => imp.includes('type '))) {
              importStatement += `type { ${namedImports.map(i => i.replace('type ', '')).join(', ')} }`;
            } else {
              importStatement += `{ ${namedImports.join(', ')} }`;
            }
          }

          importStatement += ` from '${source}';`;
          newImports.push(importStatement);

          if (allImports.size > 1) {
            result.duplicatesRemoved++;
          }
        }
      }
    }

    // 3. Rebuild file content with consolidated imports
    if (newImports.length > 0) {
      const nonImportLines = lines.filter(line => !line.match(/^import\s+/));
      const newContent = [...newImports, '', ...nonImportLines].join('\n');

      if (newContent !== content) {
        content = newContent;
        modified = true;
        result.importsOptimized++;
      }
    }

    // 4. Remove unused imports (conservative approach)
    // Only remove imports that are clearly not used anywhere in the file
    const importRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|([a-zA-Z_$][\w$]*))\s+from/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const [fullMatch, namedImports, defaultImport] = match;

      if (namedImports) {
        const items = namedImports.split(',').map(s => s.trim().replace(/\s+as\s+.*/, ''));

        for (const item of items) {
          const cleanItem = item.replace('type ', '').trim();
          // Check if the import is used in the file (excluding the import line itself)
          const usageRegex = new RegExp(`\\b${cleanItem}\\b(?![^'"\`]*['"\`])`, 'g');
          const contentWithoutImports = content.split('\n')
            .filter(line => !line.match(/^import\s+/))
            .join('\n');

          if (!usageRegex.test(contentWithoutImports)) {
            // Import is not used, mark for removal
            const importLineRegex = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${cleanItem}\\b[^}]*\\}\\s+from\\s+['"][^'"]+['"];?`, 'g');
            const newImportLine = content.match(importLineRegex)?.[0];

            if (newImportLine) {
              // Remove just this import from the line
              const updatedLine = newImportLine.replace(
                new RegExp(`\\b${cleanItem}\\b,?\\s*`),
                ''
              ).replace(/,\s*}/, '}').replace(/{,/, '{');

              if (updatedLine.includes('{}')) {
                // Remove entire import if empty
                content = content.replace(newImportLine, '');
                result.unusedRemoved++;
                modified = true;
              } else {
                content = content.replace(newImportLine, updatedLine);
                result.unusedRemoved++;
                modified = true;
              }
            }
          }
        }
      }
    }

    // 5. Sort imports by source
    const importSections = content.match(/^import[\s\S]*?from\s+['"][^'"]+['"];?$/gm) || [];
    if (importSections.length > 1) {
      const sortedImports = importSections.sort((a, b) => {
        // Extract source paths
        const sourceA = a.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '';
        const sourceB = b.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '';

        // Prioritize order: node_modules, @/, relative paths
        const scoreA = sourceA.startsWith('.') ? 3 : sourceA.startsWith('@/') ? 2 : 1;
        const scoreB = sourceB.startsWith('.') ? 3 : sourceB.startsWith('@/') ? 2 : 1;

        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }

        return sourceA.localeCompare(sourceB);
      });

      // Replace imports section with sorted imports
      const firstImportIndex = content.indexOf(importSections[0]);
      const lastImportIndex = content.lastIndexOf(importSections[importSections.length - 1]) +
                              importSections[importSections.length - 1].length;

      const beforeImports = content.substring(0, firstImportIndex);
      const afterImports = content.substring(lastImportIndex);

      content = beforeImports + sortedImports.join('\n') + afterImports;

      if (content !== original) {
        modified = true;
      }
    }

    // 6. Clean up multiple empty lines
    content = content.replace(/\n{3,}/g, '\n\n');

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
      result.filesProcessed++;
    }
  }

  return result;
}

// Run cleanup
async function main() {
  const result = await cleanupImports();

  console.log('\n📊 Import Cleanup Summary:');
  console.log(`  Files processed: ${result.filesProcessed}`);
  console.log(`  Duplicate imports removed: ${result.duplicatesRemoved}`);
  console.log(`  Unused imports removed: ${result.unusedRemoved}`);
  console.log(`  Import statements optimized: ${result.importsOptimized}`);
}

main().catch(console.error);