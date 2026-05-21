#!/usr/bin/env tsx

/**
 * Script to analyze type safety violations and categorize them by pattern
 * This will help us understand what we're dealing with before making changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

interface TypeViolation {
  file: string;
  line: number;
  column: number;
  type: 'any' | 'as-any' | 'ts-ignore' | 'ts-expect-error' | 'implicit-any';
  context: string;
  category?: string;
}

interface ViolationStats {
  totalViolations: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byFile: Record<string, number>;
  topFiles: Array<{ file: string; count: number }>;
  patterns: Array<{ pattern: string; count: number; examples: string[] }>;
}

const SRC_DIR = path.join(process.cwd(), 'src');

/**
 * Categorize a type violation based on its context
 */
function categorizeViolation(node: ts.Node, sourceFile: ts.SourceFile): string {
  const parent = node.parent;

  // Error handling patterns
  if (parent && ts.isCatchClause(parent)) {
    return 'error-handling';
  }

  // Event handlers
  if (parent && (ts.isPropertyAssignment(parent) || ts.isJsxAttribute(parent))) {
    const name = parent.name?.getText(sourceFile) || '';
    if (name.startsWith('on') || name.includes('Handler') || name.includes('Callback')) {
      return 'event-handler';
    }
  }

  // API responses
  if (parent && ts.isAwaitExpression(parent.parent)) {
    const text = parent.parent.getText(sourceFile);
    if (text.includes('fetch') || text.includes('axios') || text.includes('trpc')) {
      return 'api-response';
    }
  }

  // Function parameters
  if (parent && ts.isParameter(parent)) {
    return 'function-parameter';
  }

  // Type assertions
  if (parent && ts.isAsExpression(parent)) {
    return 'type-assertion';
  }

  // Array/Object destructuring
  if (parent && (ts.isArrayBindingPattern(parent) || ts.isObjectBindingPattern(parent))) {
    return 'destructuring';
  }

  // React props
  if (parent && ts.isJsxAttribute(parent)) {
    return 'react-props';
  }

  // Redux/Store related
  const text = node.getText(sourceFile);
  if (text.includes('state') || text.includes('dispatch') || text.includes('store')) {
    return 'state-management';
  }

  return 'uncategorized';
}

/**
 * Extract context around a violation
 */
function extractContext(node: ts.Node, sourceFile: ts.SourceFile): string {
  const start = Math.max(0, node.getStart() - 50);
  const end = Math.min(sourceFile.text.length, node.getEnd() + 50);
  const context = sourceFile.text.substring(start, end);
  return context.replace(/\s+/g, ' ').trim();
}

/**
 * Analyze a TypeScript file for type violations
 */
