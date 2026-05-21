/**
 * Fandom Infobox Parser
 *
 * Extracts metadata from Fandom wiki infoboxes (both portable and old-style)
 * to capture series information like author, status, publisher, etc.
 *
 * Extracted from: fandomTableParser.ts (lines 820-859)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

export function parseInfoboxData(html: string): Record<string, unknown> {
  try {
    const $ = cheerio.load(html);
    const data: Record<string, unknown> = {};

    // Parse portable infobox
    $('.pi-data').each((_, element) => {
      const $el = $(element);
      const label = $el.find('.pi-data-label').text().trim();
      const value = $el.find('.pi-data-value').text().trim();

      if (label && value) {
        const key = label.toLowerCase().replace(/\s+/g, '_');
        data[key] = value;
      }
    });

    // Parse old-style infobox
    $('.infobox tr').each((_, row) => {
      const $row = $(row);
      const $th = $row.find('th');
      const $td = $row.find('td');

      if ($th.length && $td.length) {
        const label = $th.text().trim();
        const value = $td.text().trim();

        if (label && value) {
          const key = label.toLowerCase().replace(/\s+/g, '_').replace(':', '');
          data[key] = value;
        }
      }
    });

    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing infobox data:', errorMessage);
    return {};
  }
}
