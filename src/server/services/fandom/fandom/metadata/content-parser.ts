/**
 * Fandom Content Parser
 *
 * Extracts metadata from wiki page wikitext content.
 * Parses volumes list URLs, infobox data, synopsis, authors, publishers,
 * alternative titles, and date information from wiki markup.
 */

import type { MediaWikiAPI } from '@/server/services/fandom/MediaWikiAPI';
import { logger } from '@/utils/logger';

const log = logger.child('FandomContentParser');

/**
 * Section parsed from wikitext
 */
export interface WikiSection {
  title: string;
  content: string;
  level: number;
}

/**
 * Metadata extracted from wikitext content
 */
export interface ContentMetadata {
  volumesListUrl?: string;
  author?: string;
  artist?: string;
  publisher?: string;
  alternativeTitles?: string[];
  volumes?: number;
  chapters?: number;
  published?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  synopsis?: string;
  description?: string;
  genres?: string[];
}

/**
 * Date metadata extracted from content
 */
interface DateMetadata {
  startDate?: string;
  endDate?: string;
  published?: string;
  status?: string;
}

/**
 * Extract content patterns and return only defined values
 */
function extractContentPatternsResult(
  wikitext: string,
  title: string,
  existingAlternativeTitles?: string[]
): Partial<ContentMetadata> {
  const result: Partial<ContentMetadata> = {};

  const volumes = extractVolumesFromContent(wikitext);
  if (volumes !== undefined) result.volumes = volumes;

  const chapters = extractChaptersFromContent(wikitext);
  if (chapters !== undefined) result.chapters = chapters;

  const author = extractAuthorFromContent(wikitext);
  if (author !== undefined) result.author = author;

  const publisher = extractPublisherFromContent(wikitext);
  if (publisher !== undefined) result.publisher = publisher;

  if (!existingAlternativeTitles?.length) {
    const alt = extractAltTitlesFromContent(wikitext, title);
    if (alt !== undefined) result.alternativeTitles = alt;
  }

  return result;
}

/**
 * Extract dates and return only defined values
 */
function extractDatesResult(wikitext: string): Partial<ContentMetadata> {
  const result: Partial<ContentMetadata> = {};
  const dates = extractDatesFromContent(wikitext);

  if (dates) {
    if (dates.startDate !== undefined) result.startDate = dates.startDate;
    if (dates.endDate !== undefined) result.endDate = dates.endDate;
    if (dates.published !== undefined) result.published = dates.published;
    if (dates.status !== undefined) result.status = dates.status;
  }

  return result;
}

/**
 * Get fields from source where target field is undefined
 */
function getUndefinedFieldUpdates(
  target: ContentMetadata,
  source: Partial<ContentMetadata>
): Partial<ContentMetadata> {
  const result: Partial<ContentMetadata> = {};
  const fields: (keyof ContentMetadata)[] = [
    'volumes', 'chapters', 'author', 'publisher', 'alternativeTitles',
    'startDate', 'endDate', 'published', 'status'
  ];

  for (const field of fields) {
    if (target[field] === undefined && source[field] !== undefined) {
      (result as Record<string, unknown>)[field] = source[field];
    }
  }

  return result;
}

/**
 * Parse wikitext content and extract all metadata
 */
export function parseWikitextContent(
  wikitext: string,
  mediaWikiAPI: MediaWikiAPI,
  title: string,
  baseUrl: string
): ContentMetadata {
  const metadata: ContentMetadata = {};

  // Extract volumes list URL
  const volumesListUrl = extractVolumesListUrl(wikitext, baseUrl);
  if (volumesListUrl !== undefined) metadata.volumesListUrl = volumesListUrl;

  // Parse wikitext infobox
  Object.assign(metadata, parseWikitextInfobox(wikitext, title));

  // Extract sections
  const sections = mediaWikiAPI.parseWikitext(wikitext);
  const synopsis = extractSynopsis(sections);
  if (synopsis !== undefined) metadata.synopsis = synopsis;
  const description = extractDescription(sections) ?? synopsis;
  if (description !== undefined) metadata.description = description;

  // Extract from content patterns and merge undefined fields
  const contentPatterns = extractContentPatternsResult(wikitext, title, metadata.alternativeTitles);
  Object.assign(metadata, getUndefinedFieldUpdates(metadata, contentPatterns));

  // Extract dates and merge undefined fields
  const dateResults = extractDatesResult(wikitext);
  Object.assign(metadata, getUndefinedFieldUpdates(metadata, dateResults));

  return metadata;
}

