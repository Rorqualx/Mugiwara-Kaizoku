/**
 * ComicVine Scraping Constants
 *
 * HTTP headers, selectors, and regex patterns for ComicVine scraping.
 * Extracted from: scrapingService.ts
 *
 * @module constants
 */

/**
 * User agent string for HTTP requests to ComicVine
 * Updated to modern Chrome version to avoid Cloudflare blocking
 */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Standard HTTP headers for ComicVine requests
 * Uses realistic browser headers to avoid Cloudflare blocking
 */
export const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  Connection: 'keep-alive',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
} as const;

/**
 * Regex patterns for extracting chapter information from text
 * Patterns are ordered by priority (most specific first)
 *
 * Supports formats:
 * - Chapter 0: Prologue
 * - Chapter I: Title
 * - Chapter 1: Title
 * - Episode 5: Title
 * - Story 3: Title
 * - Part 2: Title
 * - Final Chapter: Title
 * - Epilogue 1: Title
 */
export const CHAPTER_PATTERNS = [
  // Chapter 0-X prequel format (e.g., "Chapter 0-1: The Cursed Child" for JJK Vol 0)
  // Must be checked BEFORE regular Chapter 0 since "Chapter 0-1" would match "Chapter 0"
  /Chapter\s+0+-(\d+)[:\s]+([^\n]+?)(?=Chapter\s+[0-9IVXLCDM]|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // 000-X format (e.g., "000-1: Title", "000-2: Title")
  /0+-(\d+)[:\s]+([^\n]+?)(?=0+-\d+|Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Chapter 0 (special prologue chapters)
  /Chapter\s+(0)[:\s]+([^\n]+?)(?=Chapter\s+[0-9IVXLCDM]+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Chapter with Roman numerals (e.g., "Chapter I: The Beginning")
  /Chapter\s+([IVXLCDM]+)[:\s]+([^\n]+?)(?=Chapter\s+[0-9IVXLCDM]+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Chapter with Arabic numbers (e.g., "Chapter 1: The Beginning")
  /Chapter\s+(\d+)[:\s]+([^\n]+?)(?=Chapter\s+\d+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Spell chapters (Dorohedoro uses "Spell 1: Caiman", "Spell 2: Hungry Bug", etc.)
  /Spell\s+(\d+)[:\s]+([^\n]+?)(?=Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Episode with Roman numerals
  /Episode\s+([IVXLCDM]+)[:\s]+([^\n]+?)(?=Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Episode with Arabic numbers
  /Episode\s+(\d+)[:\s]+([^\n]+?)(?=Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Story chapters (common in older manga)
  /Story\s+(\d+)[:\s]+([^\n]+?)(?=Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Part chapters
  /Part\s+(\d+)[:\s]+([^\n]+?)(?=Chapter\s+|Episode\s+|Story\s+|Part\s+|Spell\s+|Epilogue|Final Chapter|$)/gi,

  // Final Chapter (special ending chapter)
  /Final Chapter[:\s]+([^\n]+?)(?=Epilogue|Chapter Titles|$)/gi,

  // Epilogue chapters (numbered)
  /Epilogue\s+(\d+)[:\s]+([^\n]+?)(?=Epilogue|Chapter Titles|$)/gi,
] as const;

/**
 * CSS selectors for finding chapter lists in page HTML
 * Checked in order until chapters are found
 */
export const LIST_SELECTORS = [
  'ul li:contains("Chapter")',
  'ol li:contains("Chapter")',
  'ul li:contains("Episode")',
  'ul li:contains("Story")',
  'ul li:contains("Spell")',
  'ol li:contains("Spell")',
  'ul li:contains("Lesson")',
  'ul li:contains("Round")',
  '.wiki-content li:contains("Chapter")',
  '.wiki-content li:contains("Spell")',
  '.wiki-content li:contains("Episode")',
  '.wiki-content li:contains("Lesson")',
  '.content-body li:contains("Chapter")',
  '.content-body li:contains("Spell")',
  '.content-body li:contains("Episode")',
  '.content-body li:contains("Lesson")',
] as const;

/**
 * Patterns for finding chapter section headers in API descriptions
 * Used by: comicvine-chapter-parser.ts
 */
export const CHAPTER_SECTION_HEADERS = [
  /chapter\s*titles?/i,
  /table\s*of\s*contents?/i,
  // iter-PVM-3.1: trailing colon optional — CV descriptions often have bare
  // "Contents" / "Chapters" headings (e.g. <h2>Contents</h2>) where the colon
  // is implied by the HTML structure. Anchored so prose doesn't accidentally
  // activate (e.g. "This volume's contents include..." stays prose).
  /^contents?:?\s*$/i,
  /^chapters?:?\s*$/i,
  /^includes?:?\s*$/i,
  /^contains?:?\s*$/i,
  /^stories?:?\s*$/i,
] as const;

/**
 * Patterns for parsing chapters from API issue descriptions
 * These are simpler than CHAPTER_PATTERNS (no lookahead) since descriptions are structured
 *
 * Used by: comicvine-chapter-parser.ts
 *
 * Supports formats:
 * - "Chapter 123: Title" or "Chapter 123 - Title"
 * - "Ch. 123: Title" or "Ch 123 - Title"
 * - "#123: Title" or "#123 - Title"
 * - "123. Title" or "123) Title"
 * - "Part 123: Title"
 * - "Episode 123: Title"
 * - Bullet points: "• Title" or "- Title"
 * - Quoted titles: '"Title"' or "'Title'"
 */
/** Range pattern for "Chapter X - Y" or "Contains Chapter X - Y" (exported for range detection).
 *  Captures decimal endpoints (e.g. "Chapters 1 - 6.5") for non-standard chapter numbering. */
export const CHAPTER_RANGE_PATTERN =
  /(?:Contains\s+)?(?:Chapters?|Spells?|Curses?|Episodes?|Missions?|Stages?)\s+(\d+(?:\.\d+)?)\s*[-–—]\s*(?:(?:Chapters?|Spells?|Curses?|Episodes?|Missions?|Stages?)\s+)?(\d+(?:\.\d+)?)/i;

export const DESCRIPTION_CHAPTER_PATTERNS = [
  // "Chapter 123: Title" or "Chapter 123.5 - Title" (decimal for interludes/specials)
  /^Chapter\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // "Ch. 123: Title" or "Ch 123.5 - Title"
  /^Ch\.?\s*(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // "#123: Title" or "#123.5 - Title"
  /^#(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/,
  // "123. Title" or "123.5. Title" or "123) Title"
  /^(\d+(?:\.\d+)?)[.)]\s*(.+)$/,
  // "Part 123: Title"
  /^Part\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // "Episode 123: Title"
  /^Episode\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Spell chapters (Dorohedoro: "Spell 1: Caiman")
  /^Spell\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Curse chapters (Dorohedoro alt: "Curse 1: Caiman")
  /^Curse\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Stage chapters (Evangelion: "Stage 1: Angel Attack")
  /^Stage\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Mission chapters (Spy x Family: "Mission 1: ...")
  /^Mission\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Act/Scene/Case/Round/Night/Track/Lesson/Log/Tale
  /^(?:Act|Scene|Case|Round|Night|Track|Lesson|Log|Tale)\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Iter 16 (production port): manga-specific labeled formats discovered by
  // the comicvine-accuracy loop:
  //   Naruto:       "Number 1: Uzumaki Naruto!"
  //   My Hero Aca:  "No. 1: Izuku Midoriya: Origin"
  //   Black Clover: "Page 1: The Boy's Vow"
  /^Number\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  /^No\.?\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  /^Page\s+(\d+(?:\.\d+)?)[\s::\-–—]+(.+)$/i,
  // Just chapter titles without numbers (if in chapter section)
  /^[•·\-*]\s*(.+)$/,
  // Quoted titles
  /^["'](.+)["']$/,
] as const;

/**
 * Patterns that indicate the end of a chapter section in descriptions
 * Used by: comicvine-chapter-parser.ts
 */
export const SECTION_TERMINATORS = /^(credits?|notes?|summary|synopsis|description|review)/i;

/**
 * Known non-English publishers used to detect wrong ComicVine matches.
 * Shared across comicvine-language-filter.ts and validation.ts.
 *
 * Each entry is lowercased and matched via `.includes()` against the
 * normalized publisher name.
 */
export const NON_ENGLISH_PUBLISHERS: readonly string[] = [
  // Japanese
  'shueisha', 'kodansha', 'shogakukan', 'kadokawa', 'square enix',
  'futabasha', 'akita shoten', 'hakusensha', 'shonen gahosha',
  'shinchosha', 'tokuma shoten', 'enterbrain', 'mag garden', 'houbunsha',
  'ichijinsha', 'takeshobo', 'gentosha', 'coamix', 'home-sha',
  'ascii media works', 'media factory', 'leed publishing', 'nihon bungeisha',
  'wani books', 'flex comix', 'ohzora publishing', 'jive', 'earth star',
  'overlap', 'micro magazine', 'kill time communication',
  // French
  'ki-oon', 'kana', 'glénat', 'delcourt', 'pika',
  'soleil', 'tonkam', 'kazé', 'kurokawa', 'meian', 'mangetsu', 'akata',
  'doki-doki', 'doki doki', 'ototo', 'nobi nobi', 'komikku', 'ankama',
  'éditions h2t', 'crunchyroll', 'mana books', 'taifu comics',
  'casterman', 'kankō', 'black box', 'omaké manga', 'chat-on',
  'pika édition', 'éditions delcourt', 'vega dupuis', 'glénat manga', 'dargaud',
  // Italian
  'panini', 'planet manga', 'star comics', 'j-pop', 'dynit',
  'gp manga', 'flashbook', 'renbooks', 'goen', 'hikari',
  'kappa edizioni', 'magic press', 'edizioni star comics', 'jpop', 'j-pop manga',
  // Spanish
  'norma editorial', 'planeta', 'ivrea', 'selecta visión',
  'ecc ediciones', 'planeta cómic', 'milky way', 'distrito manga',
  'kamite', 'panini manga', 'editorial ivrea', 'editores de tebeos',
  'panini españa', 'panini comics', 'salvat', 'glènat españa', 'editorial norma',
  // German
  'carlsen', 'egmont', 'tokyopop de', 'altraverse', 'kazé manga',
  'manga cult', 'panini verlags', 'hayabusa',
  'carlsen verlag', 'egmont manga', 'kazé deutschland', 'cross cult',
  // Korean
  'seoul munhwasa', 'seoul cultural publishers', 'daewon', 'haksan',
  'sigongsa', 'anibooks', 'daiwon', 'samyang', 'yeowon media',
  // Chinese / Taiwanese
  'tong li', 'jade dynasty', 'chuang yi', 'sharp point', 'ever glory',
  'dongman tang', 'bilibili comics',
  // Brazilian / Portuguese
  'jbc', 'newpop', 'panini brasil', 'editora alto astral',
  'conrad', 'devir', 'nova sampa', 'editora jbc', 'panini comics brasil', 'abril',
  // Serbian / Croatian / Balkan
  'darkwood', 'čarobna knjiga',
  // Turkish
  'gerekli roman', 'lal kitap',
  'athica', 'akılçelen', 'komik şeyler', 'kayıp kıta', 'kurukafa',
  // Polish
  'jpf', 'waneko', 'studio jg', 'kotori',
  'hanami', 'japonica polonica fantastica',
  // Thai
  'siam inter comics', 'vibulkij',
  'nation edutainment', 'bongkoch',
  // Indonesian
  'elex media', 'level comics', 'm&c!',
  'gramedia', 'acolyte',
  // Vietnamese
  'tre publishing', 'kim dong', 'ipm',
  // Russian
  'alt graph', 'istari comics', 'xl media', 'azbooka-attikus',
  'comix-art', 'палитра', 'фабрика комиксов',
  // Scandinavian
  'schibsted', 'bonnier', 'mangismo',
  'egmont norge',
  // Hungarian
  'mangafan',
  // Dutch / Benelux
  'glénat benelux', 'mangakana', 'dark dragon books',
] as const;
