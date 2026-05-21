/**
 * Proposal Collection Helpers
 *
 * Extracts VolumeRangeProposals from ComicVine, Wikipedia, and Fandom
 * provider data for cross-validation.
 */

import { isPlaceholderVolumeTitle } from '@/server/parsers/extractors/table-extractor/volume-extractors';

import type { VolumeRangeProposal } from '../phase-volume-cross-validation';

/** Wikipedia volume shape for proposal extraction */
interface WikipediaVolumeInput {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  chapters?: Array<{ number: string | number }>;
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  publisher?: string;
  alternativeTitle?: string;
}

/** Fandom volume shape for proposal extraction */
interface FandomVolumeInput {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  /** iter-PVM-1: per-chapter list if Fandom exposes per-volume chapter granularity */
  chapters?: number[];
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  publisher?: string;
  alternativeTitle?: string;
  pageCount?: number;
}

/** MangaDex aggregate volume shape for proposal extraction */
interface MangaDexVolumeInput {
  volumeNumber: number;
  chapterStart: number;
  chapterEnd: number;
  chapterCount: number;
  /** iter-PVM-1: per-chapter list (incl. decimals) from aggregate keys */
  chapters?: number[];
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  publisher?: string;
  alternativeTitle?: string;
}

/** Build only the populated semantic fields to spread into a proposal */
function pickSemantic(v: { title?: string; description?: string; coverImage?: string; releaseDate?: string; isbn?: string; publisher?: string; alternativeTitle?: string; pageCount?: number }): Pick<VolumeRangeProposal, 'title' | 'description' | 'coverImage' | 'releaseDate' | 'isbn' | 'publisher' | 'alternativeTitle' | 'pageCount'> {
  const out: Pick<VolumeRangeProposal, 'title' | 'description' | 'coverImage' | 'releaseDate' | 'isbn' | 'publisher' | 'alternativeTitle' | 'pageCount'> = {};
  if (typeof v.title === 'string' && v.title.trim().length > 0 && !isPlaceholderVolumeTitle(v.title)) out.title = v.title;
  if (typeof v.description === 'string' && v.description.trim().length > 0) out.description = v.description;
  if (typeof v.coverImage === 'string' && v.coverImage.trim().length > 0) out.coverImage = v.coverImage;
  if (typeof v.releaseDate === 'string' && v.releaseDate.trim().length > 0) out.releaseDate = v.releaseDate;
  if (typeof v.isbn === 'string' && v.isbn.trim().length > 0) out.isbn = v.isbn;
  if (typeof v.publisher === 'string' && v.publisher.trim().length > 0) out.publisher = v.publisher;
  if (typeof v.alternativeTitle === 'string' && v.alternativeTitle.trim().length > 0) out.alternativeTitle = v.alternativeTitle;
  if (typeof v.pageCount === 'number' && v.pageCount > 0) out.pageCount = v.pageCount;
  return out;
}

/**
 * Collect volume range proposals from enrichment pipeline results.
 * Extracts proposals from ComicVine, Wikipedia, Fandom, and MangaDex data.
 */
export function collectVolumeRangeProposals(
  comicvineVolumes: Array<Record<string, unknown>>,
  wikipediaVolumes: WikipediaVolumeInput[],
  fandomVolumes: FandomVolumeInput[],
  mangadexVolumes?: MangaDexVolumeInput[],
): VolumeRangeProposal[] {
  return [
    ...extractComicVineProposals(comicvineVolumes),
    ...extractWikipediaProposals(wikipediaVolumes),
    ...extractFandomProposals(fandomVolumes),
    ...extractMangaDexProposals(mangadexVolumes ?? []),
  ];
}

type CVSemanticInput = { title?: string; description?: string; coverImage?: string; releaseDate?: string; isbn?: string; publisher?: string; alternativeTitle?: string; pageCount?: number };

/** Pull semantic fields out of a ComicVine volume row (handles title/name and isbn/isbn13 fallbacks). */
function pickComicVineSemanticInput(vol: Record<string, unknown>): CVSemanticInput {
  const out: CVSemanticInput = {};
  const titleSrc = (typeof vol['title'] === 'string' ? vol['title'] : vol['name']) as string | undefined;
  if (typeof titleSrc === 'string') out.title = titleSrc;
  const isbnSrc = (typeof vol['isbn'] === 'string' ? vol['isbn'] : vol['isbn13']) as string | undefined;
  if (typeof isbnSrc === 'string') out.isbn = isbnSrc;
  for (const field of ['description', 'coverImage', 'releaseDate', 'publisher', 'alternativeTitle'] as const) {
    const value = vol[field];
    if (typeof value === 'string') out[field] = value;
  }
  if (typeof vol['pageCount'] === 'number' && (vol['pageCount'] as number) > 0) {
    out.pageCount = vol['pageCount'] as number;
  }
  return out;
}

/**
 * Read a per-chapter list off a volume row (iter-PVM-1). Orchestrator
 * pre-populates `chapters: number[]` on CV/Fandom/MDX rows when per-chapter
 * granularity is available (e.g. from `parseComicVineDescriptions` for CV).
 */
