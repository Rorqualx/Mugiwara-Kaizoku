/**
 * Release Parser Utility
 *
 * Parses torrent/usenet release titles to extract metadata including:
 * - Languages (audio and subtitles)
 * - Quality/Resolution
 * - Format (CBZ, CBR, PDF, EPUB, etc.)
 * - Publisher/Source information
 *
 * Based on common scene release naming conventions and manga-specific patterns.
 */

export interface ParsedReleaseInfo {
  languages: string[];                  // Detected content languages
  audioLanguage?: string | undefined;   // Primary audio/content language
  subtitleLanguages: string[];          // Subtitle languages
  isMultiLanguage: boolean;             // MULTI/DUAL tag detected
  isOfficial: boolean;                  // Official publisher release
  quality?: string | undefined;         // Quality/Resolution (Digital HD, 4K, etc.)
  format?: string | undefined;          // File format (CBZ, CBR, PDF, EPUB)
  publisher?: string | undefined;       // Publisher/group name
  tags: string[];                       // Additional tags
}

/**
 * Language mapping from various formats to standardized names
 */
const LANGUAGE_MAP: Record<string, string> = {
  // English variants
  'ENG': 'English',
  'ENGLISH': 'English',
  'EN': 'English',
  'ANGLAIS': 'English',

  // Japanese variants
  'JPN': 'Japanese',
  'JAP': 'Japanese',
  'JAPANESE': 'Japanese',
  'JP': 'Japanese',
  'JAPONAIS': 'Japanese',

  // French variants
  'FRE': 'French',
  'FRA': 'French',
  'FRENCH': 'French',
  'FR': 'French',
  'FRANÇAIS': 'French',
  'FRANCAIS': 'French',

  // German variants
  'GER': 'German',
  'DEU': 'German',
  'GERMAN': 'German',
  'DE': 'German',
  'DEUTSCH': 'German',

  // Italian variants
  'ITA': 'Italian',
  'ITALIAN': 'Italian',
  'IT': 'Italian',
  'ITALIANO': 'Italian',

  // Spanish variants
  'SPA': 'Spanish',
  'ESP': 'Spanish',
  'SPANISH': 'Spanish',
  'ES': 'Spanish',
  'ESPAÑOL': 'Spanish',
  'ESPANOL': 'Spanish',

  // Portuguese variants
  'POR': 'Portuguese',
  'PT': 'Portuguese',
  'PORTUGUESE': 'Portuguese',
  'PORTUGUÊS': 'Portuguese',
  'PORTUGUES': 'Portuguese',
  'PTBR': 'Portuguese (Brazil)',

  // Russian variants
  'RUS': 'Russian',
  'RUSSIAN': 'Russian',
  'RU': 'Russian',

  // Chinese variants
  'CHI': 'Chinese',
  'ZHO': 'Chinese',
  'CHINESE': 'Chinese',
  'ZH': 'Chinese',
  'MANDARIN': 'Chinese (Mandarin)',
  'CANTONESE': 'Chinese (Cantonese)',

  // Korean variants
  'KOR': 'Korean',
  'KOREAN': 'Korean',
  'KR': 'Korean',

  // Arabic variants
  'ARA': 'Arabic',
  'ARABIC': 'Arabic',
  'AR': 'Arabic',

  // Dutch variants
  'DUT': 'Dutch',
  'NL': 'Dutch',
  'DUTCH': 'Dutch',
  'NEDERLANDS': 'Dutch',

  // Nordic/Scandinavian
  'NORDIC': 'Nordic',
  'NORWEGIAN': 'Norwegian',
  'SWEDISH': 'Swedish',
  'DANISH': 'Danish',
  'FINNISH': 'Finnish',

  // Polish
  'POL': 'Polish',
  'POLISH': 'Polish',
  'PL': 'Polish',

  // Turkish
  'TUR': 'Turkish',
  'TURKISH': 'Turkish',
  'TR': 'Turkish',

  // Multi-language indicators
  'MULTI': 'Multi-language',
  'DUAL': 'Dual Audio',
  'MULTISUBS': 'Multi-subtitles',
  'MULTILANG': 'Multi-language',

  // Original/Raw
  'ORIGINAL': 'Original',
  'ORIG': 'Original',
  'RAW': 'Raw (Japanese)'
};

/**
 * Known manga publishers and scanlation groups
 */
