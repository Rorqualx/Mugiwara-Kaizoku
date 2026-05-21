/**
 * Common Validation Patterns
 *
 * Shared regex patterns for detecting invalid entity content.
 */

/**
 * Patterns that indicate navigation/UI text (not real content)
 */
export const NAVIGATION_PATTERNS = [
  /^(wiki|fandom|category|edit|view|talk|history)/i,
  /^(sign|log|register|create account)/i,
  /^(search|explore|community|help)/i,
  /^(jump to|skip to|main content)/i,
  /\.(com|org|net|wiki)$/i,
  /^(advertisement|sponsored)/i,
  /^(cookie|privacy|terms)/i,
  // Metadata field labels (should not be labeled as content)
  /^(volume|isbn|release|pages|date|chapters|cover|synopsis|summary)$/i,
  // Additional metadata field labels commonly mislabeled
  /^(information|details|info|data)$/i,
  /^(title|author|artist|writer|creator|illustrator)$/i,
  /^(publisher|published|imprint|label)$/i,
  /^(magazine|serialized|serialization|journal)$/i,
  /^(status|demographic|genre|genres|format|type)$/i,
  /^(previous|next|contents|index|navigation)$/i,
  // Single punctuation or very short fragments
  /^[()[\]{}<>]+$/,
  /^[0-9]$/,
];

/**
 * Patterns that indicate placeholder/stub content
 */
export const PLACEHOLDER_PATTERNS = [
  /^(unknown|n\/a|tba|tbd|none|null|undefined)$/i,
  /^(to be announced|coming soon|pending)$/i,
  /^(various|multiple|see below)$/i,
  /^\?+$/,
  /^-+$/,
];

/**
 * Patterns that indicate this is a character name (not author/artist)
 */
export const CHARACTER_NAME_PATTERNS = [
  /\b(san|kun|chan|sama|sensei)\b/i,
  /\b(the|a|an)\s+(protagonist|hero|villain|main)/i,
  /-\s*(first|second|third)\s+(form|stage)/i,
];

/**
 * Context labels for author identification
 */
export const AUTHOR_CONTEXT_LABELS = [
  'author',
  'writer',
  'written by',
  'created by',
  'story by',
  'creator',
];

/**
 * Context labels for artist identification
 */
export const ARTIST_CONTEXT_LABELS = [
  'artist',
  'illustrator',
  'illustrated by',
  'art by',
  'drawn by',
];

/**
 * Context labels for volume count identification
 */
export const VOLUME_CONTEXT_LABELS = [
  'volume',
  'volumes',
  'vols',
  'tankōbon',
  'tankobon',
];

/**
 * Context labels for chapter count identification
 */
export const CHAPTER_CONTEXT_LABELS = [
  'chapter',
  'chapters',
  'ch',
  'eps',
  'episodes',
];

/**
 * Context labels for page count identification
 */
export const PAGE_COUNT_CONTEXT_LABELS = [
  'pages',
  'page',
  'page count',
  'no. of pages',
];

/**
 * Context labels for publisher identification
 */
export const PUBLISHER_CONTEXT_LABELS = [
  'publisher',
  'published by',
  'imprint',
  'label',
  'english publisher',
  'jp publisher',
  'original publisher',
];

/**
 * Context labels for demographic identification
 */
export const DEMOGRAPHIC_CONTEXT_LABELS = [
  'demographic',
  'target audience',
  'audience',
  'target',
];

/**
 * Context labels for magazine identification
 */
export const MAGAZINE_CONTEXT_LABELS = [
  'magazine',
  'serialized in',
  'serialization',
  'published in',
  'journal',
];

/**
 * Context labels for release date identification
 */
export const RELEASE_DATE_CONTEXT_LABELS = [
  'release date',
  'released',
  'published',
  'original run',
  'start date',
  'first published',
  'publication date',
];

/**
 * Valid demographic values
 */
export const VALID_DEMOGRAPHICS = [
  'shounen',
  'shonen',
  'shoujo',
  'shojo',
  'seinen',
  'josei',
  'kodomo',
];

/**
 * Known publishers for confidence boost
 */
export const KNOWN_PUBLISHERS = [
  'shueisha',
  'kodansha',
  'shogakukan',
  'square enix',
  'kadokawa',
  'viz media',
  'yen press',
  'seven seas',
  'dark horse',
];

/**
 * Context labels for status identification
 */
export const STATUS_CONTEXT_LABELS = [
  'status',
  'publication status',
  'serialization status',
  'current status',
  'running',
];

/**
 * Valid status values
 */
export const VALID_STATUS_VALUES = [
  'ongoing',
  'completed',
  'finished',
  'hiatus',
  'cancelled',
  'on hold',
  'discontinued',
  'publishing',
  'complete',
  'ended',
];

/**
 * Valid format types
 */
export const VALID_FORMAT_VALUES = [
  'manga',
  'manhwa',
  'manhua',
  'webtoon',
  'light novel',
  'novel',
  'one-shot',
  'oneshot',
  'doujinshi',
  'oel',
];

/**
 * UI navigation patterns (mislabeling prevention)
 * These patterns identify UI/navigation text that should never be labeled as content
 */
export const UI_NAVIGATION_PATTERNS = [
  /^font[- ]?size$/i,
  /^font[- ]?family$/i,
  /^text[- ]?(color|size)$/i,
  /^(zoom|scroll|toggle|expand|collapse)$/i,
  /^(show|hide|load)\s+(more|less|all)$/i,
  /^(prev|next|back|forward|home)$/i,
  /^(share|save|print|download)$/i,
  /^(close|cancel|dismiss|menu)$/i,
  /^(episodes?|lists?|characters?)$/i,
  /^(settings?|options?|preferences?)$/i,
];