/**
 * Calculate priority for a potential volume/chapter link
 */
function calculateLinkPriority(linkTarget: string, displayText: string | undefined): number {
  const lowerLink = linkTarget.toLowerCase();
  const lowerDisplay = displayText?.toLowerCase() ?? '';

  // Priority 1: Exact "List of Volumes" or similar
  if (/^list[_ ]of[_ ]volumes?$/i.test(linkTarget)) return 1;

  // Priority 2: "Volumes and Chapters" combined lists
  if (/^volumes?[_ ](?:and|&)[_ ]chapters?$/i.test(linkTarget) ||
      /^list[_ ]of[_ ]volumes?[_ ](?:and|&)[_ ]chapters?$/i.test(linkTarget)) return 2;

  // Priority 3: Generic volume list patterns
  if (/volumes?[_ ]list/i.test(linkTarget) ||
      /^volumes?$/i.test(linkTarget) ||
      (lowerLink.includes('volume') && lowerLink.includes('list'))) return 3;

  // Priority 4: Chapter lists (as fallback)
  if (/^list[_ ]of[_ ]chapters?$/i.test(linkTarget) ||
      /chapters?[_ ]list/i.test(linkTarget) ||
      /^chapters?$/i.test(linkTarget) ||
      (lowerLink.includes('chapter') && lowerLink.includes('list'))) return 4;

  // Priority 5: Check display text for volume/chapter mentions
  if ((lowerDisplay.includes('volume') || lowerDisplay.includes('chapter')) &&
      !lowerLink.includes('category:') && !lowerLink.includes('template:')) return 5;

  return 0; // Not a relevant link
}

/**
 * Extract volumes/chapters list URL from wikilinks
 */
function extractVolumesListUrl(wikitext: string, baseUrl: string): string | undefined {
  const allWikiLinks = wikitext.matchAll(/\[\[([^\]|[]+?)(?:\|([^\]]+?))?\]\]/g);

  interface PotentialLink {
    link: string;
    displayText?: string;
    priority: number;
  }

  const potentialLinks: PotentialLink[] = [];

  for (const match of allWikiLinks) {
    if (!match[1]) continue;

    const linkTarget = match[1].trim();
    const displayText = match[2]?.trim();
    const priority = calculateLinkPriority(linkTarget, displayText);

    if (priority > 0) {
      potentialLinks.push({ link: linkTarget, ...(displayText ? { displayText } : {}), priority });
    }
  }

  // Sort by priority and pick the best link
  potentialLinks.sort((a, b) => a.priority - b.priority);
  const bestLink = potentialLinks[0];

  if (bestLink) {
    const linkTitle = bestLink.link.replace(/ /g, '_');
    const volumesListUrl = `${baseUrl}/wiki/${encodeURIComponent(linkTitle)}`;
    log.info(`Selected best volumes/chapters URL (priority ${bestLink.priority}): ${volumesListUrl}`);
    return volumesListUrl;
  }

  // No links found - check for common section headers
  const sectionPatterns = [
    /==\s*(?:Chapters?\s*(?:&|and)?\s*)?Volumes?\s*==/gi,
    /==\s*(?:Story|Manga)\s*(?:Guide|Overview)\s*==/gi,
    /==\s*(?:Chapter|Volume)\s*(?:List|Guide)\s*==/gi
  ];

  for (const pattern of sectionPatterns) {
    if (pattern.test(wikitext)) {
      log.info(`Found volume/chapter section but no direct links. Section pattern: ${pattern.source}`);
      break;
    }
  }

  return undefined;
}

/**
 * Identify infobox field type
 */
function identifyInfoboxField(cleanKey: string): string | null {
  if (/author|written\s*by|writer|creator|created\s*by/i.test(cleanKey)) return 'author';
  if (/illustrated\s*by|artist|illustrator|art\s*by/i.test(cleanKey)) return 'artist';
  if (/publisher|published\s*by|english\s*publisher|licensed\s*by/i.test(cleanKey)) return 'publisher';
  if (/^(name|japanese|romaji|kanji|english|japanese\s*title|original\s*title|native\s*title|translated\s*title|alt\s*title|alternative\s*title|also\s*known\s*as)$/i.test(cleanKey)) return 'altTitle';
  if (/volumes?/i.test(cleanKey)) return 'volumes';
  if (/chapters?/i.test(cleanKey)) return 'chapters';
  if (/published|original\s*run|run/i.test(cleanKey)) return 'published';
  if (/status/i.test(cleanKey)) return 'status';
  if (/genre/i.test(cleanKey)) return 'genres';
  return null;
}

