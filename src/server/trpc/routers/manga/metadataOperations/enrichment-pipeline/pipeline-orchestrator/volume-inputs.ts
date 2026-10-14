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

/** A Fandom chapter row: its number and the volume the wiki files it under. */
export interface FandomChapterLike {
  number: number;
  volume?: number;
}

export interface FandomVolumeInputRow {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  /** The chapters the wiki files under this volume, inside its range (see `fandomVolumeChapters`). */
  chapters?: number[];
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

/**
 * The chapters Fandom's chapter list files under one volume, kept only when
 * they sit inside that volume's own range (a decimal extra by its integer
 * part). Without them Fandom's table spoke only as a range, and the
 * per-chapter vote heard MangaDex alone: Yofukashi no Uta's aggregate tags
 * volume 2 with chapter 9 only and has no 10-22, so volume 2 became 9-9
 * while Fandom listed 9-18. A chapter tagged with a volume whose range does
 * not hold it is a lumped or stale tag and is left out.
 */
function fandomVolumeChapters(
  volume: FandomVolumeLike,
  chapterList: readonly FandomChapterLike[],
): number[] {
  const { chapterStart: start, chapterEnd: end } = volume;
  if (start === undefined || end === undefined) return [];
  const out = new Set<number>();
  for (const ch of chapterList) {
    if (ch.volume !== volume.number || !Number.isFinite(ch.number) || ch.number <= 0) continue;
    const whole = Math.floor(ch.number);
    if (whole >= Math.floor(start) && whole <= end) out.add(ch.number);
  }
  return [...out].sort((a, b) => a - b);
}

/** Fandom's volume rows, each with the chapters its chapter list files under it. */
export function fandomVolumeInputsFrom(
  fandom: { volumeList: readonly FandomVolumeLike[]; chapterList: readonly FandomChapterLike[] } | null | undefined,
): FandomVolumeInputRow[] {
  return toFandomVolumeInputs(fandom?.volumeList ?? [], fandom?.chapterList ?? []);
}

export function toFandomVolumeInputs(
  volumes: readonly FandomVolumeLike[],
  chapterList: readonly FandomChapterLike[] = [],
): FandomVolumeInputRow[] {
  return volumes.map(fv => {
    const entry: FandomVolumeInputRow = { number: fv.number };
    if (fv.chapterStart !== undefined) entry.chapterStart = fv.chapterStart;
    if (fv.chapterEnd !== undefined) entry.chapterEnd = fv.chapterEnd;
    const chapters = fandomVolumeChapters(fv, chapterList);
    if (chapters.length > 0) entry.chapters = chapters;
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
