/**
 * Unified Provider Adapter
 *
 * Consolidates all provider-specific parsing logic into a single adapter
 */

import * as cheerio from 'cheerio';

import type { ProviderType, ParseResult, ChapterInfo } from './types';

export class UnifiedProviderAdapter {
  /**
   * Parse HTML content based on provider type
   */
  parse(html: string, provider: ProviderType): Promise<ParseResult> {
    const $ = cheerio.load(html);

    let result: ParseResult;
    switch (provider) {
      case 'FANDOM':
        result = this.parseFandom($);
        break;
      case 'WIKIPEDIA':
        result = this.parseWikipedia($);
        break;
      case 'MYANIMELIST':
        result = this.parseMyAnimeList($);
        break;
      case 'ANILIST':
        result = this.parseAniList($);
        break;
      case 'GENERIC':
      default:
        result = this.parseGeneric($);
    }

    return Promise.resolve(result);
  }

  private parseFandom($: cheerio.CheerioAPI): ParseResult {
    const metadata: Record<string, unknown> = {};

    // Extract infobox data - map data-source values to expected keys
    $('.pi-item.pi-data').each((_, elem) => {
      const $elem = $(elem);
      const dataSource = $elem.attr('data-source');
      const label = $elem.find('.pi-data-label').text().trim();
      const value = $elem.find('.pi-data-value').text().trim();

      if (value) {
        // Map data-source or label to camelCase key
        let key = '';
        if (dataSource === 'jname' || label === 'Japanese Name') {
          key = 'japaneseName';
        } else if (dataSource === 'rname' || label === 'Romanized Name') {
          key = 'romanizedName';
        } else if (dataSource === 'ename' || label === 'Official English Name') {
          key = 'englishName';
        } else if (dataSource === 'first' || label === 'Debut') {
          key = 'debut';
        } else if (dataSource === 'affiliation' || label === 'Affiliations') {
          key = 'affiliation';
        } else if (dataSource === 'occupation' || label === 'Occupations') {
          key = 'occupation';
        } else if (dataSource) {
          key = dataSource;
        } else {
          key = label.toLowerCase().replace(/\s+/g, '');
        }

        if (key) {
          metadata[key] = value;
        }
      }
    });

    const result: ParseResult = {
      title: $('h1.page-header__title').text() || '',
      metadata
    };

    // Extract content - get all paragraphs from parser output
    const contentParts: string[] = [];
    $('.mw-parser-output > p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) contentParts.push(text);
    });
    result.content = contentParts.join(' ');

    // Extract sections - only from h2 in mw-parser-output
    result.sections = [];
    $('.mw-parser-output h2').each((_, elem) => {
      const $elem = $(elem);
      const title = $elem.text().trim();
      const content = $elem.nextUntil('h2, h3').text().trim();
      if (title && content && result.sections) {
        result.sections.push({ title, content });
      }
    });

    // Extract images
    result.images ??= [];
    $('.pi-image img').each((_, elem) => {
      const src = $(elem).attr('src');
      if (src && result.images) result.images.push(src);
    });

