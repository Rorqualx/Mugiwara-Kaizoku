/**
 * MetadataSelectionStep Types
 *
 * Type definitions and interfaces for the MetadataSelectionStep component
 * and all its sub-components.
 */

import type { WizardFormData } from '@/types/universalImportWizard.types';

/**
 * Logger interface - matches the Logger class from @/utils/logger
 */
export interface Logger {
  info(message: string, context?: unknown): void;
  error(message: string, error?: Error | unknown, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}

/**
 * Main component props for MetadataSelectionStep
 */
export interface MetadataSelectionStepProps {
  metadataUrl: string;
  setMetadataUrl: (url: string) => void;
  handleMetadataUrlParse: () => void;
  isValidatingMetadataUrl: boolean;
  selectedMetadata: Partial<WizardFormData>;
  setSelectedMetadata: React.Dispatch<React.SetStateAction<Partial<WizardFormData>>>;
  statusOptions: { value: string; label: string }[];
  formatOptions: { value: string; label: string }[];
  getFieldOptions: (field: string) => { value: string; label: string }[];
  getExternalIdOptions: (idType: string) => { value: string; label: string }[];
  demographicOptions: { value: string; label: string }[];
  logger: Logger;
  descriptionEditMode: Record<string, boolean>;
  setDescriptionEditMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedSourcesMetadata: Record<string, unknown>;
  /** Array of selected source provider names (e.g., ['fandom', 'comicvine']) */
  selectedSources: string[];
  externalIds: Record<string, string>;
  setExternalIds: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  externalLinks: string[];
  setExternalLinks: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Base props shared by all section components
 */
export interface BaseSectionProps {
  selectedMetadata: Partial<WizardFormData>;
  setSelectedMetadata: React.Dispatch<React.SetStateAction<Partial<WizardFormData>>>;
  getFieldOptions: (field: string) => { value: string; label: string }[];
}

/**
 * Status & Format section props
 */
export interface StatusFormatSectionProps extends BaseSectionProps {
  statusOptions: { value: string; label: string }[];
  formatOptions: { value: string; label: string }[];
}

/**
 * Descriptions section props
 */
export interface DescriptionsSectionProps extends BaseSectionProps {
  descriptionEditMode: Record<string, boolean>;
  setDescriptionEditMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  additionalDescriptions: string[];
  handleAddDescription: () => void;
  handleUpdateAdditionalDescription: (index: number, value: string) => void;
  handleRemoveAdditionalDescription: (index: number) => void;
}

/**
 * Genres/Tags/Themes section props
 */
export interface GenresTagsThemesSectionProps extends BaseSectionProps {
  // Uses base props only
}

/**
 * Creators section props
 */
export interface CreatorsSectionProps extends BaseSectionProps {
  logger: Logger;
}

/**
 * Publication section props
 */
export interface PublicationSectionProps extends BaseSectionProps {
  // Uses base props only
}

/**
 * Volumes/Chapters section props
 */
export interface VolumesChaptersSectionProps extends BaseSectionProps {
  // Uses base props only
}

/**
 * Alternative Titles section props
 */
export interface AlternativeTitlesSectionProps extends BaseSectionProps {
  logger: Logger;
}

/**
 * External IDs section props
 */
export interface ExternalIdsSectionProps {
  externalIds: Record<string, string>;
  setExternalIds: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getExternalIdOptions: (idType: string) => { value: string; label: string }[];
}

/**
 * External Links section props
 */
export interface ExternalLinksSectionProps {
  externalLinks: string[];
  setExternalLinks: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Option type for select components
 */
export interface SelectOption {
  value: string;
  label: string;
}