/**
 * Parse numeric value from string
 */
function parseNumeric(value: string): number | undefined {
  const num = parseInt(value.replace(/[^0-9]/g, ''));
  return isNaN(num) ? undefined : num;
}

/**
 * Field update result from processing an infobox field
 */
interface FieldUpdate {
  field?: keyof ContentMetadata;
  value?: unknown;
  altTitle?: string;
}

/**
 * Process an infobox field and return the update to apply
 */
function processInfoboxField(
  fieldType: string,
  cleanValue: string,
  title: string
): FieldUpdate {
  switch (fieldType) {
    case 'author':
      return { field: 'author', value: cleanValue };
    case 'artist':
      return { field: 'artist', value: cleanValue };
    case 'publisher':
      return { field: 'publisher', value: cleanValue };
    case 'status':
      return { field: 'status', value: cleanValue };
    case 'altTitle':
      return cleanValue !== title ? { altTitle: cleanValue } : {};
    case 'volumes':
      return { field: 'volumes', value: parseNumeric(cleanValue) };
    case 'chapters':
      return { field: 'chapters', value: parseNumeric(cleanValue) };
    case 'published':
      return { field: 'published', value: cleanValue };
    case 'genres':
      return { field: 'genres', value: cleanValue.split(/[,;]/).map(g => g.trim()).filter(g => g) };
    default:
      return {};
  }
}

/**
 * Parse wikitext infobox and extract metadata
 */
function parseWikitextInfobox(wikitext: string, title: string): Partial<ContentMetadata> {
  const metadata: Partial<ContentMetadata> = {};

  // Check for empty infobox template
  if (wikitext.match(/^\{\{Infobox\}\}$/m)) {
    log.info('Found empty infobox template, will extract metadata from content');
    return metadata;
  }

  // Look for infobox in wikitext
  const infoboxMatch = wikitext.match(/\{\{(?:[Ii]nfobox|[Mm]anga[\s_]*[Ii]nfobox|[Mm]angaInfobox|Series[\s_]*[Ii]nfobox)[\s\S]*?\n?\}\}/);
  if (!infoboxMatch) {
    log.info('No infobox found in wikitext');
    return metadata;
  }

  log.info('Found infobox in wikitext, attempting to parse');
  const lines = infoboxMatch[0].split('\n');
  const alternativeTitles: string[] = [];

  for (const line of lines) {
    const match = line.match(/\|\s*([^=]+?)\s*=\s*(.+)/);
    if (!match?.[1] || !match[2]) continue;

    const cleanKey = match[1].trim();
    const cleanValue = match[2].trim()
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/<[^>]+>/g, '');

    if (!cleanKey || !cleanValue) continue;

    const fieldType = identifyInfoboxField(cleanKey);
    if (!fieldType) continue;

    // Process field and apply update
    const update = processInfoboxField(fieldType, cleanValue, title);

    // Handle alternative title separately
    if (update.altTitle && !alternativeTitles.includes(update.altTitle)) {
      alternativeTitles.push(update.altTitle);
      continue;
    }

    // Apply field update if not already set
    if (update.field && update.value !== undefined && !metadata[update.field]) {
      (metadata as Record<string, unknown>)[update.field] = update.value;

      // Special handling for published date
      if (update.field === 'published' && !metadata.startDate) {
        const dateMatch = cleanValue.match(/(\w+\s+\d+,?\s+\d{4})/);
        if (dateMatch?.[1]) {
          metadata.startDate = dateMatch[1];
        }
      }
    }
  }

  if (alternativeTitles.length > 0) {
    metadata.alternativeTitles = alternativeTitles;
  }

  log.info('Extracted from wikitext infobox:', {
    author: metadata.author,
    artist: metadata.artist,
    publisher: metadata.publisher,
    alternativeTitles: metadata.alternativeTitles,
    volumes: metadata.volumes,
    chapters: metadata.chapters
  });

  return metadata;
}

/**
 * Extract synopsis from parsed sections
 */
function extractSynopsis(sections: WikiSection[]): string | undefined {
  const synopsisSection = sections.find(s =>
    s.title.toLowerCase().includes('synopsis') ||
    s.title.toLowerCase().includes('plot') ||
    s.title.toLowerCase().includes('story')
  );

  if (synopsisSection) {
    return cleanWikitext(synopsisSection.content);
  }

  return undefined;
}

