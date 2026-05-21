/**
 * Home Router Utilities
 *
 * Shared helper functions, type definitions, and constants
 * used across all home router modules.
 *
 * Extracted from: home.ts (lines 1-511)
 *
 * @module server/trpc/routers/home/utils
 */

import { type AniListMedia } from '@/lib/schemas';
import { logger } from '@/utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Metadata structure for transformed AniList media
 */
export interface TransformedMediaMetadata {
  cover?: string;
  coverMedium?: string;
  bannerImage?: string;
  status?: string;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  author?: string | null;
}

/**
 * Transformed AniList media format for MangaRowCard component
 */
export interface TransformedAniListMedia {
  id: number;
  anilistId: number | null;
  title: string;
  metadata: TransformedMediaMetadata;
  _count: {
    chapters: number;
  };
  chapterCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Strip heavy JSONB fields from manga objects
 * These fields can be 1-2MB each and are not needed for list views
 *
 * @param manga - The manga object with potential heavy fields
 * @returns The manga object without heavy JSONB fields
 */
export function stripHeavyFields<T extends Record<string, unknown>>(
  manga: T
): Omit<T, 'providerMetadata' | 'rawProviderData' | 'monitoringConfig'> {
  const {
    providerMetadata: _providerMetadata,
    rawProviderData: _rawProviderData,
    monitoringConfig: _monitoringConfig,
    ...rest
  } = manga;
  return rest as Omit<T, 'providerMetadata' | 'rawProviderData' | 'monitoringConfig'>;
}

/**
 * Get date X days ago
 *
 * @param days - Number of days to subtract from current date
 * @returns Date object set to X days ago
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Extract the main author from AniList staff data
 * Priority: Original Creator > Story > first staff member
 *
 * @param staff - The staff data from AniList API
 * @returns The main author's name, or null if not available
 */
export function extractMainAuthor(staff?: AniListMedia['staff']): string | null {
  if (!staff?.edges || staff.edges.length === 0) return null;

  // Priority 1: Find "Original Creator"
  const originalCreator = staff.edges.find((edge) =>
    edge.role?.toLowerCase().includes('original creator')
  );
  if (originalCreator?.node?.name?.full) return originalCreator.node.name.full;

  // Priority 2: Find "Story" author
  const storyAuthor = staff.edges.find((edge) =>
    edge.role?.toLowerCase().includes('story')
  );
  if (storyAuthor?.node?.name?.full) return storyAuthor.node.name.full;

  // Fallback: Return first staff member
  return staff.edges[0]?.node?.name?.full ?? null;
}

/**
 * Build metadata object for transformed AniList media
 * Extracted to reduce complexity of transformAniListMedia
 *
 * @param media - The AniList media object
 * @param mainAuthor - Pre-extracted main author name
 * @returns Metadata object with optional fields conditionally included
 */
function buildMediaMetadata(
  media: AniListMedia,
  mainAuthor: string | null
): TransformedMediaMetadata {
  const cover = media.coverImage?.large ?? media.coverImage?.medium;
  const coverMedium = media.coverImage?.medium;
  const bannerImage = media.bannerImage;
  const status = media.status;
  const averageScore = media.averageScore;
  const popularity = media.popularity;

  return {
    // Conditionally spread optional fields
    ...(cover && { cover }),
    ...(coverMedium && { coverMedium }),
    ...(bannerImage && { bannerImage }),
    ...(status && { status }),
    // genres is always defined (transformed from nullable to [])
    genres: media.genres,
    ...(averageScore && { averageScore }),
    ...(popularity && { popularity }),
    ...(mainAuthor && { author: mainAuthor }),
  };
}

/**
 * Transform AniList media to our manga format for display
 * Converts AniList API response to format expected by MangaRowCard component
 *
 * @param media - The AniList media object to transform
 * @returns Transformed media object for display
 */
export function transformAniListMedia(media: AniListMedia): TransformedAniListMedia {
  const mainAuthor = extractMainAuthor(media.staff);
  const metadata = buildMediaMetadata(media, mainAuthor);

  return {
    id: media.id,
    // Required for click handlers in MangaRow component
    anilistId: media.id as number | null,
    title:
      media.title?.english ??
      media.title?.romaji ??
      media.title?.native ??
      'Unknown',
    metadata,
    _count: {
      chapters: media.chapters ?? 0,
    },
    chapterCount: media.chapters ?? 0,
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Complete AniList genres and tags for getAvailableGenres
 * Includes all official genres and popular tags from AniList
 * Organized alphabetically for easy maintenance
 */
export const COMMON_ANILIST_GENRES = [
  // Standard Genres
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  // Tags and Themes (A-Z)
  '4-koma',
  'Achromatic',
  'Achronological Order',
  'Acrobatics',
  'Acting',
  'Adoption',
  'Advertisement',
  'Afterlife',
  'Age Gap',
  'Age Regression',
  'Agender',
  'Agriculture',
  'Airsoft',
  'Alchemy',
  'Aliens',
  'Alternate Universe',
  'American Football',
  'Amnesia',
  'Anachronism',
  'Ancient China',
  'Angels',
  'Animals',
  'Anthology',
  'Anthropomorphism',
  'Anti-Hero',
  'Archery',
  'Aromantic',
  'Arranged Marriage',
  'Artificial Intelligence',
  'Asexual',
  'Assassins',
  'Astronomy',
  'Athletics',
  'Augmented Reality',
  'Autobiographical',
  'Aviation',
  'Badminton',
  'Ballet',
  'Band',
  'Bar',
  'Baseball',
  'Basketball',
  'Battle Royale',
  'Biographical',
  'Bisexual',
  'Blackmail',
  'Board Game',
  'Boarding School',
  'Body Horror',
  'Body Image',
  'Body Swapping',
  'Bowling',
  'Boxing',
  "Boys' Love",
  'Bullying',
  'Butler',
  'Calligraphy',
  'Camping',
  'Cannibalism',
  'Card Battle',
  'Cars',
  'Centaur',
  'CGI',
  'Cheerleading',
  'Chibi',
  'Chimera',
  'Chuunibyou',
  'Circus',
  'Class Struggle',
  'Classic Literature',
  'Classical Music',
  'Clone',
  'Coastal',
  'Cohabitation',
  'College',
  'Coming of Age',
  'Conspiracy',
  'Cosmic Horror',
  'Cosplay',
  'Cowboys',
  'Creature Taming',
  'Crime',
  'Criminal Organization',
  'Crossdressing',
  'Crossover',
  'Cult',
  'Cultivation',
  'Curses',
  'Cute Boys Doing Cute Things',
  'Cute Girls Doing Cute Things',
  'Cyberpunk',
  'Cyborg',
  'Cycling',
  'Dancing',
  'Death Game',
  'Delinquents',
  'Demons',
  'Denpa',
  'Desert',
  'Detective',
  'Dinosaurs',
  'Disability',
  'Dissociative Identities',
  'Dragons',
  'Drawing',
  'Drugs',
  'Dullahan',
  'Dungeon',
  'Dystopian',
  'E-Sports',
  'Eco-Horror',
  'Economics',
  'Educational',
  'Elderly Protagonist',
  'Elf',
  'Ensemble Cast',
  'Environmental',
  'Episodic',
  'Ero Guro',
  'Espionage',
  'Estranged Family',
  'Exorcism',
  'Fairy',
  'Fairy Tale',
  'Fake Relationship',
  'Family Life',
  'Fashion',
  'Female Harem',
  'Female Protagonist',
  'Femboy',
  'Fencing',
  'Filmmaking',
  'Firefighters',
  'Fishing',
  'Fitness',
  'Flash',
  'Food',
  'Football',
  'Foreign',
  'Found Family',
  'Fugitive',
  'Full CGI',
  'Full Color',
  'Gambling',
  'Gangs',
  'Gender Bending',
  'Ghost',
  'Go',
  'Goblin',
  'Gods',
  'Golf',
  'Gore',
  'Guns',
  'Gyaru',
  'Handball',
  'Henshin',
  'Heterosexual',
  'Hikikomori',
  'Hip-hop Music',
  'Historical',
  'Homeless',
  'Horticulture',
  'Ice Skating',
  'Idol',
  'Indigenous Cultures',
  'Inn',
  'Isekai',
  'Iyashikei',
  'Jazz Music',
  'Josei',
  'Judo',
  'Kabuki',
  'Kaiju',
  'Karuta',
  'Kemonomimi',
  'Kids',
  'Kingdom Management',
  'Konbini',
  'Kuudere',
  'Lacrosse',
  'Language Barrier',
  'LGBTQ+ Themes',
  'Long Strip',
  'Lost Civilization',
  'Love Triangle',
  'Mafia',
  'Magic',
  'Mahjong',
  'Maids',
  'Makeup',
  'Male Harem',
  'Male Protagonist',
  'Manzai',
  'Marriage',
  'Martial Arts',
  'Matchmaking',
  'Matriarchy',
  'Medicine',
  'Medieval',
  'Memory Manipulation',
  'Mermaid',
  'Meta',
  'Metal Music',
  'Military',
  'Mixed Gender Harem',
  'Mixed Media',
  'Modeling',
  'Monster Boy',
  'Monster Girl',
  'Mopeds',
  'Motorcycles',
  'Mountaineering',
  'Musical Theater',
  'Mythology',
  'Natural Disaster',
  'Necromancy',
  'Nekomimi',
  'Ninja',
  'No Dialogue',
  'Noir',
  'Non-fiction',
  'Nudity',
  'Nun',
  'Office',
  'Office Lady',
  'Oiran',
  'Ojou-sama',
  'Orphan',
  'Otaku Culture',
  'Outdoor Activities',
  'Pandemic',
  'Parenthood',
  'Parkour',
  'Parody',
  'Philosophy',
  'Photography',
  'Pirates',
  'Poker',
  'Police',
  'Politics',
  'Polyamorous',
  'Post-Apocalyptic',
  'POV',
  'Pregnancy',
  'Primarily Adult Cast',
  'Primarily Animal Cast',
  'Primarily Child Cast',
  'Primarily Female Cast',
  'Primarily Male Cast',
  'Primarily Teen Cast',
  'Prison',
  'Proxy Battle',
  'Psychosexual',
  'Puppetry',
  'Rakugo',
  'Real Robot',
  'Rehabilitation',
  'Reincarnation',
  'Religion',
  'Rescue',
  'Restaurant',
  'Revenge',
  'Reverse Isekai',
  'Robots',
  'Rock Music',
  'Rotoscoping',
  'Royal Affairs',
  'Rugby',
  'Rural',
  'Samurai',
  'Satire',
  'School',
  'School Club',
  'Scuba Diving',
  'Seinen',
  'Shapeshifting',
  'Ships',
  'Shogi',
  'Shoujo',
  'Shounen',
  'Shrine Maiden',
  'Skateboarding',
  'Skeleton',
  'Slapstick',
  'Slavery',
  'Snowscape',
  'Software Development',
  'Space',
  'Space Opera',
  'Spearplay',
  'Steampunk',
  'Stop Motion',
  'Succubus',
  'Suicide',
  'Sumo',
  'Super Power',
  'Super Robot',
  'Superhero',
  'Surfing',
  'Surreal Comedy',
  'Survival',
  'Swimming',
  'Swordplay',
  'Table Tennis',
  'Tanks',
  'Tanned Skin',
  'Teacher',
  "Teens' Love",
  'Tennis',
  'Terrorism',
  'Time Loop',
  'Time Manipulation',
  'Time Skip',
  'Tokusatsu',
  'Tomboy',
  'Torture',
  'Tragedy',
  'Trains',
  'Transgender',
  'Travel',
  'Triads',
  'Tsundere',
  'Twins',
  'Unrequited Love',
  'Urban',
  'Urban Fantasy',
  'Vampire',
  'Vertical Video',
  'Veterinarian',
  'Video Games',
  'Vikings',
  'Villainess',
  'Virtual World',
  'Vocal Synth',
  'Volleyball',
  'VTuber',
  'War',
  'Werewolf',
  'Wilderness',
  'Witch',
  'Work',
  'Wrestling',
  'Writing',
  'Wuxia',
  'Yakuza',
  'Yandere',
  'Youkai',
  'Yuri',
  'Zombie',
] as const;

/**
 * Type for valid AniList genres
 */
export type AniListGenre = (typeof COMMON_ANILIST_GENRES)[number];

// ============================================================================
// Format Filter (Experimental)
// ============================================================================

/**
 * Configuration for format-based filtering
 */
export interface FormatFilterConfig {
  filterWebtoons: boolean;
  filterKoreanManhwa: boolean;
}

/**
 * Check if media is a webtoon format
 * Webtoons are identified by:
 * - Tags containing "Long Strip" (vertical scroll format)
 * - Or format explicitly mentioning webtoon
 */
function isWebtoon(media: AniListMedia): boolean {
  // Check tags for "Long Strip" which is AniList's indicator for webtoon format
  // Runtime safety: media.tags can be undefined even though type says otherwise
  // (AniList API doesn't always return tags, Zod default only applies during parse)
  const tags = media.tags;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime tags can be undefined
  if (!tags || tags.length === 0) return false;

  const hasLongStripTag = tags.some(tag => {
    // Tags can be strings or objects with name property
    const tagName = typeof tag === 'string' ? tag : tag.name;
    return tagName.toLowerCase().includes('long strip');
  });

  return hasLongStripTag;
}

/**
 * Check if media is Korean manhwa
 * Identified by countryOfOrigin being 'KR' (Korea)
 */
function isKoreanManhwa(media: AniListMedia): boolean {
  const countryOfOrigin = media.countryOfOrigin?.toUpperCase();
  return countryOfOrigin === 'KR';
}

/**
 * Apply format-based filtering to AniList media array
 * Filters out webtoons and/or Korean manhwa based on config
 *
 * @param media - Array of AniList media to filter
 * @param config - Format filter configuration
 * @returns Filtered array of AniList media
 */
export function applyFormatFilter(
  media: AniListMedia[],
  config: FormatFilterConfig
): AniListMedia[] {
  // Skip filtering if both options are disabled
  if (!config.filterWebtoons && !config.filterKoreanManhwa) {
    return media;
  }

  const beforeCount = media.length;

  const filtered = media.filter(item => {
    // Check for webtoon format
    if (config.filterWebtoons && isWebtoon(item)) {
      logger.debug(`[FormatFilter] Filtering webtoon: "${item.title?.english ?? item.title?.romaji}"`);
      return false;
    }

    // Check for Korean manhwa
    if (config.filterKoreanManhwa && isKoreanManhwa(item)) {
      logger.debug(`[FormatFilter] Filtering Korean manhwa: "${item.title?.english ?? item.title?.romaji}" (countryOfOrigin: ${item.countryOfOrigin})`);
      return false;
    }

    return true;
  });

  if (beforeCount !== filtered.length) {
    logger.info(`[FormatFilter] Removed ${beforeCount - filtered.length} results. Remaining: ${filtered.length}`);
  }

  return filtered;
}
