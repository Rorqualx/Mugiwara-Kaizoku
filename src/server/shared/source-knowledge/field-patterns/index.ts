/**
 * Field Patterns
 *
 * Re-exports all field pattern maps for each source.
 *
 * @module shared/source-knowledge/field-patterns
 */

export type { FieldPatternMap, DataSourceMap, LabelMap } from './types';

export {
  FANDOM_LABEL_PATTERNS,
  FANDOM_DATA_SOURCE_MAP,
  FANDOM_LABEL_MAP,
  FANDOM_AUTHOR_KEYS,
  FANDOM_ARTIST_KEYS,
  FANDOM_PUBLISHER_KEYS,
  FANDOM_MAGAZINE_KEYS,
} from './fandom-patterns';

export {
  COMICVINE_LABEL_PATTERNS,
  COMICVINE_WRITER_LABELS,
  COMICVINE_ARTIST_LABELS,
} from './comicvine-patterns';

export { WIKIPEDIA_LABEL_PATTERNS } from './wikipedia-patterns';
