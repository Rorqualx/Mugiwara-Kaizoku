/**
 * Confirmation Data Builder - Re-export Module
 *
 * This file re-exports the modular confirmation data builder.
 * The implementation has been decomposed into specialized modules
 * in the confirmation-data-builder/ directory.
 *
 * @see confirmation-data-builder/index.ts for the main implementation
 * @module components/addManga/form/confirmation-data-builder
 */

export {
  buildConfirmationData,
  type VolumeDetail,
  type MetadataObject,
  type RawDataObject,
  type ProviderSpecificObject,
  type MangaWithDynamicMetadata,
  type ConfirmationDataObject,
  type PublisherObject,
} from './confirmation-data-builder/index';
