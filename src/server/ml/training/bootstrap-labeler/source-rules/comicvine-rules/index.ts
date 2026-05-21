/**
 * ComicVine Source-Specific Rules
 *
 * Combines all ComicVine rules from submodules.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules
 */


import { CONTENT_RULES } from './content-rules';
import { CREATOR_RULES } from './creator-rules';
import { IMAGE_RULES } from './image-rules';
import { METADATA_RULES } from './metadata-rules';
import { TITLE_RULES } from './title-rules';

import type { SourceRule } from '../types';

// ============================================================================
// Combined ComicVine Rules
// ============================================================================

export const COMICVINE_RULES: SourceRule[] = [
  ...TITLE_RULES,
  ...IMAGE_RULES,
  ...CREATOR_RULES,
  ...METADATA_RULES,
  ...CONTENT_RULES,
];

// Re-export submodules for testing
export { CONTENT_RULES } from './content-rules';
export { CREATOR_RULES } from './creator-rules';
export { IMAGE_RULES } from './image-rules';
export { METADATA_RULES } from './metadata-rules';
export { TITLE_RULES } from './title-rules';

// Re-export page type detection for testing and external use
export {
  detectComicVinePageType,
  isLabelableComicVinePage,
  isComicVineVolumePage,
  isComicVineIssuePage,
} from './helpers';
export type { ComicVinePageType } from './helpers';
