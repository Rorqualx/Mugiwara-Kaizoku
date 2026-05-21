/**
 * Fandom Character Info Extraction
 *
 * Retrieves detailed character information from Fandom wikis.
 */

import { logger } from '@/utils/logger';

import type { MediaWikiAPI } from '../MediaWikiAPI';
import type { FandomCharacterData } from '../types';

const log = logger.child('FandomCharacterInfo');

/**
 * Clean wikitext by removing markup
 */
function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // [[Link|Text]] -> Text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')            // [[Link]] -> Link
    .replace(/'''([^']+)'''/g, '$1')               // '''bold''' -> bold
    .replace(/''([^']+)''/g, '$1')                 // ''italic'' -> italic
    .replace(/{{[^}]+}}/g, '')                     // Remove templates
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')          // Remove references
    .replace(/<[^>]+>/g, '')                       // Remove HTML tags
    .replace(/\n{3,}/g, '\n\n')                    // Normalize line breaks
    .trim();
}

/**
 * Get character information from the wiki
 */
export async function getCharacterInfo(
  characterName: string,
  mediaWikiAPI: MediaWikiAPI,
  baseUrl: string
): Promise<FandomCharacterData | null> {
  try {
    const page = await mediaWikiAPI.getPageByTitle(characterName);
    if (!page) {
      return null;
    }

    const characterData: FandomCharacterData = {
      basicInfo: {
        name: characterName,
        pageId: page.pageid,
        url: `${baseUrl}/wiki/${encodeURIComponent(characterName)}`
      },
      stats: {},
      images: [],
      categories: []
    };

    // Extract infobox data
    if (page.pageprops?.infoboxes) {
      const infoboxes = mediaWikiAPI.parseInfobox(page.pageprops.infoboxes);
      if (infoboxes) {
        characterData.infobox = infoboxes;
        if (infoboxes[0]) {
          characterData.stats = mediaWikiAPI.extractInfoboxData(infoboxes[0]) as Record<string, string>;
        }
      }
    }

    // Get images
    if (page.images) {
      const imageInfos = await mediaWikiAPI.getImageInfo(
        page.images.map(img => img.title),
        { width: 300, height: 300 }
      );
      characterData.images = Object.entries(imageInfos).map(([title, info]) => ({
        title,
        url: info.url,
        ...(info.thumburl ? { thumburl: info.thumburl } : {}),
        ...(info.width ? { width: info.width } : {}),
        ...(info.height ? { height: info.height } : {})
      }));
    }

    // Get categories
    if (page.categories) {
      characterData.categories = page.categories
        .map(cat => cat.title.replace('Category:', ''));
    }

    // Parse wikitext sections
    if (page.revisions?.[0]?.slots?.main?.['*']) {
      const wikitext = page.revisions[0].slots.main['*'];
      const sections = mediaWikiAPI.parseWikitext(wikitext);
      characterData.sections = sections.map(section => ({
        title: section.title,
        content: cleanWikitext(section.content)
      }));
    }

    return characterData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to get character info', { characterName, errorMessage });
    return null;
  }
}