/**
 * Extract description from parsed sections
 */
function extractDescription(sections: WikiSection[]): string | undefined {
  const overviewSection = sections.find(s =>
    s.title.toLowerCase() === 'overview' ||
    s.title.toLowerCase() === 'summary'
  );

  if (overviewSection) {
    return cleanWikitext(overviewSection.content);
  }

  if (sections.length > 0) {
    const firstContentSection = sections.find(s => s.content && s.content.length > 50);
    if (firstContentSection) {
      return cleanWikitext(firstContentSection.content);
    }
  }

  return undefined;
}

/**
 * Extract volume count from content patterns
 */
function extractVolumesFromContent(wikitext: string): number | undefined {
  const volumePatterns = [
    /(\d+)\s*volumes?\s*(?:published|released|available)/i,
    /(?:has|contains?)\s*(\d+)\s*volumes?/i,
    /(\d+)\s*volumes?\s*(?:in|published in)/i
  ];

  for (const pattern of volumePatterns) {
    const volumeMatch = wikitext.match(pattern);
    if (volumeMatch) {
      const volNum = parseInt(volumeMatch[1] ?? '0');
      if (!isNaN(volNum)) {
        log.info('Extracted volumes from content:', volNum);
        return volNum;
      }
    }
  }

  // Look for specific volume mentions to find highest volume number
  const highestVolumePattern = /Volume (\d+)/gi;
  const allVolumeNumbers = [...wikitext.matchAll(highestVolumePattern)]
    .map(m => parseInt(m[1] ?? '0'))
    .filter(n => !isNaN(n) && n > 0);

  if (allVolumeNumbers.length > 0) {
    return Math.max(...allVolumeNumbers);
  }

  return undefined;
}

/**
 * Extract chapter count from content patterns
 */
function extractChaptersFromContent(wikitext: string): number | undefined {
  const chapterPatterns = [
    /(?:has|contains?)\s*(\d+)\s*chapters?/i,
    /([A-Za-z\s]+)\s*has\s*(\d+)\s*chapters?/i,
    /(\d+)\s*chapters?\s*(?:published|released|available)/i
  ];

  for (const pattern of chapterPatterns) {
    const chapterMatch = wikitext.match(pattern);
    if (chapterMatch) {
      const chapNum = parseInt((chapterMatch[2] ?? chapterMatch[1]) ?? '0');
      if (!isNaN(chapNum)) {
        log.info('Extracted chapters from content:', chapNum);
        return chapNum;
      }
    }
  }

  return undefined;
}

/**
 * Extract author from content patterns
 */