    return result;
  }

  private parseWikipedia($: cheerio.CheerioAPI): ParseResult {
    const metadata: Record<string, unknown> = {};

    // Extract infobox - map labels to expected keys
    $('.infobox tr').each((_, elem) => {
      const $row = $(elem);
      const label = $row.find('.infobox-label').text().trim();
      const data = $row.find('.infobox-data').text().trim();

      if (label && data) {
        // Map Wikipedia infobox labels to expected keys
        let key = '';
        if (label === 'Written by' || label === 'Author') {
          key = 'author';
        } else if (label === 'Published by' || label === 'Publisher') {
          key = 'publisher';
        } else if (label === 'Magazine') {
          key = 'magazine';
        } else if (label === 'Volumes') {
          key = 'volumes';
        } else if (label === 'Genre') {
          key = 'genre';
        } else if (label === 'Demographic') {
          key = 'demographic';
        } else if (label === 'Original run') {
          key = 'originalRun';
        } else {
          // Convert label to camelCase
          key = label.toLowerCase().replace(/\s+(.)/g, (_, char) => String(char).toUpperCase());
        }

        metadata[key] = data;
      }
    });

    const result: ParseResult = {
      title: $('#firstHeading').text() || '',
      metadata
    };

    // Extract content - all paragraphs from mw-content-text
    const contentParts: string[] = [];
    $('#mw-content-text p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) contentParts.push(text);
    });
    result.content = contentParts.join(' ');

    // Extract sections - look for h2 elements directly
    result.sections = [];
    $('#mw-content-text h2').each((_, elem) => {
      const $elem = $(elem);
      // Try to get text from .mw-headline if present, otherwise get direct text
      const title = $elem.find('.mw-headline').text().trim() || $elem.text().trim();
      const content = $elem.nextUntil('h2').text().trim();
      if (title && content && result.sections) {
        result.sections.push({ title, content });
      }
    });

    return result;
  }

  private parseMyAnimeList($: cheerio.CheerioAPI): ParseResult {
    // Helper to extract value after label in information block
    const extractInfoValue = (label: string): string => {
      const infoText = $('.information').text();
      const regex = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
      const match = infoText.match(regex);
      return match?.[1]?.trim() ?? '';
    };

    // Extract genres from the information section
    const genresText = extractInfoValue('Genres');
    const genres = genresText ? genresText.split(',').map(g => g.trim()) : [];

    // Extract statistics
    const statisticsText = $('.statistics').text();
    const scoreMatch = statisticsText.match(/Score:\s*([\d.]+)/);
    const rankedMatch = statisticsText.match(/Ranked:\s*(#?\d+)/);
    const popularityMatch = statisticsText.match(/Popularity:\s*(#?\d+)/);

    const result: ParseResult = {
      title: $('h1.h1-manga-title span[itemprop="name"]').text() || '',
      synopsis: $('.synopsis[itemprop="description"]').text(),
      genres,
      statistics: {
        score: scoreMatch?.[1] ?? '',
        ranked: rankedMatch?.[1] ?? '',
        popularity: popularityMatch?.[1] ?? ''
      },
      metadata: {
        type: extractInfoValue('Type'),
        status: extractInfoValue('Status'),
        published: extractInfoValue('Published')
      }
    };

    const coverImage = $('.leftside img').first().attr('src');
    if (coverImage) {
      result.coverImage = coverImage;
    }

    return result;
  }

  private parseAniList($: cheerio.CheerioAPI): ParseResult {
    const result: ParseResult = {
      title: $('h1').first().text() || $('meta[property="og:title"]').attr('content') || '',
      nativeTitle: $('.native-title').text(),
      tags: $('.tag').map((_, el) => $(el).text()).get(),
      metadata: {
        format: $('.data-set:contains("Format") .value').text(),
        status: $('.data-set:contains("Status") .value').text(),
        startDate: $('.data-set:contains("Start Date") .value').text()
      },
      statistics: {
        averageScore: $('.data-set:contains("Average Score") .value').text(),
        popularity: $('.data-set:contains("Popularity") .value').text()
      }
    };

    const description = $('.description').text() || $('meta[property="og:description"]').attr('content');
    if (description) {
      result.description = description;
    }

    const coverImage = $('meta[property="og:image"]').attr('content');
    if (coverImage) {
      result.coverImage = coverImage;
    }

    return result;
  }

  private parseGeneric($: cheerio.CheerioAPI): ParseResult {
    const coverImage = $('meta[property="og:image"]').attr('content');

    // Try multiple title selectors
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('h2.title').first().text().trim();
    }
    if (!title) {
      title = $('title').text().trim();
    }

    // Try to extract author with multiple strategies
    const authorPatterns = [
      /author:\s*(.+)/i,
      /by\s+(.+)/i,
      /written by\s+(.+)/i
    ];

    const bodyText = $('body').text();
    let author: string | undefined;

    // First try to find author in structured elements
    const authorStrong = $('strong:contains("Author:")').parent().text();
    if (authorStrong) {
      const authorMatch = authorStrong.match(/Author:\s*(.+)/i);
      if (authorMatch?.[1]) {
        author = authorMatch[1].trim();
      }
    }

    // Fall back to pattern matching
    if (!author) {
      for (const pattern of authorPatterns) {
        const match = bodyText.match(pattern);
        const matchedText = match?.[1];
        if (matchedText !== undefined) {
          author = matchedText.trim();
          break;
        }
      }
    }

    // Extract chapters
    const chapters = this.extractChapters($, 'a[href*="chapter"]');

    const result: ParseResult = {
      title,
      description: $('meta[name="description"]').attr('content') || '',
      ...(coverImage ? { coverImage } : {}),
      ...(author ? { author } : {}),
      ...(chapters.length > 0 ? { chapters: chapters as ChapterInfo[] } : {})
    };

    return result;
  }

  private extractChapters($: cheerio.CheerioAPI, selector: string): unknown[] {
    const chapters: unknown[] = [];
    $(selector).each((_, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      const href = $elem.attr('href');
      
      const chapterMatch = text.match(/chapter\s+(\d+)/i);
      const chapterNum = chapterMatch?.[1];
      if (chapterNum !== undefined) {
        chapters.push({
          number: parseInt(chapterNum, 10),
          title: text,
          url: href
        });
      }
    });
    return chapters;
  }
}