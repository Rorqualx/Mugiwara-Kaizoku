/**
 * Library Manager Type Definitions
 *
 * Shared types and interfaces for all library manager modules.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 196-209)
 *
 * @module components/library/library-manager/types
 */

import type { LibraryEntity } from '@/types/search.types';

// ============================================================================
// Directory Browse Types
// ============================================================================

/**
 * Represents a directory entry in the file system browser
 */
export interface DirectoryEntry {
    /** Directory or file name */
    name: string;
    /** Full path to the directory or file */
    path: string;
    /** Whether this entry is a directory */
    isDirectory: boolean;
    /** Whether the current user has access to this directory */
    isAccessible: boolean;
}

/**
 * Browse operation result data structure
 */
export interface BrowseResultData {
    /** Current directory path being viewed */
    currentPath: string;
    /** Parent directory path, null if at root */
    parent: string | null;
    /** List of directory entries in current path */
    entries: DirectoryEntry[];
}


// ============================================================================
// Component Prop Types
// ============================================================================

/**
 * Props for LibrarySelector component
 */
export interface LibrarySelectorProps {
    /** Available libraries to select from */
    libraries: LibraryEntity[];
    /** Currently selected library ID */
    selectedLibraryId: string;
    /** Callback when library selection changes */
    onSelectLibrary: (id: string) => void;
    /** Callback when a new library is created (to refresh list) */
    onLibraryCreated?: () => void;
}

/**
 * Props for DirectorySelector component
 */
export interface DirectorySelectorProps {
    /** Whether manual path entry is enabled */
    manualPath: boolean;
    /** Current scan path input value */
    scanPathInput: string;
    /** Callback when manual path checkbox changes */
    onManualPathChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    /** Callback when scan path input changes */
    onScanPathInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    /** Callback when browse button clicked */
    onBrowse: () => void;
}

/**
 * Props for ScanStatus component
 */
export interface ScanStatusProps {
    /** Whether a scan is currently in progress */
    scanning: boolean;
    /** Current scan status message */
    scanProgressStatus: string;
    /** Error message, null if no error */
    error: string | null;
}

/**
 * Props for ScanControls component
 */
export interface ScanControlsProps {
    /** Callback when scan button clicked */
    onScan: () => void | Promise<void>;
    /** Callback when stop scan button clicked */
    onStopScan: () => void;
    /** Whether controls should be disabled */
    disabled: boolean;
    /** Whether a scan is currently running */
    scanning: boolean;
}

/**
 * Props for BrowseDirectoryModal component
 */
export interface BrowseDirectoryModalProps {
    /** Whether the modal is open */
    opened: boolean;
    /** Browse operation result payload */
    browseResult: BrowseResultData | undefined;
    /** Whether browse operation is loading */
    isBrowseLoading: boolean;
    /** Browse query error, if any (errors now arrive via tRPC's error channel) */
    browseError?: unknown;
    /** Current path being browsed */
    currentBrowsePath: string;
    /** Callback to navigate to a different path */
    onNavigateToPath: (path: string) => void;
    /** Callback when a directory is selected */
    onSelectDirectory: (path: string) => void;
    /** Callback to close the modal */
    onClose: () => void;
    /** Callback to set the current browse path */
    setCurrentBrowsePath: (path: string) => void;
}
