#!/usr/bin/env ts-node

/**
 * AST-based transformation script to migrate Mantine v7 props
 * Transforms: spacing -> gap
 * No backward compatibility maintained
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const VERBOSE = process.argv.includes('--verbose');

// Statistics
let filesProcessed = 0;
let filesModified = 0;
let propsTransformed = 0;
const errors: string[] = [];

/**
 * Transform spacing prop to gap prop
 */
function transformMantineProps(sourceText: string, fileName: string): string | null {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  let modified = false;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (rootNode) => {
      function visit(node: ts.Node): ts.Node {
        // Check for JSX attributes
        if (ts.isJsxAttribute(node)) {
          const attrName = node.name.getText(sourceFile);

          // Transform spacing to gap (but NOT for SimpleGrid)
          if (attrName === 'spacing') {
            // Check if this is a SimpleGrid component
            const parent = node.parent;
            if (ts.isJsxAttributes(parent)) {
              const jsxElement = parent.parent;
              if (ts.isJsxOpeningElement(jsxElement) || ts.isJsxSelfClosingElement(jsxElement)) {
                const tagName = jsxElement.tagName.getText(sourceFile);

                // Skip transformation for SimpleGrid (it still uses spacing in v7)
                if (tagName === 'SimpleGrid') {
                  if (VERBOSE) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
                    console.log(`  ⏭️  Line ${line}: Skipping SimpleGrid.spacing (uses spacing in v7)`);
                  }
                  return node;
                }

                // Transform for other components
                modified = true;
                propsTransformed++;

                if (VERBOSE) {
                  const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
                  console.log(`  📝 Line ${line}: ${tagName}.spacing -> gap`);
                }

                return ts.factory.createJsxAttribute(
                  ts.factory.createIdentifier('gap'),
                  node.initializer
                );
              }
            }
          }

          // Also handle verticalSpacing for SimpleGrid (keep it as is)
          if (attrName === 'verticalSpacing') {
            const parent = node.parent;
            if (ts.isJsxAttributes(parent)) {
              const jsxElement = parent.parent;
              if (ts.isJsxOpeningElement(jsxElement) || ts.isJsxSelfClosingElement(jsxElement)) {
                const tagName = jsxElement.tagName.getText(sourceFile);

                // Keep verticalSpacing for SimpleGrid
                if (tagName === 'SimpleGrid') {
                  if (VERBOSE) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
                    console.log(`  ⏭️  Line ${line}: Keeping SimpleGrid.verticalSpacing`);
                  }
                  return node;
                }
              }
            }
          }
        }

        return ts.visitEachChild(node, visit, context);
      }

      return ts.visitNode(rootNode, visit) as ts.SourceFile;
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSource = result.transformed[0];

  if (!modified) {
    return null;
  }

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false
  });

  const output = printer.printFile(transformedSource);
  result.dispose();

  return output;
}

/**
 * Process a single file
 */
function processFile(filePath: string): boolean {
  try {
    filesProcessed++;

    const sourceText = fs.readFileSync(filePath, 'utf8');
    const transformed = transformMantineProps(sourceText, filePath);

    if (transformed !== null) {
      if (DRY_RUN) {
        console.log(`🔍 Would transform: ${filePath}`);
      } else {
        fs.writeFileSync(filePath, transformed);
        console.log(`✅ Transformed: ${filePath}`);
      }
      filesModified++;
      return true;
    }

    return false;
  } catch (error) {
    const errorMsg = `❌ Error processing ${filePath}: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Mantine v7 Props Transformation');
  console.log('===================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : TEST_MODE ? 'TEST MODE' : 'PRODUCTION'}`);
  console.log('');

  // Define file patterns
  const patterns = TEST_MODE
    ? [
        'src/components/mangaDetail.tsx',
        'src/components/settings/MetadataProvidersGrid.tsx',
        'src/components/reader/MobileReader.tsx'
      ]
    : ['src/**/*.{ts,tsx}'];

  // Get all files
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { ignore: ['**/node_modules/**', '**/*.test.*'] });
    files.push(...matches);
  }

  console.log(`📁 Found ${files.length} files to process\n`);

  // Process files
  for (const file of files) {
    if (VERBOSE) {
      console.log(`\n🔍 Checking: ${file}`);
    }
    processFile(file);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Transformation Summary');
  console.log('='.repeat(50));
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Props transformed: ${propsTransformed}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach(err => console.log(err));
  }

  if (DRY_RUN) {
    console.log('\n📌 This was a DRY RUN. No files were actually modified.');
    console.log('Remove --dry-run flag to apply changes.');
  }

  // Run type check if not in dry run mode
  if (!DRY_RUN && !TEST_MODE) {
    console.log('\n🔍 Running type check...');
    const { execSync } = await import('child_process');
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      console.log('✅ Type check passed!');
    } catch (error) {
      console.error('❌ Type check failed! Rolling back...');
      process.exit(1);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});