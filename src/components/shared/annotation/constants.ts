/**
 * Shared Annotation Constants
 *
 * Default color mappings and keyboard shortcuts that can be extended
 * by different use cases (ML training, Custom Sources, etc.)
 *
 * @module components/shared/annotation/constants
 */

/**
 * Default entity colors for ML annotation
 * These can be overridden or extended for custom source configuration
 */
export const DEFAULT_ENTITY_COLORS: Record<string, string> = {
  // Core metadata
  TITLE: 'blue',
  ALT_TITLE: 'indigo',
  AUTHOR: 'green',
  ARTIST: 'teal',
  SUMMARY: 'grape',
  STATUS: 'orange',
  GENRE: 'pink',
  DEMOGRAPHIC: 'gray',
  PUBLISHER: 'lime',
  MAGAZINE: 'lime',
  RELEASE_DATE: 'yellow',
  COVER_IMAGE: 'red',

  // Counts
  VOLUME_COUNT: 'cyan',
  CHAPTER_COUNT: 'cyan',

  // Volume-specific
  VOLUME_TITLE: 'violet',
  VOLUME_COVER: 'red',
  VOLUME_SUMMARY: 'grape',
  VOLUME_RELEASE_DATE: 'yellow',

  // Chapter-specific
  CHAPTER_TITLE: 'violet',
  CHAPTER_COVER: 'red',
  CHAPTER_SUMMARY: 'grape',
  CHAPTER_RELEASE_DATE: 'yellow',

  // Navigation/Links
  VOLUMES_LIST_URL: 'blue',
  CHAPTERS_LIST_URL: 'blue',
  GALLERY_URL: 'blue',

  // Table/Data sections
  VOLUME_TABLE: 'indigo',
  CHAPTER_TABLE: 'indigo',
  GALLERY_SECTION: 'pink',
};

/**
 * Custom Source entity colors
 * For configuring download source selectors
 */
export const CUSTOM_SOURCE_ENTITY_COLORS: Record<string, string> = {
  // Search Results
  SEARCH_CONTAINER: 'blue',
  SEARCH_ITEM: 'indigo',
  SEARCH_TITLE: 'green',
  SEARCH_COVER: 'red',
  SEARCH_URL: 'cyan',

  // Details Page
  DETAILS_TITLE: 'blue',
  DETAILS_COVER: 'red',
  DETAILS_DESCRIPTION: 'grape',
  DETAILS_AUTHOR: 'green',
  DETAILS_STATUS: 'orange',
  DETAILS_GENRES: 'pink',

  // Chapter List
  CHAPTER_CONTAINER: 'indigo',
  CHAPTER_ITEM: 'violet',
  CHAPTER_TITLE: 'green',
  CHAPTER_NUMBER: 'cyan',
  CHAPTER_URL: 'blue',
  CHAPTER_DATE: 'yellow',

  // Chapter Type Labels (for special chapters)
  CHAPTER_TYPE_BONUS: 'orange',
  CHAPTER_TYPE_SPECIAL: 'grape',
  CHAPTER_TYPE_PROLOGUE: 'teal',
  CHAPTER_TYPE_EPILOGUE: 'lime',
  CHAPTER_TYPE_EXTRA: 'pink',
  CHAPTER_TYPE_ONESHOT: 'red',

  // Download Page
  DOWNLOAD_CONTAINER: 'indigo',
  DOWNLOAD_LINK: 'blue',
  DOWNLOAD_BUTTON: 'teal',
};

/**
 * Default keyboard shortcuts for ML annotation
 */
export const DEFAULT_KEYBOARD_SHORTCUTS: Record<string, string> = {
  t: 'TITLE',
  a: 'AUTHOR',
  r: 'ARTIST',
  s: 'SERIES_SUMMARY',
  g: 'GENRE',
  v: 'VOLUME_COUNT',
  c: 'CHAPTER_COUNT',
  d: 'RELEASE_DATE',
  p: 'PUBLISHER',
  u: 'STATUS',
  i: 'COVER_IMAGE',
};

/**
 * Maps Mantine color names to CSS color values
 */
export function getColorValue(mantineColor: string): string {
  const colorMap: Record<string, string> = {
    blue: '#228be6',
    indigo: '#4c6ef5',
    green: '#40c057',
    teal: '#12b886',
    grape: '#be4bdb',
    orange: '#fd7e14',
    pink: '#e64980',
    cyan: '#15aabf',
    violet: '#7950f2',
    yellow: '#fab005',
    lime: '#82c91e',
    red: '#fa5252',
    gray: '#868e96',
  };
  return colorMap[mantineColor] ?? '#868e96';
}

/**
 * Get color for an entity, with fallback
 */
export function getEntityColor(
  entityId: string,
  customColors?: Record<string, string>
): string {
  const colors = customColors ?? DEFAULT_ENTITY_COLORS;
  return colors[entityId] ?? 'gray';
}

/**
 * Get CSS color value for an entity
 */
export function getEntityColorValue(
  entityId: string,
  customColors?: Record<string, string>
): string {
  const mantineColor = getEntityColor(entityId, customColors);
  return getColorValue(mantineColor);
}
