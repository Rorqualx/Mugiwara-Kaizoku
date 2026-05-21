/**
 * Adaptive Fandom Parser Types
 *
 * Extends the existing dynamic-wiki-parser infrastructure with:
 * 1. URL Discovery - Finding the correct page for volume/chapter data
 * 2. Domain Redirect Handling - Following 301 redirects
 * 3. Pattern Caching - Caching successful extraction patterns per domain
 * 4. Orchestration - Coordinating the adaptive parsing flow
 *
 * NOTE: Structure detection and selector generation already exist in
 * `../dynamic/dynamic-wiki-parser/`. This module adds the missing pieces.
 */

import type {
  ContentPatterns,
  DynamicSelectors,
  PageStructure,
  StructureMetadata,
  StructureType,
} from '../dynamic/dynamic-wiki-parser/types';
import type { FandomMangaData } from '../types';

// Re-export existing types for convenience
export type {
  StructureType,
  PageStructure,
  DynamicSelectors,
  ContentPatterns,
  StructureMetadata,
};

// ============================================================================
// URL Discovery Types
// ============================================================================

/**
 * Result of probing a URL to check if it exists.
 */
export interface UrlProbeResult {
  /** The URL that was probed */
  url: string;
  /** Whether the URL returned a valid page (2xx status) */
  exists: boolean;
  /** If redirected, the final URL after following redirects */
  redirectedTo?: string;
  /** The final domain (if redirected to different domain) */
  redirectedDomain?: string;
  /** HTTP status code returned */
  statusCode: number;
  /** Time taken to probe in milliseconds */
  probeTimeMs?: number;
}

/**
 * Content quality score for a URL.
 * Used to rank URLs by how likely they are to contain useful chapter/volume data.
 */
export interface UrlContentScore {
  /** The URL that was scored */
  url: string;
  /** Overall score (higher = better content) */
  score: number;
  /** Number of chapter patterns found */
  chapterIndicators: number;
  /** Number of volume patterns found */
  volumeIndicators: number;
  /** Number of chapter/volume links found */
  chapterVolumeLinks: number;
  /** Whether the page has tables with chapter content */
  hasChapterTables: boolean;
  /** Whether the page has numbered lists */
  hasNumberedLists: boolean;
  /** Breakdown of scoring factors */
  breakdown: Record<string, number>;
}

/**
 * Result of URL discovery for a wiki.
 */
export interface UrlDiscoveryResult {
  /** The URL that was found to contain volume/chapter data */
  foundUrl: string | null;
  /** All URLs that were probed (for debugging) */
  triedUrls: string[];
  /** Status codes for each probed URL */
  statusCodes: Map<string, number>;
  /** The canonical domain after following redirects */
  canonicalDomain: string;
  /** Time taken for discovery in milliseconds */
  durationMs: number;
}

/**
 * URL patterns to probe for chapter/volume listings.
 * Ordered by specificity and data quality (subpages before parents, detailed before category).
 *
 * IMPORTANT: Subpage patterns (e.g., /Volumes subpage) are probed BEFORE
 * the parent page because parents are often navigation hubs without extractable data.
 *
 * Pattern sources (50+ manga research):
 * - Chapters_and_Volumes/Volumes: One Piece (has actual volume data)
 * - Chapters_and_Volumes: Dr. Stone, Spy x Family, Vinland Saga, OPM, FMA, Demon Slayer, Frieren
 * - Volumes_%26_Chapters: JJK, Iruma-kun, Tokyo Revengers, Gachiakuta
 * - List_of_Chapters_and_Volumes: 100 Girlfriends, Black Clover, Kaguya-sama
 * - Chapters: Mob Psycho 100, Bleach
 * - Category:Volumes: Tokyo Ghoul, Kaiju No. 8, Chainsaw Man, Sakamoto Days
 * - Volume_1: Blue Lock, Goodnight Punpun (per-volume pattern)
 */
