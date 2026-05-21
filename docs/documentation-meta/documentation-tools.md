# Documentation Tools

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Documentation Tools

---
# Documentation Tools

This document describes the tools available for improving documentation coverage in the Kaizoku project.

## Overview

The Kaizoku project has a high standard for code documentation, requiring comprehensive JSDoc comments for all functions, classes, interfaces, and other definitions. To help maintain this standard, we've created several tools to automate the documentation process:

1. **analyze-code-comments.js** - Analyzes the codebase to identify files that need documentation improvements
2. **generate-jsdoc-templates.js** - Generates JSDoc templates for a single file
3. **batch-document-files.js** - Automates the process of adding JSDoc templates to multiple files

## Documentation Status

The current documentation status is tracked in [documentation-status.md](./documentation-status.md). This file shows which parts of the codebase have complete documentation and which parts still need work.

According to the latest analysis, there are **226 files** that still need documentation improvements:

| Category | Files Needing Documentation |
|----------|----------------------------|
| Router Files | 1 |
| Hook Files | 24 |
| Component Files | 102 |
| Utility Files | 3 |
| Other Files | 96 |

## Documentation Style Guide

Before using these tools, please review the [code-comments-style-guide.md](./code-comments-style-guide.md) to understand the documentation standards for the project.

## Using the Tools

### Analyzing Documentation Coverage

To analyze the current state of documentation in the codebase, run:

```bash
node scripts/Utils/analyze-code-comments.js
```

This will scan the codebase and generate a report showing which files need documentation improvements, categorized by file type and sorted by priority.

### Generating JSDoc Templates for a Single File

To generate JSDoc templates for a single file, run:

```bash
./scripts/generate-jsdoc-templates.js path/to/file.ts
```

This will output the file content with JSDoc templates added for all functions, classes, interfaces, and other definitions that are missing documentation. You can redirect this output to a file or pipe it to another command.

To update the file in place, you can use:

```bash
./scripts/generate-jsdoc-templates.js path/to/file.ts > path/to/file.ts.new && mv path/to/file.ts.new path/to/file.ts
```

If you prefer to use `node` explicitly, you can also run:

```bash
node scripts/generate-jsdoc-templates.js path/to/file.ts
```

### Batch Documentation

To automate the process of adding JSDoc templates to multiple files, use the batch-document-files.js script:

```bash
# Document all files in a directory
./scripts/batch-document-files.js --dir=src/components

# Document specific file types
./scripts/batch-document-files.js --dir=src/hooks --type=hook

# Document files with low coverage first
./scripts/batch-document-files.js --dir=src --priority=coverage

# Dry run (don't actually modify files)
./scripts/batch-document-files.js --dir=src --dry-run

# Process more files at once
./scripts/batch-document-files.js --dir=src --limit=20
```

This script will:
1. Analyze files to find those that need documentation
2. Filter files by type if specified
3. Sort files by priority
4. Generate JSDoc templates for each file
5. Write the updated files back to disk
6. Create a report of changes made

#### Options

- `--dir=<directory>` - Directory to search for files (default: current directory)
- `--type=<type>` - File type to document (router, hook, component, utility, other, all) (default: all)
- `--priority=<priority>` - Sort files by priority (definitions, coverage) (default: definitions)
- `--dry-run` - Don't actually modify files, just show what would be done
- `--limit=<number>` - Number of files to process in a single run (default: 10)
- `--no-backup` - Don't create backup files before making changes

## Best Practices

1. **Start with high-priority files** - Focus on files with the most definitions and lowest coverage first
2. **Review generated templates** - The generated templates are a starting point, but you should review and improve them
3. **Add examples** - Add examples to show how to use functions, classes, and interfaces
4. **Document edge cases** - Document edge cases, error handling, and security considerations
5. **Keep documentation up to date** - Update documentation when code changes

## Contributing to Documentation

When contributing to the documentation, please follow these guidelines:

1. Follow the [code-comments-style-guide.md](./code-comments-style-guide.md)
2. Use the tools to generate templates, but don't rely on them completely
3. Add meaningful descriptions, not just placeholders
4. Include examples for complex functions and components
5. Document parameters, return values, and thrown errors
6. Update the documentation-status.md file when you complete a section

## Troubleshooting

If you encounter issues with the documentation tools, try these steps:

1. Make sure you're running the scripts from the project root directory
2. Check that the file paths are correct
3. Verify that the files are valid TypeScript/JavaScript files
4. Look for syntax errors in the files
5. Try running the scripts with the `--dry-run` option to see what would be done without modifying files

If you still have issues, please open an issue in the project repository.
