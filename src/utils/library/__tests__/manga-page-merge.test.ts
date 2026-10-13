import { flattenPages, mergePage, pagesContaining, pagesFromRows } from '@/utils/library/manga-page-merge';

const PAGE = 3;
const row = (id: number, label = 'old'): { id: number; label: string } => ({ id, label });

describe('manga-page-merge', () => {
  it('replaces a re-fetched page so changed rows are updated in place', () => {
    const first = mergePage(new Map(), 0, [row(1), row(2), row(3)], PAGE);
    const withSecond = mergePage(first, 3, [row(4), row(5)], PAGE);

    // Page 0 comes back again with row 2 changed (e.g. a download finished).
    const refreshed = mergePage(withSecond, 0, [row(1), row(2, 'new'), row(3)], PAGE);

    expect(flattenPages(refreshed)).toEqual([row(1), row(2, 'new'), row(3), row(4), row(5)]);
  });

  it('drops a removed title when its page is re-fetched', () => {
    const pages = mergePage(new Map(), 0, [row(1), row(2)], PAGE);
    const refreshed = mergePage(pages, 0, [row(1)], PAGE);

    expect(flattenPages(refreshed)).toEqual([row(1)]);
  });

  it('discards pages beyond a short (last) page', () => {
    let pages = mergePage(new Map(), 0, [row(1), row(2), row(3)], PAGE);
    pages = mergePage(pages, 3, [row(4), row(5), row(6)], PAGE);
    pages = mergePage(pages, 6, [row(7)], PAGE);

    // Titles were removed: the library now ends on the second page.
    pages = mergePage(pages, 3, [row(4)], PAGE);

    expect(Array.from(pages.keys())).toEqual([0, 3]);
    expect(flattenPages(pages)).toEqual([row(1), row(2), row(3), row(4)]);
  });

  it('keeps later pages while a full page is refreshed', () => {
    let pages = mergePage(new Map(), 0, [row(1), row(2), row(3)], PAGE);
    pages = mergePage(pages, 3, [row(4)], PAGE);

    pages = mergePage(pages, 0, [row(1, 'new'), row(2), row(3)], PAGE);

    expect(flattenPages(pages)).toEqual([row(1, 'new'), row(2), row(3), row(4)]);
  });

  it('lists a title once when it shifts between a fresh page and a stale one', () => {
    let pages = mergePage(new Map(), 0, [row(1), row(2), row(3)], PAGE);
    pages = mergePage(pages, 3, [row(4), row(5), row(6)], PAGE);

    // Row 1 was removed, so row 4 moved up onto the refreshed first page while
    // the second page still holds its old copy.
    pages = mergePage(pages, 0, [row(2), row(3), row(4, 'new')], PAGE);

    expect(flattenPages(pages)).toEqual([row(2), row(3), row(4, 'new'), row(5), row(6)]);
  });

  it('does not mutate the map it is given', () => {
    const original = mergePage(new Map(), 0, [row(1)], PAGE);
    mergePage(original, 0, [row(2)], PAGE);

    expect(flattenPages(original)).toEqual([row(1)]);
  });

  it('orders pages by offset regardless of arrival order', () => {
    let pages = mergePage(new Map(), 3, [row(4)], PAGE);
    pages = mergePage(pages, 0, [row(1), row(2), row(3)], PAGE);

    expect(flattenPages(pages)).toEqual([row(1), row(2), row(3), row(4)]);
  });

  it('rebuilds pages from a restored flat list', () => {
    const rows = [row(1), row(2), row(3), row(4), row(5)];
    const pages = pagesFromRows(rows, PAGE);

    expect(Array.from(pages.keys())).toEqual([0, 3]);
    expect(flattenPages(pages)).toEqual(rows);
    expect(pagesFromRows([], PAGE).size).toBe(0);
  });

  it('finds the pages that hold the updated titles', () => {
    const pages = pagesFromRows([row(1), row(2), row(3), row(4), row(5), row(6), row(7)], PAGE);

    expect(pagesContaining(pages, new Set([5, 2, 4]))).toEqual({ offsets: [0, 3], missing: [] });
    expect(pagesContaining(pages, new Set([7]))).toEqual({ offsets: [6], missing: [] });
  });

  it('reports titles that are on no loaded page', () => {
    const pages = pagesFromRows([row(1), row(2)], PAGE);

    expect(pagesContaining(pages, new Set([2, 99]))).toEqual({ offsets: [0], missing: [99] });
    expect(pagesContaining(new Map(), new Set([1]))).toEqual({ offsets: [], missing: [1] });
  });
});
