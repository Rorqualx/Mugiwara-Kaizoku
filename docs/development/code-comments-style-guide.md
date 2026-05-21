# Code Comments Style Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Code Comments Style Guide

---
# Kaizoku Code Comments Style Guide

This document outlines the standards and best practices for code comments in the Kaizoku application. Following these guidelines will ensure consistent, informative, and maintainable documentation throughout the codebase.

## General Principles

1. **Be Concise and Clear**: Write comments that are easy to understand and provide value.
2. **Document Why, Not Just What**: Explain the reasoning behind complex code, not just what it does.
3. **Keep Comments Updated**: When code changes, update the related comments.
4. **Use Proper Grammar and Spelling**: Maintain professional standards in all documentation.
5. **Avoid Redundancy**: Don't comment on obvious code; focus on complex logic and edge cases.

## JSDoc Comments

Use JSDoc-style comments for functions, classes, and methods. This enables better IDE integration and documentation generation.

### Function/Method Documentation

```typescript
/**
 * Brief description of what the function does
 * 
 * Optional longer description if needed for complex functions
 *
 * @param {Type} paramName - Description of the parameter
 * @param {Type} [optionalParam] - Description of optional parameter
 * @returns {ReturnType} Description of the return value
 * @throws {ErrorType} Description of when errors are thrown
 */
function functionName(paramName, optionalParam) {
  // Implementation
}
```

### Class Documentation

```typescript
/**
 * Brief description of the class purpose
 * 
 * Optional longer description explaining the class's role in the system
 */
class ClassName {
  /**
   * Brief description of what the method does
   *
   * @param {Type} paramName - Description of the parameter
   * @returns {ReturnType} Description of the return value
   */
  methodName(paramName) {
    // Implementation
  }
}
```

### Type Definitions

```typescript
/**
 * Description of what this type represents
 * 
 * @typedef {Object} TypeName
 * @property {Type} propertyName - Description of the property
 * @property {Type} [optionalProperty] - Description of optional property
 */
```

## Inline Comments

Use inline comments for complex logic that isn't immediately obvious:

```typescript
// Skip hidden files and directories
if (entry.name.startsWith('.')) continue;

// Ensure the array exists before pushing
if (!mangaMap[mangaTitle]) {
  mangaMap[mangaTitle] = [];
}
```

## Section Comments

Use section comments to group related functionality:

```typescript
// ===== Library Management Operations =====

/**
 * Creates a new library
 */
create: procedure...

/**
 * Lists all libraries
 */
list: procedure...

// ===== Library Query Operations =====
```

## API Endpoint Documentation

For router files, document each endpoint with its purpose and behavior:

```typescript
/**
 * Creates a new library with the provided name and path
 * Validates that the path exists and is not already used by another library
 */
create: procedure
  .input(librarySchema)
  .mutation(async ({ input }) => {
    // Implementation
  }),
```

## Type Guards and Utility Functions

Document utility functions and type guards with their purpose and behavior:

```typescript
/**
 * Type guard function to check if an object is a DirectoryCheckResult
 *
 * @param {unknown} obj - The object to check
 * @returns {boolean} True if the object is a DirectoryCheckResult, false otherwise
 */
function isDirCheckResult(obj: unknown): obj is DirectoryCheckResult {
  // Implementation
}
```

## Complex Logic Explanation

Add explanatory comments for complex operations:

```typescript
// Create a self-referential manga object with proper date conversions
// This is necessary because the API returns dates as strings but the UI expects Date objects
const mangaWithCircularRefs = {
  ...baseManga,
  metadata: updatedManga.metadata ? {
    // Convert string dates to Date objects for consistent handling
    ...updatedManga.metadata,
    createdAt: new Date(updatedManga.metadata.createdAt),
    // ...
  } : null,
};
```

## Security-Related Comments

Document security considerations and measures:

```typescript
/**
 * Checks if a path is contained within the root directory
 * 
 * This is a security function to prevent directory traversal attacks
 * by ensuring we don't scan directories outside the intended root.
 *
 * @param {string} testPath - The path to check
 * @returns {boolean} True if the path is within the root directory, false otherwise
 */
```

## Implementation Priority

When implementing comments in the codebase, prioritize in this order:

1. Core service files and utilities that are used throughout the application
2. API endpoints in router files
3. React hooks and components
4. Complex logic in data transformation and state management

## Examples from the Codebase

### Good Function Documentation

```typescript
/**
 * Scans a directory recursively for manga files
 * 
 * This function traverses a directory structure looking for manga files with supported extensions
 * (.cbz, .zip, .pdf). It organizes files by manga title, which is determined from the parent
 * directory name of each file.
 *
 * @param {string} directoryPath - The root directory path to scan
 * @returns {Promise<Record<string, string[]>>} A map of manga titles to arrays of file paths
 * @throws {TRPCError} If the directory doesn't exist or isn't accessible
 */
async function scanDirectory(directoryPath: string): Promise<Record<string, string[]>> {
  // Implementation
}
```

### Good Component Documentation

```typescript
/**
 * Displays a card representation of a manga with cover image and basic information
 * 
 * @param {MangaWithRelations} manga - The manga data to display
 * @param {Function} onRemove - Handler for manga removal
 * @param {Function} onUpdate - Handler for manga updates
 * @param {Function} onRefresh - Handler for metadata refresh
 * @param {Function} onClick - Handler for card click
 * @returns {JSX.Element} A card component displaying manga information
 */
export function MangaCard({ manga, onRemove, onUpdate, onRefresh, onClick }: MangaCardProps) {
  // Implementation
}
```

By following these guidelines, we can maintain a codebase that is well-documented, easier to understand, and more maintainable for all developers.
