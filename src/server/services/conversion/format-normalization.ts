/**
 * File-format normalization
 *
 * `Chapter.fileFormat` was historically written with inconsistent casing
 * by different import paths:
 *   - native downloads (MangaDex, Suwayomi handlers) wrote lowercase
 *     `'cbz'` matching the conversionFormatSchema enum
 *   - pack-import / library-scanner / file-importer wrote uppercase
 *     `'CBZ'` via `.toUpperCase()` on the file extension
 *
 * Result: same on-disk format stored as both `'CBZ'` (461 chapters)
 * and `'cbz'` (23 chapters) across 5 manga (Pluto, Sakamoto Days, etc).
 * UI filters and downstream code comparing exact case silently miss
 * rows. iter-IC1 normalizes everything to lowercase (the canonical
 * form per `BaseConverter.conversionFormatSchema`).
 *
 * Usage:
 *   normalizeFileFormat('.CBZ')   → 'cbz'
 *   normalizeFileFormat('Vol.cbz') → 'cbz'   (handles full filenames too)
 *   normalizeFileFormat('foo.xyz') → null    (unknown extension)
 *   normalizeFileFormat(null)      → null
 */

import type { ConversionFormat } from './BaseConverter';

/**
 * Canonical lowercase format codes the system supports. Subset of
 * `conversionFormatSchema` — only the input/output formats that
 * appear as on-disk files for Chapter rows. Audio formats are
 * deliberately omitted (audiobooks use a separate model).
 */
const KNOWN_FILE_FORMATS = new Set<ConversionFormat>([
  'cbz', 'cbr', 'zip', '7z', 'cb7', 'tar', 'cbt', 'pdf', 'epub', 'mobi', 'azw3',
]);

/**
 * Aliases: extensions that don't appear in conversionFormatSchema but
 * map naturally to one that does. `.rar` is treated as `cbr` since the
 * system has no distinct 'rar' format code (cbr = comic-book RAR).
 */
const EXTENSION_ALIASES: Record<string, ConversionFormat> = {
  rar: 'cbr',
};

/**
 * Normalize an extension or filename to a canonical lowercase format
 * code. Accepts:
 *   - bare extension with or without leading dot (`.cbz`, `cbz`, `.CBZ`)
 *   - full filename (`Pluto V01.cbz`, `chapter-1.PDF`)
 *   - already-normalized format code (`'cbz'` → `'cbz'`)
 *
 * Returns null when the input doesn't map to a known format —
 * callers should preserve the existing field as-is in that case,
 * not overwrite with null.
 *
 * `path.extname` is deliberately avoided — it treats inputs like
 * `.cbz` (no name, just leading dot) as hidden files with no
 * extension and returns ''. Manual parsing handles both bare and
 * filename forms uniformly.
 */
export function normalizeFileFormat(input: string | null | undefined): ConversionFormat | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Strip one leading dot so `.cbz` and `cbz` are equivalent.
  const noLeading = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
  // Take everything after the LAST remaining dot — handles
  // `Title (2024) (Digital).cbz` and similar multi-dot filenames.
  // When there's no remaining dot, treat the whole thing as the
  // extension itself (bare format code).
  const lastDot = noLeading.lastIndexOf('.');
  const ext = lastDot === -1 ? noLeading : noLeading.slice(lastDot + 1);
  const lower = ext.toLowerCase();
  if (lower.length === 0) return null;

  if (KNOWN_FILE_FORMATS.has(lower as ConversionFormat)) {
    return lower as ConversionFormat;
  }
  if (lower in EXTENSION_ALIASES) {
    return EXTENSION_ALIASES[lower] ?? null;
  }
  return null;
}