const PUBLISHERS = [
  'VIZ', 'Viz Media', 'SEVEN SEAS', 'Seven Seas Entertainment',
  'YEN PRESS', 'Yen Press', 'KODANSHA', 'Kodansha Comics',
  'VERTICAL', 'Vertical Comics', 'DARK HORSE', 'Dark Horse Comics',
  'TOKYOPOP', 'SQUARE ENIX', 'Square Enix', 'DENPA',
  'J-NOVEL CLUB', 'Cross Infinite World',
  // Scanlation groups
  'DIGITAL MANGA GUILD', 'DMG', 'KG MANGA', 'KILLINGMOON SCANS',
  'SEVEN SEAS SCANS', 'FG-MANGA', 'NAHOM'
];

/**
 * Quality/Resolution patterns
 */
const QUALITY_PATTERNS = [
  { regex: /\b(8K|4320p)\b/i, value: '8K' },
  { regex: /\b(4K|2160p|UHD)\b/i, value: '4K' },
  { regex: /\b(1440p|QHD)\b/i, value: '1440p' },
  { regex: /\b(1080p|FHD|Full HD)\b/i, value: '1080p' },
  { regex: /\b(720p|HD)\b/i, value: '720p' },
  { regex: /\b(480p|SD)\b/i, value: '480p' },
  { regex: /\bDigital HD\b/i, value: 'Digital HD' },
  { regex: /\bDigital SD\b/i, value: 'Digital SD' },
  { regex: /\bDigital\b/i, value: 'Digital' },
  { regex: /\bHigh Quality\b/i, value: 'High Quality' },
  { regex: /\bHQ\b/i, value: 'High Quality' },
  { regex: /\bWeb\b/i, value: 'Web' },
  { regex: /\bPrint\b/i, value: 'Print' },
  { regex: /\bScan\b/i, value: 'Scan' },
  { regex: /\bOfficial\b/i, value: 'Official' }
];

/**
 * Format/Container patterns
 */
const FORMAT_PATTERNS = [
  { regex: /\bCBZ\b/i, value: 'CBZ' },
  { regex: /\bCBR\b/i, value: 'CBR' },
  { regex: /\bCB7\b/i, value: 'CB7' },
  { regex: /\bCBT\b/i, value: 'CBT' },
  { regex: /\bPDF\b/i, value: 'PDF' },
  { regex: /\bEPUB\b/i, value: 'EPUB' },
  { regex: /\bMOBI\b/i, value: 'MOBI' },
  { regex: /\bAZW3\b/i, value: 'AZW3' },
  { regex: /\bZIP\b/i, value: 'ZIP' },
  { regex: /\bRAR\b/i, value: 'RAR' },
  { regex: /\b7Z\b/i, value: '7Z' }
];

/**
 * Detects languages from release title
 *
 * @param title - Release title to parse
 * @returns Detected languages array
 */
function detectLanguages(title: string): string[] {
  const languages = new Set<string>();

  // Check each language pattern
  for (const [pattern, language] of Object.entries(LANGUAGE_MAP)) {
    // Use word boundaries for shorter codes to avoid false matches
    const regex = pattern.length <= 3
      ? new RegExp(`\\b${pattern}\\b`, 'i')
      : new RegExp(pattern, 'i');

    if (regex.test(title)) {
      languages.add(language);
    }
  }

  return Array.from(languages);
}

/**
 * Detects subtitle languages from release title
 *
 * Subtitle patterns: "Sub ITA", "Subs ENG", "Subtitle FR"
 *
 * @param title - Release title to parse
 * @returns Detected subtitle languages
 */
function detectSubtitles(title: string): string[] {
  const subtitles = new Set<string>();

  // Patterns for subtitle indicators followed by language codes
  const subPatterns = [
    /\bSub\s+([A-Z]{2,3})\b/gi,
    /\bSubs\s+([A-Z]{2,3})\b/gi,
    /\bSubtitle\s+([A-Z]{2,3})\b/gi,
    /\bSubtitles\s+([A-Z]{2,3})\b/gi,
    /\b([A-Z]{2,3})\s+Sub\b/gi,
    /\b([A-Z]{2,3})\s+Subs\b/gi
  ];

  for (const pattern of subPatterns) {
    let match;
    while ((match = pattern.exec(title)) !== null) {
      const langCode = match[1]?.toUpperCase();
      if (langCode) {
        const mappedLang = LANGUAGE_MAP[langCode];
        if (mappedLang) {
          subtitles.add(mappedLang);
        }
      }
    }
  }

  return Array.from(subtitles);
}

/**
 * Detects quality/resolution from release title
 *
 * @param title - Release title to parse
 * @returns Detected quality string
 */
