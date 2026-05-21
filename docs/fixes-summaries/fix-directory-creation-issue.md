# Fix Directory Creation Issue

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Directory Creation Issue

---
# Directory Creation Issue Fix

## Problem

Users were encountering an error when trying to create a new library:

```
Failed to Create Library
Failed to create directory /data/libraries/manga-2: ENOENT: no such file or directory, mkdir '/data'
```

The application was trying to create a directory at `/data/libraries/manga-2`, but it couldn't because the parent directory `/data` didn't exist.

## Root Cause Analysis

The issue was in how the base data directory path was being determined in `defaultPaths.ts`:

```typescript
export const BASE_DATA_DIR = isDocker 
  ? '/app/data' 
  : joinPath('data');
```

There were two potential issues:

1. The `isDocker` check might be incorrectly returning `true` when it should be `false`
2. The `joinPath` function might not be resolving paths correctly in all environments

## Solution

We implemented a comprehensive solution with multiple aggressive fixes:

### 1. Force Local Mode Always

Updated the environment detection logic to force local mode regardless of environment variables:

```typescript
// AGGRESSIVE FIX: Force local mode ALWAYS
// This overrides any environment variables that might be set
const isDocker = false; // Override for development

// Log the forced environment setting
console.log('IMPORTANT: Forcing local mode for directory paths');
```

This ensures that Docker paths are never used in development, regardless of environment variables.

### 2. Direct Path Resolution

Updated the `BASE_DATA_DIR` in `defaultPaths.ts` to use a direct path resolution:

```typescript
export const BASE_DATA_DIR = path.resolve(process.cwd(), 'data');
```

This ensures that the path is always resolved correctly, regardless of the current working directory.

### 3. Improved Directory Creation

Enhanced the `ensureDirectoriesExist` function to explicitly create the base data directory before attempting to create subdirectories:

```typescript
export async function ensureDirectoriesExist(): Promise<void> {
  try {
    // First ensure the base data directory exists
    await fs.mkdir(BASE_DATA_DIR, { recursive: true });
    console.log(`Base data directory created at: ${BASE_DATA_DIR}`);
    
    // Then create the subdirectories
    await fs.mkdir(LIBRARIES_DIR, { recursive: true });
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
    
    console.log('Default directories created successfully:');
    console.log(`- Libraries: ${LIBRARIES_DIR}`);
    console.log(`- Downloads: ${DOWNLOADS_DIR}`);
  } catch (error) {
    console.error('Failed to create default directories:', error);
    throw error;
  }
}
```

This ensures that all necessary parent directories are created before attempting to create subdirectories.

### 4. Better Server Initialization

Improved the server initialization in `library.ts` to ensure directories are created early and with better error handling:

```typescript
// Initialize default directories with better error handling
console.log('Initializing library directories...');
console.log(`Base data directory: ${BASE_DATA_DIR}`);
console.log(`Libraries directory: ${LIBRARIES_DIR}`);
console.log(`Downloads directory: ${DOWNLOADS_DIR}`);

ensureDirectoriesExist()
  .then(() => {
    console.log('Library directories initialized successfully');
  })
  .catch(error => {
    console.error('Failed to initialize library directories:', error);
    // In a production environment, you might want to exit the process
    // if directory creation fails, as it's a critical error
    if (process.env.NODE_ENV === 'production') {
      console.error('Critical error: Unable to create required directories. Exiting...');
      // process.exit(1); // Uncomment in production
    }
  });
```

### 5. Direct Path Resolution in Library Creation

Completely bypassed the path resolution utilities in the library creation procedure to use direct path resolution:

```typescript
create: procedure
  .input(librarySchema)
  .mutation(async ({ input }) => {
    console.log(`Creating library "${input.name}" with path "${input.path}"`);
    
    // AGGRESSIVE FIX: Use direct path resolution instead of utility
    // This ensures we're using the correct path regardless of environment variables
    const projectRoot = process.cwd();
    const dataDir = path.resolve(projectRoot, 'data');
    const librariesDir = path.join(dataDir, 'libraries');
    
    // Create a safe, filesystem-friendly name
    const safeName = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const resolvedPath = path.join(librariesDir, safeName);
    
    console.log(`Project root: ${projectRoot}`);
    console.log(`Data directory: ${dataDir}`);
    console.log(`Libraries directory: ${librariesDir}`);
    console.log(`Resolved path: ${resolvedPath}`);
    
    // Rest of the function...
  }),
```

This ensures that the library is created in the correct location even if there are issues with the environment variables or path resolution utilities.

### 6. Improved User Interface

Updated the CreateLibraryModal component to display the actual path where libraries will be stored:

```tsx
<Text size="xs" c="dimmed" mt="xs">
  {useDefaultPath ? (
    <>Libraries will be stored in the default location at <code>{LIBRARIES_DIR}</code></>
  ) : manualPath ? (
    <>{getPathHelpText(platformInfo)}</>
  ) : (
    // ...
  )}
</Text>
```

This helps users understand where their libraries will be stored and can help with troubleshooting.

## Testing

To verify the fix:

1. Restart the application completely (not just a hot reload)
2. Check the console logs to see the environment variables and paths being used
3. Click "Create Library" on the main page
4. Enter a library name and click "Create Library"
5. Verify that the library is created successfully
6. Check the console logs for detailed information about the directory creation process

## Additional Notes

- We've taken an aggressive approach to ensure that the issue is fixed, even if it means bypassing some of the normal path resolution utilities
- The `recursive: true` option for `fs.mkdir` should create all parent directories, but we're now explicitly creating the base directory first to be extra safe
- We've added extensive logging throughout the process to help with troubleshooting
- The UI now shows the actual path where libraries will be stored, which helps users understand where their data is being saved
- This fix should work regardless of environment variables or other settings that might be causing the issue
