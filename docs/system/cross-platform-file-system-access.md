# Cross Platform File System Access

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Cross Platform File System Access

---
# Cross-Platform File System Access Implementation

This document describes the implementation of cross-platform file system access in the application, specifically for the library creation functionality.

## Overview

The File System Access API is a modern web API that allows web applications to interact with the user's local file system. However, it's not universally supported across all browsers and platforms. This implementation provides a robust solution that works across different platforms (Windows, macOS, Linux, Android) and browsers (Chrome, Firefox, Safari, Edge).

## Components

### 1. TypeScript Definitions (`src/types/file-system-access.d.ts`)

This file provides TypeScript type definitions for the File System Access API, which is still experimental and not fully supported in all browsers. It includes:

- Interface definitions for `FileSystemHandle`, `FileSystemFileHandle`, and `FileSystemDirectoryHandle`
- Type definitions for various options objects used with the API
- Window interface extensions for the directory and file picker methods
- Support for vendor-prefixed versions of the API (webkit, moz)

### 2. Platform Utilities (`src/utils/platformUtils.ts`)

This module provides utilities for platform detection and browser capability checking:

- `detectPlatform()`: Detects the user's operating system, browser, and whether they're on a mobile device
- `checkFileSystemApiSupport()`: Checks if the File System Access API is supported in the current browser
- `showDirectoryPicker()`: Cross-platform implementation of the directory picker that handles different browser implementations
- `getPathPlaceholder()` and `getPathHelpText()`: Platform-specific helper functions for UI text

### 3. Default Paths Utilities (`src/utils/defaultPaths.ts`)

This module centralizes path management for libraries and downloads:

- Provides environment-aware path resolution (Docker vs. local)
- Defines default directories for libraries and downloads
- Ensures directories exist automatically
- Offers helper functions for path generation and resolution

### 4. Create Library Modal (`src/components/library/CreateLibraryModal.tsx`)

The modal component for creating new libraries has been enhanced with:

- Platform detection and API support checking
- Cross-platform directory selection
- Platform-specific help text and placeholders
- Improved error handling
- Debug logging for troubleshooting

## How It Works

1. **Platform Detection**: When the CreateLibraryModal component mounts, it detects the user's platform and checks if the File System Access API is supported.

2. **Directory Selection**:
   - If the API is supported, the "Browse" button will open a native directory picker dialog.
   - The implementation automatically detects and uses the appropriate version of the API for the current browser.
   - If the API is not supported, the user is prompted to enter the path manually.

3. **Path Handling**:
   - If "Use default library location" is checked, the path is automatically generated based on the library name.
   - If the user selects a directory using the picker, the path is set based on the selected directory.
   - Platform-specific help text and placeholders guide the user in entering the correct path format.

4. **Error Handling**:
   - Comprehensive error handling for API detection and directory selection.
   - User-friendly error messages for common issues.
   - Debug logging for troubleshooting.

## Browser Compatibility

| Browser | Platform | Support Level |
|---------|----------|---------------|
| Chrome  | Desktop  | Full          |
| Edge    | Desktop  | Full          |
| Firefox | Desktop  | Limited       |
| Safari  | Desktop  | Limited       |
| Chrome  | Android  | Limited       |
| Safari  | iOS      | Very Limited  |

## Debugging

The implementation includes extensive debug logging to help diagnose issues:

- Platform detection results
- API support detection
- Directory selection attempts
- Error details

To view these logs, open the browser's developer console.

## Future Improvements

1. **Fallback Mechanism**: Implement a more robust fallback mechanism for browsers that don't support the File System Access API, such as a hidden file input with the `webkitdirectory` attribute.

2. **Path Resolution**: Improve the path resolution logic to handle more complex scenarios, such as relative paths and symlinks.

3. **Permission Handling**: Add better handling for permission requests and denials.

4. **Mobile Support**: Enhance support for mobile browsers, particularly on Android where file system access is more restricted.

5. **Persistent Permissions**: Implement persistent permissions for frequently accessed directories.
