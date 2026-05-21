/**
 * Entity Fixtures
 *
 * ExtractedEntity and ExpectedEntity objects for matching and metrics tests.
 *
 * @module tests/auto-labeling/fixtures/entities
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';

import type {
  ExtractedEntity,
  ExpectedEntity,
  EntityMatch,
} from '@/server/services/auto-labeling/types';

// ============================================================================
// Extracted Entity Fixtures
// ============================================================================

export const EXTRACTED_TITLE: ExtractedEntity = {
  type: 'TITLE' as EntityType,
  value: 'One Piece',
  normalizedValue: 'one piece',
  confidence: 0.95,
  source: 'parser',
};

export const EXTRACTED_TITLE_ALT: ExtractedEntity = {
  type: 'TITLE' as EntityType,
  value: 'ワンピース',
  normalizedValue: 'ワンピース',
  confidence: 0.85,
  source: 'bootstrap',
};

export const EXTRACTED_AUTHOR: ExtractedEntity = {
  type: 'AUTHOR' as EntityType,
  value: 'Eiichiro Oda',
  normalizedValue: 'eiichiro oda',
  confidence: 0.9,
  source: 'parser',
};

export const EXTRACTED_AUTHOR_VARIANT: ExtractedEntity = {
  type: 'AUTHOR' as EntityType,
  value: 'Oda, Eiichiro',
  normalizedValue: 'oda eiichiro',
  confidence: 0.85,
  source: 'bootstrap',
};

export const EXTRACTED_STATUS_ONGOING: ExtractedEntity = {
  type: 'STATUS' as EntityType,
  value: 'Ongoing',
  normalizedValue: 'ongoing',
  confidence: 0.88,
  source: 'parser',
};

export const EXTRACTED_STATUS_COMPLETED: ExtractedEntity = {
  type: 'STATUS' as EntityType,
  value: 'Finished',
  normalizedValue: 'completed',
  confidence: 0.9,
  source: 'parser',
};

export const EXTRACTED_VOLUME_COUNT: ExtractedEntity = {
  type: 'VOLUME_COUNT' as EntityType,
  value: '107',
  normalizedValue: '107',
  confidence: 0.95,
  source: 'parser',
};

export const EXTRACTED_CHAPTER_COUNT: ExtractedEntity = {
  type: 'CHAPTER_COUNT' as EntityType,
  value: '1100',
  normalizedValue: '1100',
  confidence: 0.92,
  source: 'parser',
};

export const EXTRACTED_GENRE_ACTION: ExtractedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Action',
  normalizedValue: 'action',
  confidence: 0.8,
  source: 'static_analysis',
};

export const EXTRACTED_GENRE_ADVENTURE: ExtractedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Adventure',
  normalizedValue: 'adventure',
  confidence: 0.85,
  source: 'static_analysis',
};

export const EXTRACTED_GENRE_FANTASY: ExtractedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Fantasy',
  normalizedValue: 'fantasy',
  confidence: 0.75,
  source: 'bootstrap',
};

export const EXTRACTED_PUBLISHER: ExtractedEntity = {
  type: 'PUBLISHER' as EntityType,
  value: 'Shueisha',
  normalizedValue: 'shueisha',
  confidence: 0.88,
  source: 'parser',
};

export const EXTRACTED_SUMMARY: ExtractedEntity = {
  type: 'SUMMARY' as EntityType,
  value: 'Monkey D. Luffy wants to become the King of Pirates.',
  normalizedValue: 'monkey d luffy wants to become the king of pirates',
  confidence: 0.7,
  source: 'parser',
};

export const EXTRACTED_RELEASE_DATE: ExtractedEntity = {
  type: 'RELEASE_DATE' as EntityType,
  value: '1997',
  normalizedValue: '1997',
  confidence: 0.9,
  source: 'parser',
};

export const EXTRACTED_FORMAT: ExtractedEntity = {
  type: 'FORMAT' as EntityType,
  value: 'Manga',
  normalizedValue: 'manga',
  confidence: 0.95,
  source: 'static_analysis',
};

export const EXTRACTED_DEMOGRAPHIC: ExtractedEntity = {
  type: 'DEMOGRAPHIC' as EntityType,
  value: 'Shounen',
  normalizedValue: 'shounen',
  confidence: 0.85,
  source: 'parser',
};

export const EXTRACTED_LOW_CONFIDENCE: ExtractedEntity = {
  type: 'TITLE' as EntityType,
  value: 'Unknown Title',
  normalizedValue: 'unknown title',
  confidence: 0.3,
  source: 'bootstrap',
};

export const EXTRACTED_WITH_INDICES: ExtractedEntity = {
  type: 'AUTHOR' as EntityType,
  value: 'Eiichiro Oda',
  normalizedValue: 'eiichiro oda',
  confidence: 0.9,
  source: 'bootstrap',
  tokenIndices: [15, 16, 17],
};

// ============================================================================
// Expected Entity Fixtures
// ============================================================================

export const EXPECTED_TITLE: ExpectedEntity = {
  type: 'TITLE' as EntityType,
  value: 'One Piece',
  normalizedValue: 'one piece',
  required: true,
};

export const EXPECTED_ALT_TITLE: ExpectedEntity = {
  type: 'ALT_TITLE' as EntityType,
  value: 'ワンピース',
  normalizedValue: 'ワンピース',
  required: false,
};

export const EXPECTED_AUTHOR: ExpectedEntity = {
  type: 'AUTHOR' as EntityType,
  value: 'Eiichiro Oda',
  normalizedValue: 'eiichiro oda',
  required: true,
};

export const EXPECTED_STATUS_ONGOING: ExpectedEntity = {
  type: 'STATUS' as EntityType,
  value: 'ongoing',
  normalizedValue: 'ongoing',
  required: true,
};

export const EXPECTED_STATUS_COMPLETED: ExpectedEntity = {
  type: 'STATUS' as EntityType,
  value: 'completed',
  normalizedValue: 'completed',
  required: true,
};

export const EXPECTED_VOLUME_COUNT: ExpectedEntity = {
  type: 'VOLUME_COUNT' as EntityType,
  value: '107',
  normalizedValue: '107',
  required: true,
};

export const EXPECTED_CHAPTER_COUNT: ExpectedEntity = {
  type: 'CHAPTER_COUNT' as EntityType,
  value: '1100',
  normalizedValue: '1100',
  required: true,
};

export const EXPECTED_GENRE_ACTION: ExpectedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Action',
  normalizedValue: 'action',
  required: false,
};

export const EXPECTED_GENRE_ADVENTURE: ExpectedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Adventure',
  normalizedValue: 'adventure',
  required: false,
};

export const EXPECTED_GENRE_COMEDY: ExpectedEntity = {
  type: 'GENRE' as EntityType,
  value: 'Comedy',
  normalizedValue: 'comedy',
  required: false,
};

export const EXPECTED_PUBLISHER: ExpectedEntity = {
  type: 'PUBLISHER' as EntityType,
  value: 'Shueisha',
  normalizedValue: 'shueisha',
  required: false,
};

export const EXPECTED_SUMMARY: ExpectedEntity = {
  type: 'SUMMARY' as EntityType,
  value: 'Monkey D. Luffy, a boy whose body gained the properties of rubber...',
  normalizedValue: 'monkey d luffy a boy whose body gained the properties of rubber',
  required: false,
};

export const EXPECTED_RELEASE_DATE: ExpectedEntity = {
  type: 'RELEASE_DATE' as EntityType,
  value: '1997',
  normalizedValue: '1997',
  required: false,
};

export const EXPECTED_FORMAT: ExpectedEntity = {
  type: 'FORMAT' as EntityType,
  value: 'MANGA',
  normalizedValue: 'manga',
  required: false,
};

export const EXPECTED_DEMOGRAPHIC: ExpectedEntity = {
  type: 'DEMOGRAPHIC' as EntityType,
  value: 'Shounen',
  normalizedValue: 'shounen',
  required: false,
};

// ============================================================================
// Entity Match Fixtures
// ============================================================================

export const MATCH_EXACT_TITLE: EntityMatch = {
  extracted: EXTRACTED_TITLE,
  expected: EXPECTED_TITLE,
  similarity: 1.0,
  matchType: 'exact',
};

export const MATCH_EXACT_AUTHOR: EntityMatch = {
  extracted: EXTRACTED_AUTHOR,
  expected: EXPECTED_AUTHOR,
  similarity: 1.0,
  matchType: 'exact',
};

export const MATCH_FUZZY_AUTHOR: EntityMatch = {
  extracted: EXTRACTED_AUTHOR_VARIANT,
  expected: EXPECTED_AUTHOR,
  similarity: 0.85,
  matchType: 'fuzzy',
};

export const MATCH_PARTIAL_SUMMARY: EntityMatch = {
  extracted: EXTRACTED_SUMMARY,
  expected: EXPECTED_SUMMARY,
  similarity: 0.65,
  matchType: 'partial',
};

// ============================================================================
// Entity Collections
// ============================================================================

/**
 * Complete extracted entities set for One Piece.
 */
