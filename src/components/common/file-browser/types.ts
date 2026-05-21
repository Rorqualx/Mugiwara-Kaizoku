/**
 * Types for File Browser components
 *
 * Re-exports DirectoryEntry from hooks to maintain single source of truth
 */

// Import DirectoryEntry from hooks for local use and re-export
import type { DirectoryEntry } from '@/hooks/file-browser/types';

export type { DirectoryEntry };

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export interface DirectoryEntryProps {
  entry: DirectoryEntry;
  onNavigate: (path: string) => void;
}

export interface ErrorDisplayProps {
  error: unknown;
}

export interface LoadingStateProps {
  message?: string;
}

export interface ManualPathInputProps {
  manualPath: string;
  onManualPathChange: (path: string) => void;
  onManualPathSubmit: () => void;
}

export interface ActionsProps {
  onClose: () => void;
  onSelectCurrent: () => void;
  isSelectDisabled: boolean;
}