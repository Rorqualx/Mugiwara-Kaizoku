/**
 * Chapter URL resolution
 *
 * Fandom list pages link chapters with site-relative hrefs ("/wiki/Chapter_15").
 * The chapter-detail service only accepts absolute URLs, so every caller must
 * resolve hrefs against the wiki's canonical domain before asking for details.
 *
 * @module adaptive/chapter-url-resolver
 */

/**
 * Resolve a chapter href against a wiki domain.
 *
 * Absolute http(s) URLs are returned unchanged. Site-relative paths are joined
 * to the domain verbatim (no re-encoding) so the result is the same string the
 * chapter-detail cache was keyed with before this helper existed.
 *
 * @param url - href as scraped ("/wiki/Chapter_15", "//host/wiki/X", or absolute)
 * @param domain - canonical wiki domain, e.g. "vinlandsaga.fandom.com"
 * @returns absolute URL, or the input unchanged when it is not a recognised relative form
 *   or no domain is known (a host-less "https:///wiki/X" would be worse than a failed fetch)
 */
export function resolveChapterUrl(url: string, domain: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (domain.length === 0) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://${domain}${url}`;
  return url;
}

/**
 * Resolve the `url` of every chapter in place.
 *
 * @param chapters - chapter records carrying an optional `url`
 * @param domain - canonical wiki domain
 * @returns number of URLs that were rewritten
 */
export function resolveChapterUrlsInPlace(
  chapters: Array<{ url?: unknown }>,
  domain: string,
): number {
  let rewritten = 0;
  for (const chapter of chapters) {
    const { url } = chapter;
    if (typeof url !== 'string' || url.length === 0) continue;
    const resolved = resolveChapterUrl(url, domain);
    if (resolved !== url) {
      chapter.url = resolved;
      rewritten++;
    }
  }
  return rewritten;
}
