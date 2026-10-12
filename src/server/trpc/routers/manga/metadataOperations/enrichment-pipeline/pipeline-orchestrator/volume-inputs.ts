/**
 * Volume-list mappers for cross-validation.
 *
 * Turn a provider's parsed volume list (Wikipedia, Fandom) into the input
 * shape `collectVolumeRangeProposals` reads. Moved out of the orchestrator
 * unchanged so the claims recorder can build the same proposals from a list
 * the cross-series gate discarded.
 *
 * Pure: no database, no network.
 */

/** The fields of a Wikipedia volume row the mapper reads. */
export interface WikipediaVolumeLike {
  number: number;
  chapters: ReadonlyArray<{ number: string | number }>;
}

/** The fields of a Fandom volume row the mapper reads. */
export interface FandomVolumeLike {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  isbnEn?: string;
  pageCount?: number;
}

export interface WikipediaVolumeInputRow {
  number: number;
  chapters: Array<{ number: string | number }>;
  chapterStart?: number;
  chapterEnd?: number;
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
}

export interface FandomVolumeInputRow {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  pageCount?: number;
}

/** First string found under the given keys, in order. */
function firstString(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

export function toWikipediaVolumeInputs(volumes: readonly WikipediaVolumeLike[]): WikipediaVolumeInputRow[] {
  return volumes.map(wv => {
    const chNums = wv.chapters
      .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    const first = chNums[0];
    const last = chNums[chNums.length - 1];
    const wvAny = wv as unknown as Record<string, unknown>;
    // Wikipedia uses `originalReleaseDate` / `englishReleaseDate` — the unnamed
    // `releaseDate` is rare. Fall through so the downstream persistence fires.
    const releaseDate = firstString(wvAny, ['originalReleaseDate', 'englishReleaseDate', 'releaseDate']);
    // Wikipedia volume rows often carry ISBN (extracted via the table-parser).
    // Prefer isbn13, fall back to isbn.
    const isbn = firstString(wvAny, ['isbn13', 'isbn']);
    return {
      number: wv.number,
      chapters: wv.chapters.map(c => ({ number: c.number })),
      ...(first !== undefined && last !== undefined ? { chapterStart: first, chapterEnd: last } : {}),
      ...(typeof wvAny['title'] === 'string' ? { title: wvAny['title'] } : {}),
      ...(typeof wvAny['description'] === 'string' ? { description: wvAny['description'] } : {}),
      ...(typeof wvAny['coverImage'] === 'string' ? { coverImage: wvAny['coverImage'] } : {}),
      ...(releaseDate !== undefined ? { releaseDate } : {}),
      ...(isbn !== undefined ? { isbn } : {}),
    };
  });
}

export function toFandomVolumeInputs(volumes: readonly FandomVolumeLike[]): FandomVolumeInputRow[] {
  return volumes.map(fv => {
    const entry: FandomVolumeInputRow = { number: fv.number };
    if (fv.chapterStart !== undefined) entry.chapterStart = fv.chapterStart;
    if (fv.chapterEnd !== undefined) entry.chapterEnd = fv.chapterEnd;
    if (fv.title !== undefined) entry.title = fv.title;
    if (fv.description !== undefined) entry.description = fv.description;
    if (fv.coverImage !== undefined) entry.coverImage = fv.coverImage;
    if (fv.releaseDate !== undefined) entry.releaseDate = fv.releaseDate;
    if (fv.isbn !== undefined) entry.isbn = fv.isbn;
    else if (fv.isbnEn !== undefined) entry.isbn = fv.isbnEn;
    if (fv.pageCount !== undefined) entry.pageCount = fv.pageCount;
    return entry;
  });
}
