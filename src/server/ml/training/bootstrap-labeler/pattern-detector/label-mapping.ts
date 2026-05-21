/**
 * Label to Entity Type Mapping
 *
 * Maps common label texts found in HTML to their corresponding entity types.
 */

import type { EntityType } from '@/server/ml/features/bio-types';

export const LABEL_TO_ENTITY: Record<string, EntityType> = {
  // Author/Artist - Primary
  author: 'AUTHOR',
  'written by': 'AUTHOR',
  writer: 'AUTHOR',
  'created by': 'AUTHOR',
  creator: 'AUTHOR',
  artist: 'ARTIST',
  'illustrated by': 'ARTIST',
  illustrator: 'ARTIST',
  'drawn by': 'ARTIST',
  'art by': 'ARTIST',

  // Author/Artist - Extended variations
  'story by': 'AUTHOR',
  story: 'AUTHOR',
  'original creator': 'AUTHOR',
  'original story': 'AUTHOR',
  'original author': 'AUTHOR',
  script: 'AUTHOR',
  scenario: 'AUTHOR',
  mangaka: 'AUTHOR',
  sakusha: 'AUTHOR', // Japanese for author
  gensaku: 'AUTHOR', // Original work
  artwork: 'ARTIST',
  pencils: 'ARTIST', // Western comic style
  inks: 'ARTIST',
  sakuga: 'ARTIST', // Animation/art

  // Publication - Primary
  publisher: 'PUBLISHER',
  'published by': 'PUBLISHER',
  imprint: 'PUBLISHER',
  magazine: 'MAGAZINE',
  'serialized in': 'MAGAZINE',
  serialization: 'MAGAZINE',
  journal: 'MAGAZINE',

  // Publication - Extended variations
  // NOTE: 'label' removed - too generic, matches wiki footers/sidebars
  'original publisher': 'PUBLISHER',
  'english publisher': 'PUBLISHER',
  'jp publisher': 'PUBLISHER',
  'serialised in': 'MAGAZINE', // British spelling
  run: 'MAGAZINE',
  'published in': 'MAGAZINE',

  // ISBN (Wikipedia uses prefixed headers)
  isbn: 'ISBN',
  'original isbn': 'ISBN',
  'english isbn': 'ISBN',
  'jp isbn': 'ISBN',
  'japanese isbn': 'ISBN',

  // Status/Dates - Primary
  status: 'STATUS',
  'release date': 'RELEASE_DATE',
  released: 'RELEASE_DATE',
  published: 'RELEASE_DATE',
  'original run': 'RELEASE_DATE',
  'start date': 'RELEASE_DATE',
  'first published': 'RELEASE_DATE',
  'publication date': 'RELEASE_DATE',

  // Status/Dates - Extended variations
  'current status': 'STATUS',
  'publication status': 'STATUS',
  'serialization status': 'STATUS',
  'end date': 'RELEASE_DATE',
  'start/end': 'RELEASE_DATE',
  // Published with language suffixes (common in Fandom chapter pages)
  'published (jp)': 'RELEASE_DATE',
  'published (en)': 'RELEASE_DATE',
  'published (us)': 'RELEASE_DATE',
  'published (uk)': 'RELEASE_DATE',
  'release (jp)': 'RELEASE_DATE',
  'release (en)': 'RELEASE_DATE',
  // Wikipedia uses prefixed release dates
  'original release date': 'VOLUME_RELEASE_DATE',
  'english release date': 'VOLUME_RELEASE_DATE',
  'japanese release date': 'VOLUME_RELEASE_DATE',
  'jp release date': 'VOLUME_RELEASE_DATE',

  // Classification - Primary
  genre: 'GENRE',
  genres: 'GENRE',
  category: 'GENRE',
  categories: 'GENRE',
  demographic: 'DEMOGRAPHIC',
  'target audience': 'DEMOGRAPHIC',
  audience: 'DEMOGRAPHIC',
  themes: 'GENRE',
  theme: 'GENRE',

  // Classification - Extended variations
  classification: 'GENRE',
  tags: 'TAGS',
  tag: 'TAGS',
  'content tags': 'TAGS',
  'content warning': 'TAGS',
  format: 'FORMAT',
  // NOTE: 'type' removed - too generic, matches pagination/filters/navigation
  'media type': 'FORMAT',

  // Counts - Primary
  volumes: 'VOLUME_COUNT',
  chapters: 'CHAPTER_COUNT',
  'volume count': 'VOLUME_COUNT',
  'chapter count': 'CHAPTER_COUNT',
  'no. of volumes': 'VOLUME_COUNT',
  'no. of chapters': 'CHAPTER_COUNT',

  // Volume Number (specific volume in series)
  'issue number': 'VOLUME_NUMBER',
  'issue #': 'VOLUME_NUMBER',
  'issue no': 'VOLUME_NUMBER',
  'issue no.': 'VOLUME_NUMBER',
  'vol': 'VOLUME_NUMBER',
  'vol.': 'VOLUME_NUMBER',
  volume: 'VOLUME_NUMBER', // In context of single volume pages, this is the volume number
  chapter: 'CHAPTER_NUMBER', // In context of single chapter pages, this is the chapter number
  // Wikipedia volume table headers
  '#': 'VOLUME_NUMBER',
  'no': 'VOLUME_NUMBER',
  'no.': 'VOLUME_NUMBER',

  // Page count (for individual chapters)
  pages: 'PAGE_COUNT',
  page: 'PAGE_COUNT',
  'page count': 'PAGE_COUNT',
  'no. of pages': 'PAGE_COUNT',

  // Counts - Extended variations (Japanese formats)
  tankoubon: 'VOLUME_COUNT',
  'tankōbon': 'VOLUME_COUNT',
  bunkoban: 'VOLUME_COUNT',
  kanzenban: 'VOLUME_COUNT',
  aizouban: 'VOLUME_COUNT',
  episodes: 'CHAPTER_COUNT', // Light novel adaptations
  parts: 'CHAPTER_COUNT',

  // Titles - Primary
  title: 'TITLE',
  name: 'TITLE',
  'japanese title': 'ALT_TITLE',
  'original title': 'ALT_TITLE',
  romaji: 'ALT_TITLE',
  kanji: 'ALT_TITLE',
  'alt title': 'ALT_TITLE',
  'alternative title': 'ALT_TITLE',
  'also known as': 'ALT_TITLE',
  aka: 'ALT_TITLE',

  // Titles - Extended variations
  'english title': 'ALT_TITLE',
  'native name': 'ALT_TITLE',
  'native title': 'ALT_TITLE',
  'official title': 'TITLE',
  'series name': 'TITLE',

  // Cover
  cover: 'COVER_IMAGE',
  'cover image': 'COVER_IMAGE',
  image: 'COVER_IMAGE',

  // Chapter naming conventions (for series with non-standard naming)
  stage: 'CHAPTER_TITLE', // One Piece Film Red tie-in
  stages: 'CHAPTER_COUNT',
  mission: 'CHAPTER_TITLE', // Boruto, Spy x Family
  missions: 'CHAPTER_COUNT',
  episode: 'CHAPTER_TITLE', // Light novels, some manga
  round: 'CHAPTER_TITLE', // Sports manga
  rounds: 'CHAPTER_COUNT',
  case: 'CHAPTER_TITLE', // Detective manga
  cases: 'CHAPTER_COUNT',
  act: 'CHAPTER_TITLE', // Drama-structured manga
  acts: 'CHAPTER_COUNT',
  arc: 'CHAPTER_TITLE', // Story arcs
  arcs: 'CHAPTER_COUNT',
  saga: 'CHAPTER_TITLE', // Dragon Ball, One Piece
  sagas: 'CHAPTER_COUNT',
  'story arc': 'CHAPTER_TITLE',
  'story arcs': 'CHAPTER_COUNT',

  // Series Summary - Primary
  summary: 'SERIES_SUMMARY',
  synopsis: 'SERIES_SUMMARY',
  description: 'SERIES_SUMMARY',
  plot: 'SERIES_SUMMARY',
  overview: 'SERIES_SUMMARY',

  // Series Summary - Extended variations
  'plot summary': 'SERIES_SUMMARY',
  storyline: 'SERIES_SUMMARY',
  premise: 'SERIES_SUMMARY',

  // NOTE: Characters category removed - CHARACTERS entity type is no longer used
};
