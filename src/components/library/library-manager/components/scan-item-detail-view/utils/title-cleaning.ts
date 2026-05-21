/**
 * Common series name patterns that indicate a title has a subtitle/arc
 * These are well-known manga series with multiple parts
 */
const KNOWN_SERIES_PATTERNS = [
  /^(JoJo['']?s?\s+Bizarre\s+Adventure)\s*[:|-]?\s*(.+)$/i,
  /^(Sword\s+Art\s+Online)\s*[:|-]?\s*(.+)$/i,
  /^(Fate\s*\/?\s*\w+)\s*[:|-]?\s*(.+)$/i,
  /^(Dragon\s+Ball)\s*[:|-]?\s*(.+)$/i,
  /^(Naruto)\s*[:|-]?\s*(.+)$/i,
  /^(One\s+Piece)\s*[:|-]?\s*(.+)$/i,
  /^(Bleach)\s*[:|-]?\s*(.+)$/i,
  /^(Attack\s+on\s+Titan)\s*[:|-]?\s*(.+)$/i,
] as const;

/**
 * Add a variant to the array if it meets minimum length and isn't already present
 */
function addVariantIfValid(variants: string[], variant: string, minLength: number = 3): void {
  const trimmed = variant.trim();
  if (trimmed.length >= minLength && !variants.includes(trimmed)) {
    variants.push(trimmed);
  }
}

/**
 * Try to extract variants from known series patterns
 */
function extractFromKnownPatterns(cleaned: string, variants: string[]): boolean {
  for (const pattern of KNOWN_SERIES_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match?.[1] && match[2]) {
      addVariantIfValid(variants, match[2]); // Arc name
      addVariantIfValid(variants, match[1]); // Series name
      return true;
    }
  }
  return false;
}

/**
 * Try to extract variants from delimiter-separated titles
 */
function extractFromDelimiters(cleaned: string, variants: string[]): void {
  const delimiterMatch = cleaned.match(/^(.{3,}?)\s*[:\-–—]\s*(.{3,})$/);
  if (delimiterMatch?.[1] && delimiterMatch[2]) {
    addVariantIfValid(variants, delimiterMatch[2]); // Part after delimiter
    addVariantIfValid(variants, delimiterMatch[1]); // Part before delimiter
  }
}

/**
 * Try to extract subtitle from multi-word titles by taking last N words
 */
function extractFromLastWords(cleaned: string, variants: string[]): void {
  const words = cleaned.split(/\s+/);
  if (words.length < 4) return;

  // Try last 2 words
  const last2 = words.slice(-2).join(' ');
  addVariantIfValid(variants, last2, 5);

  // Try last 3 words if title is long enough
  if (words.length >= 5) {
    const last3 = words.slice(-3).join(' ');
    addVariantIfValid(variants, last3, 8);
  }
}

/**
 * Extract title variants for more comprehensive searching
 * Returns the original title plus potential shorter variants
 *
 * Example: "JoJo's Bizarre Adventure Phantom Blood" returns:
 *   - "JoJo's Bizarre Adventure Phantom Blood" (full)
 *   - "Phantom Blood" (potential arc/subtitle)
 *   - "JoJo's Bizarre Adventure" (series name)
 *
 * @param title - Original title
 * @returns Array of title variants, ordered by specificity (most specific first)
 */
export function extractTitleVariants(title: string): string[] {
  const cleaned = cleanTitleForSearch(title);
  const variants: string[] = [cleaned];

  // Try known series patterns first
  const foundKnown = extractFromKnownPatterns(cleaned, variants);

  // If no known pattern matched, try generic approaches
  if (!foundKnown) {
    extractFromDelimiters(cleaned, variants);
  }

  // If still only one variant, try extracting from last words
  if (variants.length === 1) {
    extractFromLastWords(cleaned, variants);
  }

  return variants;
}

