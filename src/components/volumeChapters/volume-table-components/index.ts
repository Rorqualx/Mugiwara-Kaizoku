/**
 * VolumeChaptersTable Sub-components
 *
 * Barrel export for extracted sub-components.
 *
 * @module components/volumeChapters/volume-table-components
 */

// Components
import { VolumeContent } from './VolumeContent';
import { VolumeHeader } from './VolumeHeader';
import { VolumeModals } from './VolumeModals';

export { VolumeHeader, VolumeContent, VolumeModals };

// Types
export type {
  VolumeHeaderProps,
  VolumeHeaderActionsWrapperProps,
  VolumeContentProps,
  VolumeModalsProps
} from './types';
