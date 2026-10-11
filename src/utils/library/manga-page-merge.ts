/**
 * Page bookkeeping for the library grid.
 *
 * The grid loads a library in fixed-size pages and shows them as one list.
 * Pages are kept by offset so a re-fetched page REPLACES what was shown for
 * that offset: a title whose badges changed is updated in place and a removed
 * title disappears. (The previous append-only merge kept the first copy of
 * every row forever, so realtime refreshes never reached rows already shown.)
 *
 * @module utils/library/manga-page-merge
 */

/** Loaded pages, keyed by the offset they were requested with. */
export type MangaPages = ReadonlyMap<number, readonly unknown[]>;

/** Numeric id of a grid row, or undefined for a malformed row. */
function rowId(row: unknown): number | undefined {
  if (typeof row !== 'object' || row === null || !('id' in row)) return undefined;
  return typeof row.id === 'number' ? row.id : undefined;
}

/**
 * Stores a fetched page.
 *
 * A page shorter than `pageSize` is the last one, so pages recorded beyond it
 * (left over from before titles were removed) are dropped.
 *
 * @returns a new map; the input is not modified
 */
export function mergePage(
  pages: MangaPages,
  offset: number,
  rows: readonly unknown[],
  pageSize: number,
): Map<number, readonly unknown[]> {
  const next = new Map(pages);
  next.set(offset, rows);
  if (rows.length < pageSize) {
    for (const key of next.keys()) {
      if (key > offset) next.delete(key);
    }
  }
  return next;
}

/**
 * Flattens the pages into display order (ascending offset).
 *
 * While a refresh pass is in flight, rows can shift between a fresh page and a
 * not-yet-refreshed one; the copy from the lower offset wins so a title is
 * never listed twice.
 */
export function flattenPages(pages: MangaPages): unknown[] {
  const offsets = Array.from(pages.keys()).sort((a, b) => a - b);
  const seen = new Set<number>();
  const out: unknown[] = [];
  for (const offset of offsets) {
    for (const row of pages.get(offset) ?? []) {
      const id = rowId(row);
      if (id !== undefined) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(row);
    }
  }
  return out;
}

/** Rebuilds the page map from a flat list (used when restoring a snapshot). */
export function pagesFromRows(rows: readonly unknown[], pageSize: number): Map<number, readonly unknown[]> {
  const pages = new Map<number, readonly unknown[]>();
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    pages.set(offset, rows.slice(offset, offset + pageSize));
  }
  return pages;
}
