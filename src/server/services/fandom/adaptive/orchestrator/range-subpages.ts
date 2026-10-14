/**
 * Range sub-pages of a Fandom list page
 *
 * Some wikis split the chapter list into pages by volume range and keep only
 * the first range on the main page: Kingdom's "Volumes and Chapters" holds
 * volumes 1-10 and links "Volumes_and_Chapters/Volume_11-20" through
 * "/Volume_81-90"; JoJo links "/Volume_51_to_100" and "/Volume_101_to_Current".
 * Only sub-pages of the list page itself whose name is a volume range count;
 * sibling pages such as My Hero Academia's "/Vigilantes" are other series.
 *
 * @module orchestrator/range-subpages
 */

import { load } from 'cheerio';

/** At most this many range pages are fetched for one list page. */
export const MAX_RANGE_SUBPAGES = 15;

const RANGE_SUFFIX = /^Vol(?:ume)?s?[ _]?(\d+)[ _]*(?:-|–|_to_|[ _]to[ _])[ _]*(\d+|Current)$/i;

/**
 * Absolute URLs of the list page's range sub-pages that hold volumes not
 * already parsed, in link order.
 */
export function findRangeSubpages(html: string, pageUrl: string, knownVolumes: ReadonlySet<number>): string[] {
  const page = new URL(pageUrl);
  const listPath = decodePath(page.pathname);
  if (!listPath.startsWith('/wiki/')) return [];

  const $ = load(html);
  const urls: string[] = [];
  const seen = new Set<string>();
  $('a[href^="/wiki/"]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').split('#')[0] ?? '';
    const path = decodePath(href);
    if (!path.startsWith(`${listPath}/`) || seen.has(path)) return;
    const range = RANGE_SUFFIX.exec(path.slice(listPath.length + 1));
    if (!range?.[1] || !range[2]) return;
    seen.add(path);
    const first = Number(range[1]);
    const last = /^current$/i.test(range[2]) ? first : Number(range[2]);
    if (coversAll(knownVolumes, first, last)) return;
    urls.push(`${page.origin}${href}`);
  });
  return urls.slice(0, MAX_RANGE_SUBPAGES);
}

function coversAll(known: ReadonlySet<number>, first: number, last: number): boolean {
  for (let n = first; n <= last; n++) if (!known.has(n)) return false;
  return true;
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path).replace(/ /g, '_');
  } catch {
    return path.replace(/ /g, '_');
  }
}
