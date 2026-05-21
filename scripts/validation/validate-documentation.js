#!/usr/bin/env node
/**
 * Documentation Validator
 * Validates documentation files for consistency and correctness
 *
 * Usage: node scripts/validation/validate-documentation.js
 */

const fs = require('fs');
const path = require('path');

// Legacy/historical doc folders not worth gating CI on. These hold
// pre-public-release artifacts (session notes, archived plans, upstream-
// project leftovers, templates) with hundreds of stale cross-references
// that would never be fixed and have no bearing on user-facing docs.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'archive',
  'kapowarr',
  'templates',
  'sessions',
  'reports',
  'fixes-summaries',
]);

function findMarkdownFiles(dir = 'docs', files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const errors = [];
  const warnings = [];

  // Check for broken internal links
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const linkText = match[1];
    const linkTarget = match[2];

    // Skip external links
    if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
      continue;
    }

    // Check internal file links
    if (linkTarget.startsWith('./') || linkTarget.startsWith('../') || !linkTarget.startsWith('#')) {
      // Remove anchor if present
      const [filePart] = linkTarget.split('#');

      // Resolve relative path
      const dir = path.dirname(filePath);
      const targetPath = path.resolve(dir, filePart);

      if (!fs.existsSync(targetPath)) {
        errors.push({
          file: filePath,
          line: getLineNumber(content, match.index),
          message: `Broken link: ${linkTarget} -> ${targetPath} does not exist`,
        });
      }
    }
  }

  // Check for common issues
  if (content.includes('TODO:') || content.includes('FIXME:')) {
    warnings.push({
      file: filePath,
      message: 'Contains TODO or FIXME markers',
    });
  }

  // Check for empty sections
  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  const headings = [];
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push({
      level: match[0].indexOf(' '),
      title: match[1],
      line: getLineNumber(content, match.index),
    });
  }

  // Check if sections have content
  for (let i = 0; i < headings.length - 1; i++) {
    const currentHeading = headings[i];
    const nextHeading = headings[i + 1];

    const sectionStart = currentHeading.line;
    const sectionEnd = nextHeading.line;

    // If only 1-2 lines between headings, likely empty
    if (sectionEnd - sectionStart <= 2) {
      warnings.push({
        file: filePath,
        line: sectionStart,
        message: `Potentially empty section: "${currentHeading.title}"`,
      });
    }
  }

  return { errors, warnings };
}

function getLineNumber(content, charIndex) {
  const before = content.substring(0, charIndex);
  return before.split('\n').length;
}

function generateReport(results) {
  let totalErrors = 0;
  let totalWarnings = 0;

  const errorFiles = [];
  const warningFiles = [];

  for (const [file, result] of Object.entries(results)) {
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    if (result.errors.length > 0) {
      errorFiles.push({ file, errors: result.errors });
    }
    if (result.warnings.length > 0) {
      warningFiles.push({ file, warnings: result.warnings });
    }
  }

  console.log('\n📚 Documentation Validation Results\n');
  console.log(`Errors found: ${totalErrors}`);
  console.log(`Warnings found: ${totalWarnings}\n`);

  if (totalErrors > 0) {
    console.log('❌ Errors:\n');
    for (const { file, errors } of errorFiles) {
      console.log(`  ${file}:`);
      for (const error of errors) {
        console.log(`    Line ${error.line}: ${error.message}`);
      }
      console.log('');
    }
  }

  if (totalWarnings > 0) {
    console.log('⚠️  Warnings:\n');
    for (const { file, warnings } of warningFiles) {
      console.log(`  ${file}:`);
      for (const warning of warnings) {
        if (warning.line) {
          console.log(`    Line ${warning.line}: ${warning.message}`);
        } else {
          console.log(`    ${warning.message}`);
        }
      }
      console.log('');
    }
  }

  return { totalErrors, totalWarnings };
}

// Main execution
function main() {
  console.log('🔍 Validating documentation...');

  // Find all markdown files in docs/
  const markdownFiles = findMarkdownFiles();

  console.log(`Found ${markdownFiles.length} documentation files\n`);

  if (markdownFiles.length === 0) {
    console.log('⚠️  No documentation files found in docs/');
    process.exit(0);
  }

  const results = {};

  for (const file of markdownFiles) {
    results[file] = validateMarkdownFile(file);
  }

  const { totalErrors, totalWarnings } = generateReport(results);

  if (totalErrors > 0) {
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('✅ Validation passed with warnings');
    process.exit(0);
  } else {
    console.log('✅ All documentation validated successfully');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findMarkdownFiles, validateMarkdownFile, generateReport };