function detectQuality(title: string): string | undefined {
  for (const { regex, value } of QUALITY_PATTERNS) {
    if (regex.test(title)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Detects file format from release title
 *
 * @param title - Release title to parse
 * @returns Detected format string
 */
function detectFormat(title: string): string | undefined {
  for (const { regex, value } of FORMAT_PATTERNS) {
    if (regex.test(title)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Detects publisher/group from release title
 *
 * @param title - Release title to parse
 * @returns Detected publisher name
 */
function detectPublisher(title: string): string | undefined {
  const titleUpper = title.toUpperCase();

  for (const publisher of PUBLISHERS) {
    if (titleUpper.includes(publisher.toUpperCase())) {
      return publisher;
    }
  }

  // Check for group tags in parentheses or brackets at the end
  const groupMatch = title.match(/[([]([A-Za-z0-9\s-]+)[)\]]\s*$/);
  if (groupMatch?.[1]) {
    return groupMatch[1].trim();
  }

  return undefined;
}

/**
 * Checks if release is an official publisher release
 *
 * @param title - Release title to parse
 * @returns True if official release detected
 */
function isOfficialRelease(title: string): boolean {
  const officialIndicators = [
    /\bOfficial\b/i,
    /\bDigital\b/i,
    /\bVIZ\b/i,
    /\bSeven Seas\b/i,
    /\bYen Press\b/i,
    /\bKodansha\b/i,
    /\bVertical\b/i,
    /\bDark Horse\b/i
  ];

  return officialIndicators.some(pattern => pattern.test(title));
}

/**
 * Checks if release has multiple languages
 *
 * @param title - Release title to parse
 * @returns True if multi-language indicators found
 */
function isMultiLanguage(title: string): boolean {
  const multiPatterns = [
    /\bMULTI\b/i,
    /\bDUAL\b/i,
    /\bMULTISUBS\b/i,
    /\bMULTILANG\b/i
  ];

  return multiPatterns.some(pattern => pattern.test(title));
}

/**
 * Extracts additional tags from release title
 *
 * @param title - Release title to parse
 * @returns Array of detected tags
 */
function extractTags(title: string): string[] {
  const tags: string[] = [];

  // Check for common tags
  if (/\bComplete\b/i.test(title)) tags.push('Complete');
  if (/\bOmnibus\b/i.test(title)) tags.push('Omnibus');
  if (/\bDeluxe\b/i.test(title)) tags.push('Deluxe');
  if (/\bCollector'?s? Edition\b/i.test(title)) tags.push('Collector\'s Edition');
  if (/\bHardcover\b/i.test(title)) tags.push('Hardcover');
  if (/\bPaperback\b/i.test(title)) tags.push('Paperback');
  if (/\bColored?\b/i.test(title)) tags.push('Colored');
  if (/\bUncensored\b/i.test(title)) tags.push('Uncensored');
  if (/\bRemastered\b/i.test(title)) tags.push('Remastered');

  return tags;
}

/**
 * Main parsing function - extracts all metadata from release title
 *
 * @param title - Release title to parse
 * @returns Parsed release information
 */
export function parseReleaseTitle(title: string): ParsedReleaseInfo {
  const languages = detectLanguages(title);
  const subtitleLanguages = detectSubtitles(title);
  const quality = detectQuality(title);
  const format = detectFormat(title);
  const publisher = detectPublisher(title);
  const tags = extractTags(title);
  const multiLang = isMultiLanguage(title);
  const official = isOfficialRelease(title);

  // Determine primary audio/content language
  // Prefer non-multi language tags, English or Japanese if available
  let audioLanguage: string | undefined;
  const contentLanguages = languages.filter(l => !l.includes('Multi'));

  if (contentLanguages.includes('English')) {
    audioLanguage = 'English';
  } else if (contentLanguages.includes('Japanese')) {
    audioLanguage = 'Japanese';
  } else if (contentLanguages.length > 0) {
    audioLanguage = contentLanguages[0];
  }

  return {
    languages,
    audioLanguage,
    subtitleLanguages,
    isMultiLanguage: multiLang,
    isOfficial: official,
    quality,
    format,
    publisher,
    tags
  };
}

/**
 * Helper function to get a human-readable summary of parsed info
 *
 * @param info - Parsed release info
 * @returns Human-readable string
 */
export function formatReleaseInfo(info: ParsedReleaseInfo): string {
  const parts: string[] = [];

  if (info.audioLanguage) {
    parts.push(info.audioLanguage);
  } else if (info.languages.length > 0) {
    parts.push(info.languages.join('/'));
  }

  if (info.format) {
    parts.push(info.format);
  }

  if (info.quality) {
    parts.push(info.quality);
  }

  if (info.isOfficial) {
    parts.push('Official');
  }

  if (info.publisher) {
    parts.push(`(${info.publisher})`);
  }

  return parts.join(' • ');
}
