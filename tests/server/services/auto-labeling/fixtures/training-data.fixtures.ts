/**
 * Training Data Fixtures
 *
 * Sample CSV data, TrainingDataRow, and TrainingEntry objects for testing.
 *
 * @module tests/auto-labeling/fixtures/training-data
 */

import type {
  TrainingDataRow,
  TrainingEntry,
  DiscoveredUrl,
  DiscoveredUrlType,
  SamplingFilters,
  SampledPage,
} from '@/server/services/auto-labeling/types';

// ============================================================================
// CSV Samples
// ============================================================================

/**
 * Sample CSV header row.
 */
export const CSV_HEADER =
  'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';

/**
 * Sample CSV row - complete entry.
 */
export const CSV_ROW_COMPLETE =
  'One Piece,21,https://en.wikipedia.org/wiki/One_Piece,https://onepiece.fandom.com/wiki/One_Piece_Wiki,4HM59,CHAPTERS:https://onepiece.fandom.com/wiki/Chapters|VOLUMES:https://onepiece.fandom.com/wiki/Volumes,MANGA_PAGE:https://en.wikipedia.org/wiki/One_Piece,';

/**
 * Sample CSV row - minimal entry.
 */
export const CSV_ROW_MINIMAL = 'Naruto,20,,,DOES_NOT_EXIST,,,';

/**
 * Sample CSV row - with quoted fields.
 */
export const CSV_ROW_QUOTED =
  '"Attack on Titan, Vol. 1",30853,https://en.wikipedia.org/wiki/Attack_on_Titan,"https://attackontitan.fandom.com/wiki/Attack_on_Titan_Wiki","4HM60","CHAPTERS:https://attackontitan.fandom.com/wiki/Chapters|CATEGORY:Story Arcs:https://attackontitan.fandom.com/wiki/Category:Story_Arcs","","MANGA_PAGE:https://comicvine.com/attack-on-titan"';

/**
 * Sample CSV row - with empty AniList ID.
 */
export const CSV_ROW_NO_ANILIST =
  'Unknown Manga,DOES_NOT_EXIST,https://en.wikipedia.org/wiki/Unknown,https://unknown.fandom.com/wiki/Unknown,,,,';

/**
 * Sample CSV row - with escaped quotes.
 */
export const CSV_ROW_ESCAPED_QUOTES =
  '"Title with ""quotes"" inside",100,https://example.com,https://fandom.com,123,CHAPTERS:https://example.com/chapters,,';

/**
 * Sample CSV row - with unicode characters.
 */
export const CSV_ROW_UNICODE =
  'ワンピース (One Piece),21,https://ja.wikipedia.org/wiki/ワンピース,https://onepiece.fandom.com/ja/wiki/ワンピース,,MANGA_PAGE:https://onepiece.fandom.com/ja/wiki/ワンピース,,';

/**
 * Complete CSV content for testing.
 */
export const CSV_CONTENT_COMPLETE = `${CSV_HEADER}
${CSV_ROW_COMPLETE}
${CSV_ROW_MINIMAL}
${CSV_ROW_QUOTED}`;

/**
 * Empty CSV (header only).
 */
export const CSV_CONTENT_EMPTY = CSV_HEADER;

/**
 * Invalid CSV (no header).
 */
export const CSV_CONTENT_NO_HEADER = CSV_ROW_COMPLETE;

// ============================================================================
// TrainingDataRow Fixtures
// ============================================================================

export const TRAINING_ROW_COMPLETE: TrainingDataRow = {
  Title: 'One Piece',
  AniListID: '21',
  WikipediaURL: 'https://en.wikipedia.org/wiki/One_Piece',
  FandomURL: 'https://onepiece.fandom.com/wiki/One_Piece_Wiki',
  ComicVineID: '4HM59',
  FandomDiscoveredURLs: 'CHAPTERS:https://onepiece.fandom.com/wiki/Chapters|VOLUMES:https://onepiece.fandom.com/wiki/Volumes',
  WikipediaDiscoveredURLs: 'MANGA_PAGE:https://en.wikipedia.org/wiki/One_Piece',
  ComicVineDiscoveredURLs: '',
};

