#!/usr/bin/env ts-node
/**
 * Type Guard Auto-Generator
 * Week 2-3 - Type Safety Blitz
 *
 * Scans all interfaces in src/types/ and generates type guards
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface InterfaceInfo {
  name: string;
  properties: Array<{ name: string; type: string; optional: boolean }>;
  file: string;
  isExported: boolean;
  isGeneric: boolean;
}

/**
 * Extract interfaces from a TypeScript source file
 */
function extractInterfaces(sourceFile: ts.SourceFile): InterfaceInfo[] {
  const interfaces: InterfaceInfo[] = [];

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const properties: InterfaceInfo['properties'] = [];

      // Check if interface is exported
      const isExported = node.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      ) ?? false;

      // Check if interface has type parameters (is generic)
      const isGeneric = node.typeParameters && node.typeParameters.length > 0;

      node.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.name) {
          const name = member.name.getText(sourceFile);
          const optional = !!member.questionToken;
          let type = 'unknown';

          if (member.type) {
            const typeNode = member.type;
            type = typeNode.getText(sourceFile);
          }

          properties.push({ name, type, optional });
        }
      });

      interfaces.push({
        name: node.name.text,
        properties,
        file: sourceFile.fileName,
        isExported,
        isGeneric: !!isGeneric
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return interfaces;
}

/**
 * Generate property check for type guard
 */
function generatePropertyCheck(prop: { name: string; type: string; optional: boolean }): string {
  const { name, type, optional } = prop;

  // Base check
  let check = '';

  // Handle primitive types
  if (type === 'string') {
    check = `typeof candidate["${name}"] === 'string'`;
  } else if (type === 'number') {
    check = `typeof candidate["${name}"] === 'number'`;
  } else if (type === 'boolean') {
    check = `typeof candidate["${name}"] === 'boolean'`;
  } else if (type === 'string[]') {
    check = `Array.isArray(candidate["${name}"]) && candidate["${name}"].every((x: unknown) => typeof x === 'string')`;
  } else if (type === 'number[]') {
    check = `Array.isArray(candidate["${name}"]) && candidate["${name}"].every((x: unknown) => typeof x === 'number')`;
  } else if (type.endsWith('[]')) {
    check = `Array.isArray(candidate["${name}"])`;
  } else if (type === 'Date') {
    check = `candidate["${name}"] instanceof Date`;
  } else if (type.includes('|')) {
    // Union type - just check existence
    check = `'${name}' in candidate`;
  } else {
    // Complex type or interface - just check existence
    check = `'${name}' in candidate`;
  }

  // Handle optional properties
  if (optional) {
    // Use 'in' operator to check property existence to avoid unnecessary condition violations
    // This checks: property doesn't exist OR property has correct type
    return `(!("${name}" in candidate) || ${check})`;
  }

  return check;
}

/**
 * Generate a type guard function for an interface
 */
function generateTypeGuard(interfaceInfo: InterfaceInfo): string {
  const { name, properties } = interfaceInfo;

  if (properties.length === 0) {
    return `
export function is${name}(obj: unknown): obj is ${name} {
  return typeof obj === 'object' && obj !== null;
}
`.trim();
  }

  const checks = properties.map(prop => {
    const check = generatePropertyCheck(prop);
    return `    ${check}`;
  });

  return `
export function is${name}(obj: unknown): obj is ${name} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
${checks.join(' &&\n')}
  );
}
`.trim();
}

/**
 * Find all TypeScript files in src/types/
 */
function findTypeFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'generated') {
      files.push(...findTypeFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Scanning interfaces in src/types/...\n');

  const typesDir = path.join(process.cwd(), 'src/types');
  const typeFiles = findTypeFiles(typesDir);

  console.log(`Found ${typeFiles.length} type files\n`);

  let allInterfaces: InterfaceInfo[] = [];

  for (const filePath of typeFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const interfaces = extractInterfaces(sourceFile);

    if (interfaces.length > 0) {
      console.log(`  ${path.basename(filePath)}: ${interfaces.length} interfaces`);
      allInterfaces.push(...interfaces);
    }
  }

  console.log(`\n✅ Found ${allInterfaces.length} total interfaces\n`);

  if (allInterfaces.length === 0) {
    console.log('⚠️  No interfaces found in src/types/');
    return;
  }

  // Generate type guards file
  let output = `/**
 * Auto-generated Type Guards
 * Generated: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - Regenerate with: npx ts-node scripts/generate-type-guards.ts
 */

`;

  // Group by file
  const byFile = allInterfaces.reduce((acc, iface) => {
    if (!acc[iface.file]) acc[iface.file] = [];
    acc[iface.file].push(iface);
    return acc;
  }, {} as Record<string, InterfaceInfo[]>);

  // Track generated type guards to avoid duplicates
  const generatedGuards = new Set<string>();
  const typeToFile = new Map<string, string>();

  // First pass: determine which file should "own" each type (prefer first exported occurrence)
  for (const [file, interfaces] of Object.entries(byFile)) {
    for (const iface of interfaces) {
      // Skip non-exported interfaces
      if (!iface.isExported) {
        continue;
      }
      if (!typeToFile.has(iface.name)) {
        typeToFile.set(iface.name, file);
      }
    }
  }

  for (const [file, interfaces] of Object.entries(byFile)) {
    const relativePath = path.relative(process.cwd(), file);
    const importPath = relativePath
      .replace('src/', '@/')
      .replace('.ts', '');

    // Filter to only include exported, non-generic interfaces that should be generated from this file
    const interfacesToGenerate = interfaces.filter(
      iface => iface.isExported && !iface.isGeneric && typeToFile.get(iface.name) === file
    );

    if (interfacesToGenerate.length === 0) {
      continue;
    }

    output += `// From: ${relativePath}\n`;

    // Generate imports
    const interfaceNames = interfacesToGenerate.map(i => i.name);
    output += `import type { ${interfaceNames.join(', ')} } from '${importPath}';\n\n`;

    // Generate type guards
    for (const iface of interfacesToGenerate) {
      if (!generatedGuards.has(iface.name)) {
        output += generateTypeGuard(iface) + '\n\n';
        generatedGuards.add(iface.name);
      }
    }
  }

  console.log(`🔧 Deduplicated ${allInterfaces.length - generatedGuards.size} duplicate type guards\n`);

  // Create output directory
  const outputDir = path.join(process.cwd(), 'src/utils/type-guards');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  const outputPath = path.join(outputDir, 'generated.ts');
  fs.writeFileSync(outputPath, output);

  console.log(`📁 Type guards written to: ${path.relative(process.cwd(), outputPath)}`);
  console.log('\nNext steps:');
  console.log('1. Import type guards where unknown types are used');
  console.log('2. Use guards to narrow types before accessing properties');
  console.log('3. Add custom guards for complex validation logic\n');
}

export { extractInterfaces, generateTypeGuard };

// Run if called directly
main().catch(console.error);