/**
 * Clean a title for better search results
 * Removes volume/chapter numbers, quality tags, release groups, etc.
 *
 * Handles patterns from Nyaa torrents including:
 * - Volume numbers/ranges: v01, v01-12, Vol.1, Volume 1
 * - Chapter numbers/ranges: c001, ch.1, Chapter 1, 001-040
 * - Quality tags: (Digital), [HD], (Complete)
 * - Release groups: [GroupName], (Uploader)
 * - Year tags: (2024), (2020-2024)
 * - Japanese titles: | Japanese Title
 */
export function cleanTitleForSearch(title: string): string {
  let cleaned = title;

  // ============================================================================
  // Phase 1: Remove leading scanlation/uploader group tags
  // ============================================================================

  // Remove leading [GroupName] patterns (scanlation groups, subreddits)
  cleaned = cleaned.replace(/^\[[^\]]+\]\s*/g, '');

  // ============================================================================
  // Phase 2: Remove Japanese/alternate titles after pipe
  // ============================================================================

  // Remove Japanese title after pipe: "English Title | 日本語タイトル"
  cleaned = cleaned.replace(/\s*\|.*$/g, '');

  // ============================================================================
  // Phase 3: Remove volume and chapter patterns
  // ============================================================================

  // Remove "- Chapter X" or "- Chapter X Title" patterns (keep title after chapter number)
  cleaned = cleaned.replace(/\s*[-–]\s*Chapter\s+\d+(?:\.\d+)?(?:\s|$)/gi, ' ');

  // Remove volume numbers and ranges: v01, v01-12, Vol.1, Volume 1, Voi, (typo)
  cleaned = cleaned.replace(/\s*[vV](?:ol(?:ume)?|oi)?[.,]?\s*\d+(?:\s*[-–]\s*\d+)?/gi, '');

  // Remove chapter numbers with prefix: c001, ch.1, Ch. 1, chapter 1
  cleaned = cleaned.replace(/\s*[cC](?:h(?:ap(?:ter)?)?)?[.,]?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?/gi, '');

  // Remove standalone chapter/volume ranges: 001-040, 001-040 as v01-02
  cleaned = cleaned.replace(/\s*\d{2,4}(?:\.\d+)?\s*[-–]\s*\d{2,4}(?:\.\d+)?(?:\s+as\s+v\d+(?:\s*[-–]\s*\d+)?)?/gi, '');

  // Remove [Chapter X] patterns in brackets
  cleaned = cleaned.replace(/\s*\[Chapter\s+\d+(?:\.\d+)?\]/gi, '');

  // ============================================================================
  // Phase 4: Remove year patterns
  // ============================================================================

  // Remove years and year ranges in parentheses: (2024), (2020-2024)
  cleaned = cleaned.replace(/\s*\(\d{4}(?:\s*[-–]\s*\d{4})?\)/g, '');

  // Remove years in curly braces: {2024}, {2020-2024}
  cleaned = cleaned.replace(/\s*\{\d{4}(?:\s*[-–]\s*\d{4})?\}/g, '');

  // ============================================================================
  // Phase 5: Remove quality tags and format markers
  // ============================================================================

  const qualityTags = [
    'Digital', 'HD', 'SD', 'HQ', 'LQ', 'Web', 'Scan', 'Raw',
    'Webrip', 'WebDL', 'BDRip', 'DVDRip', 'Complete', 'Omnibus',
    'Premium', 'Deluxe', 'Special', 'Limited', 'Collector',
    'Digital-Compilation', 'JPEG-XL', 'Completed', 'Audiobook',
    'Perfect Edition', 'Colored', 'c2c', 'Upscaled', 'English',
    'Japanese', 'Spanish', 'French', 'German', 'Scanlated',
  ];
  const qualityPattern = new RegExp(
    `\\s*[\\(\\[\\{]\\s*(?:${qualityTags.join('|')})(?:\\s+(?:${qualityTags.join('|')}))*\\s*[\\)\\]\\}]`,
    'gi'
  );
  cleaned = cleaned.replace(qualityPattern, '');

  // ============================================================================
  // Phase 6: Remove release groups and uploaders
  // ============================================================================

  const releaseGroups = [
    // Publishers
    'KG Manga', 'Viz', 'Shueisha', 'Kodansha', 'Yen Press', 'Seven Seas',
    'Dark Horse', 'Vertical', 'J-Novel', 'J-Novel Club', 'Square Enix',
    'Tokyopop', 'Del Rey', 'CMX', 'DrMaster', 'ADV', 'Broccoli', 'Bandai',
    'Cross Infinite World', 'Hanashi Media', 'Comikey', 'YenAudio',
    'Seven Seas Siren', 'CopinComics',
    // Scanlation groups / Uploaders
    'f', 'danke', 'LuCaZ', 'XuN', 'c2c', 'Shizu', 'danke-Empire',
    'Digital-HD', 'Digital-SD', 'Digital SD', 'Digital HD',
    'Oak', 'Oak-JXL', 'Antrill-Oak', 'Antrill', 'Ushi', '1r0n', 'Rillant',
    'Stick', 'Shellshock', 'DigitalMangaFan', 'CleanBookGuy', 'Troglodyte',
    'SmugFox', 'Anonymous', 'Anon', 'TCB', 'ED', 'Kaos', 'Trite', 'kaOak',
    'lfp-DCP', 'oan', 'aumakua', 'DeadMan', 'XRA-Empire', 'Humperdido',
    'Colored Council', 'We Need More Yankiis', 'UP!', 'ACTS', 'Various',
    'Aquila', 'ReNEGI', 'INKR', 'AntsyLich', 'aro', 'BlackLuster',
    'Unpaid Ferryman', 'Sunflower Patch', 'JoBros', 'lord_ne', 'Kyoma',
    'Bernscantel', 'Shadowverse Scans', 'ManhuaPlus', 'Void',
    '/r/OnePunchMan',
  ];
  const releasePattern = new RegExp(
    `\\s*[\\(\\[\\{]\\s*(?:${releaseGroups.map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[\\)\\]\\}]`,
    'gi'
  );
  cleaned = cleaned.replace(releasePattern, '');

  // Remove uploader name lists in parentheses: (Name, Name), (Name + Name)
  cleaned = cleaned.replace(/\s*\([A-Za-z0-9_-]+(?:\s*[,+]\s*[A-Za-z0-9_-]+)+\)/g, '');

  // ============================================================================
  // Phase 7: Remove curly brace content
  // ============================================================================

  // Remove any remaining curly brace content: {anything}
  cleaned = cleaned.replace(/\s*\{[^}]*\}/g, '');

  // ============================================================================
  // Phase 8: Remove remaining short parenthetical/bracketed text
  // ============================================================================

  // Remove short parenthetical text (up to 30 chars)
  cleaned = cleaned.replace(/\s*\([^)]{1,30}\)/g, '');

  // Remove short bracketed text (up to 30 chars)
  cleaned = cleaned.replace(/\s*\[[^\]]{1,30}\]/g, '');

  // ============================================================================
  // Phase 9: Remove standalone trailing chapter numbers
  // ============================================================================

  // Remove standalone 3-4 digit numbers at end (single chapter releases)
  // e.g., "Chainsaw Man 185" -> "Chainsaw Man"
  cleaned = cleaned.replace(/\s+\d{3,4}(?:\.\d+)?\s*$/g, '');

  // ============================================================================
  // Phase 10: Clean up residual patterns
  // ============================================================================

  // Remove empty parentheses/brackets/braces left by previous replacements
  cleaned = cleaned.replace(/\s*\(\s*\)/g, '');
  cleaned = cleaned.replace(/\s*\[\s*\]/g, '');
  cleaned = cleaned.replace(/\s*\{\s*\}/g, '');

  // Remove orphaned "+" from range patterns like "v01-09 + 068-158"
  cleaned = cleaned.replace(/\s*\+\s*$/g, '');
  cleaned = cleaned.replace(/\s+\+\s+/g, ' ');

  // Remove trailing decimal residue: ".5" at end
  cleaned = cleaned.replace(/\.\d+\s*$/g, '');

  // Clean up trailing punctuation and separators
  cleaned = cleaned.replace(/[\s\-_.,;:]+$/g, '');

  // Clean up leading punctuation
  cleaned = cleaned.replace(/^[\s\-_.,;:]+/g, '');

  // Normalize multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