export const TRAINING_ROW_MINIMAL: TrainingDataRow = {
  Title: 'Naruto',
  AniListID: '20',
  WikipediaURL: '',
  FandomURL: '',
  ComicVineID: 'DOES_NOT_EXIST',
  FandomDiscoveredURLs: '',
  WikipediaDiscoveredURLs: '',
  ComicVineDiscoveredURLs: '',
};

export const TRAINING_ROW_NO_ANILIST: TrainingDataRow = {
  Title: 'Unknown Manga',
  AniListID: 'DOES_NOT_EXIST',
  WikipediaURL: 'https://en.wikipedia.org/wiki/Unknown',
  FandomURL: 'https://unknown.fandom.com/wiki/Unknown',
  ComicVineID: '',
  FandomDiscoveredURLs: '',
  WikipediaDiscoveredURLs: '',
  ComicVineDiscoveredURLs: '',
};

// ============================================================================
// DiscoveredUrl Fixtures
// ============================================================================

export const DISCOVERED_URL_CHAPTERS: DiscoveredUrl = {
  type: 'CHAPTERS',
  url: 'https://onepiece.fandom.com/wiki/Chapters',
};

export const DISCOVERED_URL_VOLUMES: DiscoveredUrl = {
  type: 'VOLUMES',
  url: 'https://onepiece.fandom.com/wiki/Volumes',
};

export const DISCOVERED_URL_CHAPTERS_VOLUMES: DiscoveredUrl = {
  type: 'CHAPTERS_VOLUMES',
  url: 'https://onepiece.fandom.com/wiki/Chapters_and_Volumes',
};

export const DISCOVERED_URL_MANGA_PAGE: DiscoveredUrl = {
  type: 'MANGA_PAGE',
  url: 'https://en.wikipedia.org/wiki/One_Piece',
};

export const DISCOVERED_URL_CATEGORY: DiscoveredUrl = {
  type: 'CATEGORY',
  url: 'https://onepiece.fandom.com/wiki/Category:Story_Arcs',
  categoryName: 'Story Arcs',
};

export const DISCOVERED_URL_ARCS: DiscoveredUrl = {
  type: 'ARCS',
  url: 'https://onepiece.fandom.com/wiki/Arcs',
};

export const DISCOVERED_URL_GALLERY: DiscoveredUrl = {
  type: 'GALLERY_SECTION',
  url: 'https://onepiece.fandom.com/wiki/Gallery',
};

export const DISCOVERED_URL_OTHER: DiscoveredUrl = {
  type: 'OTHER',
  url: 'https://onepiece.fandom.com/wiki/Other',
};

// ============================================================================
// TrainingEntry Fixtures
// ============================================================================

export const TRAINING_ENTRY_COMPLETE: TrainingEntry = {
  title: 'One Piece',
  anilistId: 21,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/One_Piece',
  fandomUrl: 'https://onepiece.fandom.com/wiki/One_Piece_Wiki',
  comicVineId: '4HM59',
  fandomDiscoveredUrls: [DISCOVERED_URL_CHAPTERS, DISCOVERED_URL_VOLUMES],
  wikipediaDiscoveredUrls: [DISCOVERED_URL_MANGA_PAGE],
  comicVineDiscoveredUrls: [],
};

export const TRAINING_ENTRY_FANDOM_ONLY: TrainingEntry = {
  title: 'Naruto',
  anilistId: 20,
  wikipediaUrl: null,
  fandomUrl: 'https://naruto.fandom.com/wiki/Naruto_Wiki',
  comicVineId: null,
  fandomDiscoveredUrls: [
    { type: 'CHAPTERS', url: 'https://naruto.fandom.com/wiki/Chapters' },
    { type: 'VOLUMES', url: 'https://naruto.fandom.com/wiki/Volumes' },
  ],
  wikipediaDiscoveredUrls: [],
  comicVineDiscoveredUrls: [],
};

