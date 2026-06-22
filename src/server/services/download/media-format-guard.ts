/**
 * Media-format guard
 *
 * Heuristics that look at a download's actual file list (available from the
 * torrent client once metadata resolves) and decide whether it's a video
 * release masquerading as manga — e.g. a 26×.mkv anime BD pack that carried a
 * clean title and an "Other" category and so slipped past the pre-download
 * title/size/category filters (job 13168, JoJo's Bizarre Adventure).
 *
 * Pre-download filtering (prowlarr-scoring.filterMangaResults) only sees
 * title + size + category; the per-file extension truth only exists after the
 * client fetches the torrent's file list. This module is the backstop for that
 * gap. It is deliberately conservative: it only flags a download as video-only
 * when there is NO manga-format file present, so a real manga torrent (which
 * always carries .cbz/.zip/.pdf/images) can never be misclassified.
 */

/** Video container extensions — the strong "this is not manga" signal. */
const VIDEO_FILE_EXTENSIONS = new Set([
  'mkv', 'mp4', 'avi', 'mov', 'webm', 'wmv', 'm4v', 'm2ts', 'ts',
  'mpg', 'mpeg', 'flv', 'ogm', 'rmvb', 'vob', 'divx',
]);

/**
 * Manga/comic content extensions — archives, documents, and raw page images.
 * Raw images are intentionally included so a video pack carrying a stray
 * poster/sample image is NOT flagged (false-negative is safe; a wrongly
 * removed manga torrent is not).
 */
const MANGA_FILE_EXTENSIONS = new Set([
  'cbz', 'cbr', 'cb7', 'cbt', 'zip', 'rar', '7z',
  'pdf', 'epub', 'mobi', 'azw3',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tiff',
]);

/** Lowercase extension (no dot) of a file path's base name, or '' if none. */
function fileExt(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : '';
}

export interface DownloadFileLike {
  name: string;
}

export interface FileListClassification {
  total: number;
  videoCount: number;
  mangaCount: number;
  /** True when the list is clearly a video release: ≥1 video file, no manga
   *  file, and video files are at least half of all entries. */
  isVideoOnly: boolean;
}

/**
 * Classify a download's file list. Empty / nullish / metadata-not-yet-resolved
 * lists return total 0 and isVideoOnly false (nothing to act on yet).
 */
export function classifyDownloadFiles(
  files: readonly DownloadFileLike[] | null | undefined,
): FileListClassification {
  if (!files || files.length === 0) {
    return { total: 0, videoCount: 0, mangaCount: 0, isVideoOnly: false };
  }
  let videoCount = 0;
  let mangaCount = 0;
  for (const f of files) {
    const ext = fileExt(f.name);
    if (VIDEO_FILE_EXTENSIONS.has(ext)) videoCount++;
    else if (MANGA_FILE_EXTENSIONS.has(ext)) mangaCount++;
  }
  const total = files.length;
  const isVideoOnly =
    total > 0 && videoCount > 0 && mangaCount === 0 && videoCount >= Math.ceil(total / 2);
  return { total, videoCount, mangaCount, isVideoOnly };
}

/** Convenience predicate: is this download a video-only release? */
export function isVideoOnlyDownload(files: readonly DownloadFileLike[] | null | undefined): boolean {
  return classifyDownloadFiles(files).isVideoOnly;
}
