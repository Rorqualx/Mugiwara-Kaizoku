/**
 * Directory Browser Utility
 *
 * Provides a standardized way to browse directories using the browser's
 * File System Access API with fallback to the legacy file input method.
 *
 * Features:
 * - Modern showDirectoryPicker API (Chrome/Edge)
 * - Fallback to webkitdirectory file input
 * - Consistent error handling
 * - Promise-based API
 */

import { logger } from './logger';

export interface DirectoryBrowserOptions {
  /**
   * Whether to allow multiple directory selection (only works with fallback method)
   */
  multiple?: boolean;
}

export interface DirectoryBrowserResult {
  /**
   * The directory path (or name if using modern API)
   */
  path: string;

  /**
   * Whether the selection was successful
   */
  success: boolean;

  /**
   * Error message if selection failed
   */
  error?: string;
}

/**
 * Opens a directory picker dialog and returns the selected directory path.
 *
 * This function attempts to use the modern File System Access API first,
 * then falls back to creating a hidden file input element.
 *
 * @param options - Options for directory selection
 * @returns Promise that resolves with the selected directory path
 */
export async function browseDirectory(
  options: DirectoryBrowserOptions = {}
): Promise<DirectoryBrowserResult> {
  logger.info('[DirectoryBrowser] Browse button clicked - attempting to open directory picker');

  try {
    // Try modern API first
    if ('showDirectoryPicker' in window) {
      logger.info('[DirectoryBrowser] showDirectoryPicker API is available');

      // @ts-ignore - showDirectoryPicker is not in TypeScript types yet
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      });

      logger.info('[DirectoryBrowser] Directory selected:', dirHandle);

      // Get the directory name
      const directoryName = dirHandle.name;
      const path = `/${directoryName}`;

      return {
        path,
        success: true
      };
    } else {
      logger.info('[DirectoryBrowser] showDirectoryPicker API is NOT available, using fallback');
    }
  } catch (err: unknown) {
    // Handle user cancellation gracefully
    if (err instanceof Error && err.name === 'AbortError') {
      logger.info('[DirectoryBrowser] User cancelled directory selection');
      return {
        path: '',
        success: false,
        error: 'Selection cancelled'
      };
    }

    logger.error('[DirectoryBrowser] Directory picker error:', err);

    // For other errors, fall through to fallback
    if (err instanceof Error && err.name !== 'AbortError') {
      logger.error('[DirectoryBrowser] Directory selection failed:', err);
    }
  }

  // Fallback to file input method
  logger.info('[DirectoryBrowser] Using file input fallback method');

  return new Promise<DirectoryBrowserResult>((resolve) => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';

    // @ts-ignore - webkitdirectory is a non-standard attribute
    input.webkitdirectory = true;
    // @ts-ignore - directory is a non-standard attribute
    input.directory = true;

    if (options.multiple) {
      input.multiple = true;
    }

    input.style.display = 'none';

    // Handle file selection
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        const file = files[0];

        if (!file) {
          resolve({
            path: '',
            success: false,
            error: 'No file selected'
          });
          return;
        }

        logger.info('[DirectoryBrowser] Selected file:', file);

        // Extract directory path from webkitRelativePath
        const path = file.webkitRelativePath;

        if (path) {
          // Get the directory path (everything before the last slash)
          const dirPath = path.substring(0, path.lastIndexOf('/'));
          logger.info('[DirectoryBrowser] Extracted directory path:', dirPath);

          resolve({
            path: `/${dirPath}`,
            success: true
          });
        } else {
          resolve({
            path: '',
            success: false,
            error: 'Could not extract directory path'
          });
        }
      } else {
        resolve({
          path: '',
          success: false,
          error: 'No directory selected'
        });
      }

      // Clean up
      document.body.removeChild(input);
    });

    // Handle cancellation
    input.addEventListener('cancel', () => {
      logger.info('[DirectoryBrowser] User cancelled directory selection (fallback)');
      resolve({
        path: '',
        success: false,
        error: 'Selection cancelled'
      });
      document.body.removeChild(input);
    });

    // Add to DOM and trigger click
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Hook to use directory browser in React components
 *
 * @returns Function to open directory browser
 */
export function useDirectoryBrowser(): { browseDirectory: typeof browseDirectory } {
  return {
    browseDirectory
  };
}