export const TRAINING_ENTRY_WIKIPEDIA_ONLY: TrainingEntry = {
  title: 'Dragon Ball',
  anilistId: 223,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Dragon_Ball',
  fandomUrl: null,
  comicVineId: null,
  fandomDiscoveredUrls: [],
  wikipediaDiscoveredUrls: [
    { type: 'MANGA_PAGE', url: 'https://en.wikipedia.org/wiki/Dragon_Ball' },
  ],
  comicVineDiscoveredUrls: [],
};

export const TRAINING_ENTRY_NO_ANILIST: TrainingEntry = {
  title: 'Unknown Manga',
  anilistId: null,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Unknown',
  fandomUrl: 'https://unknown.fandom.com/wiki/Unknown',
  comicVineId: null,
  fandomDiscoveredUrls: [],
  wikipediaDiscoveredUrls: [],
  comicVineDiscoveredUrls: [],
};

export const TRAINING_ENTRY_NO_URLS: TrainingEntry = {
  title: 'Minimal Entry',
  anilistId: 999,
  wikipediaUrl: null,
  fandomUrl: null,
  comicVineId: null,
  fandomDiscoveredUrls: [],
  wikipediaDiscoveredUrls: [],
  comicVineDiscoveredUrls: [],
};

export const TRAINING_ENTRY_MULTIPLE_URL_TYPES: TrainingEntry = {
  title: 'Attack on Titan',
  anilistId: 30853,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Attack_on_Titan',
  fandomUrl: 'https://attackontitan.fandom.com/wiki/Attack_on_Titan_Wiki',
  comicVineId: '4HM60',
  fandomDiscoveredUrls: [
    DISCOVERED_URL_CHAPTERS,
    DISCOVERED_URL_VOLUMES,
    DISCOVERED_URL_CHAPTERS_VOLUMES,
    DISCOVERED_URL_CATEGORY,
    DISCOVERED_URL_ARCS,
  ],
  wikipediaDiscoveredUrls: [DISCOVERED_URL_MANGA_PAGE],
  comicVineDiscoveredUrls: [{ type: 'MANGA_PAGE', url: 'https://comicvine.com/attack-on-titan' }],
};

// ============================================================================
// SamplingFilters Fixtures
// ============================================================================

export const FILTER_REQUIRE_ANILIST: SamplingFilters = {
  requireAnilistId: true,
};

export const FILTER_REQUIRE_FANDOM: SamplingFilters = {
  requireFandomUrls: true,
};

export const FILTER_REQUIRE_WIKIPEDIA: SamplingFilters = {
  requireWikipediaUrls: true,
};

export const FILTER_CHAPTERS_ONLY: SamplingFilters = {
  urlTypes: ['CHAPTERS'],
};

export const FILTER_VOLUMES_ONLY: SamplingFilters = {
  urlTypes: ['VOLUMES'],
};

export const FILTER_MULTIPLE_TYPES: SamplingFilters = {
  urlTypes: ['CHAPTERS', 'VOLUMES', 'CHAPTERS_VOLUMES'],
};

export const FILTER_EXCLUDE_IDS: SamplingFilters = {
  excludeAnilistIds: [21, 20],
};

export const FILTER_FANDOM_SOURCE: SamplingFilters = {
  sources: ['fandom'],
};

export const FILTER_WIKIPEDIA_SOURCE: SamplingFilters = {
  sources: ['wikipedia'],
};

export const FILTER_ALL_SOURCES: SamplingFilters = {
  sources: ['fandom', 'wikipedia', 'comicvine'],
};

export const FILTER_COMBINED: SamplingFilters = {
  requireAnilistId: true,
  requireFandomUrls: true,
  urlTypes: ['CHAPTERS', 'VOLUMES'],
  sources: ['fandom'],
};