export const URL_PROBE_PATTERNS: readonly string[] = [
  // Subpage patterns FIRST (more specific = more likely to have actual data)
  // One Piece pattern: /Chapters_and_Volumes is navigation hub, /Volumes has real data
  '/wiki/Chapters_and_Volumes/Volumes',
  '/wiki/Chapters_and_Volumes/Chapters',
  // Primary patterns - detailed chapter/volume listings (most common)
  '/wiki/Chapters_and_Volumes',
  '/wiki/Volumes_%26_Chapters',
  '/wiki/Volumes_&_Chapters',
  '/wiki/List_of_Chapters_and_Volumes',
  '/wiki/List_of_Chapters_%26_Volumes',
  '/wiki/List_of_Volumes_and_Chapters',
  '/wiki/Volumes_and_Chapters',
  '/wiki/Chapters',
  '/wiki/List_of_Volumes',
  '/wiki/List_of_Chapters',
  // Title-specific list patterns (common on wikis with non-standard naming)
  '/wiki/List_of_chapters',
  '/wiki/List_of_chapters',
  // Category pages (Tokyo Ghoul, Kaiju No. 8, Chainsaw Man, Sakamoto Days)
  '/wiki/Category:Volumes',
  '/wiki/Category:Chapters',
  // Alternative patterns
  '/wiki/Manga_Guide',
  '/wiki/Volumes',
  // Per-volume fallback patterns (Blue Lock, Goodnight Punpun, Mushoku Tensei)
  '/wiki/Volume_1',
  '/wiki/Manga_Volume_1',
  // Manga-specific patterns (some wikis use the manga title in the URL)
  '/wiki/Manga',
  '/wiki/List_of_Episodes', // Berserk uses episodes instead of chapters
  // Additional chapter list patterns
  '/wiki/Chapter_List',
  '/wiki/Episode_List',
  '/wiki/Episodes',
  '/wiki/Story_Arcs',
  '/wiki/Arcs',
  // Volume-specific patterns
  '/wiki/Volume_List',
  '/wiki/Tankōbon',
  '/wiki/Tankobon',
  // Media-specific patterns
  '/wiki/Media',
  '/wiki/Releases',
  '/wiki/Releases_(Manga)',
  '/wiki/Publications',
] as const;

/**
 * Wiki-specific URL patterns for wikis that use non-standard naming.
 * Key is the domain prefix (before .fandom.com), value is the specific URL path.
 */