export const EXTRACTED_ENTITIES_COMPLETE: ExtractedEntity[] = [
  EXTRACTED_TITLE,
  EXTRACTED_AUTHOR,
  EXTRACTED_STATUS_ONGOING,
  EXTRACTED_VOLUME_COUNT,
  EXTRACTED_CHAPTER_COUNT,
  EXTRACTED_GENRE_ACTION,
  EXTRACTED_GENRE_ADVENTURE,
  EXTRACTED_PUBLISHER,
  EXTRACTED_SUMMARY,
  EXTRACTED_RELEASE_DATE,
  EXTRACTED_FORMAT,
  EXTRACTED_DEMOGRAPHIC,
];

/**
 * Minimal extracted entities (only title and author).
 */
export const EXTRACTED_ENTITIES_MINIMAL: ExtractedEntity[] = [
  EXTRACTED_TITLE,
  EXTRACTED_AUTHOR,
];

/**
 * Empty extracted entities.
 */
export const EXTRACTED_ENTITIES_EMPTY: ExtractedEntity[] = [];

/**
 * Extracted entities with duplicates.
 */
export const EXTRACTED_ENTITIES_WITH_DUPLICATES: ExtractedEntity[] = [
  EXTRACTED_TITLE,
  EXTRACTED_TITLE_ALT,
  EXTRACTED_AUTHOR,
  EXTRACTED_AUTHOR_VARIANT,
];

