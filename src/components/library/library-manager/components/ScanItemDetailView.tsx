/**
 * Scan Item Detail View Component - Re-export
 *
 * This file maintains backward compatibility by re-exporting from the refactored structure.
 *
 * The component has been refactored from 1005 lines to a modular structure:
 * - scan-item-detail-view/index.tsx - Main orchestrator (~150 lines)
 * - scan-item-detail-view/types.ts - Type definitions
 * - scan-item-detail-view/utils/ - Utility functions
 * - scan-item-detail-view/hooks/ - Custom hooks
 * - scan-item-detail-view/components/ - Step components
 *
 * @module components/library/library-manager/components/ScanItemDetailView
 */

export { ScanItemDetailView } from './scan-item-detail-view';
export type { SelectedMetadata } from './scan-item-detail-view/types';