function analyzeFile(filePath: string): TypeViolation[] {
  const violations: TypeViolation[] = [];
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for ts-ignore and ts-expect-error comments
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('@ts-ignore')) {
      violations.push({
        file: filePath,
        line: index + 1,
        column: line.indexOf('@ts-ignore'),
        type: 'ts-ignore',
        context: line.trim(),
        category: 'comment-directive'
      });
    }
    if (line.includes('@ts-expect-error')) {
      violations.push({
        file: filePath,
        line: index + 1,
        column: line.indexOf('@ts-expect-error'),
        type: 'ts-expect-error',
        context: line.trim(),
        category: 'comment-directive'
      });
    }
  });

  // Parse with TypeScript compiler
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Check for 'any' keyword
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        type: 'any',
        context: extractContext(node, sourceFile),
        category: categorizeViolation(node, sourceFile)
      });
    }

    // Check for 'as any' assertions
    if (ts.isAsExpression(node)) {
      const typeNode = node.type;
      if (typeNode && typeNode.kind === ts.SyntaxKind.AnyKeyword) {
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          type: 'as-any',
          context: extractContext(node, sourceFile),
          category: 'type-assertion'
        });
      }
    }

    // Check for implicit any (parameters without type annotations)
    if (ts.isParameter(node) && !node.type && !node.initializer) {
      const parent = node.parent;
      // Skip if it's in a .js file or if parent is a catch clause
      if (!filePath.endsWith('.js') && !ts.isCatchClause(parent)) {
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          type: 'implicit-any',
          context: extractContext(node, sourceFile),
          category: 'function-parameter'
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

/**
 * Identify common patterns in violations
 */
function identifyPatterns(violations: TypeViolation[]): Array<{ pattern: string; count: number; examples: string[] }> {
  const patterns = new Map<string, { count: number; examples: Set<string> }>();

  // Common patterns to look for
  const patternMatchers = [
    { name: 'catch-error', regex: /catch\s*\([^)]*\)/ },
    { name: 'event-handler', regex: /on[A-Z]\w+\s*[=:]\s*\([^)]*\)/ },
    { name: 'array-map', regex: /\.map\s*\([^)]*\)/ },
    { name: 'array-filter', regex: /\.filter\s*\([^)]*\)/ },
    { name: 'array-reduce', regex: /\.reduce\s*\([^)]*\)/ },
    { name: 'promise-then', regex: /\.then\s*\([^)]*\)/ },
    { name: 'promise-catch', regex: /\.catch\s*\([^)]*\)/ },
    { name: 'type-assertion', regex: /as\s+any/ },
    { name: 'any-array', regex: /:\s*any\[\]/ },
    { name: 'any-object', regex: /:\s*\{\s*\[key:\s*string\]:\s*any/ },
    { name: 'Record-any', regex: /Record<[^,]+,\s*any>/ },
    { name: 'useState-any', regex: /useState<any>/ },
    { name: 'useRef-any', regex: /useRef<any>/ },
  ];

  violations.forEach(violation => {
    patternMatchers.forEach(({ name, regex }) => {
      if (regex.test(violation.context)) {
        if (!patterns.has(name)) {
          patterns.set(name, { count: 0, examples: new Set() });
        }
        const pattern = patterns.get(name)!;
        pattern.count++;
        if (pattern.examples.size < 3) {
          pattern.examples.add(`${path.basename(violation.file)}:${violation.line} - ${violation.context.substring(0, 80)}`);
        }
      }
    });
  });

  return Array.from(patterns.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      examples: Array.from(data.examples)
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Main analysis function
 */
async function analyzeTypeViolations() {
  console.log('🔍 Analyzing type safety violations...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: [
      '**/node_modules/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.d.ts'
    ],
  });

  console.log(`📁 Found ${files.length} TypeScript files to analyze\n`);

  const allViolations: TypeViolation[] = [];

  // Analyze each file
  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const violations = analyzeFile(filePath);
    allViolations.push(...violations);
  }

  // Generate statistics
  const stats: ViolationStats = {
    totalViolations: allViolations.length,
    byType: {},
    byCategory: {},
    byFile: {},
    topFiles: [],
    patterns: []
  };

  // Count by type
  allViolations.forEach(v => {
    stats.byType[v.type] = (stats.byType[v.type] || 0) + 1;
    stats.byCategory[v.category || 'uncategorized'] = (stats.byCategory[v.category || 'uncategorized'] || 0) + 1;
    const relPath = path.relative(process.cwd(), v.file);
    stats.byFile[relPath] = (stats.byFile[relPath] || 0) + 1;
  });

  // Get top files with violations
  stats.topFiles = Object.entries(stats.byFile)
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Identify patterns
  stats.patterns = identifyPatterns(allViolations);

  // Print results
  console.log('📊 Type Safety Violation Analysis Report');
  console.log('=' .repeat(50));

  console.log(`\n📈 Total Violations: ${stats.totalViolations}`);

  console.log('\n📋 Violations by Type:');
  Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percentage = ((count / stats.totalViolations) * 100).toFixed(1);
      console.log(`   ${type}: ${count} (${percentage}%)`);
    });

  console.log('\n🏷️ Violations by Category:');
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const percentage = ((count / stats.totalViolations) * 100).toFixed(1);
      console.log(`   ${category}: ${count} (${percentage}%)`);
    });

  console.log('\n📁 Top 10 Files with Most Violations:');
  stats.topFiles.forEach(({ file, count }) => {
    console.log(`   ${count} - ${file}`);
  });

  console.log('\n🔍 Common Patterns:');
  stats.patterns.forEach(({ pattern, count, examples }) => {
    console.log(`\n   ${pattern}: ${count} occurrences`);
    examples.forEach(example => {
      console.log(`      ${example}`);
    });
  });

  // Save detailed report
  const reportPath = path.join(process.cwd(), 'TYPE-VIOLATIONS-ANALYSIS.json');
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);

  // Provide recommendations
  console.log('\n💡 Recommendations:');
  console.log('1. Start with error-handling category (safest to fix)');
  console.log('2. Use unknown + type guards for API responses');
  console.log('3. Create proper types for event handlers');
  console.log('4. Replace any[] with proper array types');
  console.log('5. Use Record<string, unknown> instead of Record<string, any>');

  return stats;
}

// Run the analysis
analyzeTypeViolations().catch(console.error);