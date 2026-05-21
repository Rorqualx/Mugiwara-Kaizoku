/**
 * Parent-title extraction for the sub-series fallback tier. Strips three
 * kinds of suffix/subtitle patterns from the primary title + each alt title,
 * dedups, and returns variants long enough to disambiguate a series.
 *
 * Used by `wiki-discovery.ts:trySubSeriesFallback` to feed parent variants
 * into direct-domain probes, interwiki lookup, MediaWiki search, and the
 * page-existence validator.
 */

/** Build the parent-title variant list. Tries three extraction strategies on
 *  the primary title + each alt title:
 *    1) suffix strip (SS, Part N, year, etc.) — `stripSubSeriesSuffix`
 *    2) prefix-before-dash (`Foo - Subtitle` → `Foo`) — `stripDashSubtitle`
 *    3) prefix-before-colon (`Foo: Subtitle` → `Foo`) — `stripColonSubtitle`
 *  Dedups; drops too-short stems. Order: primary first, then alts.
 *  False matches are caught by the parent-page-existence validator at the
 *  call site, so casting wide here is safe. */
export function collectParentVariants(title: string, altTitles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (stripped: string | null): void => {
    if (stripped === null) return;
    const key = stripped.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(stripped);
  };
  for (const t of [title, ...altTitles]) {
    push(stripSubSeriesSuffix(t));
    push(stripDashSubtitle(t));
    push(stripColonSubtitle(t));
  }
  return out;
}

/** Strip an em/en/hyphen-dash subtitle: `"Code Geass - Lelouch ..."` → `"Code Geass"`.
 *  Requires whitespace on both sides of the dash so we don't break hyphenated
 *  titles like `"Sun-Ken Rock"` or `"Yu-Gi-Oh!"`. */
function stripDashSubtitle(title: string): string | null {
  const m = /\s+[-–—]\s+/.exec(title);
  if (!m || m.index <= 0) return null;
  const stripped = title.slice(0, m.index).trim();
  if (stripped.length < 4) return null;
  return stripped;
}

/** Strip a colon subtitle: `"Naruto: Shippuden"` → `"Naruto"`.
 *  Only counts colons that have whitespace immediately after, so we don't
 *  break titles like `"Re;surrection"` where `;` plus letter is meaningful. */
function stripColonSubtitle(title: string): string | null {
  const m = /:\s+/.exec(title);
  if (!m || m.index <= 0) return null;
  const stripped = title.slice(0, m.index).trim();
  if (stripped.length < 4) return null;
  return stripped;
}

/** Sub-series patterns: titles that often share the parent's Fandom wiki.
 *  Includes a 4-digit year alternative (1900-2099) for spinoff variants like
 *  "Strike Witches 1937" → parent "Strike Witches" → worldwitches.fandom.com. */
const SUB_SERIES_SUFFIX_RE = /\s+(SS|SP|Part\s+\d+|Vol\.?\s+\d+|Volume\s+\d+|Season\s+\d+|Book\s+\d+|Arc\s+\d+|Series\s+\d+|\d+(?:st|nd|rd|th)|(?:19|20)\d{2})\s*$/i;

function stripSubSeriesSuffix(title: string): string | null {
  const trimmed = title.trim();
  const match = SUB_SERIES_SUFFIX_RE.exec(trimmed);
  if (!match) return null;
  const stripped = trimmed.slice(0, match.index).trim();
  // Reject if the parent title is too short — strips like "Name SS" → "Name"
  // should keep enough characters to disambiguate a real series.
  if (stripped.length < 4) return null;
  return stripped;
}
