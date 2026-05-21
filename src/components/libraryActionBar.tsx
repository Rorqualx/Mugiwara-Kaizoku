/**
 * LibraryActionBar component for library detail pages
 *
 * This file re-exports the refactored LibraryActionBar component from the
 * library-action-bar module. The component has been decomposed into smaller
 * sub-components for better maintainability and reduced complexity.
 *
 * @see ./library-action-bar/LibraryActionBar.tsx - Main component
 * @see ./library-action-bar/components/ - Sub-components
 * @see ./library-action-bar/hooks/ - Custom hooks
 * @see ./library-action-bar/types.ts - Type definitions
 */

export { LibraryActionBar } from './library-action-bar';
export type { LibraryActionBarProps, MangaEntity } from './library-action-bar';
