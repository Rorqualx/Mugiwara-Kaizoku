/**
 * Construct-type classifier for pack-import.
 *
 * The pack-import pipeline (parser → linker → DB upsert) was originally
 * built assuming JP tankobon shape: filenames carry volume markers,
 * volumes are real release units, synthetic volume-placeholder rows
 * (NULL chapterNumber, index >= 100000) are the correct DB representation. That
 * model breaks for:
 *
 * - **webtoon** (KR, vertical scroll, "Long Strip" tag): chapter-only;
 *   any volume signal in filenames is an aggregator artifact and
 *   synthesizing volume rows actively corrupts the DB state
 *   (cf. Lookism 2026-05-10 incident — 390 fake volume rows).
 * - **manhwa** (KR, traditional print volumes): volume-based, same as
 *   manga. Rare in the modern library but exists.
 * - **manhua** (CN): dual-mode — older series (Soul Land vol 1) are
 *   volume-released; modern series (Battle Through the Heavens) are
 *   webtoon-style chapter-only. Distinction surfaces via the
 *   "Long Strip" tag on AniList.
 * - **manga** (JP): the original assumption. Volumes are real.
 * - **unknown**: missing metadata — preserves the legacy code path
 *   so this classification is OPT-IN, never OPT-OUT.
 *
 * Signal source: `Metadata.countryOfOrigin` + `Metadata.tags`
 * (AniList-sourced). Mirrors the existing `isWebtoon` / `isKoreanManhwa`
 * helpers in `src/server/trpc/routers/home/utils.ts:573-597`.
 */

export type Construct = 'manga' | 'webtoon' | 'manhwa' | 'manhua' | 'unknown';

export interface ConstructMetadata {
  countryOfOrigin: string | null;
  format: string | null;
  tags: string[];
}

/**
 * Classify a manga's release construct from its enriched metadata.
 *
 * Order of precedence:
 *   1. "Long Strip" tag → webtoon (overrides country)
 *   2. countryOfOrigin === 'KR' → manhwa
 *   3. countryOfOrigin === 'CN' → manhua
 *   4. countryOfOrigin === 'JP' → manga
 *   5. anything else → unknown (legacy code path)
 */
export function detectConstruct(meta: ConstructMetadata): Construct {
  const country = meta.countryOfOrigin?.toUpperCase() ?? null;
  const hasLongStrip = meta.tags.some(t => t.toLowerCase().includes('long strip'));
  if (hasLongStrip) return 'webtoon';
  if (country === 'KR') return 'manhwa';
  if (country === 'CN') return 'manhua';
  if (country === 'JP') return 'manga';
  return 'unknown';
}

/**
 * True when the construct's "volume" is an aggregator artifact rather
 * than a real release unit. linkVolumeChapters consults this to decide
 * whether to create synthetic volume-placeholder rows. webtoons are the
 * only sure case today — manhua dual-mode is handled at the parser
 * level (iter-IL) by looking at filename shape, not construct alone.
 */
export function isVolumeArtifactConstruct(construct: Construct): boolean {
  return construct === 'webtoon';
}
