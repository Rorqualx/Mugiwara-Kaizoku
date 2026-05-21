/**
 * File Browser Hook Types
 *
 * Type definitions for file browser custom hooks
 */

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isAccessible: boolean;
}

export interface BrowseData {
  entries: DirectoryEntry[];
  parent?: string | undefined;
  currentPath?: string | undefined;
}

export interface DirectoryBrowsingResult {
  browseData: BrowseData | null;
  isLoading: boolean;
  error: unknown;
  hasBrowseCapability: boolean;
}

export interface FileBrowserNavigation {
  currentPath: string | undefined;
  manualPath: string;
  setManualPath: (path: string) => void;
  handleNavigate: (path: string) => void;
  handleGoUp: () => void;
  handleSelectCurrent: (onSelect: (path: string) => void, onClose: () => void) => void;
  handleManualPathSubmit: () => void;
}

export interface Breadcrumb {
  label: string;
  path: string;
}

export interface BreadcrumbsResult {
  breadcrumbs: Breadcrumb[];
  displayPath: string;
}

export interface UseDirectoryBrowsingParams {
  currentPath: string | undefined;
  opened: boolean;
  trpc: unknown;
}