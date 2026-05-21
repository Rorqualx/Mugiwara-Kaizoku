#!/usr/bin/env node
/**
 * Cross-Reference Validator
 * Checks for broken cross-references in documentation
 *
 * Usage: node scripts/validation/validate-cross-references.js [--fix=false]
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fix: true, // Default to true for backwards compatibility
  };

  for (const arg of args) {
    if (arg.startsWith('--fix=')) {
      options.fix = arg.split('=')[1] === 'true';
    }
  }

  return options;
}

function findMarkdownFiles(dir = 'docs', files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', '.git'].includes(entry.name)) {
        continue;
      }
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractCrossReferences(content, filePath) {
  const references = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const linkText = match[1];
    const linkTarget = match[2];

    // Skip external links
    if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
      continue;
    }

    // Skip anchor-only links (same page)
    if (linkTarget.startsWith('#')) {
      continue;
    }

    references.push({
      text: linkText,
      target: linkTarget,
      line: getLineNumber(content, match.index),
    });
  }

  return references;
}

function getLineNumber(content, charIndex) {
  const before = content.substring(0, charIndex);
  return before.split('\n').length;
}

function validateCrossReferences(files) {
  const results = {
    totalFiles: 0,
    filesWithIssues: 0,
    issues: [],
  };

  for (const file of files) {
    results.totalFiles++;

    const content = fs.readFileSync(file, 'utf-8');
    const references = extractCrossReferences(content, file);

    const fileIssues = [];

    for (const ref of references) {
      const [filePart, anchor] = ref.target.split('#');

      // Resolve relative path
      const dir = path.dirname(file);
      const targetPath = filePart ? path.resolve(dir, filePart) : file;

      // Check if target file exists
      if (!fs.existsSync(targetPath)) {
        fileIssues.push({
          line: ref.line,
          issue: 'broken-link',
          message: `Broken link: ${ref.target} (file not found: ${targetPath})`,
        });
        continue;
      }

      // Check if anchor exists (if specified)
      if (anchor && filePart) {
        const targetContent = fs.readFileSync(targetPath, 'utf-8');
        const anchorPattern = new RegExp(`#{1,6}\\s+${anchor}|name="${anchor}"|id="${anchor}"`, 'i');

        if (!anchorPattern.test(targetContent)) {
          fileIssues.push({
            line: ref.line,
            issue: 'broken-anchor',
            message: `Broken anchor: ${ref.target} (anchor #${anchor} not found in ${targetPath})`,
          });
        }
      }
    }

    if (fileIssues.length > 0) {
      results.filesWithIssues++;
      results.issues.push({
        file,
        issues: fileIssues,
      });
    }
  }

  return results;
}

function printResults(results) {
  console.log('\n🔗 Cross-Reference Validation Results\n');
  console.log(`Total files checked: ${results.totalFiles}`);
  console.log(`Files with issues: ${results.filesWithIssues}\n`);

  if (results.filesWithIssues > 0) {
    console.log('❌ Issues Found:\n');

    for (const { file, issues } of results.issues) {
      console.log(`File: ${file}`);
      for (const issue of issues) {
        console.log(`  Line ${issue.line}: [${issue.issue}] ${issue.message}`);
      }
      console.log('');
    }
  } else {
    console.log('✅ All cross-references are valid!');
  }
}

// Main execution
function main() {
  const options = parseArgs();

  console.log('🔍 Validating cross-references in documentation...');

  const markdownFiles = findMarkdownFiles();

  console.log(`Found ${markdownFiles.length} documentation files\n`);

  if (markdownFiles.length === 0) {
    console.log('⚠️  No documentation files found in docs/');
    process.exit(0);
  }

  const results = validateCrossReferences(markdownFiles);

  printResults(results);

  if (results.filesWithIssues > 0) {
    console.log('\n💡 Tip: Fix broken links to maintain documentation integrity\n');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findMarkdownFiles, extractCrossReferences, validateCrossReferences };
