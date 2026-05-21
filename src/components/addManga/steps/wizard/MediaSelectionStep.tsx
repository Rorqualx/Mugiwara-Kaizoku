/**
 * Media Selection Step - Re-export
 *
 * This file re-exports from the decomposed media-selection module
 * for backward compatibility.
 *
 * The component has been refactored into:
 * - media-selection/utils.ts - Shared utilities and types
 * - media-selection/hooks.ts - Custom hooks
 * - media-selection/CoverImageCard.tsx - Cover image component
 * - media-selection/VolumeCoversPanel.tsx - Volume covers panel
 * - media-selection/ChapterCoversPanel.tsx - Chapter covers panel
 * - media-selection/GalleryPanel.tsx - Gallery panel
 * - media-selection/index.tsx - Main aggregator component
 *
 * Original: 1000 lines → Refactored: 7 modules (~1100 total, max 250 each)
 */

export { MediaSelectionStep, default } from './media-selection';
export type { MediaSelectionStepProps, MediaGallery, Logger } from './media-selection';