function extractAuthorFromContent(wikitext: string): string | undefined {
  const authorPatterns = [
    /(?:written and illustrated by|created by)\s*\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /(?:author|written by)[\s:,]+\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /(?:by)\s+\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /the author of[^,]*,\s*\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /author[^,]*\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i
  ];

  for (const pattern of authorPatterns) {
    const match = wikitext.match(pattern);
    if (match?.[1] && !match[1].includes(':')) {
      log.info('Extracted author from content:', match[1]);
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract publisher from content patterns
 */
function extractPublisherFromContent(wikitext: string): string | undefined {
  const publisherPatterns = [
    /(?:published by|licensed by)\s*\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /(?:English publisher|NA publisher)[\s:,]+\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /(?:published in.*?by)\s*\[\[([^:\]]+?)(?:\|[^\]]+)?\]\]/i,
    /(?:published by|licensed by)\s+([A-Z][A-Za-z\s&]+?)(?:\.|,|\s+(?:in|from))/i,
    /(?:English publisher|NA publisher)[\s:,]+([A-Z][A-Za-z\s&]+?)(?:\.|,|\s+(?:in|from))/i
  ];

  for (const pattern of publisherPatterns) {
    const match = wikitext.match(pattern);
    if (match?.[1] && !match[1].includes(':')) {
      log.info('Extracted publisher from content:', match[1].trim());
      return match[1].trim();
    }
  }

  // Check for common publisher names
  const commonPublishers = [
    'Kodansha', 'Shueisha', 'Shogakukan', 'Viz Media', 'Seven Seas',
    'Yen Press', 'Dark Horse', 'Tokyopop', 'Del Rey', 'Square Enix',
    'Kadokawa', 'ASCII Media Works', 'Hakusensha', 'Akita Shoten'
  ];

  for (const publisher of commonPublishers) {
    const publisherRegex = new RegExp(`\\b${publisher}\\b`, 'i');
    if (publisherRegex.test(wikitext)) {
      const contextRegex = new RegExp(
        `(?:published|licensed|serialized|released)[^.]*?\\b${publisher}\\b|\\b${publisher}\\b[^.]*?(?:published|licensed|released)`,
        'i'
      );
      if (contextRegex.test(wikitext)) {
        log.info('Extracted known publisher from content:', publisher);
        return publisher;
      }
    }
  }

  return undefined;
}

/**
 * Extract alternative titles from content patterns
 */
function extractAltTitlesFromContent(wikitext: string, title: string): string[] | undefined {
  const altTitles: string[] = [];

  const specificPatterns = [
    /(?:also known as|alternatively titled|alternate title)\s*:?\s*"?([^",.\n]+)"?/gi,
    /\(Japanese:\s*([^)]+)\)/gi,
    /\(romaji:\s*([^)]+)\)/gi,
    /炎炎ノ消防隊/g,
    /Enen no Sh[oō]uboutai/gi
  ];

  for (const pattern of specificPatterns) {
    const matches = wikitext.matchAll(pattern);
    for (const match of matches) {
      const extractedTitle = match[1] ?? match[0];
      if (extractedTitle && extractedTitle.trim() !== title) {
        const cleanTitle = extractedTitle.trim()
          .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/<[^>]+>/g, '');

        if (cleanTitle &&
            cleanTitle.length > 2 &&
            cleanTitle.length < 100 &&
            !cleanTitle.includes('::') &&
            !cleanTitle.includes('==') &&
            !cleanTitle.includes('http')) {
          altTitles.push(cleanTitle);
        }
      }
    }
  }

  // ESLint fix: no-unnecessary-condition - t is always string in this context
  const uniqueAltTitles = [...new Set(altTitles.filter(t => t.trim()))];

  if (uniqueAltTitles.length > 0) {
    log.info('Extracted alternative titles from content:', uniqueAltTitles);
    return uniqueAltTitles;
  }

  return undefined;
}

/**
 * Extract dates from content patterns
 */
function extractDatesFromContent(wikitext: string): DateMetadata | undefined {
  const datePatterns = [
    /(?:from|published from|serialized from)\s+([A-Z][a-z]+ \d{1,2}, \d{4})\s+(?:to|until|through)\s+([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /(?:ran from|published)\s+([A-Z][a-z]+ \d{1,2}, \d{4})\s*[-–—]\s*([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /(\d{4})\s*[-–—]\s*(\d{4})/
  ];

  for (const pattern of datePatterns) {
    const match = wikitext.match(pattern);
    if (match) {
      const result: DateMetadata = {};

      if (match[1]) {
        result.startDate = formatDateString(match[1]);
      }
      if (match[2]) {
        result.endDate = formatDateString(match[2]);
        if (!['ongoing', 'present', 'current'].some(term =>
          result.endDate?.toLowerCase().includes(term))) {
          result.status = 'FINISHED';
        }
      }

      result.published = `${match[1]} - ${match[2]}`;

      log.info('Extracted dates from content:', result);
      return result;
    }
  }

  // Check for magazine issue dates
  const issueMatches = [...wikitext.matchAll(/Issue \d+, (\d{4})/g)];
  if (issueMatches.length > 0) {
    const years = issueMatches.map(match => parseInt(match[1] ?? '0')).sort((a, b) => a - b);
    const startYear = years[0];
    const endYear = years[years.length - 1];

    if (startYear && endYear) {
      const result: DateMetadata = {
        startDate: `${startYear}-01-01`
      };

      if (startYear !== endYear) {
        result.endDate = `${endYear}-12-31`;
        result.published = `${startYear} - ${endYear}`;
        result.status = 'FINISHED';
      } else {
        result.published = `${startYear}`;
        result.status = 'ONGOING';
      }

      log.info('Extracted dates from magazine issues:', result);
      return result;
    }
  }

  return undefined;
}

/**
 * Clean wikitext by removing markup
 */
function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    .replace(/{{[^}]+}}/g, '')
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format date string to a standard format
 */
function formatDateString(dateStr: string): string {
  if (['present', 'ongoing', 'current'].some(term => dateStr.toLowerCase().includes(term))) {
    return dateStr;
  }

  const yearOnlyMatch = dateStr.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return `${yearOnlyMatch[1]}-01-01`;
  }

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const parts = date.toISOString().split('T');
    return parts[0] ?? dateStr;
  }

  return dateStr;
}