/**
 * Extracted entities with low confidence.
 */
export const EXTRACTED_ENTITIES_LOW_CONFIDENCE: ExtractedEntity[] = [
  EXTRACTED_LOW_CONFIDENCE,
  { ...EXTRACTED_AUTHOR, confidence: 0.4 },
];

/**
 * Complete expected entities set for One Piece.
 */
export const EXPECTED_ENTITIES_COMPLETE: ExpectedEntity[] = [
  EXPECTED_TITLE,
  EXPECTED_ALT_TITLE,
  EXPECTED_AUTHOR,
  EXPECTED_STATUS_ONGOING,
  EXPECTED_VOLUME_COUNT,
  EXPECTED_CHAPTER_COUNT,
  EXPECTED_GENRE_ACTION,
  EXPECTED_GENRE_ADVENTURE,
  EXPECTED_GENRE_COMEDY,
  EXPECTED_PUBLISHER,
  EXPECTED_SUMMARY,
  EXPECTED_RELEASE_DATE,
  EXPECTED_FORMAT,
  EXPECTED_DEMOGRAPHIC,
];

/**
 * Minimal expected entities (only required).
 */
export const EXPECTED_ENTITIES_MINIMAL: ExpectedEntity[] = [
  EXPECTED_TITLE,
  EXPECTED_AUTHOR,
  EXPECTED_STATUS_ONGOING,
  EXPECTED_VOLUME_COUNT,
  EXPECTED_CHAPTER_COUNT,
];

/**
 * Empty expected entities.
 */
export const EXPECTED_ENTITIES_EMPTY: ExpectedEntity[] = [];

/**
 * Expected entities with only genres.
 */
export const EXPECTED_ENTITIES_GENRES_ONLY: ExpectedEntity[] = [
  EXPECTED_GENRE_ACTION,
  EXPECTED_GENRE_ADVENTURE,
  EXPECTED_GENRE_COMEDY,
];

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Perfect match scenario - all extracted match expected.
 */
export const SCENARIO_PERFECT_MATCH = {
  extracted: [EXTRACTED_TITLE, EXTRACTED_AUTHOR, EXTRACTED_STATUS_ONGOING],
  expected: [EXPECTED_TITLE, EXPECTED_AUTHOR, EXPECTED_STATUS_ONGOING],
  expectedTP: 3,
  expectedFP: 0,
  expectedFN: 0,
};

