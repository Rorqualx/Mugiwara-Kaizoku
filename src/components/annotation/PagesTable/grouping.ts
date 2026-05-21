/**
 * PagesTable Grouping Utilities
 */

import type { PageGroup, PageListItem } from './types';

/**
 * Extract Wikipedia group key from page path
 */
function extractWikipediaGroupKey(pathname: string): string {
  const pathMatch = pathname.match(/\/wiki\/(.+)/);
  if (!pathMatch?.[1]) return 'unknown';

  const pageName = decodeURIComponent(pathMatch[1]).toLowerCase();
  const listMatch = pageName.match(/^list_of_(.+?)(?:_(?:manga_)?(?:chapters?|volumes?|episodes?))?$/);
  if (listMatch?.[1]) return listMatch[1];

  return pageName.replace(/\s*\([^)]+\)\s*$/, '');
}

/**
 * Extract a group key from a page URL
 */
function extractGroupKey(url: string, sourceType: string, mangaTitle: string | null): string {
  if (mangaTitle) {
    return mangaTitle.toLowerCase();
  }

  try {
    const parsed = new URL(url);

    if (sourceType === 'FANDOM') {
      const pathMatch = parsed.pathname.match(/\/wiki\/(.+)/);
      if (pathMatch?.[1]) {
        return decodeURIComponent(pathMatch[1]).toLowerCase();
      }
      return parsed.hostname;
    }

    if (sourceType === 'COMICVINE') {
      const match = parsed.pathname.match(/\/c\/(\d+-\d+)/);
      return match?.[1] ?? parsed.hostname;
    }

    if (sourceType === 'WIKIPEDIA') {
      return extractWikipediaGroupKey(parsed.pathname);
    }

    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Get display name for a group
 */
function getGroupDisplayName(pages: PageListItem[]): string {
  const pageWithTitle = pages.find(p => p.mangaTitle);
  if (pageWithTitle?.mangaTitle) {
    return pageWithTitle.mangaTitle;
  }

  const firstPage = pages[0];
  if (firstPage) {
    try {
      const parsed = new URL(firstPage.url);
      if (firstPage.sourceType === 'FANDOM') {
        const subdomain = parsed.hostname.split('.')[0];
        return subdomain ? subdomain.charAt(0).toUpperCase() + subdomain.slice(1) : 'Unknown';
      }
    } catch {
      // Fall through to default
    }
  }

  return 'Unknown';
}

/**
 * Group pages by their series/wiki
 */
export function groupPages(
  pages: PageListItem[],
  sortField: 'createdAt' | 'mangaTitle' | 'updatedAt',
  sortOrder: 'asc' | 'desc'
): PageGroup[] {
  const groupMap = new Map<string, PageListItem[]>();

  for (const page of pages) {
    const key = extractGroupKey(page.url, page.sourceType, page.mangaTitle);
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(page);
    } else {
      groupMap.set(key, [page]);
    }
  }

  const groups: PageGroup[] = [];
  for (const [key, pagesInGroup] of groupMap) {
    const firstPage = pagesInGroup[0];
    const pageWithTraining = pagesInGroup.find(
      p => p.comicVineId ?? p.fandomDiscoveredUrls?.length ?? p.wikipediaDiscoveredUrls?.length
    );
    groups.push({
      key,
      displayName: getGroupDisplayName(pagesInGroup),
      sourceType: firstPage?.sourceType ?? 'UNKNOWN',
      pages: pagesInGroup.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      totalTokens: pagesInGroup.reduce((sum, p) => sum + p.tokenCount, 0),
      comicVineId: pageWithTraining?.comicVineId,
      fandomDiscoveredCount: pageWithTraining?.fandomDiscoveredUrls?.length ?? 0,
      wikipediaDiscoveredCount: pageWithTraining?.wikipediaDiscoveredUrls?.length ?? 0,
      comicVineDiscoveredCount: pageWithTraining?.comicVineDiscoveredUrls?.length ?? 0,
    });
  }

  return groups.sort((a, b) => {
    let comparison = 0;

    if (sortField === 'mangaTitle') {
      comparison = a.displayName.localeCompare(b.displayName);
    } else {
      const aDate = a.pages[0]?.createdAt ?? new Date(0);
      const bDate = b.pages[0]?.createdAt ?? new Date(0);
      comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}