// ============================================================================
// SampledPage Fixtures
// ============================================================================

export const SAMPLED_PAGE_FANDOM: SampledPage = {
  id: '21-fandom-CHAPTERS',
  title: 'One Piece',
  anilistId: 21,
  source: 'fandom',
  url: 'https://onepiece.fandom.com/wiki/Chapters',
  urlType: 'CHAPTERS',
  baseUrl: 'https://onepiece.fandom.com/wiki/One_Piece_Wiki',
};

export const SAMPLED_PAGE_WIKIPEDIA: SampledPage = {
  id: '21-wikipedia-MANGA_PAGE',
  title: 'One Piece',
  anilistId: 21,
  source: 'wikipedia',
  url: 'https://en.wikipedia.org/wiki/One_Piece',
  urlType: 'MANGA_PAGE',
  baseUrl: 'https://en.wikipedia.org/wiki/One_Piece',
};

export const SAMPLED_PAGE_COMICVINE: SampledPage = {
  id: '30853-comicvine-MANGA_PAGE',
  title: 'Attack on Titan',
  anilistId: 30853,
  source: 'comicvine',
  url: 'https://comicvine.com/attack-on-titan',
  urlType: 'MANGA_PAGE',
  baseUrl: null,
};

export const SAMPLED_PAGE_VOLUMES: SampledPage = {
  id: '21-fandom-VOLUMES',
  title: 'One Piece',
  anilistId: 21,
  source: 'fandom',
  url: 'https://onepiece.fandom.com/wiki/Volumes',
  urlType: 'VOLUMES',
  baseUrl: 'https://onepiece.fandom.com/wiki/One_Piece_Wiki',
};

// ============================================================================
// Test Collections
// ============================================================================

/**
 * Collection of training entries for sampling tests.
 */
export const TRAINING_ENTRIES_COLLECTION: TrainingEntry[] = [
  TRAINING_ENTRY_COMPLETE,
  TRAINING_ENTRY_FANDOM_ONLY,
  TRAINING_ENTRY_WIKIPEDIA_ONLY,
  TRAINING_ENTRY_MULTIPLE_URL_TYPES,
];

/**
 * Collection including entries without AniList IDs.
 */
export const TRAINING_ENTRIES_WITH_MISSING: TrainingEntry[] = [
  TRAINING_ENTRY_COMPLETE,
  TRAINING_ENTRY_NO_ANILIST,
  TRAINING_ENTRY_NO_URLS,
  TRAINING_ENTRY_FANDOM_ONLY,
];

/**
 * Collection of all discovered URL types.
 */
export const ALL_DISCOVERED_URL_TYPES: DiscoveredUrlType[] = [
  'CHAPTERS',
  'VOLUMES',
  'CHAPTERS_VOLUMES',
  'MANGA_PAGE',
  'ARCS',
  'CATEGORY',
  'GALLERY_SECTION',
  'OTHER',
];

// ============================================================================
// URL String Fixtures for Parsing Tests
// ============================================================================

export const URL_STRING_SIMPLE = 'CHAPTERS:https://example.com/chapters';

export const URL_STRING_MULTIPLE =
  'CHAPTERS:https://example.com/chapters|VOLUMES:https://example.com/volumes';

export const URL_STRING_CATEGORY =
  'CATEGORY:Story Arcs:https://example.com/category/arcs';

export const URL_STRING_CATEGORY_SIMPLE =
  'CATEGORY:https://example.com/category';

export const URL_STRING_NO_TYPE = 'https://example.com/page';

export const URL_STRING_EMPTY = '';

export const URL_STRING_WHITESPACE = '  ';

export const URL_STRING_MIXED =
  'CHAPTERS:https://example.com/chapters|CATEGORY:Arcs:https://example.com/arcs|https://example.com/other';

export const URL_STRING_VARIATIONS =
  'CHAPTER:https://example.com/chapter|VOLUME:https://example.com/volume|ARC:https://example.com/arc|GALLERY:https://example.com/gallery';
