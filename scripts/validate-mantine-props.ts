#!/usr/bin/env npx tsx

/**
 * Validation script for Mantine v7 props
 * Checks for any remaining deprecated props in the codebase
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface Violation {
  file: string;
  line: number;
  content: string;
  prop: string;
}

// Deprecated props to check
const deprecatedProps = [
  {
    pattern: /\bspacing\s*=/g,
    name: 'spacing',
    replacement: 'gap',
    components: ['Group', 'Stack', 'SimpleGrid']
  },
  {
    pattern: /\bposition\s*=/g,
    name: 'position',
    replacement: 'justify',
    components: ['Group', 'Stack'],
    valueMap: {
      'apart': 'space-between',
      'center': 'center',
      'left': 'flex-start',
      'right': 'flex-end'
    }
  },
  {
    pattern: /\bweight\s*=/g,
    name: 'weight',
    replacement: 'fw',
    components: ['Text', 'Title']
  },
  {
    pattern: /\banimate\s*=/g,
    name: 'animate',
    replacement: 'animated',
    components: ['Progress']
  },
  {
    pattern: /\banimate\s*}/g,
    name: 'animate',
    replacement: 'animated',
    components: ['Progress']
  }
];

// Additional checks for MultiSelect creatable
const additionalChecks = [
  {
    pattern: /<MultiSelect[^>]*\bcreatable/g,
    name: 'MultiSelect creatable',
    message: 'MultiSelect no longer supports creatable prop in v7'
  }
];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, .next, and other build directories
      if (!file.startsWith('.') &&
          file !== 'node_modules' &&
          file !== 'dist' &&
          file !== 'build' &&
          file !== 'backups' &&
          file !== 'out') {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // Check for deprecated props
  deprecatedProps.forEach(prop => {
    lines.forEach((line, index) => {
      if (prop.pattern.test(line)) {
        // Skip if it's in a comment
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('*')) {
          return;
        }

        violations.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          prop: prop.name
        });
      }
    });
  });

  // Check for additional patterns
  additionalChecks.forEach(check => {
    const matches = content.match(check.pattern);
    if (matches) {
      matches.forEach(match => {
        const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
        violations.push({
          file: filePath,
          line: lineNumber,
          content: match,
          prop: check.name
        });
      });
    }
  });

  return violations;
}

function main() {
  console.log(`${GREEN}Validating Mantine v7 Props${RESET}`);
  console.log('=====================================\n');

  const srcDir = join(process.cwd(), 'src');
  console.log(`Scanning directory: ${srcDir}\n`);

  const files = getAllFiles(srcDir);
  console.log(`Found ${files.length} TypeScript files to check\n`);

  const allViolations: Violation[] = [];
  let filesWithViolations = 0;

  files.forEach(file => {
    const violations = checkFile(file);
    if (violations.length > 0) {
      filesWithViolations++;
      allViolations.push(...violations);
    }
  });

  // Group violations by prop type
  const violationsByProp = new Map<string, Violation[]>();
  allViolations.forEach(violation => {
    if (!violationsByProp.has(violation.prop)) {
      violationsByProp.set(violation.prop, []);
    }
    violationsByProp.get(violation.prop)!.push(violation);
  });

  // Display results
  if (allViolations.length === 0) {
    console.log(`${GREEN}✅ No deprecated Mantine props found!${RESET}`);
    console.log('\nAll components are using Mantine v7 compatible props.');
    process.exit(0);
  } else {
    console.log(`${RED}⚠️  Found ${allViolations.length} deprecated props in ${filesWithViolations} files${RESET}\n`);

    // Show summary by prop type
    console.log(`${YELLOW}Summary by prop type:${RESET}`);
    violationsByProp.forEach((violations, prop) => {
      const propInfo = deprecatedProps.find(p => p.name === prop);
      const replacement = propInfo?.replacement || 'unknown';
      console.log(`  ${prop} → ${replacement}: ${violations.length} occurrences`);
    });

    console.log(`\n${YELLOW}Detailed violations:${RESET}\n`);

    // Show details grouped by file
    const fileGroups = new Map<string, Violation[]>();
    allViolations.forEach(violation => {
      if (!fileGroups.has(violation.file)) {
        fileGroups.set(violation.file, []);
      }
      fileGroups.get(violation.file)!.push(violation);
    });

    fileGroups.forEach((violations, file) => {
      const relativeFile = file.replace(process.cwd() + '/', '');
      console.log(`${relativeFile}:`);
      violations.forEach(v => {
        const propInfo = deprecatedProps.find(p => p.name === v.prop);
        const suggestion = propInfo?.replacement || 'unknown';
        console.log(`  Line ${v.line}: ${v.prop} → ${suggestion}`);
        console.log(`    ${v.content}`);
      });
      console.log('');
    });

    console.log(`${YELLOW}How to fix:${RESET}`);
    console.log('1. Run the migration script: ./scripts/migrate-mantine-v7.sh');
    console.log('2. Or manually update the props according to the suggestions above');
    console.log('\nMantine v7 migration guide: https://mantine.dev/migration/');

    process.exit(1);
  }
}

// Run validation
main();