/**
 * Partial match scenario - some matches, some misses.
 */
export const SCENARIO_PARTIAL_MATCH = {
  extracted: [EXTRACTED_TITLE, EXTRACTED_AUTHOR, EXTRACTED_GENRE_FANTASY],
  expected: [EXPECTED_TITLE, EXPECTED_AUTHOR, EXPECTED_STATUS_ONGOING, EXPECTED_GENRE_ACTION],
  expectedTP: 2,
  expectedFP: 1,
  expectedFN: 2,
};

/**
 * No match scenario - nothing matches.
 */
export const SCENARIO_NO_MATCH = {
  extracted: [EXTRACTED_GENRE_FANTASY],
  expected: [EXPECTED_TITLE, EXPECTED_AUTHOR],
  expectedTP: 0,
  expectedFP: 1,
  expectedFN: 2,
};

/**
 * Fuzzy match scenario - matches with fuzzy similarity.
 */
export const SCENARIO_FUZZY_MATCH = {
  extracted: [EXTRACTED_AUTHOR_VARIANT],
  expected: [EXPECTED_AUTHOR],
  expectedTP: 1,
  expectedFP: 0,
  expectedFN: 0,
};

/**
 * Overcounting scenario - more extracted than expected.
 */
export const SCENARIO_OVERCOUNTING = {
  extracted: [
    EXTRACTED_TITLE,
    EXTRACTED_TITLE_ALT,
    EXTRACTED_AUTHOR,
    EXTRACTED_AUTHOR_VARIANT,
    EXTRACTED_GENRE_ACTION,
    EXTRACTED_GENRE_ADVENTURE,
    EXTRACTED_GENRE_FANTASY,
  ],
  expected: [EXPECTED_TITLE, EXPECTED_AUTHOR],
  expectedTP: 2,
  expectedFP: 5,
  expectedFN: 0,
};

/**
 * Undercounting scenario - fewer extracted than expected.
 */
export const SCENARIO_UNDERCOUNTING = {
  extracted: [EXTRACTED_TITLE],
  expected: EXPECTED_ENTITIES_MINIMAL,
  expectedTP: 1,
  expectedFP: 0,
  expectedFN: 4,
};

// ============================================================================
// Similarity Test Cases
// ============================================================================

export const SIMILARITY_CASES = [
  { a: 'one piece', b: 'one piece', expected: 1.0 },
  { a: 'one piece', b: 'One Piece', expected: 1.0 },
  { a: 'eiichiro oda', b: 'oda eiichiro', expected: 0.7 },
  { a: 'attack on titan', b: 'attack on titan', expected: 1.0 },
  { a: 'naruto', b: 'boruto', expected: 0.67 },
  { a: '', b: '', expected: 1.0 },
  { a: 'test', b: '', expected: 0.0 },
  { a: '', b: 'test', expected: 0.0 },
  { a: 'abc', b: 'xyz', expected: 0.0 },
  { a: 'Shueisha', b: 'shueisha', expected: 1.0 },
];

// ============================================================================
// Entity Type Constants for Testing
// ============================================================================

export const ALL_ENTITY_TYPES: EntityType[] = [
  'TITLE',
  'ALT_TITLE',
  'AUTHOR',
  'ARTIST',
  'STATUS',
  'VOLUME_COUNT',
  'CHAPTER_COUNT',
  'GENRE',
  'SUMMARY',
  'PUBLISHER',
  'RELEASE_DATE',
  'FORMAT',
  'DEMOGRAPHIC',
  'COVER_IMAGE',
] as EntityType[];

export const REQUIRED_ENTITY_TYPES: EntityType[] = [
  'TITLE',
  'AUTHOR',
  'STATUS',
  'VOLUME_COUNT',
  'CHAPTER_COUNT',
] as EntityType[];

export const OPTIONAL_ENTITY_TYPES: EntityType[] = [
  'ALT_TITLE',
  'ARTIST',
  'GENRE',
  'SUMMARY',
  'PUBLISHER',
  'RELEASE_DATE',
  'FORMAT',
  'DEMOGRAPHIC',
  'COVER_IMAGE',
] as EntityType[];