export const WIKI_SPECIFIC_URL_PATTERNS: Record<string, string[]> = {
  // Haikyuu uses unicode title: Haikyū!!_Volumes
  haikyuu: ['/wiki/Haiky%C5%AB!!_Volumes', '/wiki/Haikyu!!_Volumes'],
  // Evangelion - detailed chapter list first (uses "Stage.01" format), then manga page for volumes
  evangelion: ['/wiki/List_of_Neon_Genesis_Evangelion_chapters', '/wiki/Neon_Genesis_Evangelion_(manga)'],
  // Berserk uses Releases_(Manga) for chapter/volume listings
  berserk: ['/wiki/Releases_(Manga)', '/wiki/List_of_Volumes', '/wiki/Chapters_and_Volumes'],
  // Naruto's main list
  naruto: ['/wiki/List_of_Volumes', '/wiki/Manga'],
  // Punpun has Category:Chapters and Category:Volume (singular!) with zero-padded volume URLs
  punpun: ['/wiki/Category:Volume', '/wiki/Category:Chapters', '/wiki/Category:Volumes', '/wiki/Volume_1'],
  // March Comes in Like a Lion - manga specific page
  'march-comes-like-lion': ['/wiki/March_Comes_in_Like_a_Lion_(Manga)'],
  // DARLING in the FRANXX
  'darling-in-the-franxx': ['/wiki/DARLING_in_the_FRANXX_(manga)', '/wiki/Manga'],
  // Hope You're Happy, Lemon - main manga page has volume table
  hopeyourehappylemon: ['/wiki/Hope_You%27re_Happy_Lemon_(Manga)', '/wiki/List_of_Chapters_%26_Volumes', '/wiki/Chapters_%26_Volumes'],
  // Fly Me to the Moon (Tonikaku Kawaii) - separate pages for chapters and volumes
  'tonikaku-kawaii': ['/wiki/Chapters', '/wiki/Volumes', '/wiki/Manga'],
  // JoJo's Bizarre Adventure - has detailed chapter list split across multiple pages
  jojo: [
    '/wiki/List_of_JoJo%27s_Bizarre_Adventure_chapters',
    '/wiki/List_of_JoJo%27s_Bizarre_Adventure_chapters/Volume_51_to_100',
    '/wiki/List_of_JoJo%27s_Bizarre_Adventure_chapters/Volume_101_to_Current',
    '/wiki/Chapters',
  ],
  // Monster (obluda.fandom.com) - uses lowercase list
  obluda: ['/wiki/List_of_chapters', '/wiki/Monster_(Manga)'],
  // Slam Dunk - uses Manga_Guide page
  slamdunk: ['/wiki/Manga_Guide', '/wiki/Manga'],
  // Fire Punch - uses Category:Chapters (note: firepunch.fandom.com redirects to fire-punch.fandom.com)
  'fire-punch': ['/wiki/Category:Chapters', '/wiki/Fire_Punch_(Manga)'],
  // Black Clover - specific list page
  blackclover: ['/wiki/List_of_Chapters_and_Volumes', '/wiki/Chapters'],
  // Solo Leveling - uses Volumes_and_Chapters with fandom-table article-table class
  'solo-leveling': ['/wiki/Volumes_and_Chapters', '/wiki/Category:Chapters'],
  // 86-EIGHTY-SIX - uses simple Manga page
  '86-eighty-six': ['/wiki/Three_Volume_Chapters', '/wiki/Manga', '/wiki/86_-Eighty_Six-_(Manga)', '/wiki/Chapters'],
  // Future Diary - needs discovery
  futurediary: ['/wiki/Chapters', '/wiki/Future_Diary_(Manga)', '/wiki/Manga'],
  // Yu Yu Hakusho
  yuyuhakusho: ['/wiki/List_of_YuYu_Hakusho_chapters', '/wiki/Chapters'],
  // Cat's Eye
  catseye: ['/wiki/Volumes_and_Chapters', '/wiki/Chapters'],
  // Sugar Sugar Rune
  sugarsugarrune: ['/wiki/Sugar_Sugar_Rune', '/wiki/Manga'],
  // Hajime no Ippo
  hajimenoippo: ['/wiki/Manga_Guide', '/wiki/Chapters'],
  // Tokyo Ghoul - category and manga page
  // Tokyo Ghoul - note: lowercase (manga) is the actual page title, (Manga) returns 404
  tokyoghoul: ['/wiki/Tokyo_Ghoul_(manga)', '/wiki/Category:Chapters'],
  // Assassination Classroom - Volumes_and_Chapters has full chapter titles in table rows
  ansatsukyoshitsu: ['/wiki/Volumes_and_Chapters', '/wiki/Category:Chapters'],
  // Blue Lock - uses List_of_Chapters
  bluelock: ['/wiki/List_of_Chapters', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Demon Slayer (Kimetsu no Yaiba)
  'kimetsu-no-yaiba': ['/wiki/Chapters_and_Volumes', '/wiki/Category:Chapters', '/wiki/Chapters'],
  // Horimiya - manga page with volume list
  horimiya: ['/wiki/Horimiya_(Manga)', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // One Piece - uses subpage for volumes (main page is navigation hub)
  onepiece: ['/wiki/Chapters_and_Volumes/Volumes', '/wiki/Chapters_and_Volumes'],
  // Dr. Stone - specific chapters and volumes page with collapsible sections
  'dr-stone': ['/wiki/Chapters_and_Volumes', '/wiki/Category:Manga_Chapters'],
  // Death Note - has dedicated chapter list page (main page is disambiguation)
  deathnote: ['/wiki/List_of_Death_Note_Chapters', '/wiki/Death_Note_(manga)'],
  // Attack on Titan - has dedicated chapter list page (main page is disambiguation)
  attackontitan: ['/wiki/List_of_Attack_on_Titan_chapters', '/wiki/Attack_on_Titan_(Manga)'],
  // Dragon Ball - has manga chapters list with 519 chapters across 42 volumes
  dragonball: ['/wiki/List_of_Dragon_Ball_manga_chapters', '/wiki/Dragon_Ball_(manga)'],
  // Erased (Boku dake ga Inai Machi) - /wiki/Manga has chapters with titles in paragraph links
  // /wiki/Chapters_and_Volumes has simpler structure but no chapter titles
  bokudakegainaimachi: ['/wiki/Manga', '/wiki/Chapters_and_Volumes'],
  // Also handle the bokumachi alias directly
  bokumachi: ['/wiki/Manga', '/wiki/Chapters_and_Volumes'],
  // Re:ZERO - manga adaptation pages
  rezero: ['/wiki/Re:Zero_kara_Hajimeru_Isekai_Seikatsu_(manga)', '/wiki/Manga_Arc_1_Volume_1'],
  // Mercenary Enrollment (Teenage Mercenary)
  'mercenary-enrollment': ['/wiki/Mercenary_Enrollment_Wiki', '/wiki/Chapters'],
  // Chainsaw Man - category pages for volumes and chapters
  'chainsaw-man': ['/wiki/Category:Chapters', '/wiki/Category:Volumes', '/wiki/Chainsaw_Man_(Manga)'],
  // Kaiju No. 8 - category pages
  'kaiju-no-8': ['/wiki/Category:Chapters', '/wiki/Category:Volumes', '/wiki/Kaiju_No._8'],
  // Bleach - /wiki/Chapters has the chapter-volume table with numbered-text links (001. Title format)
  bleach: ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/List_of_Volumes_and_Chapters', '/wiki/Category:Volumes'],
  // Detective Conan (Case Closed) - uses List_of_Detective_Conan_Volumes with "0001 - Title" format
  detectiveconan: ['/wiki/List_of_Detective_Conan_Volumes', '/wiki/Manga', '/wiki/Category:Chapters'],
  // My Hero Academia - main chapters page with collapsible sections
  myheroacademia: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Vinland Saga - uses Manga page and chapters
  'vinland-saga': ['/wiki/Manga', '/wiki/Chapters', '/wiki/Category:Chapters', '/wiki/Category:Volumes'],
  // Hunter x Hunter - uses List_of_Volumes_and_Chapters with table-based layout
  hunterxhunter: ['/wiki/List_of_Volumes_and_Chapters', '/wiki/Chapters', '/wiki/Volumes'],
  // Kuroko no Basket - uses List_of_Volumes with standalone volume tables (br-separated chapters)
  kurokonobasuke: ['/wiki/List_of_Volumes', '/wiki/Category:Chapters'],
  // Eyeshield 21 - uses lowercase list_of_chapters
  eyeshield21: ['/wiki/List_of_chapters', '/wiki/List_of_Chapters', '/wiki/Chapters'],
  // Kingdom - uses Volumes_and_Chapters with tabbed/paginated navigation
  kingdom: ['/wiki/Volumes_and_Chapters', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Blue Box - uses Chapters_and_Volumes
  'blue-box': ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Volumes'],
  // Fairy Tail - uses Volumes_and_Chapters with hierarchical table structure
  fairytail: ['/wiki/Volumes_and_Chapters', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Seven Deadly Sins (Nanatsu no Taizai) - uses Manga page
  'nanatsu-no-taizai': ['/wiki/Manga', '/wiki/Chapters_and_Volumes', '/wiki/Chapters'],
  // Magi - uses Volumes page
  magi: ['/wiki/Volumes', '/wiki/Chapters', '/wiki/Manga'],
  // Gintama - uses "Lessons" terminology instead of "Chapters"
  gintama: ['/wiki/Lessons_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Kengan Ashura (kenganverse wiki) - uses Chapters_and_Volumes_(Ashura)
  kenganverse: ['/wiki/Chapters_and_Volumes_(Ashura)', '/wiki/Chapters', '/wiki/Chapters_and_Volumes'],
  // Boruto - uses List_of_Chapters
  boruto: ['/wiki/List_of_Chapters', '/wiki/Chapters', '/wiki/Manga'],
  // Blue Exorcist (Ao no Exorcist) - uses Volumes_and_Chapters
  aonoexorcist: ['/wiki/Volumes_and_Chapters', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Konosuba - per-volume pages at /wiki/Konosuba_Manga_Volume_N and per-chapter
  // pages at /wiki/Konosuba_Chapter_N. The series page is the LN title in JP.
  konosuba: [
    '/wiki/Konosuba_Manga_Volume_1',
    '/wiki/Konosuba_Chapter_1',
    '/wiki/Kono_Subarashii_Sekai_ni_Shukufuku_wo!',
    '/wiki/Konosuba_Manga',
  ],
  // Rurouni Kenshin - per-volume pattern (no central chapters page)
  kenshin: ['/wiki/Volume_1', '/wiki/Rurouni_Kenshin', '/wiki/Chapters'],
  // Hajime no Ippo - uses Manga_Guide with "Rounds" terminology
  ippo: ['/wiki/Manga_Guide', '/wiki/Chapters', '/wiki/List_of_Manga_Rounds'],
  // Akira - minimal wiki, use manga page
  akira: ['/wiki/Akira_(manga)', '/wiki/Manga', '/wiki/Chapters'],
  // Vagabond - uses Chapters_and_Volumes with H2-grouped volume tables
  vagabond: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Made in Abyss - chapters page with series-prefixed chapter URLs (Made_in_Abyss_Chapter_001)
  madeinabyss: ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/Volume_1'],
  // Dandadan - uses Chapters_and_Volumes with JP/EN tabber tabs
  dandadan: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // The Promised Neverland - uses Chapters_and_Volumes with volume tables
  yakusokunoneverland: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  'the-promised-neverland': ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Haikyuu - also accessible via non-unicode URL
  'haikyu': ['/wiki/Haiky%C5%AB!!_Volumes', '/wiki/Haikyu!!_Volumes', '/wiki/Chapters'],
  // Noragami - uses List_of_Chapters (not standard Chapters page)
  noragami: ['/wiki/List_of_Chapters', '/wiki/Chapters', '/wiki/Chapters_and_Volumes'],
  // Oshi no Ko - subpage pattern with parenthetical
  oshinoko: ['/wiki/Oshi_no_Ko_(manga)/Chapters_and_Volumes', '/wiki/Chapters_and_Volumes', '/wiki/Chapters'],
  // Frieren - standard Chapters_and_Volumes with DPL3 dynamic content
  frieren: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // InuYasha - uses List_of_published_media (non-standard name)
  inuyasha: ['/wiki/List_of_published_media', '/wiki/InuYasha_(Manga)', '/wiki/Chapters'],
  // World Trigger - main Manga page with <ol> chapter lists in volume tables
  worldtrigger: ['/wiki/Manga', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Record of Ragnarok - uses Chapters page
  'record-of-ragnarok': ['/wiki/Chapters', '/wiki/Manga', '/wiki/Category:Chapters'],
  // Jujutsu Kaisen - uses Chapters page
  'jujutsu-kaisen': ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/Category:Chapters'],
  // Soul Eater - uses Manga page with chapter list
  souleater: ['/wiki/Soul_Eater_Manga', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Parasyte - uses Manga page
  parasyte: ['/wiki/Parasyte_(Manga)', '/wiki/Chapters', '/wiki/Manga'],
  // Gantz - uses Manga page
  gantz: ['/wiki/Manga', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Fruits Basket - uses Chapters page
  fruitsbasket: ['/wiki/Chapters', '/wiki/Fruits_Basket_(Manga)', '/wiki/Category:Chapters'],
  // D.Gray-man - uses Chapters page
  dgrayman: ['/wiki/Chapters_List', '/wiki/Chapters', '/wiki/D.Gray-man_(Manga)'],
  // Zatch Bell - uses Manga page
  zatchbell: ['/wiki/Manga', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Mashle - uses Chapter list
  mashle: ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/Category:Chapters'],
  // Undead Unluck - uses Chapters page
  'undead-unluck': ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/Category:Chapters'],
  // Komi Can't Communicate - uses Volumes_%26_Chapters (URL-encoded ampersand)
  komisan: ['/wiki/Volumes_%26_Chapters', '/wiki/Chapters', '/wiki/Category:Chapters'],
  // Skip Beat! - uses Chapters page
  'skip-beat': ['/wiki/Chapters', '/wiki/List_of_Chapters', '/wiki/Chapters_and_Volumes'],
  // Pandora Hearts (on mochijun multi-series wiki) - uses List_of_Volumes_(Pandora_Hearts)
  mochijun: ['/wiki/List_of_Volumes_(Pandora_Hearts)', '/wiki/Pandora_Hearts', '/wiki/Chapters'],
};

/**
 * Known domain redirects (original → canonical).
 * Updated as new redirects are discovered.
 */
export const KNOWN_DOMAIN_REDIRECTS: Record<string, string> = {
  'chainsawman.fandom.com': 'chainsaw-man.fandom.com',
  'bokunoheroacademia.fandom.com': 'myheroacademia.fandom.com',
  'fullmetal-alchemist.fandom.com': 'fma.fandom.com',
  'drstone.fandom.com': 'dr-stone.fandom.com',
  'blue-lock.fandom.com': 'bluelock.fandom.com',
  'summertime-rendering.fandom.com': 'summer-time-rendering.fandom.com',
  'summertime-render.fandom.com': 'summer-time-rendering.fandom.com',
  'tengoku-daimakyo.fandom.com': 'heavenly-delusion.fandom.com',
  'codegeass.fandom.com': 'code-geass.fandom.com',
  'firepunch.fandom.com': 'fire-punch.fandom.com',
  // Future Diary uses futurediary (no hyphen)
  'future-diary.fandom.com': 'futurediary.fandom.com',
  // Blue Box uses blue-box (with hyphen)
  'bluebox.fandom.com': 'blue-box.fandom.com',
  // Detective Conan aliases
  'caseclose.fandom.com': 'detectiveconan.fandom.com',
  'caseclosed.fandom.com': 'detectiveconan.fandom.com',
  // NOTE: bokumachi.fandom.com is a SEPARATE wiki from bokudakegainaimachi.fandom.com
  // Do NOT redirect between them - they have different chapter structures
};

// ============================================================================
// Pattern Cache Types
// ============================================================================

/**
 * Cached pattern entry for a wiki domain.
 * Stores everything needed to extract data without re-detecting.
 */
export interface CachedPattern {
  /** Wiki domain (e.g., "mob-psycho-100.fandom.com") */
  domain: string;
  /** Discovered URL path for chapters/volumes page */
  urlPath: string;
  /** If domain was redirected, the canonical domain */
  canonicalDomain?: string;
  /** Detected structure type from dynamic-wiki-parser */
  structureType: StructureType;
  /** Full page structure analysis */
  pageStructure: PageStructure;
  /** When this pattern was discovered */
  discoveredAt: Date;
  /** Last time this pattern was used successfully */
  lastUsedAt: Date;
  /** Number of successful extractions using this pattern */
  successCount: number;
  /** Number of failed extractions (for adaptive invalidation) */
  failureCount: number;
}

/**
 * Pattern cache configuration.
 */
export interface PatternCacheConfig {
  /** Time to live in milliseconds (default: 24 hours) */
  ttlMs: number;
  /** Maximum number of patterns to cache (default: 500) */
  maxSize: number;
  /** Whether to persist cache across restarts (default: false) */
  persist: boolean;
  /** Failure threshold before invalidating cache (default: 3) */
  failureThreshold: number;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: PatternCacheConfig = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 500,
  persist: false,
  failureThreshold: 3,
};

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Options for the adaptive parser orchestrator.
 */
export interface AdaptiveParserOptions {
  /** Maximum time to wait for URL probing (ms) */
  probeTimeoutMs: number;
  /** Maximum time for full extraction (ms) */
  extractionTimeoutMs: number;
  /** Whether to use cached patterns */
  useCache: boolean;
  /** Whether to fall back to legacy parser on failure */
  fallbackToLegacy: boolean;
  /** Minimum confidence threshold for using cached patterns */
  cacheConfidenceThreshold: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Series title for filtering franchise wikis (e.g., "Stone Ocean" for jojos.fandom.com) */
  seriesTitle?: string;
}

/**
 * Default orchestrator options.
 */
export const DEFAULT_PARSER_OPTIONS: AdaptiveParserOptions = {
  probeTimeoutMs: 5000,
  extractionTimeoutMs: 30000,
  useCache: true,
  fallbackToLegacy: true,
  cacheConfidenceThreshold: 0.7,
};

/**
 * Result of an adaptive parse operation.
 */
export interface AdaptiveParseResult {
  /** Whether the parse was successful */
  success: boolean;
  /** Extracted manga data (if successful) */
  data?: FandomMangaData;
  /** Error message (if failed) */
  error?: string;
  /** Detected structure type */
  structureType?: StructureType;
  /** URL that was actually parsed (after redirects) */
  parsedUrl: string;
  /** Canonical domain used */
  domain: string;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Whether cache was used */
  usedCache: boolean;
  /** Whether legacy fallback was used */
  usedLegacyFallback: boolean;
  /** Confidence score of the extraction (0-1) */
  confidence: number;
}

// ============================================================================
// Extraction Strategy Types
// ============================================================================

/**
 * Extended extraction config that builds on PageStructure.
 * Adds wiki-specific customizations discovered during analysis.
 */
export interface WikiExtractionConfig {
  /** Domain this config is for */
  domain: string;
  /** Base page structure from structure-analyzer */
  baseStructure: PageStructure;
  /** Detected chapter link pattern regex */
  chapterLinkPattern?: RegExp;
  /** Detected chapter terminology (Chapter, Lesson, Mission, etc.) */
  chapterTerminology?: string;
  /** Whether JP/EN tabs exist */
  hasLanguageTabs: boolean;
  /** Whether volumes use per-page pattern (Volume_1, Volume_2, etc.) */
  usesPerVolumePages: boolean;
  /** Estimated volume count (for per-volume scraping) */
  estimatedVolumeCount?: number;
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log entry for pattern discovery operations.
 */
export interface PatternDiscoveryLog {
  wiki: string;
  urlsProbed: string[];
  successfulUrl?: string;
  redirects?: Array<{ from: string; to: string }>;
  detectedStructure?: StructureType;
  duration: number;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// Metadata Fetcher Types
// ============================================================================

/**
 * Options for fetching main page metadata.
 */
export interface MetadataFetchOptions {
  /** Maximum time to wait for metadata fetch (ms) */
  timeoutMs: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Series title for filtering franchise wikis (e.g., "Stone Ocean" for jojos.fandom.com) */
  seriesTitle?: string;
}

/**
 * Default metadata fetch options.
 */
export const DEFAULT_METADATA_OPTIONS: MetadataFetchOptions = {
  timeoutMs: 10000,
};

/**
 * Metadata extracted from the main manga page (infobox + wikitext).
 */
export interface FetchedMetadata {
  /** Series title (inferred from wiki or page) */
  title?: string;
  /** Author/writer of the manga */
  author?: string;
  /** Artist/illustrator (if different from author) */
  artist?: string;
  /** Publisher name */
  publisher?: string;
  /** Magazine where serialized */
  magazine?: string;
  /** Publication status (ONGOING, FINISHED, HIATUS) */
  status?: string;
  /** Publication start date */
  startDate?: string;
  /** Publication end date */
  endDate?: string;
  /** Synopsis/description text */
  synopsis?: string;
  /** Genre categories */
  genres?: string[];
  /** Target demographic */
  demographic?: string;
  /** Cover image URL */
  coverImage?: string;
  /** Alternative titles (Japanese, Romaji, etc.) */
  alternativeTitles?: string[];
  /** Volume count from infobox */
  volumes?: number;
  /** Chapter count from infobox */
  chapters?: number;
}

/**
 * Result of fetching main page metadata.
 */
export interface MetadataFetchResult {
  /** Whether the metadata fetch succeeded */
  success: boolean;
  /** Extracted metadata (if successful) */
  metadata?: FetchedMetadata;
  /** The main page URL that was fetched */
  mainPageUrl?: string;
  /** Error message (if failed) */
  error?: string;
  /** Time taken in milliseconds */
  durationMs: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for CachedPattern.
 */
export function isCachedPattern(value: unknown): value is CachedPattern {
  if (typeof value !== 'object' || value === null) return false;
  const pattern = value as Partial<CachedPattern>;
  return (
    typeof pattern.domain === 'string' &&
    typeof pattern.urlPath === 'string' &&
    typeof pattern.structureType === 'string' &&
    pattern.discoveredAt instanceof Date
  );
}

/**
 * Type guard for AdaptiveParseResult.
 */
export function isAdaptiveParseResult(value: unknown): value is AdaptiveParseResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<AdaptiveParseResult>;
  return (
    typeof result.success === 'boolean' &&
    typeof result.parsedUrl === 'string' &&
    typeof result.domain === 'string'
  );
}