function readChapters(vol: Record<string, unknown>): number[] | undefined {
  const raw = vol['chapters'];
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map(c => typeof c === 'number' ? c : parseFloat(String(c)))
    .filter((n): n is number => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
  return out.length > 0 ? out : undefined;
}

/** Extract proposals from ComicVine volume data */
function extractComicVineProposals(
  volumes: Array<Record<string, unknown>>,
): VolumeRangeProposal[] {
  const proposals: VolumeRangeProposal[] = [];
  for (const vol of volumes) {
    const volNum = Number(vol['volumeNumber'] ?? vol['number'] ?? 0);
    const startCh = parseFloat(String(vol['startChapter'] ?? vol['chapterStart'] ?? ''));
    const endCh = parseFloat(String(vol['endChapter'] ?? vol['chapterEnd'] ?? ''));
    if (volNum <= 0 || isNaN(startCh) || isNaN(endCh) || startCh <= 0 || endCh < startCh) continue;

    const hasExplicit = vol['hasExplicitRange'] === true;
    const semantic = pickSemantic(pickComicVineSemanticInput(vol));
    const chapters = readChapters(vol);
    proposals.push({
      volumeNumber: volNum,
      chapterStart: startCh,
      chapterEnd: endCh,
      source: 'comicvine',
      confidence: hasExplicit ? 0.95 : 0.7,
      extractionMethod: hasExplicit ? 'explicit-range' : 'cumulative',
      ...(chapters ? { chapters } : {}),
      ...semantic,
    });
  }
  return proposals;
}

/** Extract proposals from Wikipedia volume data */
function extractWikipediaProposals(
  volumes: WikipediaVolumeInput[],
): VolumeRangeProposal[] {
  const proposals: VolumeRangeProposal[] = [];
  for (const vol of volumes) {
    if (vol.number <= 0) continue;
    const range = resolveWikipediaRange(vol);
    if (!range) continue;

    // iter-PVM-1: surface the per-chapter list (incl. decimals) from
    // WikipediaVolume.chapters[] so the membership-consensus resolver
    // can vote on individual chapter→volume assignments.
    const chapters = (vol.chapters ?? [])
      .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    proposals.push({
      volumeNumber: vol.number,
      chapterStart: range.start,
      chapterEnd: range.end,
      source: 'wikipedia',
      confidence: 0.8,
      extractionMethod: 'table-parse',
      ...(chapters.length > 0 ? { chapters } : {}),
      ...pickSemantic(vol),
    });
  }
  return proposals;
}

/** Resolve a Wikipedia volume's chapter range from explicit fields or chapters array */
function resolveWikipediaRange(
  vol: WikipediaVolumeInput,
): { start: number; end: number } | null {
  if (vol.chapterStart !== undefined && vol.chapterEnd !== undefined
    && vol.chapterStart > 0 && vol.chapterEnd >= vol.chapterStart) {
    return { start: vol.chapterStart, end: vol.chapterEnd };
  }

  if (vol.chapters && vol.chapters.length > 0) {
    const nums = vol.chapters
      .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    const first = nums[0];
    const last = nums[nums.length - 1];
    if (first !== undefined && last !== undefined) {
      return { start: first, end: last };
    }
  }

  return null;
}

/** Extract proposals from Fandom volume data */
function extractFandomProposals(
  volumes: FandomVolumeInput[],
): VolumeRangeProposal[] {
  const proposals: VolumeRangeProposal[] = [];
  for (const vol of volumes) {
    if (vol.number <= 0) continue;
    if (vol.chapterStart === undefined || vol.chapterEnd === undefined) continue;
    if (vol.chapterStart <= 0 || vol.chapterEnd < vol.chapterStart) continue;

    proposals.push({
      volumeNumber: vol.number,
      chapterStart: vol.chapterStart,
      chapterEnd: vol.chapterEnd,
      source: 'fandom',
      confidence: 0.85,
      extractionMethod: 'table-parse',
      ...(vol.chapters && vol.chapters.length > 0 ? { chapters: vol.chapters } : {}),
      ...pickSemantic(vol),
    });
  }
  return proposals;
}

/** Extract proposals from MangaDex aggregate volume data */
function extractMangaDexProposals(
  volumes: MangaDexVolumeInput[],
): VolumeRangeProposal[] {
  const proposals: VolumeRangeProposal[] = [];
  for (const vol of volumes) {
    if (vol.volumeNumber <= 0) continue;
    if (vol.chapterStart <= 0 || vol.chapterEnd < vol.chapterStart) continue;

    proposals.push({
      volumeNumber: vol.volumeNumber,
      chapterStart: vol.chapterStart,
      chapterEnd: vol.chapterEnd,
      source: 'mangadex',
      confidence: 0.9,
      extractionMethod: 'explicit-range',
      ...(vol.chapters && vol.chapters.length > 0 ? { chapters: vol.chapters } : {}),
      ...pickSemantic(vol),
    });
  }
  return proposals;
}
