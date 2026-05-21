/**
 * Annotation Labels Components - Barrel Export
 *
 * Components for displaying and editing document/image labels
 * in the ML training data workflow.
 *
 * @module components/annotation/labels
 */

// Document Label Components
export {
  DocumentLabelBadges,
  CategoryBadge,
  QualityBadge,
  UseCaseBadges,
  CATEGORY_CONFIG,
  QUALITY_CONFIG,
  USE_CASE_CONFIG,
} from './DocumentLabelBadges';
export type { DocumentLabelBadgesProps } from './DocumentLabelBadges';

// Quality Tier Filter Components
export {
  QualityTierFilter,
  DocumentLabelFilters,
  QUALITY_OPTIONS,
  CATEGORY_OPTIONS,
  USE_CASE_OPTIONS,
} from './QualityTierFilter';
export type {
  QualityTierFilterProps,
  DocumentLabelFiltersProps,
} from './QualityTierFilter';

// Image Label Components
export {
  ImageLabelCard,
  ImageLabelSummary,
  IMAGE_TYPE_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  CONTENT_TYPE_OPTIONS,
} from './ImageLabelCard';
export type {
  ImageLabelCardProps,
  ImageLabelSummaryProps,
} from './ImageLabelCard';
